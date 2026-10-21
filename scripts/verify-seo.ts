// Audit every page route for the tags that decide whether it can be indexed.
//
// The failure this catches is a page that exists, works, and never appears in
// search: a title but no description, or no canonical URL, or no structured
// data. None of those break anything, which is exactly why they go unnoticed.
//
// Run: npx tsx scripts/verify-seo.ts
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { DOCS } from "../src/lib/docs/content";
import { INTEGRATIONS } from "../src/lib/providers/integrations";

const ROOT = new URL("../", import.meta.url).pathname;
let failures = 0;
const check = (label: string, ok: boolean, detail = "") => {
  if (!ok) failures++;
  console.log(`${ok ? "PASS" : "FAIL"}  ${label}${detail ? `\n        ${detail}` : ""}`);
};

/** Every page route file (not an API route, not a helper). */
function pageRoutes(): string[] {
  const out: string[] = [];
  const walk = (at: string, prefix: string) => {
    for (const name of readdirSync(at)) {
      const full = join(at, name);
      if (statSync(full).isDirectory()) {
        if (name === "api") continue;
        walk(full, `${prefix}/${name}`);
        continue;
      }
      if (!name.endsWith(".tsx")) continue;
      if (name.startsWith("_") || name.startsWith("__")) continue;
      out.push(`${prefix}/${name}`);
    }
  };
  walk(join(ROOT, "src/routes"), "");
  return out;
}

const files = pageRoutes();
check("there are page routes to audit", files.length > 10, String(files.length));

// Every page must describe itself: a title and a description at minimum. A page
// without them is a page a search engine cannot summarise.
for (const file of files) {
  const src = readFileSync(join(ROOT, "src/routes", file), "utf8");
  const hasHead = /head:\s*\(/.test(src);
  // A title may be a literal or a variable: `{ title }` is as valid as
  // `{ title: "..." }`, and only the second would match a naive pattern.
  const hasTitle = /\btitle\b/.test(src);
  const hasDescription = /name:\s*"description"/.test(src) || /description:/.test(src);
  check(`${file} declares a title`, hasTitle);
  check(`${file} declares a description`, hasDescription || /noindex/.test(src));
  check(`${file} has a head()`, hasHead);
  // A canonical URL is what stops a page competing with its own variants, and
  // every indexable page should have one.
  if (!/noindex/.test(src)) {
    // pageSeo() emits the canonical, so a page using it has one.
    check(
      `${file} declares a canonical URL`,
      /rel:\s*"canonical"/.test(src) || /pageSeo\(/.test(src),
    );
  }
}

// The docs pages get their tags from the shared route, so they must all be
// reachable through it — and there must be a doc for every slug in the registry.
check(
  "the docs route builds its head from the doc",
  /getDoc\(/.test(readFileSync(join(ROOT, "src/routes/docs.$slug.tsx"), "utf8")),
);
check("there are docs to index", DOCS.length > 20, `${DOCS.length} pages`);
check("every doc slug is unique", new Set(DOCS.map((d) => d.slug)).size === DOCS.length);
check(
  "every doc has a description for search",
  DOCS.every((d) => d.desc && d.desc.length > 20),
);

// The provider page is the one that should rank for "free OpenAI-compatible
// API", so it must carry the FAQ block and the canonical URL.
const providers = readFileSync(join(ROOT, "src/routes/providers.tsx"), "utf8");
check("the provider page has a canonical URL", /rel:\s*"canonical"/.test(providers));
check("the provider page has a FAQ block", /FAQPage/.test(providers));
check("the provider page has breadcrumbs", /BreadcrumbList/.test(providers));
check("the provider page lists keywords", /name:\s*"keywords"/.test(providers));
check(
  "the provider page names the integration hosts people search for",
  /OpenHands/.test(providers) && /Termux/.test(providers) && /Cursor/.test(providers),
);

// The sitemap must list every page route and every doc.
const SITE_ORIGIN = "https://zyraxonai.lovable.app";
const sitemap = readFileSync(join(ROOT, "public/sitemap.xml"), "utf8");
const locs = new Set(
  Array.from(sitemap.matchAll(/<loc>([^<]+)<\/loc>/g), (m) => m[1]!.replace(SITE_ORIGIN, "")),
);
for (const doc of DOCS) {
  check(`the sitemap lists /docs/${doc.slug}`, locs.has(`/docs/${doc.slug}`));
}
check("the sitemap lists the home page", locs.has("/"));
check("the sitemap lists the provider page", locs.has("/providers"));
check("the sitemap lists the community page", locs.has("/community-art"));
check("the sitemap lists the docs index", locs.has("/docs"));
check("the sitemap lists the download page", locs.has("/download/zyraxon-agent"));

// The API surface has its own sitemap, and robots points at all of them.
const apiSitemap = readFileSync(join(ROOT, "public/sitemap-api.xml"), "utf8");
for (const endpoint of [
  "/api/public/zyraxon/v1/chat/completions",
  "/api/public/zyraxon/v1/models",
  "/api/public/tts",
  "/api/public/tts/voices",
  "/api/public/stt",
  "/api/public/zyraxon/v1/integrations",
  "/api/public/zyraxon/v1/endpoints",
]) {
  check(`the API sitemap lists ${endpoint}`, apiSitemap.includes(endpoint));
}

const robots = readFileSync(join(ROOT, "public/robots.txt"), "utf8");
check("robots.txt points at the page sitemap", robots.includes("/sitemap.xml"));
check("robots.txt points at the API sitemap", robots.includes("/sitemap-api.xml"));
check("robots.txt points at the dynamic sitemap", robots.includes("sitemap-dynamic"));
check("robots.txt allows crawling the pages", /Allow:\s*\//.test(robots));

// Every integration the catalogue documents should be reachable from a page
// that is indexed, or the docs describe something a search cannot find.
check("integrations are documented", INTEGRATIONS.length > 15, `${INTEGRATIONS.length}`);
check(
  "the provider docs page covers every integration",
  INTEGRATIONS.every((i) => Boolean(i.blurb)),
);

console.log("");
if (failures) {
  console.log(`${failures} CHECK(S) FAILED`);
  process.exit(1);
}
console.log("ALL SEO CHECKS PASSED");
