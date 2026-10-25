// Build the MCP catalog from the agent's own MCP Hub doc.
//
// The source of truth is `MCP Hub/ALL MCP.md` in onelpawarai-X/ZYRAXON-AI. That
// repository writes the file with its own generator, so reading it here means the
// site cannot drift from the servers the agent can actually reach.
//
// The doc carries two catalogs, and both ship:
//
//   curated (108)   — hand-written, each with a description, a connect guide and
//                     a stable id. These get a typed module so their pages can be
//                     built with real copy.
//   verified (8094) — a registry snapshot with an endpoint, an install kind, a
//                     connect kind, a verification depth and a tool count, but no
//                     prose. These go to a JSON asset the panel loads.
//
// Every entry from both catalogs appears in the panel, grouped by one shared
// category taxonomy, and every entry is reachable at /apps/<slug>.
//
// Run: npx tsx scripts/build-mcp-catalog.ts

import { mkdirSync, writeFileSync } from "node:fs";
import {
  CONNECT_KINDS,
  INSTALL_KINDS,
  VERIFY_DEPTHS,
  describeRegistryServer,
} from "../src/lib/mcp-seo";

const DOC_URL =
  "https://raw.githubusercontent.com/onelpawarai-X/ZYRAXON-AI/main/MCP%20Hub/ALL%20MCP.md";
const CURATED_OUT = new URL("../src/lib/mcp-catalog.generated.ts", import.meta.url).pathname;
const MCP_DIR = new URL("../public/mcp/", import.meta.url).pathname;
const SEO_OUT = new URL("../src/lib/mcp-seo-index.server.ts", import.meta.url).pathname;
const FACTS_OUT = new URL("../src/lib/mcp-facts.generated.ts", import.meta.url).pathname;
const PANEL_OUT = new URL("../public/mcp-apps.json", import.meta.url).pathname;

type Tier = "browser" | "key" | "open" | "local";

type Curated = {
  /** Stable slug, from the doc's own id. Used in /apps/<slug>. */
  id: string;
  name: string;
  description: string;
  category: string;
  tier: Tier;
  url: string | null;
  tokenUrl: string | null;
  operator: string | null;
  steps: string[];
  note: string | null;
  domain: string | null;
  color: string;
};

type Registry = {
  /** Stable slug, derived from the registry id. Used in /apps/<slug>. */
  id: string;
  name: string;
  description: string;
  category: string;
  tier: Tier;
  /** remote_http | npx | uvx | docker */
  install: string;
  /** no_auth | oauth_browser | api_key | url_input */
  connect: string;
  /** How far the verifier got. */
  verified: string;
  /** Tools the server exposed, 0 when the depth did not reach tools/list. */
  tools: number;
  /** The endpoint URL, or the package spec for local installs. */
  target: string;
  domain: string | null;
  color: string;
};

/** The tier headings the doc uses, in panel order. */
const TIER_BY_HEADING: Record<string, Tier> = {
  "Browser sign-in": "browser",
  "Needs a token": "key",
  "Open — no sign-in": "open",
  "Runs on this machine": "local",
};

/** The curated `kind` values, mapped to the tier they belong to. */
const TIER_BY_KIND: Record<string, Tier> = {
  oauth: "browser",
  token: "key",
  none: "open",
  local: "local",
};

/** The verified `connect` values, mapped to the same four tiers. */
const TIER_BY_CONNECT: Record<string, Tier> = {
  oauth_browser: "browser",
  api_key: "key",
  url_input: "key",
  no_auth: "open",
};

/**
 * One category taxonomy for both catalogs.
 *
 * The doc names 27 categories for the curated list and 17 for the registry, and
 * they overlap without matching ("Design" against "Design & Media", "AI"
 * against "AI & ML"). The panel groups by category, so two names for one thing
 * would split a group in half. Each side is mapped onto this list instead.
 */
const CATEGORIES = [
  "AI & ML",
  "Web & Search",
  "Developer Tools",
  "Communication",
  "Productivity & Docs",
  "Data & Analytics",
  "Design & Media",
  "Business & CRM",
  "Finance & Crypto",
  "Cloud & Infrastructure",
  "Maps & Travel",
  "Security",
  "Knowledge & Memory",
  "Files & Storage",
  "Automation",
  "Monitoring",
  "IoT & Hardware",
  "General",
] as const;

type Category = (typeof CATEGORIES)[number];

/** Curated category names, folded onto the shared taxonomy. */
const CURATED_CATEGORY: Record<string, Category> = {
  AI: "AI & ML",
  "AI & Media": "AI & ML",
  Automation: "Automation",
  Code: "Developer Tools",
  Commerce: "Finance & Crypto",
  Communication: "Communication",
  Database: "Data & Analytics",
  Design: "Design & Media",
  Developer: "Developer Tools",
  Documents: "Productivity & Docs",
  Finance: "Finance & Crypto",
  Hosting: "Cloud & Infrastructure",
  Infrastructure: "Cloud & Infrastructure",
  Knowledge: "Knowledge & Memory",
  Maps: "Maps & Travel",
  Marketing: "Business & CRM",
  Media: "Design & Media",
  Monitoring: "Monitoring",
  Payments: "Finance & Crypto",
  Productivity: "Productivity & Docs",
  Project: "Business & CRM",
  Sales: "Business & CRM",
  Search: "Web & Search",
  Social: "Communication",
  Storage: "Files & Storage",
  System: "Automation",
  Weather: "Data & Analytics",
};

/** Registry category names, folded onto the same taxonomy. */
const REGISTRY_CATEGORY: Record<string, Category> = {
  "AI & ML": "AI & ML",
  "Web & Search": "Web & Search",
  "Developer Tools": "Developer Tools",
  Communication: "Communication",
  "Data & Analytics": "Data & Analytics",
  "Finance & Crypto": "Finance & Crypto",
  "Productivity & Docs": "Productivity & Docs",
  "Design & Media": "Design & Media",
  "Maps & Travel": "Maps & Travel",
  Databases: "Data & Analytics",
  "Business & CRM": "Business & CRM",
  "Cloud & Infrastructure": "Cloud & Infrastructure",
  Security: "Security",
  "Knowledge & Memory": "Knowledge & Memory",
  "Files & Storage": "Files & Storage",
  "IoT & Hardware": "IoT & Hardware",
  General: "General",
};

/** A colour per category, for the letter mark on an entry with no icon. */
const CATEGORY_COLOR: Record<Category, string> = {
  "AI & ML": "#7C3AED",
  "Web & Search": "#0F766E",
  "Developer Tools": "#1D4ED8",
  Communication: "#0891B2",
  "Productivity & Docs": "#4F46E5",
  "Data & Analytics": "#0D9488",
  "Design & Media": "#DB2777",
  "Business & CRM": "#D97706",
  "Finance & Crypto": "#059669",
  "Cloud & Infrastructure": "#F59E0B",
  "Maps & Travel": "#16A34A",
  Security: "#DC2626",
  "Knowledge & Memory": "#6366F1",
  "Files & Storage": "#0E7490",
  Automation: "#0EA5E9",
  Monitoring: "#B91C1C",
  "IoT & Hardware": "#65A30D",
  General: "#374151",
};

/**
 * Domains the doc does not carry.
 *
 * Most curated entries name their own endpoint host, so the brand domain falls
 * out of the URL. These do not: they are reached through a gateway (so the host
 * belongs to the gateway, not the app), they are social apps that ship no
 * endpoint, or they are this product's own local tools. The list is explicit
 * rather than guessed, because a wrong domain means a wrong icon on a page that
 * claims to show a real one.
 */
const DOMAIN_OVERRIDES: Record<string, string> = {
  serper: "serper.dev",
  "jina-reader": "jina.ai",
  firecrawl: "firecrawl.dev",
  "wolfram-alpha": "wolframalpha.com",
  arxiv: "arxiv.org",
  "open-meteo": "open-meteo.com",
  polygon: "polygon.io",
  coinbase: "coinbase.com",
  pexels: "pexels.com",
  mastodon: "joinmastodon.org",
  bluesky: "bsky.app",
  "hubspot-via-pipeworx": "hubspot.com",
  "intercom-via-pipeworx": "intercom.com",
  "asana-via-pipeworx": "asana.com",
  onedrive: "onedrive.com",
  twilio: "twilio.com",
  instagram: "instagram.com",
  whatsapp: "whatsapp.com",
  telegram: "telegram.org",
  facebook: "facebook.com",
  youtube: "youtube.com",
  reddit: "reddit.com",
  fiverr: "fiverr.com",
};

/** Brand colours for the curated entries that have no domain to take one from. */
const CURATED_COLOR: Record<string, string> = {
  "jarvis-browser": "#4285F4",
  "nuphus-desktop": "#7C3AED",
  "touchpoint-mcp": "#0EA5E9",
  "desktop-commander": "#111827",
};

/** Read one `- **Label** — value` line, with any surrounding backticks removed. */
function field(block: string, label: string): string | null {
  const re = new RegExp(`^- \\*\\*${label}\\*\\* — (.+)$`, "m");
  const m = block.match(re);
  return m ? m[1].trim().replace(/^`|`$/g, "").trim() : null;
}

/** Split a table row on pipes that are not escaped, then unwrap backticks. */
function cells(row: string): string[] {
  // Drop the outer pipes first, so the split does not yield two empty edges.
  const inner = row.trim().replace(/^\|/, "").replace(/\|$/, "");
  const out: string[] = [];
  let cur = "";
  for (let i = 0; i < inner.length; i += 1) {
    const ch = inner[i];
    if (ch === "\\" && inner[i + 1] === "|") {
      cur += "|";
      i += 1;
      continue;
    }
    if (ch === "|") {
      out.push(cur);
      cur = "";
      continue;
    }
    cur += ch;
  }
  out.push(cur);
  return out.map((c) => c.trim().replace(/^`|`$/g, "").trim());
}

/** The hostname behind an endpoint, with the usual MCP prefixes removed. */
function hostDomain(endpoint: string | null): string | null {
  if (!endpoint) return null;
  try {
    const host = new URL(endpoint).hostname.replace(/^www\./, "");
    // A shared gateway speaks for many servers, so its own host is not the
    // app's brand; those entries are covered by the overrides above.
    if (
      /^(gateway\.|mcp\.pipeworx|api\.tweetsmash|.*\.workers\.dev$|.*\.vercel\.app$)/i.test(host)
    ) {
      return null;
    }
    return host.replace(/^mcp\./, "");
  } catch {
    return null;
  }
}

/** A stable slug for a registry id such as `ai.hotker/hotker`. */
function slugOf(registryId: string): string {
  return registryId
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/** A page-ready sentence for a curated entry, whose doc line is a fragment. */
function describeCurated(name: string, fragment: string, category: string): string {
  const text = fragment.replace(/\s+/g, " ").trim().replace(/\.$/, "");
  return `${name} connects to ZYRAXON through the Model Context Protocol: ${text}. Category: ${category}.`;
}

async function main() {
  const res = await fetch(DOC_URL);
  if (!res.ok) throw new Error(`Could not read the MCP Hub doc: HTTP ${res.status}`);
  const text = await res.text();

  const curatedStart = text.indexOf("## Curated apps");
  const verifiedStart = text.indexOf("## Verified servers");
  if (curatedStart < 0 || verifiedStart < 0) {
    throw new Error("The doc no longer has both a 'Curated apps' and a 'Verified servers' section");
  }

  // ---- Curated ------------------------------------------------------------
  const curatedText = text.slice(curatedStart, verifiedStart);
  const curated: Curated[] = [];
  let tier: Tier = "browser";
  let current: { name: string; body: string[] } | null = null;

  const flush = () => {
    if (!current) return;
    const block = current.body.join("\n");
    const id = field(block, "id");
    const category = field(block, "Category") ?? "General";
    const kind = field(block, "Kind");
    const endpoint = field(block, "Endpoint");
    const operator = field(block, "Operated by");

    const body = block
      .split("\n")
      .filter((l) => !l.startsWith("- **"))
      .join("\n");
    const para = body
      .split(/\n\s*\n/)
      .map((p) => p.trim())
      .find((p) => p && !p.startsWith(">") && !p.startsWith("How to connect"));
    const fragment = (para ?? "").replace(/\s+/g, " ").trim();

    const steps: string[] = [];
    const stepRe = /^\s*\d+\.\s+(.+)$/gm;
    let m: RegExpExecArray | null;
    while ((m = stepRe.exec(block))) steps.push(m[1].trim());

    const noteMatch = block.match(/^>\s*(.+)$/m);

    if (id) {
      const mapped = CURATED_CATEGORY[category] ?? "General";
      curated.push({
        id,
        name: current.name,
        description: describeCurated(current.name, fragment, mapped),
        category: mapped,
        tier: kind && TIER_BY_KIND[kind] ? TIER_BY_KIND[kind] : tier,
        url: endpoint,
        tokenUrl: field(block, "Where to get a token") ?? field(block, "Developer console"),
        operator,
        steps,
        note: noteMatch ? noteMatch[1].trim() : null,
        domain: DOMAIN_OVERRIDES[id] ?? hostDomain(endpoint),
        color: CURATED_COLOR[id] ?? CATEGORY_COLOR[mapped],
      });
    }
    current = null;
  };

  for (const line of curatedText.split("\n")) {
    const heading = line.match(/^### (.+?) \(\d+\)$/);
    if (heading) {
      flush();
      const mapped = TIER_BY_HEADING[heading[1]];
      if (mapped) tier = mapped;
      continue;
    }
    const app = line.match(/^#### (.+)$/);
    if (app) {
      flush();
      current = { name: app[1].trim(), body: [] };
      continue;
    }
    if (current) current.body.push(line);
  }
  flush();

  // ---- Verified -----------------------------------------------------------
  const verifiedText = text.slice(verifiedStart);
  const registry: Registry[] = [];
  for (const line of verifiedText.split("\n")) {
    if (!line.startsWith("|")) continue;
    const c = cells(line);
    if (c.length !== 8 || c[0] === "Name") continue;
    const [name, registryId, rawCategory, install, connect, verified, tools, target] = c;
    // The header and the `|---|---|` separator are not rows, and the
    // requirements tables that follow use two columns.
    if (!registryId || !target || /^-+$/.test(name)) continue;
    const mapped = REGISTRY_CATEGORY[rawCategory] ?? "General";
    const toolCount = Number.parseInt(tools, 10) || 0;
    const isRemote = install === "remote_http";
    registry.push({
      id: slugOf(registryId),
      name,
      description: describeRegistryServer(name, mapped, install, connect, verified, toolCount),
      category: mapped,
      tier: TIER_BY_CONNECT[connect] ?? "key",
      install,
      connect,
      verified,
      tools: toolCount,
      target,
      // A local package has no host to take an icon from, so it falls back to
      // the letter mark in its category colour.
      domain: isRemote ? hostDomain(target) : null,
      color: CATEGORY_COLOR[mapped],
    });
  }

  // ---- Checks -------------------------------------------------------------
  const curatedDupes = curated.map((e) => e.id).filter((id, i, a) => a.indexOf(id) !== i);
  if (curatedDupes.length) throw new Error(`Duplicate curated ids: ${curatedDupes.join(", ")}`);
  if (curated.length !== 108)
    throw new Error(`Expected 108 curated apps, parsed ${curated.length}`);
  if (registry.length < 8000)
    throw new Error(`Expected ~8094 verified servers, parsed ${registry.length}`);

  // The registry ids are slugs of unique registry ids, so a collision means two
  // servers would share one page. Report rather than silently dropping one.
  const seen = new Map<string, string>();
  const collisions: string[] = [];
  for (const e of registry) {
    if (seen.has(e.id)) collisions.push(`${e.id} (${seen.get(e.id)} and ${e.name})`);
    else seen.set(e.id, e.name);
  }
  if (collisions.length) {
    console.warn(`  warning: ${collisions.length} slug collisions, keeping the first of each`);
  }

  // A curated id also wins the slug, because its page is the richer one.
  const curatedIds = new Set(curated.map((e) => e.id));
  const deduped = registry.filter((e, i, a) => a.findIndex((x) => x.id === e.id) === i);
  const withoutCurated = deduped.filter((e) => !curatedIds.has(e.id));

  // ---- Write --------------------------------------------------------------
  const count = (list: Array<{ category: string }>, category: string) =>
    list.filter((e) => e.category === category).length;
  const all = [...curated, ...withoutCurated];
  const tierCount = (t: Tier) => all.filter((e) => e.tier === t).length;

  const header = `// Generated by scripts/build-mcp-catalog.ts — do not edit by hand.
//
// Source: MCP Hub/ALL MCP.md in onelpawarai-X/ZYRAXON-AI.
// The ${curated.length} curated servers, with the copy their pages are built from.
// The full ${all.length}-server catalog lives in public/mcp-registry.json.
// Regenerate with: npx tsx scripts/build-mcp-catalog.ts

export type McpTier = "browser" | "key" | "open" | "local";

export type McpServer = {
  id: string;
  name: string;
  description: string;
  category: string;
  tier: McpTier;
  url: string | null;
  tokenUrl: string | null;
  operator: string | null;
  steps: string[];
  note: string | null;
  domain: string | null;
  color: string;
};

export const MCP_CURATED_COUNT = ${curated.length};
export const MCP_SERVER_COUNT = ${all.length};
export const MCP_CATEGORY_COUNT = ${CATEGORIES.length};
export const MCP_TIER_COUNTS: Record<McpTier, number> = ${JSON.stringify(
    {
      browser: tierCount("browser"),
      key: tierCount("key"),
      open: tierCount("open"),
      local: tierCount("local"),
    },
    null,
    2,
  )};
export const MCP_CATEGORY_COUNTS: Record<string, number> = ${JSON.stringify(
    Object.fromEntries(CATEGORIES.map((c) => [c, count(all, c)])),
    null,
    2,
  )};

export const MCP_CURATED: McpServer[] = `;

  writeFileSync(CURATED_OUT, header + JSON.stringify(curated, null, 2) + ";\n", "utf8");

  // The registry is 8,094 rows and about 3.5 MB of JSON. One file would be
  // downloaded whole before the panel could show a single card, so it is split
  // one file per category and read on demand. The index is small enough to load
  // with the page, and it is what the category chips and the counts come from.
  const panelOf = (e: Registry) => ({
    n: e.name,
    d: e.description,
    c: e.category,
    t: e.tier,
    k: e.connect,
    col: e.color,
    dom: e.domain,
    tok: null,
    id: e.id,
    url: /^https?:/i.test(e.target) ? e.target : null,
    pkg: /^https?:/i.test(e.target) ? null : e.target,
    ins: e.install,
    ver: e.verified,
    tl: e.tools,
  });

  mkdirSync(MCP_DIR, { recursive: true });
  const files: Array<{ category: string; file: string; count: number }> = [];
  for (const category of CATEGORIES) {
    const rows = withoutCurated.filter((e) => e.category === category).map(panelOf);
    if (!rows.length) continue;
    // The file name is derived from the category, so it stays stable across
    // regenerations and a browser cache keeps working.
    const file = category
      .toLowerCase()
      .replace(/&/g, "and")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");
    writeFileSync(
      `${MCP_DIR}${file}.json`,
      JSON.stringify({ category, count: rows.length, apps: rows }),
      "utf8",
    );
    files.push({ category, file, count: rows.length });
  }
  // The curated 108 are small enough to ship in one file, and their pages need
  // them before the panel is even opened.
  writeFileSync(
    `${MCP_DIR}curated.json`,
    JSON.stringify({ category: "Curated", count: curated.length, apps: curated.map(panelOf) }),
    "utf8",
  );

  // The legacy static page (`public/zyraxon.html`) reads this file and prints its
  // own totals from it. It used to be hand-maintained, which is why it kept
  // advertising the old 27-category scheme long after the catalog moved to the
  // 18 in `CATEGORIES` — the two disagreed and nothing caught it. Emitting it
  // from the same source as everything else is what stops that happening again.
  writeFileSync(
    PANEL_OUT,
    JSON.stringify(
      { total: all.length, count: curated.length, apps: curated.map(panelOf) },
      null,
      0,
    ),
    "utf8",
  );

  // The numbers the copy quotes, in one tiny module.
  //
  // Every page, doc and prompt that says how many MCP servers exist used to
  // carry the figure as a literal, so a regeneration updated the catalog and
  // left the prose behind — the site went on saying "108 MCP integrations" for
  // a catalog of 8,202. The numbers live here now, and the copy reads them, so
  // there is one place to change and no way for the two to disagree.
  //
  // Deliberately separate from `mcp-catalog.generated.ts`: that file is 66 KB of
  // server records, and a client component that only needs the total must not
  // pull the whole catalog into the browser bundle.
  const verifiedCategoryCount = CATEGORIES.filter((c) =>
    withoutCurated.some((e) => e.category === c),
  ).length;
  const facts = `// Generated by scripts/build-mcp-catalog.ts — do not edit by hand.
//
// Source: MCP Hub/ALL MCP.md in onelpawarai-X/ZYRAXON-AI.
// Regenerate with: npx tsx scripts/build-mcp-catalog.ts

/** Total servers in the MCP Hub: curated plus verified. */
export const MCP_TOTAL = ${all.length};
/** Servers with a hand-written description, connect guide and operator. */
export const MCP_CURATED = ${curated.length};
/** Servers reached by a verifier and listed with the depth it reached. */
export const MCP_VERIFIED = ${withoutCurated.length};
/** Categories in the shared taxonomy. */
export const MCP_CATEGORY_COUNT = ${CATEGORIES.length};
/** Categories that actually hold a verified server, and so have a page. */
export const MCP_VERIFIED_CATEGORY_COUNT = ${verifiedCategoryCount};
/** The category names, in the order the catalog lists them. */
export const MCP_CATEGORY_NAMES: readonly string[] = ${JSON.stringify(CATEGORIES)};
/** How many servers sit in each category. */
export const MCP_CATEGORY_SIZES: Record<string, number> = ${JSON.stringify(
    Object.fromEntries(CATEGORIES.map((c) => [c, count(all, c)])),
    null,
    2,
  )};

/** The counts as the copy writes them: thousands separated, so a page and a
 *  doc never disagree about "8202" versus "8,202". */
export const MCP_TOTAL_TEXT = MCP_TOTAL.toLocaleString("en-US");
export const MCP_CURATED_TEXT = MCP_CURATED.toLocaleString("en-US");
export const MCP_VERIFIED_TEXT = MCP_VERIFIED.toLocaleString("en-US");

/** One phrase for the whole catalog, so every surface describes it the same
 *  way: the total, then the split. */
export const MCP_SUMMARY = \`\${MCP_TOTAL_TEXT} MCP servers: \${MCP_CURATED_TEXT} curated plus \${MCP_VERIFIED_TEXT} verified\`;
`;
  writeFileSync(FACTS_OUT, facts, "utf8");

  writeFileSync(
    `${MCP_DIR}index.json`,
    JSON.stringify(
      {
        generatedAt: new Date().toISOString(),
        source: DOC_URL,
        total: all.length,
        curated: curated.length,
        verified: withoutCurated.length,
        tiers: {
          browser: tierCount("browser"),
          key: tierCount("key"),
          open: tierCount("open"),
          local: tierCount("local"),
        },
        categories: files,
      },
      null,
      2,
    ),
    "utf8",
  );

  // A page per server needs that server's own name and description at request
  // time, and 8,202 separate files is not a thing to ship. This index holds one
  // compact row per server: the three enumerated columns are stored as an index
  // into the tables in `src/lib/mcp-seo.ts`, and the route decodes them and
  // composes the sentence.
  //
  // It is written as a TypeScript module rather than a JSON asset so the route's
  // loader can import it directly. The file it is imported from ends in
  // `.server.ts`, which is what keeps this out of the browser bundle — the same
  // convention `content.server.ts` already relies on.
  //
  // Only the registry rows go in it. A curated entry already has a typed record
  // in the generated module with its own hand-written description, so the route
  // reads that first and only falls back to this index.
  const categoryNames = CATEGORIES as readonly string[];
  const seo = withoutCurated.map((e) => [
    e.id,
    e.name,
    Math.max(0, categoryNames.indexOf(e.category)),
    Math.max(0, INSTALL_KINDS.indexOf(e.install as never)),
    Math.max(0, CONNECT_KINDS.indexOf(e.connect as never)),
    Math.max(0, VERIFY_DEPTHS.indexOf(e.verified as never)),
    e.tools,
  ]);
  const seoModule = `// Generated by scripts/build-mcp-catalog.ts — do not edit by hand.
//
// One compact row per verified MCP server, so /apps/<slug> can render its own
// title and description at request time. Decode with decodeSeoRow() from
// src/lib/mcp-seo.ts. ${seo.length} rows.
//
// This module is imported only by src/lib/mcp-registry.server.ts, which keeps it
// out of the browser bundle.

import type { McpSeoCompact } from "./mcp-seo";

export const SEO_CATEGORIES: readonly string[] = ${JSON.stringify(CATEGORIES)};

export const SEO_CURATED_IDS: readonly string[] = ${JSON.stringify(curated.map((e) => e.id))};

export const SEO_ROWS: readonly McpSeoCompact[] = ${JSON.stringify(seo)};
`;
  writeFileSync(SEO_OUT, seoModule, "utf8");

  console.log(
    `Wrote ${CURATED_OUT}\n  ${curated.length} curated servers\n` +
      `Wrote ${MCP_DIR}\n  ${files.length} category files, ${withoutCurated.length} registry servers\n` +
      `Wrote ${PANEL_OUT}\n  ${curated.length} curated apps for the legacy static page\n` +
      `Wrote ${FACTS_OUT}\n  ${all.length} total, ${curated.length} curated, ${withoutCurated.length} verified, ${CATEGORIES.length} categories\n` +
      `Wrote ${SEO_OUT}\n  ${seo.length} rows for the per-server pages\n` +
      `  ${all.length} total across ${CATEGORIES.length} categories\n` +
      `  tiers ${JSON.stringify({ browser: tierCount("browser"), key: tierCount("key"), open: tierCount("open"), local: tierCount("local") })}`,
  );
}

await main();
