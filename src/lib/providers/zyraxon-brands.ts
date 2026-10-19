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
};

/** The ten-brand line. `preferred` names a live free model today; nothing
 *  breaks when one is retired, because every other pool model stands behind it. */
export const ZYRAXON_BRANDS: Brand[] = [
  {
    id: "zyraxon-apex",
    label: "ZYRAXON Apex",
    tagline: "Flagship reasoning at a million tokens",
    preferred: "beam-free",
    capability: "Deep reasoning · 1M context · 131K output",
  },
  {
    id: "zyraxon-matrix",
    label: "ZYRAXON Matrix",
    tagline: "Sees images, reasons at scale",
    preferred: "nemotron-3.5-super-vl-free",
    capability: "Vision + text · 1M context · deep reasoning",
  },
  {
    id: "zyraxon-pulse",
    label: "ZYRAXON Pulse",
    tagline: "Built for speed on long inputs",
    preferred: "nemotron-3.5-lightning-free",
    capability: "Low latency · 262K context · 262K output",
  },
  {
    id: "zyraxon-titan",
    label: "ZYRAXON Titan",
    tagline: "The long-output workhorse",
    preferred: "minimax-m3.1-flash-free",
    capability: "1M context · 512K output · image + video",
  },
  {
    id: "zyraxon-neural",
    label: "ZYRAXON Neural",
    tagline: "Balanced general intelligence",
    preferred: "big-pickle",
    capability: "Reasoning · 200K context · 32K output",
  },
  {
    id: "zyraxon-codex",
    label: "ZYRAXON Codex",
    tagline: "Writes and repairs code",
    preferred: "deepseek-v4.1-flash-free",
    capability: "Code + vision · 200K context",
  },
  {
    id: "zyraxon-visionary",
    label: "ZYRAXON Visionary",
    tagline: "Reads images, video and documents",
    preferred: "glm-5.3-flash-free",
    capability: "Image + video + PDF · 200K context",
  },
  {
    id: "zyraxon-cyber",
    label: "ZYRAXON Cyber",
    tagline: "Every input modality, one model",
    preferred: "mimo-v2.6-flash-free",
    capability: "Text + image + audio + video · 200K context",
  },
  {
    id: "zyraxon-quantum",
    label: "ZYRAXON Quantum",
    tagline: "Million-token document reasoning",
    preferred: "longcat-2.5-preview-free",
    capability: "1M context · vision · 131K output",
  },
  {
    id: "zyraxon-genesis",
    label: "ZYRAXON Genesis",
    tagline: "Fresh from the lab",
    preferred: "jev-1.13-free",
    capability: "Latest experimental reasoning",
  },
];

const BRAND_BY_ID = new Map<string, Brand>(ZYRAXON_BRANDS.map((b) => [b.id, b]));

export function isBrand(id: string): boolean {
  return BRAND_BY_ID.has(String(id || "").trim().toLowerCase());
}

export function getBrand(id: string): Brand | undefined {
  return BRAND_BY_ID.get(String(id || "").trim().toLowerCase());
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
};

/** The rotation order for a brand: its preferred model first, then every other
 *  pool model, so a retired or rate-limited upstream is transparently swapped
 *  rather than surfaced as an outage. */
export function rotationFor(brand: Brand, pool: PoolModel[]): string[] {
  const ids = pool.map((m) => m.id);
  const head = ids.includes(brand.preferred) ? [brand.preferred] : [];
  return [...head, ...ids.filter((id) => id !== brand.preferred)];
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
};

/** A brand's live state. `active` is chosen by walking the rotation chain
 *  against the models the console is actually serving. */
export function brandView(
  brand: Brand,
  pool: PoolModel[],
  live: Set<string> | null,
): BrandView {
  const chain = rotationFor(brand, pool);
  const served = live ? chain.filter((id) => live.has(id)) : chain;
  // An empty pool means the catalogue read failed, not that the brand is gone.
  // Fall back to the preferred model so a request is still attempted and the
  // caller sees the real upstream error instead of a blank model name.
  const active = served[0] || chain[0] || brand.preferred;
  const meta = pool.find((m) => m.id === active);
  return {
    ...brand,
    active,
    preferredAvailable: active === brand.preferred,
    context: meta?.context ?? 0,
    output: meta?.output ?? 0,
    multimodal: meta?.multimodal ?? false,
    reasoning: meta?.reasoning ?? false,
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
  | { ok: true; value: T; upstream: string }
  | { ok: false; tried: AttemptFailure[]; gate: boolean };

/** The rotation policy, independent of any transport.
 *
 *  Walks `chain` in order, returning the first success. Stops early on a
 *  rejected credential (401 fails for every model) and on the upstream gate
 *  (an account decision that also fails for every model) — continuing would
 *  only add latency before the same answer. */
export async function rotateThrough<T>(
  chain: string[],
  attempt: (upstream: string) => Promise<{ ok: true; value: T } | { ok: false; status: number; detail: string }>,
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
