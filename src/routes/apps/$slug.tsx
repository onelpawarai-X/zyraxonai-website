import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { PageShell } from "@/components/site/PageShell";
import { PageHeader, SectionLabel } from "@/components/site/SiteChrome";
import { ButtonAnchor, Card, Section, Tag } from "@/components/site/ui";
import { TIER_HINT, TIER_LABEL, faviconUrl } from "@/lib/apps";
import { getMcpPage, relatedMcpPages, type McpPage } from "@/lib/mcp-registry.server";
import { pageSeo, SITE_ORIGIN } from "@/lib/seo";

/** How the server is installed, as a reader would say it. */
const INSTALL_LABEL: Record<string, string> = {
  remote_http: "Remote HTTP endpoint",
  npx: "npm package (npx)",
  uvx: "PyPI package (uvx)",
  docker: "Docker image",
};

/** How far the verifier got, as a reader would say it. */
const VERIFIED_LABEL: Record<string, string> = {
  full: "Full — initialize, tools/list and a read-only tools/call",
  tools_list: "tools/list — initialize and the tool list answered",
  auth_discovery: "Auth discovery — a 401 followed by a working document",
  launched: "Launched — the package started and asked for its key",
  declared: "Declared — reachable, needs a value from you",
  unknown: "No proof depth recorded",
};

export const Route = createFileRoute("/apps/$slug")({
  loader: async ({ params }) => {
    const page = getMcpPage(params.slug);
    if (!page) throw notFound();
    // The related set is resolved here rather than in the component so the links
    // are in the server-rendered HTML, where a crawler can follow them.
    return { page, related: relatedMcpPages(page) };
  },
  head: ({ loaderData, params }) => {
    const page = loaderData?.page;
    if (!page) {
      return {
        meta: [
          { title: "MCP server not found — ZYRAXON AI" },
          { name: "robots", content: "noindex" },
        ],
      };
    }

    const title = `${page.name} MCP server — ZYRAXON AI`;
    const seo = pageSeo({
      path: `/apps/${params.slug}`,
      title,
      description: page.description,
      keywords: [
        page.name,
        `${page.name} MCP`,
        `${page.name} MCP server`,
        `${page.category} MCP`,
        "MCP server",
        "Model Context Protocol",
        "connect MCP",
        "AI agent integration",
        TIER_LABEL[page.tier],
        page.curated ? "curated MCP" : "verified MCP server",
      ],
      type: "article",
      section: "Connected Apps",
      jsonLd: [
        {
          "@type": "SoftwareApplication",
          name: `${page.name} MCP server`,
          applicationCategory: "DeveloperApplication",
          applicationSubCategory: page.category,
          operatingSystem: "Web",
          description: page.description,
          url: `${SITE_ORIGIN}/apps/${params.slug}`,
          // The brand mark is the icon the page shows, so the structured data
          // names the same image rather than a generic one.
          ...(page.domain ? { image: faviconUrl(page.domain, 128) } : {}),
          ...(page.operator ? { author: { "@type": "Organization", name: page.operator } } : {}),
          offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
        },
      ],
    });

    return {
      meta: seo.meta,
      links: seo.links,
      scripts: seo.scripts,
    };
  },
  component: McpPageView,
});

function McpPageView() {
  // The loader guarantees both, because a missing page throws `notFound`.
  const { page, related } = Route.useLoaderData() as {
    page: McpPage;
    related: McpPage[];
  };

  return (
    <PageShell>
      <PageHeader
        label={`${page.category} // MCP`}
        title={page.name}
        description={page.description}
      />

      <div className="grid gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <div className="space-y-6">
          <Card className="p-6">
            <div className="flex items-start gap-4">
              <span className="zx-glass grid h-14 w-14 shrink-0 place-items-center overflow-hidden rounded-2xl">
                <McpMark page={page} size={30} />
              </span>
              <div className="min-w-0">
                <h2 className="text-lg font-bold tracking-tight text-foreground">
                  What this server does
                </h2>
                <p className="mt-2 text-[14px] leading-relaxed text-muted-foreground">
                  {page.description}
                </p>
              </div>
            </div>

            <div className="mt-5 flex flex-wrap gap-2">
              <Tag
                tone={
                  page.tier === "open" ? "success" : page.tier === "browser" ? "primary" : "muted"
                }
              >
                {TIER_LABEL[page.tier]}
              </Tag>
              <Tag>{page.category}</Tag>
              {page.curated && <Tag tone="primary">Curated</Tag>}
              {!page.curated && <Tag>Verified</Tag>}
            </div>
            <p className="mt-3 text-[13px] leading-relaxed text-muted-foreground">
              {TIER_HINT[page.tier]}
            </p>
          </Card>

          {page.steps.length > 0 && (
            <Card className="p-6">
              <h2 className="text-lg font-bold tracking-tight text-foreground">
                How to connect it
              </h2>
              <ol className="mt-4 space-y-3">
                {page.steps.map((step, i) => (
                  <li
                    key={i}
                    className="flex gap-3 text-[14px] leading-relaxed text-muted-foreground"
                  >
                    <span className="mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-full bg-primary/12 text-[12px] font-bold text-primary">
                      {i + 1}
                    </span>
                    <span>{step}</span>
                  </li>
                ))}
              </ol>
              {page.note && (
                <p className="mt-4 rounded-xl border border-border p-3 text-[13px] leading-relaxed text-muted-foreground">
                  {page.note}
                </p>
              )}
            </Card>
          )}

          {related.length > 0 && (
            <Section
              label="Related"
              title={`More in ${page.category}`}
              description={`Other MCP servers in the same category, so you can see what else your agent can reach here.`}
            >
              <div className="grid gap-3 sm:grid-cols-2">
                {related.map((other) => (
                  <Link
                    key={other.id}
                    to="/apps/$slug"
                    params={{ slug: other.id }}
                    className="zx-glass flex items-center gap-3 rounded-xl p-3 transition hover:border-primary/40"
                  >
                    <span className="zx-glass grid h-9 w-9 shrink-0 place-items-center overflow-hidden rounded-lg">
                      <McpMark page={other} size={20} />
                    </span>
                    <span className="min-w-0">
                      <span className="block truncate text-[14px] font-semibold text-foreground">
                        {other.name}
                      </span>
                      <span className="block truncate text-[12px] text-muted-foreground">
                        {other.category}
                      </span>
                    </span>
                  </Link>
                ))}
              </div>
            </Section>
          )}
        </div>

        <div className="space-y-6">
          <Card className="p-6">
            <SectionLabel>Connection</SectionLabel>
            <dl className="mt-4 space-y-3 text-[13px]">
              <Row label="Auth tier" value={TIER_LABEL[page.tier]} />
              {page.install && (
                <Row label="Install" value={INSTALL_LABEL[page.install] ?? page.install} />
              )}
              {page.verified && (
                <Row label="Verified" value={VERIFIED_LABEL[page.verified] ?? page.verified} />
              )}
              {typeof page.tools === "number" && page.tools > 0 && (
                <Row label="Tools" value={`${page.tools}`} />
              )}
              {page.operator && <Row label="Operated by" value={page.operator} />}
            </dl>

            {page.url && (
              <div className="mt-5">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                  Endpoint
                </p>
                <code className="mt-1 block break-all rounded-lg border border-border p-2 text-[12px] text-foreground">
                  {page.url}
                </code>
              </div>
            )}

            <div className="mt-5 flex flex-wrap gap-2">
              {page.tokenUrl && <ButtonAnchor href={page.tokenUrl}>Get a token →</ButtonAnchor>}
              {page.domain && (
                <ButtonAnchor href={`https://${page.domain}`} variant="ghost">
                  Open {page.name} →
                </ButtonAnchor>
              )}
            </div>
          </Card>

          <Card className="p-6">
            <SectionLabel>Panel</SectionLabel>
            <p className="mt-2 text-[13px] leading-relaxed text-muted-foreground">
              This server is one of {page.curated ? "108 curated" : "8,094 verified"} MCP
              integrations your agent can connect. Browse the whole catalogue by category or auth
              tier.
            </p>
            <div className="mt-4">
              <Link
                to="/apps"
                className="text-[13px] font-semibold text-primary underline underline-offset-2"
              >
                All connected apps →
              </Link>
            </div>
          </Card>
        </div>
      </div>
    </PageShell>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-3">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="text-right font-semibold text-foreground">{value}</dd>
    </div>
  );
}

/** The app's real mark, or its letter when it has no domain to take one from. */
function McpMark({ page, size }: { page: McpPage; size: number }) {
  if (page.domain) {
    return (
      <img
        src={faviconUrl(page.domain, 128)}
        alt={`${page.name} logo`}
        width={size}
        height={size}
        loading="lazy"
        className="rounded"
      />
    );
  }
  return (
    <span
      className="grid h-full w-full place-items-center font-bold text-white"
      style={{ background: page.color, fontSize: size * 0.6 }}
    >
      {page.name.charAt(0)}
    </span>
  );
}
