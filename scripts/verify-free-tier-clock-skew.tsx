/** A countdown that reads 00:00:00 while the pool is still refusing.
 *
 *  The panel derives its remaining time by comparing the upstream's `resetAt`
 *  against the *reader's* clock. That is only correct when the reader's clock
 *  agrees with the server's. On a machine whose clock runs fast — common, and
 *  not something the page can fix — `resetAt` lands in the past, so a pool with
 *  hours left is drawn as 00:00:00 and labelled "Resetting now". The reader is
 *  then told the opposite of the truth, twice: that the reset already happened,
 *  and (by the provider) that it has not.
 *
 *  The upstream also states `retryAfterSeconds`, which is a *duration* and so is
 *  immune to clock skew. This proves the panel uses it.
 *
 *  Run: npx tsx --import ./scripts/raw-import-loader.mjs scripts/verify-free-tier-clock-skew.tsx
 */
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { FreeTierClock } from "../src/components/site/FreeTierClock";

let failures = 0;
function check(name: string, ok: boolean, detail?: unknown) {
  if (ok) console.log(`PASS  ${name}${detail !== undefined ? `\n        ${detail}` : ""}`);
  else {
    failures++;
    console.log(`FAIL  ${name}${detail !== undefined ? `\n        ${detail}` : ""}`);
  }
}

const HOUR = 3_600_000;
const realNow = Date.now;

/** The three countdown cells, as a reader sees them. */
function cellsOf(html: string): string[] {
  return [...html.matchAll(/zx-flip-in">([^<]*)<\/span>/g)].map((m) => m[1]);
}

/** A payload shaped exactly like the provider endpoint's, for a pool with three
 *  hours left. Both fields are published; only one is skew-proof. */
function payload(now: number) {
  return {
    available: false,
    retryAfterSeconds: 3 * 3600,
    resetAt: new Date(now + 3 * HOUR).toISOString(),
    windowSeconds: 6 * 3600,
    // The server states its own clock, which is what makes the deadline
    // interpretable on a machine whose clock disagrees with it.
    serverNow: new Date(now).toISOString(),
  };
}

// ── an accurate clock reads the real remaining time ─────────────────────────
{
  const now = realNow();
  const html = renderToStaticMarkup(<FreeTierClock status={payload(now)} />);
  const cells = cellsOf(html);
  check("an accurate clock shows three hours", cells[0] === "03", JSON.stringify(cells));
}

// ── a fast clock must not collapse the countdown to zero ────────────────────
{
  const now = realNow();
  // The reader's machine is four hours ahead: a real, reported condition.
  Date.now = () => now + 4 * HOUR;
  const html = renderToStaticMarkup(<FreeTierClock status={payload(now)} />);
  const cells = cellsOf(html);
  Date.now = realNow;
  check("a four-hour-fast clock still shows three hours", cells[0] === "03", JSON.stringify(cells));
  check("and does not claim the pool is resetting", !/Resetting now/.test(html));
}

// ── a slow clock must not inflate it either ─────────────────────────────────
{
  const now = realNow();
  Date.now = () => now - 2 * HOUR;
  const html = renderToStaticMarkup(<FreeTierClock status={payload(now)} />);
  const cells = cellsOf(html);
  Date.now = realNow;
  check("a two-hour-slow clock still shows three hours", cells[0] === "03", JSON.stringify(cells));
}

console.log(failures ? `\n${failures} CHECK(S) FAILED` : "\nALL CLOCK SKEW CHECKS PASSED");
process.exit(failures ? 1 : 0);
