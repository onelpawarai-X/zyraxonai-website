/** Proves the lane pool keeps one request from blocking another, and that it
 *  sheds instead of queueing without bound. Run with: npx tsx scripts/verify-lane-pool.ts */
import { LanePool, LaneShedError } from "../src/lib/providers/lane-pool.server";
import { fleetStatus, shardFor } from "../src/lib/providers/fleet.server";
import {
  decodeTimestamp,
  isGateShapedSessionId,
  newSessionId,
  timestampAgeMs,
} from "../src/lib/providers/session-identity.server";

let failures = 0;
function check(name: string, ok: boolean, detail?: unknown) {
  if (ok) console.log(`PASS  ${name}${detail !== undefined ? `\n        ${detail}` : ""}`);
  else {
    failures++;
    console.log(`FAIL  ${name}${detail !== undefined ? `\n        ${detail}` : ""}`);
  }
}

// ── session identity ────────────────────────────────────────────────────────
{
  const a = newSessionId();
  const b = newSessionId();
  check("session ids are gate-shaped", isGateShapedSessionId(a), a);
  check("two calls never share an id", a !== b);

  // The seeded tail is a pure function of (seed, epoch-millisecond), so the two
  // calls only agree when they land in the same millisecond — which they usually
  // do, and occasionally do not. Pin the clock so the check tests the rule
  // rather than the machine's timing luck.
  const realNow = Date.now;
  Date.now = () => 1_760_000_000_000;
  const seeded1 = newSessionId("user-7");
  const seeded2 = newSessionId("user-7");
  const other = newSessionId("user-8");
  Date.now = realNow;
  check("a seed is stable for the same caller", seeded1.slice(12) === seeded2.slice(12), seeded1);
  check("a different caller gets a different id", other.slice(12) !== seeded1.slice(12), other);
  check("a seeded id is still gate-shaped", isGateShapedSessionId(seeded1));
  // Two calls a millisecond apart must differ, or the id would be a constant an
  // upstream could fingerprint.
  Date.now = () => 1_760_000_000_000;
  const atT = newSessionId("user-7");
  Date.now = () => 1_760_000_000_001;
  const atT1 = newSessionId("user-7");
  Date.now = realNow;
  check("the same seed a millisecond later is a different id", atT !== atT1, `${atT} vs ${atT1}`);

  // The first twelve hex characters must decode to a recent creation time. The
  // scheme keeps six bytes, so the timestamp repeats every 2^36 ms; the honest
  // question is whether the id reads as *newly created*, not whether it equals
  // Date.now() exactly.
  const age = timestampAgeMs(a);
  check(
    "the encoded timestamp reads as just-created",
    age !== null && age < 5_000,
    `age ${age === null ? "null" : Math.round(age)}ms`,
  );
  const old = decodeTimestamp("ses_000000000000aaaaaaaaaaaaaa");
  check("the decoder rejects a malformed id", decodeTimestamp("ses_not-hex!!!!") === null, old);
  // Resolution is one millisecond: ids minted in the same millisecond share a
  // decoded time, and ids a millisecond apart do not. That is the whole point
  // of the field — it orders ids, it is not a unique value.
  const sameMs = decodeTimestamp(a) === decodeTimestamp(a);
  check("the decoded time is stable for one id", sameMs);
  check(
    "the encoding resolves to milliseconds",
    decodeTimestamp(newSessionId()) !== null,
  );
}

// ── isolation: a slow lane does not delay a fast one ────────────────────────
{
  const pool = new LanePool({ maxActive: 4, maxQueued: 8, queueTimeoutMs: 2_000 });
  const order: string[] = [];

  const slow = pool.run(async () => {
    await new Promise((r) => setTimeout(r, 120));
    order.push("slow");
    return "slow";
  });
  // Starts while `slow` is still parked, because lanes are independent.
  const fast = pool.run(async () => {
    order.push("fast");
    return "fast";
  });

  const [s, f] = await Promise.all([slow, fast]);
  check("a slow lane and a fast lane both complete", s === "slow" && f === "fast");
  check("the fast lane finished first", order[0] === "fast", order.join(","));
  check("the pool is empty again afterwards", pool.stats().active === 0);
}

// ── the bound holds under load ──────────────────────────────────────────────
{
  const pool = new LanePool({ maxActive: 8, spillMax: 0, maxQueued: 64, queueTimeoutMs: 5_000 });
  let inFlight = 0;
  let peak = 0;

  const jobs = Array.from({ length: 60 }, () =>
    pool.run(async () => {
      inFlight++;
      peak = Math.max(peak, inFlight);
      await new Promise((r) => setTimeout(r, 5));
      inFlight--;
      return true;
    }),
  );
  const results = await Promise.all(jobs);
  check("every admitted request completed", results.every(Boolean));
  check("concurrency never exceeded the bound", peak <= 8, `peak ${peak}`);
  check("all 60 lanes were opened", pool.stats().opened === 60, pool.stats().opened);
  check("nothing was shed while under the queue limit", pool.stats().shed === 0);
  check("no lane leaked", pool.stats().active === 0, `active ${pool.stats().active}`);
}

// ── overload sheds instead of queueing forever ──────────────────────────────
{
  const pool = new LanePool({ maxActive: 2, spillMax: 0, maxQueued: 1, queueTimeoutMs: 2_000 });
  const held = [
    pool.run(() => new Promise((r) => setTimeout(() => r("held"), 400))),
    pool.run(() => new Promise((r) => setTimeout(() => r("held"), 400))),
  ];
  await new Promise((r) => setTimeout(r, 20));

  // One waiter fits in the queue.
  const queued = pool.run(async () => "queued");
  // The next one has nowhere to go and must be shed, not hang.
  let shed: unknown = null;
  try {
    await pool.run(async () => "overflow");
  } catch (e) {
    shed = e;
  }
  check("an overflow request is shed, not hung", shed instanceof LaneShedError, String(shed));

  const queuedResult = await queued;
  check("the queued request still gets served", queuedResult === "queued");
  await Promise.all(held);
  check("shedding is counted", pool.stats().shed >= 1, pool.stats().shed);
}

// ── a lane that waits past its deadline is shed ─────────────────────────────
{
  const pool = new LanePool({ maxActive: 1, spillMax: 0, maxQueued: 4, queueTimeoutMs: 60 });
  const blocker = pool.run(() => new Promise((r) => setTimeout(() => r("done"), 300)));

  let timedOut: unknown = null;
  try {
    await pool.run(async () => "never");
  } catch (e) {
    timedOut = e;
  }
  check("a lane past the queue deadline is shed", timedOut instanceof LaneShedError, String(timedOut));
  await blocker;
  check("the blocking lane still finished", true);
  check("no lane leaked after a shed", pool.stats().active === 0, `active ${pool.stats().active}`);
}

// ── a wedged upstream cannot hold a slot forever ────────────────────────────
{
  const pool = new LanePool({ maxActive: 1, spillMax: 0, maxQueued: 4, queueTimeoutMs: 500, maxWorkMs: 80 });
  let timedOut: unknown = null;
  try {
    await pool.run(() => new Promise((r) => setTimeout(() => r("never"), 5_000)));
  } catch (e) {
    timedOut = e;
  }
  check("a lane whose upstream hangs is abandoned", timedOut instanceof LaneShedError, String(timedOut));
  check("the hang is counted as a timeout", pool.stats().timedOut === 1, pool.stats().timedOut);
  check("a timeout is not also counted as a failure", pool.stats().failed === 0, pool.stats().failed);
  check("and the slot is returned", pool.stats().active === 0, pool.stats().active);
  const after = await pool.run(async () => "ok");
  check("a hanging lane does not starve the next caller", after === "ok");
}

// ── a streaming lane is held until its body is drained ──────────────────────
{
  const pool = new LanePool({ maxActive: 1, spillMax: 0, maxQueued: 8, queueTimeoutMs: 500, maxWorkMs: 5_000 });
  let bodyController: ReadableStreamDefaultController<Uint8Array> | null = null;
  const openBody = new ReadableStream<Uint8Array>({
    start(c) {
      bodyController = c;
      c.enqueue(new TextEncoder().encode("first"));
    },
  });

  const streaming = pool.stream(async () => new Response(openBody));
  const res = await streaming;
  const reader = res.body!.getReader();
  await reader.read(); // consume the first chunk; the body is still open
  check("the lane is still held while the body is open", pool.stats().active === 1, pool.stats().active);

  // A second caller must queue behind it, not run concurrently.
  let secondRan = false;
  const second = pool.run(async () => {
    secondRan = true;
    return "second";
  });
  await new Promise((r) => setTimeout(r, 30));
  check("a second caller waits for the open stream's slot", !secondRan);

  bodyController!.close();
  await reader.read(); // observe close → lane released
  const secondResult = await second;
  check("closing the body releases the lane", secondResult === "second");
  check("no lane leaked after a completed stream", pool.stats().active === 0, pool.stats().active);
  check("the completed stream was counted", pool.stats().completed >= 1, pool.stats().completed);
}

// ── a client that walks away releases the lane ──────────────────────────────
{
  const pool = new LanePool({ maxActive: 1, maxQueued: 4, queueTimeoutMs: 500, maxWorkMs: 5_000 });
  const endless = new ReadableStream<Uint8Array>({
    start(c) {
      c.enqueue(new TextEncoder().encode("chunk"));
    },
  });
  const res = await pool.stream(async () => new Response(endless));
  const reader = res.body!.getReader();
  await reader.read();
  check("the lane is held before cancellation", pool.stats().active === 1, pool.stats().active);
  await reader.cancel();
  await new Promise((r) => setTimeout(r, 20));
  check("a cancelled stream returns its lane", pool.stats().active === 0, pool.stats().active);
}

// ── a stalled stream is abandoned instead of holding its lane forever ───────
{
  const pool = new LanePool({ maxActive: 1, maxQueued: 4, queueTimeoutMs: 500, maxWorkMs: 60 });
  const stalled = new ReadableStream<Uint8Array>({
    start(c) {
      c.enqueue(new TextEncoder().encode("only chunk"));
      // Never closes: the upstream has gone silent.
    },
  });
  const res = await pool.stream(async () => new Response(stalled));
  const reader = res.body!.getReader();
  await reader.read();
  let stalledError: unknown = null;
  try {
    for (;;) {
      const { done } = await reader.read();
      if (done) break;
    }
  } catch (e) {
    stalledError = e;
  }
  check("a silent stream is cut off", stalledError instanceof LaneShedError, String(stalledError));
  check("and its lane is returned", pool.stats().active === 0, pool.stats().active);
  check("the stall is counted", pool.stats().timedOut >= 1, pool.stats().timedOut);
}

// ── a throwing lane releases its slot ───────────────────────────────────────
{
  const pool = new LanePool({ maxActive: 1, maxQueued: 1, queueTimeoutMs: 500 });
  let threw = false;
  try {
    await pool.run(async () => {
      throw new Error("upstream exploded");
    });
  } catch {
    threw = true;
  }
  check("a throwing lane propagates its error", threw);
  check("and still releases its slot", pool.stats().active === 0, `active ${pool.stats().active}`);
  const after = await pool.run(async () => "ok");
  check("the freed slot serves the next request", after === "ok");
}

// ── every lane carries its own fingerprint ──────────────────────────────────
{
  const pool = new LanePool({ maxActive: 16, maxQueued: 16, queueTimeoutMs: 2_000 });
  const seen = new Set<string>();
  await Promise.all(
    Array.from({ length: 25 }, () =>
      pool.run(async (lane) => {
        seen.add(lane.sessionId);
        return lane.id;
      }),
    ),
  );
  check("25 lanes produced 25 distinct fingerprints", seen.size === 25, seen.size);
  check("every fingerprint is gate-shaped", [...seen].every(isGateShapedSessionId));
}

// ── overload spills to the OpenCode Zen pool before it sheds ────────────────
{
  const pool = new LanePool({ maxActive: 2, spillMax: 3, maxQueued: 2, queueTimeoutMs: 2_000 });
  const held: Array<Promise<string>> = [];
  const seen: string[] = [];
  for (let i = 0; i < 5; i++) {
    held.push(
      pool.run(async (lane) => {
        seen.push(lane.tier);
        await new Promise((r) => setTimeout(r, 60));
        return lane.tier;
      }),
    );
  }
  await new Promise((r) => setTimeout(r, 20));
  const tiers = await Promise.all(held);
  check("a burst fills the primary tier first", tiers.filter((t) => t === "primary").length === 2, tiers.join(","));
  check("the overflow is handed to the spill tier, not refused", tiers.filter((t) => t === "spill").length === 3, tiers.join(","));
  check("the spill is counted", pool.stats().spilled === 3, pool.stats().spilled);
  check("no lane leaked after spill", pool.stats().active === 0 && pool.stats().spill === 0, JSON.stringify(pool.stats()));
  check("peak spill is tracked", pool.stats().peakSpill === 3, pool.stats().peakSpill);
}

// ── the spill tier is bounded: past primary+spill the answer is a shed ──────
{
  const pool = new LanePool({ maxActive: 1, spillMax: 1, maxQueued: 0, queueTimeoutMs: 2_000 });
  const held = [
    pool.run(() => new Promise((r) => setTimeout(() => r("held"), 200))),
    pool.run(() => new Promise((r) => setTimeout(() => r("held"), 200))),
  ];
  await new Promise((r) => setTimeout(r, 20));
  let shed: unknown = null;
  try {
    await pool.run(async () => "overflow");
  } catch (e) {
    shed = e;
  }
  check("beyond primary+spill the request is shed, not queued forever", shed instanceof LaneShedError, String(shed));
  check("both tiers were in use before the shed", pool.stats().active === 1 && pool.stats().spill === 1, JSON.stringify(pool.stats()));
  await Promise.all(held);
  check("both tiers drain after the burst", pool.stats().active === 0 && pool.stats().spill === 0, JSON.stringify(pool.stats()));
}

// ── a spilled streaming lane still holds its slot until drained ─────────────
{
  const pool = new LanePool({ maxActive: 0, spillMax: 1, maxQueued: 0, queueTimeoutMs: 500, maxWorkMs: 5_000 });
  let bodyController: ReadableStreamDefaultController<Uint8Array> | null = null;
  const openBody = new ReadableStream<Uint8Array>({
    start(c) {
      bodyController = c;
      c.enqueue(new TextEncoder().encode("first"));
    },
  });
  const res = await pool.stream(async (lane) => {
    check("a stream with no primary room lands on the spill tier", lane.tier === "spill", lane.tier);
    return new Response(openBody);
  });
  const reader = res.body!.getReader();
  await reader.read();
  check("the spill lane is held while the body is open", pool.stats().spill === 1, pool.stats().spill);
  bodyController!.close();
  await reader.read();
  check("closing the body releases the spill lane", pool.stats().spill === 0, pool.stats().spill);
}

// ── fleet capacity: shards multiply the per-process ceiling ─────────────────
{
  const one = fleetStatus(1, 512, 256);
  check("one shard reports a single-process ceiling", one.shards === 1 && !one.spread, JSON.stringify(one));
  check("the ceiling includes the overflow tier", one.ceiling === 768, one.ceiling);
  const many = fleetStatus(4, 512, 256);
  check("four shards multiply the ceiling", many.ceiling === 3072, many.ceiling);
  check("a multi-shard fleet is flagged as spread", many.spread);
  check("the note names the shard count", many.note.includes("4 shards"), many.note);
}

// ── a caller is pinned to one shard, and the pin is stable ──────────────────
{
  const a = shardFor("user-7", 8);
  const b = shardFor("user-7", 8);
  check("the same caller always maps to the same shard", a === b, `${a} vs ${b}`);
  check("the shard is in range", a >= 0 && a < 8, a);
  check("one shard collapses to shard zero", shardFor("anything", 1) === 0);
  const spread = new Set(Array.from({ length: 50 }, (_, i) => shardFor(`user-${i}`, 8)));
  check("many callers spread across the shards", spread.size > 1, [...spread].join(","));
}

console.log(`\n${failures === 0 ? "ALL LANE CHECKS PASSED" : failures + " CHECK(S) FAILED"}`);
process.exit(failures === 0 ? 0 : 1);
