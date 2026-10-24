/** The live star count, as an animated counter.
 *
 *  Two things make it feel alive rather than printed. The digits count up to the
 *  value instead of appearing, and a small burst of particles fires when the
 *  number grows past what was last seen — which is the moment a reader who just
 *  starred the repository wants to see acknowledged.
 *
 *  "Last seen" is kept in `localStorage`, not in state, so the burst fires on a
 *  return visit too: someone who starred yesterday and comes back today should
 *  see the number had moved, not a counter that has quietly forgotten. */
import { useEffect, useMemo, useRef, useState } from "react";
import { STAR_GOAL, STAR_REPO, STAR_REPO_URL } from "@/lib/providers/star-gate";

const SEEN_KEY = "zyraxon.stars.seen";
const POLL_MS = 60_000;

function useCountUp(target: number | null, durationMs = 1200) {
  const [value, setValue] = useState(0);
  const from = useRef(0);
  useEffect(() => {
    if (target === null) return;
    const start = performance.now();
    const origin = from.current;
    let raf = 0;
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / durationMs);
      // Ease out, so the number decelerates into its final value instead of
      // stopping dead.
      const eased = 1 - Math.pow(1 - t, 3);
      setValue(Math.round(origin + (target - origin) * eased));
      if (t < 1) raf = requestAnimationFrame(tick);
      else from.current = target;
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, durationMs]);
  return value;
}

type Burst = { id: number; x: number; y: number; angle: number; distance: number };

export function StarCounter() {
  const [stars, setStars] = useState<number | null>(null);
  const [forks, setForks] = useState<number | null>(null);
  const [bursts, setBursts] = useState<Burst[]>([]);
  const [grew, setGrew] = useState(false);
  const shown = useCountUp(stars);

  const load = useMemo(
    () =>
      async (fresh = false) => {
        try {
          const r = await fetch(`/api/public/repo-stats${fresh ? "?fresh=1" : ""}`);
          if (!r.ok) return;
          const d = await r.json();
          if (typeof d?.stars !== "number") return;
          setStars(d.stars);
          setForks(typeof d.forks === "number" ? d.forks : null);
          const seen = Number(localStorage.getItem(SEEN_KEY) || 0);
          if (d.stars > seen) {
            localStorage.setItem(SEEN_KEY, String(d.stars));
            if (seen > 0) {
              setGrew(true);
              // A ring of particles, so the celebration reads as coming from the
              // number rather than landing on it.
              setBursts(
                Array.from({ length: 14 }, (_, i) => ({
                  id: Date.now() + i,
                  x: 50,
                  y: 50,
                  angle: (360 / 14) * i + Math.random() * 12,
                  distance: 54 + Math.random() * 46,
                })),
              );
              window.setTimeout(() => {
                setBursts([]);
                setGrew(false);
              }, 1600);
            }
          }
        } catch {
          // A failed read leaves the last known number on screen. Blanking the
          // counter would be a worse answer than a slightly old one.
        }
      },
    [],
  );

  useEffect(() => {
    void load();
    const id = window.setInterval(() => void load(), POLL_MS);
    // A tab that was asleep for an hour should refresh the moment it is looked
    // at again, rather than showing an hour-old count until the next tick.
    const onVisible = () => document.visibilityState === "visible" && void load();
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      window.clearInterval(id);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [load]);

  const pct = stars === null ? 0 : Math.min(100, (stars / STAR_GOAL) * 100);
  const remaining = stars === null ? null : Math.max(0, STAR_GOAL - stars);

  return (
    <section className="px-6 pb-16 pt-4 sm:px-10">
      <div className="zx-glass-strong relative overflow-hidden rounded-3xl px-6 py-10 text-center sm:px-12 sm:py-14">
        <div className="pointer-events-none absolute inset-0 zx-grid-lines opacity-[0.25]" />

        <div className="relative">
          <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">
            {STAR_REPO}
          </p>

          <div className="relative mx-auto mt-5 inline-flex flex-col items-center">
            <div className="relative">
              {bursts.map((b) => (
                <span
                  key={b.id}
                  className="zx-star-particle pointer-events-none absolute h-1.5 w-1.5 rounded-full bg-amber-400"
                  style={
                    {
                      left: `${b.x}%`,
                      top: `${b.y}%`,
                      "--zx-angle": `${b.angle}deg`,
                      "--zx-distance": `${b.distance}px`,
                    } as React.CSSProperties
                  }
                />
              ))}
              <p
                className={`text-6xl font-bold tracking-tight transition-colors sm:text-7xl ${
                  grew ? "text-amber-500" : "text-foreground"
                }`}
              >
                {stars === null ? "—" : shown.toLocaleString("en-US")}
              </p>
            </div>
            <p className="mt-2 text-sm font-medium text-muted-foreground">
              GitHub stars
              {forks !== null && forks > 0 && <span className="ml-2">· {forks} forks</span>}
            </p>
          </div>

          <div className="mx-auto mt-7 max-w-2xl">
            <div className="h-2.5 overflow-hidden rounded-full bg-foreground/10">
              <div
                className="h-full rounded-full bg-gradient-to-r from-amber-500 via-amber-400 to-amber-300 transition-[width] duration-1000 ease-out"
                style={{ width: `${Math.max(0.4, pct)}%` }}
              />
            </div>
            <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-[12px] text-muted-foreground">
              <span>
                Goal: {STAR_GOAL.toLocaleString("en-US")} stars — our own company and our own
                provider
              </span>
              {remaining !== null && (
                <span className="font-semibold">
                  {remaining.toLocaleString("en-US")} stars to go
                </span>
              )}
            </div>
          </div>

          <p className="mx-auto mt-6 max-w-xl text-[13px] leading-relaxed text-muted-foreground">
            When this counter reaches {STAR_GOAL.toLocaleString("en-US")}, ZYRAXON stands up its own
            company and its own provider. Until then the provider stays closed — every request gets
            this number back.
          </p>

          <div className="mt-7 flex flex-wrap items-center justify-center gap-3">
            <a
              href={STAR_REPO_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="group inline-flex items-center gap-2.5 rounded-xl bg-amber-500 px-5 py-3 text-[14px] font-semibold text-black transition-transform hover:scale-[1.03]"
            >
              <svg width="17" height="17" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
                <path d="M12 2l2.9 6.3 6.9.8-5.1 4.7 1.4 6.8L12 17.3 5.9 20.6l1.4-6.8L2.2 9.1l6.9-.8z" />
              </svg>
              Star on GitHub
            </a>
            <button
              type="button"
              onClick={() => void load(true)}
              className="inline-flex items-center gap-2 rounded-xl border border-border px-5 py-3 text-[14px] font-medium text-muted-foreground transition-colors hover:text-foreground"
            >
              <svg
                width="15"
                height="15"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.2"
                aria-hidden
              >
                <path d="M21 12a9 9 0 11-3-6.7M21 3v6h-6" />
              </svg>
              Refresh
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}
