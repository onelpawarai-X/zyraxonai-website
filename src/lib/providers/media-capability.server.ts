/** Measured media capability for the free upstream pool.
 *
 *  The catalogue lies. Every free model on models.dev declares `audio` and
 *  `video` in its `modalities`, and a live probe shows most of them silently
 *  drop the bytes and answer "no audio attached". Trusting the declaration is
 *  what made a spoken turn return a text answer, and what makes a caller see
 *  "this model does not support audio" from a model that was never given any.
 *
 *  So capability is *measured*, not read: each candidate upstream is handed a
 *  tiny fixture whose correct answer can only be produced by a model that
 *  actually received the bytes (see `probe-fixtures.ts`), and the verdict is
 *  remembered here.
 *
 *  Four properties make this safe to put in front of every turn:
 *
 *  1. It never blocks a turn. `ensureCapabilities` returns whatever is known by
 *     its deadline and lets the rest finish in the background, so the first
 *     caller after a cold start is not made to wait for a full sweep.
 *  2. A verdict is not permanent. Every cell carries the time it was measured
 *     and expires, so a model that gains audio support upstream is re-probed
 *     rather than written off forever.
 *  3. Real traffic teaches it. `recordOutcome` lets a turn that actually
 *     carried media report what happened, so the map converges on the truth
 *     from production requests and not only from probes.
 *  4. A transient failure is never a verdict. A 429 or a 5xx means "ask again",
 *     and is recorded as inconclusive. Collapsing it into "no" is precisely how
 *     a hardcoded verified-set went stale and silently broke audio.
 *
 *  Only the three modalities a caller can actually send are tracked. PDF is a
 *  serving-pipeline detail (whether the pool extracts the document before the
 *  model sees it), not a model capability, and text is universal. */

import { PROBE_IMAGE_PNG_B64, PROBE_SPEECH_WAV_B64, PROBE_VIDEO_MP4_B64 } from "./probe-fixtures";

export type Modality = "image" | "audio" | "video";

/** What a measurement concluded.
 *
 *  `unknown` is a first-class value, not a missing entry: it means nothing has
 *  been proved yet, or the last attempt was inconclusive. It is deliberately
 *  distinct from `no`, which means the upstream answered in a way that proves
 *  it did not receive the media. */
export type Verdict = "yes" | "no" | "unknown";

/** The verdicts for one model. `at` is the most recent measurement of any
 *  modality. */
export type ModelCapability = {
  id: string;
  image: Verdict;
  audio: Verdict;
  video: Verdict;
  at: number;
};

/** How long a definite verdict is trusted before it is re-measured. Six hours
 *  keeps the sweep rare while still picking up a modality a model gains or
 *  loses upstream the same day. */
const VERDICT_TTL_MS = 6 * 60 * 60 * 1000;

/** How long an inconclusive result is trusted. Short, because the usual cause
 *  is a momentary rate limit and the next attempt is likely to settle it. */
const UNKNOWN_TTL_MS = 2 * 60 * 1000;

/** Ceiling on how long a turn waits for a cold sweep. Past this the caller
 *  proceeds on what is known — or, when nothing is known, on the catalogue's
 *  claim — and the sweep continues in the background. Routing is improved by
 *  this data but must not depend on it: a turn that waits for a sweep has
 *  traded a wrong answer for a slow one, which is not a trade a caller asked
 *  for. */
const ENSURE_DEADLINE_MS = Number(process.env.ZYRAXON_CAPABILITY_DEADLINE_MS || 2_500);

/** Output budget for one probe. Generous on purpose: a reasoning model spends
 *  tokens on its scratchpad before the answer, and a truncated answer reads as
 *  "no media". A 60-token budget turned several capable models into false
 *  negatives during development. */
const PROBE_MAX_TOKENS = 300;

/** One upstream call, in the shape the probe needs. Injected rather than
 *  imported so this module stays free of the transport (which reaches this one
 *  through the brand router) and so a test can drive it without a network. */
export type ProbeTransport = (
  upstream: string,
  messages: unknown[],
  maxTokens: number,
) => Promise<{ ok: true; text: string } | { ok: false; status: number; detail: string }>;

let transport: ProbeTransport | null = null;

/** Wire the real transport in. Called once from the brand router at load. */
export function registerProbeTransport(t: ProbeTransport): void {
  transport = t;
}

type Cell = { v: Verdict; at: number };
type Entry = { id: string; image: Cell; audio: Cell; video: Cell };

const MODALITIES: Modality[] = ["image", "audio", "video"];

const store = new Map<string, Entry>();

/** In-flight sweeps, so a burst of callers shares one sweep instead of
 *  stampeding the upstream with the same three requests each. */
const inFlight = new Map<string, Promise<void>>();

const cellTtl = (v: Verdict) => (v === "unknown" ? UNKNOWN_TTL_MS : VERDICT_TTL_MS);
const cellFresh = (c: Cell | undefined) => !!c && Date.now() - c.at < cellTtl(c.v);

/** What is known about a model right now, or null when nothing fresh is. */
export function capabilityOf(id: string): ModelCapability | null {
  const entry = store.get(id);
  if (!entry) return null;
  const cells = MODALITIES.map((m) => entry[m]).filter(cellFresh);
  if (!cells.length) return null;
  return {
    id,
    // A stale cell reads as unknown rather than as its last value: an expired
    // measurement is not evidence, and reporting it as one is how a model that
    // lost audio support upstream keeps being handed audio.
    image: cellFresh(entry.image) ? entry.image.v : "unknown",
    audio: cellFresh(entry.audio) ? entry.audio.v : "unknown",
    video: cellFresh(entry.video) ? entry.video.v : "unknown",
    at: Math.max(...cells.map((c) => c.at)),
  };
}

/** The verdict for one modality: true/false when measured, undefined when not
 *  known. Callers treat `undefined` as "try it and find out" rather than as a
 *  refusal, so an unmeasured model is never denied a turn. */
export function supports(id: string, modality: Modality): boolean | undefined {
  const entry = store.get(id);
  const cell = entry?.[modality];
  if (!cellFresh(cell)) return undefined;
  return cell!.v === "unknown" ? undefined : cell!.v === "yes";
}

/** The current verdicts for these ids, without waiting for anything. */
export function snapshot(ids: string[]): Map<string, ModelCapability> {
  const out = new Map<string, ModelCapability>();
  for (const id of ids) {
    const cap = capabilityOf(id);
    if (cap) out.set(id, cap);
  }
  return out;
}

/** Read the capability of a set of models, probing any that are missing.
 *
 *  Resolves by `deadlineMs` even if probes are still running, so a cold start
 *  cannot hold up a caller. */
export async function ensureCapabilities(
  ids: string[],
  opts: { deadlineMs?: number; transport?: ProbeTransport } = {},
): Promise<Map<string, ModelCapability>> {
  const missing = ids.filter((id) => needsProbe(id));
  if (!missing.length) return snapshot(ids);

  const started = missing.map((id) => probeOnce(id, opts.transport));
  await Promise.race([
    Promise.allSettled(started),
    new Promise((r) => setTimeout(r, opts.deadlineMs ?? ENSURE_DEADLINE_MS)),
  ]);
  return snapshot(ids);
}

/** True when some modality for this id has no fresh verdict. */
function needsProbe(id: string): boolean {
  const entry = store.get(id);
  if (!entry) return true;
  return MODALITIES.some((m) => !cellFresh(entry[m]));
}

/** Start a sweep for `id` unless one is already running. Never throws. */
function probeOnce(id: string, t?: ProbeTransport): Promise<void> {
  const existing = inFlight.get(id);
  if (existing) return existing;
  const run = probeModel(id, t)
    .catch(() => {})
    .finally(() => inFlight.delete(id));
  inFlight.set(id, run);
  return run;
}

/** Kick off probes for anything unmeasured, without awaiting them. Used to warm
 *  the cache after a turn has already been answered. */
export function warmCapabilities(ids: string[], t?: ProbeTransport): void {
  for (const id of ids) if (needsProbe(id)) void probeOnce(id, t);
}

/** The answer tokens that prove a model received the media, per modality. */
const EXPECT: Record<Modality, RegExp> = {
  image: /\bred\b/i,
  audio: /good morning|welcome|long recording|this test/i,
  video: /\bblue\b|good morning|welcome|long recording/i,
};

/** The answer tokens that prove it did not. A model that received the bytes
 *  cannot plausibly produce these. Exported so the turn path can apply the same
 *  judgement to a real answer that the probe applies to a probe answer.
 *
 *  Written against real refusals seen from the pool, which are wordier than a
 *  flat "no audio attached": "no audio file came through", "the only thing I
 *  received was text", "just timestamped text". A refusal that slips past this
 *  is returned to the caller as though it were an answer, which is the exact
 *  failure the check exists to stop. */
export const MEDIA_DENIAL =
  /NO_MEDIA|no (audio|video|image|media|file|attachment)[^.!?]{0,40}(attached|provided|received|included|present|sent|came through|was attached)|(only (thing|content|text)[^.!?]{0,30}(received|got|see)|just (the )?(text|timestamped text)|nothing (came|was) (through|attached|received|sent))|didn'?t (receive|get|come through)|do not (see|hear)|don'?t (see|hear)|cannot (see|hear|process|view)|can'?t (see|hear|process)|unable to (see|hear|process)/i;

const DENY = MEDIA_DENIAL;

const PART: Record<Modality, (b64: string) => unknown> = {
  image: (b64) => ({ type: "image_url", image_url: { url: `data:image/png;base64,${b64}` } }),
  audio: (b64) => ({ type: "input_audio", input_audio: { data: b64, format: "wav" } }),
  video: (b64) => ({ type: "video_url", video_url: { url: `data:video/mp4;base64,${b64}` } }),
};

const FIXTURE: Record<Modality, string> = {
  image: PROBE_IMAGE_PNG_B64,
  audio: PROBE_SPEECH_WAV_B64,
  video: PROBE_VIDEO_MP4_B64,
};

/** A status that means "ask again later" rather than "this model cannot".
 *
 *  408/425/429 are the upstream's own throttling, and the 5xx family is it
 *  failing to answer at all. Recording either as `no` would permanently disable
 *  a capable model because of a momentary condition — which is exactly how a
 *  hardcoded verified-set went stale in the first place. */
export function isTransientStatus(status: number): boolean {
  return status === 408 || status === 425 || status === 429 || status >= 500;
}

/** Classify one probe answer. */
function verdictOf(modality: Modality, text: string): Verdict {
  if (EXPECT[modality].test(text)) return "yes";
  if (DENY.test(text)) return "no";
  // An answer that is neither a hit nor an explicit denial is inconclusive: the
  // model may have received the media and simply not used the expected word.
  // Guessing "no" here is what turns a working model into a broken one.
  return "unknown";
}

/** Probe the stale modalities for one upstream and store the results. */
async function probeModel(id: string, t?: ProbeTransport): Promise<void> {
  const send = t ?? transport;
  if (!send) return;
  const prev = store.get(id);
  const entry: Entry = prev ?? {
    id,
    image: { v: "unknown", at: 0 },
    audio: { v: "unknown", at: 0 },
    video: { v: "unknown", at: 0 },
  };
  // Sequential, not parallel: three simultaneous bodies to one upstream is the
  // shape that trips its rate limiter, and a 429 here would be misread as a
  // capability answer rather than as "ask again".
  for (const m of MODALITIES) {
    if (cellFresh(entry[m])) continue;
    const messages = [
      {
        role: "user",
        content: [
          {
            type: "text",
            text: "Answer with what you see or hear, in a few words. If you received nothing, reply exactly NO_MEDIA.",
          },
          PART[m](FIXTURE[m]),
        ],
      },
    ];
    let verdict: Verdict = "unknown";
    for (let attempt = 0; attempt < 2; attempt++) {
      const out = await send(id, messages, PROBE_MAX_TOKENS).catch(() => null);
      if (!out) break;
      if (!out.ok) {
        if (isTransientStatus(out.status)) continue; // retry once, then give up
        verdict = "no";
        break;
      }
      verdict = verdictOf(m, out.text);
      if (verdict !== "unknown") break;
    }
    entry[m] = { v: verdict, at: Date.now() };
  }
  store.set(id, entry);
}

/** Teach the map from a real turn. A turn that carried media and succeeded is
 *  stronger evidence than a probe, because it is the caller's own payload on
 *  the caller's own path.
 *
 *  `ok: false` is only evidence when the failure proves the media was not
 *  accepted — a transient status, or an explicit denial in the answer. Anything
 *  else (a timeout, a dropped connection, an unrelated 400) proves nothing and
 *  is ignored, so ordinary flakiness cannot erode a correct verdict. */
export function recordOutcome(
  id: string,
  modality: Modality,
  ok: boolean,
  status?: number,
  detail?: string,
): void {
  if (!ok) {
    if (status !== undefined && isTransientStatus(status)) return;
    if (!detail || !DENY.test(detail)) return;
  }
  const prev = store.get(id);
  const entry: Entry = prev ?? {
    id,
    image: { v: "unknown", at: 0 },
    audio: { v: "unknown", at: 0 },
    video: { v: "unknown", at: 0 },
  };
  entry[modality] = { v: ok ? "yes" : "no", at: Date.now() };
  store.set(id, entry);
}

/** Test seam: drop everything measured so far. */
export function resetCapabilities(): void {
  store.clear();
  inFlight.clear();
}
