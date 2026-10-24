import { createFileRoute } from "@tanstack/react-router";
import { ENDPOINTS, ENDPOINT_GROUPS, endpointUrl } from "@/lib/providers/endpoints";
import { providerGateOpen, starGateState } from "@/lib/providers/star-gate";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, content-type",
  "Access-Control-Allow-Methods": "GET,OPTIONS",
};

/** The whole API surface in one read.
 *
 *  This exists for the caller that is not a person: a search tool, a fetch tool,
 *  or an agent that was pointed at the provider and needs the contract without
 *  rendering a page. It is the same catalogue `/providers` renders from, so what
 *  an agent reads here cannot disagree with what a human sees there.
 *
 *  Public and unauthenticated on purpose. A contract that is hard to read is a
 *  contract nobody integrates with. */
export const Route = createFileRoute("/api/public/zyraxon/v1/endpoints")({
  server: {
    handlers: {
      OPTIONS: async () => new Response(null, { status: 204, headers: CORS }),
      GET: async () =>
        Response.json(
          {
            provider: "zyraxon",
            open: providerGateOpen,
            gate: providerGateOpen ? null : starGateState(null, new Date().toISOString()),
            keyRequired: false,
            keyNote: "No API key is needed. Send any non-empty string if a client insists on one.",
            groups: ENDPOINT_GROUPS,
            count: ENDPOINTS.length,
            endpoints: ENDPOINTS.map((e) => ({
              id: e.id,
              group: e.group,
              method: e.method,
              url: endpointUrl(e),
              path: e.path,
              name: e.name,
              blurb: e.blurb,
              returns: e.returns,
              keyRequired: !e.keyless,
              featured: Boolean(e.featured),
              ...(e.fields ? { fields: e.fields } : {}),
              ...(e.notes ? { notes: e.notes } : {}),
              ...(e.snippets ? { snippets: e.snippets } : {}),
            })),
          },
          { headers: { ...CORS, "Cache-Control": "public, max-age=300" } },
        ),
    },
  },
});
