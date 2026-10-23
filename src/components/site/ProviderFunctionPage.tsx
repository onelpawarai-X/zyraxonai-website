import { Link } from "@tanstack/react-router";
import { Card, Section, Tag } from "@/components/site/ui";
import { PageShell } from "@/components/site/PageShell";
import { PageHeader } from "@/components/site/SiteChrome";
import { inlineMarkdown } from "@/lib/inline-markdown";
import { API_ORIGIN, V1_BASE_URL } from "@/lib/providers/integrations";
import { ENDPOINTS, type Endpoint } from "@/lib/providers/endpoints";
import {
  PROVIDER_FUNCTIONS,
  getProviderFunction,
  providerFunctionsIn,
  type ProviderFunction,
} from "@/lib/providers/functions";
import { getIntegration } from "@/lib/providers/integrations";
import { CopyButton, EndpointBody, IntegrationCard } from "./provider-parts";

/** One function of the provider, on its own page.
 *
 *  The hub shows every function at once, which is right for a reader who does
 *  not yet know what they want. This page is for the reader who does: it drops
 *  the rest and gives one function room — its endpoints in full, its steps, its
 *  code, and the guide that writes it up. `Back to all functions` and the
 *  sibling links keep the whole set one click away. */

function FunctionBreadcrumb({ fn }: { fn: ProviderFunction }) {
  return (
    <nav className="mb-4 flex flex-wrap items-center gap-2 text-[12px] text-muted-foreground">
      <Link to="/providers" className="font-semibold text-primary">
        Provider
      </Link>
      <span>/</span>
      <span className="text-muted-foreground">{fn.group}</span>
      <span>/</span>
      <span className="font-semibold text-foreground">{fn.name}</span>
    </nav>
  );
}

function Siblings({ fn }: { fn: ProviderFunction }) {
  const siblings = providerFunctionsIn(fn.group).filter((f) => f.slug !== fn.slug);
  if (!siblings.length) return null;
  return (
    <Section label="Same group" title={`More in ${fn.group}`}>
      <div className="flex flex-wrap gap-2">
        {siblings.map((s) => (
          <Link
            key={s.slug}
            to="/providers/$slug"
            params={{ slug: s.slug }}
            className="inline-flex items-center gap-2 rounded-lg border border-border/60 bg-foreground/3 px-3 py-1.5 text-[12.5px] font-semibold text-foreground transition-colors hover:border-primary/40 hover:text-primary"
          >
            <span>{s.glyph}</span>
            {s.name}
          </Link>
        ))}
      </div>
    </Section>
  );
}

export default function ProviderFunctionPage({ slug }: { slug: string }) {
  const fn = getProviderFunction(slug);

  if (!fn) {
    return (
      <PageShell>
        <PageHeader
          label="Provider"
          title="No such function"
          description={`There is no provider function called "${slug}". The hub lists every one.`}
        >
          <div className="mt-5">
            <Link
              to="/providers"
              className="inline-flex items-center gap-2 rounded-lg border border-primary/40 bg-primary/10 px-4 py-2 text-[13px] font-semibold text-primary"
            >
              Back to all functions
            </Link>
          </div>
        </PageHeader>
      </PageShell>
    );
  }

  const endpoints = (fn.endpoints ?? [])
    .map((id) => ENDPOINTS.find((e) => e.id === id))
    .filter((e): e is Endpoint => Boolean(e));
  const integrations = (fn.integrations ?? [])
    .map((id) => getIntegration(id))
    .filter((i): i is NonNullable<typeof i> => Boolean(i));

  return (
    <PageShell>
      <FunctionBreadcrumb fn={fn} />

      <PageHeader
        label={fn.group}
        title={`${fn.glyph}  ${fn.name}`}
        description={fn.summary}
      >
        <div className="mt-5 flex flex-wrap items-center gap-2">
          {fn.tags?.map((t) => (
            <Tag key={t} tone="primary">
              {t}
            </Tag>
          ))}
          {fn.docSlug && (
            <a
              href={`/docs/${fn.docSlug}`}
              className="text-[12px] font-semibold text-primary underline-offset-4 hover:underline"
            >
              Read the full guide →
            </a>
          )}
        </div>
      </PageHeader>

      {fn.kind === "endpoint" && endpoints.length > 0 && (
        <Section
          label="The call"
          title={endpoints.length > 1 ? "The endpoints" : "The endpoint"}
          description="The URL, what it returns, the fields it takes and code that works. Everything is here so this page is the only one you need open."
        >
          <div className="grid gap-4">
            {endpoints.map((endpoint) => (
              <Card key={endpoint.id} className="overflow-hidden p-0">
                <div className="flex flex-wrap items-center gap-2 border-b border-border/60 px-5 py-3">
                  <span className="text-[13px] font-semibold text-foreground">{endpoint.name}</span>
                  <span className="ml-auto text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                    no key
                  </span>
                </div>
                <div className="px-5 py-4">
                  <EndpointBody endpoint={endpoint} />
                </div>
              </Card>
            ))}
          </div>
        </Section>
      )}

      {integrations.length > 0 && (
        <Section
          label="How to connect"
          title={integrations.length > 1 ? "Where it plugs in" : integrations[0]!.name}
          description={`Base URL ${V1_BASE_URL}, any non-empty API key. The exact fields, the steps and code for each host below.`}
        >
          <Card className="mb-5 p-5">
            <div className="flex flex-wrap items-center gap-3">
              <div className="min-w-0 flex-1">
                <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-muted-foreground">
                  Base URL
                </p>
                <code className="mt-1 block break-all text-[13px] font-semibold text-foreground">
                  {V1_BASE_URL}
                </code>
              </div>
              <CopyButton text={V1_BASE_URL} label="copy base URL" />
            </div>
          </Card>

          <div className="grid gap-4 lg:grid-cols-2">
            {integrations.map((i) => (
              <IntegrationCard key={i.id} integration={i} open />
            ))}
          </div>
        </Section>
      )}

      {fn.kind === "endpoint" && integrations.length === 0 && (
        <Section
          label="Try it"
          title="No client needed"
          description="Every call below is a plain HTTP request, so cURL is enough to see it answer before you write any code."
        >
          <Card className="p-5">
            <p className="text-[13px] leading-relaxed text-muted-foreground">
              The base URL is{" "}
              <code className="text-[12px] text-primary">{V1_BASE_URL}</code> and no API key is
              required. A machine-readable view of the whole surface is at{" "}
              <a
                href={`${API_ORIGIN}/api/public/zyraxon/v1/endpoints`}
                target="_blank"
                rel="noopener noreferrer"
                className="font-semibold text-primary"
              >
                /v1/endpoints
              </a>
              .
            </p>
            <p className="mt-3 text-[12.5px] leading-relaxed text-muted-foreground">
              {inlineMarkdown(
                "If you are building this into a client, the [integration guide](/docs/provider-integrations) shows the same two values pasted into twenty host apps.",
              )}
            </p>
          </Card>
        </Section>
      )}

      <Siblings fn={fn} />

      <div className="mt-10 border-t border-border/60 pt-6">
        <Link
          to="/providers"
          className="inline-flex items-center gap-2 rounded-lg border border-primary/40 bg-primary/10 px-4 py-2 text-[13px] font-semibold text-primary"
        >
          ← Back to all {PROVIDER_FUNCTIONS.length} functions
        </Link>
      </div>
    </PageShell>
  );
}
