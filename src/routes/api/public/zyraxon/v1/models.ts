import { createFileRoute } from "@tanstack/react-router";
import { brandCatalogue } from "@/lib/providers/zyraxon-brand.server";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, content-type",
  "Access-Control-Allow-Methods": "GET,OPTIONS",
};

/** The model catalogue a caller reads. Ten ZYRAXON models, nothing else —
 *  upstream names are an implementation detail and stay server-side. */
export const Route = createFileRoute("/api/public/zyraxon/v1/models")({
  server: {
    handlers: {
      OPTIONS: async () => new Response(null, { status: 204, headers: CORS }),
      GET: async () => {
        const created = Math.floor(Date.now() / 1000);
        const brands = await brandCatalogue();
        return Response.json(
          {
            object: "list",
            data: brands.map((b) => ({
              id: b.id,
              object: "model",
              created,
              owned_by: "zyraxon",
              name: b.label,
              display_name: b.label,
              description: `${b.tagline} — ${b.capability}`,
              // Standard OpenAI catalogue fields, so existing clients read the
              // list without special-casing us.
              permission: [],
              root: b.id,
              parent: null,
            })),
          },
          { headers: { ...CORS, "Cache-Control": "public, max-age=300" } },
        );
      },
    },
  },
});
