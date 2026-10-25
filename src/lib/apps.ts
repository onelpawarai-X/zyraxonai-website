// The MCP app catalogue the panel and the marquee read.
//
// The data is generated from the agent's own `MCP Hub/ALL MCP.md` by
// `scripts/build-mcp-catalog.ts`. It ships as per-category files under `/mcp/`,
// because the full list is 8,202 rows and one file would be several megabytes
// before a single card could be drawn. The panel opens on the curated 108 and
// reads a category file only when that category is opened or searched.
//
// Nothing here is hand-maintained: regenerate with
// `npx tsx scripts/build-mcp-catalog.ts` after the product ships new servers.

export type AppTier = "browser" | "key" | "open" | "local";

export type McpApp = {
  /** Name */
  n: string;
  /** Description */
  d: string;
  /** Category */
  c: string;
  /** Tier */
  t: AppTier;
  /** Auth kind */
  k: string;
  /** Brand colour */
  col: string;
  /** Domain, used for the favicon mark */
  dom?: string | null;
  /** Where to create the token, for token-tier apps */
  tok?: string | null;
  /** Slug the app's own page lives at, `/apps/<id>` */
  id?: string;
  /** The MCP endpoint, when the server has one */
  url?: string | null;
  /** The package spec, for servers that install locally */
  pkg?: string | null;
  /** How the server is installed: remote_http, npx, uvx or docker */
  ins?: string;
  /** How far the verifier got with this server */
  ver?: string;
  /** Tools the server exposed */
  tl?: number;
  /** True for the hand-written entries, which carry a guide */
  curated?: boolean;
};

export const TIER_LABEL: Record<AppTier, string> = {
  browser: "Browser sign-in",
  key: "Needs a token",
  open: "No sign-in",
  local: "Runs locally",
};

export const TIER_HINT: Record<AppTier, string> = {
  browser: "Opens that app's consent page. The token stays on your machine.",
  key: "You paste a token you created yourself.",
  open: "No sign-in. Public data, live immediately.",
  local: "A process on this machine. Nothing leaves the box.",
};

/** Apps featured in the homepage marquee, in display order. */
export const FEATURED_APPS = [
  "Notion",
  "GitHub",
  "Linear",
  "Figma",
  "Slack",
  "Stripe",
  "Vercel",
  "Supabase",
  "Discord",
  "Google Drive",
  "MongoDB",
  "Sentry",
  "Cloudflare",
  "Airtable",
  "Asana",
  "Canva",
  "HubSpot",
  "Shopify",
  "Dropbox",
  "Twilio",
];

/** What `/mcp/index.json` carries: the counts and the category files. */
export type McpIndex = {
  generatedAt: string;
  source: string;
  total: number;
  curated: number;
  verified: number;
  tiers: Record<AppTier, number>;
  categories: Array<{ category: string; file: string; count: number }>;
};

type Shard = { category: string; count: number; apps: McpApp[] };

const cache = new Map<string, McpApp[]>();
let indexCache: McpIndex | null = null;
let curatedCache: McpApp[] | null = null;

async function readShard(file: string): Promise<McpApp[]> {
  const hit = cache.get(file);
  if (hit) return hit;
  const res = await fetch(`/mcp/${file}.json`);
  if (!res.ok) throw new Error(`Could not load the ${file} category`);
  const data = (await res.json()) as Shard;
  const apps = data.apps ?? [];
  cache.set(file, apps);
  return apps;
}

/** The counts and the category list. Small, and needed before the first card. */
export async function loadMcpIndex(): Promise<McpIndex> {
  if (indexCache) return indexCache;
  const res = await fetch("/mcp/index.json");
  if (!res.ok) throw new Error("Could not load the MCP catalogue index");
  indexCache = (await res.json()) as McpIndex;
  return indexCache;
}

/** The curated 108, which carry a description and a connect guide. */
export async function loadCuratedApps(): Promise<McpApp[]> {
  if (curatedCache) return curatedCache;
  const res = await fetch("/mcp/curated.json");
  if (!res.ok) throw new Error("Could not load the curated apps");
  const data = (await res.json()) as Shard;
  curatedCache = (data.apps ?? []).map((a) => ({ ...a, curated: true }));
  return curatedCache;
}

/** One category file, read on demand. */
export async function loadCategory(file: string): Promise<McpApp[]> {
  return readShard(file);
}

/** The curated list and every category file, for a search that spans them all. */
export async function loadApps(): Promise<McpApp[]> {
  const index = await loadMcpIndex();
  const curated = await loadCuratedApps();
  const rest = await Promise.all(index.categories.map((c) => readShard(c.file)));
  return [...curated, ...rest.flat()];
}

export function faviconUrl(domain: string, size = 64) {
  return `https://www.google.com/s2/favicons?domain=${encodeURIComponent(domain)}&sz=${size}`;
}

/** The slug an app's own page lives at. */
export function appSlug(app: McpApp): string {
  return app.id ?? slugify(app.n);
}

/** A URL-safe slug, matching the one the catalogue generator assigns. */
export function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}
