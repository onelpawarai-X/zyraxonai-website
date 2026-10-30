import { createFileRoute } from "@tanstack/react-router";
import {
  listVoices,
  normaliseGender,
  normaliseTone,
  pickVoice,
  speakable,
  speechResponse,
  type Tone,
  type Voice,
} from "@/lib/tts/edge-speech.server";
import { detectLocale } from "@/lib/tts/language";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "content-type, authorization",
  "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
};

/** How much text one request may speak.
 *
 *  A whole long-form answer — an article, a document, a full explanation — is a
 *  normal thing to ask for, and the endpoint can speak it without holding it in
 *  memory: past a couple of thousand characters the text is split into
 *  sentences and piped through one continuous MP3 stream, so the first sentence
 *  is heard while the rest is still being synthesised. The ceiling is therefore
 *  about what a caller may reasonably send, not about what can be spoken, and
 *  the first byte of audio does not get slower as the text grows. */
const MAX_CHARS = 50_000;

/** Speech synthesis, streamed as MP3.
 *
 *  Two ways to call it:
 *    GET  /api/public/tts?text=...&voice=bn-BD-NabanitaNeural&tone=warm
 *    POST /api/public/tts  { "text": "...", "voice": "...", "locale": "bn", "tone": "warm" }
 *
 *  `voice` wins; otherwise `locale` picks one by language, so a caller who only
 *  knows the answer's language still gets a voice in that language. The audio
 *  starts arriving before the sentence is finished, so a client can begin
 *  playing immediately rather than waiting for the whole file.
 *
 *  `gender` chooses a female or male voice in that language when no `voice` is
 *  named. It is how a caller picks the *kind* of voice without knowing the
 *  catalogue; a caller who knows the exact voice names it instead.
 *
 *  `tone` changes the delivery — `warm`, `expressive`, `natural` or `clear`.
 *  Every tone keeps the same pauses at commas and sentence ends, because the
 *  pauses are what make the speech intelligible; the tone changes only rate,
 *  pitch and volume.
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
        const tone = normaliseTone(url.searchParams.get("tone"));
        const gender = normaliseGender(url.searchParams.get("gender"));
        return speak(text, voice, locale, tone, gender, request.signal);
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
        const tone = normaliseTone(body?.tone);
        const gender = normaliseGender(typeof body?.gender === "string" ? body.gender : null);
        return speak(text, voice, locale, tone, gender, request.signal);
      },
    },
  },
});

async function speak(
  text: string,
  voice: string,
  locale: string,
  tone: Tone,
  gender: string,
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

  // The catalogue is needed to *choose* a voice and to *check* a named one. It is
  // fetched whenever the caller did not name a voice, and also when they named
  // one — a name that is not in the catalogue is the one case that would
  // otherwise answer 200 with an empty body and no error, which reads as "the
  // audio is broken" rather than "that voice does not exist".
  let voices: Voice[] = [];
  try {
    voices = await listVoices();
  } catch {
    // Without the catalogue a language still resolves through the fallback
    // below; only matching needs the list.
  }

  // A named voice is matched case-insensitively and canonicalised, because the
  // engine accepts `bn-bd-pradeepneural` but the catalogue spells it
  // `bn-BD-PradeepNeural`. A name that matches nothing is refused by name
  // instead of being forwarded, where it produces silence.
  let named = voice;
  if (voice && voices.length) {
    const found = voices.find((v) => v.name.toLowerCase() === voice.toLowerCase());
    if (!found) {
      return Response.json(
        {
          error: "unknown voice",
          detail: `"${voice}" is not in the voice catalogue.`,
          hint: "Pick a voice from GET /api/public/tts/voices, or send a locale (e.g. locale=bn) and let one be chosen.",
        },
        { status: 400, headers: CORS },
      );
    }
    named = found.name;
  }

  // The voice is chosen from the *answer's own language* when the caller did not
  // name one. Without this an English voice reads Bengali text and the result is
  // unintelligible — the letters are simply not pronounced — which is exactly
  // what a Bengali answer sounded like before.
  const detected = named ? undefined : detectLocale(spoken);
  const chosen =
    named ||
    pickVoice(locale || detected || "en-US", voices, undefined, gender) ||
    "en-US-EmmaMultilingualNeural";

  try {
    const response = speechResponse(spoken, chosen, tone, signal);
    const headers = new Headers(response.headers);
    headers.set("X-ZYRAXON-Voice", chosen);
    headers.set("X-ZYRAXON-Tone", tone);
    headers.set("Access-Control-Allow-Origin", "*");
    return new Response(response.body, { status: 200, headers });
  } catch (e) {
    return Response.json(
      { error: e instanceof Error ? e.message : "synthesis failed" },
      { status: 502, headers: CORS },
    );
  }
}
