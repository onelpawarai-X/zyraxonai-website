import { createFileRoute } from "@tanstack/react-router";

const CORS: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "content-type, authorization, lovable-api-key",
  "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
};

const GATEWAY_URL = "https://ai.gateway.lovable.dev/v1/chat/completions";
const DEFAULT_MODEL = "google/gemini-2.5-flash";

const ZYRAXON_KNOWLEDGE = `
You are the official ZYRAXON AI Assistant (help agent).
Your mission is to assist visitors, developers, and users with the ZYRAXON ecosystem.

Key facts about ZYRAXON AI:
- Main Repository: https://github.com/onelpawarai-X/ZYRAXON-AI
- Flagship App: ZYRAXON Agent (Desktop AI agent for Windows, macOS, Linux with 888 tools across 63 categories, 11 agent modes, 108 MCP integrations, Eternal Memory, Screen Vision, built-in Monaco AI editor).
- License: ZSL-X v2.0.0 (Zyraxon Sovereign License).
- Downloads: Windows (.exe), Linux (.deb), macOS (.dmg).
- Nebula Core: Private owner command center for instant feature uploads, announcements, and telemetry.

Response Style:
- Always be helpful, concise, friendly, and accurate.
- Respond in the exact language the user used (Bengali if asked in Bengali, English if asked in English).
- When asked how to install or download, give direct download links or point to the downloads section.
`;

export const Route = createFileRoute("/api/help-agent")({
  server: {
    handlers: {
      OPTIONS: async () => new Response(null, { status: 204, headers: CORS }),

      GET: async () => {
        return Response.json(
          {
            models: [
              { id: "google/gemini-2.5-flash", name: "Gemini 2.5 Flash (Ultra Fast)", free: true },
              { id: "openai/gpt-5-mini", name: "GPT-5 Mini", free: true },
            ],
            defaultModel: DEFAULT_MODEL,
          },
          { headers: { ...CORS, "Cache-Control": "public, max-age=300" } }
        );
      },

      POST: async ({ request }: { request: Request }) => {
        try {
          const body = await request.json().catch(() => ({}));
          const { message, history, model } = body;
          if (!message || typeof message !== "string") {
            return Response.json({ error: "Message is required" }, { status: 400, headers: CORS });
          }

          const apiKey = process.env.LOVABLE_API_KEY || "";
          const targetModel = model || DEFAULT_MODEL;

          const messages: any[] = [
            { role: "system", content: ZYRAXON_KNOWLEDGE },
          ];

          if (history && typeof history === "string") {
            messages.push({ role: "user", content: `Previous context:\n${history}` });
            messages.push({ role: "assistant", content: "Understood. I will use this context." });
          }

          messages.push({ role: "user", content: message });

          const upstreamRes = await fetch(GATEWAY_URL, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "Authorization": `Bearer ${apiKey}`,
              "Lovable-API-Key": apiKey,
            },
            body: JSON.stringify({
              model: targetModel,
              messages,
              stream: true,
            }),
          });

          if (!upstreamRes.ok) {
            const errText = await upstreamRes.text().catch(() => "");
            return Response.json(
              { error: `AI Gateway error: ${upstreamRes.status} ${errText.slice(0, 100)}` },
              { status: upstreamRes.status, headers: CORS }
            );
          }

          return new Response(upstreamRes.body, {
            headers: {
              "Content-Type": "text/event-stream; charset=utf-8",
              "Cache-Control": "no-cache, no-transform",
              Connection: "keep-alive",
              "Access-Control-Allow-Origin": "*",
            },
          });
        } catch (err: any) {
          return Response.json({ error: err?.message || "Internal server error" }, { status: 500, headers: CORS });
        }
      },
    },
  },
});
