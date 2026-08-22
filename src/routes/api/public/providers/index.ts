import { createFileRoute } from "@tanstack/react-router";
import { listProviders } from "@/lib/providers/modelsdev.server";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "content-type, authorization",
  "Access-Control-Allow-Methods": "GET,OPTIONS",
};

export const Route = createFileRoute("/api/public/providers/")({
  server: {
    handlers: {
      OPTIONS: async () => new Response(null, { status: 204, headers: CORS }),

      GET: async () => {
        try {
          const providers = await listProviders();
          return Response.json(
            { count: providers.length, providers },
            {
              headers: { ...CORS, "Cache-Control": "public, max-age=300" },
            },
          );
        } catch (e) {
          return Response.json(
            {
              error: "Provider catalog unavailable",
              detail: e instanceof Error ? e.message : "unknown",
            },
            { status: 502, headers: CORS },
          );
        }
      },
    },
  },
});
