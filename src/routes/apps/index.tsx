import { useEffect, useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { PageShell } from "@/components/site/PageShell";
import { Card, Section, StatTile, Tag } from "@/components/site/ui";
import { PageHeader } from "@/components/site/SiteChrome";
import {
  TIER_HINT,
  TIER_LABEL,
  appSlug,
  faviconUrl,
  loadCategory,
  loadCuratedApps,
  loadMcpIndex,
  type AppTier,
  type McpApp,
  type McpIndex,
} from "@/lib/apps";
import { pageSeo } from "@/lib/seo";

export const Route = createFileRoute("/apps/")({
  head: () => {
    const seo = pageSeo({
      path: "/apps",
      title: "MCP Hub — 8,202 MCP servers your agent can connect",
      description:
        "Browse the ZYRAXON MCP Hub: 8,202 Model Context Protocol servers across 18 categories, with browser sign-in, token auth, open and local tiers. 108 curated apps with connect guides, and 8,094 verified servers measured with a real handshake.",
      keywords: [
        "MCP servers",
        "MCP Hub",
        "Model Context Protocol",
        "MCP integrations",
        "AI agent apps",
        "connect MCP",
        "MCP directory",
        "verified MCP servers",
        "curated MCP apps",
        "open source MCP",
      ],
      type: "website",
      section: "Connected Apps",
      jsonLd: [
        {
          "@type": "ItemList",
          name: "ZYRAXON MCP Hub",
          description:
            "Every Model Context Protocol server the ZYRAXON agent can connect, grouped by category.",
          numberOfItems: 8202,
        },
      ],
    });
    return { meta: seo.meta, links: seo.links, scripts: seo.scripts };
  },
  component: AppsPage,
});

const TIERS: AppTier[] = ["browser", "key", "open", "local"];

/** How many cards are drawn at once. The registry holds thousands per category. */
const PAGE_SIZE = 60;

function AppsPage() {
  const [index, setIndex] = useState<McpIndex | null>(null);
  const [curated, setCurated] = useState<McpApp[]>([]);
  const [categoryApps, setCategoryApps] = useState<McpApp[]>([]);
  const [activeCategory, setActiveCategory] = useState<string>("all");
  const [loading, setLoading] = useState(true);
  const [loadingCategory, setLoadingCategory] = useState(false);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [tier, setTier] = useState<AppTier | "all">("all");
  const [shown, setShown] = useState(PAGE_SIZE);

  // The index and the curated 108 are small and always needed. A category file
  // is only read once that category is opened, because a single category holds
  // up to 2,293 rows.
  useEffect(() => {
    let alive = true;
    Promise.all([loadMcpIndex(), loadCuratedApps()])
      .then(([idx, apps]) => {
        if (!alive) return;
        setIndex(idx);
        setCurated(apps);
      })
      .catch((e) => alive && setError(e instanceof Error ? e.message : "Could not load apps"))
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    if (activeCategory === "all" || activeCategory === "curated") {
      setCategoryApps([]);
      return;
    }
    const file = index?.categories.find((c) => c.category === activeCategory)?.file;
    if (!file) return;
    let alive = true;
    setLoadingCategory(true);
    loadCategory(file)
      .then((apps) => alive && setCategoryApps(apps))
      .catch(() => alive && setCategoryApps([]))
      .finally(() => alive && setLoadingCategory(false));
    return () => {
      alive = false;
    };
  }, [activeCategory, index]);

  const pool = useMemo(() => {
    if (activeCategory === "all") return curated;
    if (activeCategory === "curated") return curated;
    return categoryApps;
  }, [activeCategory, curated, categoryApps]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return pool.filter((a) => {
      if (tier !== "all" && a.t !== tier) return false;
      if (!q) return true;
      return (
        a.n.toLowerCase().includes(q) ||
        a.d.toLowerCase().includes(q) ||
        a.c.toLowerCase().includes(q)
      );
    });
  }, [pool, query, tier]);

  useEffect(() => setShown(PAGE_SIZE), [activeCategory, query, tier]);

  const total = index?.total ?? 0;
  const curatedCount = index?.curated ?? curated.length;
  const verifiedCount = index?.verified ?? 0;
  const tierCounts = index?.tiers;

  return (
    <PageShell>
      <PageHeader
        label="Integrations"
        title="Every app your agent can drive"
        description={`The ZYRAXON MCP Hub: ${total.toLocaleString()} Model Context Protocol servers across ${index?.categories.length ?? 18} categories. ${curatedCount} curated apps come with a description and a connect guide; the other ${verifiedCount.toLocaleString()} were each reached by a verifier, and the depth it reached is shown on the card. Pick a category or an auth tier to narrow the list.`}
      />

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
        <StatTile value={total.toLocaleString()} label="MCP servers" />
        {TIERS.map((t) => (
          <StatTile
            key={t}
            value={tierCounts?.[t]?.toLocaleString() ?? "—"}
            label={TIER_LABEL[t]}
          />
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
              placeholder={
                activeCategory === "all"
                  ? "Search the curated 108 — open a category to search all of it"
                  : "Search this category by name, description or category"
              }
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
            onClick={() => setActiveCategory("all")}
            className={`zx-chip rounded-full px-3.5 py-1.5 text-xs font-semibold ${
              activeCategory === "all" ? "bg-primary/12 text-primary" : "text-muted-foreground"
            }`}
          >
            Curated {curatedCount}
          </button>
          {(index?.categories ?? []).map((c) => (
            <button
              key={c.category}
              type="button"
              onClick={() => setActiveCategory(c.category)}
              className={`zx-chip rounded-full px-3.5 py-1.5 text-xs font-semibold ${
                activeCategory === c.category
                  ? "bg-primary/12 text-primary"
                  : "text-muted-foreground"
              }`}
            >
              {c.category} {c.count.toLocaleString()}
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

        {loadingCategory && (
          <p className="mb-4 text-sm text-muted-foreground">Loading {activeCategory} servers…</p>
        )}

        {!loading && !error && filtered.length === 0 && (
          <Card className="p-10 text-center">
            <p className="text-sm text-muted-foreground">
              No apps match that filter. Try a different category or clear the search.
            </p>
          </Card>
        )}

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.slice(0, shown).map((app) => (
            <AppCard key={`${app.n}-${app.c}`} app={app} />
          ))}
        </div>

        {filtered.length > shown && (
          <div className="mt-6 text-center">
            <button
              type="button"
              onClick={() => setShown((n) => n + PAGE_SIZE)}
              className="zx-chip rounded-full px-5 py-2.5 text-sm font-semibold text-foreground"
            >
              Show {Math.min(PAGE_SIZE, filtered.length - shown).toLocaleString()} more of{" "}
              {filtered.length.toLocaleString()}
            </button>
          </div>
        )}
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
                {tierCounts?.[t]?.toLocaleString() ?? "—"}
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
          <AppMark app={app} />
        </span>
        <div className="min-w-0 flex-1">
          <Link
            to="/apps/$slug"
            params={{ slug: appSlug(app) }}
            className="block truncate text-[15px] font-semibold text-foreground hover:text-primary"
          >
            {app.n}
          </Link>
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
        {app.curated && <Tag tone="primary">Curated</Tag>}
        {typeof app.tl === "number" && app.tl > 0 && <Tag>{app.tl} tools</Tag>}
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
        <Link
          to="/apps/$slug"
          params={{ slug: appSlug(app) }}
          className="ml-auto text-[12px] font-semibold text-primary underline underline-offset-2"
        >
          Details →
        </Link>
      </div>
    </Card>
  );
}

/** The app's real mark, or its letter when it has no domain to take one from. */
function AppMark({ app }: { app: McpApp }) {
  if (app.dom) {
    return (
      <img
        src={faviconUrl(app.dom, 64)}
        alt={`${app.n} logo`}
        width={24}
        height={24}
        loading="lazy"
        className="rounded"
      />
    );
  }
  return (
    <span
      className="grid h-full w-full place-items-center text-sm font-bold text-white"
      style={{ background: app.col }}
    >
      {app.n.charAt(0)}
    </span>
  );
}
