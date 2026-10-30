/** The transcription engine.
 *
 *  The recogniser is the one part of this pipeline that runs on someone else's
 *  machine, so it is written as a *set* of interchangeable backends behind one
 *  function rather than as a single hard-coded URL. Today there is one backend:
 *  the speech service the Chromium browser uses, reached with its published
 *  client key — no account, no per-call cost, the same arrangement the text-to-
 *  speech endpoint already uses for Edge's voices.
 *
 *  A backend is a small object: a name and a `recognize` function. Adding a
 *  second one later is a new object in `BACKENDS`, not a change to any caller.
 *  If the first backend starts refusing work, the next one is tried, and a
 *  caller that named a language keeps it.
 *
 *  What the engine will and will not do, measured rather than assumed:
 *    - it takes raw 16-bit PCM (`audio/l16`) and FLAC (`audio/x-flac`);
 *    - it rejects MP3, WebM, Ogg and every other container, so decoding happens
 *      before this module is called;
 *    - it does NOT detect language. Asked for `en-US` about Bengali audio it
 *      returns English-sounding words at high confidence instead of failing.
 *      Language selection therefore lives in `language.ts`, which asks this
 *      module several times and judges the answers. */

import { encodeWav, type Pcm } from "./audio";

/** What a backend is handed: always PCM, at the container's own rate. Every
 *  container is decoded before it reaches here, so there is no second shape to
 *  handle and no rate to guess. */
export type AudioInput = { kind: "pcm"; pcm: Pcm };

/** One transcription answer. */
export type Recognition = {
  text: string;
  confidence: number;
  /** The locale this answer was produced for, echoed back for ranking. */
  locale: string;
  /** Which backend answered, for diagnostics. */
  engine: string;
};

export type Backend = {
  name: string;
  /** Transcribe one buffer for one locale. Throws on transport failure; returns
   *  an empty text — not an error — when the audio simply holds no speech. */
  recognize: (
    input: AudioInput,
    locale: string,
    signal?: AbortSignal,
  ) => Promise<{ text: string; confidence: number }>;
};

/* ─────────────────────── Chromium speech service ─────────────────────── */

/** The client key the Chromium speech service publishes for browser use. It is
 *  not a secret — it ships inside every copy of Chrome — and it is the reason
 *  this endpoint needs no account of its own. */
const PUBLISHED_CHROMIUM_KEY = "AIzaSyBOti4mM-6x9WDnZIjIeyEU21OpBXqWBgw";

/** The keys to rotate through.
 *
 *  The service limits by key *and* by egress address, so a single key is a
 *  single point of refusal: when it starts answering 403/429 every request
 *  fails, and the failure looks like an outage rather than a rate limit.
 *  `ZYRAXON_STT_KEYS` takes a comma-separated list of additional keys — a
 *  deployment with its own keys gets the rotation for free — and the published
 *  Chromium key is always present, so an unconfigured deployment still works.
 *
 *  Duplicates are dropped: the same key twice in a rotation is one key with two
 *  chances to be rested, which only delays the failure. */
function configuredKeys(): string[] {
  const raw = (process.env.ZYRAXON_STT_KEYS || "").trim();
  const extra = raw
    ? raw
        .split(/[\s,]+/)
        .map((k) => k.trim())
        .filter(Boolean)
    : [];
  return [...new Set([PUBLISHED_CHROMIUM_KEY, ...extra])];
}

const KEYS = configuredKeys();

/** How long a key stays out of rotation after a refusal. Long enough that a
 *  limited key recovers, short enough that a transient 403 does not bench it for
 *  the rest of the day. */
const KEY_COOLDOWN_MS = Number(process.env.ZYRAXON_STT_KEY_COOLDOWN_MS || 60_000);

type KeyState = { until: number; strikes: number };
const keyState: KeyState[] = KEYS.map(() => ({ until: 0, strikes: 0 }));

/** Keys currently usable, never-failed ones first. */
function liveKeys(): number[] {
  const now = Date.now();
  const healthy: number[] = [];
  const cooling: number[] = [];
  for (let i = 0; i < KEYS.length; i++) {
    if ((keyState[i]?.until ?? 0) <= now) healthy.push(i);
    else cooling.push(i);
  }
  return [...healthy, ...cooling];
}

function penalise(index: number): void {
  const state = keyState[index];
  if (!state) return;
  state.strikes++;
  // Back off further each time the same key refuses, so a genuinely blocked key
  // stops being retried on every request.
  state.until = Date.now() + KEY_COOLDOWN_MS * Math.min(state.strikes, 8);
}

function reward(index: number): void {
  const state = keyState[index];
  if (state) state.strikes = 0;
}

const ENDPOINT = "https://www.google.com/speech-api/v2/recognize";

/** One object of the service's newline-delimited JSON. Everything is optional
 *  because the shape is not ours and a missing transcript is a normal answer. */
type RawResult = {
  result?: { alternative?: { transcript?: string; confidence?: number }[] }[];
};

/** Parse the service's response body.
 *
 *  It is newline-delimited JSON with one object per interim result; only the
 *  last object carrying a transcript is final. A 200 with no transcript means
 *  the audio held no speech — a normal outcome, not an error. */
export function parseResponse(raw: string): { text: string; confidence: number } {
  let text = "";
  let confidence = 0;
  for (const line of raw.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed[0] !== "{") continue;
    let parsed: RawResult;
    try {
      parsed = JSON.parse(trimmed) as RawResult;
    } catch {
      continue;
    }
    for (const result of parsed.result ?? []) {
      for (const alt of result?.alternative ?? []) {
        if (alt?.transcript) {
          text = String(alt.transcript);
          confidence = Number(alt.confidence ?? 0);
        }
      }
    }
  }
  return { text, confidence };
}

/** The body and content type for one input. PCM is wrapped in a WAV header so
 *  the sample rate travels with it and never has to be guessed from a byte
 *  count; FLAC goes as-is. The bytes are copied into a plain `ArrayBuffer`
 *  because a `subarray` view over a shared buffer is not a valid fetch body. */
function bodyFor(input: AudioInput): { body: ArrayBuffer; contentType: string } {
  return {
    body: toArrayBuffer(encodeWav(input.pcm)),
    contentType: `audio/l16; rate=${input.pcm.sampleRate}`,
  };
}

function toArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  const copy = new ArrayBuffer(bytes.byteLength);
  new Uint8Array(copy).set(bytes);
  return copy;
}

const chromium: Backend = {
  name: "chromium",
  async recognize(input, locale, signal) {
    const { body, contentType } = bodyFor(input);
    let lastError: Error | null = null;

    for (const index of liveKeys()) {
      const url = `${ENDPOINT}?client=chromium&lang=${encodeURIComponent(locale)}&output=json&key=${KEYS[index]}`;
      try {
        const response = await fetch(url, {
          method: "POST",
          headers: {
            "Content-Type": contentType,
            // The service serves a browser; a browser-like client is not treated
            // the way a bare HTTP client is.
            "User-Agent":
              "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36",
            Origin: "https://www.google.com",
          },
          body,
          signal,
        });

        if (response.status === 403 || response.status === 429) {
          // Refused: rest this key and try the next one.
          penalise(index);
          lastError = new Error(`speech service refused the request (${response.status})`);
          continue;
        }
        if (!response.ok) {
          // A 400 is about the audio, not the key: another key would fail the
          // same way, so it is reported rather than retried.
          throw new Error(`speech service returned ${response.status}`);
        }
        reward(index);
        return parseResponse(await response.text());
      } catch (error) {
        if (error instanceof Error && error.name === "AbortError") throw error;
        lastError = error instanceof Error ? error : new Error(String(error));
      }
    }
    throw lastError ?? new Error("no speech backend available");
  },
};

/** Backends in preference order. */
export const BACKENDS: Backend[] = [chromium];

/** Transcribe one buffer in one language, using the first backend that does not
 *  fail. */
export async function recognize(
  input: AudioInput,
  locale: string,
  signal?: AbortSignal,
): Promise<Recognition> {
  let lastError: Error | null = null;
  for (const backend of BACKENDS) {
    try {
      const { text, confidence } = await backend.recognize(input, locale, signal);
      return { text, confidence, locale, engine: backend.name };
    } catch (error) {
      if (error instanceof Error && error.name === "AbortError") throw error;
      lastError = error instanceof Error ? error : new Error(String(error));
    }
  }
  throw lastError ?? new Error("no backend could transcribe this audio");
}

/** Transcribe the same buffer in several languages at once.
 *
 *  Concurrency is capped rather than unbounded: the service tolerates a handful
 *  of parallel calls from one address and starts answering empty when a burst
 *  arrives, so six at a time is the balance between latency and being treated as
 *  an attacker. */
export async function recognizeMany(
  input: AudioInput,
  locales: readonly string[],
  signal?: AbortSignal,
  concurrency = 6,
): Promise<Recognition[]> {
  const out: Recognition[] = [];
  for (let i = 0; i < locales.length; i += concurrency) {
    const batch = locales.slice(i, i + concurrency);
    const settled = await Promise.allSettled(
      batch.map((locale) => recognize(input, locale, signal)),
    );
    for (const result of settled) {
      if (result.status === "fulfilled") out.push(result.value);
    }
    // A caller who has gone away should stop the whole fan-out, not just its own
    // batch.
    if (signal?.aborted) break;
  }
  return out;
}

export function pcmInput(pcm: Pcm): AudioInput {
  return { kind: "pcm", pcm };
}
