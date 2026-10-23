import { Link } from "@tanstack/react-router";
import { Card, Section, Tag } from "@/components/site/ui";
import { inlineMarkdown } from "@/lib/inline-markdown";
import { API_ORIGIN, V1_BASE_URL } from "@/lib/providers/integrations";
import { ENDPOINTS, ENDPOINT_STATS, endpointUrl, type Endpoint } from "@/lib/providers/endpoints";
import {
  PROVIDER_FUNCTIONS,
  PROVIDER_FUNCTION_GROUPS,
  PROVIDER_FUNCTION_STATS,
  providerFunctionsIn,
  type ProviderFunction,
} from "@/lib/providers/functions";
import { CopyButton, EndpointBody, MethodTag } from "./provider-parts";

/** The provider hub.
 *
 *  One base URL, but not one thing: chat, the model line, media, tools, errors,
 *  speech out, speech in, and a dozen host apps. Each of those is a *function*,
 *  and a reader arrives wanting one — so they are cards, one per function, each
 *  linking to its own page. Nothing is hidden behind a tab: a reader who clicks
 *  nothing still sees every function the provider has, and an AI agent fetching
 *  this page gets the whole map.
 *
 *  The full endpoint catalogue follows underneath, because the functions link to
 *  it and a caller reading this page should be able to copy any URL without a
 *  second click. */

function FunctionCard({ fn }: { fn: ProviderFunction }) {
  const endpoints = (fn.endpoints ?? [])
    .map((id) => ENDPOINTS.find((e) => e.id === id))
    .filter((e): e is Endpoint => Boolean(e));

  return (
    <Card hover className="flex flex-col p-5">
      <Link
        to="/providers/$slug"
        params={{ slug: fn.slug }}
        className="group flex items-start gap-3"
      >
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-primary/12 text-[16px] text-primary">
          {fn.glyph}
        </span>
        <span className="min-w-0">
          <span className="block text-[15px] font-bold tracking-tight text-foreground group-hover:text-primary">
            {fn.name}
          </span>
          <span className="mt-0.5 block text-[12px] font-semibold text-primary">{fn.tagline}</span>
        </span>
      </Link>

      <p className="mt-3 text-[12.5px] leading-relaxed text-muted-foreground">
        {inlineMarkdown(fn.summary)}
      </p>

      {fn.tags?.length ? (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {fn.tags.map((t) => (
            <Tag key={t}>{t}</Tag>
          ))}
        </div>
      ) : null}

      {endpoints.length > 0 && (
        <div className="mt-4 space-y-1 border-t border-border/60 pt-3">
          {endpoints.map((e) => (
            <div key={e.id} className="flex items-center gap-2">
              <MethodTag endpoint={e} />
              <code className="truncate text-[11.5px] text-muted-foreground">{e.path}</code>
            </div>
          ))}
        </div>
      )}

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <Link
          to="/providers/$slug"
          params={{ slug: fn.slug }}
          className="text-[12px] font-semibold text-primary"
        >
          Open {fn.name} →
        </Link>
        {fn.docSlug && (
          <a
            href={`/docs/${fn.docSlug}`}
            className="text-[12px] font-semibold text-muted-foreground"
          >
            Read the guide
          </a>
        )}
      </div>
    </Card>
  );
}

/** A featured function, given a wider card and the endpoint contract inline. */
function FeaturedFunction({ fn }: { fn: ProviderFunction }) {
  const endpoint = ENDPOINTS.find((e) => e.id === fn.endpoints?.[0]);
  return (
    <Card className="overflow-hidden p-0">
      <div className="flex flex-wrap items-center gap-2 border-b border-border/60 px-5 py-3">
        <span className="grid h-6 w-6 place-items-center rounded-full bg-primary/12 text-[12px] text-primary">
          {fn.glyph}
        </span>
        <span className="text-[13px] font-semibold text-foreground">{fn.name}</span>
        <span className="text-[12px] text-muted-foreground">{fn.tagline}</span>
        <Link
          to="/providers/$slug"
          params={{ slug: fn.slug }}
          className="ml-auto text-[12px] font-semibold text-primary"
        >
          Open →
        </Link>
      </div>
      <div className="px-5 py-4">
        <p className="text-[13px] leading-relaxed text-muted-foreground">
          {inlineMarkdown(fn.summary)}
        </p>
        {endpoint && (
          <div className="mt-4 border-t border-border/60 pt-4">
            <EndpointBody endpoint={endpoint} />
          </div>
        )}
      </div>
    </Card>
  );
}

/** The endpoints that are real and documented but read once rather than called
 *  in a loop, kept compact so the functions above stay the focus. */
function SecondaryEndpoint({ endpoint }: { endpoint: Endpoint }) {
  return (
    <Card className="p-4">
      <div className="flex flex-wrap items-center gap-2">
        <MethodTag endpoint={endpoint} />
        <span className="text-[12.5px] font-semibold text-foreground">{endpoint.name}</span>
      </div>
      <code className="mt-2 block break-all text-[11.5px] text-muted-foreground">
        {endpoint.path}
      </code>
      <p className="mt-2 text-[12px] leading-relaxed text-muted-foreground">
        {inlineMarkdown(endpoint.blurb)}
      </p>
      <details className="mt-2">
        <summary className="cursor-pointer text-[11.5px] font-semibold text-primary">
          Fields and example
        </summary>
        <div className="mt-2">
          <EndpointBody endpoint={endpoint} />
        </div>
      </details>
    </Card>
  );
}

export function ProviderFunctions() {
  const featured = PROVIDER_FUNCTIONS.filter((f) => f.featured);

  return (
    <Section
      id="functions"
      label="The functions"
      title={`${PROVIDER_FUNCTION_STATS.total} functions, one base URL`}
      description="Each of these is a page of its own. Open one to see just that function — its endpoint, its fields, its code — instead of a wall of prose that mentions everything."
    >
      <Card className="mb-6 p-5">
        <div className="flex flex-wrap items-center gap-3">
          <div className="min-w-0 flex-1">
            <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-muted-foreground">
              Base URL
            </p>
            <code className="mt-1 block break-all text-[13px] font-semibold text-foreground">
              {V1_BASE_URL}
            </code>
          </div>
          <div className="flex flex-wrap gap-2">
            <CopyButton text={V1_BASE_URL} label="copy base URL" />
            <CopyButton text={`${V1_BASE_URL}/models`} label="copy models URL" />
            <CopyButton text={`${API_ORIGIN}/api/public/stt`} label="copy speech URL" />
          </div>
        </div>
      </Card>

      <div className="grid gap-4">
        {featured.map((fn) => (
          <FeaturedFunction key={fn.slug} fn={fn} />
        ))}
      </div>

      {PROVIDER_FUNCTION_GROUPS.map((group) => {
        const items = providerFunctionsIn(group).filter((f) => !f.featured);
        if (!items.length) return null;
        return (
          <div key={group} className="mt-8">
            <div className="mb-3 flex items-center gap-3">
              <span className="text-[11px] font-bold uppercase tracking-[0.22em] text-primary">
                {group}
              </span>
              <span className="text-[11px] text-muted-foreground">{items.length}</span>
              <span className="h-px flex-1 bg-gradient-to-r from-border to-transparent" />
            </div>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {items.map((fn) => (
                <FunctionCard key={fn.slug} fn={fn} />
              ))}
            </div>
          </div>
        );
      })}
    </Section>
  );
}

/** Every endpoint the provider serves, in one place.
 *
 *  This is the single place the API surface is described. Before it, chat lived
 *  in the quickstart, speech lived at the bottom of the page, and the provider
 *  and integration URLs were mentioned in passing — so the page read as though
 *  they were different products. Now they are one catalogue, ordered by what the
 *  caller is doing, and all of it is in the HTML so a search tool or a coding
 *  assistant that fetches this page gets the complete contract. */
export function ProviderEndpointCatalogue() {
  const featured = ENDPOINTS.filter((e) => e.featured);
  const secondary = ENDPOINTS.filter((e) => !e.featured);

  return (
    <Section
      id="endpoints"
      label="The catalogue"
      title="Every endpoint, in one list"
      description={`${ENDPOINT_STATS.total} endpoints, none needing a key of any kind. The functions above each link to the ones they use; this is the whole surface for a reader who wants to see it at once.`}
    >
      <Card className="mb-5 p-5">
        <p className="text-[12px] leading-relaxed text-muted-foreground">
          Every endpoint below is public and needs no key. An agent that would rather read data than
          a page can fetch the whole catalogue from{" "}
          <a
            href={`${V1_BASE_URL}/endpoints`}
            target="_blank"
            rel="noopener noreferrer"
            className="font-semibold text-primary"
          >
            {V1_BASE_URL}/endpoints
          </a>{" "}
          or the plain-text map at{" "}
          <a
            href={`${API_ORIGIN}/llms.txt`}
            target="_blank"
            rel="noopener noreferrer"
            className="font-semibold text-primary"
          >
            /llms.txt
          </a>
          .
        </p>
      </Card>

      <div className="grid gap-4">
        {featured.map((endpoint) => (
          <Card key={endpoint.id} className="overflow-hidden p-0">
            <div className="flex flex-wrap items-center gap-2 border-b border-border/60 px-5 py-3">
              <MethodTag endpoint={endpoint} />
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

      <h3 className="mt-8 text-[13px] font-bold uppercase tracking-[0.18em] text-muted-foreground">
        Also available
      </h3>
      <div className="mt-3 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {secondary.map((endpoint) => (
          <SecondaryEndpoint key={endpoint.id} endpoint={endpoint} />
        ))}
      </div>
    </Section>
  );
}

export { endpointUrl };
