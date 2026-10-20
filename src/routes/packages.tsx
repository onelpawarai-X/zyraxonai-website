import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { PageShell } from "@/components/site/PageShell";
import { PageHeader } from "@/components/site/SiteChrome";
import { ButtonAnchor, Card, Section, Tag } from "@/components/site/ui";

export const Route = createFileRoute("/packages")({
  head: () => ({
    meta: [
      { title: "NPM Packages — ZYRAXON AI" },
      {
        name: "description",
        content:
          "Browse all @zyraxon-ai NPM packages: SDKs, core libraries, plugins and TypeScript types for building with ZYRAXON AI.",
      },
      {
        name: "keywords",
        content: "ZYRAXON npm packages, @zyraxon-ai SDK, TypeScript AI SDK, AI packages",
      },
      { property: "og:title", content: "NPM Packages — ZYRAXON AI" },
      {
        property: "og:description",
        content:
          "Browse all @zyraxon-ai NPM packages: SDKs, core libraries, plugins and TypeScript types for building with ZYRAXON AI.",
      },
      { property: "og:type", content: "website" },
      { property: "og:url", content: "https://zyraxonai.lovable.app/packages" },
      { name: "twitter:card", content: "summary" },
    ],
    links: [{ rel: "canonical", href: "https://zyraxonai.lovable.app/packages" }],
  }),
  component: PackagesPage,
});

type Pkg = {
  name: string;
  scope: string;
  version: string;
  description: string;
  keywords: string[];
  date: string;
  npmUrl: string;
  installCmd: string;
};

function PackagesPage() {
  const [packages, setPackages] = useState<Pkg[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const res = await fetch("/api/public/npm-packages");
        const data = await res.json();
        if (active && data.packages) setPackages(data.packages);
        if (active && data.error) setError(data.error);
      } catch (e) {
        if (active) setError(e instanceof Error ? e.message : "Failed to load packages");
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return packages;
    return packages.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        (p.description ?? "").toLowerCase().includes(q) ||
        p.keywords.some((k) => k.toLowerCase().includes(q)),
    );
  }, [packages, search]);

  return (
    <PageShell>
      <PageHeader
        label="SDK"
        title="NPM packages"
        description="Official @zyraxon-ai packages for building AI-powered applications — type-safe, multi-provider and ready for production."
      />

      <Card className="flex flex-wrap items-center gap-3 p-4">
        <span className="zx-glass flex min-w-0 flex-1 items-center gap-2.5 rounded-xl px-3.5 py-2.5 font-mono text-[13px]">
          <span className="text-primary">$</span>
          <code className="min-w-0 flex-1 truncate text-foreground">
            npm install @zyraxon-ai/sdk
          </code>
        </span>
        <ButtonAnchor href="https://www.npmjs.com/search?q=%40zyraxon-ai" variant="glass" size="sm">
          Browse on npm
        </ButtonAnchor>
      </Card>

      <div className="mt-6">
        <div className="relative">
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
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search packages, keywords or descriptions"
            className="h-11 w-full rounded-xl border border-border bg-transparent pl-10 pr-3.5 text-sm text-foreground outline-none transition focus:border-primary/50 focus:ring-2 focus:ring-primary/20"
          />
        </div>
      </div>

      {!loading && !error && (
        <p className="mt-4 text-[13px] text-muted-foreground">
          {filtered.length} of {packages.length} packages under{" "}
          <span className="font-mono text-foreground">@zyraxon-ai</span>
        </p>
      )}

      {loading && (
        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="zx-glass h-44 animate-pulse rounded-2xl" />
          ))}
        </div>
      )}

      {error && !loading && (
        <Card className="mt-6 p-8 text-center">
          <p className="text-[14px] font-semibold text-foreground">Could not load packages</p>
          <p className="mt-1.5 text-[13px] text-muted-foreground">{error}</p>
        </Card>
      )}

      {!loading && !error && (
        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((pkg) => (
            <PackageCard key={pkg.name} pkg={pkg} />
          ))}
        </div>
      )}

      {!loading && !error && filtered.length === 0 && packages.length > 0 && (
        <Card className="mt-6 p-10 text-center">
          <p className="text-[13.5px] text-muted-foreground">No packages match “{search}”.</p>
        </Card>
      )}

      <Section
        className="mt-12"
        label="Why the SDK"
        title="Built to be dropped into any stack"
        description="The same primitives that power the desktop agent, packaged for your own application."
      >
        <div className="grid gap-4 sm:grid-cols-3">
          {[
            { t: "Type-safe", b: "Full TypeScript with Effect-TS schemas and generated types." },
            {
              t: "Multi-provider",
              b: "OpenAI, Anthropic, Google, Groq, xAI and more behind one API.",
            },
            { t: "Extensible", b: "A plugin system for custom tools and integrations." },
          ].map((c) => (
            <Card key={c.t} hover className="p-6">
              <h3 className="text-[15px] font-bold text-foreground">{c.t}</h3>
              <p className="mt-2 text-[13px] leading-relaxed text-muted-foreground">{c.b}</p>
            </Card>
          ))}
        </div>
      </Section>
    </PageShell>
  );
}

function PackageCard({ pkg }: { pkg: Pkg }) {
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(pkg.installCmd);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      /* clipboard unavailable */
    }
  };

  return (
    <Card hover className="flex flex-col gap-3.5 p-5">
      <div className="flex flex-wrap items-center gap-2">
        <span className="min-w-0 truncate font-mono text-[14px] font-bold text-primary">
          {pkg.name}
        </span>
        <Tag tone="muted">v{pkg.version}</Tag>
      </div>

      <p className="min-h-[40px] text-[13px] leading-relaxed text-muted-foreground">
        {pkg.description || "No description"}
      </p>

      <div className="zx-glass flex items-center gap-2.5 rounded-xl px-3.5 py-2.5 font-mono text-[12.5px]">
        <span className="select-none text-muted-foreground">$</span>
        <span className="min-w-0 flex-1 truncate text-foreground">{pkg.installCmd}</span>
        <button
          type="button"
          onClick={copy}
          className="zx-chip shrink-0 rounded-lg px-2.5 py-1 text-[11px] font-semibold text-foreground"
        >
          {copied ? "Copied" : "Copy"}
        </button>
      </div>

      {pkg.keywords.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {pkg.keywords.slice(0, 4).map((kw) => (
            <Tag key={kw}>{kw}</Tag>
          ))}
        </div>
      )}

      <div className="mt-auto flex items-center justify-between gap-3 pt-1">
        <span className="text-[11.5px] text-muted-foreground">
          {pkg.date
            ? new Date(pkg.date).toLocaleDateString("en-US", {
                month: "short",
                day: "numeric",
                year: "numeric",
              })
            : ""}
        </span>
        <a
          href={pkg.npmUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 text-[12.5px] font-semibold text-primary"
        >
          npmjs.com
          <svg
            width="12"
            height="12"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <path d="M7 17L17 7M9 7h8v8" />
          </svg>
        </a>
      </div>
    </Card>
  );
}
