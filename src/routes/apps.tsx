import { useEffect, useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { PageShell } from "@/components/site/PageShell";
import { Card, Section, StatTile, Tag } from "@/components/site/ui";
import { PageHeader } from "@/components/site/SiteChrome";
import { TIER_HINT, TIER_LABEL, faviconUrl, loadApps, type AppTier, type McpApp } from "@/lib/apps";

export const Route = createFileRoute("/apps")({
  head: () => ({
    meta: [
      { title: "Connected Apps — ZYRAXON AI" },
      {
        name: "description",
        content:
          "Every application ZYRAXON AI can drive: 108 live MCP integrations across 27 categories, with browser sign-in, token auth, open and local tiers.",
      },
      { property: "og:title", content: "Connected Apps — ZYRAXON AI" },
      {
        property: "og:description",
        content:
          "Every application ZYRAXON AI can drive: 108 live MCP integrations across 27 categories.",
      },
      { property: "og:type", content: "website" },
      { property: "og:url", content: "https://zyraxonai.lovable.app/apps" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: AppsPage,
});

const TIERS: AppTier[] = ["browser", "key", "open", "local"];

function AppsPage() {
  const [apps, setApps] = useState<McpApp[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [cat, setCat] = useState("all");
  const [tier, setTier] = useState<AppTier | "all">("all");

  useEffect(() => {
    loadApps()
      .then(setApps)
      .catch((e) => setError(e instanceof Error ? e.message : "Could not load apps"))
      .finally(() => setLoading(false));
  }, []);

  const categories = useMemo(() => {
    const counts = new Map<string, number>();
    apps.forEach((a) => counts.set(a.c, (counts.get(a.c) ?? 0) + 1));
    return [...counts.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  }, [apps]);

  const tierCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    apps.forEach((a) => (counts[a.t] = (counts[a.t] ?? 0) + 1));
    return counts;
  }, [apps]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return apps.filter((a) => {
      if (cat !== "all" && a.c !== cat) return false;
      if (tier !== "all" && a.t !== tier) return false;
      if (!q) return true;
      return (
        a.n.toLowerCase().includes(q) ||
        a.d.toLowerCase().includes(q) ||
        a.c.toLowerCase().includes(q)
      );
    });
  }, [apps, query, cat, tier]);

  return (
    <PageShell>
      <PageHeader
        label="Integrations"
        title="Every app your agent can drive"
        description="Each endpoint in the ZYRAXON MCP Hub was checked against its live server with a real initialize call before it was listed. Pick a category or an auth tier to narrow the list."
      />

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
        <StatTile value={apps.length} label="Applications" />
        {TIERS.map((t) => (
          <StatTile key={t} value={tierCounts[t] ?? 0} label={TIER_LABEL[t]} />
        ))}
      </div>

      <Section className="mt-10">
        <div className="zx-glass flex flex-col gap-3 rounded-2xl p-3.5 sm:flex-row sm:items-center">
          <div className="relative flex-1">
            <svg
              className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground"
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <circle cx="11" cy="11" r="7" />
              <path d="M20 20l-3.5-3.5" />
            </svg>
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search apps, descriptions or categories"
              className="h-10 w-full rounded-xl border border-border bg-transparent pl-10 pr-3 text-sm text-foreground outline-none transition focus:border-primary/50 focus:ring-2 focus:ring-primary/20"
            />
          </div>
          <select
            value={tier}
            onChange={(e) => setTier(e.target.value as AppTier | "all")}
            className="h-10 rounded-xl border border-border bg-transparent px-3 text-sm text-foreground outline-none focus:border-primary/50"
          >
            <option value="all">All auth tiers</option>
            {TIERS.map((t) => (
              <option key={t} value={t}>
                {TIER_LABEL[t]}
              </option>
            ))}
          </select>
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setCat("all")}
            className={`zx-chip rounded-full px-3.5 py-1.5 text-xs font-semibold ${
              cat === "all" ? "bg-primary/12 text-primary" : "text-muted-foreground"
            }`}
          >
            All {apps.length}
          </button>
          {categories.map(([name, count]) => (
            <button
              key={name}
              type="button"
              onClick={() => setCat(name)}
              className={`zx-chip rounded-full px-3.5 py-1.5 text-xs font-semibold ${
                cat === name ? "bg-primary/12 text-primary" : "text-muted-foreground"
              }`}
            >
              {name} {count}
            </button>
          ))}
        </div>
      </Section>

      <div className="mt-8">
        {loading && (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="zx-glass h-32 animate-pulse rounded-2xl" />
            ))}
          </div>
        )}

        {error && (
          <Card className="p-6 text-center">
            <p className="text-sm font-semibold text-foreground">Catalogue unavailable</p>
            <p className="mt-1 text-sm text-muted-foreground">{error}</p>
          </Card>
        )}

        {!loading && !error && filtered.length === 0 && (
          <Card className="p-10 text-center">
            <p className="text-sm text-muted-foreground">
              No apps match that filter. Try a different category or clear the search.
            </p>
          </Card>
        )}

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((app) => (
            <AppCard key={`${app.n}-${app.c}`} app={app} />
          ))}
        </div>
      </div>

      <Section
        className="mt-12"
        label="How auth works"
        title="Four tiers, no surprises"
        description="Every integration declares exactly what it needs before it runs. Nothing is granted silently."
      >
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {TIERS.map((t) => (
            <Card key={t} className="p-5">
              <Tag tone={t === "open" ? "success" : t === "browser" ? "primary" : "muted"}>
                {TIER_LABEL[t]}
              </Tag>
              <p className="mt-3 text-[13px] leading-relaxed text-muted-foreground">
                {TIER_HINT[t]}
              </p>
              <p className="mt-3 text-2xl font-bold tracking-tight text-foreground">
                {tierCounts[t] ?? 0}
              </p>
            </Card>
          ))}
        </div>
      </Section>
    </PageShell>
  );
}

function AppCard({ app }: { app: McpApp }) {
  return (
    <Card hover className="flex flex-col gap-3 p-5">
      <div className="flex items-start gap-3">
        <span className="zx-glass grid h-11 w-11 shrink-0 place-items-center overflow-hidden rounded-xl">
          {app.dom ? (
            <img
              src={faviconUrl(app.dom, 64)}
              alt=""
              width={24}
              height={24}
              loading="lazy"
              className="rounded"
            />
          ) : (
            <span
              className="grid h-full w-full place-items-center text-sm font-bold text-white"
              style={{ background: app.col }}
            >
              {app.n.charAt(0)}
            </span>
          )}
        </span>
        <div className="min-w-0 flex-1">
          <h3 className="truncate text-[15px] font-semibold text-foreground">{app.n}</h3>
          <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
            {app.c}
          </p>
        </div>
      </div>
      <p className="text-[13px] leading-relaxed text-muted-foreground">{app.d}</p>
      <div className="mt-auto flex flex-wrap items-center gap-2 pt-1">
        <Tag tone={app.t === "open" ? "success" : app.t === "browser" ? "primary" : "muted"}>
          {TIER_LABEL[app.t]}
        </Tag>
        {app.t === "key" && app.tok && (
          <a
            href={app.tok}
            target="_blank"
            rel="noopener noreferrer"
            className="text-[12px] font-semibold text-primary underline underline-offset-2"
          >
            Get a token →
          </a>
        )}
      </div>
    </Card>
  );
}
