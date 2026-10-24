/** Background re-probe: the deployment checks the upstream for itself.
 *
 *  A countdown can only repeat what the upstream said. This proves the
 *  deployment also *asks*: while a quota is spent, a probe re-tests the
 *  upstream, and the recorded reset is cleared only when the upstream serves a
 *  token again. A probe that is still refused must leave the clock alone, or
 *  the panel would claim an open pool that is still refusing. */
import { startMock, setScenario, requests } from "../scripts/mock-upstream.mjs";

let failures = 0;
const check = (label: string, ok: boolean, detail = "") => {
  if (!ok) failures++;
  console.log(`${ok ? "PASS" : "FAIL"}  ${label}${detail ? "        " + detail : ""}`);
};

const { server, port } = await startMock({ port: 0 });
process.env.ZEN_BASE_URL = `http://127.0.0.1:${port}/v1`;
process.env.OPENCODE_ZEN_API_KEY = "test-key";
process.env.ZYRAXON_QUOTA_PROBE_MS = "0";

const { quotaResetStatus, resetQuotaClock, clearQuotaReset } = await import(
  "../src/lib/providers/quota.server"
);
const { probeQuotaReset, resetQuotaProbe } = await import("../src/lib/providers/quota-probe.server");
const { brandChatStream } = await import("../src/lib/providers/zyraxon-brand.server");

const served = (id: string, chain: string[]) =>
  (async (modelId: string) =>
    modelId === id ? { brand: { id, label: "ZYRAXON Apex", preferred: chain[0] }, chain } : null) as any;

async function turn() {
  const res = await brandChatStream("zyraxon-apex", [{ role: "user", content: "hi" }], undefined, {
    resolve: served("zyraxon-apex", ["beam-free", "big-pickle"]),
  });
  await res.text();
  return res;
}

// -- a cold isolate has no evidence, so it says so rather than claiming an open
//    pool it cannot vouch for. This is the state that used to answer "open"
//    purely because it had never seen a refusal, which is how two browser
//    profiles read the same instant as "open" and "2h left".
resetQuotaClock();
resetQuotaProbe();
check("a cold isolate is not spent", quotaResetStatus().spent === false);
check("but says so as unknown, not as open", quotaResetStatus().unknown === true);

// -- once the pool has been *observed* open, a probe costs no upstream request
//    at all: there is nothing left to re-check.
clearQuotaReset();
resetQuotaProbe();
check("an observed-open pool is not unknown", quotaResetStatus().unknown === undefined);
const quietBefore = requests.length;
check("and a probe declines to ask", (await probeQuotaReset()) === false);
check("costing no upstream request", requests.length === quietBefore, `+${requests.length - quietBefore}`);

// -- a real refusal records the upstream's own clock
setScenario("quota-all");
const refused = await turn();
check("the refused turn answers 429", refused.status === 429, String(refused.status));
const recorded = quotaResetStatus();
check("and its reset is on the books", recorded.spent === true);
check("with the upstream's own number", recorded.retryAfterSeconds === 300, String(recorded.retryAfterSeconds));

// -- while the pool is still refusing, a probe must change nothing
resetQuotaProbe();
check("a probe against a still-spent pool reports no reset", (await probeQuotaReset()) === false);
const stillSpent = quotaResetStatus();
check("and the clock is untouched", stillSpent.spent === true);
check("and keeps the upstream's number", stillSpent.retryAfterSeconds === 300, String(stillSpent.retryAfterSeconds));

// -- the pool opens: the probe is what notices, not the timer
setScenario("ok");
resetQuotaProbe();
check("a probe against an open pool reports the reset", (await probeQuotaReset()) === true);
check("and the recorded reset is cleared", quotaResetStatus().spent === false);
check("so the surface shows an open pool", quotaResetStatus().retryAfterSeconds === undefined);

// -- a probe is paced: a second call inside the interval reaches the upstream
//    exactly zero times. The mock counts requests, so this is the real thing
//    being measured, not the return value.
process.env.ZYRAXON_QUOTA_PROBE_MS = "60000";
const { probeQuotaReset: pacedProbe } = await import("../src/lib/providers/quota-probe.server");
// The interval is read per call, so this run sees the minute set just above.
resetQuotaClock();
setScenario("quota-all");
await turn();
check("a refusal is recorded for the paced run", quotaResetStatus().spent === true);
resetQuotaProbe();
const before = requests.length;
await pacedProbe();
const afterFirst = requests.length;
check("the first probe in an interval asks the upstream", afterFirst > before, `+${afterFirst - before}`);
await pacedProbe();
await pacedProbe();
check("later probes in the same interval ask nothing", requests.length === afterFirst, `+${requests.length - afterFirst}`);

// -- a served turn is itself the strongest evidence, so it clears the clock
resetQuotaClock();
setScenario("quota-all");
await turn();
check("a refusal is recorded again", quotaResetStatus().spent === true);
setScenario("ok");
const good = await turn();
check("a later turn is served", good.status === 200, String(good.status));
check("and clears the recorded reset by itself", quotaResetStatus().spent === false);

// -- the probe must travel the same channel a real turn does. If it did not,
//    the reset it observes would be about a different route than the one a
//    caller is waiting on, and the whole check would be meaningless.
const probeReq = requests[requests.length - 1];
const turnReq = requests[0];
check("the probe posts to the chat-completions path", /\/chat\/completions$/.test(probeReq.url), probeReq.url);
check("the probe carries the session fingerprint the gate reads", !!probeReq.headers["x-opencode-session"], "x-opencode-session");
check("and the second fingerprint header too", !!probeReq.headers["x-opencode-session-id"], "x-opencode-session-id");
check("and the project header", probeReq.headers["x-opencode-project"] === "zyraxon", String(probeReq.headers["x-opencode-project"]));
// Same channel, same headers, own fingerprint. The session id is deliberately
// *not* shared: each lane carries its own so the upstream throttles them
// separately, and a probe reusing a turn's fingerprint would spend that turn's
// bucket. What must match is the shape the gate reads.
for (const h of ["x-opencode-project", "x-opencode-client", "user-agent", "content-type"]) {
  check(`the probe sends the same ${h} as a real turn`, probeReq.headers[h] === turnReq.headers[h], `${String(probeReq.headers[h])} vs ${String(turnReq.headers[h])}`);
}
check("the probe's fingerprint has the shape the gate accepts", /^ses_[0-9a-zA-Z]+$/.test(String(probeReq.headers["x-opencode-session-id"])), String(probeReq.headers["x-opencode-session-id"]));
check("and is not a turn's fingerprint reused", probeReq.headers["x-opencode-session-id"] !== turnReq.headers["x-opencode-session-id"]);

server.close();
console.log(failures ? `\n${failures} CHECK(S) FAILED` : "\nALL QUOTA PROBE CHECKS PASSED");
process.exit(failures ? 1 : 0);
