/** The ten ZYRAXON models, as data.
 *
 *  This file holds no secrets and touches no network, so both the provider page
 *  and the server-side router import it. The server-only pieces — reading the
 *  live upstream pool and streaming — live in `zyraxon-brand.server.ts`.
 */

export type BrandId =
  | "zyraxon-apex"
  | "zyraxon-matrix"
  | "zyraxon-pulse"
  | "zyraxon-titan"
  | "zyraxon-neural"
  | "zyraxon-codex"
  | "zyraxon-visionary"
  | "zyraxon-cyber"
  | "zyraxon-quantum"
  | "zyraxon-genesis";

export type Brand = {
  id: BrandId;
  label: string;
  tagline: string;
  /** Upstream model this brand prefers. Falls back along the rotation. */
  preferred: string;
  /** Blurb describing the underlying capability, in our own words. */
  capability: string;
  /** Input modalities this brand is meant to lead with. The live binding is
   *  still chosen from whatever the pool serves, but a request that carries
   *  media prefers a brand whose profile fits it. */
  profile: BrandProfile;
  /** Hard floor on context, in tokens. A candidate below this is not used to
   *  bind the brand, so the advertised context stays honest. */
  minContext?: number;
};

export type BrandProfile = {
  vision?: boolean;
  video?: boolean;
  audio?: boolean;
  pdf?: boolean;
  reasoning?: boolean;
  /** The brand is the fast/cheap one — prefer a low-latency model. */
  speed?: boolean;
  /** The brand is the long-output one — prefer a high output cap. */
  longOutput?: boolean;
};

/** The ten-brand line. `preferred` names a live free model today; nothing
 *  breaks when one is retired, because every other pool model stands behind it.
 *  `profile` says what the brand leads with, so the auto-binder can keep a
 *  vision brand on a vision model and a fast brand on a fast one as the pool
 *  churns. */
export const ZYRAXON_BRANDS: Brand[] = [
  {
    id: "zyraxon-apex",
    label: "ZYRAXON Apex",
    tagline: "Flagship reasoning at a million tokens",
    preferred: "beam-free",
    capability: "Deep reasoning · 1M context · 131K output",
    profile: { reasoning: true, vision: true, video: true, pdf: true },
    minContext: 200_000,
  },
  {
    id: "zyraxon-matrix",
    label: "ZYRAXON Matrix",
    tagline: "Sees images, reasons at scale",
    preferred: "nemotron-3.5-super-vl-free",
    capability: "Vision + text · 1M context · deep reasoning",
    profile: { vision: true, reasoning: true },
    minContext: 200_000,
  },
  {
    id: "zyraxon-pulse",
    label: "ZYRAXON Pulse",
    tagline: "Built for speed on long inputs",
    preferred: "nemotron-3.5-lightning-free",
    capability: "Low latency · 262K context · 262K output",
    profile: { speed: true },
    minContext: 200_000,
  },
  {
    id: "zyraxon-titan",
    label: "ZYRAXON Titan",
    tagline: "The long-output workhorse",
    preferred: "minimax-m3.1-flash-free",
    capability: "1M context · 512K output · image + video",
    profile: { longOutput: true, vision: true, video: true },
    minContext: 200_000,
  },
  {
    id: "zyraxon-neural",
    label: "ZYRAXON Neural",
    tagline: "Balanced general intelligence",
    preferred: "big-pickle",
    capability: "Reasoning · 200K context · 32K output",
    profile: { reasoning: true },
  },
  {
    id: "zyraxon-codex",
    label: "ZYRAXON Codex",
    tagline: "Writes and repairs code",
    preferred: "deepseek-v4.1-flash-free",
    capability: "Code + vision · 200K context",
    profile: { vision: true },
  },
  {
    id: "zyraxon-visionary",
    label: "ZYRAXON Visionary",
    tagline: "Reads images, video and documents",
    preferred: "glm-5.3-flash-free",
    capability: "Image + video + PDF · 200K context",
    profile: { vision: true, video: true, pdf: true },
  },
  {
    id: "zyraxon-cyber",
    label: "ZYRAXON Cyber",
    tagline: "Every input modality, one model",
    preferred: "mimo-v2.6-flash-free",
    capability: "Text + image + audio + video · 200K context",
    profile: { vision: true, video: true, audio: true },
  },
  {
    id: "zyraxon-quantum",
    label: "ZYRAXON Quantum",
    tagline: "Million-token document reasoning",
    preferred: "longcat-2.5-preview-free",
    capability: "1M context · vision · 131K output",
    profile: { vision: true, pdf: true, reasoning: true },
    minContext: 500_000,
  },
  {
    id: "zyraxon-genesis",
    label: "ZYRAXON Genesis",
    tagline: "Fresh from the lab",
    preferred: "muse-spark-1.2-contributor-free",
    capability: "Latest experimental reasoning · every modality",
    profile: { vision: true, video: true, audio: true, pdf: true, reasoning: true },
  },
];

const BRAND_BY_ID = new Map<string, Brand>(ZYRAXON_BRANDS.map((b) => [b.id, b]));

export function isBrand(id: string): boolean {
  return BRAND_BY_ID.has(
    String(id || "")
      .trim()
      .toLowerCase(),
  );
}

export function getBrand(id: string): Brand | undefined {
  return BRAND_BY_ID.get(
    String(id || "")
      .trim()
      .toLowerCase(),
  );
}

/** The shape rotation needs from a pool model. Structural, not nominal, so the
 *  server's richer `ZenModel` satisfies it and this file stays free of imports
 *  that a plain Node process cannot load. */
export type PoolModel = {
  id: string;
  context?: number;
  output?: number;
  multimodal?: boolean;
  reasoning?: boolean;
  /** Input modalities the model accepts. Optional so older callers compile;
   *  when absent, `multimodal` is the only signal. */
  modalities?: string[];
};

/** How well a pool model matches a brand's profile. Higher is a better lead.
 *
 *  This is what keeps a vision brand on a vision model as the upstream pool
 *  churns: the brand's `preferred` id is a hint, but when that model is retired
 *  the binder picks the next live model that still fits the brand's intent
 *  instead of blindly taking whichever model happens to be first. */
export function capabilityScore(brand: Brand, model: PoolModel): number {
  const mods = new Set((model.modalities || []).map((m) => String(m).toLowerCase()));
  const has = (k: string) => mods.has(k);
  const p = brand.profile;
  let score = 0;
  if (p.vision) score += has("image") ? 40 : -8;
  if (p.video) score += has("video") ? 25 : -6;
  if (p.audio) score += has("audio") ? 20 : -5;
  if (p.pdf) score += has("pdf") ? 8 : 0;
  if (p.reasoning) score += model.reasoning ? 12 : -6;
  if (p.speed) score += (model.context || 0) <= 300_000 ? 8 : -2;
  if (p.longOutput) score += (model.output || 0) >= 128_000 ? 15 : -3;
  if (brand.minContext) {
    score += (model.context || 0) >= brand.minContext ? 10 : -20;
  }
  return score;
}

/** The live model a brand should actually lead with right now.
 *
 *  Preference order: the brand's named `preferred` model when it is served,
 *  otherwise the best-scoring live model for the brand's profile. Returns null
 *  only when the pool is empty. */
export function bindPreferred(
  brand: Brand,
  pool: PoolModel[],
  live: Set<string> | null,
): string | null {
  if (!pool.length) return null;
  const served = live ? pool.filter((m) => live.has(m.id)) : pool;
  const candidates = served.length ? served : pool;
  if (candidates.some((m) => m.id === brand.preferred)) return brand.preferred;
  let best = candidates[0]!.id;
  let bestScore = -Infinity;
  for (const m of candidates) {
    const s = capabilityScore(brand, m);
    if (s > bestScore) {
      bestScore = s;
      best = m.id;
    }
  }
  return best;
}

/** The rotation order for a brand: the model it should lead with, then every
 *  other pool model ordered so capability-compatible ones come first. A retired
 *  or rate-limited upstream is swapped transparently rather than surfaced as an
 *  outage, and the swap keeps the brand's modality intent when it can. */
export function rotationFor(brand: Brand, pool: PoolModel[]): string[] {
  const ids = pool.map((m) => m.id);
  const head = ids.includes(brand.preferred) ? [brand.preferred] : [];
  const rest = pool
    .filter((m) => m.id !== brand.preferred)
    .sort((a, b) => capabilityScore(brand, b) - capabilityScore(brand, a))
    .map((m) => m.id);
  return [...head, ...rest];
}

export type BrandView = Brand & {
  /** The pool model this brand will actually use right now. */
  active: string;
  /** True when `active` is the preferred model; false means we rotated. */
  preferredAvailable: boolean;
  context: number;
  output: number;
  multimodal: boolean;
  reasoning: boolean;
  /** Input modalities the active model accepts. */
  modalities: string[];
};

/** A brand's live state. `active` is chosen by walking the rotation chain
 *  against the models the console is actually serving, so a retired preference
 *  degrades to a capability-compatible sibling rather than a dead end. */
export function brandView(brand: Brand, pool: PoolModel[], live: Set<string> | null): BrandView {
  const chain = rotationFor(brand, pool);
  const served = live ? chain.filter((id) => live.has(id)) : chain;
  // Prefer a model that fits the brand's profile; fall back to the head of the
  // chain so a request is still attempted and the caller sees the real upstream
  // error instead of a blank model name.
  const bound = bindPreferred(brand, pool, live);
  const active =
    (bound && served.includes(bound) ? bound : served[0]) || chain[0] || brand.preferred;
  const meta = pool.find((m) => m.id === active);
  return {
    ...brand,
    active,
    preferredAvailable: active === brand.preferred,
    context: meta?.context ?? 0,
    output: meta?.output ?? 0,
    multimodal: meta?.multimodal ?? false,
    reasoning: meta?.reasoning ?? false,
    modalities: meta?.modalities ?? ["text"],
  };
}

/** True when a failure is the upstream's own free-tier gate — an account or
 *  network decision that refuses every model identically, so rotating cannot
 *  help and the caller must be told the truth instead of "all models down". */
export function isUpstreamGate(detail: string): boolean {
  return /FreeTierError|free tier can only be used|free models aren'?t available|abusive traffic/i.test(
    detail,
  );
}

export type AttemptFailure = { upstream: string; status: number; detail: string; gate: boolean };
export type RotationOutcome<T> =
  { ok: true; value: T; upstream: string } | { ok: false; tried: AttemptFailure[]; gate: boolean };

/** The rotation policy, independent of any transport.
 *
 *  Walks `chain` in order, returning the first success. Stops early on a
 *  rejected credential (401 fails for every model) and on the upstream gate
 *  (an account decision that also fails for every model) — continuing would
 *  only add latency before the same answer. */
export async function rotateThrough<T>(
  chain: string[],
  attempt: (
    upstream: string,
  ) => Promise<{ ok: true; value: T } | { ok: false; status: number; detail: string }>,
  max = 8,
): Promise<RotationOutcome<T>> {
  const tried: AttemptFailure[] = [];
  let gate = false;
  for (const upstream of chain.slice(0, max)) {
    const out = await attempt(upstream);
    if (out.ok) return { ok: true, value: out.value, upstream };
    const g = isUpstreamGate(out.detail);
    if (g) gate = true;
    tried.push({ upstream, status: out.status, detail: out.detail, gate: g });
    if (out.status === 401 || g) break;
  }
  return { ok: false, tried, gate };
}
