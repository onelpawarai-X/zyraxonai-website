import type { ReactNode } from "react";

/** Render the inline Markdown the docs and the provider page both use:
 *  `**bold**`, `` `code` `` and `[text](href)`.
 *
 *  It lives here rather than in either page because both render the same
 *  catalogue text. When it was only in the docs shell, the provider page
 *  printed `**Custom Model**` and `` `GET /models` `` literally, which is what a
 *  reader sees when the two surfaces disagree about how text is drawn.
 *
 *  Deliberately not a full Markdown parser: the catalogue only ever uses these
 *  three constructs, and a real parser would be a dependency for no gain. */
export function inlineMarkdown(text: string): ReactNode[] {
  const out: ReactNode[] = [];
  const re = /(\*\*[^*]+\*\*|`[^`]+`|\[[^\]]+\]\([^)]+\))/g;
  let last = 0;
  let m: RegExpExecArray | null;
  let k = 0;
  while ((m = re.exec(text))) {
    if (m.index > last) out.push(text.slice(last, m.index));
    const tok = m[0];
    if (tok.startsWith("**")) {
      out.push(
        <strong key={k++} className="font-semibold text-foreground">
          {tok.slice(2, -2)}
        </strong>,
      );
    } else if (tok.startsWith("`")) {
      out.push(
        <code
          key={k++}
          className="rounded bg-foreground/8 px-1.5 py-0.5 font-mono text-[0.85em] text-primary"
        >
          {tok.slice(1, -1)}
        </code>,
      );
    } else {
      const mm = tok.match(/^\[([^\]]+)\]\(([^)]+)\)$/);
      if (mm) {
        out.push(
          <a
            key={k++}
            href={mm[2]}
            target="_top"
            className="text-primary underline decoration-blue-300 underline-offset-4 hover:decoration-blue-500"
          >
            {mm[1]}
          </a>,
        );
      } else {
        out.push(tok);
      }
    }
    last = m.index + tok.length;
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
}
