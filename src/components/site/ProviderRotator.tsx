import { useState } from "react";
import { Card, Section, Tag } from "@/components/site/ui";
import { inlineMarkdown } from "@/lib/inline-markdown";
import { API_ORIGIN, V1_BASE_URL } from "@/lib/providers/integrations";
import { ENDPOINTS, ENDPOINT_STATS, endpointUrl, type Endpoint } from "@/lib/providers/endpoints";

/** Everything needed to describe one endpoint is in the catalogue. This file
 *  only decides how it looks. */

function MethodTag({ endpoint }: { endpoint: Endpoint }) {
  return <Tag tone={endpoint.method === "GET" ? "success" : "primary"}>{endpoint.method}</Tag>;
}

function CopyButton({ text, label }: { text: string; label: string }) {
  const [done, setDone] = useState(false);
  return (
    <button
      type="button"
      onClick={() => {
        void navigator.clipboard?.writeText(text);
        setDone(true);
        window.setTimeout(() => setDone(false), 1400);
      }}
      className="rounded-md px-2 py-1 text-[11px] font-semibold text-muted-foreground transition-colors hover:bg-foreground/6 hover:text-foreground"
    >
      {done ? "copied" : label}
    </button>
  );
}

/** The URL, the one-line job, what comes back, and the code to call it.
 *
 *  Every snippet is in the DOM. The first is shown and the rest are folded into
 *  a `<details>` — folded, not hidden, so a reader that is an AI agent fetching
 *  this page finds the whole contract in the HTML rather than only the part a
 *  human happened to have expanded. */
function EndpointBody({ endpoint }: { endpoint: Endpoint }) {
  const url = endpointUrl(endpoint);
  const [primary, ...extra] = endpoint.snippets ?? [];

  return (
    <>
      <div className="flex flex-wrap items-center gap-2">
        <code className="break-all rounded-lg bg-foreground/5 px-2.5 py-1.5 text-[12px] text-foreground">
          {url}
        </code>
        <CopyButton text={url} label="copy URL" />
      </div>

      <p className="mt-3 text-[13px] leading-relaxed text-muted-foreground">
        {inlineMarkdown(endpoint.blurb)}
      </p>

      <p className="mt-2 text-[12.5px] leading-relaxed text-muted-foreground">
        <span className="font-semibold text-foreground">Returns </span>
        {inlineMarkdown(endpoint.returns)}
      </p>

      {endpoint.fields && endpoint.fields.length > 0 && (
        <table className="mt-3 w-full border-collapse text-left text-[12px]">
          <thead>
            <tr className="text-muted-foreground">
              <th className="py-1.5 pr-3 font-semibold">Field</th>
              <th className="py-1.5 pr-3 font-semibold">Required</th>
              <th className="py-1.5 font-semibold">What it does</th>
            </tr>
          </thead>
          <tbody>
            {endpoint.fields.map((f) => (
              <tr key={f.name} className="border-t border-border/40 align-top">
                <td className="py-1.5 pr-3">
                  <code className="text-foreground">{f.name}</code>
                </td>
                <td className="py-1.5 pr-3 text-muted-foreground">{f.required ? "yes" : "no"}</td>
                <td className="py-1.5 text-muted-foreground">{inlineMarkdown(f.note)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {primary && (
        <div className="mt-3">
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
              {primary.label}
            </span>
            <CopyButton text={primary.code} label="copy code" />
          </div>
          <pre className="mt-1.5 overflow-x-auto rounded-lg bg-foreground/5 px-4 py-3 text-[12px] leading-relaxed text-foreground">
            <code>{primary.code}</code>
          </pre>
        </div>
      )}

      {extra.length > 0 && (
        <details className="mt-2">
          <summary className="cursor-pointer text-[12px] font-semibold text-primary">
            {extra.length} more example{extra.length > 1 ? "s" : ""}
          </summary>
          <div className="mt-2 space-y-3">
            {extra.map((s) => (
              <div key={s.label}>
                <div className="flex items-center gap-2">
                  <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                    {s.label}
                  </span>
                  <CopyButton text={s.code} label="copy code" />
                </div>
                <pre className="mt-1.5 overflow-x-auto rounded-lg bg-foreground/5 px-4 py-3 text-[12px] leading-relaxed text-foreground">
                  <code>{s.code}</code>
                </pre>
              </div>
            ))}
          </div>
        </details>
      )}

      {endpoint.notes && endpoint.notes.length > 0 && (
        <ul className="mt-3 space-y-1.5">
          {endpoint.notes.map((n) => (
            <li key={n} className="flex gap-2 text-[12px] leading-relaxed text-muted-foreground">
              <span className="mt-[7px] h-1 w-1 shrink-0 rounded-full bg-primary/60" />
              <span>{inlineMarkdown(n)}</span>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}

/** The four endpoints the provider is built around, given room to breathe and
 *  shown first.
 *
 *  A numbered accent rather than a tab strip: the order is the order of a
 *  conversation — ask a model, list the models, hear the answer, speak the
 *  question — and a reader who never clicks anything still sees all four. */
function FeaturedEndpoint({ endpoint, index }: { endpoint: Endpoint; index: number }) {
  return (
    <Card className="overflow-hidden p-0">
      <div className="flex flex-wrap items-center gap-2 border-b border-border/60 px-5 py-3">
        <span className="grid h-6 w-6 place-items-center rounded-full bg-primary/12 text-[12px] font-bold text-primary">
          {index + 1}
        </span>
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
  );
}

/** The endpoints that are real and documented but read once rather than called
 *  in a loop. Kept visibly separate so the four above stay uncluttered. */
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

/** Every endpoint the provider serves, in one place.
 *
 *  This is the single place the API surface is described. Before it, chat lived
 *  in the quickstart, speech lived at the bottom of the page, and the provider
 *  and integration URLs were mentioned in passing — so the page read as though
 *  they were different products. Now they are one catalogue, ordered by what the
 *  caller is doing, and all of it is in the HTML so a search tool or a coding
 *  assistant that fetches this page gets the complete contract. */
export function ProviderRotator() {
  const featured = ENDPOINTS.filter((e) => e.featured);
  const secondary = ENDPOINTS.filter((e) => !e.featured);

  return (
    <Section
      id="endpoints"
      label="The rotator"
      title="Four endpoints, then everything else"
      description={`The provider rotates ten models behind one base URL. These are the calls that do the work — ${ENDPOINT_STATS.total} endpoints in all, none needing a key of any kind.`}
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
          <div className="flex flex-wrap gap-2">
            <CopyButton text={V1_BASE_URL} label="copy base URL" />
            <CopyButton text={`${V1_BASE_URL}/models`} label="copy models URL" />
            <CopyButton text={`${API_ORIGIN}/api/public/stt`} label="copy speech URL" />
          </div>
        </div>

        {/* This page is written to be read by a search or fetch tool as well as a
            person. Saying so explicitly, and naming the plain-text map, is what
            turns "the page happens to be in the HTML" into something an agent
            can find on purpose. */}
        <div className="mt-4 border-t border-border/60 pt-3">
          <p className="text-[12px] leading-relaxed text-muted-foreground">
            Every endpoint below is public and needs no key. An agent that would rather read data
            than a page can fetch the whole catalogue from{" "}
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
            . The speech endpoints are written up in full in the{" "}
            <a href="/docs/speech" className="font-semibold text-primary">
              speech guide
            </a>
            .
          </p>
        </div>
      </Card>

      <div className="grid gap-4">
        {featured.map((endpoint, i) => (
          <FeaturedEndpoint key={endpoint.id} endpoint={endpoint} index={i} />
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
