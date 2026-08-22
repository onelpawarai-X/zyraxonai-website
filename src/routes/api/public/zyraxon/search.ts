import { createFileRoute } from "@tanstack/react-router";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, content-type",
  "Access-Control-Allow-Methods": "GET,OPTIONS",
};

export const Route = createFileRoute("/api/public/zyraxon/search")({
  server: {
    handlers: {
      OPTIONS: async () => new Response(null, { status: 204, headers: CORS }),
      GET: async ({ request }) => {
        const url = new URL(request.url);
        const query = (url.searchParams.get("q") || "").trim();
        const type = (url.searchParams.get("type") || "web").trim().toLowerCase();
        const limit = Math.min(Math.max(Number(url.searchParams.get("limit") || 10), 1), 10);
        const key = (process.env.GOOGLE_CSE_API_KEY || "").trim();
        const cx = (process.env.GOOGLE_CSE_ID || "").trim();

        if (!query)
          return Response.json({ error: "q is required" }, { status: 400, headers: CORS });
        if (!key || !cx) {
          return Response.json(
            {
              error: "Search gateway is not configured",
              setup: "Set GOOGLE_CSE_API_KEY and GOOGLE_CSE_ID on the server.",
            },
            { status: 503, headers: CORS },
          );
        }

        const params = new URLSearchParams({ key, cx, q: query, num: String(limit) });
        if (type === "image" || type === "images") params.set("searchType", "image");

        const response = await fetch(
          `https://www.googleapis.com/customsearch/v1?${params.toString()}`,
          {
            headers: { Accept: "application/json" },
          },
        );
        const payload: unknown = await response.json().catch(() => ({}));

        if (!response.ok) {
          return Response.json(
            {
              error: "Google search failed",
              detail: payload?.error?.message || "Upstream search error",
            },
            {
              status: response.status >= 400 ? response.status : 502,
              headers: CORS,
            },
          );
        }

        const items = Array.isArray(payload?.items) ? payload.items : [];
        return Response.json(
          {
            query,
            type,
            results: items.map((item: unknown) => ({
              title: item.title,
              url: item.link,
              snippet: item.snippet,
              displayUrl: item.displayLink,
              mime: item.mime,
              image: item.image
                ? {
                    thumbnail: item.image.thumbnailLink,
                    context: item.image.contextLink,
                    width: item.image.width,
                    height: item.image.height,
                  }
                : undefined,
            })),
          },
          { headers: CORS },
        );
      },
    },
  },
});
