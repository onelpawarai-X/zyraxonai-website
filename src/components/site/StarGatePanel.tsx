/** The star gate, as a page block.
 *
 *  Used on the provider page and at the top of the provider guide, so a visitor
 *  reads the same sentence a client gets from the API. It shows the live count
 *  and a progress bar, because "not open yet" without a number reads as a
 *  brush-off; with a number it reads as a commitment with a distance to it. */
import { useEffect, useState } from "react";
import { ButtonAnchor } from "@/components/site/ui";
import {
  GATE_HOW_TO_HELP,
  GATE_MESSAGE,
  GATE_STILL_OPEN,
  GATE_TITLE,
  STAR_GOAL,
  STAR_REPO,
  STAR_REPO_URL,
} from "@/lib/providers/star-gate";

type Stats = { stars: number | null; progress: number | null; remaining: number | null };

const n = (v: number) => v.toLocaleString("en-US");

export function StarGatePanel({ compact = false }: { compact?: boolean }) {
  const [stats, setStats] = useState<Stats>({ stars: null, progress: null, remaining: null });
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let alive = true;
    fetch("/api/public/repo-stats")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (!alive || !d) return;
        setStats({ stars: d.stars, progress: d.progress, remaining: d.remaining });
      })
      .catch(() => {})
      .finally(() => alive && setLoaded(true));
    return () => {
      alive = false;
    };
  }, []);

  const pct = stats.progress === null ? 0 : Math.max(0.5, stats.progress * 100);

  return (
    <div className="zx-glass rounded-2xl border border-amber-500/25 p-5 sm:p-6">
      <div className="flex flex-wrap items-center gap-2">
        <span className="inline-flex items-center gap-2 rounded-full bg-amber-500/12 px-3 py-1 text-[11px] font-semibold uppercase tracking-wider text-amber-600 dark:text-amber-400">
          <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
          Provider closed
        </span>
        <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
          Permanent until {n(STAR_GOAL)} stars
        </span>
      </div>

      <h3 className="mt-3 text-lg font-bold tracking-tight text-foreground">{GATE_TITLE}</h3>
      <p className="mt-2 max-w-2xl text-[14px] leading-relaxed text-muted-foreground">
        {GATE_MESSAGE}
      </p>

      <div className="mt-4 rounded-xl bg-foreground/[0.04] p-4">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <p className="text-2xl font-bold tracking-tight text-foreground">
            {stats.stars === null ? (loaded ? "—" : "…") : n(stats.stars)}
            <span className="ml-2 text-sm font-medium text-muted-foreground">
              / {n(STAR_GOAL)} stars
            </span>
          </p>
          {stats.remaining !== null && stats.remaining > 0 && (
            <p className="text-[12px] font-medium text-muted-foreground">
              {n(stats.remaining)} to go
            </p>
          )}
        </div>
        <div className="mt-2.5 h-2 overflow-hidden rounded-full bg-foreground/10">
          <div
            className="h-full rounded-full bg-gradient-to-r from-amber-500 to-amber-300 transition-[width] duration-1000 ease-out"
            style={{ width: `${pct}%` }}
          />
        </div>
        {stats.progress !== null && (
          <p className="mt-2 text-[11px] text-muted-foreground">
            {(stats.progress * 100).toFixed(3)}% of the way there
          </p>
        )}
      </div>

      {!compact && (
        <p className="mt-4 text-[13px] leading-relaxed text-muted-foreground">{GATE_STILL_OPEN}</p>
      )}

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <ButtonAnchor href={STAR_REPO_URL} variant="primary" size="sm">
          Star {STAR_REPO}
        </ButtonAnchor>
        <span className="text-[12px] text-muted-foreground">{GATE_HOW_TO_HELP}</span>
      </div>
    </div>
  );
}
