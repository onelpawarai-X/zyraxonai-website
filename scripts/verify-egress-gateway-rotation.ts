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
const { egressFor, egressLimited, noteGatewayOutcome, noteRefusal } = await import(
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

// ── the turn loop must report through noteRefusal, not park a gateway ───────
// This is the production bug: the turn loop called the socket-proxy parking
// function directly, so one 429 through the gateway parked it for ten minutes
// and every following turn left by the parked URL.
{
  const gw4 = "gw+https://gw4.example/";
  for (let i = 0; i < 5; i++) noteRefusal(gw4);
  check("a turn-loop refusal does not park a gateway", !egressLimited(gw4));
  const socket = "http://sock:8080";
  noteRefusal(socket);
  check("but a socket proxy is still parked on its first refusal", egressLimited(socket));
}

console.log(failures ? `\n${failures} CHECK(S) FAILED` : "\nALL GATEWAY ROTATION CHECKS PASSED");
process.exit(failures ? 1 : 0);
