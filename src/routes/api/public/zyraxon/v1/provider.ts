import { createFileRoute } from "@tanstack/react-router";
import { egressStatus } from "@/lib/providers/egress.server";
import { FLEET_SHARDS, fleetStatus } from "@/lib/providers/fleet.server";
import { lanePool } from "@/lib/providers/lane-pool.server";
import { MAX_MEDIA_BODY_BYTES, MAX_MEDIA_PARTS } from "@/lib/providers/media";
import { PROVIDER_SYSTEM_PROMPT } from "@/lib/providers/provider-contract";
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
              modalities: b.modalities,
              reasoning: b.reasoning,
              // "ready" = serving on its preferred binding. "rotated" = the
              // preferred upstream is unavailable and a sibling is covering,
              // which is a normal, healthy state — not an outage.
              status: b.preferredAvailable ? "ready" : "rotated",
            })),
            // Which input modalities the line can serve right now, so a client
            // can tell at a glance whether video or audio is available today.
            modalities: Array.from(new Set(brands.flatMap((b) => b.modalities))).sort(),
            // Concurrency is per process. Publishing it lets an operator see
            // shedding before callers complain, and says plainly whether the
            // deployment has one egress address or many.
            concurrency: lanePool.stats(),
            // The fleet-wide picture: how many shards, how many lanes each, and
            // the product — the number of concurrent turns the deployment can
            // actually hold before it sheds or spills.
            fleet: fleetStatus(
              FLEET_SHARDS,
              lanePool.capacity().maxActive,
              lanePool.capacity().spillMax,
            ),
            // Overload policy, stated so a caller knows what a 503 meant and an
            // operator knows where the overflow goes.
            overload: {
              spillTo: "opencode-zen-free-pool",
              spillLanes: lanePool.capacity().spillMax,
              queueLanes: lanePool.capacity().maxQueued,
              note: "Primary lanes serve on ZYRAXON's own budget; a full primary tier spills to the OpenCode Zen free pool, then queues, then sheds with 503 + Retry-After. Every response carries X-ZYRAXON-Capacity: primary|spill.",
            },
            // The contract every turn is served under, and the limits a caller
            // has to work within. Published here so a client can show its users
            // the rules without scraping the docs page, and so the rules have one
            // machine-readable home.
            systemPrompt: PROVIDER_SYSTEM_PROMPT,
            usage: {
              maxPartsPerRequest: MAX_MEDIA_PARTS,
              maxBodyBytes: MAX_MEDIA_BODY_BYTES,
              maxMessages: 48,
              defaultStream: false,
              note: "Limits for the chat-completions endpoint. See the provider guide for media shapes and sizes.",
            },
            egress: egressStatus(),
          },
          { headers: { ...CORS, "Cache-Control": "public, max-age=60" } },
        );
      },
    },
  },
});
