/** Free-tier quota: reading the upstream's own reset clock, and remembering it.
 *
 *  When the shared free tier is spent, the upstream answers 429 with a
 *  `retry-after` header saying how long until its window rolls over. That
 *  number is the only honest answer to "when will this work again?" — a guess
 *  or a hardcoded 60 would tell the caller to come back while the wall is
 *  still there.
 *
 *  The header is read on the way in and kept here so the provider page can
 *  publish it: one caller hitting the limit is evidence for every caller. */

/** Parse an HTTP `Retry-After` value into whole seconds.
 *
 *  Both forms the spec allows are accepted — delta-seconds and an HTTP date —
 *  because an upstream is free to pick either, and a caller reading the value
 *  should not have to care which one it got. Returns undefined for anything
 *  unparseable, so a malformed header never becomes a bogus countdown. */
export function parseRetryAfter(value: unknown, now = Date.now()): number | undefined {
  if (value === null || value === undefined) return undefined;
  const s = String(value).trim();
  if (!s) return undefined;
  const seconds = Number(s);
  if (Number.isFinite(seconds) && seconds >= 0) return Math.ceil(seconds);
  const at = Date.parse(s);
  if (Number.isNaN(at)) return undefined;
  return Math.max(0, Math.ceil((at - now) / 1000));
}

/** The latest free-tier reset the deployment has seen.
 *
 *  `until` is an absolute epoch-ms so a countdown keeps ticking correctly no
 *  matter how long ago the refusal was recorded. A stale reset is not
 *  published: once the moment passes, the next turn is worth trying, and the
 *  page must not show a counter that has already reached zero. */
type QuotaReset = { until: number; seconds: number; at: number };

let lastReset: QuotaReset | undefined;

/** The longest window the upstream has ever stated.
 *
 *  A countdown needs a ceiling to be meaningful: "4m 12s left" says nothing
 *  about whether that is most of the wait or the last moments of it. The
 *  upstream states the window per refusal, and the largest it has ever stated
 *  is the best available bound on a full window — so the page can draw how much
 *  of the wait has already passed instead of a bare number. */
let longestSeconds = 0;

/** Record the reset clock carried by a quota refusal. A later reset replaces an
 *  earlier one — the upstream's window is the same for every caller, so the
 *  freshest reading is the most accurate. */
export function noteQuotaReset(retryAfterSeconds: number | undefined, now = Date.now()): void {
  if (!retryAfterSeconds || retryAfterSeconds <= 0) return;
  const seconds = Math.ceil(retryAfterSeconds);
  if (seconds > longestSeconds) longestSeconds = seconds;
  lastReset = { until: now + seconds * 1000, seconds, at: now };
  awaitingProof = true;
  everObserved = true;
}

/** The largest window seen, or undefined when none has been recorded. */
export function quotaWindowCeiling(): number | undefined {
  return longestSeconds > 0 ? longestSeconds : undefined;
}

/** Whether the recorded reset is the last word on the pool being spent.
 *
 *  The clock is an upstream *promise*, and it can be wrong in both directions:
 *  a window may roll over early, or the upstream may keep refusing past the
 *  moment it named. So a passed deadline is not proof the pool is open — only a
 *  served turn or a successful probe is. This flag lets a caller say "the clock
 *  ran out but nobody has confirmed the pool is back" instead of reporting an
 *  open pool that still refuses every request. */
let awaitingProof = false;

/** When a probe last came back refused, and whether this isolate has ever
 *  heard from the upstream at all.
 *
 *  Quota state lives in the isolate's own memory, and a deployment runs many
 *  isolates. A fresh one has no record, so it used to answer "the pool is
 *  open" purely because it had never seen a refusal — which is how two browser
 *  profiles read the same instant as "Free tier open" and "2h 32m left". A
 *  recent refusal is evidence worth keeping even when the upstream named no
 *  deadline, and `everObserved` is what lets a surface say "I do not know yet"
 *  and go ask, instead of guessing in the caller's favour. */
let lastRefusedAt = 0;
let everObserved = false;

/** How long a refusal with no stated deadline keeps the pool marked spent.
 *
 *  Short enough that a window opening is noticed promptly, long enough that a
 *  cold isolate does not flip back to "open" between probes. */
function refusalMemoryMs(): number {
  const configured = Number(process.env.ZYRAXON_REFUSAL_MEMORY_MS);
  return Number.isFinite(configured) && configured > 0 ? configured : 300_000;
}

/** Record a refusal that carried no usable deadline. */
export function noteQuotaRefusal(now = Date.now()): void {
  lastRefusedAt = now;
  everObserved = true;
}

/** Note that a probe or a real turn is the only thing that may reopen the pool. */
export function expectProofBeforeOpen(): void {
  awaitingProof = true;
}

/** How long the free tier has left, or undefined when it is not known to be
 *  spent. `spent` is false once the recorded reset has passed *and* something
 *  has actually been served, which is the signal that a turn should be
 *  attempted rather than refused up front. */
export function quotaResetStatus(now = Date.now()): {
  spent: boolean;
  retryAfterSeconds?: number;
  resetAt?: string;
  /** The largest window ever stated, so a client can draw progress. */
  windowSeconds?: number;
  /** This server's clock at the moment it answered.
   *
   *  `resetAt` is an absolute instant, so it only means anything against the
   *  clock that produced it. A reader whose own clock runs fast compares the
   *  deadline to `now`, finds it in the past, and draws 00:00:00 for a pool
   *  with hours left — while this endpoint still reports it spent. Publishing
   *  our clock lets the reader correct for the difference instead of showing
   *  the opposite of the truth. */
  serverNow?: string;
  /** True when this isolate has no evidence either way, so a caller should ask
   *  rather than report an open pool it cannot vouch for. */
  unknown?: boolean;
} {
  if (!lastReset) {
    // A refusal we saw moments ago is still evidence the pool is shut, even if
    // the upstream declined to say for how long.
    if (lastRefusedAt && now - lastRefusedAt < refusalMemoryMs()) {
      return { spent: true, serverNow: new Date(now).toISOString() };
    }
    if (!everObserved) return { spent: false, unknown: true, serverNow: new Date(now).toISOString() };
    return { spent: false };
  }
  const remainingMs = lastReset.until - now;
  // The deadline has passed. That is a reason to *ask* again, not a reason to
  // announce the pool is open: every one of thirty direct attempts during a
  // spent window was refused, so a timer running out proves nothing. Report it
  // still spent but no longer scheduled, which lets the probe re-check without
  // any surface claiming a capacity that does not exist.
  if (remainingMs <= 0) {
    if (!awaitingProof) return { spent: false };
    return { spent: true, serverNow: new Date(now).toISOString() };
  }
  return {
    spent: true,
    retryAfterSeconds: Math.max(1, Math.ceil(remainingMs / 1000)),
    resetAt: new Date(lastReset.until).toISOString(),
    ...(longestSeconds > 0 ? { windowSeconds: longestSeconds } : {}),
    serverNow: new Date(now).toISOString(),
  };
}

/** Drop the recorded reset because the pool was proven to be serving again.
 *
 *  Called only on positive evidence — a real turn that the upstream answered —
 *  never on a timer running out. Clearing it on the clock alone would show an
 *  open pool that is still refusing, which is the one thing the countdown
 *  exists to avoid. The window ceiling is kept: it is a fact about the upstream
 *  that does not expire with one window. */
export function clearQuotaReset(): void {
  lastReset = undefined;
  awaitingProof = false;
  // A served turn is proof the pool is open, so the refusal memory is spent.
  lastRefusedAt = 0;
  everObserved = true;
}

/** Test seam: forget the recorded reset and everything learned about it. */
export function resetQuotaClock(): void {
  lastReset = undefined;
  longestSeconds = 0;
  awaitingProof = false;
  lastRefusedAt = 0;
  everObserved = false;
}
