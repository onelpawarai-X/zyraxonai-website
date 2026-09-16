import { createFileRoute } from "@tanstack/react-router";

const CORS: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "content-type, authorization, x-session-id",
  "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
};

const ZEN_BASE = "https://opencode.ai/zen/v1";
const DEFAULT_ZEN_MODEL = "big-pickle";
const FREE_MODEL_FALLBACKS = ["big-pickle", "deepseek-v4-flash-free", "glm-5-free"];
const OPENCODE_FETCH_TIMEOUT_MS = 10 * 60 * 1000;

let openCodeServerSessionId: string | null = null;
function getOpenCodeSessionId(): string {
  if (!openCodeServerSessionId) {
    openCodeServerSessionId = Math.random().toString(36).slice(2) + Date.now().toString(36);
  }
  return openCodeServerSessionId;
}

function getOpenCodeHeaders(useAuth = true): Record<string, string> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    "User-Agent": "OpenCode/1.0.0",
    "x-session-id": getOpenCodeSessionId(),
  };
  if (useAuth) {
    const key = process.env.OPENCODE_API_KEY || "";
    if (key && !key.includes("placeholder") && key.trim()) {
      headers["Authorization"] = `Bearer ${key.trim()}`;
    }
  }
  return headers;
}

const HELP_SYSTEM_PROMPT = `You are ZYRAXON Help Agent — a friendly, multilingual AI assistant on the ZYRAXON AI website. Guide users, answer questions, help navigate. You can also have casual conversations.

CRITICAL RULE: ALWAYS respond in the SAME LANGUAGE the user writes in. If they write in Bengali, respond in Bengali. If they write in English, respond in English. Match their language exactly.

PRODUCTS:
1. ZYRAXON Agent — Desktop AI (Win/Mac/Linux), 552+ tools, 9 modes. Download: /download/zyraxon-agent | GitHub: github.com/onelpawarai-X/ZYRAXON-AI
2. Myra Agent — Android voice AI, 6 personalities, Bengali/English. Download: /download/myra-agent | GitHub: github.com/onelpawarai-X/Myra-Agent
3. Zyraxon Code — AI code editor (VS Code fork). Download: /download/zyraxon-code | GitHub: github.com/onelpawarai-X/Zyraxon-Code

LICENSE: ZSL — ZSL-X v1.0.0 (2026-2028), MEKRA-X (2028+). Page: /zsl | GitHub: github.com/onelpawarai-X/ZSL
PAGES: / (landing), /ecosystem (marketplace), /publish, /releases, /docs (18+ pages), /nebula (password: ZYRAXON), /bludar, /zsl
COMMUNITY: Discord (discord.gg/h8mHvf45g), YouTube (@ZYRAXONAI)
FOUNDER: OneL Pawar — onelpawarai.lovable.app
LICENSE PORTAL: zyraxonai-license.lovable.app
GITHUB ORG: github.com/onelpawarai-X

RULES: Respond in user's exact language. Be concise (2-4 sentences). Never make up URLs. Casual conversations OK.`;

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

async function parseSSEStream(res: Response): Promise<string> {
  const reader = res.body!.getReader();
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
          if (delta?.content) {
            fullText += delta.content;
          }
        } catch {}
      }
    }
  }

  return fullText.length > 0 ? fullText : null;
}

async function streamFromZen(
  model: string,
  messages: { role: string; content: string }[],
): Promise<string | null> {
  try {
    let useAuth = true;
    let headers = getOpenCodeHeaders(useAuth);

    let openCodeRes = await fetch(`${ZEN_BASE}/chat/completions`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        model,
        messages,
        stream: true,
      }),
      signal: AbortSignal.timeout(OPENCODE_FETCH_TIMEOUT_MS),
    });

    // If 401, retry without auth (free tier)
    if (openCodeRes.status === 401 && useAuth) {
      useAuth = false;
      headers = getOpenCodeHeaders(false);
      openCodeRes = await fetch(`${ZEN_BASE}/chat/completions`, {
        method: "POST",
        headers,
        body: JSON.stringify({
          model,
          messages,
          stream: true,
        }),
        signal: AbortSignal.timeout(OPENCODE_FETCH_TIMEOUT_MS),
      });
    }

    if (!openCodeRes.ok) {
      console.warn(`[help-agent] ${model} returned ${openCodeRes.status}`);
      return null;
    }

    if (!openCodeRes.body) return null;
    return await parseSSEStream(openCodeRes);
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

          const historyBlock = history ? `Previous conversation:\n${history}\n` : "";
          const userContent = `${historyBlock}${message}`;

          const targetModel = requestedModel || DEFAULT_ZEN_MODEL;
          const modelsToTry = [targetModel, ...FREE_MODEL_FALLBACKS.filter((m) => m !== targetModel)];

          const messages = [
            { role: "system", content: HELP_SYSTEM_PROMPT },
            { role: "user", content: userContent },
          ];

          for (const tryModel of modelsToTry) {
            console.log(`[help-agent] Trying model: ${tryModel}`);
            const reply = await streamFromZen(tryModel, messages);
            if (reply) {
              console.log(`[help-agent] Success on ${tryModel}, length: ${reply.length}`);
              return new Response(reply, {
                headers: { ...CORS, "Content-Type": "text/plain; charset=utf-8" },
              });
            }
            console.warn(`[help-agent] ${tryModel} returned null, trying next...`);
          }

          console.warn(`[help-agent] All models failed, returning fallback`);
          return new Response(getFallback(message), {
            headers: { ...CORS, "Content-Type": "text/plain; charset=utf-8" },
          });
        } catch (e) {
          console.error(`[help-agent] POST error:`, e);
          return new Response(getFallback(""), {
            headers: { ...CORS, "Content-Type": "text/plain; charset=utf-8" },
          });
        }
      },
    },
  },
});
