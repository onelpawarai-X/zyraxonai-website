import { createFileRoute } from "@tanstack/react-router";

const SYSTEM_PROMPT = `You are ZYRAXON Help Agent — a friendly, multilingual AI assistant on the ZYRAXON AI website. Guide users, answer questions, help navigate. Speak user's language. Be warm & concise. You can also have casual conversations.

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

// Free models — NO API KEY NEEDED
const HF_MODELS = [
  "HuggingFaceH4/zephyr-7b-beta",
  "mistralai/Mistral-7B-Instruct-v0.3",
  "google/gemma-2-2b-it",
];

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
      POST: async ({ request }: { request: Request }) => {
        try {
          const body = await request.json();
          const { message, history, hasImage } = body;

          if (!message || typeof message !== "string") {
            return Response.json({ error: "Message required" }, { status: 400 });
          }

          // Build prompt for Hugging Face text-generation
          const prompt = `<|system|>\n${SYSTEM_PROMPT}\n${history ? `Previous conversation:\n${history}\n` : ""}<|user|>\n${message}<|assistant|>\n`;

          // Try each free model
          for (const model of HF_MODELS) {
            try {
              const res = await fetch(
                `https://api-inference.huggingface.co/models/${model}`,
                {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({
                    inputs: prompt,
                    parameters: {
                      max_new_tokens: 400,
                      temperature: 0.7,
                      top_p: 0.9,
                      do_sample: true,
                      return_full_text: false,
                    },
                  }),
                },
              );

              if (!res.ok) continue;

              const data = await res.json();
              let reply = "";

              if (Array.isArray(data) && data[0]?.generated_text) {
                reply = data[0].generated_text.trim();
              } else if (data.generated_text) {
                reply = data.generated_text.trim();
              } else if (typeof data === "string") {
                reply = data.trim();
              }

              if (reply && reply.length > 5) {
                // Clean up the reply — remove system/user prefixes if leaked
                reply = reply.replace(/<\|.*?\|>/g, "").trim();
                if (reply.length > 5) {
                  return Response.json({ reply });
                }
              }
            } catch {
              continue;
            }
          }

          // All models failed — use smart fallback
          return Response.json({ reply: getFallback(message) });
        } catch {
          return Response.json({ reply: getFallback("") });
        }
      },
    },
  },
});
