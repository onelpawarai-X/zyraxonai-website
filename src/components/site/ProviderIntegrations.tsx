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

/** One value the user has to type into some other app's form. Rendered as a
 *  copyable row, because these are the four fields that decide whether the
 *  connection works — a typo in the base URL is the whole failure mode. */
function FieldRow({ label, value, note }: { label: string; value: string; note?: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="border-b border-border/60 py-2.5 last:border-0">
      <div className="flex items-center justify-between gap-3">
        <span className="text-[12px] font-semibold text-foreground">{label}</span>
        <button
          type="button"
          onClick={() => {
            navigator.clipboard?.writeText(value);
            setCopied(true);
            setTimeout(() => setCopied(false), 1200);
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

function SnippetTabs({ snippets }: { snippets: NonNullable<Integration["snippets"]> }) {
  const [active, setActive] = useState(0);
  const current = snippets[Math.min(active, snippets.length - 1)]!;
  return (
    <div className="overflow-hidden rounded-xl border border-border/60">
      <div className="flex flex-wrap items-center gap-1 border-b border-border/60 px-2 py-1.5">
        {snippets.map((s, i) => (
          <button
            key={`${s.label}-${i}`}
            type="button"
            onClick={() => setActive(i)}
            className={`rounded-md px-2.5 py-1 text-[11.5px] font-semibold transition-colors ${
              i === active
                ? "bg-primary/12 text-primary"
                : "text-muted-foreground hover:bg-foreground/5 hover:text-foreground"
            }`}
          >
            {s.label}
          </button>
        ))}
        <span className="ml-auto pr-1 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
          {current.lang}
        </span>
      </div>
      <pre className="max-h-96 overflow-auto px-4 py-3 text-[12px] leading-relaxed text-foreground">
        <code>{current.code}</code>
      </pre>
    </div>
  );
}

function IntegrationCard({ integration }: { integration: Integration }) {
  const [open, setOpen] = useState(false);
  const hasDetail = Boolean(
    integration.fields?.length || integration.steps?.length || integration.snippets?.length,
  );

  return (
    <Card className="flex flex-col p-5">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h3 className="text-[15px] font-bold tracking-tight text-foreground">
            {integration.name}
          </h3>
          <p className="mt-1 text-[12.5px] leading-relaxed text-muted-foreground">
            {inlineMarkdown(integration.blurb)}
          </p>
        </div>
      </div>

      {integration.tags?.length ? (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {integration.tags.map((t) => (
            <Tag key={t}>{t}</Tag>
          ))}
        </div>
      ) : null}

      {hasDetail ? (
        <>
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            aria-expanded={open}
            className="mt-4 flex items-center gap-1.5 self-start rounded-lg px-2.5 py-1 text-[12px] font-semibold text-primary transition-colors hover:bg-primary/10"
          >
            {open ? "Hide" : "Connect"}
            <svg
              width="12"
              height="12"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.4"
              className={`transition-transform ${open ? "rotate-180" : ""}`}
            >
              <path d="M6 9l6 6 6-6" />
            </svg>
          </button>

          {open ? (
            <div className="mt-4 space-y-4">
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
                <div>
                  <p className="mb-1.5 text-[10px] font-bold uppercase tracking-[0.18em] text-muted-foreground">
                    Code
                  </p>
                  <SnippetTabs snippets={integration.snippets} />
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
          ) : null}
        </>
      ) : null}
    </Card>
  );
}

/** The "use it from anywhere" section of the provider page.
 *
 *  Rendered from the same catalogue the docs and `GET /v1/integrations` serve,
 *  so the fields shown here are the fields the endpoint publishes. */
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
