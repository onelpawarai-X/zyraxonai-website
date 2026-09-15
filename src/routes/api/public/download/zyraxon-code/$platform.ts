import { createFileRoute } from "@tanstack/react-router";

/**
 * /api/public/download/zyraxon-code/$platform
 * Redirects to the latest Zyraxon Code release from onelpawarai-X/Zyraxon-Code releases.
 * Platforms: windows, mac-arm, mac-intel, linux
 */

const CODE_REPO = "onelpawarai-X/Zyraxon-Code";

const HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Cache-Control": "public, max-age=300",
};

const PLATFORM_PATTERNS: Record<string, RegExp[]> = {
  windows: [/\.exe$/i, /\.msi$/i, /win.*\.zip$/i],
  "mac-arm": [/(mac|osx|darwin).*(arm64|aarch64|silicon)/i, /-arm64/i, /darwin.*arm/i],
  "mac-intel": [/(mac|osx|darwin).*(x64|x86_64|intel)/i, /-x64/i, /darwin.*x64/i],
  linux: [/\.AppImage$/i, /\.deb$/i, /\.rpm$/i, /linux.*\.tar\.gz$/i, /linux.*\.zip$/i],
};

const NOISE = /(\.blockmap$|\.ya?ml$|\.sha\d*$|\.sig$|\.txt$|^latest)/i;

const ALIASES: Record<string, string> = {
  win: "windows",
  exe: "windows",
  windows: "windows",
  mac: "mac-arm",
  "mac-arm": "mac-arm",
  "mac-intel": "mac-intel",
  linux: "linux",
};

type GhRelease = {
  tag_name: string;
  draft: boolean;
  html_url: string;
  assets: { name: string; browser_download_url: string; size: number }[];
};

async function resolveCodeRelease(platform: string): Promise<{ url: string; fallback: string }> {
  const fallback = `https://github.com/${CODE_REPO}/releases`;
  const token = process.env["GITHUB_PERSONAL_ACCESS_TOKEN"];
  const res = await fetch(`https://api.github.com/repos/${CODE_REPO}/releases?per_page=10`, {
    headers: {
      Accept: "application/vnd.github+json",
      "User-Agent": "zyraxon-website",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  });
  if (!res.ok) return { url: fallback, fallback };

  const releases = (await res.json()) as GhRelease[];
  const patterns = PLATFORM_PATTERNS[platform];
  if (!patterns) return { url: fallback, fallback };

  for (const rel of releases.filter((r) => !r.draft)) {
    const assets = (rel.assets || []).filter((a) => !NOISE.test(a.name));
    for (const pattern of patterns) {
      const hit = assets.find((a) => pattern.test(a.name));
      if (hit) return { url: hit.browser_download_url, fallback };
    }
  }
  return { url: fallback, fallback };
}

export const Route = createFileRoute("/api/public/download/zyraxon-code/$platform")({
  server: {
    handlers: {
      OPTIONS: async () => new Response(null, { status: 204, headers: HEADERS }),
      GET: async ({ params }) => {
        const key = ALIASES[String(params.platform || "").toLowerCase()];
        const fallback = `https://github.com/${CODE_REPO}/releases`;
        if (!key || !PLATFORM_PATTERNS[key]) {
          return Response.redirect(fallback, 302);
        }
        try {
          const { url } = await resolveCodeRelease(key);
          return Response.redirect(url, 302);
        } catch {
          return Response.redirect(fallback, 302);
        }
      },
    },
  },
});
