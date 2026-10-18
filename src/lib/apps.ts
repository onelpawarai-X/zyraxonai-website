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
  dom?: string;
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

export function faviconUrl(domain: string, size = 64) {
  return `https://www.google.com/s2/favicons?domain=${encodeURIComponent(domain)}&sz=${size}`;
}

let cache: McpApp[] | null = null;

export async function loadApps(): Promise<McpApp[]> {
  if (cache) return cache;
  const res = await fetch("/mcp-apps.json");
  if (!res.ok) throw new Error("Could not load the app catalogue");
  const data = (await res.json()) as { apps?: McpApp[] };
  cache = data.apps ?? [];
  return cache;
}
