/** The star countdown, held to the properties the page depends on.
 *
 *  The clock is the reason the provider gate is legible, and its contract is
 *  narrow enough to state exactly: the remaining time is the remaining stars
 *  times `HOURS_PER_STAR`, every star takes time off it, and an unreadable count
 *  produces no number at all rather than a plausible one. Each of those is a way
 *  the page could lie, so each is checked.
 *
 *  The measured pace is checked too, but only for its honesty guards: it must be
 *  absent when it cannot be measured, and it must not be allowed to reach the
 *  clock. That separation is the design — the clock is a stated rule, not a
 *  forecast — and a test is the only thing that keeps the two from being
 *  quietly re-joined later.
 *
 *  Run: npx tsx scripts/verify-star-eta.ts */
import { HOURS_PER_STAR, starEta } from "../src/lib/providers/star-eta";

let failures = 0;
const check = (label: string, ok: boolean, detail = "") => {
  if (!ok) failures++;
  console.log(`${ok ? "PASS" : "FAIL"}  ${label}${detail ? "        " + detail : ""}`);
};

// The repository as it stands: created 2026-09-07, 9 stars on 2026-10-24.
const CREATED = "2026-09-07T19:16:20Z";
const NOW = new Date("2026-10-24T12:00:00Z");
const GOAL = 100_000;

const live = starEta(9, CREATED, NOW);
check(
  "remaining stars are the goal minus the count",
  live.remaining === GOAL - 9,
  `${live.remaining}`,
);
check(
  "the clock is the remaining stars times the rule",
  live.hours === (GOAL - 9) * HOURS_PER_STAR,
  `${live.hours} hours`,
);
check(
  "seconds agree with hours",
  live.seconds === Math.round((live.hours ?? 0) * 3600),
  `${live.seconds}s`,
);
check("a live count is not 'reached'", live.reached === false);

// The whole point: a star must move the clock earlier, by exactly the rule.
const plusOne = starEta(10, CREATED, NOW);
const saved = (live.seconds ?? 0) - (plusOne.seconds ?? 0);
check(
  "one more star shortens the clock by one hour",
  saved === HOURS_PER_STAR * 3600,
  `saved ${saved}s = ${saved / 3600}h`,
);

// And it must keep doing so across the whole range, never once lengthening.
let prev = Infinity;
let monotonic = true;
let sawDecrease = false;
for (let s = 0; s <= GOAL; s += 137) {
  const secs = starEta(s, CREATED, NOW).seconds ?? 0;
  if (secs > prev) monotonic = false;
  if (secs < prev) sawDecrease = true;
  prev = secs;
}
check("more stars never lengthen the clock", monotonic);
check("the clock actually decreases as stars arrive", sawDecrease);

// Unreadable inputs must not become numbers.
const unreadable = starEta(null, CREATED, NOW);
check("unreadable count yields no clock", unreadable.seconds === null && unreadable.hours === null);
check("unreadable count yields no measured rate", unreadable.starsPerDay === null);
check("unreadable count is not 'reached'", unreadable.reached === false);

// The clock is defined by the count alone, so a missing creation time costs the
// footnote and not the countdown.
const noAge = starEta(9, null, NOW);
check("missing creation time still yields a clock", noAge.seconds !== null, `${noAge.hours} hours`);
check("missing creation time yields no measured rate", noAge.starsPerDay === null);

// Meeting the goal ends the countdown rather than running past it.
const met = starEta(GOAL, CREATED, NOW);
check("goal met is flagged", met.reached === true);
check("goal met leaves no time on the clock", met.seconds === 0 && met.remaining === 0);
const over = starEta(120_000, CREATED, NOW);
check("overshooting the goal is still reached", over.reached === true && over.remaining === 0);
check("overshooting never yields negative time", (over.seconds ?? -1) === 0);

// The measured pace is a separate number, and it must not leak into the clock.
const measured = starEta(9, CREATED, NOW);
check(
  "the measured rate is reported",
  measured.starsPerDay !== null,
  `${measured.starsPerDay?.toFixed(3)}/day`,
);
check(
  "the measured forecast is reported",
  measured.measuredDays !== null,
  `${Math.round(measured.measuredDays!)} days`,
);
check(
  "the measured forecast is not the clock",
  measured.measuredDays !== null &&
    Math.abs(measured.measuredDays * 24 - (measured.hours ?? 0)) > 1,
  `forecast ${Math.round(measured.measuredDays! * 24)}h vs clock ${measured.hours}h`,
);
check(
  "the basis names both the rule and the pace",
  /hour comes off|hour for every star/i.test(measured.basis) &&
    /measured pace/.test(measured.basis),
);

// A repository younger than half a day has no measurable pace.
const tooNew = starEta(3, "2026-10-24T11:00:00Z", NOW);
check("too-new repository reports no pace", tooNew.starsPerDay === null);
check("too-new repository still gets a clock", tooNew.seconds !== null);
const none = starEta(0, CREATED, NOW);
check("zero stars reports no pace", none.starsPerDay === null && none.remaining === GOAL);

console.log(failures ? `\n${failures} check(s) failed` : "\nall checks passed");
process.exit(failures ? 1 : 0);
