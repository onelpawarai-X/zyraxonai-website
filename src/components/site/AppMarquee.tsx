import { useEffect, useState } from "react";
import { FEATURED_APPS, faviconUrl, loadApps, type McpApp } from "@/lib/apps";

function AppPill({ app }: { app: McpApp }) {
  return (
    <a
      href="/apps"
      className="zx-chip mx-1.5 flex shrink-0 items-center gap-2.5 rounded-full py-2 pl-2 pr-4"
    >
      <span className="grid h-7 w-7 shrink-0 place-items-center overflow-hidden rounded-full bg-foreground/6">
        {app.dom ? (
          <img
            src={faviconUrl(app.dom, 64)}
            alt=""
            width={18}
            height={18}
            loading="lazy"
            className="rounded"
          />
        ) : (
          <span
            className="grid h-full w-full place-items-center text-[11px] font-bold text-white"
            style={{ background: app.col }}
          >
            {app.n.charAt(0)}
          </span>
        )}
      </span>
      <span className="text-[13px] font-semibold text-foreground">{app.n}</span>
      <span className="hidden text-[11px] text-muted-foreground sm:inline">{app.c}</span>
    </a>
  );
}

/**
 * Always-on animated strip of the most popular connected apps, pinned at the
 * very top of the homepage. The list is duplicated so the CSS marquee can loop
 * seamlessly; it pauses on hover.
 */
export function AppMarquee() {
  const [apps, setApps] = useState<McpApp[]>([]);

  useEffect(() => {
    let alive = true;
    loadApps()
      .then((all) => {
        if (!alive) return;
        const byName = new Map(all.map((a) => [a.n, a]));
        const picked = FEATURED_APPS.map((n) => byName.get(n)).filter(Boolean) as McpApp[];
        setApps(picked.length ? picked : all.slice(0, 20));
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, []);

  const row = apps.length ? apps : [];

  return (
    <div className="relative border-b border-border">
      <div className="flex items-center gap-3 px-5 py-3 sm:px-8">
        <span className="hidden shrink-0 items-center gap-2 text-[10px] font-bold uppercase tracking-[0.22em] text-muted-foreground sm:flex">
          <span className="relative flex h-1.5 w-1.5">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-500 opacity-75" />
            <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-emerald-500" />
          </span>
          Live integrations
        </span>
        <div className="zx-marquee min-w-0 flex-1 overflow-hidden">
          <div className="zx-marquee-track">
            {[0, 1].map((dup) => (
              <div key={dup} className="flex shrink-0 items-center" aria-hidden={dup === 1}>
                {row.map((app) => (
                  <AppPill key={`${dup}-${app.n}`} app={app} />
                ))}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
