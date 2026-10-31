import { createFileRoute } from "@tanstack/react-router";
import { OS_REPO, resolveOs } from "@/lib/os-releases.server";

/**
 * GET /api/public/os — the newest ZyraxonOS release, as JSON.
 *
 * The OS is versioned in its own repository, so it is described on its own
 * endpoint rather than folded into `/api/public/downloads`. A client that wants
 * the Agent's builds asks that route; a client that wants the image asks this
 * one. Both read GitHub the same way — public HTML, no token — and both are
 * cached for a minute, so a page of buttons does not repeat the work.
 *
 * `?fresh=1` skips the cache, so a release published a moment ago is visible
 * without waiting for the minute to lapse.
 */
const HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
  "Cache-Control": "public, max-age=600",
};

export const Route = createFileRoute("/api/public/os")({
  server: {
    handlers: {
      OPTIONS: async () => new Response(null, { status: 204, headers: HEADERS }),
      GET: async ({ request }) => {
        const fresh = new URL(request.url).searchParams.get("fresh") === "1";
        try {
          return Response.json(await resolveOs({ fresh }), { headers: HEADERS });
        } catch (err) {
          return Response.json(
            {
              repo: OS_REPO,
              latest: null,
              release: null,
              releasesUrl: `https://github.com/${OS_REPO}/releases`,
              error: String(err),
            },
            { status: 200, headers: HEADERS },
          );
        }
      },
    },
  },
});
