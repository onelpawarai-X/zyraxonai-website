import { createFileRoute } from "@tanstack/react-router";
import { resolveReleases } from "@/routes/api/public/downloads";

/**
 * Direct-download endpoint for the platform buttons.
 *
 * A plain link to GitHub's releases page makes the visitor hunt for the right
 * asset. This route resolves the newest matching installer on the server and
 * answers with a 302 straight to the asset's own download URL, so the browser
 * saves the file instead of opening a page.
 *
 * Supported platforms:
 *   windows | mac-arm | mac-intel | linux | linux-appimage | linux-deb | linux-rpm
 */
const PLATFORM_TO_KEY: Record<string, string> = {
  windows: "windows",
  win: "windows",
  "windows-arm64": "windows-arm64",
  "win-arm64": "windows-arm64",
  "mac-arm": "mac-arm",
  "mac-apple-silicon": "mac-arm",
  "mac-intel": "mac-intel",
  mac: "mac-intel",
  linux: "linux",
  "linux-appimage": "linux-appimage",
  appimage: "linux-appimage",
  "linux-deb": "linux-deb",
  deb: "linux-deb",
  "linux-rpm": "linux-rpm",
  rpm: "linux-rpm",
};

export const Route = createFileRoute("/api/download/$platform")({
  server: {
    handlers: {
      GET: async ({ params }) => {
        const key = PLATFORM_TO_KEY[params.platform.toLowerCase()];
        if (!key) {
          return Response.redirect("https://github.com/onelpawarai-X/ZYRAXON-AI/releases", 302);
        }
        try {
          const data = await resolveReleases();
          const asset = data.platforms[key as keyof typeof data.platforms];
          if (asset?.url) return Response.redirect(asset.url, 302);
        } catch {
          // fall through to the releases page
        }
        return Response.redirect("https://github.com/onelpawarai-X/ZYRAXON-AI/releases", 302);
      },
    },
  },
});
