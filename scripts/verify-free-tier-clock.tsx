/** The free-tier reset clock as a reader sees it.
 *
 *  The provider endpoint publishes the reset; this proves the panel drawn from
 *  that payload states the real number, states the ceiling, and flips to the
 *  open state when the upstream says the window has passed — so the page cannot
 *  show a countdown for a pool that is already serving. */
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { FreeTierClock } from "../src/components/site/FreeTierClock";
import {
  noteQuotaReset,
  quotaResetStatus,
  resetQuotaClock,
  quotaWindowCeiling,
} from "../src/lib/providers/quota.server";

let failures = 0;
function check(name: string, ok: boolean, detail?: unknown) {
  if (ok) console.log(`PASS  ${name}${detail !== undefined ? `\n        ${detail}` : ""}`);
  else {
    failures++;
    console.log(`FAIL  ${name}${detail !== undefined ? `\n        ${detail}` : ""}`);
  }
}

// -- the ceiling is remembered, and grows only when a larger window is stated
resetQuotaClock();
check("no ceiling is published before any refusal", quotaWindowCeiling() === undefined);
noteQuotaReset(300);
check("a stated window becomes the ceiling", quotaWindowCeiling() === 300, quotaWindowCeiling());
noteQuotaReset(120);
check("a smaller window does not lower the ceiling", quotaWindowCeiling() === 300, quotaWindowCeiling());
noteQuotaReset(43200);
check("a larger window raises the ceiling", quotaWindowCeiling() === 43200, quotaWindowCeiling());

const status = quotaResetStatus();
check("the ceiling travels with the status", status.windowSeconds === 43200, status.windowSeconds);

// -- the panel renders the countdown, the ceiling, and the state
const spent = renderToStaticMarkup(
  <FreeTierClock status={{ available: false, retryAfterSeconds: 3600, resetAt: new Date(Date.now() + 3_600_000).toISOString(), windowSeconds: 43200 }} />,
);
check("a spent pool renders the countdown", /1h 00m/.test(spent), spent.match(/1h 00m/)?.[0]);
check("and says the pool is at capacity", /Free tier at capacity/.test(spent), "capacity badge");
check("and states the ceiling in human units", /at most 12h per window/.test(spent), spent.match(/at most [^.]*/)?.[0]);
check("and offers the keyed path that does not wait", /OPENCODE_ZEN_API_KEY/.test(spent));
check("and draws the draining ring", /zx-clock-arc/.test(spent));
check("and draws the orbiting dot", /zx-clock-orbit/.test(spent));
check("and carries the ticking digit animation", /zx-clock-digit/.test(spent));

const open = renderToStaticMarkup(<FreeTierClock status={{ available: true }} />);
check("an open pool says so", /Free tier open/.test(open), "open badge");
check("and shows no countdown", !/until the pool opens/.test(open));
check("and draws no orbiting dot", !/zx-clock-orbit/.test(open));
check("and blooms green", /zx-clock-open/.test(open));

const expired = renderToStaticMarkup(
  <FreeTierClock status={{ available: false, retryAfterSeconds: 1, resetAt: new Date(Date.now() - 5_000).toISOString(), windowSeconds: 300 }} />,
);
check("a passed reset reads as resetting, not as a negative count", /Resetting now/.test(expired), "resetting badge");
// The digits are read from text nodes, not from the class attribute: Tailwind
// utility names like `shrink-0` contain a `-0` that is not a count.
const expiredDigits = expired.replace(/class="[^"]*"/g, "");
check("and clamps the count at zero instead of going negative", />0s</.test(expiredDigits), expiredDigits.match(/>[^<]*s</g)?.join(","));
check("and renders no negative count in its text", !/>[-−]/.test(expiredDigits), expiredDigits.match(/>[-−][^<]*/g)?.join(","));

// -- the seconds fallback: a payload with no absolute stamp still counts down
const noStamp = renderToStaticMarkup(<FreeTierClock status={{ available: false, retryAfterSeconds: 90 }} />);
check("a payload with only seconds still counts down", /1m 30s/.test(noStamp), noStamp.match(/1m 30s/)?.[0]);

// -- a missing payload draws nothing rather than an empty frame
const none = renderToStaticMarkup(<FreeTierClock status={undefined} />);
check("no payload renders nothing", none === "", JSON.stringify(none));

console.log(failures ? `\n${failures} CHECK(S) FAILED` : "\nALL FREE TIER CLOCK CHECKS PASSED");
process.exit(failures ? 1 : 0);
