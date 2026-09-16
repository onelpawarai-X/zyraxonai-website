import { createFileRoute } from "@tanstack/react-router";
import { zenChatStream, normalizeZenModel, DEFAULT_ZEN_MODEL, zenFreeModels, type ChatMessage } from "@/lib/builder/zen.server";

const CORS: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "content-type, authorization",
  "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
};

let cachedPrompt: string | null = null;
async function getSystemPrompt(): Promise<string> {
  if (cachedPrompt) return cachedPrompt;
  try {
    const res = await fetch("https://zyraxonai.lovable.app/help-agent-prompt.txt", { signal: AbortSignal.timeout(5000) });
    if (res.ok) { cachedPrompt = await res.text(); return cachedPrompt!; }
  } catch {}
  return "You are ZYRAXON Help Agent. Help users navigate the website and products. Respond in the same language the user writes in.";
}

export const Route = createFileRoute("/api/help-agent")({
  server: {
    handlers: {
      OPTIONS: async () => new Response(null, { status: 204, headers: CORS }),

      GET: async () => {
        try {
          const models = await zenFreeModels();
          return Response.json(
            { models, defaultModel: DEFAULT_ZEN_MODEL },
            { headers: { ...CORS, "Cache-Control": "public, max-age=60" } },
          );
        } catch {
          return Response.json(
            { models: [{ id: "big-pickle", name: "Big Pickle", multimodal: false, reasoning: false, context: 200000, output: 32768, free: true }], defaultModel: "big-pickle" },
            { headers: { ...CORS, "Cache-Control": "public, max-age=60" } },
          );
        }
      },

      POST: async ({ request }: { request: Request }) => {
        try {
          const body = await request.json();
          const { message, history, model: requestedModel } = body;

          if (!message || typeof message !== "string") {
            return Response.json({ error: "Message required" }, { status: 400, headers: CORS });
          }

          const systemPrompt = await getSystemPrompt();
          const historyBlock = history ? `Previous conversation:\n${history}\n` : "";
          const userContent = `${historyBlock}${message}`;

          const upstream = normalizeZenModel(requestedModel) || DEFAULT_ZEN_MODEL;

          const messages: ChatMessage[] = [
            { role: "system", content: systemPrompt },
            { role: "user", content: userContent },
          ];

          const response = await zenChatStream(upstream, messages, undefined, []);
          return response;
        } catch (e) {
          console.error(`[help-agent] error:`, e);
          return Response.json(
            { error: "Help Agent unavailable. Please try again." },
            { status: 500, headers: CORS },
          );
        }
      },
    },
  },
});
