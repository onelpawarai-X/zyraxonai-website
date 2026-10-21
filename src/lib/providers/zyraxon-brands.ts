/** The ten ZYRAXON models, as data.
 *
 *  This file holds no secrets and touches no network, so both the provider page
 *  and the server-side router import it. The server-only pieces — reading the
 *  live upstream pool and streaming — live in `zyraxon-brand.server.ts`.
 *
 *  `media.ts` is imported here deliberately: it is pure and dependency-free, so
 *  it loads in both a browser bundle and a bare Node process, and the binder can
 *  then judge modality fitness from the same helper the transport uses instead
 *  of a second, drifting copy of the rule.
 */

import { fitsModalities, type MediaKind } from "./media";

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
    // Audio is the fragile modality: the catalogue declares it for several
    // models that then silently drop the audio and answer "no audio attached".
    // These two were probed with a real spoken clip and transcribed it, so an
    // audio turn is routed to a model that genuinely hears it.
    preferred: "mimo-v2.5-free",
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
    // Probed with a real spoken clip and transcribed it — the audio-capable
    // model the rotation reaches for first.
    preferred: "muse-spark-1.3-contributor-free",
    capability: "Latest experimental reasoning · every modality",
    profile: { vision: true, video: true, audio: true, pdf: true, reasoning: true },
  },
];

const BRAND_BY_ID = new Map<string, Brand>(ZYRAXON_BRANDS.map((b) => [b.id, b]));

export function isBrand(id: string): boolean {
  return BRAND_BY_ID.has(canonicalBrandId(id));
}

export function getBrand(id: string): Brand | undefined {
  return BRAND_BY_ID.get(canonicalBrandId(id));
}

/** Reduce a caller's model id to the ZYRAXON brand it names.
 *
 *  Many clients insist on a `provider/model` string and will not send a bare
 *  model id. LiteLLM, for one, refuses a request whose model has no provider
 *  prefix ("LLM Provider NOT provided") — so a caller has to write
 *  `openai/zyraxon-codex`, and the router here would then not recognise it.
 *  Rather than make every caller learn a second spelling, accept the common
 *  wrappers: an OpenAI-style `openai/` prefix, and our own `zyraxon/` or
 *  `zyraxon/zyraxon-` prefixes. The brand id is the last path segment that
 *  matches a known brand, so `openai/zyraxon/zyraxon-codex` also resolves. */
export function canonicalBrandId(id: unknown): string {
  const raw = String(id ?? "")
    .trim()
    .toLowerCase();
  if (!raw) return "";
  if (BRAND_BY_ID.has(raw)) return raw;
  // Try the last segment, then any segment, so both `openai/zyraxon-codex` and
  // `zyraxon/zyraxon-codex` resolve to `zyraxon-codex`.
  const segments = raw.split("/").filter(Boolean);
  for (let i = segments.length - 1; i >= 0; i--) {
    const seg = segments[i]!;
    if (BRAND_BY_ID.has(seg)) return seg;
    // `zyraxon/codex` is a friendly shorthand for `zyraxon-codex`.
    if (i > 0 && segments[i - 1] === "zyraxon" && BRAND_BY_ID.has(`zyraxon-${seg}`)) {
      return `zyraxon-${seg}`;
    }
  }
  return raw;
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

/** Upstream models PROBED to actually transcribe audio.
 *
 *  A catalogue entry that lists audio is not proof: several free models declare
 *  audio, accept the request, drop the audio, and answer "no audio attached".
 *  That is a silent failure the caller cannot distinguish from a deaf model, and
 *  it is exactly what made a spoken turn return a text answer.
 *
 *  These were each asked to transcribe a real spoken sentence and did. A model
 *  not on this list is never handed audio, whatever its catalogue says — a turn
 *  carrying audio is routed to one of these instead. Re-probe before adding. */
export const AUDIO_VERIFIED_UPSTREAMS = new Set([
  "mimo-v2.5-free",
  "muse-spark-1.3-contributor-free",
  "nemotron-3-nano-omni-30b-a3b-reasoning-free",
]);

/** True when a model is known to accept audio, from its catalogue entry and the
 *  probed set together — both must agree. */
export function acceptsAudio(model: PoolModel): boolean {
  const declared = (model.modalities || []).map((m) => String(m).toLowerCase());
  return declared.includes("audio") && AUDIO_VERIFIED_UPSTREAMS.has(model.id);
}

/** Measured median time-to-first-token, in milliseconds, for each upstream.
 *
 *  Taken from a live three-run probe of the public endpoint. Latency is the one
 *  property the catalogue does not publish, and it varies by an order of
 *  magnitude across the free pool — the same *capability* can be answered in
 *  1.6s or in 14s. Without this, a brand that has to rotate lands on whichever
 *  equally-capable model happens to come first in the pool, which is how a
 *  short question could take fourteen seconds for no reason.
 *
 *  An id that is not listed is treated as unmeasured and sorted after every
 *  timed model, so a newly-added upstream never displaces a known-fast one
 *  before it has been timed. Measured again when the pool churns. */
export const MEASURED_TTFT_MS: Record<string, number> = {
  "minimax-m3.1-flash-free": 1560,
  "beam-free": 1620,
  "nemotron-3.5-lightning-free": 2520,
  "big-pickle": 5120,
  "longcat-2.5-preview-free": 8860,
  "glm-5.3-flash-free": 14230,
  "deepseek-v4.1-flash-free": 27470,
  "nemotron-3.5-super-vl-free": 36070,
};

/** Measured first-token latency for an upstream, or `Infinity` when it has not
 *  been timed. Lower is faster. */
export function measuredTtftMs(id: string): number {
  return MEASURED_TTFT_MS[id] ?? Infinity;
}

/** Order two equally-capable models fastest-first. Used as the tiebreak after
 *  capability, never before it: capability decides which models may answer a
 *  turn at all, and speed decides which of those answers soonest. */
export function bySpeed(a: PoolModel, b: PoolModel): number {
  return measuredTtftMs(a.id) - measuredTtftMs(b.id);
}

/** How well a pool model matches a brand's profile. Higher is a better lead.
 *
 *  This is what keeps a vision brand on a vision model as the upstream pool
 *  churns: the brand's `preferred` id is a hint, but when that model is retired
 *  the binder picks the next live model that still fits the brand's intent
 *  instead of blindly taking whichever model happens to be first.
 *
 *  A brand may *support* a modality without every turn needing it. `need` is
 *  the turn's own requirement, and it only ever widens the field: a modality the
 *  turn does not carry is scored neutrally rather than as a miss. Without that,
 *  a brand that supports a rare modality is dragged onto the one pool model that
 *  serves it for every ordinary text turn — which is how a plain question to an
 *  every-modality brand could land on the slowest model in the pool. */
export function capabilityScore(
  brand: Brand,
  model: PoolModel,
  need: Set<MediaKind> = new Set(),
): number {
  const mods = new Set((model.modalities || []).map((m) => String(m).toLowerCase()));
  const has = (k: string) => mods.has(k);
  const p = brand.profile;
  // "Does the turn want this?" — a modality the turn does not carry is not a
  // reason to prefer or penalise a model.
  const wants = (k: MediaKind) => need.has(k);
  let score = 0;
  if (p.vision && wants("image")) score += has("image") ? 40 : -8;
  if (p.video && wants("video")) score += has("video") ? 25 : -6;
  // Audio is scored against the *probed* set, not the catalogue. A model that
  // claims audio and drops it must not be preferred for an audio turn, or the
  // turn silently degrades to a text answer.
  if (p.audio && wants("audio")) score += acceptsAudio(model) ? 20 : -30;
  // PDF is deliberately the weakest signal: "pdf" is a serving-pipeline detail
  // (whether the pool extracts the document before the model sees it), not a
  // model capability, and in practice one pool model carries it. Letting it
  // lead would pin every turn to that model. It breaks a tie only.
  if (p.pdf && wants("pdf")) score += has("pdf") ? 2 : -6;
  if (p.reasoning) score += model.reasoning ? 12 : -6;
  if (p.speed) score += (model.context || 0) <= 300_000 ? 8 : -2;
  if (p.longOutput) score += (model.output || 0) >= 128_000 ? 15 : -3;
  if (brand.minContext) {
    score += (model.context || 0) >= brand.minContext ? 10 : -20;
  }
  return score;
}

/** Order the pool for a brand: capability first, measured speed as the
 *  tiebreak. Two models that fit the brand equally well are not equally good
 *  answers — the faster one is strictly better — so speed only ever separates
 *  models capability has already called equal. */
function orderForBrand(
  brand: Brand,
  models: PoolModel[],
  need: Set<MediaKind> = new Set(),
): PoolModel[] {
  return [...models].sort(
    (a, b) => capabilityScore(brand, b, need) - capabilityScore(brand, a, need) || bySpeed(a, b),
  );
}

/** The live model a brand should actually lead with right now.
 *
 *  Preference order: the brand's named `preferred` model when it is served,
 *  otherwise the best-scoring live model for the brand's profile — and among
 *  equally-good models, the fastest measured one. Returns null only when the
 *  pool is empty. */
export function bindPreferred(
  brand: Brand,
  pool: PoolModel[],
  live: Set<string> | null,
  need: Set<MediaKind> = new Set(),
): string | null {
  if (!pool.length) return null;
  const served = live ? pool.filter((m) => live.has(m.id)) : pool;
  const candidates = served.length ? served : pool;
  if (candidates.some((m) => m.id === brand.preferred)) return brand.preferred;
  return orderForBrand(brand, candidates, need)[0]!.id;
}

/** The model a brand binds to for a whole turn, with the modality a turn
 *  actually needs folded into the choice.
 *
 *  This is the single place the binder is decided, so the SSE label and the
 *  first upstream attempted can never disagree: `active` names the first entry
 *  of the chain, whatever ordering was applied. Without `need` it is the same
 *  answer `bindPreferred` gives. */
export function activeFor(
  brand: Brand,
  pool: PoolModel[],
  live: Set<string> | null,
  need: Set<MediaKind> = new Set(),
): { active: string; chain: string[] } {
  const chain = rotationFor(brand, pool, live, need);
  return { active: chain[0] || brand.preferred, chain };
}

/** The rotation order for a brand: the model it should lead with, then every
 *  other pool model ordered so capability-compatible ones come first and, among
 *  equals, the fastest first. A retired or rate-limited upstream is swapped
 *  transparently rather than surfaced as an outage, and the swap keeps the
 *  brand's modality intent when it can.
 *
 *  When `need` is given, a model must be able to accept every required modality
 *  to lead; models that cannot are pushed to the tail so they are still
 *  attempted (a text-only model may answer the text half of a turn) rather than
 *  dropped. Audio additionally requires the *probed* set, because several pool
 *  models declare audio in the catalogue and then silently drop it. A preferred
 *  model that fails the need does not lead — that is what made a spoken turn
 *  return a text answer. This is the single ordering the caller and the reported
 *  `active` both use, so the two cannot disagree. */
export function rotationFor(
  brand: Brand,
  pool: PoolModel[],
  live: Set<string> | null = null,
  need: Set<MediaKind> = new Set(),
): string[] {
  const served = live ? pool.filter((m) => live.has(m.id)) : pool;
  const candidates = served.length ? served : pool;
  const preferred = candidates.find((m) => m.id === brand.preferred);
  const others = orderForBrand(
    brand,
    candidates.filter((m) => m.id !== brand.preferred),
    need,
  );

  if (!need.size) {
    return [...(preferred ? [preferred] : []), ...others].map((m) => m.id);
  }

  // Audio must never be scored on the catalogue alone: only the probed set is
  // known to actually transcribe it.
  const fits = (m: PoolModel) =>
    (!need.has("audio") || acceptsAudio(m)) && fitsModalities(need, m.modalities ?? ["text"]);
  const head = preferred && fits(preferred) ? [preferred] : [];
  const capable = others.filter(fits);
  const rest = others.filter((m) => !fits(m));
  return [...head, ...capable, ...rest].map((m) => m.id);
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
  const { active, chain } = activeFor(brand, pool, live);
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
