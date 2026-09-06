import { createFileRoute } from "@tanstack/react-router";
import { publishSite } from "@/lib/builder/github-publish.server";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "content-type",
  "Access-Control-Allow-Methods": "POST,OPTIONS",
};

/**
 * Public Builder publish endpoint.
 *
 * The Builder supplies a GitHub access token only for the publish request.
 * The server uses it to create/update the requested repository and enable
 * GitHub Pages. The token is not persisted by this route.
 */
export const Route = createFileRoute("/api/public/builder/publish")({
  server: {
    handlers: {
      OPTIONS: async () => new Response(null, { status: 204, headers: CORS }),
      POST: async ({ request }) => {
        try {
          const body: any = await request.json();
          const token = String(body?.token || "").trim();
          const repo = String(body?.repo || body?.repository || "").trim();
          const files =
            body?.files && typeof body.files === "object"
              ? body.files
              : { "index.html": String(body?.html || "") };

          const result = await publishSite({
            token,
            repo,
            html: String(files?.["index.html"] || body?.html || ""),
            description: body?.description ? String(body.description) : undefined,
            customDomain: body?.customDomain ? String(body.customDomain) : undefined,
            privateRepo: Boolean(body?.privateRepo),
          });

          return Response.json(result, {
            status: result.ok ? 200 : 400,
            headers: CORS,
          });
        } catch (error: any) {
          return Response.json(
            {
              ok: false,
              error: error?.message || "Publish failed",
            },
            { status: 500, headers: CORS },
          );
        }
      },
    },
  },
});
