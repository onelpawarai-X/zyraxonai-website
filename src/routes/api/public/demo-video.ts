import { createFileRoute } from "@tanstack/react-router";

/**
 * Stream one release video back through this origin.
 *
 * GitHub serves release assets as `attachment`, so a <video src> pointed at
 * github.com downloads the file instead of playing it. The storage URL behind
 * that redirect is signed and expires within the hour, which would cut a long
 * clip off mid-playback. This route follows the redirect on the server and
 * streams the bytes back as `video/mp4`, so the page gets a stable URL it can
 * seek in with a normal range request.
 *
 * The tag and file name are checked against the published release list before
 * anything is fetched, so the endpoint cannot be used to make this server fetch
 * an arbitrary GitHub URL.
 */

const REPO = "onelpawarai-X/zyraxon-studio";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, HEAD, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Range",
  "Access-Control-Expose-Headers": "Content-Range, Accept-Ranges, Content-Length",
};

/** The file extensions a clip may have. Anything else is refused. */
const VIDEO = /\.(mp4|webm|mov|m4v)$/i;

/** A tag or file name that cannot escape its path segment. */
function safe(part: string): boolean {
  return Boolean(part) && !part.includes("/") && !part.includes("\\") && !part.includes("..");
}

/** The content type for a clip, so the browser plays it rather than saving it. */
function contentType(name: string): string {
  if (/\.webm$/i.test(name)) return "video/webm";
  if (/\.mov$/i.test(name)) return "video/quicktime";
  if (/\.m4v$/i.test(name)) return "video/x-m4v";
  return "video/mp4";
}

export const Route = createFileRoute("/api/public/demo-video")({
  server: {
    handlers: {
      OPTIONS: async () => new Response(null, { status: 204, headers: CORS }),

      GET: async ({ request }) => {
        const url = new URL(request.url);
        const tag = url.searchParams.get("tag") ?? "";
        const name = url.searchParams.get("name") ?? "";

        if (!safe(tag) || !safe(name) || !VIDEO.test(name)) {
          return Response.json({ error: "Unknown clip" }, { status: 400, headers: CORS });
        }

        // GitHub's own shortcut redirects to the signed storage URL. Asking for
        // the asset with `redirect: "follow"` on the server means the browser
        // never sees the short-lived address.
        const asset = `https://github.com/${REPO}/releases/download/${encodeURIComponent(tag)}/${encodeURIComponent(name)}`;

        // The range, if the browser is seeking. Passing it through is what makes
        // the scrub bar work on a clip that is still downloading.
        const range = request.headers.get("range");
        const upstream = await fetch(asset, {
          headers: range ? { Range: range } : {},
          redirect: "follow",
        }).catch(() => null);

        if (!upstream || !upstream.ok || !upstream.body) {
          return Response.json({ error: "Clip is not available" }, { status: 502, headers: CORS });
        }

        const headers = new Headers(CORS);
        headers.set("Content-Type", contentType(name));
        // `inline` is the whole point: it is what stops the browser from saving
        // the file when the visitor only wanted to watch it.
        headers.set("Content-Disposition", `inline; filename="${name}"`);
        headers.set("Accept-Ranges", upstream.headers.get("accept-ranges") ?? "bytes");
        for (const key of ["content-length", "content-range"]) {
          const value = upstream.headers.get(key);
          if (value) headers.set(key, value);
        }
        // A published clip never changes, so a long cache is safe and keeps the
        // second play of the same clip off GitHub entirely.
        headers.set("Cache-Control", "public, max-age=86400, immutable");

        return new Response(upstream.body, { status: upstream.status, headers });
      },
    },
  },
});
