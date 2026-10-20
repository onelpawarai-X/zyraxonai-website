/** End-to-end proof of the rooted provider turn, without network access.
 *
 *  `brandChatStream` is exercised with an injected upstream so the real lane
 *  pool, the real rotation policy, and the real SSE framing all run. The only
 *  thing replaced is the socket. Run: npx tsx scripts/verify-brand-turn.ts */
import { brandChatStream } from "../src/lib/providers/zyraxon-brand.server";
import { lanePool } from "../src/lib/providers/lane-pool.server";

let failures = 0;
function check(name: string, ok: boolean, detail?: unknown) {
  if (ok) console.log(`PASS  ${name}${detail !== undefined ? `\n        ${detail}` : ""}`);
  else {
    failures++;
    console.log(`FAIL  ${name}${detail !== undefined ? `\n        ${detail}` : ""}`);
  }
}

const resolveTo = (brandId: string, chain: string[]) =>
  (async (id: string) =>
    id === brandId
      ? {
          brand: {
            id: brandId,
            label: "ZYRAXON Apex",
            tagline: "t",
            preferred: chain[0],
            capability: "c",
          },
          chain,
        }
      : null) as any;

const okUp = (upstream: string, text: string, label: string, sessionId?: string) =>
  ({ __ok: true, upstream, text, label, sessionId }) as any;

const failUp = (upstream: string, status: number, detail: string) =>
  ({ failed: { upstream, status, detail } }) as any;

// rotation: a retired model (404) hands off to the next in the chain
{
  const seen: string[] = [];
  const send = (async (_k: any, upstream: string, _m: any, _t: any, label: string, sid: string) => {
    seen.push(upstream + "|" + label + "|" + sid);
    if (upstream === "retired-model") return failUp(upstream, 404, "model not found");
    // The real transport frames SSE from the label, never the upstream id; the
    // fake honours that contract so the assertion below is meaningful.
    return new Response("streamed:" + label, { headers: { "X-ZYRAXON-Model": label } });
  }) as any;

  const res = await brandChatStream(
    "zyraxon-apex",
    [{ role: "user", content: "hi" }],
    undefined,
    { send, resolve: resolveTo("zyraxon-apex", ["retired-model", "big-pickle", "glm-5.3-flash-free"]) },
  );

  check("a retired model rotates to the next", res.status === 200, res.status);
  check("the preferred model was tried first", seen[0].startsWith("retired-model|"), seen[0]);
  check("and then the sibling", seen[1].startsWith("big-pickle|"), seen[1]);
  check("the caller sees the ZYRAXON label", seen[1].includes("|ZYRAXON Apex|"), seen[1]);
  check("every attempt carried a session id", seen.every((x) => x.split("|")[2]?.startsWith("ses_")));
  const body = await res.text();
  check("the response body carries no upstream name", !body.includes("big-pickle"), body);
}

// a credential gate stops the rotation instead of retrying every sibling
{
  let calls = 0;
  const send = (async (_k: any, upstream: string) => {
    calls++;
    return failUp(upstream, 403, "FreeTierError");
  }) as any;

  const res = await brandChatStream(
    "zyraxon-apex",
    [{ role: "user", content: "hi" }],
    undefined,
    { send, resolve: resolveTo("zyraxon-apex", ["beam-free", "big-pickle", "glm-5.3-flash-free"]) },
  );
  const body = await res.json();
  check("a gate answers 503", res.status === 503, res.status);
  check("the gate is not retried across every sibling", calls === 1, calls);
  check("the error type names the gate", body.error.type === "upstream_gate", body.error.type);
  check("the brand is named, not the upstream", body.error.model === "zyraxon-apex");
  check("the message tells the operator what to do", /OPENCODE_ZEN_API_KEY/.test(body.error.message));
}

// a healthy model is used immediately, with no retry
{
  let calls = 0;
  const send = (async (_k: any, upstream: string, _m: any, _t: any, label: string) => {
    calls++;
    return new Response("ok:" + upstream, { headers: { "X-ZYRAXON-Model": label } });
  }) as any;

  const res = await brandChatStream(
    "zyraxon-apex",
    [{ role: "user", content: "hi" }],
    undefined,
    { send, resolve: resolveTo("zyraxon-apex", ["beam-free", "big-pickle"]) },
  );
  check("a healthy first model is served at once", res.status === 200);
  check("no second model is tried after success", calls === 1, calls);
  check("the label header is the brand", res.headers.get("X-ZYRAXON-Model") === "ZYRAXON Apex");
  await res.text(); // drain so the lane is released for later checks
}

// every model unavailable for a non-gate reason: 502, not a gate
{
  const send = (async (_k: any, upstream: string) => failUp(upstream, 502, "empty stream")) as any;
  const res = await brandChatStream(
    "zyraxon-apex",
    [{ role: "user", content: "hi" }],
    undefined,
    { send, resolve: resolveTo("zyraxon-apex", ["beam-free", "big-pickle"]) },
  );
  const body = await res.json();
  check("a non-gate failure answers 502", res.status === 502, res.status);
  check("and is not mislabelled as a gate", body.error.type === "provider_unavailable", body.error.type);
  check("both models were tried", body.tried.length === 2, body.tried?.length);
}

// an unknown brand is a caller error, not a rotation
{
  const res = await brandChatStream("not-a-brand", [{ role: "user", content: "hi" }]);
  const body = await res.json();
  check("an unknown model answers 400", res.status === 400, res.status);
  check("and points at the model list", /\/models/.test(body.error.message), body.error.message);
}

// concurrency: many callers at once, each with its own fingerprint
{
  const sids = new Set<string>();
  let peak = 0;
  let inFlight = 0;
  const send = (async (_k: any, upstream: string, _m: any, _t: any, label: string, sid: string) => {
    inFlight++;
    peak = Math.max(peak, inFlight);
    sids.add(sid);
    await new Promise((r) => setTimeout(r, 10));
    inFlight--;
    return new Response("ok:" + upstream, { headers: { "X-ZYRAXON-Model": label } });
  }) as any;

  const before = lanePool.stats().opened;
  const results = await Promise.all(
    Array.from({ length: 40 }, (_, i) =>
      brandChatStream(
        "zyraxon-apex",
        [{ role: "user", content: "call " + i }],
        undefined,
        { send, resolve: resolveTo("zyraxon-apex", ["beam-free"]) },
      ),
    ),
  );
  check("40 concurrent callers all succeed", results.every((r) => r.status === 200));
  check("each caller had its own fingerprint", sids.size === 40, sids.size);
  check("concurrency stayed bounded", peak <= 512, "peak " + peak);
  check("40 lanes were opened", lanePool.stats().opened - before === 40, lanePool.stats().opened - before);
  // A streaming turn holds its lane until the body is drained, so the slots are
  // still occupied here. That is the invariant that keeps a flood of open
  // streams from exceeding the bound.
  check("streaming lanes stay held until drained", lanePool.stats().active === 40, lanePool.stats().active);
  await Promise.all(results.map((r) => r.text()));
  check("draining every body releases every lane", lanePool.stats().active === 0, lanePool.stats().active);
}

// Caller-defined tools must reach the upstream. The SDK path advertises only the
// gate catalogue, so a turn carrying tools has to be routed to the wire path or
// the caller's definitions are dropped and the model answers as though no tools
// existed — the "endless tool-validation" symptom.
{
  const seen: any[] = [];
  const send = (async (_k: any, upstream: string, _m: any, _t: any, label: string, sid: string, tools: any) => {
    seen.push({ upstream, tools });
    return new Response("streamed:" + label, { headers: { "X-ZYRAXON-Model": label } });
  }) as any;

  const tools = [
    {
      type: "function",
      function: {
        name: "write_file",
        description: "Write a file",
        parameters: { type: "object", properties: { path: { type: "string" } }, required: ["path"] },
      },
    },
  ];
  const res = await brandChatStream(
    "zyraxon-apex",
    [{ role: "user", content: "make a file" }],
    undefined,
    { send, resolve: resolveTo("zyraxon-apex", ["beam-free"]), tools },
  );
  check("a turn with caller tools succeeds", res.status === 200, res.status);
  check("the caller tool reached the upstream", seen[0]?.tools?.[0]?.function?.name === "write_file", JSON.stringify(seen[0]?.tools));
  await res.text();
}

// Without caller tools the SDK path is still used, so the caller-tool routing
// does not change the behaviour of an ordinary turn.
{
  const seen: any[] = [];
  const send = (async (_k: any, upstream: string, _m: any, _t: any, label: string, sid: string, tools: any) => {
    seen.push(tools);
    return new Response("streamed:" + label, { headers: { "X-ZYRAXON-Model": label } });
  }) as any;
  const res = await brandChatStream(
    "zyraxon-apex",
    [{ role: "user", content: "hi" }],
    undefined,
    { send, resolve: resolveTo("zyraxon-apex", ["beam-free"]) },
  );
  check("a tool-less turn passes no tools", seen[0] === undefined, JSON.stringify(seen[0]));
  await res.text();
}

console.log("\n" + (failures === 0 ? "ALL TURN CHECKS PASSED" : failures + " CHECK(S) FAILED"));
process.exit(failures === 0 ? 0 : 1);
