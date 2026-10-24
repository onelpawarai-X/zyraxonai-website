// The upstream refuses a client release below its free-tier floor with
// `426 UpgradeRequired` before any model is considered. That refusal is
// permanent for the deployment — the same request is refused on every model —
// so it must stop the rotation and be reported as its own condition. Before
// this, a 426 was classified as a generic fault and the caller was told
// "every model in its rotation was unavailable", which points at the upstream,
// the network and the keys instead of the one value that is wrong.
//
// The version the deployment reports is also validated: an override below the
// measured floor is refused at load time, because honouring it would turn every
// free model into the same 426.
//
// Run: npx tsx --import ./scripts/raw-import-loader.mjs scripts/verify-upgrade-required.ts
import { startMock, setScenario, requests } from "./mock-upstream.mjs";

let failures = 0;
function check(name: string, ok: boolean, detail?: unknown) {
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail !== undefined ? ` — ${detail}` : ""}`);
  if (!ok) failures++;
}

// The mock has to be listening, and the base URL and the version override have
// to be in the environment, BEFORE any module under test is imported: the
// transport reads both at load time.
const { server, port } = await startMock();
process.env.ZEN_BASE_URL = `http://127.0.0.1:${port}/v1`;
// Below the measured floor on purpose: the load-time guard must refuse this and
// fall back to the pin, so the turn still satisfies the gate.
process.env.ZYRAXON_OPENCODE_UA = "opencode/1.10.0";

const { isUpgradeRequired } = await import("../src/lib/providers/zyraxon-brands");
const { ZEN_UA_VERSION, MIN_FREE_TIER_VERSION } = await import("../src/lib/builder/zen.server");
const { brandChatStream } = await import("../src/lib/providers/zyraxon-brand.server");
const { refusalSummary } = await import("../src/lib/providers/upstream-trace.server");

// ── the predicate itself ────────────────────────────────────────────────────
check(
  "the upstream's own type name is recognised",
  isUpgradeRequired(
    '{"type":"error","error":{"type":"UpgradeRequired","message":"OpenCode 1.18.0 or newer is required to use the free tier"}}',
  ),
);
check("its wording alone is enough", isUpgradeRequired("OpenCode 1.18.0 or newer is required to use the free tier"));
check(
  "a spent quota is NOT an upgrade refusal",
  !isUpgradeRequired("Free usage limit reached. Subscribe to OpenCode Go"),
);
check(
  "the identity gate is NOT an upgrade refusal",
  !isUpgradeRequired("OpenCode's free tier can only be used from within OpenCode."),
);

// ── the version floor is enforced on the override ───────────────────────────
check(
  "an override below the floor is refused, not honoured",
  ZEN_UA_VERSION !== "1.10.0",
  `reported ${ZEN_UA_VERSION}, floor ${MIN_FREE_TIER_VERSION}`,
);
const [fMaj, fMin, fPat] = MIN_FREE_TIER_VERSION.split(".").map(Number);
const [rMaj, rMin, rPat] = ZEN_UA_VERSION.split(".").map(Number);
check(
  "and the version actually reported is at or above the floor",
  rMaj > fMaj || (rMaj === fMaj && (rMin > fMin || (rMin === fMin && rPat >= fPat))),
  `reported ${ZEN_UA_VERSION} >= ${MIN_FREE_TIER_VERSION}`,
);

// ── end to end: a 426 stops the rotation and is named ───────────────────────
setScenario("upgrade-all");
requests.length = 0;

const res = await brandChatStream("zyraxon-apex", [{ role: "user", content: "hello" }], undefined, {});
const status = res.status;
const body = await res.json().catch(() => ({}) as any);
check("the caller is answered with 426, the upstream's own code", status === 426, `status ${status}`);
check("the error names the condition", body?.error?.type === "upgrade_required", String(body?.error?.type));
check(
  "the client release actually reported is disclosed",
  typeof body?.error?.reportedClient === "string" && /^opencode\//.test(body.error.reportedClient),
  String(body?.error?.reportedClient),
);
check(
  "the release it must be raised to is disclosed",
  body?.error?.minimumClient === MIN_FREE_TIER_VERSION,
  String(body?.error?.minimumClient),
);
check(
  "the message points at the version pin, not at an outage",
  /ZYRAXON_OPENCODE_UA|newer OpenCode release/i.test(String(body?.error?.message)),
  String(body?.error?.message).slice(0, 140),
);
const modelCalls = requests.filter((r: any) => r.url.endsWith("/chat/completions")).length;
check("the rotation stopped instead of asking every model", modelCalls <= 3, `${modelCalls} model call(s)`);
check(
  "the trace counts it in its own bucket",
  refusalSummary().upgrade > 0,
  JSON.stringify(refusalSummary()),
);

server.close();
if (failures) {
  console.log(`\n${failures} CHECK(S) FAILED`);
  process.exit(1);
}
console.log("\nALL UPGRADE-REQUIRED CHECKS PASSED");
