import { useEffect, useState } from "react";
import { Card, Tag } from "@/components/site/ui";

/** How long the shared free tier has left, ticking down live.
 *
 *  When the free pool is spent the upstream states its own reset clock in
 *  `retry-after`; the provider endpoint publishes that number. A counter that
 *  actually counts is the difference between "try again later" and an answer a
 *  person can act on — so this reads the published reset and ticks it down
 *  locally, without polling the API for every second. */
export type FreeTierStatus = {
  available: boolean;
  retryAfterSeconds?: number;
  resetAt?: string;
  /** The largest window the upstream has stated, for drawing progress. */
  windowSeconds?: number;
  /** The server's clock when it answered. `resetAt` is an absolute instant, so
   *  a reader whose own clock is wrong would otherwise read a deadline with
   *  hours left as already passed. */
  serverNow?: string;
};

/** How far this reader's clock is ahead of the server's, in milliseconds.
 *
 *  A deadline is only meaningful against the clock that produced it. `resetAt`
 *  is an instant on the *server's* clock, so it must be shifted into the
 *  reader's frame before it is compared to the reader's `Date.now()`: a reader
 *  running four hours fast is four hours ahead of the deadline's frame too.
 *  Adding this difference is what turns "00:00:00, resetting now" into the hours
 *  actually left. It also absorbs the response's flight time, which is a few
 *  hundred milliseconds in the safe direction. */
export function clockSkewMs(status?: FreeTierStatus): number {
  const serverNow = status?.serverNow ? Date.parse(status.serverNow) : NaN;
  if (Number.isNaN(serverNow)) return 0;
  return Date.now() - serverNow;
}

function split(seconds: number): { h: number; m: number; s: number } {
  const s = Math.max(0, Math.floor(seconds));
  return { h: Math.floor(s / 3600), m: Math.floor((s % 3600) / 60), s: s % 60 };
}

const pad = (n: number) => String(n).padStart(2, "0");

/** A human phrase for the remaining time: "2h 05m", "4m 12s", "37s". */
export function formatRemaining(seconds: number): string {
  const { h, m, s } = split(seconds);
  if (h > 0) return `${h}h ${pad(m)}m`;
  if (m > 0) return `${m}m ${pad(s)}s`;
  return `${s}s`;
}

export function FreeTierCountdown({ status }: { status?: FreeTierStatus }) {
  // Derive the deadline from `resetAt` when present, so a tab that was asleep
  // shows the true remaining time when it wakes instead of a paused count.
  // `retryAfterSeconds` is the fallback for a payload with no absolute stamp.
  const target = (() => {
    if (!status || status.available) return undefined;
    const at = status.resetAt ? Date.parse(status.resetAt) : NaN;
    if (!Number.isNaN(at)) return at + clockSkewMs(status);
    if (typeof status.retryAfterSeconds === "number") {
      return Date.now() + status.retryAfterSeconds * 1000;
    }
    return undefined;
  })();

  const [remaining, setRemaining] = useState(() =>
    target === undefined ? 0 : Math.max(0, Math.round((target - Date.now()) / 1000)),
  );

  useEffect(() => {
    if (target === undefined) {
      setRemaining(0);
      return;
    }
    const tick = () => setRemaining(Math.max(0, Math.round((target - Date.now()) / 1000)));
    tick();
    const id = window.setInterval(tick, 1000);
    return () => window.clearInterval(id);
  }, [target]);

  if (!status) return null;

  if (status.available) {
    return (
      <Card className="p-5">
        <div className="flex flex-wrap items-center gap-3">
          <Tag tone="success">Free tier open</Tag>
          <p className="text-[13px] leading-relaxed text-muted-foreground">
            The shared free pool is serving right now. Every ZYRAXON model is callable with no key.
          </p>
        </div>
      </Card>
    );
  }

  const { h, m, s } = split(remaining);
  const expired = remaining <= 0;
  return (
    <Card className="p-5">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <Tag tone="warn">{expired ? "Resetting now" : "Free tier at capacity"}</Tag>
          <p className="mt-2 max-w-xl text-[13px] leading-relaxed text-muted-foreground">
            {expired
              ? "The window is rolling over — try again in a moment, or set OPENCODE_ZEN_API_KEY for a keyed quota."
              : "The shared upstream free pool has spent its quota for this window. This counter is the upstream's own reset clock, so it is the time the pool actually opens again — or set OPENCODE_ZEN_API_KEY for a keyed quota that does not wait."}
          </p>
        </div>
        <div
          className="font-mono text-[26px] font-bold tabular-nums tracking-tight text-foreground"
          aria-live="polite"
          aria-label={expired ? "free tier resetting now" : `free tier resets in ${formatRemaining(remaining)}`}
        >
          {h > 0 && <span>{pad(h)}</span>}
          {h > 0 && <span className="text-muted-foreground">:</span>}
          <span>{pad(m)}</span>
          <span className="text-muted-foreground">:</span>
          <span>{pad(s)}</span>
        </div>
      </div>
    </Card>
  );
}
