import { createFileRoute } from "@tanstack/react-router";
import { brandCatalogue } from "@/lib/providers/zyraxon-brand.server";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, content-type",
  "Access-Control-Allow-Methods": "GET,OPTIONS",
};

/** The ZYRAXON provider line went live on 2026-10-19 (commit 2dd4557, "Rooted
 *  ZYRAXON provider over OpenCode Zen free pool"). Published here so a client
 *  can answer "since when?" without reading the repo history. */
const PROVIDER_SINCE = "2026-10-19";

/** The model catalogue a caller reads. Ten ZYRAXON models, nothing else —
 *  upstream names are an implementation detail and stay server-side. */
export const Route = createFileRoute("/api/public/zyraxon/v1/models")({
  server: {
    handlers: {
      OPTIONS: async () => new Response(null, { status: 204, headers: CORS }),
      GET: async () => {
        // Stable across requests: derived from the provider's launch date, not
        // from `Date.now()`, so a catalogue read does not look like ten models
        // that were all created this second.
        const created = Math.floor(Date.parse(`${PROVIDER_SINCE}T00:00:00Z`) / 1000);
        const brands = await brandCatalogue();
        return Response.json(
          {
            object: "list",
            provider: {
              id: "zyraxon",
              name: "ZYRAXON",
              since: PROVIDER_SINCE,
              endpoint: "/api/public/zyraxon/v1",
            },
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
              // ZYRAXON extensions: the modalities the model accepts and its
              // live token limits. A client that only knows OpenAI ignores them;
              // one that sends media can use them to pick a model.
              //
              // Every brand advertises the full media intake. Choosing a model
              // is not how a caller gets media handled — the line routes each
              // turn to an upstream measured able to take the parts it carries —
              // so the catalogue must not present media support as a per-model
              // decision the caller has to get right.
              context_window: b.context,
              max_output_tokens: b.output,
              input_modalities: b.modalities,
              // Which modalities the upstream currently bound to this brand was
              // measured to accept. Operational detail, not a caller's concern.
              routed_modalities: b.routed_modalities,
              reasoning: b.reasoning,
            })),
          },
          { headers: { ...CORS, "Cache-Control": "public, max-age=300" } },
        );
      },
    },
  },
});
