/** The countdown to 100,000 stars, and the arithmetic behind it.
 *
 *  Two different numbers live here, and keeping them apart is the whole design.
 *
 *  The first is the **measured rate**: stars divided by the age of the
 *  repository. It is a fact — 9 stars in 47 days is 0.19 stars a day — and it
 *  is reported as a fact, because it is the honest answer to "how fast is this
 *  actually going".
 *
 *  The second is the **clock**, and it is deliberately not a forecast. A linear
 *  projection from the measured rate puts the goal about 1,400 years away: a
 *  real number, and a useless one. Capped to something printable it would freeze
 *  in place, so a visitor who brought a star would watch a clock that did not
 *  move — which is the opposite of the point. The clock is therefore a stated
 *  rule rather than a prediction: **one hour for every star still needed**. The
 *  count is 100,000, the clock starts at 100,000 hours, and every star takes
 *  exactly one hour off it. Nobody has to trust a growth model to read it, and
 *  a reader can see their own contribution land.
 *
 *  The measured rate is still published, so the page can say plainly how fast
 *  the count is really moving while the clock does the motivating. Saying both
 *  is more honest than choosing one. */

import { STAR_GOAL } from "./star-gate";

/** The clock's rule: one hour removed per star gained.
 *
 *  At 1 the countdown is the remaining-star count read as hours, which is the
 *  property that makes it legible — "99,991 hours" and "99,991 stars to go" are
 *  the same number, so the clock needs no separate explanation. */
export const HOURS_PER_STAR = 1;

const DAY_MS = 86_400_000;

export type StarEta = {
  /** Stars counted on the last read, or null when GitHub could not be read. */
  stars: number | null;
  goal: number;
  remaining: number | null;
  /** The clock: remaining stars × `HOURS_PER_STAR`, in seconds. */
  seconds: number | null;
  /** The same wait in hours, for a client that wants the unit directly. */
  hours: number | null;
  /** Stars gained per day since the repository was created, or null. */
  starsPerDay: number | null;
  /** What that rate implies, in days — the honest forecast. Null when it
   *  cannot be measured. Published so the page can state it rather than hide
   *  it, even though the clock does not use it. */
  measuredDays: number | null;
  /** True once the goal is met — the countdown is over. */
  reached: boolean;
  /** How many days the measured rate is based on. */
  ageDays: number | null;
  /** A sentence naming the basis, for the panel to print under the clock. */
  basis: string;
};

/** A readable span for the measured forecast: days under two years, else years.
 *
 *  A raw "518,942 days" is unreadable, and rounding it to "1,421 years" is the
 *  number that actually communicates. */
function spanPhrase(days: number): string {
  if (days < 730) return `about ${Math.round(days)} days`;
  return `about ${Math.round(days / 365)} years`;
}

/** The projection, or the reason there isn't one.
 *
 *  `createdAt` is the repository's creation time; `now` is injected so the
 *  calculation can be tested at a fixed instant rather than against the wall
 *  clock. */
export function starEta(
  stars: number | null,
  createdAt: string | null,
  now: Date = new Date(),
): StarEta {
  const goal = STAR_GOAL;

  if (stars === null) {
    return {
      stars: null,
      goal,
      remaining: null,
      seconds: null,
      hours: null,
      starsPerDay: null,
      measuredDays: null,
      reached: false,
      ageDays: null,
      basis: "The star count could not be read from GitHub just now, so the clock cannot be set.",
    };
  }

  const remaining = Math.max(0, goal - stars);
  // The clock is defined by the count, not by a rate, so it exists even when the
  // repository's age cannot be read — an unreadable rate costs the footnote, not
  // the countdown.
  const hours = remaining * HOURS_PER_STAR;
  const base = {
    stars,
    goal,
    remaining,
    seconds: Math.round(hours * 3600),
    hours,
    reached: remaining === 0,
  };

  if (remaining === 0) {
    return {
      ...base,
      starsPerDay: null,
      measuredDays: null,
      ageDays: null,
      basis: `The goal is met: ${stars.toLocaleString("en-US")} stars. The provider is opening.`,
    };
  }

  const created = createdAt ? Date.parse(createdAt) : NaN;
  if (Number.isNaN(created)) {
    return {
      ...base,
      starsPerDay: null,
      measuredDays: null,
      ageDays: null,
      basis: "The repository's age could not be read, so no measured pace can be shown.",
    };
  }

  const ageDays = (now.getTime() - created) / DAY_MS;
  // A repository younger than half a day has no measurable pace: one star over a
  // fraction of a day would look explosive and be gone by tomorrow.
  if (!(ageDays >= 0.5) || stars <= 0) {
    return {
      ...base,
      starsPerDay: null,
      measuredDays: null,
      ageDays,
      basis:
        stars <= 0
          ? "No stars have arrived yet, so there is no measured pace to report."
          : "The repository is too new to measure a pace from.",
    };
  }

  const starsPerDay = stars / ageDays;
  const measuredDays = remaining / starsPerDay;
  const rate = `${starsPerDay.toFixed(3)} stars/day`;

  return {
    ...base,
    starsPerDay,
    measuredDays,
    ageDays,
    // The footnote says both things: the rule the clock runs on, and the honest
    // pace. Hiding the second would make the first look like a forecast, which
    // it is not.
    basis:
      `One hour comes off this clock for every star gained. ` +
      `The measured pace so far is ${rate} — ${stars.toLocaleString("en-US")} stars in ` +
      `${Math.floor(ageDays)} days — which would put the goal ${spanPhrase(measuredDays)} away.`,
  };
}
