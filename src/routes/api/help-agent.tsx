import { createFileRoute } from "@tanstack/react-router";

const CORS: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "content-type, authorization",
  "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
};

const ZEN_CHAT_URL = "https://opencode.ai/zen/v1/chat/completions";
const ZEN_MODELS_URL = "https://opencode.ai/zen/v1/models";
const ZEN_UA = "opencode/1.0";
const DEFAULT_MODEL = "big-pickle";

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
          const res = await fetch(ZEN_MODELS_URL, {
            headers: { "User-Agent": ZEN_UA },
            signal: AbortSignal.timeout(10000),
          });
          if (!res.ok) throw new Error("models failed");
          const data = await res.json();
          const all = data?.data || [];
          const free = all
            .filter((m: any) => (m.id || "").includes("free") || m.id === "big-pickle" || m.id === "union-alpha")
            .map((m: any) => ({ id: m.id, name: m.id, free: true }));
          if (free.length === 0) free.push({ id: "big-pickle", name: "big-pickle", free: true });
          return Response.json({ models: free, defaultModel: DEFAULT_MODEL }, { headers: { ...CORS, "Cache-Control": "public, max-age=60" } });
        } catch {
          return Response.json({ models: [{ id: "big-pickle", name: "big-pickle", free: true }], defaultModel: DEFAULT_MODEL }, { headers: { ...CORS, "Cache-Control": "public, max-age=60" } });
        }
      },

      POST: async ({ request }: { request: Request }) => {
        try {
          const body = await request.json();
          const { message, history, model } = body;
          if (!message || typeof message !== "string") {
            return Response.json({ error: "Message required" }, { status: 400, headers: CORS });
          }

          const systemPrompt = await getSystemPrompt();
          const historyBlock = history ? `Previous conversation:\n${history}\n` : "";
          const sessionId = `help-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

          const messages = [
            { role: "system", content: systemPrompt },
            { role: "user", content: `${historyBlock}${message}` },
          ];

          const res = await fetch(ZEN_CHAT_URL, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "User-Agent": ZEN_UA,
              "x-session-id": sessionId,
            },
            body: JSON.stringify({
              model: model || DEFAULT_MODEL,
              messages,
              stream: true,
            }),
            signal: AbortSignal.timeout(30000),
          });

          if (!res.ok) {
            const err = await res.text().catch(() => "");
            console.warn(`[help-agent] Zen ${res.status}: ${err.slice(0, 200)}`);
            return Response.json({ error: `Zen ${res.status}` }, { status: 502, headers: CORS });
          }

          return new Response(res.body, {
            headers: {
              "Content-Type": "text/event-stream; charset=utf-8",
              "Cache-Control": "no-cache, no-transform",
              Connection: "keep-alive",
              "X-Accel-Buffering": "no",
              "Access-Control-Allow-Origin": "*",
            },
          });
        } catch (e: any) {
          console.error(`[help-agent] error:`, e?.message);
          return Response.json({ error: "Help Agent unavailable" }, { status: 500, headers: CORS });
        }
      },
    },
  },
});
