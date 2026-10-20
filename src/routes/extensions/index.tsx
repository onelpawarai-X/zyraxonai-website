import { useEffect, useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { PageShell } from "@/components/site/PageShell";
import { PageHeader, SectionLabel } from "@/components/site/SiteChrome";
import { ButtonAnchor, Card, Tag } from "@/components/site/ui";
import { ExtensionIcon } from "@/components/extensions/ExtensionIcon";
import {
  OPEN_VSX,
  TRACKED_PUBLISHERS,
  fetchPublisherExtensions,
  formatCount,
  installDeepLink,
  shortDate,
  type OpenVsxExtension,
} from "@/lib/openvsx";

export const Route = createFileRoute("/extensions/")({
  head: () => ({
    meta: [
      { title: "Extensions — ZYRAXON AI" },
      {
        name: "description",
        content:
          "Every extension published by ZYRAXON on the Open VSX registry. Install straight into ZYRAXON Agent or download the .vsix directly.",
      },
      {
        name: "keywords",
        content: "ZYRAXON extensions, Open VSX extensions, AI editor extensions",
      },
      { property: "og:title", content: "Extensions — ZYRAXON AI" },
      {
        property: "og:description",
        content:
          "Every extension published by ZYRAXON on the Open VSX registry, with one-click install and direct .vsix downloads.",
      },
      { property: "og:type", content: "website" },
      { property: "og:url", content: "https://zyraxonai.lovable.app/extensions" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
    links: [{ rel: "canonical", href: "https://zyraxonai.lovable.app/extensions" }],
  }),
  component: ExtensionsPage,
});

type SortKey = "downloads" | "updated" | "name";

function ExtensionsPage() {
  const [items, setItems] = useState<OpenVsxExtension[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<SortKey>("downloads");

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const groups = await Promise.all(
          TRACKED_PUBLISHERS.map((ns) => fetchPublisherExtensions(ns)),
        );
        if (active) setItems(groups.flat());
      } catch (e) {
        if (active)
          setError(e instanceof Error ? e.message : "Could not reach the Open VSX registry");
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    const filtered = q
      ? items.filter((e) =>
          [e.displayName, e.name, e.extensionId, e.description, ...e.categories, ...e.tags]
            .join(" ")
            .toLowerCase()
            .includes(q),
        )
      : items;
    const sorted = [...filtered];
    if (sort === "downloads") sorted.sort((a, b) => b.downloadCount - a.downloadCount);
    if (sort === "name") sorted.sort((a, b) => a.displayName.localeCompare(b.displayName));
    if (sort === "updated")
      sorted.sort((a, b) => (b.timestamp ?? "").localeCompare(a.timestamp ?? ""));
    return sorted;
  }, [items, query, sort]);

  const totalDownloads = items.reduce((sum, e) => sum + e.downloadCount, 0);

  return (
    <PageShell>
      <PageHeader
        label="Open VSX // Extensions"
        title="Extensions"
        description="Everything ZYRAXON publishes to the Open VSX registry. Install straight into ZYRAXON Agent, or take the .vsix file and load it in any VS Code compatible editor."
      >
        <div className="mt-5 flex flex-wrap items-center gap-3">
          <ButtonAnchor href={OPEN_VSX} variant="ghost" size="sm">
            Open VSX registry ↗
          </ButtonAnchor>
          {items.length > 0 && (
            <span className="text-[12.5px] text-muted-foreground">
              {items.length} {items.length === 1 ? "extension" : "extensions"} ·{" "}
              {totalDownloads.toLocaleString()} downloads
            </span>
          )}
        </div>
      </PageHeader>

      {!loading && items.length > 0 && (
        <div className="mb-6 flex flex-wrap items-center gap-3">
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search extensions…"
            aria-label="Search extensions"
            className="zx-chip h-10 min-w-[220px] flex-1 rounded-xl px-3.5 text-[13.5px] text-foreground outline-none placeholder:text-muted-foreground"
          />
          <div className="flex items-center gap-1.5">
            <span className="text-[12px] text-muted-foreground">Sort</span>
            {(
              [
                ["downloads", "Downloads"],
                ["updated", "Updated"],
                ["name", "Name"],
              ] as [SortKey, string][]
            ).map(([key, label]) => (
              <button
                key={key}
                type="button"
                onClick={() => setSort(key)}
                aria-pressed={sort === key}
                className={`rounded-full px-3 py-1.5 text-[12px] font-semibold transition ${
                  sort === key
                    ? "bg-primary text-primary-foreground"
                    : "zx-chip text-muted-foreground hover:text-foreground"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      )}

      {loading && (
        <Card className="p-10 text-center text-[13px] text-muted-foreground">
          Loading extensions from Open VSX…
        </Card>
      )}

      {!loading && error && (
        <Card className="p-10 text-center text-[13px] text-muted-foreground">
          <p className="font-semibold text-foreground">Could not load extensions</p>
          <p className="mt-1">{error}</p>
        </Card>
      )}

      {!loading && !error && items.length === 0 && (
        <Card className="p-10 text-center">
          <p className="text-[14px] font-semibold text-foreground">No extensions published yet</p>
          <p className="mx-auto mt-2 max-w-md text-[13px] leading-relaxed text-muted-foreground">
            The ZYRAXON publisher exists on Open VSX but has not released an extension so far.
            Anything published there will appear here on its own — this page reads the registry live
            and needs no token or manual update.
          </p>
          <div className="mt-4 flex justify-center">
            <ButtonAnchor href={`${OPEN_VSX}/extension/zyraxon/`} variant="ghost" size="sm">
              Check the registry ↗
            </ButtonAnchor>
          </div>
        </Card>
      )}

      {!loading && !error && items.length > 0 && visible.length === 0 && (
        <Card className="p-8 text-center text-[13px] text-muted-foreground">
          Nothing matches “{query}”.
        </Card>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        {visible.map((ext) => (
          <ExtensionCard key={ext.extensionId} ext={ext} />
        ))}
      </div>

      <section className="mt-14">
        <SectionLabel>How it works</SectionLabel>
        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          {[
            {
              t: "Read live, no token",
              d: "The list comes straight from open-vsx.org in your browser. Publish a new version and it shows up here on the next visit.",
            },
            {
              t: "Install into the agent",
              d: "The install button hands the .vsix to ZYRAXON Agent through a deep link. If the app is not running yet, you get the download page first.",
            },
            {
              t: "Take the .vsix anywhere",
              d: "Every extension also offers a plain download, so you can sideload it into VS Code, VSCodium, Gitpod or any compatible editor.",
            },
          ].map((c) => (
            <Card key={c.t} className="p-5">
              <p className="text-[13.5px] font-semibold text-foreground">{c.t}</p>
              <p className="mt-1.5 text-[12.5px] leading-relaxed text-muted-foreground">{c.d}</p>
            </Card>
          ))}
        </div>
      </section>
    </PageShell>
  );
}

function ExtensionCard({ ext }: { ext: OpenVsxExtension }) {
  return (
    <Card className="flex flex-col p-5">
      <div className="flex items-start gap-3.5">
        <ExtensionIcon ext={ext} size={46} />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="truncate text-[15px] font-bold text-foreground">{ext.displayName}</h2>
            {ext.verified && <Tag tone="success">Verified</Tag>}
            {ext.preRelease && <Tag tone="warn">Pre-release</Tag>}
            {ext.deprecated && <Tag tone="warn">Deprecated</Tag>}
          </div>
          <p className="mt-0.5 font-mono text-[11.5px] text-muted-foreground">
            {ext.extensionId} · v{ext.version}
          </p>
        </div>
      </div>

      <p className="mt-3 line-clamp-3 text-[12.5px] leading-relaxed text-muted-foreground">
        {ext.description || "No description provided."}
      </p>

      {ext.categories.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {ext.categories.slice(0, 4).map((c) => (
            <span
              key={c}
              className="zx-chip rounded-md px-2 py-0.5 text-[11px] text-muted-foreground"
            >
              {c}
            </span>
          ))}
        </div>
      )}

      <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-1 text-[12px] text-muted-foreground">
        <span>{formatCount(ext.downloadCount)} downloads</span>
        {ext.averageRating !== null && <span>★ {ext.averageRating.toFixed(1)}</span>}
        {ext.timestamp && <span>Updated {shortDate(ext.timestamp)}</span>}
        {ext.license && <span>{ext.license}</span>}
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <InstallAction ext={ext} />
        <ButtonAnchor href={ext.downloadUrl} variant="ghost" size="sm">
          Download .vsix
        </ButtonAnchor>
        <Link
          to="/extensions/$namespace/$name"
          params={{ namespace: ext.namespace, name: ext.name }}
          className="text-[12.5px] font-semibold text-primary hover:underline"
        >
          Details →
        </Link>
      </div>
    </Card>
  );
}

/**
 * Hands the extension to the desktop app. The deep link only works when the
 * agent is installed, so a plain download stays available next to it.
 */
function InstallAction({ ext }: { ext: OpenVsxExtension }) {
  const [tried, setTried] = useState(false);
  return (
    <button
      type="button"
      onClick={() => {
        setTried(true);
        window.location.href = installDeepLink(ext);
      }}
      className="rounded-full bg-primary px-4 py-1.5 text-[12.5px] font-semibold text-primary-foreground transition hover:opacity-90"
    >
      {tried ? "Opening agent…" : "Install"}
    </button>
  );
}
