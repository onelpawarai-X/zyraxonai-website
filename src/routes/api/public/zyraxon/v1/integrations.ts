import { createFileRoute } from "@tanstack/react-router";
import { integrationsDocument } from "@/lib/providers/integrations";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, content-type",
  "Access-Control-Allow-Methods": "GET,OPTIONS",
};

/** Everything a client needs to connect, in one read.
 *
 *  A tool that wants to use ZYRAXON can discover the base URL, the model
 *  catalogue, the key rule and a working snippet for its own platform without
 *  scraping the website or guessing at the endpoint shape. The catalogue lives
 *  in `integrations.ts`, the same module the docs and the `/providers` page
 *  render from, so a snippet shown on the site cannot drift from the one served
 *  here. */
export const Route = createFileRoute("/api/public/zyraxon/v1/integrations")({
  server: {
    handlers: {
      OPTIONS: async () => new Response(null, { status: 204, headers: CORS }),
      GET: async () =>
        Response.json(integrationsDocument(), {
          headers: { ...CORS, "Cache-Control": "public, max-age=300" },
        }),
    },
  },
});
