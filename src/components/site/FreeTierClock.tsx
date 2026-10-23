import { useEffect, useMemo, useState } from "react";
import { Icon } from "@/components/site/Icon";
import { formatRemaining, type FreeTierStatus } from "@/components/site/FreeTierCountdown";

/** The shared free-tier reset clock, drawn rather than written.
 *
 *  A person asking "when will this work again?" is not served by the words
 *  "try again later". They are served by a countdown that visibly moves: a ring
 *  that drains as the window closes, an orbiting dot, and digits that tick down
 *  to the second. When the window opens, the same panel says so and turns
 *  green, so the state is legible at a glance without reading the prose.
 *
 *  The reset itself is the upstream's own `retry-after`, published by the
 *  provider endpoint — never a guess. `status.available` is the live truth:
 *  once the recorded moment passes, the panel flips to open on its own. */
export function FreeTierClock({
  status,
  compact = false,
}: {
  status?: FreeTierStatus;
  compact?: boolean;
}) {
  // Derive the deadline from the absolute reset when present, so a tab that was
  // asleep shows the true remaining time the moment it wakes rather than a
  // count that merely paused. Seconds are the fallback for a payload with no
  // timestamp.
  const target = useMemo(() => {
    if (!status) return undefined;
    const at = status.resetAt ? Date.parse(status.resetAt) : NaN;
    if (!Number.isNaN(at)) return at;
    if (typeof status.retryAfterSeconds === "number") {
      return Date.now() + status.retryAfterSeconds * 1000;
    }
    return undefined;
  }, [status]);

  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (target === undefined) return;
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, [target]);

  if (!status) return null;

  const open = status.available;
  const remainingMs = target === undefined ? 0 : Math.max(0, target - now);
  const remaining = Math.ceil(remainingMs / 1000);
  // The ring's scale is the largest window the upstream has ever stated, so the
  // drained arc says how much of the wait is behind the reader rather than an
  // unscaled fraction of whatever number arrived last.
  const windowMs = (status.windowSeconds ?? status.retryAfterSeconds ?? remaining / 1000) * 1000;
  const span = Math.max(remainingMs, windowMs, 1000);
  const progress = open ? 1 : Math.min(1, Math.max(0, 1 - remainingMs / span));
  const expired = !open && remaining <= 0;

  const R = 54;
  const circumference = 2 * Math.PI * R;
  const dash = open ? 0 : circumference * (1 - progress);

  return (
    <div
      className={`zx-glass-strong zx-clock-sheen relative overflow-hidden rounded-2xl ${
        open ? "zx-clock-open" : ""
      } ${compact ? "p-4" : "p-5"}`}
      aria-live="polite"
    >
      <div className="relative flex items-center gap-4">
        {/* The ring. Its drained length *is* the time left, so the picture
            changes every second even when the digits do not. */}
        <div className={`relative shrink-0 ${compact ? "h-[74px] w-[74px]" : "h-[104px] w-[104px]"}`}>
          <span
            className={`zx-clock-halo absolute inset-1 rounded-full blur-md ${
              open ? "bg-emerald-500/25" : expired ? "bg-amber-500/20" : "bg-primary/25"
            }`}
          />
          <svg viewBox="0 0 120 120" className="relative h-full w-full">
            <circle
              cx="60"
              cy="60"
              r={R}
              fill="none"
              stroke="currentColor"
              strokeWidth="7"
              className="text-foreground/10"
            />
            <circle
              cx="60"
              cy="60"
              r={R}
              fill="none"
              strokeWidth="7"
              strokeLinecap="round"
              strokeDasharray={circumference}
              strokeDashoffset={dash}
              className={`zx-clock-ring zx-clock-arc ${
                open ? "stroke-emerald-500" : expired ? "stroke-amber-500" : "stroke-primary"
              }`}
            />
            {/* A dot orbiting the ring: the one motion that never stops, so the
                panel reads as live even at a long, slow countdown. */}
            {!open && (
              <g className="zx-clock-orbit">
                <circle cx="60" cy="6" r="4" className="fill-primary" />
              </g>
            )}
          </svg>
          <div className="absolute inset-0 grid place-items-center">
            <Icon
              name={open ? "bolt" : expired ? "spark" : "cpu"}
              size={compact ? 18 : 22}
              className={open ? "text-emerald-500" : expired ? "text-amber-500" : "text-primary"}
            />
          </div>
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span
              className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wider ${
                open
                  ? "bg-emerald-500/12 text-emerald-600 dark:text-emerald-400"
                  : expired
                    ? "bg-amber-500/12 text-amber-600 dark:text-amber-400"
                    : "bg-primary/12 text-primary"
              }`}
            >
              <span className="relative flex h-1.5 w-1.5">
                <span
                  className={`absolute inline-flex h-full w-full animate-ping rounded-full opacity-75 ${
                    open ? "bg-emerald-500" : expired ? "bg-amber-500" : "bg-primary"
                  }`}
                />
                <span
                  className={`relative inline-flex h-1.5 w-1.5 rounded-full ${
                    open ? "bg-emerald-500" : expired ? "bg-amber-500" : "bg-primary"
                  }`}
                />
              </span>
              {open ? "Free tier open" : expired ? "Resetting now" : "Free tier at capacity"}
            </span>
          </div>

          {open ? (
            <p className="mt-2 text-[13px] leading-relaxed text-muted-foreground">
              The shared free pool is serving now — every ZYRAXON model is callable with no key.
            </p>
          ) : (
            <>
              <div className="mt-2 flex items-baseline gap-1.5 font-mono tabular-nums">
                <Ticking value={remaining} className={compact ? "text-2xl" : "text-3xl"} />
                <span className="text-[12px] font-semibold uppercase tracking-wider text-muted-foreground">
                  until the pool opens
                </span>
              </div>
              <p className="mt-1.5 text-[12.5px] leading-relaxed text-muted-foreground">
                {expired
                  ? "The window is rolling over — try again in a moment, or set OPENCODE_ZEN_API_KEY for a keyed quota."
                  : status.windowSeconds
                    ? `The upstream's own reset clock, not a guess — at most ${formatCeiling(status.windowSeconds)} per window. Set OPENCODE_ZEN_API_KEY for a keyed quota that does not wait.`
                    : "The upstream's own reset clock, not a guess. Set OPENCODE_ZEN_API_KEY for a keyed quota that does not wait."}
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

/** The ceiling stated the way a person says it: "12h", "45m", "90s". */
function formatCeiling(seconds: number): string {
  const s = Math.max(0, Math.round(seconds));
  if (s >= 3600) {
    const h = s / 3600;
    return Number.isInteger(h) ? `${h}h` : `${h.toFixed(1)}h`;
  }
  if (s >= 60) return `${Math.round(s / 60)}m`;
  return `${s}s`;
}

/** A number that lifts each time it changes, so a tick is visible rather than
 *  silent. `key` on the element is what restarts the animation. */
function Ticking({ value, className = "" }: { value: number; className?: string }) {
  const text = formatRemaining(value);
  return (
    <span key={text} className={`zx-clock-digit inline-block font-bold tracking-tight text-foreground ${className}`}>
      {text}
    </span>
  );
}
