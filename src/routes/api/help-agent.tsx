import { createFileRoute } from "@tanstack/react-router";

const CORS: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "content-type, authorization",
  "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
};

const ZEN_CHAT_URL = "https://opencode.ai/zen/v1/chat/completions";
const DEFAULT_ZEN_MODEL = "big-pickle";
const FREE_MODEL_FALLBACKS = ["big-pickle", "deepseek-v4-flash-free", "glm-5-free", "mimo-v2.5-free"];

let cachedPrompt: string | null = null;
async function getSystemPrompt(): Promise<string> {
  if (cachedPrompt) return cachedPrompt;
  try {
    const res = await fetch("https://zyraxonai.lovable.app/help-agent-prompt.txt", {
      signal: AbortSignal.timeout(5000),
    });
    if (res.ok) {
      cachedPrompt = await res.text();
      return cachedPrompt!;
    }
  } catch {}
  return "You are ZYRAXON Help Agent. Help users navigate the website and products. Respond in the same language the user writes in.";
}

async function streamFromZen(
  model: string,
  messages: { role: string; content: string }[],
): Promise<string | null> {
  try {
    const res = await fetch(ZEN_CHAT_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "User-Agent": "opencode/1.0",
      },
      body: JSON.stringify({ model, messages, stream: true }),
      signal: AbortSignal.timeout(30000),
    });

    if (!res.ok) {
      console.warn(`[help-agent] ${model} status ${res.status}`);
      return null;
    }
    if (!res.body) return null;

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let fullText = "";
    let streamBuffer = "";

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      streamBuffer += decoder.decode(value, { stream: true });
      const lines = streamBuffer.split("\n");
      streamBuffer = lines.pop() || "";
      for (const line of lines) {
        const trimmed = line.trim();
        if (trimmed.startsWith("data: ")) {
          const dataPart = trimmed.slice(6);
          if (dataPart === "[DONE]") break;
          try {
            const parsed = JSON.parse(dataPart);
            const delta = parsed.choices?.[0]?.delta;
            if (delta?.content) fullText += delta.content;
          } catch {}
        }
      }
    }
    return fullText.length > 0 ? fullText : null;
  } catch (err: any) {
    console.warn(`[help-agent] ${model} error:`, err?.message);
    return null;
  }
}

export const Route = createFileRoute("/api/help-agent")({
  server: {
    handlers: {
      OPTIONS: async () => new Response(null, { status: 204, headers: CORS }),

      GET: async () => {
        return Response.json(
          {
            models: [
              { id: "big-pickle", name: "Big Pickle (Free)", free: true },
              { id: "deepseek-v4-flash-free", name: "DeepSeek V4 Flash (Free)", free: true },
              { id: "glm-5-free", name: "GLM 5 (Free)", free: true },
              { id: "mimo-v2.5-free", name: "MiMo V2.5 (Free)", free: true },
            ],
            defaultModel: DEFAULT_ZEN_MODEL,
          },
          { headers: { ...CORS, "Cache-Control": "public, max-age=60" } },
        );
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

          const targetModel = requestedModel || DEFAULT_ZEN_MODEL;
          const modelsToTry = [targetModel, ...FREE_MODEL_FALLBACKS.filter((m) => m !== targetModel)];

          const messages = [
            { role: "system", content: systemPrompt },
            { role: "user", content: userContent },
          ];

          for (const tryModel of modelsToTry) {
            console.log(`[help-agent] Trying: ${tryModel}`);
            const reply = await streamFromZen(tryModel, messages);
            if (reply) {
              console.log(`[help-agent] OK: ${tryModel} (${reply.length} chars)`);
              return new Response(reply, {
                headers: { ...CORS, "Content-Type": "text/plain; charset=utf-8" },
              });
            }
          }

          return new Response("Sorry, all AI models are temporarily unavailable. Please try again later.", {
            headers: { ...CORS, "Content-Type": "text/plain; charset=utf-8" },
          });
        } catch (e) {
          console.error(`[help-agent] error:`, e);
          return new Response("Sorry, something went wrong. Please try again.", {
            headers: { ...CORS, "Content-Type": "text/plain; charset=utf-8" },
          });
        }
      },
    },
  },
});
