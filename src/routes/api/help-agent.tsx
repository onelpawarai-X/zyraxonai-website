import { createFileRoute } from "@tanstack/react-router";

const CORS: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "content-type",
  "Access-Control-Allow-Methods": "GET,OPTIONS",
};

const ZEN_BASE = "https://opencode.ai/zen/v1";
const ZEN_MODELS_URL = `${ZEN_BASE}/models`;

export const Route = createFileRoute("/api/help-agent")({
  server: {
    handlers: {
      OPTIONS: async () => new Response(null, { status: 204, headers: CORS }),

      GET: async () => {
        try {
          const res = await fetch(ZEN_MODELS_URL, {
            headers: { "User-Agent": "opencode/1.0" },
            signal: AbortSignal.timeout(10000),
          });
          if (!res.ok) throw new Error("models fetch failed");
          const data = await res.json();
          const allModels = data?.data || [];
          const freeModels = allModels
            .filter((m: any) => {
              const id = m.id || "";
              return id.includes("free") || id === "big-pickle" || id === "union-alpha";
            })
            .map((m: any) => ({
              id: m.id,
              name: m.id,
              free: true,
            }));
          if (freeModels.length === 0) {
            freeModels.push({ id: "big-pickle", name: "big-pickle", free: true });
          }
          return Response.json(
            { models: freeModels, defaultModel: "big-pickle" },
            { headers: { ...CORS, "Cache-Control": "public, max-age=60" } },
          );
        } catch {
          return Response.json(
            { models: [{ id: "big-pickle", name: "big-pickle", free: true }], defaultModel: "big-pickle" },
            { headers: { ...CORS, "Cache-Control": "public, max-age=60" } },
          );
        }
      },
    },
  },
});
