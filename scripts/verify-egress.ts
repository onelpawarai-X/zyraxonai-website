/** Proves egress assignment spreads lanes over proxies and stays honest when
 *  no proxies are configured. Run: npx tsx scripts/verify-egress.ts */
process.env.ZYRAXON_EGRESS_URLS = "http://p1:8080,http://p2:8080,http://p3:8080";
const { egressFor, egressStatus, nextEgress } = await import(
  "../src/lib/providers/egress.server"
);

let failures = 0;
function check(name: string, ok: boolean, detail?: unknown) {
  if (ok) console.log(`PASS  ${name}${detail !== undefined ? `\n        ${detail}` : ""}`);
  else {
    failures++;
    console.log(`FAIL  ${name}${detail !== undefined ? `\n        ${detail}` : ""}`);
  }
}

// ── the pool is parsed and reported truthfully ──────────────────────────────
{
  const s = egressStatus();
  check("a configured pool reports pool mode", s.mode === "pool", s.mode);
  check("the proxy count is exact", s.proxies === 3, s.proxies);
  check("spread is true when more than one address exists", s.spread === true);
}

// ── round-robin covers every address ────────────────────────────────────────
{
  const seen = new Set<string>();
  for (let i = 0; i < 9; i++) seen.add(nextEgress()!);
  check("round-robin uses all three addresses", seen.size === 3, [...seen].join(","));
}

// ── a lane sticks to one address for its whole turn ─────────────────────────
{
  const lane = "ses_eab984603fffhkkuLPr67EXeNA";
  const a = egressFor(lane);
  const b = egressFor(lane);
  check("the same lane always gets the same address", a === b, `${a} vs ${b}`);
  check("the address is one of the pool", ["http://p1:8080", "http://p2:8080", "http://p3:8080"].includes(a!));
}

// ── different lanes land on different addresses ─────────────────────────────
{
  const assigned = new Set<string>();
  for (let i = 0; i < 60; i++) assigned.add(egressFor(`ses_${i.toString(16).padStart(12, "0")}aaaaaaaaaaaaaa`)!);
  check("many lanes spread over the whole pool", assigned.size === 3, [...assigned].join(","));
}

// ── no pool means no pretending ─────────────────────────────────────────────
{
  // A fresh module instance with the variable cleared, so the load-time parse
  // is what gets exercised.
  delete process.env.ZYRAXON_EGRESS_URLS;
  const fresh = await import(`../src/lib/providers/egress.server?direct=${Date.now()}`);
  const s = fresh.egressStatus();
  check("no pool reports direct mode", s.mode === "direct", s.mode);
  check("no pool reports zero proxies", s.proxies === 0, s.proxies);
  check("no pool says spread is false", s.spread === false);
  check("no pool returns no override", fresh.nextEgress() === undefined);
  check("the note names the real limitation", /one egress IP/i.test(s.note), s.note);
}

console.log(`\n${failures === 0 ? "ALL EGRESS CHECKS PASSED" : failures + " CHECK(S) FAILED"}`);
process.exit(failures === 0 ? 0 : 1);
