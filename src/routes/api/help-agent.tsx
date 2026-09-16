import { createFileRoute } from "@tanstack/react-router";
import {
  DEFAULT_ZEN_MODEL,
  normalizeZenModel,
  zenChatStream,
  zenFreeModels,
  isZenModel,
  type ChatMessage,
} from "@/lib/builder/zen.server";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "content-type, authorization",
  "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
};

const HELP_SYSTEM_PROMPT = `You are ZYRAXON Help Agent — a friendly, multilingual AI assistant on the ZYRAXON AI website. Guide users, answer questions, help navigate. Speak user's language. Be warm & concise. You can also have casual conversations.

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

RULES: Respond in user's language. Be concise. Never make up URLs. You can have casual conversations too.`;

function getFallback(message: string): string {
  const l = message.toLowerCase();
  if (l.includes("download") || l.includes("install")) return "Download our products:\n- ZYRAXON Agent: /download/zyraxon-agent\n- Myra Agent: /download/myra-agent\n- Zyraxon Code: /download/zyraxon-code\n\nOr visit /releases.";
  if (l.includes("license") || l.includes("zsl")) return "We use ZSL (Zyraxon Sovereign License). Visit /zsl or GitHub: github.com/onelpawarai-X/ZSL";
  if (l.includes("ecosystem") || l.includes("marketplace")) return "Ecosystem Marketplace: /ecosystem. Publish: /publish.";
  if (l.includes("docs") || l.includes("documentation")) return "Documentation: /docs (18+ pages).";
  if (l.includes("hello") || l.includes("hi") || l.includes("হ্যালো") || l.includes("নমস্কার")) return "Hello! How can I help you? Ask about our products, downloads, or anything about ZYRAXON.";
  if (l.includes("কেমন আছো") || l.includes("কি খবর")) return "আমি ভালো আছি! আপনাকে কিভাবে সাহায্য করতে পারি?";
  return "I'm here to help! Ask about our products (ZYRAXON Agent, Myra Agent, Zyraxon Code), downloads, ZSL License, Ecosystem, or Documentation. You can also just chat with me!";
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
        } catch (e) {
          return Response.json(
            { error: "Failed to load models", detail: e instanceof Error ? e.message : "unknown" },
            { status: 502, headers: CORS },
          );
        }
      },

      POST: async ({ request }: { request: Request }) => {
        try {
          const body = await request.json();
          const { message, history, model: requestedModel, hasImage } = body;

          if (!message || typeof message !== "string") {
            return Response.json({ error: "Message required" }, { status: 400, headers: CORS });
          }

          const upstream = normalizeZenModel(requestedModel) || DEFAULT_ZEN_MODEL;

          const historyBlock = history ? `Previous conversation:\n${history}\n` : "";
          const userContent = `${historyBlock}${message}`;

          const messages: ChatMessage[] = [
            { role: "system", content: HELP_SYSTEM_PROMPT },
            { role: "user", content: userContent },
          ];

          if (isZenModel(upstream)) {
            return await zenChatStream(upstream, messages);
          }

          return await zenChatStream(DEFAULT_ZEN_MODEL, messages);
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
