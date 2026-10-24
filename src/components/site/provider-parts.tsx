import { useState, type ReactNode } from "react";
import { Card, Tag } from "@/components/site/ui";
import { inlineMarkdown } from "@/lib/inline-markdown";
import { endpointUrl, type Endpoint } from "@/lib/providers/endpoints";
import type { Integration } from "@/lib/providers/integrations";

/** Pieces shared by the provider hub and the per-function pages.
 *
 *  The hub links to a page per function, and that page renders the same
 *  endpoint contract or the same integration steps the hub summarises. Keeping
 *  one renderer means a change to an endpoint's fields shows up in both places
 *  at once, and the detail page can never drift from the catalogue it came
 *  from. */

export function CopyButton({ text, label }: { text: string; label: string }) {
  const [state, setState] = useState<"idle" | "done" | "failed">("idle");

  const copy = async () => {
    // The async Clipboard API needs a secure context and a permission that can
    // be refused, so a bare `navigator.clipboard?.writeText` can do nothing and
    // still look like it worked. The textarea fallback is what makes this a
    // genuine one-click copy: it either puts the text on the clipboard or says
    // so, instead of flashing "copied" over an empty clipboard.
    try {
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(text);
      } else {
        throw new Error("no clipboard API");
      }
      setState("done");
    } catch {
      try {
        const area = document.createElement("textarea");
        area.value = text;
        area.setAttribute("readonly", "");
        area.style.position = "fixed";
        area.style.opacity = "0";
        document.body.appendChild(area);
        area.select();
        const ok = document.execCommand("copy");
        document.body.removeChild(area);
        setState(ok ? "done" : "failed");
      } catch {
        setState("failed");
      }
    }
    window.setTimeout(() => setState("idle"), 1400);
  };

  return (
    <button
      type="button"
      onClick={() => void copy()}
      title={state === "failed" ? "Copy failed — select the text instead" : "Copy to clipboard"}
      className="rounded-md px-2 py-1 text-[11px] font-semibold text-muted-foreground transition-colors hover:bg-foreground/6 hover:text-foreground"
    >
      {state === "done" ? "copied" : state === "failed" ? "copy failed" : label}
    </button>
  );
}

export function MethodTag({ endpoint }: { endpoint: Endpoint }) {
  return <Tag tone={endpoint.method === "GET" ? "success" : "primary"}>{endpoint.method}</Tag>;
}

/** One labelled code block with its own copy button. */
export function Snippet({
  label,
  lang,
  code,
}: {
  label: string;
  lang: string;
  code: string;
}) {
  return (
    <div>
      <div className="flex items-center gap-2">
        <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
          {label}
        </span>
        <span className="text-[10px] uppercase tracking-wider text-muted-foreground/70">{lang}</span>
        <CopyButton text={code} label="copy code" />
      </div>
      <pre className="mt-1.5 overflow-x-auto rounded-lg bg-foreground/5 px-4 py-3 text-[12px] leading-relaxed text-foreground">
        <code>{code}</code>
      </pre>
    </div>
  );
}

/** A value the caller types into some other app's form. */
export function FieldRow({
  label,
  value,
  note,
}: {
  label: string;
  value: string;
  note?: string;
}) {
  return (
    <div className="border-b border-border/60 py-2.5 last:border-0">
      <div className="flex items-center justify-between gap-3">
        <span className="text-[12px] font-semibold text-foreground">{label}</span>
        <CopyButton text={value} label="copy" />
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

/** The whole contract of one endpoint: URL, job, response, fields and code.
 *
 *  Every snippet is in the DOM. The first is shown and the rest are folded into
 *  a `<details>` — folded, not hidden, so a reader that is an AI agent fetching
 *  this page finds the whole contract in the HTML rather than only the part a
 *  human happened to have expanded. */
export function EndpointBody({ endpoint }: { endpoint: Endpoint }) {
  const url = endpointUrl(endpoint);
  const [primary, ...extra] = endpoint.snippets ?? [];

  return (
    <>
      <div className="flex flex-wrap items-center gap-2">
        <MethodTag endpoint={endpoint} />
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

      {primary && <Snippet label={primary.label} lang={primary.lang} code={primary.code} />}

      {extra.length > 0 && (
        <details className="mt-2">
          <summary className="cursor-pointer text-[12px] font-semibold text-primary">
            {extra.length} more example{extra.length > 1 ? "s" : ""}
          </summary>
          <div className="mt-3 space-y-3">
            {extra.map((s) => (
              <Snippet key={s.label} label={s.label} lang={s.lang} code={s.code} />
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

/** One host application, and how to point it here.
 *
 *  `open` shows the detail without a click, which is what a dedicated page
 *  wants; the hub leaves it folded. A folded `<details>` still keeps its
 *  contents in the HTML, so a search or fetch tool that reads the page receives
 *  every field, every step and every snippet either way. */
export function IntegrationCard({
  integration,
  open = false,
  actions,
}: {
  integration: Integration;
  open?: boolean;
  actions?: ReactNode;
}) {
  const hasDetail = Boolean(
    integration.fields?.length || integration.steps?.length || integration.snippets?.length,
  );

  const detail = (
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
          {/* The number comes from this list, not from the text: an earlier
              version rendered both, so every step read "1. 1." */}
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
            <li key={n} className="flex gap-2 text-[12px] leading-relaxed text-muted-foreground">
              <span className="text-primary">•</span>
              <span>{inlineMarkdown(n)}</span>
            </li>
          ))}
        </ul>
      ) : null}

      {integration.download ? (
        <a
          href={integration.download.href}
          className="inline-flex items-center gap-2 rounded-lg border border-primary/40 bg-primary/10 px-3 py-1.5 text-[12px] font-semibold text-primary transition-colors hover:bg-primary/15"
        >
          Download {integration.download.label}
        </a>
      ) : null}
    </div>
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
        open ? (
          detail
        ) : (
          <details className="mt-4">
            <summary className="cursor-pointer list-none text-[12px] font-semibold text-primary">
              How to connect
            </summary>
            {detail}
          </details>
        )
      ) : null}

      {actions ? <div className="mt-4 flex flex-wrap gap-2">{actions}</div> : null}
    </Card>
  );
}
