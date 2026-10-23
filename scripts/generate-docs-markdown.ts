// Render the provider system references to Markdown in `docs/`.
//
// The site renders these pages from `src/lib/docs/provider-system-docs.ts`, and
// a repository reader wants the same thing as a file. Hand-copying it would
// guarantee drift: the endpoint gains a field, the page is updated, the
// Markdown is not. So the Markdown is generated from the same blocks the page
// is, and a change to one is a change to both.
//
// Run: npx tsx --import ./scripts/raw-import-loader.mjs scripts/generate-docs-markdown.ts

import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { DOCS, type DocBlock, type DocPage } from "../src/lib/docs/content";

const ROOT = new URL("../", import.meta.url).pathname;

/** The pages that get a Markdown twin, and the file each is written to. */
const EXPORTS: { slug: string; file: string }[] = [
  { slug: "provider-speech-to-text", file: "provider-speech-to-text.md" },
  { slug: "provider-text-to-speech", file: "provider-text-to-speech.md" },
  { slug: "provider-multimodal", file: "provider-multimodal.md" },
];

/** Inline Markdown in a block is already Markdown — `**bold**`, `` `code` ``,
 *  `[label](/docs/x)` — so a block's text is written through unchanged. The one
 *  exception is a doc link, which is a site path and has to become a real URL
 *  for a reader outside the site. */
const ORIGIN = "https://zyraxonai.lovable.app";
const absolutiseLinks = (s: string) =>
  s.replace(/\]\((\/[^)]*)\)/g, (_, path: string) => `](${ORIGIN}${path})`);

function renderBlock(b: DocBlock): string {
  switch (b.t) {
    case "h2":
      return `## ${b.text}`;
    case "h3":
      return `### ${b.text}`;
    case "p":
      return absolutiseLinks(b.text);
    case "code":
      return ["```" + (b.lang ?? ""), b.code, "```"].join("\n");
    case "list":
      return b.items
        .map((it, i) => `${b.ordered ? `${i + 1}.` : "-"} ${absolutiseLinks(it)}`)
        .join("\n");
    case "table": {
      const head = `| ${b.head.join(" | ")} |`;
      const rule = `| ${b.head.map(() => "---").join(" | ")} |`;
      const rows = b.rows.map((r) => `| ${r.map(absolutiseLinks).join(" | ")} |`);
      return [head, rule, ...rows].join("\n");
    }
    case "note": {
      const label = { info: "Note", warn: "Warning", tip: "Tip", success: "Success" }[b.kind];
      const title = b.title ? `**${b.title}**\n\n` : "";
      const inner = `${label}: ${title}${absolutiseLinks(b.text)}`;
      // Every line of a block quote needs its own `>`, including the blank ones,
      // or the quote ends at the first newline and the rest reads as body text.
      return inner
        .split("\n")
        .map((line) => (line ? `> ${line}` : ">"))
        .join("\n");
    }
  }
}

function renderPage(doc: DocPage): string {
  const front = [
    `# ${doc.title}`,
    "",
    doc.desc,
    "",
    `Group: ${doc.group} · Also published at ${ORIGIN}/docs/${doc.slug}`,
    "",
    "---",
    "",
  ];
  const body = doc.blocks.map(renderBlock).join("\n\n");
  return `${front.join("\n")}${body}\n`;
}

let written = 0;
for (const { slug, file } of EXPORTS) {
  const doc = DOCS.find((d) => d.slug === slug);
  if (!doc) throw new Error(`no doc with slug "${slug}"`);
  writeFileSync(join(ROOT, "docs", file), renderPage(doc));
  written += 1;
  console.log(`docs/${file}  <-  ${slug}`);
}
console.log(`${written} document(s) written`);
