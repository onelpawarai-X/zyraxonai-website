import { createAPIFileRoute } from "@tanstack/react-start/api";
import type { RequestHandler } from "@tanstack/react-start/api";

const SYSTEM_PROMPT = `You are ZYRAXON Help Agent — a friendly, multilingual AI assistant on the ZYRAXON AI website. Guide users, answer questions, help navigate.

IDENTITY: You are AI, speak user's language, be warm & concise (2-4 sentences).

PRODUCTS:
1. ZYRAXON Agent — Desktop AI (Win/Mac/Linux), 552+ tools, 9 modes. Download: /download/zyraxon-agent | GitHub: github.com/onelpawarai-X/ZYRAXON-AI
2. Myra Agent — Android voice AI, 6 personalities, Bengali/English. Download: /download/myra-agent | GitHub: github.com/onelpawarai-X/Myra-Agent
3. Zyraxon Code — AI code editor (VS Code fork). Download: /download/zyraxon-code | GitHub: github.com/onelpawarai-X/Zyraxon-Code

LICENSE: ZSL (Zyraxon Sovereign License) — ZSL-X v1.0.0 (2026-2028), MEKRA-X (2028+). Enterprise-grade. Page: /zsl | GitHub: github.com/onelpawarai-X/ZSL

PAGES:
- / — Landing (features, modes, models, comparison, download)
- /ecosystem — Marketplace (published apps, extensions, releases, publish)
- /publish — Publish your project to ZYRAXON Hub
- /releases — All GitHub releases from 3 repos
- /docs — Documentation (18+ pages)
- /nebula — NEBULA AI chat (password: ZYRAXON)
- /bludar — AI Bludar builder
- /zsl — ZSL License page

COMMUNITY: Discord (discord.gg/h8mHvf45g), YouTube (@ZYRAXONAI), Google Group
FOUNDER: OneL Pawar — onelpawarai.lovable.app
LICENSE PORTAL: zyraxonai-license.lovable.app
GITHUB ORG: github.com/onelpawarai-X

RULES: Respond in user's language. Be concise. If screenshot shared, analyze it. If location shared, acknowledge. Never make up URLs.`;

// Free models — text
const TEXT_MODELS = [
  { provider: "groq", model: "llama-3.3-70b-versatile", url: "https://api.groq.com/openai/v1/chat/completions" },
  { provider: "groq", model: "llama-3.1-8b-instant", url: "https://api.groq.com/openai/v1/chat/completions" },
  { provider: "cerebras", model: "llama-3.3-70b", url: "https://api.cerebras.ai/v1/chat/completions" },
];

// Free models — vision (image/video)
const VISION_MODELS = [
  { provider: "groq", model: "llama-3.2-11b-vision-preview", url: "https://api.groq.com/openai/v1/chat/completions" },
  { provider: "groq", model: "llama-3.2-90b-vision-preview", url: "https://api.groq.com/openai/v1/chat/completions" },
];

function getApiKey(provider: string): string {
  const keys: Record<string, string> = {
    groq: process.env.GROQ_API_KEY || "",
    cerebras: process.env.CEREBRAS_API_KEY || "",
  };
  return keys[provider] || "";
}

export const Route = createAPIFileRoute("/api/help-agent")({
  POST: async ({ request }) => {
    const body = await request.json();
    const { message, history, hasImage } = body;

    if (!message || typeof message !== "string") {
      return new Response(JSON.stringify({ error: "Message required" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    // Choose model based on content type
    const models = hasImage ? VISION_MODELS : TEXT_MODELS;

    // Build messages
    const messages = [
      { role: "system", content: SYSTEM_PROMPT },
      ...(history ? [{ role: "user", content: `Previous conversation:\n${history}` }] : []),
      { role: "user", content: message },
    ];

    // Try each model until one works
    for (const m of models) {
      const apiKey = getApiKey(m.provider);
      if (!apiKey) continue;

      try {
        const res = await fetch(m.url, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${apiKey}`,
          },
          body: JSON.stringify({
            model: m.model,
            messages,
            max_tokens: 500,
            temperature: 0.7,
            stream: true,
          }),
        });

        if (!res.ok) continue;

        // SSE streaming response
        const reader = res.body?.getReader();
        if (!reader) continue;

        const encoder = new TextDecoder();
        let buffer = "";
        let fullReply = "";

        const stream = new ReadableStream({
          async start(controller) {
            try {
              while (true) {
                const { done, value } = await reader.read();
                if (done) break;

                buffer += encoder.decode(value, { stream: true });
                const lines = buffer.split("\n");
                buffer = lines.pop() || "";

                for (const line of lines) {
                  if (line.startsWith("data: ")) {
                    const data = line.slice(6).trim();
                    if (data === "[DONE]") {
                      controller.enqueue(`data: [DONE]\n\n`);
                      break;
                    }
                    try {
                      const parsed = JSON.parse(data);
                      const token = parsed.choices?.[0]?.delta?.content;
                      if (token) {
                        fullReply += token;
                        controller.enqueue(`data: ${JSON.stringify({ token })}\n\n`);
                      }
                    } catch {}
                  }
                }
              }
            } finally {
              controller.close();
            }
          },
        });

        return new Response(stream, {
          headers: {
            "Content-Type": "text/event-stream",
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
          },
        });
      } catch {
        continue;
      }
    }

    // Fallback — no streaming, just text
    const fallback = getFallbackReply(message);
    return new Response(JSON.stringify({ reply: fallback }), {
      headers: { "Content-Type": "application/json" },
    });
  },
});

function getFallbackReply(message: string): string {
  const lower = message.toLowerCase();
  if (lower.includes("download") || lower.includes("install")) {
    return "You can download our products from the Download page:\n- ZYRAXON Agent: /download/zyraxon-agent\n- Myra Agent: /download/myra-agent\n- Zyraxon Code: /download/zyraxon-code\n\nOr visit GitHub Releases: /releases";
  }
  if (lower.includes("license") || lower.includes("zsl")) {
    return "We use the Zyraxon Sovereign License (ZSL) — our own enterprise-grade license. Visit /zsl for full details, or check GitHub: github.com/onelpawarai-X/ZSL";
  }
  if (lower.includes("ecosystem") || lower.includes("marketplace")) {
    return "The Ecosystem Marketplace is at /ecosystem — you can browse published apps, extensions, and releases. You can also publish your own projects at /publish.";
  }
  if (lower.includes("documentation") || lower.includes("docs")) {
    return "Our documentation is at /docs with 18+ pages covering installation, tools, API, and more.";
  }
  return "I'm here to help! You can ask about our products (ZYRAXON Agent, Myra Agent, Zyraxon Code), downloads, ZSL License, Ecosystem Marketplace, or Documentation. What would you like to know?";
}
