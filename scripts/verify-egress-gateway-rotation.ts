/** Proves a gateway URL survives the refusals it is expected to produce.
 *
 *  A gateway is a pool of addresses behind one URL, so a 429 through it means
 *  "one of its addresses was spent", not "the gateway is spent". Parking the
 *  URL on the first refusal therefore disables the rotation the gateway exists
 *  for — which is exactly what happened in production, where a worker that
 *  served one turn in ten was parked for ten minutes and served none.
 *
 *  Run: npx tsx scripts/verify-egress-gateway-rotation.ts
 */
process.env.ZYRAXON_EGRESS_URLS = "gw+https://gw.example/";
const { egressFor, egressLimited, noteGatewayOutcome } = await import(
  "../src/lib/providers/egress.server"
);

let failures = 0;
function check(name: string, ok: boolean, detail?: unknown) {
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail !== undefined ? `\n        ${detail}` : ""}`);
  if (!ok) failures++;
}

const GW = "gw+https://gw.example/";

// ── one refusal must not park the gateway ───────────────────────────────────
{
  noteGatewayOutcome(GW, true);
  check("a single refusal leaves the gateway in rotation", !egressLimited(GW));
  const lane = "ses_eab984603fffhkkuLPr67EXeNA";
  check("and lanes are still assigned it", egressFor(lane) === GW, String(egressFor(lane)));
}

// ── a serving gateway is never parked, however many refusals came before ────
// A separate URL so the previous block's strike count cannot carry over: each
// gateway keeps its own run.
{
  const gw2 = "gw+https://gw2.example/";
  for (let i = 0; i < 19; i++) noteGatewayOutcome(gw2, true);
  noteGatewayOutcome(gw2, false); // one served turn clears the run
  for (let i = 0; i < 19; i++) noteGatewayOutcome(gw2, true);
  check("a served turn resets the refusal run", !egressLimited(gw2));
}

// ── only a sustained run of refusals parks it, and briefly ──────────────────
{
  const gw3 = "gw+https://gw3.example/";
  for (let i = 0; i < 25; i++) noteGatewayOutcome(gw3, true);
  check("a sustained run of refusals does park the gateway", egressLimited(gw3));
}

console.log(failures ? `\n${failures} CHECK(S) FAILED` : "\nALL GATEWAY ROTATION CHECKS PASSED");
process.exit(failures ? 1 : 0);
