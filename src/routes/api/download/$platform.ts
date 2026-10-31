import { createFileRoute } from "@tanstack/react-router";
import { REPO, TARGETS, resolveTarget } from "@/routes/api/public/downloads";
import { OS_RELEASES_URL, isOsId, resolveOsTarget } from "@/lib/os-releases.server";

/**
 * Direct-download endpoint for every platform button.
 *
 * A link to GitHub's releases page makes the visitor hunt for the right file.
 * This route resolves the newest matching asset and answers 302 to the asset's
 * own download URL, which GitHub serves as `content-disposition: attachment` —
 * so the browser saves the file and never opens a page.
 *
 * It is a redirect rather than a stream on purpose: GitHub's asset URLs are
 * signed and short-lived, so proxying the bytes through this deployment would
 * cost bandwidth to deliver a file the visitor can fetch directly from the CDN,
 * and would break large downloads on a request timeout.
 *
 * Two catalogs feed it. The Agent's targets live in the downloads resolver; the
 * ZyraxonOS image lives in its own repository and its own resolver, because the
 * two ship on independent tags. Both are consulted here so one URL shape serves
 * every button on the site.
 */
export const Route = createFileRoute("/api/download/$platform")({
  server: {
    handlers: {
      GET: async ({ params }) => {
        const wanted = params.platform.toLowerCase();

        // The OS image first when the id is one of its own, so a future Agent
        // target cannot shadow `zyraxon-os`.
        if (isOsId(wanted)) {
          const os = await resolveOsTarget(wanted).catch(() => null);
          if (os?.url) return Response.redirect(os.url, 302);
          // The id is real but the release could not be read: the releases page
          // is where the files always are.
          return Response.redirect(`${OS_RELEASES_URL}/latest`, 302);
        }

        const asset = await resolveTarget(wanted).catch(() => null);
        if (asset?.url) return Response.redirect(asset.url, 302);
        // Unknown id, or the release could not be read: send the visitor to the
        // one place that always lists every file rather than to a dead end.
        const known = TARGETS.some((t) => t.id === wanted);
        const fallback = known
          ? `https://github.com/${REPO}/releases/latest`
          : `https://github.com/${REPO}/releases`;
        return Response.redirect(fallback, 302);
      },
    },
  },
});
