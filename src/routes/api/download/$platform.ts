import { createFileRoute } from "@tanstack/react-router";
import { REPO, TARGETS, resolveTarget } from "@/routes/api/public/downloads";

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
 * The target list lives in the resolver, so a new platform is added in one
 * place and both the buttons and this route pick it up.
 */
export const Route = createFileRoute("/api/download/$platform")({
  server: {
    handlers: {
      GET: async ({ params }) => {
        const wanted = params.platform.toLowerCase();
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
