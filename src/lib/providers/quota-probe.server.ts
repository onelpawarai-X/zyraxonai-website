/** Background re-probe of a spent free-tier quota.
 *
 *  A countdown tells a reader when the upstream *said* its window closes. It
 *  cannot tell them whether the pool is actually serving again, because the
 *  upstream's clock and its willingness to serve can drift: a window may roll
 *  over a minute early, or a limit may lift without the header ever having
 *  named the right moment.
 *
 *  So the deployment checks for itself. While a quota is recorded as spent, a
 *  low-frequency probe asks the upstream whether it will serve a token again.
 *  The moment one does, the recorded reset is cleared and every surface flips
 *  to open — the countdown reads zero because the pool is genuinely back, not
 *  because a timer ran out. A probe that is still refused changes nothing, so a
 *  clock that has already reached zero does not become a lie.
 *
 *  The probe is deliberately cheap and slow: one token, at most once every
 *  `PROBE_INTERVAL_MS`, and only while a reset is on the books. It never
 *  competes with a real turn for a lane — it borrows a session fingerprint of
 *  its own — and it stops the instant the pool is proven open. */
import { completeRaw, DEFAULT_ZEN_MODEL } from "@/lib/builder/zen.server";
import { clearQuotaReset, quotaResetStatus } from "./quota.server";

/** How often to re-ask while a quota is spent.
 *
 *  A spent window is minutes to hours long, so a tight loop would spend the
 *  deployment's whole request budget re-learning the same refusal. A minute is
 *  frequent enough that a pool which opens early is noticed while the reader is
 *  still on the page, and rare enough that the probe is invisible in the
 *  upstream's own counters.
 *
 *  Read per call rather than at module load, so an operator can retune the
 *  interval without a redeploy and a test can exercise both sides of it. */
export function probeIntervalMs(): number {
  const configured = Number(process.env.ZYRAXON_QUOTA_PROBE_MS);
  return Number.isFinite(configured) && configured >= 0 ? configured : 60_000;
}

/** The one probe in flight, shared by every caller.
 *
 *  The endpoint is hit by every open tab, so without this a busy page would
 *  start a probe per request and the upstream would see a burst exactly when it
 *  is least able to serve one. One promise, awaited by all. */
let inFlight: Promise<boolean> | null = null;
/** When the next probe is allowed. A refused probe pushes this forward, so a
 *  page that polls in a tight loop still produces at most one upstream ask per
 *  interval. */
let nextAt = 0;

/** Ask the upstream whether the spent quota has actually opened.
 *
 *  Returns true only on positive evidence — a token the upstream served. A
 *  refusal, a gate, a network fault, or a probe that is not yet due all return
 *  false and leave the recorded reset exactly as it was. */
export async function probeQuotaReset(now = Date.now()): Promise<boolean> {
  const status = quotaResetStatus(now);
  // Nothing is spent, so there is nothing to re-check. This is also the common
  // case: most calls find an open pool and cost no upstream request at all.
  if (!status.spent) return false;
  if (now < nextAt) return false;
  if (inFlight) return inFlight;

  nextAt = now + probeIntervalMs();
  inFlight = (async () => {
    try {
      const out = await completeRaw(
        undefined,
        DEFAULT_ZEN_MODEL,
        [{ role: "user", content: "Reply with OK." }],
        1,
        "quota-probe",
      );
      if ("failed" in out) return false;
      // The upstream served a token, so its window has genuinely rolled over.
      // Drain and discard the body: the probe only needed the answer, not the
      // content, and leaving it unread would hold the connection open.
      try {
        await out.text();
      } catch {
        /* the token is what mattered */
      }
      clearQuotaReset();
      return true;
    } catch {
      // A fault is not evidence either way. Keep the clock and try again next
      // interval rather than declaring the pool open on a bad guess.
      return false;
    } finally {
      inFlight = null;
    }
  })();

  return inFlight;
}

/** Test seam: forget the probe's own pacing. */
export function resetQuotaProbe(): void {
  inFlight = null;
  nextAt = 0;
}
