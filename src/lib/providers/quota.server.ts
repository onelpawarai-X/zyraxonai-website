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
}

/** The largest window seen, or undefined when none has been recorded. */
export function quotaWindowCeiling(): number | undefined {
  return longestSeconds > 0 ? longestSeconds : undefined;
}

/** How long the free tier has left, or undefined when it is not known to be
 *  spent. `spent` is false once the recorded reset has passed, which is the
 *  signal that a turn should be attempted rather than refused up front. */
export function quotaResetStatus(now = Date.now()): {
  spent: boolean;
  retryAfterSeconds?: number;
  resetAt?: string;
  /** The largest window ever stated, so a client can draw progress. */
  windowSeconds?: number;
} {
  if (!lastReset) return { spent: false };
  const remainingMs = lastReset.until - now;
  if (remainingMs <= 0) return { spent: false };
  return {
    spent: true,
    retryAfterSeconds: Math.max(1, Math.ceil(remainingMs / 1000)),
    resetAt: new Date(lastReset.until).toISOString(),
    ...(longestSeconds > 0 ? { windowSeconds: longestSeconds } : {}),
  };
}

/** Test seam: forget the recorded reset. */
export function resetQuotaClock(): void {
  lastReset = undefined;
  longestSeconds = 0;
}
