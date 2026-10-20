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
 *  second. */

import { edgeSynthesisUrl, SEC_MS_GEC_VERSION } from "./edge-tts-token";

const AUDIO_FORMAT = "audio-24khz-48kbitrate-mono-mp3";
const OUTPUT_CONTENT_TYPE = "audio/mpeg";

export type Voice = { name: string; locale: string; gender: string; friendly?: string };

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

/** Strip what should never be read aloud: code, links and markup.
 *
 *  A spoken reply that reads a 40-line code block character by character is
 *  unusable. Code becomes a short spoken note, links become their label, and
 *  Markdown punctuation is removed. */
export function speakable(text: string): string {
  return (
    text
      // Fenced code → a short note, never the code itself.
      .replace(/```[^\n]*\n([\s\S]*?)```/g, (_, body: string) => {
        const lines = body.trim().split("\n").length;
        return ` A code block, ${lines} line${lines === 1 ? "" : "s"}. `;
      })
      .replace(/`([^`]+)`/g, "$1")
      // [label](url) → label, so the URL is not read out.
      .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
      .replace(/https?:\/\/\S+/g, " a link ")
      .replace(/^#{1,6}\s*/gm, "")
      .replace(/\*\*([^*]+)\*\*/g, "$1")
      .replace(/\*([^*]+)\*/g, "$1")
      .replace(/^\s*[-*]\s+/gm, "")
      .replace(/\s+/g, " ")
      .trim()
  );
}

function ssml(voice: string, text: string): string {
  const lang = voice.split("-").slice(0, 2).join("-") || "en-US";
  return (
    `<speak version='1.0' xmlns='http://www.w3.org/2001/10/synthesis' xml:lang='${lang}'>` +
    `<voice name='${voice}'>${escapeXml(text)}</voice></speak>`
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
        ssml(voice, text),
    );
  });
}

/** A Response whose body is the spoken audio, streamed as it is produced. */
export function speechResponse(text: string, voice: string, signal?: AbortSignal): Response {
  const encoder = new TextEncoder();
  void encoder;
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      synthesize(
        text,
        voice,
        (chunk) => {
          try {
            controller.enqueue(chunk);
          } catch {
            /* the caller went away */
          }
        },
        signal,
      )
        .then(() => {
          try {
            controller.close();
          } catch {
            /* already closed */
          }
        })
        .catch((error: unknown) => {
          try {
            controller.error(error);
          } catch {
            /* already errored */
          }
        });
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
