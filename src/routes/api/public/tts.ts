import { createFileRoute } from "@tanstack/react-router";
import {
  listVoices,
  pickVoice,
  speakable,
  speechResponse,
  type Voice,
} from "@/lib/tts/edge-speech.server";
import { detectLocale } from "@/lib/tts/language";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "content-type, authorization",
  "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
};

/** How much text one request may speak. Long enough for any real answer, short
 *  enough that a caller cannot pin a connection with a whole book. */
const MAX_CHARS = 5000;

/** Speech synthesis, streamed as MP3.
 *
 *  Two ways to call it:
 *    GET  /api/public/tts?text=...&voice=bn-BD-NabanitaNeural
 *    POST /api/public/tts  { "text": "...", "voice": "...", "locale": "bn" }
 *
 *  `voice` wins; otherwise `locale` picks one by language, so a caller who only
 *  knows the answer's language still gets a voice in that language. The audio
 *  starts arriving before the sentence is finished, so a client can begin
 *  playing immediately rather than waiting for the whole file.
 *
 *  Nothing is cached server-side: every reply is a fresh utterance of whatever
 *  text the caller sent, which is what makes it usable for a live AI answer. */
export const Route = createFileRoute("/api/public/tts")({
  server: {
    handlers: {
      OPTIONS: async () => new Response(null, { status: 204, headers: CORS }),

      GET: async ({ request }) => {
        const url = new URL(request.url);
        const text = (url.searchParams.get("text") || "").trim();
        const voice = (url.searchParams.get("voice") || "").trim();
        const locale = (url.searchParams.get("locale") || "").trim();
        return speak(text, voice, locale, request.signal);
      },

      POST: async ({ request }) => {
        let body: any;
        try {
          body = await request.json();
        } catch {
          return Response.json({ error: "Invalid JSON" }, { status: 400, headers: CORS });
        }
        const text = typeof body?.text === "string" ? body.text.trim() : "";
        const voice = typeof body?.voice === "string" ? body.voice.trim() : "";
        const locale = typeof body?.locale === "string" ? body.locale.trim() : "";
        return speak(text, voice, locale, request.signal);
      },
    },
  },
});

async function speak(
  text: string,
  voice: string,
  locale: string,
  signal?: AbortSignal,
): Promise<Response> {
  if (!text) {
    return Response.json({ error: "text is required" }, { status: 400, headers: CORS });
  }
  if (text.length > MAX_CHARS) {
    return Response.json(
      { error: `text is too long (${text.length} characters, limit ${MAX_CHARS})` },
      { status: 413, headers: CORS },
    );
  }

  // Speak the answer, not the markup. A reply that reads a code block aloud
  // character by character is unusable, so code, links and punctuation are
  // reduced to something a person would actually say.
  const spoken = speakable(text);
  if (!spoken) {
    return Response.json(
      { error: "nothing to speak after removing markup" },
      { status: 400, headers: CORS },
    );
  }

  let voices: Voice[] = [];
  try {
    voices = await listVoices();
  } catch {
    // Without the catalogue, a named voice still works; only locale matching
    // needs the list.
  }
  // The voice is chosen from the *answer's own language* when the caller did not
  // name one. Without this an English voice reads Bengali text and the result is
  // unintelligible — the letters are simply not pronounced — which is exactly
  // what a Bengali answer sounded like before.
  const detected = detectLocale(spoken);
  const chosen =
    voice || pickVoice(locale || detected || "en-US", voices) || "en-US-EmmaMultilingualNeural";

  try {
    const response = speechResponse(spoken, chosen, signal);
    const headers = new Headers(response.headers);
    headers.set("X-ZYRAXON-Voice", chosen);
    headers.set("Access-Control-Allow-Origin", "*");
    return new Response(response.body, { status: 200, headers });
  } catch (e) {
    return Response.json(
      { error: e instanceof Error ? e.message : "synthesis failed" },
      { status: 502, headers: CORS },
    );
  }
}
