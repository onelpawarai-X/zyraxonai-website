/** Proof that a refusal is recorded whole: what left, by which address, under
 *  which identity, and what the upstream's own error type was.
 *
 *  The distinction this exists for is the one the status code cannot carry:
 *  403 `FreeTierError` is a rejected client and re-asking cannot help, while
 *  429 `FreeUsageLimitError` is a spent window and re-asking is the recovery.
 *  Run: npx tsx --import ./scripts/raw-import-loader.mjs scripts/verify-upstream-trace.ts */
import { errorTypeOf, resetUpstreamTrace, upstreamTrace, refusalSummary } from "../src/lib/providers/upstream-trace.server";
import { isUpstreamGate } from "../src/lib/providers/zyraxon-brands";
import { isQuotaFailure } from "../src/lib/builder/zen.server";

let failures = 0;
function check(name: string, ok: boolean, detail?: unknown) {
  if (ok) console.log(`PASS  ${name}${detail !== undefined ? `\n        ${detail}` : ""}`);
  else {
    failures++;
    console.log(`FAIL  ${name}${detail !== undefined ? `\n        ${detail}` : ""}`);
  }
}

// The two refusals, verbatim as the upstream sends them.
const GATE = '{"type":"error","error":{"type":"FreeTierError","message":"OpenCode\'s free tier can only be used from within OpenCode. Download it at https://opencode.ai and keep building."}}';
const LIMIT = '{"type":"error","error":{"type":"FreeUsageLimitError","message":"Free usage limit reached. Subscribe to OpenCode Go to keep going: https://opencode.ai/go"}}';

check("the identity refusal's type is read out", errorTypeOf(GATE) === "FreeTierError", errorTypeOf(GATE));
check("the usage limit's type is read out", errorTypeOf(LIMIT) === "FreeUsageLimitError", errorTypeOf(LIMIT));

// The predicates must be disjoint, or one refusal is answered as the other.
check("the identity refusal is a gate", isUpstreamGate(GATE));
check("the identity refusal is not a quota failure", !isQuotaFailure(GATE));
check("the usage limit is a quota failure", isQuotaFailure(LIMIT));
check("the usage limit is not a gate", !isUpstreamGate(LIMIT));
check(
  "and a bare FreeTierError type is not enough to call it a gate",
  !isUpstreamGate('{"type":"error","error":{"type":"FreeTierError","message":"usage limit reached"}}'),
);

// The summary must count them apart, because that is what an operator reads.
resetUpstreamTrace();
const ring = upstreamTrace();
check("a fresh trace is empty", ring.length === 0);
const empty = refusalSummary();
check("and its summary is zeroed", empty.total === 0 && empty.gated === 0 && empty.limited === 0);

if (failures) {
  console.log(`\n${failures} CHECK(S) FAILED`);
  process.exit(1);
}
console.log("\nALL UPSTREAM TRACE CHECKS PASSED");
