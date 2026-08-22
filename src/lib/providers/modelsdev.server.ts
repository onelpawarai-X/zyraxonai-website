/** ZYRAXON server-side models.dev catalog — every provider & model, fetched once and cached in memory. */

export type ProviderInfo = {
  id: string;
  name: string;
  env: string[];
  api: string | null;
  doc: string | null;
  modelCount: number;
  popular: boolean;
};

export type CatalogModel = {
  id: string;
  name: string;
  description?: string;
  multimodal: boolean;
  reasoning: boolean;
  toolCall: boolean;
  context: number;
  output: number;
  free: boolean;
  costIn: number | null;
  costOut: number | null;
};

export type ProviderDetail = {
  id: string;
  name: string;
  env: string[];
  api: string | null;
  doc: string | null;
  models: CatalogModel[];
};

const MODELS_DEV_URL = "https://models.dev/api.json";
const CACHE_TTL = 30 * 60 * 1000;

type CatalogEntry = {
  id?: string;
  name?: string;
  env?: unknown;
  api?: unknown;
  doc?: unknown;
  npm?: unknown;
  models?: Record<string, unknown>;
};

let cache: { at: number; data: Record<string, CatalogEntry> } | null = null;
let inflight: Promise<Record<string, CatalogEntry>> | null = null;

async function loadCatalog(): Promise<Record<string, CatalogEntry>> {
  if (cache && Date.now() - cache.at < CACHE_TTL) return cache.data;
  if (inflight) return inflight;
  inflight = (async () => {
    const r = await fetch(MODELS_DEV_URL, {
      headers: { Accept: "application/json", "User-Agent": "zyraxon-ai" },
    });
    if (!r.ok) throw new Error(`models.dev request failed (${r.status})`);
    const data = (await r.json()) as Record<string, CatalogEntry>;
    cache = { at: Date.now(), data };
    return data;
  })();
  try {
    return await inflight;
  } finally {
    inflight = null;
  }
}

/** Providers pinned to the top of the settings list, most-used first. */
export const POPULAR_PROVIDER_IDS = [
  "opencode",
  "openai",
  "anthropic",
  "google",
  "groq",
  "openrouter",
  "deepseek",
  "xai",
  "mistral",
  "perplexity",
  "cohere",
  "github-copilot",
  "azure",
  "amazon-bedrock",
  "nvidia",
  "cloudflare-workers-ai",
  "ollama",
];

/** Known OpenAI-compatible base URLs for popular providers that omit `api` on models.dev. */
const FALLBACK_API: Record<string, string> = {
  openai: "https://api.openai.com/v1",
  anthropic: "https://api.anthropic.com/v1",
  google: "https://generativelanguage.googleapis.com/v1beta/openai",
  groq: "https://api.groq.com/openai/v1",
  xai: "https://api.x.ai/v1",
  mistral: "https://api.mistral.ai/v1",
  perplexity: "https://api.perplexity.ai",
  cohere: "https://api.cohere.ai/compatibility/v1",
  ollama: "http://localhost:11434/v1",
};

function asStringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((x): x is string => typeof x === "string") : [];
}

export function resolveProviderApi(id: string, entry: CatalogEntry | undefined): string | null {
  const api = typeof entry?.api === "string" && entry.api.trim() ? entry.api.trim() : null;
  return api || FALLBACK_API[id] || null;
}

export async function listProviders(): Promise<ProviderInfo[]> {
  const data = await loadCatalog();
  const out: ProviderInfo[] = [];
  for (const [key, entry] of Object.entries(data)) {
    out.push({
      id: key,
      name: String(entry.name || entry.id || key),
      env: asStringArray(entry.env),
      api: resolveProviderApi(key, entry),
      doc: typeof entry.doc === "string" ? entry.doc : null,
      modelCount: Object.keys(entry.models || {}).length,
      popular: POPULAR_PROVIDER_IDS.includes(key),
    });
  }
  out.sort((a, b) => {
    if (a.popular !== b.popular) return a.popular ? -1 : 1;
    const ai = a.popular ? POPULAR_PROVIDER_IDS.indexOf(a.id) : -1;
    const bi = b.popular ? POPULAR_PROVIDER_IDS.indexOf(b.id) : -1;
    if (ai !== bi) return ai - bi;
    return a.name.localeCompare(b.name);
  });
  return out;
}

function isFreeModel(id: string, model: unknown): boolean {
  if (/-free$/i.test(id)) return true;
  const cost = model?.cost;
  if (!cost || typeof cost !== "object") return true;
  return Number(cost.input || 0) === 0 && Number(cost.output || 0) === 0;
}

export async function getProviderDetail(providerId: string): Promise<ProviderDetail | null> {
  const data = await loadCatalog();
  const entry = data[providerId];
  if (!entry) return null;
  const models: CatalogModel[] = [];
  for (const [key, raw] of Object.entries<unknown>(entry.models || {})) {
    const id = String(raw?.id || key);
    const input = Array.isArray(raw?.modalities?.input) ? raw.modalities.input : ["text"];
    models.push({
      id,
      name: String(raw?.name || id),
      description: typeof raw?.description === "string" ? raw.description.slice(0, 220) : undefined,
      multimodal: input.some((x: string) => x !== "text"),
      reasoning: Boolean(raw?.reasoning),
      toolCall: raw?.tool_call !== false,
      context: Number(raw?.limit?.context) || 0,
      output: Number(raw?.limit?.output) || 0,
      free: isFreeModel(id, raw),
      costIn: raw?.cost ? Number(raw.cost.input ?? 0) || 0 : null,
      costOut: raw?.cost ? Number(raw.cost.output ?? 0) || 0 : null,
    });
  }
  models.sort((a, b) => (a.free === b.free ? a.name.localeCompare(b.name) : a.free ? -1 : 1));
  return {
    id: providerId,
    name: String(entry.name || providerId),
    env: asStringArray(entry.env),
    api: resolveProviderApi(providerId, entry),
    doc: typeof entry.doc === "string" ? entry.doc : null,
    models,
  };
}
