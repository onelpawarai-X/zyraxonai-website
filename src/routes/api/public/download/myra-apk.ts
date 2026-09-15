import { createFileRoute } from "@tanstack/react-router";

/**
 * /api/public/download/myra-apk
 * Redirects to the latest Myra Agent APK from onelpawarai-X/Myra-Agent releases.
 */

const MYRA_REPO = "onelpawarai-X/Myra-Agent";
const FALLBACK = `https://github.com/${MYRA_REPO}/releases`;

const HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Cache-Control": "public, max-age=300",
};

async function resolveMyraApk(): Promise<string> {
  const token = process.env["GITHUB_PERSONAL_ACCESS_TOKEN"];
  const res = await fetch(`https://api.github.com/repos/${MYRA_REPO}/releases?per_page=10`, {
    headers: {
      Accept: "application/vnd.github+json",
      "User-Agent": "zyraxon-website",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  });
  if (!res.ok) return FALLBACK;

  const releases = (await res.json()) as {
    draft: boolean;
    tag_name: string;
    assets: { name: string; browser_download_url: string }[];
  }[];

  for (const rel of releases.filter((r) => !r.draft)) {
    const apk = rel.assets.find((a) => /\.apk$/i.test(a.name));
    if (apk) return apk.browser_download_url;
  }
  return FALLBACK;
}

export const Route = createFileRoute("/api/public/download/myra-apk")({
  server: {
    handlers: {
      OPTIONS: async () => new Response(null, { status: 204, headers: HEADERS }),
      GET: async () => {
        try {
          const url = await resolveMyraApk();
          return Response.redirect(url, 302);
        } catch {
          return Response.redirect(FALLBACK, 302);
        }
      },
    },
  },
});
