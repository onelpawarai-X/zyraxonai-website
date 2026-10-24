/** The countdown to 100,000 stars.
 *
 *  This is the free-tier clock's place, reassigned. The old panel counted down
 *  to an upstream quota reset — a wait nobody could shorten, ticking every
 *  second. This one counts down to the goal the whole provider gate turns on,
 *  and its rule is the one that was asked for: **one hour comes off for every
 *  star gained**. The count is 100,000, so the clock starts at 100,000 hours and
 *  a reader who brings a star sees it drop by exactly one hour.
 *
 *  Which is why it does *not* tick on its own. A clock that drained every second
 *  would contradict its own rule: the number would fall while no star had
 *  arrived. It moves when the count moves, and the page re-reads the count
 *  periodically, so the visible motion is always tied to something real. The
 *  seconds are shown because they make the magnitude legible, and because the
 *  step between two readings is a whole hour rather than a blur.
 *
 *  The measured pace — stars per day since the repository was created — is
 *  printed underneath rather than used for the clock. It is the honest answer to
 *  "how fast is this really going", and at 9 stars in 47 days it is slow enough
 *  that projecting it would produce a number nobody could act on. Saying both
 *  numbers, and labelling which is which, is more truthful than choosing one. */
import { useEffect, useMemo, useRef, useState } from "react";
import { Icon } from "@/components/site/Icon";
import { STAR_GOAL, STAR_REPO, STAR_REPO_URL } from "@/lib/providers/star-gate";

type Eta = {
  starsPerDay: number | null;
  measuredDays: number | null;
  hours: number | null;
  seconds: number | null;
  reached: boolean;
  basis: string;
};

type Stats = {
  stars: number | null;
  remaining: number | null;
  progress: number | null;
  eta: Eta;
  checkedAt: string;
};

const pad = (n: number) => String(n).padStart(2, "0");

/** Split a second count into whole days, hours, minutes and seconds. */
function split(total: number) {
  const t = Math.max(0, Math.floor(total));
  return {
    d: Math.floor(t / 86_400),
    h: Math.floor((t % 86_400) / 3600),
    m: Math.floor((t % 3600) / 60),
    s: t % 60,
  };
}

/** A cell that rolls to its next value instead of swapping it.
 *
 *  Reused from the free-tier clock on purpose: the same roll is what makes a
 *  number read as live rather than as a page that reloaded, and two countdowns
 *  on one site that move differently would look like two different products. */
function Cell({ value, label }: { value: string; label: string }) {
  return (
    <div className="flex flex-col items-center">
      <div className="zx-clock-cell zx-glass-strong grid h-[52px] w-[52px] place-items-center rounded-xl sm:h-[58px] sm:w-[58px]">
        <span
          key={value}
          className="zx-clock-digit zx-flip text-[22px] font-bold tabular-nums text-foreground sm:text-[25px]"
        >
          {value}
        </span>
      </div>
      <span className="mt-1.5 text-[9px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
        {label}
      </span>
    </div>
  );
}

export function StarCountdown({ compact = false }: { compact?: boolean }) {
  const [stats, setStats] = useState<Stats | null>(null);
  // The star count the panel has already shown. A read that returns a higher
  // number is what triggers the burst — the panel should react to a star
  // arriving, not to a poll completing.
  const shownStars = useRef<number | null>(null);
  const [grew, setGrew] = useState(false);

  const load = useMemo(
    () =>
      async (fresh = false) => {
        try {
          const r = await fetch(`/api/public/repo-stats${fresh ? "?fresh=1" : ""}`);
          if (!r.ok) return;
          const d = (await r.json()) as Stats;
          if (!d?.eta) return;
          setStats(d);
          if (typeof d.stars === "number") {
            if (shownStars.current !== null && d.stars > shownStars.current) {
              setGrew(true);
              window.setTimeout(() => setGrew(false), 1400);
            }
            shownStars.current = d.stars;
          }
        } catch {
          // A failed read leaves the last projection on screen. It is a countdown
          // to a published condition, not a promise about a moment, so a slightly
          // old one is still true.
        }
      },
    [],
  );

  useEffect(() => {
    void load();
    // The number moves slowly — a handful of stars a day — so a read every five
    // minutes is generous. The fresh read on a returning tab is what keeps a
    // reader who just starred from seeing an unchanged clock.
    const poll = window.setInterval(() => void load(), 5 * 60_000);
    const onVisible = () => document.visibilityState === "visible" && void load();
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      window.clearInterval(poll);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [load]);

  if (!stats) {
    return (
      <div className={`zx-glass-strong rounded-2xl ${compact ? "p-4" : "p-5"}`}>
        <p className="text-[13px] text-muted-foreground">Reading the star count…</p>
      </div>
    );
  }

  const { eta } = stats;
  const remaining = eta.seconds ?? 0;
  const parts = split(remaining);
  const pct = stats.progress === null ? 0 : Math.max(0.4, Math.min(100, stats.progress * 100));
  const unknown = eta.seconds === null;

  return (
    <div
      className={`zx-glass-strong relative overflow-hidden rounded-2xl ${compact ? "p-4" : "p-5"}`}
      aria-live="polite"
      aria-label={
        eta.reached
          ? "The star goal is met. The provider is opening."
          : unknown
            ? "Star goal countdown: the star count could not be read"
            : `The provider opens in ${parts.d} days ${parts.h} hours ${parts.m} minutes`
      }
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-500/12 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wider text-amber-600 dark:text-amber-400">
          <span className="relative flex h-1.5 w-1.5">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-amber-500 opacity-75" />
            <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-amber-500" />
          </span>
          {eta.reached ? "Goal reached" : "Provider opens in"}
        </span>
        <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
          {STAR_REPO}
        </span>
      </div>

      {eta.reached ? (
        <p className="mt-3 text-[14px] leading-relaxed text-foreground">
          {STAR_GOAL.toLocaleString("en-US")} stars reached. The ZYRAXON company and its own
          provider are being stood up.
        </p>
      ) : unknown ? (
        <p className="mt-3 text-[14px] leading-relaxed text-muted-foreground">{eta.basis}</p>
      ) : (
        <div className="mt-3 flex items-start gap-2.5">
          {!compact && (
            <span className="mt-0.5 shrink-0 text-muted-foreground">
              <Icon name="cpu" size={20} />
            </span>
          )}
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5">
              {parts.d > 0 && (
                <>
                  <Cell value={String(parts.d)} label="days" />
                  <span className="zx-clock-colon pb-5 text-lg font-bold text-muted-foreground">
                    :
                  </span>
                </>
              )}
              <Cell value={pad(parts.h)} label="hours" />
              <span className="zx-clock-colon pb-5 text-lg font-bold text-muted-foreground">:</span>
              <Cell value={pad(parts.m)} label="min" />
              <span className="zx-clock-colon pb-5 text-lg font-bold text-muted-foreground">:</span>
              <Cell value={pad(parts.s)} label="sec" />
            </div>

            <div className="mt-3 h-2 overflow-hidden rounded-full bg-foreground/10">
              <div
                className={`h-full rounded-full bg-gradient-to-r from-amber-500 via-amber-400 to-amber-300 transition-[width] duration-1000 ease-out ${
                  grew ? "brightness-125" : ""
                }`}
                style={{ width: `${pct}%` }}
              />
            </div>

            <p className="mt-2 text-[12px] leading-relaxed text-muted-foreground">
              <span className="font-semibold text-foreground">
                {stats.stars === null
                  ? "The star count could not be read."
                  : `${stats.stars.toLocaleString("en-US")} of ${STAR_GOAL.toLocaleString("en-US")} stars`}
              </span>
              {stats.remaining !== null && ` — ${stats.remaining.toLocaleString("en-US")} to go.`}{" "}
              One hour comes off for every star.
            </p>

            {!compact && (
              <p className="mt-2 text-[12px] leading-relaxed text-muted-foreground">{eta.basis}</p>
            )}

            <a
              href={STAR_REPO_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-3 inline-flex items-center gap-2 rounded-lg bg-amber-500 px-3.5 py-2 text-[12px] font-semibold text-black no-underline transition-transform hover:scale-[1.03]"
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
                <path d="M12 2l2.9 6.3 6.9.8-5.1 4.7 1.4 6.8L12 17.3 5.9 20.6l1.4-6.8L2.2 9.1l6.9-.8z" />
              </svg>
              Star it — this clock drops an hour
            </a>
          </div>
        </div>
      )}
    </div>
  );
}
