import { createFileRoute } from "@tanstack/react-router";
import { listVoices } from "@/lib/tts/edge-speech.server";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "content-type, authorization",
  "Access-Control-Allow-Methods": "GET,OPTIONS",
};

/** The voices the speech engine offers, grouped by language.
 *
 *  Published so a client can offer a voice picker, or pick one for the language
 *  an answer came back in, without hardcoding a list that goes stale. The list
 *  is read live from the engine and cached for a few hours. */
export const Route = createFileRoute("/api/public/tts/voices")({
  server: {
    handlers: {
      OPTIONS: async () => new Response(null, { status: 204, headers: CORS }),
      GET: async () => {
        try {
          const voices = await listVoices();
          const locales = Array.from(new Set(voices.map((v) => v.locale))).sort();
          const languages = Array.from(new Set(locales.map((l) => l.split("-")[0]))).sort();
          return Response.json(
            {
              object: "list",
              count: voices.length,
              languages,
              locales,
              data: voices,
              endpoint: "/api/public/tts",
            },
            { headers: { ...CORS, "Cache-Control": "public, max-age=3600" } },
          );
        } catch (e) {
          return Response.json(
            {
              error: "voice catalogue unavailable",
              detail: e instanceof Error ? e.message : "unknown",
            },
            { status: 502, headers: CORS },
          );
        }
      },
    },
  },
});
