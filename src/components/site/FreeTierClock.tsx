import { useEffect, useMemo, useRef, useState } from "react";
import { Icon } from "@/components/site/Icon";
import type { FreeTierStatus } from "@/components/site/FreeTierCountdown";

/** The shared free-tier reset clock, drawn rather than written.
 *
 *  A person asking "when will this work again?" is not served by the words
 *  "try again later". They are served by a countdown that visibly moves: hours,
 *  minutes and seconds in their own cells, each flipping into place as it
 *  changes, a ring draining as the window closes, and an orbiting dot that
 *  never stops. When the window opens the same panel says so and turns green,
 *  so the state is legible at a glance.
 *
 *  Every number here comes from the upstream's own `retry-after`, captured by
 *  the provider and published by its endpoint. Nothing is invented: when the
 *  upstream states no clock, the panel says exactly that instead of showing a
 *  plausible-looking count. */
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
  // The upstream did not state a clock. That is not the same as "about to
  // reset": there is simply no number to show, and showing one anyway would be
  // an invention. The panel says so instead.
  const unstated = !open && target === undefined;
  const remainingMs = target === undefined ? 0 : Math.max(0, target - now);
  const remaining = Math.ceil(remainingMs / 1000);
  const parts = split(remaining);
  // The ring's scale is the largest window the upstream has ever stated, so the
  // drained arc says how much of the wait is behind the reader rather than an
  // unscaled fraction of whatever number arrived last.
  const windowMs = (status.windowSeconds ?? status.retryAfterSeconds ?? remaining) * 1000;
  const span = Math.max(remainingMs, windowMs, 1000);
  const progress = open ? 1 : Math.min(1, Math.max(0, 1 - remainingMs / span));
  const expired = !open && !unstated && remaining <= 0;

  const R = 54;
  const circumference = 2 * Math.PI * R;
  const dash = open || unstated ? 0 : circumference * (1 - progress);
  const accent = open
    ? "text-emerald-500"
    : expired
      ? "text-amber-500"
      : unstated
        ? "text-muted-foreground"
        : "text-primary";

  return (
    <div
      className={`zx-glass-strong zx-clock-sheen relative overflow-hidden rounded-2xl ${
        open ? "zx-clock-open" : ""
      } ${compact ? "p-4" : "p-5"}`}
      aria-live="polite"
      aria-label={
        open
          ? "Free tier open"
          : unstated
            ? "Free tier at capacity, reset time not stated by the upstream"
            : `Free tier resets in ${parts.h} hours ${parts.m} minutes ${parts.s} seconds`
      }
    >
      <div className="relative flex flex-col gap-4 sm:flex-row sm:items-center">
        {/* The ring. Its drained length *is* the time left, so the picture
            changes every second even when the digits do not. */}
        <div
          className={`relative mx-auto shrink-0 sm:mx-0 ${
            compact ? "h-[80px] w-[80px]" : "h-[104px] w-[104px]"
          }`}
        >
          <span
            className={`zx-clock-halo absolute inset-1 rounded-full blur-md ${
              open
                ? "bg-emerald-500/30"
                : expired
                  ? "bg-amber-500/25"
                  : unstated
                    ? "bg-foreground/10"
                    : "bg-primary/30"
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
                open
                  ? "stroke-emerald-500"
                  : expired
                    ? "stroke-amber-500"
                    : unstated
                      ? "stroke-foreground/25"
                      : "stroke-primary"
              }`}
            />
            {/* A dot orbiting the ring: the one motion that never stops, so the
                panel reads as live even at a long, slow countdown. */}
            {!open && !unstated && (
              <g className="zx-clock-orbit">
                <circle cx="60" cy="6" r="4" className="fill-primary" />
              </g>
            )}
          </svg>
          <div className="absolute inset-0 grid place-items-center">
            <Icon
              name={open ? "bolt" : expired ? "spark" : "cpu"}
              size={compact ? 18 : 22}
              className={accent}
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
                    : unstated
                      ? "bg-foreground/8 text-muted-foreground"
                      : "bg-primary/12 text-primary"
              }`}
            >
              <span className="relative flex h-1.5 w-1.5">
                <span
                  className={`absolute inline-flex h-full w-full animate-ping rounded-full opacity-75 ${
                    open
                      ? "bg-emerald-500"
                      : expired
                        ? "bg-amber-500"
                        : unstated
                          ? "bg-muted-foreground"
                          : "bg-primary"
                  }`}
                />
                <span
                  className={`relative inline-flex h-1.5 w-1.5 rounded-full ${
                    open
                      ? "bg-emerald-500"
                      : expired
                        ? "bg-amber-500"
                        : unstated
                          ? "bg-muted-foreground"
                          : "bg-primary"
                  }`}
                />
              </span>
              {open ? "Free tier open" : expired ? "Resetting now" : "Free tier at capacity"}
            </span>
          </div>

          {/* The three cells are always drawn, even with no clock to show: a
              panel whose shape changes with its state is harder to read than
              one that keeps its place and changes its numbers. */}
          <p className="mt-2 text-[12px] font-semibold uppercase tracking-wider text-muted-foreground">
            {open ? "Resets in" : unstated ? "Reset time" : "Resets in"}
          </p>
          <div className="mt-1.5 flex items-end gap-1.5">
            <TimeCell value={parts.h} label="Hours" size={compact ? "sm" : "lg"} muted={unstated} />
            <Colon steady={unstated || open} />
            <TimeCell value={parts.m} label="Minutes" size={compact ? "sm" : "lg"} muted={unstated} />
            <Colon steady={unstated || open} />
            <TimeCell value={parts.s} label="Seconds" size={compact ? "sm" : "lg"} muted={unstated} />
          </div>
          <p className="mt-2 text-[12.5px] leading-relaxed text-muted-foreground">
            {open
              ? "The shared free pool is serving now — the countdown is at zero because the pool is genuinely back, not because a timer ran out."
              : unstated
                ? "The upstream reported the pool spent but stated no reset time, so no countdown is shown rather than a guess. Try again shortly."
                : expired
                  ? "The upstream's window has passed — the pool is expected to open on its next turn. This is the reset the upstream itself stated."
                  : status.windowSeconds
                    ? `The upstream's own reset clock, not a guess — at most ${formatHms(status.windowSeconds)} per window.`
                    : "The upstream's own reset clock, not a guess."}
          </p>
        </div>
      </div>
    </div>
  );
}

function split(seconds: number): { h: number; m: number; s: number } {
  const s = Math.max(0, Math.floor(seconds));
  return { h: Math.floor(s / 3600), m: Math.floor((s % 3600) / 60), s: s % 60 };
}

/** The ceiling stated as a clock reads: "12h 00m 00s". A decimal like "4.3h"
 *  makes a reader do arithmetic to see how close that is to a whole window. */
function formatHms(seconds: number): string {
  const { h, m, s } = split(seconds);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${h}h ${pad(m)}m ${pad(s)}s`;
}

/** One unit of the countdown: a boxed pair of digits with its label beneath.
 *  The digits flip rather than swap, which is what makes the clock read as a
 *  clock instead of a re-rendered string. */
function TimeCell({
  value,
  label,
  size,
  muted = false,
}: {
  value: number;
  label: string;
  size: "sm" | "lg";
  /** True when there is no clock to show, so the cells read as blank rather
   *  than as a confident zero the upstream never stated. */
  muted?: boolean;
}) {
  const text = muted ? "--" : String(value).padStart(2, "0");
  return (
    <div className="flex flex-col items-center">
      <span
        className={`zx-glass zx-clock-cell grid place-items-center rounded-lg font-mono font-bold tabular-nums tracking-tight ${
          muted ? "text-muted-foreground/50" : "text-foreground"
        } ${size === "lg" ? "h-[52px] min-w-[52px] text-[30px]" : "h-[42px] min-w-[42px] text-[23px]"}`}
      >
        <Flip text={text} />
      </span>
      <span className="mt-1 text-[9px] font-semibold uppercase tracking-wider text-muted-foreground">
        {label}
      </span>
    </div>
  );
}

/** The separator between cells, blinking in step with the seconds. */
/** The separator between cells. It blinks only while a countdown is actually
 *  running: a settled zero or a blank pair should sit still. */
function Colon({ steady = false }: { steady?: boolean }) {
  return (
    <span
      className={`pb-4 font-mono text-[26px] font-bold text-muted-foreground ${
        steady ? "" : "zx-clock-colon"
      }`}
      aria-hidden="true"
    >
      :
    </span>
  );
}

/** A two-character reading that rolls to its next value.
 *
 *  The pair that is leaving tips away downward while the pair arriving rolls
 *  in from above, so a change reads as a mechanical turn rather than a repaint.
 *  The current value is always the one on screen — the roll is decoration, not
 *  a delay — so the digits never lag the true count, and a value that has
 *  settled carries no running animation at all. */
function Flip({ text }: { text: string }) {
  const [leaving, setLeaving] = useState<string | null>(null);
  const shown = useRef(text);

  useEffect(() => {
    if (text === shown.current) return;
    setLeaving(shown.current);
    shown.current = text;
  }, [text]);

  return (
    <span className="zx-flip">
      {leaving !== null && (
        // Removed when its roll finishes, so nothing accumulates across ticks.
        <span
          key={`out-${leaving}-${text}`}
          className="zx-flip-out"
          onAnimationEnd={() => setLeaving(null)}
        >
          {leaving}
        </span>
      )}
      <span key={`in-${text}`} className="zx-flip-in">
        {text}
      </span>
    </span>
  );
}
