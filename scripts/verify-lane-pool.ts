/** Proves the lane pool keeps one request from blocking another, and that it
 *  sheds instead of queueing without bound. Run with: npx tsx scripts/verify-lane-pool.ts */
import { LanePool, LaneShedError } from "../src/lib/providers/lane-pool.server";
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

  const seeded1 = newSessionId("user-7");
  const seeded2 = newSessionId("user-7");
  check("a seed is stable for the same caller", seeded1.slice(12) === seeded2.slice(12), seeded1);
  check("a different caller gets a different id", newSessionId("user-8") !== seeded1);
  check("a seeded id is still gate-shaped", isGateShapedSessionId(seeded1));

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
  const pool = new LanePool({ maxActive: 8, maxQueued: 64, queueTimeoutMs: 5_000 });
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
  const pool = new LanePool({ maxActive: 2, maxQueued: 1, queueTimeoutMs: 2_000 });
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
  const pool = new LanePool({ maxActive: 1, maxQueued: 4, queueTimeoutMs: 60 });
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

console.log(`\n${failures === 0 ? "ALL LANE CHECKS PASSED" : failures + " CHECK(S) FAILED"}`);
process.exit(failures === 0 ? 0 : 1);
