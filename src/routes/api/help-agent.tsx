import { createFileRoute } from "@tanstack/react-router";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "content-type, authorization",
  "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
};

const HF_MODELS = [
  "HuggingFaceH4/zephyr-7b-beta",
  "microsoft/DialoGPT-medium",
  "facebook/opt-1.3b",
];

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
        return Response.json(
          {
            models: [
              { id: "HuggingFaceH4/zephyr-7b-beta", name: "Zephyr 7B", free: true },
              { id: "microsoft/DialoGPT-medium", name: "DialoGPT", free: true },
              { id: "facebook/opt-1.3b", name: "OPT 1.3B", free: true },
            ],
            defaultModel: "HuggingFaceH4/zephyr-7b-beta",
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

          const modelsToTry = requestedModel
            ? [requestedModel, ...HF_MODELS.filter((m) => m !== requestedModel)]
            : HF_MODELS;

          for (const model of modelsToTry) {
            try {
              const res = await fetch(
                `https://api-inference.huggingface.co/models/${model}`,
                {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({
                    inputs: `<|system|>\n${HELP_SYSTEM_PROMPT}\n<|user|>\n${userContent}\n<|assistant|>`,
                    parameters: { max_new_tokens: 256, temperature: 0.7, return_full_text: false },
                  }),
                  signal: AbortSignal.timeout(30000),
                },
              );

              if (!res.ok) {
                console.warn(`[help-agent] HF ${model} returned ${res.status}`);
                continue;
              }

              const data = await res.json();
              const reply = Array.isArray(data) ? data[0]?.generated_text : data?.generated_text;

              if (reply && reply.trim()) {
                const cleaned = reply.replace(/^<\|assistant\|>\s*/i, "").trim();
                return Response.json({ reply: cleaned || getFallback(message) }, { headers: CORS });
              }
            } catch (err: any) {
              console.warn(`[help-agent] HF ${model} error:`, err?.message);
              continue;
            }
          }

          return Response.json({ reply: getFallback(message) }, { headers: CORS });
        } catch (e) {
          console.error(`[help-agent] POST error:`, e);
          return Response.json({ reply: getFallback("") }, { headers: CORS });
        }
      },
    },
  },
});
