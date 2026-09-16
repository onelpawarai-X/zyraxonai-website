import { createFileRoute } from "@tanstack/react-router";
import { normalizeZenModel, DEFAULT_ZEN_MODEL, zenFreeModels, zenFetch } from "@/lib/builder/zen.server";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "content-type, authorization",
  "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
};

const ZEN_BASE = "https://opencode.ai/zen/v1";

const HELP_SYSTEM_PROMPT = `You are ZYRAXON Help Agent — a friendly, multilingual AI assistant on the ZYRAXON AI website. Guide users, answer questions, help navigate. You can also have casual conversations.

CRITICAL RULE: ALWAYS respond in the SAME LANGUAGE the user writes in. If they write in Bengali, respond in Bengali. If they write in English, respond in English. If they write in Hindi, respond in Hindi. Match their language exactly.

PRODUCTS:
1. ZYRAXON Agent — Desktop AI (Win/Mac/Linux), 552+ tools, 9 modes. Download: /download/zyraxon-agent | GitHub: github.com/onelpawarai-X/ZYRAXON-AI
2. Myra Agent — Android voice AI, 6 personalities, Bengali/English. Download: /download/myra-agent | GitHub: github.com/onelpawarai-X/Myra-Agent
3. Zyraxon Code — AI code editor (VS Code fork). Download: /download/zyraxon-code | GitHub: github.com/onelpawarai-X/Zyraxon-Code

LICENSE: ZSL — ZSL-X v1.0.0 (2026-2028), MEKRA-X (2028+). Page: /zsl | GitHub: github.com/onelpawarai-X/ZSL

PAGES: / (landing), /ecosystem (marketplace), /publish, /releases, /docs (18+ pages), /nebula (password: ZYRAXON), /bludar, /zsl

COMMUNITY: Discord (discord.gg/h8mHvf45g), YouTube (@ZYRAXONAI), Google Group
FOUNDER: OneL Pawar — onelpawarai.lovable.app
LICENSE PORTAL: zyraxonai-license.lovable.app
GITHUB ORG: github.com/onelpawarai-X

RULES: Respond in user's exact language. Be concise (2-4 sentences). Never make up URLs. Casual conversations OK.`;

function getFallback(message: string): string {
  const l = message.toLowerCase();
  if (l.includes("download") || l.includes("install") || l.includes("ডাউনলোড")) return "Download our products:\n- ZYRAXON Agent: /download/zyraxon-agent\n- Myra Agent: /download/myra-agent\n- Zyraxon Code: /download/zyraxon-code";
  if (l.includes("license") || l.includes("zsl") || l.includes("লাইসেন্স")) return "We use ZSL (Zyraxon Sovereign License). Visit /zsl or GitHub: github.com/onelpawarai-X/ZSL";
  if (l.includes("ecosystem") || l.includes("marketplace") || l.includes("ইকোসিস্টেম")) return "Ecosystem Marketplace: /ecosystem. Publish: /publish.";
  if (l.includes("hello") || l.includes("hi") || l.includes("হ্যালো") || l.includes("নমস্কার")) return "Hello! How can I help you? Ask about our products, downloads, or anything about ZYRAXON.";
  if (l.includes("কেমন আছো") || l.includes("কি খবর")) return "আমি ভালো আছি! আপনাকে কিভাবে সাহায্য করতে পারি?";
  return "I'm here to help! Ask about our products, downloads, ZSL License, or anything about ZYRAXON.";
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

          const upstream = normalizeZenModel(requestedModel) || DEFAULT_ZEN_MODEL;

          const historyBlock = history ? `Previous conversation:\n${history}\n` : "";
          const userContent = `${historyBlock}${message}`;

          const payload = {
            model: upstream,
            messages: [
              { role: "system", content: HELP_SYSTEM_PROMPT },
              { role: "user", content: userContent },
            ],
            stream: true,
            max_tokens: 512,
            temperature: 0.7,
          };

          const r = await zenFetch(`${ZEN_BASE}/chat/completions`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
          });

          if (!r.ok) {
            return Response.json(
              { reply: getFallback(message) },
              { headers: CORS },
            );
          }

          const encoder = new TextEncoder();
          const stream = new ReadableStream({
            async start(controller) {
              const reader = r.body?.getReader();
              if (!reader) { controller.close(); return; }
              const decoder = new TextDecoder();
              try {
                while (true) {
                  const { done, value } = await reader.read();
                  if (done) break;
                  controller.enqueue(value);
                }
              } finally {
                controller.close();
              }
            },
          });

          return new Response(stream, {
            headers: {
              "Content-Type": "text/event-stream; charset=utf-8",
              "Cache-Control": "no-cache, no-transform",
              Connection: "keep-alive",
              "X-Accel-Buffering": "no",
              "Access-Control-Allow-Origin": "*",
            },
          });
        } catch {
          return Response.json(
            { reply: getFallback("") },
            { headers: CORS },
          );
        }
      },
    },
  },
});
