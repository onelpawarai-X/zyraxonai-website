import { createFileRoute } from "@tanstack/react-router";
import { egressStatus } from "@/lib/providers/egress.server";
import { FLEET_SHARDS, fleetStatus } from "@/lib/providers/fleet.server";
import { lanePool } from "@/lib/providers/lane-pool.server";
import { MAX_MEDIA_BODY_BYTES, MAX_MEDIA_PARTS } from "@/lib/providers/media";
import { PROVIDER_SYSTEM_PROMPT } from "@/lib/providers/provider-contract";
import { brandCatalogue } from "@/lib/providers/zyraxon-brand.server";
import { quotaResetStatus } from "@/lib/providers/quota.server";
import { probeQuotaReset } from "@/lib/providers/quota-probe.server";

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
        // Read once, before the model list, because both the per-model
        // `servable` flag and the `freeTier` block below must agree about the
        // same instant — two calls could straddle a reset and contradict
        // each other inside one payload.
        // When the recorded deadline has passed but nothing has been served
        // since, the local clock is the only thing we have and it is not
        // evidence. Ask the upstream and answer from that, so two isolates that
        // were told different things converge on the same truth instead of
        // disagreeing until each one's timer happens to expire.
        const before = quotaResetStatus();
        if (before.unknown || (before.spent && !before.retryAfterSeconds)) {
          await Promise.race([
            probeQuotaReset(Date.now(), true),
            new Promise((r) => setTimeout(r, 4_000)),
          ]);
        }
        const reset = quotaResetStatus();
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
              routed_modalities: b.routed_modalities,
              reasoning: b.reasoning,
              // "ready" = serving on its preferred binding. "rotated" = the
              // preferred upstream is unavailable and a sibling is covering,
              // which is a normal, healthy state — not an outage.
              status: b.preferredAvailable ? "ready" : "rotated",
              // Whether a turn on this model would be served *now*. The binding
              // status above says nothing about the account's quota, so a
              // catalogue read during a spent window reported every model as
              // "ready" while every call was refused with a 429 — the badge and
              // the refusal contradicted each other. This is the field that
              // tells a caller the truth without spending a request to find it.
              servable: !reset.spent,
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
            // Whether the shared free tier is currently spent, and when it opens
            // again. Published here so a page can show a real countdown without
            // having to send a request just to be told "429" first — and so the
            // number a caller sees is the upstream's own, not a guess.
            freeTier: (() => {
              // The recorded reset is the upstream's *promise*; a probe is
              // evidence. While a quota is spent, this asks the upstream
              // whether it will serve again, so the panel can flip to open the
              // moment that is true rather than waiting for the clock. It is
              // paced and deduplicated, and a refused probe leaves the clock
              // untouched, so it can only ever make the answer more accurate.
              void probeQuotaReset();
              return {
                available: !reset.spent,
                // An isolate that has no evidence says so, so a surface shows
                // "checking" rather than a green "Free tier open" it cannot
                // vouch for — the exact claim two profiles used to disagree on.
                ...(reset.unknown ? { unknown: true } : {}),
                ...(reset.spent
                  ? {
                      retryAfterSeconds: reset.retryAfterSeconds,
                      resetAt: reset.resetAt,
                      // The ceiling, so a client can draw how much of the wait
                      // is behind it rather than a bare number with no scale.
                      windowSeconds: reset.windowSeconds,
                      // Our clock, so a reader whose own is wrong can correct
                      // the deadline rather than misread it as already passed.
                      serverNow: reset.serverNow,
                    }
                  : {}),
              };
            })(),
          },
          { headers: { ...CORS, "Cache-Control": "public, max-age=60" } },
        );
      },
    },
  },
});
