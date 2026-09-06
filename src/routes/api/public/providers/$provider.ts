import { createFileRoute } from "@tanstack/react-router";
import { getProviderDetail, resolveProviderApi } from "@/lib/providers/modelsdev.server";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "content-type, authorization",
  "Access-Control-Allow-Methods": "GET,OPTIONS",
};

export const Route = createFileRoute("/api/public/providers/$provider")({
  server: {
    handlers: {
      OPTIONS: async () => new Response(null, { status: 204, headers: CORS }),

      GET: async ({ params }) => {
        const providerId = decodeURIComponent(params.provider).trim();
        if (!providerId)
          return Response.json({ error: "provider required" }, { status: 400, headers: CORS });
        try {
          const detail = await getProviderDetail(providerId);
          if (!detail)
            return Response.json(
              { error: `Unknown provider: ${providerId}` },
              { status: 404, headers: CORS },
            );
          return Response.json(detail, {
            headers: { ...CORS, "Cache-Control": "public, max-age=300" },
          });
        } catch (e) {
          return Response.json(
            {
              error: "Model catalog unavailable",
              detail: e instanceof Error ? e.message : "unknown",
            },
            { status: 502, headers: CORS },
          );
        }
      },

      POST: async ({ request, params }) => {
        const providerId = decodeURIComponent(params.provider).trim();
        let body: any = null;
        try {
          body = await request.json();
        } catch {
          body = null;
        }
        const apiKey = typeof body?.apiKey === "string" ? body.apiKey.trim() : "";
        try {
          const detail = await getProviderDetail(providerId);
          if (!detail)
            return Response.json(
              { error: `Unknown provider: ${providerId}` },
              { status: 404, headers: CORS },
            );
          return Response.json(
            {
              ...detail,
              keyAccepted: Boolean(apiKey),
              endpoint: resolveProviderApi(providerId, detail as unknown),
              note: "API keys stay in your browser (localStorage) and are only forwarded per request. Nothing is stored on our servers.",
            },
            { headers: { ...CORS, "Cache-Control": "no-store" } },
          );
        } catch (e) {
          return Response.json(
            {
              error: "Model catalog unavailable",
              detail: e instanceof Error ? e.message : "unknown",
            },
            { status: 502, headers: CORS },
          );
        }
      },
    },
  },
});
