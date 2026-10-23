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
check("a spent pool says it is at capacity", /Free tier at capacity/.test(spent), "capacity badge");
check("and draws the draining ring", /zx-clock-arc/.test(spent));
check("and draws the orbiting dot", /zx-clock-orbit/.test(spent));

// -- hours, minutes and seconds are three separate cells with their own labels
check("the countdown has an hours cell", /Hours/.test(spent) && /zx-clock-cell/.test(spent));
check("the countdown has a minutes cell", /Minutes/.test(spent));
check("the countdown has a seconds cell", /Seconds/.test(spent));
const cells = (spent.match(/zx-clock-cell/g) ?? []).length;
check("there are exactly three time cells", cells === 3, `found ${cells}`);
const labels = (spent.match(/(Hours|Minutes|Seconds)<\/span>/g) ?? []).length;
check("each cell carries its own label", labels === 3, `found ${labels}`);
check("the cells are separated by a blinking colon", /zx-clock-colon/.test(spent));
check("the hours cell reads 01", />01<\/span>[\s\S]{0,200}?Hours<\/span>/.test(spent), "01 hours");
check("and rolls each cell rather than swapping it", /zx-flip-in/.test(spent));
check("and states the ceiling as a clock", /at most 12h 00m 00s per window/.test(spent), spent.match(/at most [^.]*/)?.[0]);
check("and never names an env var at the reader", !/OPENCODE_ZEN_API_KEY/.test(spent));

// Each cell renders exactly one pair of digits, never a longer run.
const cells2 = [...spent.matchAll(/zx-flip-in">([^<]*)<\/span>/g)].map((m) => m[1]);
check("every cell holds exactly two digits", cells2.length === 3 && cells2.every((t) => /^\d{2}$/.test(t)), JSON.stringify(cells2));

const open = renderToStaticMarkup(<FreeTierClock status={{ available: true }} />);
check("an open pool says so", /Free tier open/.test(open), "open badge");
check("and draws no orbiting dot", !/zx-clock-orbit/.test(open));
check("and blooms green", /zx-clock-open/.test(open));
// -- a genuinely reset pool reads zero, not a hidden clock
const openCells = [...open.matchAll(/zx-flip-in">([^<]*)<\/span>/g)].map((m) => m[1]);
check("and its countdown reads 00 00 00", JSON.stringify(openCells) === JSON.stringify(["00", "00", "00"]), JSON.stringify(openCells));
check("and keeps all three cells in place", (open.match(/zx-clock-cell/g) ?? []).length === 3);
check("and says zero means the pool is back", /genuinely back, not because a timer ran out/.test(open));
check("and the separators stop blinking", !/zx-clock-colon/.test(open));

const expired = renderToStaticMarkup(
  <FreeTierClock status={{ available: false, retryAfterSeconds: 1, resetAt: new Date(Date.now() - 5_000).toISOString(), windowSeconds: 300 }} />,
);
check("a passed reset reads as resetting, not as a negative count", /Resetting now/.test(expired), "resetting badge");
// The digits are read from text nodes, not from the class attribute: Tailwind
// utility names like `shrink-0` contain a `-0` that is not a count.
const expiredDigits = expired.replace(/class="[^"]*"/g, "");
check("and clamps every cell at zero instead of going negative", !/>\s*[-−]/.test(expiredDigits), expiredDigits.match(/>\s*[-−][^<]*/g)?.join(","));
check("and every cell reads 00", />00<\/span>[\s\S]{0,200}?Hours<\/span>/.test(expiredDigits) && />00<\/span>[\s\S]{0,200}?Seconds<\/span>/.test(expiredDigits));

// -- the seconds fallback: a payload with no absolute stamp still counts down
const noStamp = renderToStaticMarkup(<FreeTierClock status={{ available: false, retryAfterSeconds: 90 }} />);
check("a payload with only seconds counts down to 01m 30s", />01<\/span>[\s\S]{0,200}?Minutes<\/span>/.test(noStamp) && />30<\/span>[\s\S]{0,200}?Seconds<\/span>/.test(noStamp), "01 / 30");
check("and shows a zero hours cell rather than hiding it", />00<\/span>[\s\S]{0,200}?Hours<\/span>/.test(noStamp), "00 hours");

// -- a twelve-hour window reads hour-by-hour, not as a decimal
const twelve = renderToStaticMarkup(
  <FreeTierClock status={{ available: false, retryAfterSeconds: 43_200, resetAt: new Date(Date.now() + 43_200_000).toISOString(), windowSeconds: 43_200 }} />,
);
check("twelve hours reads as 12", />12<\/span>[\s\S]{0,200}?Hours<\/span>/.test(twelve), "12 hours");
check("and its minutes read 00", />00<\/span>[\s\S]{0,200}?Minutes<\/span>/.test(twelve));

// -- the upstream stated no clock: no number is invented
const noClock = renderToStaticMarkup(<FreeTierClock status={{ available: false }} />);
check("an unstated clock keeps its three cells", (noClock.match(/zx-clock-cell/g) ?? []).length === 3);
const blank = [...noClock.matchAll(/zx-flip-in">([^<]*)<\/span>/g)].map((m) => m[1]);
check("but shows blanks, never a zero the upstream did not state", JSON.stringify(blank) === JSON.stringify(["--", "--", "--"]), JSON.stringify(blank));
check("and says the reset time was not stated", /stated no reset time/.test(noClock));
check("and draws no orbiting dot", !/zx-clock-orbit/.test(noClock));

// -- a missing payload draws nothing rather than an empty frame
const none = renderToStaticMarkup(<FreeTierClock status={undefined} />);
check("no payload renders nothing", none === "", JSON.stringify(none));

console.log(failures ? `\n${failures} CHECK(S) FAILED` : "\nALL FREE TIER CLOCK CHECKS PASSED");
process.exit(failures ? 1 : 0);
