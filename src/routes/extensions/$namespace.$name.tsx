import { useEffect, useState } from "react";
import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { PageShell } from "@/components/site/PageShell";
import { SectionLabel } from "@/components/site/SiteChrome";
import { ButtonAnchor, Card, Tag } from "@/components/site/ui";
import { ExtensionIcon } from "@/components/extensions/ExtensionIcon";
import {
  fetchExtension,
  formatCount,
  installDeepLink,
  shortDate,
  vsixUrl,
  type OpenVsxExtension,
} from "@/lib/openvsx";

export const Route = createFileRoute("/extensions/$namespace/$name")({
  loader: async ({ params }) => {
    const ext = await fetchExtension(params.namespace, params.name);
    if (!ext) throw notFound();
    return { ext };
  },
  head: ({ loaderData }) => {
    const ext = loaderData?.ext;
    const title = ext ? `${ext.displayName} — ZYRAXON Extensions` : "Extension — ZYRAXON AI";
    const description = ext
      ? `${ext.displayName} (${ext.extensionId}) v${ext.version}. ${ext.description}`.slice(0, 300)
      : "A ZYRAXON extension published on the Open VSX registry.";
    return {
      meta: [
        { title },
        { name: "description", content: description },
        { property: "og:title", content: title },
        { property: "og:description", content: description },
        { property: "og:type", content: "website" },
        {
          property: "og:url",
          content: ext
            ? `https://zyraxonai.lovable.app/extensions/${ext.namespace}/${ext.name}`
            : "https://zyraxonai.lovable.app/extensions",
        },
        { name: "twitter:card", content: "summary_large_image" },
      ],
    };
  },
  component: ExtensionDetailPage,
});

function ExtensionDetailPage() {
  const { ext } = Route.useLoaderData();
  const [version, setVersion] = useState(ext.version);

  return (
    <PageShell>
      <nav className="mb-6 flex items-center gap-2 text-[12.5px] text-muted-foreground">
        <Link to="/extensions" className="font-semibold text-primary hover:underline">
          Extensions
        </Link>
        <span aria-hidden="true">/</span>
        <span className="truncate">{ext.displayName}</span>
      </nav>

      <div className="flex flex-wrap items-start gap-5">
        <ExtensionIcon ext={ext} size={72} />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
              {ext.displayName}
            </h1>
            {ext.verified && <Tag tone="success">Verified</Tag>}
            {ext.preRelease && <Tag tone="warn">Pre-release</Tag>}
            {ext.deprecated && <Tag tone="warn">Deprecated</Tag>}
          </div>
          <p className="mt-1 font-mono text-[12.5px] text-muted-foreground">
            {ext.extensionId} · v{ext.version}
          </p>
          <p className="mt-3 max-w-2xl text-[14px] leading-relaxed text-muted-foreground">
            {ext.description || "No description provided."}
          </p>

          <div className="mt-5 flex flex-wrap items-center gap-2">
            <a
              href={installDeepLink(ext, version)}
              className="rounded-full bg-primary px-4 py-2 text-[13px] font-semibold text-primary-foreground transition hover:opacity-90"
            >
              Install in ZYRAXON Agent
            </a>
            <ButtonAnchor href={vsixUrl(ext, version)} variant="ghost" size="sm">
              Download .vsix (v{version})
            </ButtonAnchor>
            <ButtonAnchor href={ext.registryUrl} variant="ghost" size="sm">
              Open VSX ↗
            </ButtonAnchor>
          </div>
        </div>
      </div>

      <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Downloads" value={ext.downloadCount.toLocaleString()} />
        <Stat label="Versions" value={String(ext.versions.length)} />
        <Stat
          label="Rating"
          value={ext.averageRating !== null ? `★ ${ext.averageRating.toFixed(1)}` : "—"}
        />
        <Stat label="Updated" value={ext.timestamp ? shortDate(ext.timestamp) : "—"} />
      </div>

      <div className="mt-10 grid gap-8 lg:grid-cols-[1fr_300px]">
        <div className="min-w-0">
          <SectionLabel>Versions</SectionLabel>
          <div className="mt-4 grid gap-2">
            {ext.versions.length === 0 && (
              <Card className="p-6 text-[13px] text-muted-foreground">No versions listed.</Card>
            )}
            {ext.versions.map((v, i) => (
              <Card key={v} className="flex flex-wrap items-center justify-between gap-3 p-4">
                <div className="flex items-center gap-2">
                  <span className="font-mono text-[13px] font-semibold text-foreground">v{v}</span>
                  {i === 0 && <Tag tone="primary">Latest</Tag>}
                  {i === 0 && ext.preRelease && <Tag tone="warn">Pre-release</Tag>}
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setVersion(v)}
                    aria-pressed={version === v}
                    className={`rounded-full px-3 py-1.5 text-[12px] font-semibold transition ${
                      version === v
                        ? "bg-primary text-primary-foreground"
                        : "zx-chip text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    {version === v ? "Selected" : "Select"}
                  </button>
                  <ButtonAnchor href={vsixUrl(ext, v)} variant="ghost" size="sm">
                    .vsix
                  </ButtonAnchor>
                </div>
              </Card>
            ))}
          </div>
        </div>

        <aside className="grid content-start gap-4">
          <Card className="p-5">
            <p className="text-[13px] font-semibold text-foreground">Details</p>
            <dl className="mt-3 grid gap-2 text-[12.5px]">
              <Row k="Publisher" v={ext.namespace} />
              <Row k="Identifier" v={ext.extensionId} />
              <Row k="Latest" v={`v${ext.version}`} />
              {ext.license && <Row k="License" v={ext.license} />}
              {ext.engines.vscode && <Row k="VS Code" v={ext.engines.vscode} />}
              {ext.reviewCount > 0 && <Row k="Reviews" v={String(ext.reviewCount)} />}
              <Row k="Downloads" v={formatCount(ext.downloadCount)} />
            </dl>
            <div className="mt-4 grid gap-2">
              {ext.repository && <ExternalLink href={ext.repository} label="Repository" />}
              {ext.homepage && <ExternalLink href={ext.homepage} label="Homepage" />}
              {ext.bugs && <ExternalLink href={ext.bugs} label="Issues" />}
            </div>
          </Card>

          {(ext.categories.length > 0 || ext.tags.length > 0) && (
            <Card className="p-5">
              <p className="text-[13px] font-semibold text-foreground">Tags</p>
              <div className="mt-3 flex flex-wrap gap-1.5">
                {[...ext.categories, ...ext.tags].slice(0, 14).map((t) => (
                  <span
                    key={t}
                    className="zx-chip rounded-md px-2 py-0.5 text-[11px] text-muted-foreground"
                  >
                    {t}
                  </span>
                ))}
              </div>
            </Card>
          )}
        </aside>
      </div>
    </PageShell>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <Card className="p-4">
      <p className="text-[11.5px] font-semibold tracking-wide text-muted-foreground uppercase">
        {label}
      </p>
      <p className="mt-1 text-[17px] font-bold text-foreground">{value}</p>
    </Card>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex items-start justify-between gap-3">
      <dt className="text-muted-foreground">{k}</dt>
      <dd className="min-w-0 truncate text-right font-medium text-foreground">{v}</dd>
    </div>
  );
}

function ExternalLink({ href, label }: { href: string; label: string }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="text-[12.5px] font-semibold text-primary hover:underline"
    >
      {label} ↗
    </a>
  );
}
