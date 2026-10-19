import { createFileRoute } from "@tanstack/react-router";
import { egressStatus } from "@/lib/providers/egress.server";
import { lanePool } from "@/lib/providers/lane-pool.server";
import { brandCatalogue } from "@/lib/providers/zyraxon-brand.server";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, content-type",
  "Access-Control-Allow-Methods": "GET,OPTIONS",
};

/** Health of the ten ZYRAXON models, for the provider page and for callers who
 *  want to know before they send a turn.
 *
 *  Upstream model names are deliberately absent: which upstream backs a brand
 *  is an implementation detail, and exposing it would leak the rotation. The
 *  page only needs to know whether a brand is on its preferred binding or has
 *  rotated to a sibling. */
export const Route = createFileRoute("/api/public/zyraxon/v1/provider")({
  server: {
    handlers: {
      OPTIONS: async () => new Response(null, { status: 204, headers: CORS }),
      GET: async () => {
        const brands = await brandCatalogue();
        return Response.json(
          {
            object: "provider",
            id: "zyraxon",
            name: "ZYRAXON",
            endpoint: "/api/public/zyraxon/v1",
            count: brands.length,
            models: brands.map((b) => ({
              id: b.id,
              name: b.label,
              tagline: b.tagline,
              capability: b.capability,
              context: b.context,
              output: b.output,
              multimodal: b.multimodal,
              reasoning: b.reasoning,
              // "ready" = serving on its preferred binding. "rotated" = the
              // preferred upstream is unavailable and a sibling is covering,
              // which is a normal, healthy state — not an outage.
              status: b.preferredAvailable ? "ready" : "rotated",
            })),
            // Concurrency is per process. Publishing it lets an operator see
            // shedding before callers complain, and says plainly whether the
            // deployment has one egress address or many.
            concurrency: lanePool.stats(),
            egress: egressStatus(),
          },
          { headers: { ...CORS, "Cache-Control": "public, max-age=60" } },
        );
      },
    },
  },
});
