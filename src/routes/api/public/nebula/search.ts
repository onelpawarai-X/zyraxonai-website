import { createFileRoute } from "@tanstack/react-router";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

type HFModel = {
  id: string;
  modelId: string;
  author: string;
  pipeline_tag: string;
  tags: string[];
  downloads: number;
  likes: number;
  lastModified: string;
};

type SearchResult = {
  models: HFModel[];
  total: number;
  query: string;
};

export async function searchHuggingFace(
  query: string,
  limit = 20,
  pipeline?: string,
): Promise<SearchResult> {
  const params = new URLSearchParams({
    search: query,
    limit: String(limit),
    sort: "downloads",
    direction: "-1",
  });
  if (pipeline) params.set("pipeline_tag", pipeline);

  const res = await fetch(`https://huggingface.co/api/models?${params}`, {
    headers: { Accept: "application/json" },
  });

  if (!res.ok) throw new Error(`HuggingFace API ${res.status}: ${await res.text()}`);

  const models: HFModel[] = await res.json();
  return {
    models: models.map((m) => ({
      id: m.id || m.modelId,
      modelId: m.modelId || m.id,
      author: (m.id || m.modelId).split("/")[0],
      pipeline_tag: m.pipeline_tag || "unknown",
      tags: m.tags || [],
      downloads: m.downloads || 0,
      likes: m.likes || 0,
      lastModified: m.lastModified || "",
    })),
    total: models.length,
    query,
  };
}

export const Route = createFileRoute("/api/public/nebula/search")({
  server: {
    handlers: {
      OPTIONS: async () => new Response(null, { status: 204, headers: CORS }),
      GET: async ({ request }) => {
        try {
          const url = new URL(request.url);
          const query = url.searchParams.get("q") || "";
          const limit = Math.min(Number(url.searchParams.get("limit") || "20"), 50);
          const pipeline = url.searchParams.get("pipeline") || undefined;

          if (!query) {
            return Response.json(
              { error: "Missing search query (?q=...)" },
              { status: 400, headers: CORS },
            );
          }

          const result = await searchHuggingFace(query, limit, pipeline);
          return Response.json({ success: true, ...result }, { headers: CORS });
        } catch (err) {
          return Response.json(
            { success: false, error: String(err) },
            { status: 500, headers: CORS },
          );
        }
      },
    },
  },
});
