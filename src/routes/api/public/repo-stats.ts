import { createFileRoute } from "@tanstack/react-router";
import { repoSnapshot } from "@/lib/providers/repo-stats.server";
import { STAR_GOAL, STAR_REPO, STAR_REPO_URL, starGateState } from "@/lib/providers/star-gate";
import { starEta } from "@/lib/providers/star-eta";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "content-type",
  "Access-Control-Allow-Methods": "GET,OPTIONS",
};

/** Live repository numbers for the homepage.
 *
 *  The star counter at the bottom of the homepage and the download total in the
 *  header both read this, so the two figures on the page come from one read and
 *  cannot disagree. `?fresh=1` skips the server cache, which is what the
 *  counter's own refresh uses. */
export const Route = createFileRoute("/api/public/repo-stats")({
  server: {
    handlers: {
      OPTIONS: async () => new Response(null, { status: 204, headers: CORS }),
      GET: async ({ request }) => {
        const fresh = new URL(request.url).searchParams.get("fresh") === "1";
        const snap = await repoSnapshot({ fresh });
        const eta = starEta(snap.stars, snap.createdAt);
        return Response.json(
          {
            repo: STAR_REPO,
            repoUrl: STAR_REPO_URL,
            stars: snap.stars,
            forks: snap.forks,
            downloads: snap.downloads,
            goal: STAR_GOAL,
            remaining: snap.stars === null ? null : Math.max(0, STAR_GOAL - snap.stars),
            progress: snap.stars === null ? null : Math.min(1, snap.stars / STAR_GOAL),
            // The projection behind the countdown clock: the clock itself (a
            // stated rule — one hour per star), and the measured pace, which is
            // reported beside it rather than used for it. Every field the panel
            // needs is here so the panel does no arithmetic of its own.
            eta: {
              starsPerDay: eta.starsPerDay,
              measuredDays: eta.measuredDays,
              hours: eta.hours,
              seconds: eta.seconds,
              reached: eta.reached,
              basis: eta.basis,
            },
            gate: starGateState(snap.stars, snap.at),
            checkedAt: snap.at,
          },
          // Short, because the number is the point of the counter. The server
          // cache already bounds the work; this only stops a burst of identical
          // reads within the same minute.
          { headers: { ...CORS, "Cache-Control": "public, max-age=60" } },
        );
      },
    },
  },
});
