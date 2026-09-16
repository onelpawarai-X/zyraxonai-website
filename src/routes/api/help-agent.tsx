import { createFileRoute } from "@tanstack/react-router";

const CORS: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "content-type, authorization, x-session-id",
  "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
};

const ZEN_BASE = "https://opencode.ai/zen/v1";
const ZEN_CHAT_URL = `${ZEN_BASE}/chat/completions`;
const DEFAULT_ZEN_MODEL = "big-pickle";
const FREE_MODEL_FALLBACKS = ["big-pickle", "deepseek-v4-flash-free", "glm-5-free", "mimo-v2.5-free"];
const ZEN_UA = "opencode/1.0";

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
  cachedPrompt = "You are ZYRAXON Help Agent. Help users navigate the website and products.";
  return cachedPrompt!;
}

function getFallback(message: string): string {
  const l = message.toLowerCase();
  if (l.includes("download") || l.includes("install") || l.includes("ডাউনলোড"))
    return "Download our products:\n- ZYRAXON Agent: /download/zyraxon-agent\n- Myra Agent: /download/myra-agent\n- Zyraxon Code: /download/zyraxon-code";
  if (l.includes("license") || l.includes("zsl") || l.includes("লাইসেন্স"))
    return "We use ZSL (Zyraxon Sovereign License). Visit /zsl or GitHub: github.com/onelpawarai-X/ZSL";
  if (l.includes("ecosystem") || l.includes("marketplace") || l.includes("ইকোসিস্টেম"))
    return "Ecosystem Marketplace: /ecosystem. Publish: /publish.";
  if (l.includes("hello") || l.includes("hi") || l.includes("হ্যালো") || l.includes("নমস্কার"))
    return "Hello! How can I help you? Ask about our products, downloads, or anything about ZYRAXON.";
  if (l.includes("কেমন আছো") || l.includes("কি খবর"))
    return "আমি ভালো আছি! আপনাকে কিভাবে সাহায্য করতে পারি?";
  return "I'm here to help! Ask about our products, downloads, ZSL License, or anything about ZYRAXON.";
}

async function zenFetch(input: string | URL | Request, init?: RequestInit): Promise<Response> {
  const headers = new Headers(init?.headers || {});
  headers.set("User-Agent", ZEN_UA);
  return fetch(input, { ...init, headers });
}

async function streamFromZen(
  model: string,
  messages: { role: string; content: string }[],
): Promise<string | null> {
  try {
    const res = await zenFetch(ZEN_CHAT_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ model, messages, stream: true }),
      signal: AbortSignal.timeout(30000),
    });

    if (!res.ok) return null;
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

          console.warn(`[help-agent] All failed, fallback`);
          return new Response(getFallback(message), {
            headers: { ...CORS, "Content-Type": "text/plain; charset=utf-8" },
          });
        } catch (e) {
          console.error(`[help-agent] error:`, e);
          return new Response(getFallback(""), {
            headers: { ...CORS, "Content-Type": "text/plain; charset=utf-8" },
          });
        }
      },
    },
  },
});
