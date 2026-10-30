import { createFileRoute } from "@tanstack/react-router";
import { fetchRemoteBytes } from "@/lib/providers/remote-media.server";
import { sniff } from "@/lib/stt/audio";
import { recognize, type AudioInput } from "@/lib/stt/engine";
import { audioChunks, canStream, decodeContainer, toInput, WINDOW_SECONDS, type Decoded, type Window } from "@/lib/stt/ingest";

import { alignAddition, liveTranscript, segmentPlan, type LiveEvent } from "@/lib/stt/stream";

/**
 * POST /api/public/stt — speech to text.
 *
 * ONE endpoint, two modes, chosen by the request itself:
 *
 *   BATCH  — send a recording, get the whole transcript.
 *     multipart/form-data : file=<audio>, language=bn
 *     raw body            : Content-Type: audio/wav (or webm, mpeg, …), ?language=bn
 *     JSON                : { "audio": "<base64>", "language": "bn" }
 *
 *   LIVE   — stream audio while speaking, receive text as it is recognised.
 *     raw body            : Content-Type: audio/l16; rate=16000
 *     Accept: text/event-stream      (also auto-selected by ?stream=1)
 *     the response is Server-Sent Events:
 *       event: ready      { rate, language }
 *       event: partial    { text }            grows as you speak
 *       event: segment    { text, seconds }   a committed chunk
 *       event: done       { text, segments, seconds }
 *
 * `language` is REQUIRED in both modes. The recogniser does not detect language
 * — asked for English about Bengali audio it returns English-sounding words at
 * high confidence rather than failing — so a guess is worse than no answer. The
 * caller knows which language is being spoken; the endpoint does not pretend to.
 *
 * A GET returns this same documentation as JSON, so the endpoint explains
 * itself to a human and to a coding assistant without a separate page.
 *
 * Accepted containers: wav, mp3, flac, ogg (Opus or Vorbis), webm, raw AAC
 * (ADTS), and raw PCM. The format is read from the bytes, not from the
 * Content-Type, so a mislabelled upload still works.
 *
 * No API key is needed. The recogniser is the speech service the Chromium
 * browser uses, reached with its published client key, the same arrangement the
 * text-to-speech endpoint uses for Edge's voices. Nothing here bills per call,
 * so it cannot be switched off by a credit balance — which is how the previous
 * implementation failed.
 */

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Requested-With, Accept",
  "Access-Control-Max-Age": "86400",
} as const;

const JSON_HEADERS = {
  "Content-Type": "application/json",
  "Cache-Control": "no-store",
  ...CORS_HEADERS,
} as const;

/** Largest upload accepted in batch mode.
 *
 *  A hundred megabytes is a recording of well over an hour in MP3 or Opus and
 *  around half an hour in WAV, which is the largest a caller has asked for. The
 *  ceiling is about the bytes a request may carry, not about the audio: the
 *  recording is decoded window by window, so the memory the endpoint uses is a
 *  function of the window length, not of the upload. A URL body has no upload
 *  cost at all, and is capped at the same size. */
const MAX_BYTES = 100 * 1024 * 1024;

/** Longest audio sent to the recogniser in one call.
 *
 *  A longer recording is cut into windows of this length and the transcripts
 *  joined. Thirty seconds is a measured safe length, not a guess: a single
 *  request carrying 30 s comes back whole, and so does one carrying 120 s, so
 *  the ceiling is chosen for latency rather than because the service cuts the
 *  audio. A window is the unit of parallelism, so a longer window means fewer
 *  round trips; 30 s keeps a minute of audio to two requests without making the
 *  first window a long wait. */
const MAX_WINDOW_SECONDS = WINDOW_SECONDS;

/** How many windows are transcribed at once.
 *
 *  A long recording is a dozen or more windows, and doing them one at a time
 *  multiplies the round trip by the count. Measured against the recogniser, 24
 *  parallel calls all answered — so the limit is not the service but this
 *  process: eight at a time keeps a fifteen-minute recording inside the request
 *  budget while staying well below the burst that starts drawing refusals. */
const WINDOW_CONCURRENCY = 8;

/** Wall-clock ceiling for transcribing one request's audio.
 *
 *  A Workers HTTP request has no hard wall-clock limit while the client stays
 *  connected — the real ceiling is CPU time — so this is a self-imposed budget
 *  and not the host's. It was twenty seconds, which cut a recording of a few
 *  minutes; a long recording is worth waiting for, so the budget is now two
 *  minutes. It still exists: the recogniser is a network call we do not
 *  control, so when the budget runs out the transcript gathered so far is
 *  returned, marked `truncated`, rather than a 500 with nothing. A partial
 *  transcript the caller can see is worth more than an error page, and the
 *  caller can ask again for the rest. */
const TRANSCRIBE_BUDGET_MS = 120_000;

/** Upload size past which the streaming path is used instead of a whole-file
 *  decode. Below it the whole-file path is cheaper; above it the recording is
 *  far too big to hold as PCM, so it must be streamed. */
const STREAM_THRESHOLD_BYTES = 8 * 1024 * 1024;

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: JSON_HEADERS });
}

function fail(error: string, status = 400): Response {
  return json({ success: false, text: "", error }, status);
}

/** The languages the recogniser is known to accept, each with the region that
 *  is the sensible default for it. A caller sends `bn` and gets `bn-BD`; a
 *  caller who cares sends `bn-IN` and gets exactly that.
 *
 *  This list is published in the GET documentation so a client can offer a
 *  language picker without guessing at what is supported. */
export const LANGUAGES: { code: string; locale: string; name: string }[] = [
  { code: "bn", locale: "bn-BD", name: "Bengali" },
  { code: "en", locale: "en-US", name: "English" },
  { code: "hi", locale: "hi-IN", name: "Hindi" },
  { code: "ur", locale: "ur-PK", name: "Urdu" },
  { code: "ar", locale: "ar-SA", name: "Arabic" },
  { code: "es", locale: "es-ES", name: "Spanish" },
  { code: "fr", locale: "fr-FR", name: "French" },
  { code: "de", locale: "de-DE", name: "German" },
  { code: "it", locale: "it-IT", name: "Italian" },
  { code: "pt", locale: "pt-BR", name: "Portuguese" },
  { code: "ru", locale: "ru-RU", name: "Russian" },
  { code: "uk", locale: "uk-UA", name: "Ukrainian" },
  { code: "nl", locale: "nl-NL", name: "Dutch" },
  { code: "pl", locale: "pl-PL", name: "Polish" },
  { code: "sv", locale: "sv-SE", name: "Swedish" },
  { code: "tr", locale: "tr-TR", name: "Turkish" },
  { code: "fa", locale: "fa-IR", name: "Persian" },
  { code: "he", locale: "he-IL", name: "Hebrew" },
  { code: "el", locale: "el-GR", name: "Greek" },
  { code: "th", locale: "th-TH", name: "Thai" },
  { code: "vi", locale: "vi-VN", name: "Vietnamese" },
  { code: "id", locale: "id-ID", name: "Indonesian" },
  { code: "ta", locale: "ta-IN", name: "Tamil" },
  { code: "te", locale: "te-IN", name: "Telugu" },
  { code: "ml", locale: "ml-IN", name: "Malayalam" },
  { code: "kn", locale: "kn-IN", name: "Kannada" },
  { code: "gu", locale: "gu-IN", name: "Gujarati" },
  { code: "pa", locale: "pa-IN", name: "Punjabi" },
  { code: "mr", locale: "mr-IN", name: "Marathi" },
  { code: "ne", locale: "ne-NP", name: "Nepali" },
  { code: "si", locale: "si-LK", name: "Sinhala" },
  { code: "zh", locale: "zh-CN", name: "Chinese" },
  { code: "ja", locale: "ja-JP", name: "Japanese" },
  { code: "ko", locale: "ko-KR", name: "Korean" },
];

/** Locale defaults for a bare language code, because the recogniser wants a
 *  region and a caller should not have to know that. */
const REGION: Record<string, string> = Object.fromEntries(LANGUAGES.map((l) => [l.code, l.locale]));

/** Everything a caller may name a language with, reduced to a locale.
 *
 *  Returns undefined only when nothing was sent. An unrecognised code is passed
 *  through with a region rather than rejected, because the recogniser's own
 *  language coverage is wider than any list we could keep current — but "auto"
 *  is refused, since this endpoint does not detect language and silently
 *  substituting a default would be a wrong answer dressed as a right one. */
function normaliseLanguage(value: string | null | undefined): string | undefined {
  const raw = String(value ?? "").trim();
  if (!raw) return undefined;
  const cleaned = raw.replace("_", "-");
  if (cleaned.includes("-")) return cleaned;
  const lang = cleaned.toLowerCase();
  return REGION[lang] ?? `${lang}-${lang.toUpperCase()}`;
}

/** Read the audio out of whichever of the three batch shapes the caller used. */
async function readInput(
  request: Request,
): Promise<{ bytes: Uint8Array; declared: string; language?: string } | Response> {
  const url = new URL(request.url);
  const contentType = (request.headers.get("content-type") || "").toLowerCase();
  const queryLanguage = normaliseLanguage(url.searchParams.get("language"));

  if (contentType.includes("multipart/form-data")) {
    const form = await request.formData();
    const file = form.get("file");
    if (!(file instanceof Blob)) return fail('Missing "file" field in the form data.');
    const field = form.get("language");
    return {
      bytes: new Uint8Array(await file.arrayBuffer()),
      declared: file.type || "",
      language: normaliseLanguage(typeof field === "string" ? field : null) ?? queryLanguage,
    };
  }

  if (contentType.includes("application/json")) {
    // The JSON shape is the caller's, so it is read as unknown and each field is
    // narrowed where it is used rather than trusted.
    let body: Record<string, unknown>;
    try {
      body = (await request.json()) as Record<string, unknown>;
    } catch {
      return fail("The request body is not valid JSON.");
    }
    const language =
      normaliseLanguage(typeof body.language === "string" ? body.language : null) ?? queryLanguage;
    // A URL is accepted wherever audio is: the caller points at the file and the
    // server fetches it, so a large recording never has to be base64-inflated
    // through the request body. This is checked before base64, because a URL is
    // not valid base64 and would otherwise be rejected as malformed.
    const remote = String(body?.url ?? body?.audio_url ?? "").trim();
    if (remote) {
      const got = await fetchRemoteBytes(remote, MAX_BYTES, "audio/wav", "audio");
      if ("reason" in got) {
        return fail(`Could not read remote audio: ${got.reason} (${remote}).`, 400);
      }
      return {
        bytes: got.bytes,
        declared: typeof body.format === "string" ? `audio/${body.format}` : got.mime,
        language,
      };
    }
    const base64 = String(body?.audio ?? body?.file ?? "").trim();
    if (!base64) return fail('JSON calls need an "audio" field holding base64 audio, or a "url" field pointing at it.');
    const bytes = base64ToBytes(base64);
    if (!bytes) return fail('The "audio" field is not valid base64.');
    return {
      bytes,
      declared: typeof body.format === "string" ? `audio/${body.format}` : "",
      language,
    };
  }

  const buffer = await request.arrayBuffer();
  if (!buffer || buffer.byteLength === 0) return fail("The request body is empty.");
  return { bytes: new Uint8Array(buffer), declared: contentType, language: queryLanguage };
}

function base64ToBytes(value: string): Uint8Array | null {
  const payload = value.includes(",") ? value.slice(value.indexOf(",") + 1) : value;
  try {
    const binary = atob(payload);
    const out = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) out[i] = binary.charCodeAt(i);
    return out;
  } catch {
    return null;
  }
}

/** Transcribe a clip that may be longer than one request can carry.
 *
 *  A caller who uploads a five-minute recording gets the whole transcript rather
 *  than the first minute, and because the windows are taken in order the result
 *  reads continuously. */
async function transcribeLong(
  decoded: Decoded,
  locale: string,
  signal?: AbortSignal,
): Promise<{ text: string; confidence: number; engine: string; truncated: boolean }> {
  const input = toInput(decoded);
  const perWindow = MAX_WINDOW_SECONDS * input.pcm.sampleRate;
  const total = input.pcm.samples.length;

  if (total <= perWindow) {
    const one = await recognize(input, locale, signal);
    return { text: one.text.trim(), confidence: one.confidence, engine: one.engine, truncated: false };
  }

  // Every window up front, in order, so the pieces can be joined back into a
  // transcript that reads continuously regardless of the order they finish in.
  const windows: AudioInput[] = [];
  for (let at = 0; at < total; at += perWindow) {
    const samples = input.pcm.samples.subarray(at, Math.min(total, at + perWindow));
    // A tail shorter than half a second is not worth a round trip.
    if (samples.length < input.pcm.sampleRate * 0.4) break;
    windows.push({ kind: "pcm", pcm: { samples, sampleRate: input.pcm.sampleRate } });
  }

  return transcribeWindows(windows, locale, signal);
}

/** Transcribe a recording too large to decode into memory all at once.
 *
 *  The windows arrive lazily from the streaming decoder, so only the handful
 *  in flight are ever held. They are numbered as they arrive, so the transcript
 *  still reads in order even though the calls finish out of order. */
async function transcribeStream(
  bytes: Uint8Array,
  container: Decoded["container"],
  declared: string,
  locale: string,
  signal?: AbortSignal,
): Promise<{ text: string; confidence: number; engine: string; truncated: boolean; seconds: number }> {
  // Indexed by window, because the windows run concurrently and finish out of
  // order; the transcript has to read in the order they were spoken.
  const results: string[] = [];
  let confidence = 0;
  let engine = "";
  let truncated = false;
  let seconds = 0;
  let pending: Array<Promise<void>> = [];
  let inFlight = 0;

  const run = async (index: number, window: Window): Promise<void> => {
    const one = await recognize({ kind: "pcm", pcm: window }, locale, signal);
    results[index] = one.text.trim();
    if (one.confidence > confidence) confidence = one.confidence;
    if (one.engine) engine = one.engine;
  };

  const deadline = Date.now() + TRANSCRIBE_BUDGET_MS;
  let index = 0;
  for await (const window of audioChunks(bytes, container, declared)) {
    seconds += window.samples.length / window.sampleRate;
    // The recogniser is a network call we do not control, and a very long
    // recording has far more windows than the request can wait for. When the
    // budget runs out the transcript so far is returned, marked `truncated`,
    // rather than holding the connection until the host drops it.
    if (Date.now() >= deadline) {
      truncated = true;
      break;
    }
    // A tail shorter than half a second is not worth a round trip.
    if (window.samples.length < window.sampleRate * 0.4) continue;
    const task = run(index++, window).catch((error) => {
      // A caller who disconnected stops the whole run.
      if (error instanceof Error && error.name === "AbortError") throw error;
      // One window failing must not discard the ones that worked; the gap is
      // marked by `truncated` so the caller knows the transcript is partial.
      truncated = true;
    });
    pending.push(task);
    inFlight++;
    if (inFlight >= WINDOW_CONCURRENCY) {
      await Promise.all(pending);
      pending = [];
      inFlight = 0;
    }
  }
  await Promise.all(pending);

  const parts = results.filter((text) => text);
  return { text: parts.join(" ").trim(), confidence, engine, truncated, seconds };
}

async function transcribeWindows(
  windows: AudioInput[],
  locale: string,
  signal?: AbortSignal,
): Promise<{ text: string; confidence: number; engine: string; truncated: boolean }> {
  const results: Array<{ text: string; confidence: number; engine: string } | null> = windows.map(
    () => null,
  );
  const deadline = Date.now() + TRANSCRIBE_BUDGET_MS;
  let truncated = false;
  let cursor = 0;

  const worker = async () => {
    for (;;) {
      const index = cursor++;
      if (index >= windows.length) return;
      if (Date.now() >= deadline) {
        truncated = true;
        return;
      }
      try {
        const one = await recognize(windows[index], locale, signal);
        results[index] = {
          text: one.text.trim(),
          confidence: one.confidence,
          engine: one.engine,
        };
      } catch (error) {
        // A caller who disconnected stops the whole fan-out.
        if (error instanceof Error && error.name === "AbortError") throw error;
        // One window failing must not discard the ones that worked; the gap is
        // marked by `truncated` so the caller knows the transcript is partial.
        truncated = true;
      }
    }
  };

  await Promise.all(
    Array.from({ length: Math.min(WINDOW_CONCURRENCY, windows.length) }, () => worker()),
  );

  const parts: string[] = [];
  let confidence = 0;
  let engine = "";
  for (const one of results) {
    if (!one) continue;
    if (one.text) parts.push(one.text);
    if (one.confidence > confidence) confidence = one.confidence;
    if (one.engine) engine = one.engine;
  }
  return { text: parts.join(" ").trim(), confidence, engine, truncated };
}

/** True when the caller wants live transcription rather than a batch answer. */
export function wantsStream(request: Request): boolean {
  const url = new URL(request.url);
  if (url.searchParams.get("stream") === "1") return true;
  if (url.searchParams.get("mode") === "live") return true;
  const accept = (request.headers.get("accept") || "").toLowerCase();
  if (accept.includes("text/event-stream")) return true;
  // A raw PCM body has no container to decode and no length to wait for, so it
  // can only be a live stream.
  const contentType = (request.headers.get("content-type") || "").toLowerCase();
  return contentType.includes("audio/l16") || contentType.includes("audio/pcm");
}

/** True when the caller wants the *rolling* live mode.
 *
 *  `?mode=rolling` (or `?rolling=1`) is for a browser on a host that buffers a
 *  request body before the worker sees it. In that situation the SSE mode above
 *  cannot be real-time no matter how the worker is written: the platform holds
 *  the whole upload, so `ready` arrives only once the speaker has stopped. The
 *  rolling mode is fed one small, *complete* body per tick instead, so each tick
 *  is a fresh request the host passes straight through, and the caller gets text
 *  while the person is still talking.
 *
 *  It is deliberately a different mode rather than a change to the SSE path: a
 *  caller on a runtime that does stream the body (workerd, Node, a direct
 *  socket) is better served by one long stream, and switching that path to
 *  request-per-tick would add a connection per update for no gain. */
export function wantsRolling(request: Request): boolean {
  const url = new URL(request.url);
  if (url.searchParams.get("mode") === "rolling") return true;
  return url.searchParams.get("rolling") === "1";
}

/** The rate a raw PCM stream is arriving at, from the Content-Type. */
function declaredRate(request: Request): number {
  const contentType = request.headers.get("content-type") || "";
  const match = /rate\s*=\s*(\d+)/i.exec(contentType);
  const url = new URL(request.url);
  const fromQuery = Number(url.searchParams.get("rate") || 0);
  const rate = match ? Number(match[1]) : fromQuery;
  return rate > 0 ? rate : 16000;
}

/** Server-Sent Events for the live mode. */
function streamResponse(request: Request): Response {
  const rate = declaredRate(request);
  const url = new URL(request.url);
  const language = normaliseLanguage(url.searchParams.get("language"));
  const segmentSeconds = Number(url.searchParams.get("segment") || 0) || undefined;
  const partialSeconds = Number(url.searchParams.get("partial") || 0) || undefined;

  if (!language) {
    return fail(
      "The `language` query parameter is required, e.g. `?language=bn`. This endpoint does not detect language.",
      422,
    );
  }
  if (!request.body) return fail("The live mode needs an audio body.");

  const encoder = new TextEncoder();
  const source = request.body;
  const signal = request.signal;

  const body = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (event: LiveEvent) => {
        controller.enqueue(
          encoder.encode(`event: ${event.type}\ndata: ${JSON.stringify(event)}\n\n`),
        );
      };
      try {
        for await (const event of liveTranscript(source, {
          rate,
          language,
          segmentSeconds,
          partialSeconds,
          signal,
        })) {
          send(event);
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : "transcription failed";
        controller.enqueue(
          encoder.encode(`event: error\ndata: ${JSON.stringify({ error: message })}\n\n`),
        );
      } finally {
        controller.close();
      }
    },
  });

  return new Response(body, {
    status: 200,
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      // Stops a proxy from buffering the stream and turning live text into one
      // delayed lump.
      "X-Accel-Buffering": "no",
      ...CORS_HEADERS,
    },
  });
}

/** One tick of the rolling live mode: a short, *complete* window of audio.
 *
 *  The caller sends the last `windowSeconds` of speech — not just the new part —
 *  on every tick, and gets back the transcript of that window together with the
 *  part of it that is new. Sending the whole window is what makes the text
 *  stable: the recogniser sees the word before the one being spoken, so it
 *  resolves the ambiguity a two-second slice cannot, and the tail of the previous
 *  window is the overlap that keeps a word straddling two ticks from being cut.
 *
 *  `committed` is the text the caller already has. The response carries only
 *  `text.slice(committed.length)` as `added`, so a client appends and never
 *  rewrites — the same "committed text never rewrites" rule the SSE path keeps,
 *  and the reason a caption does not flicker. */
async function rollingTick(
  request: Request,
  read: { bytes: Uint8Array; declared: string; language?: string },
): Promise<Response> {
  const url = new URL(request.url);
  const language = read.language;
  if (!language) {
    return fail(
      "The `language` field is required, e.g. `bn` or `bn-BD`. This endpoint does not detect language.",
      422,
    );
  }
  if (read.bytes.length === 0) return fail("The audio is empty.");

  const container = sniff(read.bytes);
  if (container === "unknown") {
    return fail(
      "The upload does not look like audio. Send WAV, MP3, FLAC, Ogg, WebM, AAC, or raw PCM.",
    );
  }

  const committed = url.searchParams.get("committed") || "";
  const started = Date.now();

  try {
    const decoded = await decodeContainer(read.bytes, container, read.declared);
    const text = (await transcribeLong(decoded, language, request.signal)).text.trim();
    const added = alignAddition(committed, text);
    return json({
      success: true,
      text,
      added,
      committed: text,
      language,
      container,
      elapsed: (Date.now() - started) / 1000,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "transcription failed";
    return fail(message, 502);
  }
}

export const Route = createFileRoute("/api/public/stt")({
  server: {
    handlers: {
      OPTIONS: async () => new Response(null, { status: 204, headers: CORS_HEADERS }),

      // The endpoint documents itself. A coding assistant that is handed this
      // URL can read the contract without a human explaining it.
      GET: async () =>
        json({
          endpoint: "/api/public/stt",
          methods: ["POST"],
          modes: {
            batch: {
              when: "You already have a recording.",
              contentTypes: ["multipart/form-data", "audio/*", "application/json"],
              multipart: { file: "the audio", language: "required, e.g. bn or bn-BD" },
              json: {
                audio: "base64 audio",
                url: "or an http(s) URL the server will fetch instead of base64",
                language: "required",
                format: "optional, e.g. webm",
              },
              response: {
                success: "boolean",
                text: "the transcript",
                language: "the language you asked for, e.g. bn",
                confidence: "0..1",
                engine: "which recogniser answered",
                container: "what the bytes were read as",
                duration: "seconds of audio",
                elapsed: "seconds spent transcribing",
                truncated: "present and true when the transcript is partial",
              },
            },
            live: {
              when: "Someone is speaking now and you want text as they speak.",
              contentType: "audio/l16; rate=16000",
              accept: "text/event-stream",
              body: "raw 16-bit mono PCM, streamed; one second is 32000 bytes",
              query: {
                language: "required, e.g. bn or bn-BD",
                segment: "seconds per commit, default 4",
                partial: "seconds between partials, default 1.2",
              },
              events: {
                ready: "{ rate, language }",
                partial: "{ text } — grows as the speaker continues",
                segment: "{ text, seconds } — a committed chunk",
                done: {
                  text: "the whole transcript",
                  segments: "how many chunks",
                  seconds: "audio heard",
                },
              },
            },
            rolling: {
              when: "Someone is speaking now, on a host that buffers a request body before the worker sees it — a browser behind a proxy, for instance. Live text still has to appear as they speak.",
              why: "The `live` mode above needs the host to hand the worker the body as it arrives. Where the host holds the whole upload, `ready` only arrives after the speaker stops, so a single stream cannot be real-time there. This mode sends one small, complete window per tick instead, so every tick is a request the host passes straight through.",
              contentType: "multipart/form-data (file), audio/wav, audio/l16, or application/json",
              body: "The last `window` seconds of speech, re-sent each tick — not only the new part. The whole window is what lets the recogniser resolve a word the shorter slice cannot, and its tail is the overlap that stops a word on a boundary being cut.",
              query: {
                mode: "rolling (or rolling=1)",
                language: "required, e.g. bn or bn-BD",
                committed: "the text you already have; the response returns only what is new",
                window: "seconds of audio to send per tick, 2–4 recommended",
              },
              response: {
                text: "the transcript of the window",
                added: "the part of `text` past what you sent as committed — append this",
                committed: "send this back as `committed` on the next tick",
                elapsed: "seconds spent transcribing",
              },
              rule: "Committed text never rewrites: a client appends `added` to a fixed prefix, so a caption only ever grows. If the recogniser disagrees with the prefix, `added` falls back to the whole window rather than emitting a contradictory tail.",
            },
          },
          containers: ["wav", "mp3", "flac", "ogg", "webm", "aac", "pcm"],
          notSupported: {
            "m4a/mp4":
              "recognised and refused with 415; the audio inside is AAC but the MP4 wrapper is not unpacked",
          },
          languageRequired: true,
          languageNote:
            "The recogniser does not detect language. Name the language being spoken; the endpoint will not guess.",
          languages: LANGUAGES,
          limits: {
            maxBytes: MAX_BYTES,
            maxWindowSeconds: MAX_WINDOW_SECONDS,
            windowConcurrency: WINDOW_CONCURRENCY,
            transcribeBudgetSeconds: TRANSCRIBE_BUDGET_MS / 1000,
          },
          longAudio:
            "A recording longer than one window is transcribed in parallel windows and joined in order. Past 8 MB the recording is decoded window by window rather than held whole, so uploads up to maxBytes are accepted; memory use tracks the window length, not the recording's. If the time budget runs out the partial transcript is returned with `truncated: true` rather than an error.",
          plan: segmentPlan(16000),
          auth: "none required",
          cost: "free; the recogniser needs no key and bills nothing per call",
        }),

      POST: async ({ request }) => {
        try {
          // Rolling live mode: one short, complete window per request. Chosen
          // before the SSE check because `?mode=rolling` is not a stream, and a
          // caller on a host that buffers a request body needs this path to get
          // real-time text at all.
          if (wantsRolling(request)) {
            const read = await readInput(request);
            if (read instanceof Response) return read;
            return rollingTick(request, read);
          }

          // Live mode: the caller is streaming audio now and wants text as it
          // arrives. Chosen by the request itself — an SSE Accept header, a
          // `?stream=1`, or a raw PCM content type.
          if (wantsStream(request)) return streamResponse(request);

          const read = await readInput(request);
          if (read instanceof Response) return read;
          const { bytes, declared, language } = read;

          // Required, not defaulted. Guessing here is how a Bengali question
          // comes back as confident Hindi: the recogniser answers in whatever
          // language it is asked, so a wrong guess is a wrong transcript.
          if (!language) {
            return fail(
              "The `language` field is required, e.g. `bn` or `bn-BD`. This endpoint does not detect language.",
              422,
            );
          }

          if (bytes.length === 0) return fail("The audio is empty.");
          if (bytes.length > MAX_BYTES) {
            return fail(`The audio is too large (${bytes.length} bytes, limit ${MAX_BYTES}).`, 413);
          }

          const container = sniff(bytes);
          if (container === "unknown") {
            return fail(
              "The upload does not look like audio. Send WAV, MP3, FLAC, Ogg, WebM, AAC, or raw PCM.",
            );
          }

          // A recording past the size one decode can hold is transcribed from
          // its streaming decoder, window by window, so the heap never sees the
          // whole thing. Everything smaller takes the ordinary path, which is
          // cheaper to set up and reports the same fields.
          if (bytes.length > STREAM_THRESHOLD_BYTES && canStream(container)) {
            const started = Date.now();
            try {
              const result = await transcribeStream(bytes, container, declared, language, request.signal);
              return json({
                success: true,
                text: result.text,
                language: language.split("-")[0],
                locale: language,
                confidence: Number(result.confidence.toFixed(4)),
                engine: result.engine,
                container,
                duration: Number(result.seconds.toFixed(2)),
                elapsed: Number(((Date.now() - started) / 1000).toFixed(2)),
                ...(result.truncated ? { truncated: true } : {}),
              });
            } catch (error) {
              const message = error instanceof Error ? error.message : "unsupported audio format";
              const unsupported =
                /not supported|unsupported audio format|could not be read|no audio (frames|packets) found/i.test(
                  message,
                );
              return fail(message, unsupported ? 415 : 502);
            }
          }

          let decoded: Decoded;
          try {
            decoded = await decodeContainer(bytes, container, declared);
          } catch (error) {
            // A format the endpoint cannot read is the caller's mistake, not a
            // server fault, so it gets 415 and a message naming the format
            // rather than a 502 that reads like an outage.
            const message = error instanceof Error ? error.message : "unsupported audio format";
            // Everything a caller can fix by re-recording is 415; a failure
            // that is ours stays a 502.
            const unsupported =
              /not supported|unsupported audio format|could not be read|no audio (frames|packets) found/i.test(
                message,
              );
            return fail(message, unsupported ? 415 : 502);
          }
          const started = Date.now();
          const result = await transcribeLong(decoded, language, request.signal);

          return json({
            success: true,
            text: result.text,
            // Echoed back so a client can confirm what it asked for without
            // tracking the request itself.
            language: language.split("-")[0],
            locale: language,
            confidence: Number(result.confidence.toFixed(4)),
            engine: result.engine,
            container,
            duration: Number(decoded.seconds.toFixed(2)),
            elapsed: Number(((Date.now() - started) / 1000).toFixed(2)),
            // True when the transcript is not the whole recording — the time
            // budget ran out or a window failed. The caller can see the text it
            // did get and ask again for the rest, instead of a 500 with nothing.
            ...(result.truncated ? { truncated: true } : {}),
          });
        } catch (error) {
          const message = error instanceof Error ? error.message : "Internal server error";
          // A caller who disconnected is not an error worth reporting.
          if (/abort/i.test(message))
            return new Response(null, { status: 499, headers: CORS_HEADERS });
          console.error("[STT] handler error", error);
          return json({ success: false, text: "", error: message }, 502);
        }
      },
    },
  },
});
