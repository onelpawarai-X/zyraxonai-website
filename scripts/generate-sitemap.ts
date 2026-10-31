// Build `public/sitemap.xml` from the routes the app actually defines.
//
// Written as a generator rather than a hand-kept list, because a hand-kept list
// is exactly what let five doc pages fall out of the sitemap: every page added
// to `DOCS` since it was last edited was missing. This walks the route files and
// the docs registry, so a new page is in the sitemap the next time it runs.
//
// Page routes are listed for Google. API endpoints are listed too, in a separate
// sitemap, because they are a documented surface of this site — a developer
// looking for the provider endpoint should be able to find it — but they are
// `Disallow`ed in robots.txt for crawling, which is the correct signal: index the
// description, do not spider the endpoint.
//
// Run: npx tsx --import ./scripts/raw-import-loader.mjs scripts/generate-sitemap.ts

import { writeFileSync } from "node:fs";
import { readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { DOCS } from "../src/lib/docs/content";
import { PROVIDER_FUNCTIONS } from "../src/lib/providers/functions";
import { SEO_CURATED_IDS, SEO_ROWS } from "../src/lib/mcp-seo-index.server";

const ORIGIN = "https://zyraxonai.lovable.app";
const ROOT = new URL("../", import.meta.url).pathname;
const TODAY = new Date().toISOString().slice(0, 10);

type Entry = { path: string; changefreq: string; priority: string };

/** Every page route, with the weight it deserves. */
const PAGES: Entry[] = [
  { path: "/", changefreq: "weekly", priority: "1.0" },
  { path: "/apps", changefreq: "weekly", priority: "0.9" },
  { path: "/ecosystem", changefreq: "daily", priority: "0.9" },
  { path: "/providers", changefreq: "weekly", priority: "0.9" },
  { path: "/builder", changefreq: "weekly", priority: "0.9" },
  { path: "/docs", changefreq: "weekly", priority: "0.9" },
  { path: "/packages", changefreq: "weekly", priority: "0.8" },
  { path: "/extensions", changefreq: "weekly", priority: "0.8" },
  { path: "/releases", changefreq: "daily", priority: "0.8" },
  { path: "/demo", changefreq: "weekly", priority: "0.8" },
  { path: "/download/zyraxon-agent", changefreq: "weekly", priority: "0.8" },
  { path: "/community-art", changefreq: "weekly", priority: "0.8" },
  { path: "/updates", changefreq: "daily", priority: "0.8" },
  { path: "/desktop-ai-agent-guide", changefreq: "weekly", priority: "0.9" },
  { path: "/bludar", changefreq: "weekly", priority: "0.7" },
  { path: "/nebula", changefreq: "weekly", priority: "0.7" },
  { path: "/nebula-core", changefreq: "weekly", priority: "0.7" },
  { path: "/publish", changefreq: "monthly", priority: "0.7" },
  { path: "/faq", changefreq: "monthly", priority: "0.7" },
  { path: "/zsl", changefreq: "monthly", priority: "0.7" },
  { path: "/desktop-feedback", changefreq: "monthly", priority: "0.6" },
  { path: "/privacy-policy", changefreq: "monthly", priority: "0.5" },
];

/** API endpoints, as documented surfaces. Kept in their own sitemap. */
const ENDPOINTS: Entry[] = [
  { path: "/api/public/zyraxon/v1/chat/completions", changefreq: "weekly", priority: "0.8" },
  { path: "/api/public/zyraxon/v1/models", changefreq: "weekly", priority: "0.8" },
  { path: "/api/public/zyraxon/v1/provider", changefreq: "weekly", priority: "0.7" },
  { path: "/api/public/zyraxon/v1/integrations", changefreq: "weekly", priority: "0.7" },
  { path: "/api/public/zyraxon/v1/endpoints", changefreq: "weekly", priority: "0.7" },
  { path: "/api/public/tts", changefreq: "weekly", priority: "0.8" },
  { path: "/api/public/tts/voices", changefreq: "weekly", priority: "0.7" },
  { path: "/api/public/stt", changefreq: "weekly", priority: "0.7" },
  { path: "/api/public/zyraxon/helper", changefreq: "weekly", priority: "0.6" },
  { path: "/api/public/zyraxon/search", changefreq: "weekly", priority: "0.5" },
  { path: "/api/public/providers", changefreq: "weekly", priority: "0.5" },
  { path: "/api/public/npm-packages", changefreq: "weekly", priority: "0.5" },
  { path: "/api/public/vscode-marketplace", changefreq: "weekly", priority: "0.5" },
  { path: "/api/public/mcp-registry", changefreq: "weekly", priority: "0.5" },
  { path: "/api/public/community", changefreq: "weekly", priority: "0.5" },
  { path: "/api/public/community-store", changefreq: "weekly", priority: "0.5" },
  { path: "/api/public/community-act", changefreq: "weekly", priority: "0.5" },
  { path: "/api/public/github-releases", changefreq: "daily", priority: "0.5" },
  { path: "/api/public/zyraxon-releases", changefreq: "daily", priority: "0.5" },
  { path: "/api/public/downloads", changefreq: "weekly", priority: "0.5" },
  // The ZyraxonOS image has its own resolver and its own repository, so it has
  // its own contract URL beside the Agent's.
  { path: "/api/public/os", changefreq: "weekly", priority: "0.5" },
  { path: "/api/public/desktop-feedback", changefreq: "monthly", priority: "0.4" },
  { path: "/api/public/site-content", changefreq: "weekly", priority: "0.4" },
  { path: "/api/public/builder/chat", changefreq: "weekly", priority: "0.4" },
  { path: "/api/public/builder/engine", changefreq: "weekly", priority: "0.4" },
  { path: "/api/public/builder/publish", changefreq: "weekly", priority: "0.4" },
  { path: "/api/public/builder/search", changefreq: "weekly", priority: "0.4" },
  { path: "/api/public/builder/sites", changefreq: "weekly", priority: "0.4" },
  { path: "/api/public/builder/powershell", changefreq: "weekly", priority: "0.4" },
  { path: "/api/public/nebula", changefreq: "weekly", priority: "0.4" },
  { path: "/api/public/nebula/search", changefreq: "weekly", priority: "0.4" },
  { path: "/api/public/nebula/download", changefreq: "weekly", priority: "0.4" },
  { path: "/api/public/nebula/generate", changefreq: "weekly", priority: "0.4" },
  { path: "/api/public/shares", changefreq: "weekly", priority: "0.4" },
  { path: "/api/public/github/publish", changefreq: "monthly", priority: "0.3" },
  { path: "/api/public/github-device", changefreq: "monthly", priority: "0.3" },
  { path: "/api/public/auth/github", changefreq: "monthly", priority: "0.3" },
  { path: "/api/public/auth/github/start", changefreq: "monthly", priority: "0.3" },
  { path: "/api/public/auth/github/callback", changefreq: "monthly", priority: "0.3" },
  { path: "/api/public/auth/github/logout", changefreq: "monthly", priority: "0.3" },
  { path: "/api/download", changefreq: "weekly", priority: "0.5" },
  { path: "/api/help-agent", changefreq: "weekly", priority: "0.4" },
  { path: "/api/marketplace-search", changefreq: "weekly", priority: "0.4" },
];

/** Every page route file, so a new one is noticed even if it is not listed. */
function pageRoutesFromDisk(): string[] {
  const dir = join(ROOT, "src/routes");
  const out: string[] = [];
  const walk = (at: string, prefix: string) => {
    for (const name of readdirSync(at)) {
      const full = join(at, name);
      if (statSync(full).isDirectory()) {
        walk(full, `${prefix}/${name}`);
        continue;
      }
      if (!name.endsWith(".tsx") && !name.endsWith(".ts")) continue;
      if (name.startsWith("__") || name.startsWith("_")) continue;
      if (prefix === "/api" || prefix.startsWith("/api/")) continue;
      let route = name.replace(/\.(tsx|ts)$/, "");
      // `index` is the directory itself; `$param` and `{-$param}` are dynamic.
      if (route === "index") route = "";
      if (route.includes("$")) continue; // dynamic: not a single URL
      const path = `${prefix}/${route}`.replace(/\/+/g, "/").replace(/\/$/, "") || "/";
      out.push(path);
    }
  };
  walk(dir, "");
  return out;
}

const xmlEscape = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

function render(entries: Entry[]): string {
  const lines = entries.map(
    (e) =>
      `  <url>\n` +
      `    <loc>${xmlEscape(`${ORIGIN}${e.path}`)}</loc>\n` +
      `    <lastmod>${TODAY}</lastmod>\n` +
      `    <changefreq>${e.changefreq}</changefreq>\n` +
      `    <priority>${e.priority}</priority>\n` +
      `  </url>`,
  );
  return (
    `<?xml version="1.0" encoding="UTF-8"?>\n` +
    `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n` +
    `${lines.join("\n")}\n` +
    `</urlset>\n`
  );
}

// ── assemble ────────────────────────────────────────────────────────────────
const docsEntries: Entry[] = DOCS.map((d) => ({
  path: `/docs/${d.slug}`,
  changefreq: "weekly",
  priority: d.group === "ZYRAXON Provider" ? "0.8" : "0.7",
}));

// One page per provider function. They are generated from the same catalogue the
// hub renders, so a function added to `functions.ts` is in the sitemap on the
// next run rather than when someone remembers to add it.
const functionEntries: Entry[] = PROVIDER_FUNCTIONS.map((f) => ({
  path: `/providers/${f.slug}`,
  changefreq: "weekly",
  priority: "0.7",
}));

const seen = new Set<string>();
const pages: Entry[] = [];
for (const entry of [...PAGES, ...docsEntries, ...functionEntries]) {
  if (seen.has(entry.path)) continue;
  seen.add(entry.path);
  pages.push(entry);
}

// A route file with no entry above is still a real page; include it at a
// modest weight rather than let it be invisible.
for (const path of pageRoutesFromDisk()) {
  if (seen.has(path)) continue;
  seen.add(path);
  pages.push({ path, changefreq: "weekly", priority: "0.6" });
}

pages.sort((a, b) => a.path.localeCompare(b.path));
ENDPOINTS.sort((a, b) => a.path.localeCompare(b.path));

// One page per MCP server. They are generated from the same catalogue the panel
// reads, so a server added to the product's `MCP Hub/ALL MCP.md` is in the
// sitemap the next time this runs. They live in their own file because there are
// thousands of them and a crawler should be able to fetch them without pulling
// the whole page list again.
// The curated entries have the same page shape, and their copy is richer, so
// they are listed too — at a slightly higher weight, because their pages carry a
// connect guide a searcher is more likely to want.
const mcpEntries: Entry[] = [
  ...SEO_CURATED_IDS.map((id) => ({
    path: `/apps/${id}`,
    changefreq: "weekly" as const,
    priority: "0.6",
  })),
  ...SEO_ROWS.map((row) => ({
    path: `/apps/${row[0]}`,
    changefreq: "monthly" as const,
    priority: "0.5",
  })),
];
mcpEntries.sort((a, b) => a.path.localeCompare(b.path));

writeFileSync(join(ROOT, "public/sitemap.xml"), render(pages));
writeFileSync(join(ROOT, "public/sitemap-api.xml"), render(ENDPOINTS));
writeFileSync(join(ROOT, "public/sitemap-mcp.xml"), render(mcpEntries));

// An index so a crawler finds both.
writeFileSync(
  join(ROOT, "public/sitemap-index.xml"),
  `<?xml version="1.0" encoding="UTF-8"?>\n` +
    `<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n` +
    `  <sitemap>\n    <loc>${ORIGIN}/sitemap.xml</loc>\n    <lastmod>${TODAY}</lastmod>\n  </sitemap>\n` +
    `  <sitemap>\n    <loc>${ORIGIN}/sitemap-api.xml</loc>\n    <lastmod>${TODAY}</lastmod>\n  </sitemap>\n` +
    `  <sitemap>\n    <loc>${ORIGIN}/sitemap-mcp.xml</loc>\n    <lastmod>${TODAY}</lastmod>\n  </sitemap>\n` +
    `</sitemapindex>\n`,
);

console.log(`pages:     ${pages.length}`);
console.log(`mcp:       ${mcpEntries.length}`);
console.log(`endpoints: ${ENDPOINTS.length}`);
console.log(`docs:      ${docsEntries.length}`);
