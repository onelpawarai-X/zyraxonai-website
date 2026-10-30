/** Speech synthesis through Microsoft Edge's Read Aloud engine.
 *
 *  Every AI answer the site produces can be turned into speech here, in the
 *  language the answer was written in, and streamed back as MP3 as it is
 *  generated rather than after it finishes. The engine is the one Edge's own
 *  Read Aloud uses: the same 300+ neural voices, the same languages, and no key
 *  to buy.
 *
 *  The transport is a WebSocket. In a Workers-style runtime `fetch` can upgrade
 *  to one, so the whole turn is: open the socket, send the config, send the
 *  SSML, and forward each audio frame the server sends straight to the caller.
 *  Nothing is buffered, so the first sound reaches the user in well under a
 *  second.
 *
 *  Two things make it sound like a person rather than a machine:
 *
 *    - **Prosody.** The text goes out wrapped in `<prosody>`, so the register
 *      of a whole utterance can be set once — `warm`, `expressive`, `clear` —
 *      instead of being left at the engine's flat default. This is the only
 *      SSML the engine accepts; see `ssml()` for what it does with anything
 *      that looks like a pause.
 *    - **Breaths.** The engine pauses on the text's own punctuation — about
 *      0.36 s at a comma, 1.08 s at a sentence end — and reads a run-on with no
 *      pause as one unbroken sentence, which is the single biggest reason
 *      synthetic speech sounds synthetic. The punctuation is already in the
 *      text; the job is only to make sure the engine sees it, which is why
 *      `ssml()` normalises the spacing around a terminator. */

import { intoSentences } from "./language";
import { edgeSynthesisUrl, SEC_MS_GEC_VERSION } from "./edge-tts-token";

const AUDIO_FORMAT = "audio-24khz-48kbitrate-mono-mp3";
const OUTPUT_CONTENT_TYPE = "audio/mpeg";

/** Text past this length is spoken as several utterances, one after another.
 *
 *  The engine streams a single utterance, so length alone is not a problem for
 *  a few paragraphs. It is a problem for a whole article: one 50,000-character
 *  utterance is a synthesis the engine has to plan before it sends its first
 *  frame, and the caller waits for that plan. Chunking bounds the wait — the
 *  first sentence is spoken while the rest is still being planned — so the
 *  first audio stays under a second however long the text is. */
const SINGLE_UTTERANCE_CHARS = 2000;

export type Voice = { name: string; locale: string; gender: string; friendly?: string };

/** How an utterance should sound.
 *
 *  - `warm` (the default) — a little slower and a touch higher, the register a
 *    person uses when explaining something.
 *  - `expressive` — a little faster, higher and louder, for an answer meant to
 *    be lively.
 *  - `natural` — the engine's own rate and pitch, for a caller who wants the
 *    raw voice.
 *  - `clear` — slower, for a listener who is learning the language or is on a
 *    noisy line.
 *
 *  Every tone gets the same breathing pauses. Tone changes the delivery, not
 *  the rhythm: a pause is what makes speech intelligible, and there is no tone
 *  for which reading a sentence in one breath is better. */
export type Tone = "warm" | "expressive" | "natural" | "clear";

const TONES: Record<Tone, { rate: string; pitch: string; volume: string }> = {
  warm: { rate: "-3%", pitch: "+1Hz", volume: "+0%" },
  expressive: { rate: "+2%", pitch: "+3Hz", volume: "+4%" },
  natural: { rate: "+0%", pitch: "+0Hz", volume: "+0%" },
  clear: { rate: "-6%", pitch: "+0Hz", volume: "+0%" },
};

export const DEFAULT_TONE: Tone = "warm";

/** Narrow an untrusted value to a tone, so a query parameter cannot reach the
 *  SSML. An unknown value becomes the default rather than an error: a caller
 *  who misspells `tone` wants audio, not a 400. */
export function normaliseTone(value: unknown): Tone {
  const raw = String(value ?? "")
    .trim()
    .toLowerCase();
  return raw in TONES ? (raw as Tone) : DEFAULT_TONE;
}

/** The voice to use for a language tag, when the caller did not name one.
 *
 *  Matching is by language prefix, so `bn` finds `bn-BD-NabanitaNeural` and a
 *  caller who writes "Bengali" or "bn-IN" still gets a Bengali voice. Falling
 *  back to a fixed voice would answer a Bengali question in English, which is
 *  the one outcome that makes a spoken reply worse than none. */
export function pickVoice(locale: string, voices: Voice[], preferred?: string): string | undefined {
  if (preferred && voices.some((v) => v.name === preferred)) return preferred;
  const want = locale.trim().toLowerCase().replace("_", "-");
  if (!want) return voices.find((v) => v.locale === "en-US")?.name;
  const exact = voices.find((v) => v.locale.toLowerCase() === want);
  if (exact) return exact.name;
  const lang = want.split("-")[0]!;
  const sameLanguage = voices.filter((v) => v.locale.toLowerCase().split("-")[0] === lang);
  if (sameLanguage.length) {
    // Prefer a female neural voice, then any — the reference default is female.
    return (
      sameLanguage.find((v) => v.gender.toLowerCase() === "female")?.name ?? sameLanguage[0]!.name
    );
  }
  return voices.find((v) => v.locale === "en-US")?.name;
}

/** Escape text for SSML, so a reply containing `<` or `&` is spoken, not parsed. */
export function escapeXml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

/** True when the text is written in Bengali, so the words we insert for markup
 *  are in the same language as the words around them. */
function isBengali(text: string): boolean {
  return /[\u0980-\u09FF]/.test(text);
}

/** Strip what should never be read aloud: code, links and markup.
 *
 *  A spoken reply that reads a 40-line code block character by character is
 *  unusable. Code becomes a short spoken note, links become their label, and
 *  Markdown punctuation is removed.
 *
 *  Punctuation that carries meaning — `,` `.` `?` `!` and the Bengali danda
 *  `।` — is deliberately kept: the pauses in `ssml()` are placed on it, so
 *  removing it would flatten the delivery back into one unbroken run. A
 *  paragraph break is kept too, as a sentence break, because that is where a
 *  person pauses. */
export function speakable(text: string): string {
  const bengali = isBengali(text);
  const note = (lines: number) =>
    bengali ? ` একটি কোড ব্লক, ${lines} লাইন। ` : ` A code block, ${lines} lines. `;
  return (
    text
      // Fenced code → a short note, never the code itself. An empty fence is
      // dropped entirely rather than announced as "0 lines".
      .replace(/```[^\n]*\n([\s\S]*?)```/g, (_, body: string) => {
        const trimmed = body.trim();
        return trimmed ? note(trimmed.split("\n").length) : " ";
      })
      .replace(/`([^`]+)`/g, "$1")
      // [label](url) → label, so the URL is not read out.
      .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
      .replace(/https?:\/\/\S+/g, bengali ? " লিংক " : " a link ")
      .replace(/^#{1,6}\s*/gm, "")
      .replace(/\*\*([^*]+)\*\*/g, "$1")
      .replace(/\*([^*]+)\*/g, "$1")
      .replace(/^\s*[-*]\s+/gm, "")
      // A blank line — a paragraph break — becomes a sentence break, so a
      // paragraph is spoken with a pause rather than run into the next. A single
      // line break is only a space: prose is often hard-wrapped mid-sentence, and
      // turning that wrap into a full stop would cut a sentence in half. A break
      // after punctuation that already ends a sentence is just a space, so a
      // paragraph after "how:" is not spoken as "how:.".
      .replace(/([.!?।:;])\s*\n\s*\n\s*/g, "$1 ")
      .replace(/\s*\n\s*\n\s*/g, ". ")
      .replace(/\n/g, " ")
      .replace(/\s+/g, " ")
      .replace(/\.\s*\.\s*/g, ". ")
      .trim()
  );
}

/** Split a long text into spoken sentences.
 *
 *  The splitting itself lives in `language.ts`, which the browser-side
 *  `SpeakButton` uses too. One implementation is deliberate: a second splitter
 *  here would eventually disagree with the first about where a Bengali
 *  sentence ends, and the two halves of the feature — the client that queues
 *  sentences and the server that speaks them — would drift apart. */
export function chunkTextIntoSentences(text: string, maxChunkLength = 400): string[] {
  const pieces = intoSentences(text, maxChunkLength);
  return pieces.length ? pieces : [text];
}

/** Build the SSML for one utterance: prosody for tone, punctuation for breath.
 *
 *  **There is no `<break>` here, and there must not be.** Measured against the
 *  live engine: a request whose SSML contains `<break>` — in any spelling, with
 *  `time` or with `strength`, self-closed or not — comes back with *no audio at
 *  all*. Not a short utterance, not an error: the turn starts and ends with zero
 *  bytes. `<s>`, `<mstts:silence>` and every other pause element fail the same
 *  way, so a "natural breathing pause" implemented with SSML markup does not
 *  merely sound wrong, it silences the whole reply.
 *
 *  The pause has to come from the text, and it does: measured on the same two
 *  words, a comma adds ~0.36 s and a sentence terminator adds ~1.08 s. So the
 *  breath is punctuation — the punctuation the answer already contains — and the
 *  job here is only to make sure the engine sees it as one. A terminator with no
 *  space after it is read as part of the word and loses its pause, so the
 *  spacing is normalised. A `.` between digits is left alone: `19.0.8` is one
 *  version, not three sentences.
 *
 *  The one thing SSML *can* do is set the register of the whole utterance, which
 *  is what `<prosody>` is for. */
export function ssml(voice: string, text: string, tone: Tone = DEFAULT_TONE): string {
  const lang = voice.split("-").slice(0, 2).join("-") || "en-US";
  const { rate, pitch, volume } = TONES[tone] ?? TONES[DEFAULT_TONE];

  // Escaped first, so a `<` in the answer is already `&lt;` and cannot be
  // confused with markup. The engine reads the punctuation, not tags, for its
  // pauses — which is the only mechanism it supports.
  const spoken = escapeXml(text)
    .replace(/([^\d]),\s*/g, "$1, ")
    .replace(/;\s*/g, "; ")
    .replace(/([।?!])\s*/g, "$1 ")
    .replace(/(^|[^\d])\.\s+/g, "$1. ")
    .replace(/\s+/g, " ")
    .trim();

  return (
    `<speak version='1.0' xmlns='http://www.w3.org/2001/10/synthesis' xml:lang='${lang}'>` +
    `<voice name='${voice}'>` +
    `<prosody rate='${rate}' pitch='${pitch}' volume='${volume}'>${spoken}</prosody>` +
    `</voice></speak>`
  );
}

type WsLike = {
  accept(): void;
  send(data: string): void;
  close(): void;
  addEventListener(type: string, handler: (event: any) => void): void;
};

/** Stream one utterance as MP3. Resolves when the stream ends. */
export async function synthesize(
  text: string,
  voice: string,
  write: (chunk: Uint8Array) => void,
  tone: Tone = DEFAULT_TONE,
  signal?: AbortSignal,
): Promise<void> {
  const response: any = await fetch(edgeSynthesisUrl(), {
    headers: {
      Upgrade: "websocket",
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36 Edg/143.0.0.0",
      Origin: "chrome-extension://jdiccldimpdaibmpdkjnbmckianbfold",
      Pragma: "no-cache",
      "Cache-Control": "no-cache",
      "Sec-MS-GEC-Version": SEC_MS_GEC_VERSION,
    },
  });

  const socket: WsLike | undefined = response.webSocket;
  if (!socket) throw new Error(`edge tts refused the connection (${response.status})`);
  socket.accept();

  await new Promise<void>((resolve, reject) => {
    let settled = false;
    const finish = (error?: Error) => {
      if (settled) return;
      settled = true;
      try {
        socket.close();
      } catch {
        /* already closed */
      }
      error ? reject(error) : resolve();
    };

    signal?.addEventListener("abort", () => finish());

    socket.addEventListener("message", async (event: any) => {
      const data = event.data;
      if (typeof data === "string") {
        if (data.includes("Path:turn.end")) finish();
        return;
      }
      // Binary frames arrive as a Blob in this runtime, not an ArrayBuffer, so
      // they have to be read asynchronously. Treating them as a typed array
      // silently yields nothing, which is what made every reply come back empty.
      const buf =
        data instanceof ArrayBuffer
          ? new Uint8Array(data)
          : new Uint8Array(await (data as Blob).arrayBuffer());
      // A binary frame is a 2-byte big-endian header length, then the header,
      // then the payload. Only frames on Path:audio carry audio.
      const headerLen = (buf[0]! << 8) | buf[1]!;
      const header = new TextDecoder().decode(buf.subarray(2, 2 + headerLen));
      if (header.includes("Path:audio")) write(buf.subarray(2 + headerLen));
    });

    socket.addEventListener("close", () => finish());
    socket.addEventListener("error", () => finish(new Error("edge tts socket error")));

    const timestamp = new Date().toISOString();
    socket.send(
      `X-Timestamp:${timestamp}\r\nContent-Type:application/json; charset=utf-8\r\nPath:speech.config\r\n\r\n` +
        JSON.stringify({
          context: {
            synthesis: {
              audio: {
                metadataoptions: { sentenceBoundaryEnabled: false, wordBoundaryEnabled: false },
                outputFormat: AUDIO_FORMAT,
              },
            },
          },
        }),
    );

    socket.send(
      `X-RequestId:${crypto.randomUUID().replace(/-/g, "")}\r\n` +
        `Content-Type:application/ssml+xml\r\nX-Timestamp:${timestamp}Z\r\nPath:ssml\r\n\r\n` +
        ssml(voice, text, tone),
    );
  });
}

/** Speak a long text as several utterances, in order, into one MP3 stream.
 *
 *  Each utterance is its own socket, and the pieces are joined by
 *  concatenating MP3 frames — which is what an MP3 stream is, and why a player
 *  hears one continuous recording rather than a series of files.
 *
 *  A piece that fails is skipped rather than fatal once audio has already been
 *  sent. The caller is listening to an answer; a mid-answer hiccup that ends
 *  the stream is a broken reply, whereas the rest of the text is a shorter one.
 *  Before any audio has flowed a failure is rethrown, so the caller reports an
 *  error instead of an empty file. */
export async function synthesizeStream(
  text: string,
  voice: string,
  write: (chunk: Uint8Array) => void,
  tone: Tone = DEFAULT_TONE,
  signal?: AbortSignal,
): Promise<void> {
  const chunks = chunkTextIntoSentences(text);
  let wrote = false;
  for (const chunk of chunks) {
    if (signal?.aborted) return;
    try {
      await synthesize(
        chunk,
        voice,
        (audio) => {
          wrote = true;
          write(audio);
        },
        tone,
        signal,
      );
    } catch (error) {
      if (!wrote) throw error;
      console.error("[tts] a later chunk failed; ending after what was spoken", error);
      return;
    }
  }
}

/** A Response whose body is the spoken audio, streamed as it is produced.
 *
 *  Short text is one utterance, which is the fastest possible first byte: no
 *  second socket and no join. Long text is chunked, so the first sentence is
 *  heard while the rest is still being planned. */
export function speechResponse(
  text: string,
  voice: string,
  tone: Tone = DEFAULT_TONE,
  signal?: AbortSignal,
): Response {
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const write = (chunk: Uint8Array) => {
        try {
          controller.enqueue(chunk);
        } catch {
          /* the caller went away */
        }
      };
      try {
        if (text.length <= SINGLE_UTTERANCE_CHARS) {
          await synthesize(text, voice, write, tone, signal);
        } else {
          await synthesizeStream(text, voice, write, tone, signal);
        }
        try {
          controller.close();
        } catch {
          /* already closed */
        }
      } catch (error: unknown) {
        try {
          controller.error(error);
        } catch {
          /* already errored */
        }
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": OUTPUT_CONTENT_TYPE,
      "Cache-Control": "no-cache, no-transform",
      "Access-Control-Allow-Origin": "*",
    },
  });
}

/** The voices the engine offers, read live and cached briefly. */
let voiceCache: { at: number; voices: Voice[] } | null = null;

export async function listVoices(): Promise<Voice[]> {
  const now = Date.now();
  if (voiceCache && now - voiceCache.at < 6 * 60 * 60 * 1000) return voiceCache.voices;
  const { EDGE_VOICE_LIST_URL } = await import("./edge-tts-token");
  const res = await fetch(EDGE_VOICE_LIST_URL, {
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36 Edg/143.0.0.0",
    },
  });
  if (!res.ok) throw new Error(`voice list failed (${res.status})`);
  const data: any[] = await res.json();
  const voices: Voice[] = data.map((v) => ({
    name: v.ShortName,
    locale: v.Locale,
    gender: v.Gender,
    friendly: v.FriendlyName,
  }));
  voiceCache = { at: now, voices };
  return voices;
}
