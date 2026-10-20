import { useState, type ReactNode } from "react";

/** A very small Markdown renderer for the assistant's replies.
 *
 *  It exists so a reply can contain what a real answer needs: fenced code with
 *  a copy button, inline code, bold, and — most importantly — links that are
 *  actually clickable. A chat panel that prints URLs as dead text is useless
 *  for a product whose answers are mostly "go here and run this".
 *
 *  It is deliberately not a full parser. It handles exactly the constructs the
 *  helper is asked to produce, and anything else is shown verbatim rather than
 *  being mangled. */

type Block =
  { kind: "code"; lang: string; label: string; code: string } | { kind: "text"; lines: string[] };

/** Split a reply into fenced code blocks and prose. */
function splitBlocks(source: string): Block[] {
  const lines = source.split("\n");
  const blocks: Block[] = [];
  let prose: string[] = [];
  let i = 0;

  const flushProse = () => {
    if (prose.length) blocks.push({ kind: "text", lines: prose });
    prose = [];
  };

  while (i < lines.length) {
    const fence = lines[i].match(/^\s*```([^\s`]*)\s*(.*)$/);
    if (!fence) {
      prose.push(lines[i]);
      i++;
      continue;
    }
    flushProse();
    // The info line is `lang` optionally followed by a label, which the helper
    // is told to use for a file name: ```python file:app.py.
    const lang = (fence[1] || "").toLowerCase();
    const label = (fence[2] || "").trim();
    const body: string[] = [];
    i++;
    while (i < lines.length && !/^\s*```\s*$/.test(lines[i])) {
      body.push(lines[i]);
      i++;
    }
    i++; // skip the closing fence
    blocks.push({ kind: "code", lang, label, code: body.join("\n") });
  }
  flushProse();
  return blocks;
}

/** Render inline Markdown: bold, inline code, and links.
 *
 *  Links are the point: `[text](url)` becomes an anchor, and a bare URL or a
 *  site path becomes one too, so a visitor can click straight through. */
function inline(text: string, keyBase: string): ReactNode[] {
  const out: ReactNode[] = [];
  const pattern =
    /(\*\*[^*]+\*\*|`[^`]+`|\[[^\]]+\]\([^)]+\)|https?:\/\/[^\s<>()]+|\/(?:docs|providers|apps|packages|extensions|releases|demo|faq|builder|bludar|nebula|publish|updates|community-art|download|zsl|privacy-policy|desktop-feedback)[A-Za-z0-9\-_/]*)/g;
  let last = 0;
  let m: RegExpExecArray | null;
  let k = 0;

  const anchor = (href: string, label: string) => {
    const external = /^https?:\/\//.test(href);
    return (
      <a
        key={`${keyBase}-a${k++}`}
        href={href}
        {...(external ? { target: "_blank", rel: "noopener noreferrer" } : {})}
        className="break-all font-medium text-primary underline decoration-primary/40 underline-offset-2 hover:decoration-primary"
      >
        {label}
      </a>
    );
  };

  while ((m = pattern.exec(text))) {
    if (m.index > last) out.push(text.slice(last, m.index));
    const tok = m[0];
    if (tok.startsWith("**")) {
      // Recurse, because a model naturally writes a link inside bold —
      // `**[label](url)**` — and treating the whole run as plain bold would
      // swallow the link and leave it unclickable.
      out.push(
        <strong key={`${keyBase}-s${k++}`} className="font-semibold text-foreground">
          {inline(tok.slice(2, -2), `${keyBase}-s${k}`)}
        </strong>,
      );
    } else if (tok.startsWith("`")) {
      out.push(
        <code
          key={`${keyBase}-c${k++}`}
          className="rounded bg-foreground/10 px-1 py-0.5 font-mono text-[0.85em] text-foreground"
        >
          {tok.slice(1, -1)}
        </code>,
      );
    } else if (tok.startsWith("[")) {
      const mm = tok.match(/^\[([^\]]+)\]\(([^)]+)\)$/);
      if (mm) out.push(anchor(mm[2], mm[1]));
      else out.push(tok);
    } else {
      out.push(anchor(tok, tok));
    }
    last = m.index + tok.length;
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
}

/** Prose, with headings, list items and paragraphs given a little structure. */
function Prose({ lines, keyBase }: { lines: string[]; keyBase: string }) {
  const nodes: ReactNode[] = [];
  let list: string[] = [];

  const flushList = () => {
    if (!list.length) return;
    nodes.push(
      <ul key={`${keyBase}-ul${nodes.length}`} className="my-1.5 space-y-1 pl-1">
        {list.map((item, idx) => (
          <li key={idx} className="flex gap-2">
            <span className="text-primary">•</span>
            <span>{inline(item, `${keyBase}-li${idx}`)}</span>
          </li>
        ))}
      </ul>,
    );
    list = [];
  };

  lines.forEach((line, idx) => {
    const trimmed = line.trim();
    const bullet = trimmed.match(/^[-*]\s+(.*)$/);
    const heading = trimmed.match(/^(#{1,4})\s+(.*)$/);
    const numbered = trimmed.match(/^(\d+)[.)]\s+(.*)$/);

    if (bullet) {
      list.push(bullet[1]);
      return;
    }
    flushList();

    if (heading) {
      nodes.push(
        <p key={`${keyBase}-h${idx}`} className="mt-2 mb-1 font-semibold text-foreground">
          {inline(heading[2], `${keyBase}-h${idx}`)}
        </p>,
      );
      return;
    }
    if (numbered) {
      nodes.push(
        <p key={`${keyBase}-n${idx}`} className="flex gap-2">
          <span className="font-mono text-[0.85em] font-bold text-primary">{numbered[1]}.</span>
          <span>{inline(numbered[2], `${keyBase}-n${idx}`)}</span>
        </p>,
      );
      return;
    }
    if (!trimmed) {
      nodes.push(<div key={`${keyBase}-sp${idx}`} className="h-1.5" />);
      return;
    }
    nodes.push(<p key={`${keyBase}-p${idx}`}>{inline(line, `${keyBase}-p${idx}`)}</p>);
  });
  flushList();
  return <>{nodes}</>;
}

/** A code block with a language label and a copy button. */
function CodeBlock({ lang, label, code }: { lang: string; label: string; code: string }) {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    navigator.clipboard?.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 1200);
  };
  return (
    <div className="my-2 overflow-hidden rounded-xl border border-border/60 bg-foreground/5">
      <div className="flex items-center justify-between gap-2 border-b border-border/60 px-3 py-1.5">
        <span className="truncate font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
          {label || lang || "code"}
        </span>
        <button
          type="button"
          onClick={copy}
          className="shrink-0 rounded px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-primary transition-colors hover:bg-primary/10"
        >
          {copied ? "Copied" : "Copy"}
        </button>
      </div>
      <pre className="max-h-80 overflow-auto px-3 py-2.5 text-[12px] leading-relaxed text-foreground">
        <code>{code}</code>
      </pre>
    </div>
  );
}

/** Render one assistant reply. */
export default function Markdown({ text }: { text: string }) {
  const blocks = splitBlocks(text);
  return (
    <div className="space-y-0.5">
      {blocks.map((b, i) =>
        b.kind === "code" ? (
          <CodeBlock key={`code-${i}`} lang={b.lang} label={b.label} code={b.code} />
        ) : (
          <Prose key={`text-${i}`} lines={b.lines} keyBase={`t${i}`} />
        ),
      )}
    </div>
  );
}
