import { useState } from "react";
import { Button, ButtonAnchor, Card, Section, Tag } from "@/components/site/ui";
import { inlineMarkdown } from "@/lib/inline-markdown";
import {
  DEFAULT_MODEL,
  INTEGRATIONS_URL,
  ANY_API_KEY,
  V1_BASE_URL,
  integrationsByCategory,
  type Integration,
} from "@/lib/providers/integrations";

/** A value the user types into some other app's form. Shown as a copyable row,
 *  because these few fields decide whether the connection works — a typo in the
 *  base URL is the whole failure mode. */
function FieldRow({ label, value, note }: { label: string; value: string; note?: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="border-b border-border/60 py-2.5 last:border-0">
      <div className="flex items-center justify-between gap-3">
        <span className="text-[12px] font-semibold text-foreground">{label}</span>
        <button
          type="button"
          onClick={() => {
            void navigator.clipboard?.writeText(value);
            setCopied(true);
            window.setTimeout(() => setCopied(false), 1200);
          }}
          className="shrink-0 rounded-md px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-primary transition-colors hover:bg-primary/10"
        >
          {copied ? "Copied" : "Copy"}
        </button>
      </div>
      <code className="mt-1 block break-all text-[12px] text-primary">{value}</code>
      {note ? (
        <p className="mt-1 text-[11.5px] leading-relaxed text-muted-foreground">
          {inlineMarkdown(note)}
        </p>
      ) : null}
    </div>
  );
}

/** One code block with its own copy button. */
function Snippet({ label, lang, code }: { label: string; lang: string; code: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div>
      <div className="flex items-center gap-2">
        <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
          {label}
        </span>
        <span className="text-[10px] uppercase tracking-wider text-muted-foreground/70">
          {lang}
        </span>
        <button
          type="button"
          onClick={() => {
            void navigator.clipboard?.writeText(code);
            setCopied(true);
            window.setTimeout(() => setCopied(false), 1200);
          }}
          className="ml-auto rounded-md px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-primary transition-colors hover:bg-primary/10"
        >
          {copied ? "Copied" : "Copy"}
        </button>
      </div>
      <pre className="mt-1 overflow-x-auto rounded-lg bg-foreground/5 px-4 py-3 text-[12px] leading-relaxed text-foreground">
        <code>{code}</code>
      </pre>
    </div>
  );
}

/** One host application, and how to point it here.
 *
 *  The detail is a `<details>` rather than a state toggle on purpose: a collapsed
 *  `<details>` still keeps its contents in the HTML, so a search or fetch tool
 *  that reads this page receives every field, every step and every snippet. A
 *  `useState` toggle would have put them out of reach of exactly the reader the
 *  page is meant to serve. */
function IntegrationCard({ integration }: { integration: Integration }) {
  const hasDetail = Boolean(
    integration.fields?.length || integration.steps?.length || integration.snippets?.length,
  );

  return (
    <Card className="flex flex-col p-5">
      <h3 className="text-[15px] font-bold tracking-tight text-foreground">{integration.name}</h3>
      <p className="mt-1 text-[12.5px] leading-relaxed text-muted-foreground">
        {inlineMarkdown(integration.blurb)}
      </p>

      {integration.tags?.length ? (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {integration.tags.map((t) => (
            <Tag key={t}>{t}</Tag>
          ))}
        </div>
      ) : null}

      {hasDetail ? (
        <details className="mt-4">
          <summary className="cursor-pointer list-none text-[12px] font-semibold text-primary">
            How to connect
          </summary>
          <div className="mt-3 space-y-4">
            {integration.fields?.length ? (
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-muted-foreground">
                  Connection fields
                </p>
                <div className="mt-1.5">
                  {integration.fields.map((f) => (
                    <FieldRow key={f.label} label={f.label} value={f.value} note={f.note} />
                  ))}
                </div>
              </div>
            ) : null}

            {integration.steps?.length ? (
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-muted-foreground">
                  Steps
                </p>
                {/* The number comes from this list, not from the text: an
                    earlier version rendered both, so every step read "1. 1." */}
                <ol className="mt-2 list-decimal space-y-1.5 pl-5">
                  {integration.steps.map((s) => (
                    <li
                      key={s}
                      className="text-[12.5px] leading-relaxed text-muted-foreground marker:font-mono marker:text-[11px] marker:font-bold marker:text-primary"
                    >
                      {inlineMarkdown(s)}
                    </li>
                  ))}
                </ol>
              </div>
            ) : null}

            {integration.snippets?.length ? (
              <div className="space-y-3">
                <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-muted-foreground">
                  Code
                </p>
                {integration.snippets.map((s, i) => (
                  <Snippet key={`${s.label}-${i}`} label={s.label} lang={s.lang} code={s.code} />
                ))}
              </div>
            ) : null}

            {integration.notes?.length ? (
              <ul className="space-y-1.5">
                {integration.notes.map((n) => (
                  <li
                    key={n}
                    className="flex gap-2 text-[12px] leading-relaxed text-muted-foreground"
                  >
                    <span className="text-primary">•</span>
                    <span>{inlineMarkdown(n)}</span>
                  </li>
                ))}
              </ul>
            ) : null}

            {integration.download ? (
              <ButtonAnchor
                href={integration.download.href}
                external={false}
                size="sm"
                variant="glass"
              >
                Download {integration.download.label}
              </ButtonAnchor>
            ) : null}
          </div>
        </details>
      ) : null}
    </Card>
  );
}

/** The "use it from anywhere" half of the provider page.
 *
 *  Rendered from the same catalogue the docs and `GET /v1/integrations` serve, so
 *  the fields shown here are the fields the endpoint publishes. Grouped by what
 *  the application is, because that is how someone looks for their own: a
 *  terminal, an editor, an agent, an SDK. */
export function ProviderIntegrations() {
  const groups = integrationsByCategory();

  return (
    <Section
      id="integrations"
      label="Anywhere"
      title="Use it from anything"
      description={`Termux on a phone, OpenHands, an editor, a mobile app, an SDK, a workflow runner — they all connect the same way. Base URL ${V1_BASE_URL}, model ${DEFAULT_MODEL}, any non-empty API key.`}
    >
      <Card className="mb-5 p-5">
        <div className="grid gap-4 sm:grid-cols-3">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-muted-foreground">
              Base URL
            </p>
            <code className="mt-1 block break-all text-[12px] text-primary">{V1_BASE_URL}</code>
          </div>
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-muted-foreground">
              Default model
            </p>
            <code className="mt-1 block break-all text-[12px] text-primary">{DEFAULT_MODEL}</code>
          </div>
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-muted-foreground">
              API key
            </p>
            <code className="mt-1 block break-all text-[12px] text-primary">{ANY_API_KEY}</code>
          </div>
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          <Button size="sm" onClick={() => navigator.clipboard?.writeText(V1_BASE_URL)}>
            Copy base URL
          </Button>
          <ButtonAnchor
            href="/docs/provider-integrations"
            external={false}
            size="sm"
            variant="glass"
          >
            Read the integration guide
          </ButtonAnchor>
          <ButtonAnchor href={INTEGRATIONS_URL} size="sm" variant="glass">
            Machine-readable catalogue
          </ButtonAnchor>
        </div>
      </Card>

      {groups.map(({ category, items }) => (
        <div key={category} className="mb-8 last:mb-0">
          <div className="mb-3 flex items-center gap-3">
            <span className="text-[11px] font-bold uppercase tracking-[0.22em] text-primary">
              {category}
            </span>
            <span className="text-[11px] text-muted-foreground">{items.length}</span>
            <span className="h-px flex-1 bg-gradient-to-r from-border to-transparent" />
          </div>
          <div className="grid gap-4 lg:grid-cols-2">
            {items.map((i) => (
              <IntegrationCard key={i.id} integration={i} />
            ))}
          </div>
        </div>
      ))}
    </Section>
  );
}
