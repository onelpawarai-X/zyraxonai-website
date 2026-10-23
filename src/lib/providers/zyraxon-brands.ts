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

/** A measurement of what a model can actually take, as opposed to what its
 *  catalogue entry claims.
 *
 *  Injected rather than imported so this module keeps its no-dependency
 *  property: it is loaded by the provider page in a browser, and the real
 *  implementation carries the base64 probe fixtures. The server passes the
 *  measured map; a browser or a test may pass nothing, and the catalogue is
 *  then the only signal — which is the pre-existing behaviour, not a
 *  regression. Returns undefined when the modality has not been measured. */
export type CapabilityOracle = (
  id: string,
  modality: "image" | "audio" | "video",
) => boolean | undefined;

/** Upstream models PROBED to actually transcribe audio.
 *
 *  Kept only as a *seed* for the very first turn after a cold start, when no
 *  measurement exists yet. The authoritative answer is the live capability map
 *  in `media-capability.server.ts`, which re-probes every model on a timer and
 *  learns from real traffic. A hardcoded set is what broke audio in the first
 *  place: every id below was retired upstream, so `acceptsAudio` returned false
 *  for the whole pool and audio turns were silently routed to a text-only model.
 *
 *  Do not extend this list. Let the probe decide. */
export const AUDIO_VERIFIED_SEED = new Set(["mimo-v2.6-flash-free"]);

/** Upstream models PROBED to actually accept video.
 *
 *  Same role as `AUDIO_VERIFIED_SEED`: a bootstrap hint for the first turn
 *  after a cold start, before the sweep has measured anything. Every id here
 *  was asked to describe a short clip and did; the catalogue's claim is not
 *  enough, because several models declare video and then drop it.
 *
 *  The measurement always wins once it exists. Do not extend this list by hand
 *  — let the probe decide. */
export const VIDEO_VERIFIED_SEED = new Set([
  "mimo-v2.6-flash-free",
  "minimax-m3.1-flash-free",
  "big-pickle",
]);

/** True when a model is known to accept audio.
 *
 *  Measured capability wins when it exists. Without a measurement the seed is
 *  consulted, never the catalogue alone — several pool models declare audio and
 *  then silently drop it, so a declaration is not evidence. */
export function acceptsAudio(model: PoolModel, oracle?: CapabilityOracle): boolean {
  return acceptsModality(model, "audio", oracle) === true;
}

/** The probed bootstrap set for a modality, or null when the catalogue is a
 *  usable fallback.
 *
 *  Audio and video need a set because the catalogue is not trustworthy for
 *  them: every pool model declares both, and most then drop the bytes. Image
 *  does not, because a model that declares image really does take it. */
function seedFor(kind: "image" | "audio" | "video"): Set<string> | null {
  if (kind === "audio") return AUDIO_VERIFIED_SEED;
  if (kind === "video") return VIDEO_VERIFIED_SEED;
  return null;
}

/** Whether a model can accept `kind`, preferring a measurement, then the probed
 *  seed, then the catalogue.
 *
 *  `undefined` means "not established", which the callers treat as "let it try"
 *  rather than "refuse". That distinction is the difference between a first turn
 *  that works and one that is silently downgraded. */
export function acceptsModality(
  model: PoolModel,
  kind: "image" | "audio" | "video",
  oracle?: CapabilityOracle,
): boolean | undefined {
  const measured = oracle?.(model.id, kind);
  if (measured !== undefined) return measured;
  const seed = seedFor(kind);
  if (seed) return seed.has(model.id);
  const declared = (model.modalities || []).map((m) => String(m).toLowerCase());
  return declared.includes(kind);
}

/** Contribution of one *needed* modality to a model's score.
 *
 *  A measured "yes" outranks a catalogue claim, because the claim is what the
 *  probe exists to check. A measured "no" is a penalty and not a veto: the
 *  model may still answer the text half of the turn, so it stays in the chain
 *  rather than being dropped. When nothing is established, the model neither
 *  gains nor loses — scoring an unknown as a miss would make every model equal
 *  and hand the choice to latency, which is how a video turn landed on a model
 *  that cannot see. */
function modalityScore(accepts: boolean | undefined, yes: number, no: number): number {
  if (accepts === true) return yes + 10;
  if (accepts === false) return no - 20;
  return 0;
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
  oracle?: CapabilityOracle,
): number {
  const mods = new Set((model.modalities || []).map((m) => String(m).toLowerCase()));
  const has = (k: string) => mods.has(k);
  const accepts = (k: "image" | "audio" | "video") => acceptsModality(model, k, oracle);
  const p = brand.profile;
  // "Does the turn want this?" — a modality the turn does not carry is not a
  // reason to prefer or penalise a model.
  const wants = (k: MediaKind) => need.has(k);
  let score = 0;
  if (p.vision && wants("image")) score += modalityScore(accepts("image"), 40, -8);
  if (p.video && wants("video")) score += modalityScore(accepts("video"), 25, -6);
  // Audio is scored against what was *measured*, not the catalogue. A model that
  // claims audio and drops it must not be preferred for an audio turn, or the
  // turn silently degrades to a text answer — the exact failure this fixes.
  if (p.audio && wants("audio")) score += modalityScore(accepts("audio"), 20, -30);
  // PDF is deliberately the weakest signal: "pdf" is a serving-pipeline detail
  // (whether the pool extracts the document before the model sees it), not a
  // model capability, and in practice one pool model carries it. Letting it
  // lead would pin every turn to that model. It breaks a tie only.
  if (p.pdf && wants("pdf")) score += has("pdf") ? 2 : -6;
  // A turn that carries no media at all is a text turn, and a text turn should
  // land on a text model: the models that declare only `text` are the cheap,
  // fast, always-available ones, and spending an omni model on "hello" both
  // costs latency and occupies the one upstream an audio turn would need. The
  // bonus is small — it reorders equals, it does not override capability — and
  // it disappears the moment the turn carries anything, so an image turn is
  // still led by the vision model.
  if (!need.size) {
    const extra = Array.from(mods).filter((m) => m !== "text").length;
    score += extra === 0 ? 8 : -2 * extra;
  }
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
  oracle?: CapabilityOracle,
): PoolModel[] {
  return [...models].sort(
    (a, b) =>
      capabilityScore(brand, b, need, oracle) - capabilityScore(brand, a, need, oracle) ||
      bySpeed(a, b),
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
  oracle?: CapabilityOracle,
): string | null {
  if (!pool.length) return null;
  const served = live ? pool.filter((m) => live.has(m.id)) : pool;
  const candidates = served.length ? served : pool;
  const preferred = candidates.find((m) => m.id === brand.preferred);
  if (preferred && (!need.size || fitsNeed(preferred, need, oracle))) return brand.preferred;
  return orderForBrand(brand, candidates, need, oracle)[0]!.id;
}

/** True when a model can accept every modality the turn actually carries.
 *
 *  Audio is checked against the measurement and never the catalogue, because a
 *  catalogue that lists audio and then drops the bytes is the silent failure
 *  this whole module exists to prevent. Image and video follow the same rule
 *  when a measurement exists. */
function fitsNeed(model: PoolModel, need: Set<MediaKind>, oracle?: CapabilityOracle): boolean {
  const declared = model.modalities ?? ["text"];
  for (const kind of need) {
    // A media modality is judged by measurement first, then by the probed seed.
    // Never by the catalogue alone for audio and video: those are exactly the
    // declarations that lie, and treating an unproven "yes" as a fit is what let
    // a video turn lead with a model that cannot see.
    if (kind === "image" || kind === "video" || kind === "audio") {
      if (acceptsModality(model, kind, oracle) !== true) return false;
      continue;
    }
    if (!fitsModalities(new Set([kind]), declared)) return false;
  }
  return true;
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
  oracle?: CapabilityOracle,
): { active: string; chain: string[] } {
  const chain = rotationFor(brand, pool, live, need, oracle);
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
 *  dropped. The verdict comes from `oracle` — a live measurement — when one
 *  exists, and from the catalogue only as a fallback, because several pool
 *  models declare a modality in the catalogue and then silently drop it. A
 *  preferred model that fails the need does not lead — that is what made a
 *  spoken turn return a text answer. This is the single ordering the caller and
 *  the reported `active` both use, so the two cannot disagree. */
export function rotationFor(
  brand: Brand,
  pool: PoolModel[],
  live: Set<string> | null = null,
  need: Set<MediaKind> = new Set(),
  oracle?: CapabilityOracle,
): string[] {
  const served = live ? pool.filter((m) => live.has(m.id)) : pool;
  const candidates = served.length ? served : pool;
  const preferred = candidates.find((m) => m.id === brand.preferred);
  const others = orderForBrand(
    brand,
    candidates.filter((m) => m.id !== brand.preferred),
    need,
    oracle,
  );

  if (!need.size) {
    return [...(preferred ? [preferred] : []), ...others].map((m) => m.id);
  }

  const fits = (m: PoolModel) => fitsNeed(m, need, oracle);
  const head = preferred && fits(preferred) ? [preferred] : [];
  const capable = others.filter(fits);
  const rest = others.filter((m) => !fits(m));
  // When nothing is measured able to take the media, the turn still runs: the
  // chain is ordered so the least-bad candidate leads, and the refusal detector
  // downstream turns a model that silently dropped the bytes into a retry or a
  // truthful error rather than a text answer. Refusing here instead would deny
  // the turn on the strength of a declaration we already do not trust.
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
  /** Input modalities the brand accepts from a caller: always every modality we
   *  serve. A caller picks a model by name, not by capability, so the catalogue
   *  must not make them choose — the routing below sends each turn to a model
   *  that was measured able to handle the parts it carries. */
  modalities: string[];
  /** Input modalities the *currently bound upstream* was measured to accept.
   *  This is the routing truth, published so an operator can see which model is
   *  doing the media work today. A caller does not need it: whatever it sends
   *  is routed to a model that can take it. */
  routed_modalities: string[];
};

/** Every input modality the ZYRAXON line accepts from a caller.
 *
 *  The catalogue advertises all of them on every brand on purpose. Which
 *  upstream model actually receives a given turn is decided server-side from a
 *  live measurement of that model, not from what it declares, and a caller that
 *  had to pick the right model by hand would be choosing on the same unreliable
 *  declarations we do not trust ourselves. */
export const ADVERTISED_INPUT_MODALITIES = ["text", "image", "audio", "video", "pdf"] as const;

/** A brand's live state. `active` is chosen by walking the rotation chain
 *  against the models the console is actually serving, so a retired preference
 *  degrades to a capability-compatible sibling rather than a dead end. */
export function brandView(
  brand: Brand,
  pool: PoolModel[],
  live: Set<string> | null,
  oracle?: CapabilityOracle,
): BrandView {
  const { active, chain } = activeFor(brand, pool, live, new Set(), oracle);
  const meta = pool.find((m) => m.id === active);
  const routed = meta?.modalities ?? ["text"];
  return {
    ...brand,
    active,
    preferredAvailable: active === brand.preferred,
    context: meta?.context ?? 0,
    output: meta?.output ?? 0,
    multimodal: true,
    reasoning: meta?.reasoning ?? false,
    modalities: [...ADVERTISED_INPUT_MODALITIES],
    routed_modalities: routed,
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
 *  only add latency before the same answer.
 *
 *  `retry` decides, after a failed attempt, whether the *same* upstream is worth
 *  asking again. That is not a general-purpose retry: it exists for the one case
 *  where rotating away is strictly worse than repeating — a media turn on a
 *  modality only one model in the pool can serve. If that model answers "no
 *  audio attached" (it does so intermittently), the next model in the chain
 *  cannot hear either, so rotating turns a recoverable miss into a guaranteed
 *  wrong answer. Re-asking the only model that can do the job is the correct
 *  move. */
/** How many times a rotation may walk the whole chain before giving up.
 *
 *  Enough to ride out the short upstream bursts that clear in a second or two,
 *  and few enough that a chain of instantly-failing models does not spin for
 *  the whole budget. The wall-clock budget below is the outer bound. */
const ROTATION_MAX_PASSES = 4;

/** Ask several models at once and take the first answer.
 *
 *  Walking a chain one model at a time makes the caller pay for every slow or
 *  dead model in turn: eight models that each think for six seconds is a
 *  minute of waiting, and the caller sees only the last failure. Free upstreams
 *  fail in bursts and think unevenly, so the sequential walk is the wrong shape
 *  for them.
 *
 *  This starts the best candidate immediately and, if it has not answered after
 *  `hedgeMs`, starts the next one alongside it — and so on, until one answers or
 *  the budget runs out. The caller waits for the fastest model that works, not
 *  for the sum of the ones that do not. Losing attempts are cancelled so their
 *  work does not hold a lane or an upstream stream open.
 *
 *  A gate or a rejected credential still stops everything: those fail for every
 *  model identically, so racing would only multiply the same refusal. */
export async function raceFor<T>(
  candidates: string[],
  attempt: (
    upstream: string,
  ) => Promise<
    { ok: true; value: T } | { ok: false; status: number; detail: string }
  >,
  opts: {
    /** How long to wait on the current best before adding another. */
    hedgeMs?: number;
    /** Wall-clock ceiling for the whole race. */
    budgetMs?: number;
    /** How many candidates may be asked at once. */
    max?: number;
    /** Release a losing success (cancel its body) so nothing is left open. */
    discard?: (value: T, upstream: string) => void;
  } = {},
): Promise<RotationOutcome<T>> {
  const hedgeMs = opts.hedgeMs ?? 1_500;
  const budgetMs = opts.budgetMs ?? 0;
  const startedAt = Date.now();
  const spent = () => budgetMs > 0 && Date.now() - startedAt >= budgetMs;
  const queue = opts.max ? candidates.slice(0, opts.max) : candidates.slice();
  const tried: AttemptFailure[] = [];
  let gate = false;
  let next = 0;
  let lastFailure: AttemptFailure | null = null;

  type Slot = { u: string; res?: { ok: true; value: T } | { ok: false; status: number; detail: string } };
  const pending = new Set<Promise<Slot>>();

  const launch = (u: string): Promise<Slot> => {
    const p = attempt(u).then(
      (r): Slot => ({ u, res: r }),
      (e): Slot => ({
        u,
        res: { ok: false, status: 502, detail: e instanceof Error ? e.message : String(e) },
      }),
    );
    const tracked = p.finally(() => {
      pending.delete(tracked);
    });
    pending.add(tracked);
    return tracked;
  };

  if (!queue.length) return { ok: false, tried, gate };
  launch(queue[next++]);

  while (true) {
    if (!pending.size) {
      if (next < queue.length && !spent()) {
        launch(queue[next++]);
        continue;
      }
      break;
    }
    let timer: ReturnType<typeof setTimeout> | null = null;
    const hedge = new Promise<"hedge">((resolve) => {
      timer = setTimeout(() => resolve("hedge"), hedgeMs);
      if (typeof timer?.unref === "function") timer.unref();
    });
    const winner = await Promise.race<Slot | "hedge">([...pending, hedge]);
    if (timer) clearTimeout(timer);

    if (winner === "hedge") {
      // Nothing has answered yet. Widen the race if there is anyone left and
      // budget to spend; otherwise keep waiting on what is already running.
      if (next < queue.length && !spent()) launch(queue[next++]);
      else if (spent()) break;
      continue;
    }

    const res = winner.res!;
    if (res.ok) {
      // Everyone still running lost. Release their work so a losing stream does
      // not stay open, holding an upstream conversation nobody will read.
      for (const p of pending) {
        p.then((s) => {
          if (s.res?.ok && opts.discard) opts.discard(s.res.value, s.u);
        }).catch(() => {});
      }
      return { ok: true, value: res.value, upstream: winner.u };
    }

    const g = isUpstreamGate(res.detail);
    if (g) gate = true;
    const failure: AttemptFailure = {
      upstream: winner.u,
      status: res.status,
      detail: res.detail,
      gate: g,
    };
    tried.push(failure);
    lastFailure = failure;
    if (res.status === 401 || g) return { ok: false, tried, gate };
    // A fast failure means the next model is worth asking right away.
    if (next < queue.length && !spent()) launch(queue[next++]);
  }

  if (spent() && lastFailure) {
    tried.push({
      upstream: queue[Math.min(next, queue.length - 1)] ?? "",
      status: 504,
      detail: `race budget of ${budgetMs}ms exhausted`,
      gate: false,
    });
  }
  return { ok: false, tried, gate };
}

export async function rotateThrough<T>(
  chain: string[],
  attempt: (
    upstream: string,
  ) => Promise<{ ok: true; value: T } | { ok: false; status: number; detail: string }>,
  max = 8,
  retry?: (
    upstream: string,
    failure: AttemptFailure,
    attemptNumber: number,
  ) => boolean | Promise<boolean>,
  /** Wall-clock ceiling for the *whole* rotation.
   *
   *  Per-attempt deadlines are not enough on their own: a chain of eight slow
   *  models, each taking its full allowance, adds up to far longer than the
   *  gateway will hold a connection — and when the gateway gives up first, the
   *  caller gets an opaque 502 instead of the honest "every model was
   *  unavailable" this function exists to produce. This bound makes the
   *  rotation return its own answer before an intermediary invents one. */
  opts?: { budgetMs?: number; passes?: number },
): Promise<RotationOutcome<T>> {
  const tried: AttemptFailure[] = [];
  let gate = false;
  const startedAt = Date.now();
  const budgetMs = opts?.budgetMs ?? 0;
  const budgetSpent = () => budgetMs > 0 && Date.now() - startedAt >= budgetMs;
  // One walk of the chain is not enough. A free upstream fails in bursts — a
  // model that answers 502 now answers in a second when asked again — so
  // stopping after the first full pass turns a momentary wobble into a caller
  // -visible outage. When a budget is given, the chain is walked again until
  // that budget runs out; each pass is cheap when the upstreams are failing
  // fast, and the budget is what stops it, not the pass count.
  const maxPasses = opts?.passes ?? (budgetMs > 0 ? ROTATION_MAX_PASSES : 1);
  for (let pass = 0; pass < maxPasses; pass++) {
    if (budgetSpent()) break;
    if (pass > 0) {
      // Brief pause between passes: a burst of upstream 5xx clears in about a
      // second, and hammering with no gap tends to reproduce the same failure.
      await new Promise((r) => setTimeout(r, Math.min(400 * pass, 2_000)));
      if (budgetSpent()) break;
    }
    // Retry counters are per pass: a model that already spent its retries in an
    // earlier pass deserves a fresh look now that time has passed.
    const perUpstream = new Map<string, number>();
    for (const upstream of chain.slice(0, max)) {
      for (;;) {
        if (budgetSpent()) {
          tried.push({
            upstream,
            status: 504,
            detail: `rotation budget of ${budgetMs}ms exhausted`,
            gate: false,
          });
          return { ok: false, tried, gate };
        }
        const out = await attempt(upstream);
        if (out.ok) return { ok: true, value: out.value, upstream };
        const g = isUpstreamGate(out.detail);
        if (g) gate = true;
        const failure: AttemptFailure = {
          upstream,
          status: out.status,
          detail: out.detail,
          gate: g,
        };
        tried.push(failure);
        if (out.status === 401 || g) return { ok: false, tried, gate };
        const n = (perUpstream.get(upstream) ?? 0) + 1;
        perUpstream.set(upstream, n);
        if (await retry?.(upstream, failure, n)) continue;
        break;
      }
    }
  }
  return { ok: false, tried, gate };
}
