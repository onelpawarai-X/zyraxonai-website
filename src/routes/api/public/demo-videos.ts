import { createFileRoute } from "@tanstack/react-router";

/**
 * The demo clips, read from the studio repository's releases.
 *
 * The studio publishes a release whenever a walkthrough is ready and attaches
 * the video to the tag. Nothing on this site is edited when that happens: this
 * endpoint lists the tags, reads each one's assets, keeps the video files and
 * hands back a playlist. The demo page reads it, so a new release appears on its
 * own.
 *
 * GitHub serves release assets as `attachment`, which browsers will download
 * rather than play, and the storage URL behind it is signed and short-lived. So
 * the listing points at `/api/public/demo-video?tag=…&name=…` on this origin,
 * and that route streams the bytes back. The page can then use a normal <video>
 * with range requests, and the URL does not expire mid-playback.
 */

const REPO = "onelpawarai-X/zyraxon-studio";

/** What counts as a clip. The studio also attaches audio and stills. */
const VIDEO = /\.(mp4|webm|mov|m4v)$/i;

/** Attachments that are not the walkthrough itself. */
const NOT_A_CLIP = /(^|[-_.])(audio|music|soundtrack|voice|mix|stems)([-_.]|$)/i;

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

const GH_HEADERS = {
  "User-Agent": "Mozilla/5.0 (compatible; ZYRAXON-site/1.0; +https://zyraxonai.lovable.app)",
  Accept: "text/html,application/xhtml+xml",
};

export type DemoClip = {
  /** The release tag the clip was published under. */
  tag: string;
  /** The asset file name, as uploaded. */
  name: string;
  /** When the release was published, ISO. */
  publishedAt: string | null;
  /** Size in bytes, when GitHub's page stated one. */
  size: number | null;
  /** The stream URL on this origin, for the <video> element. */
  src: string;
  /** A direct GitHub link, for a download or a share. */
  download: string;
};

/**
 * The tags the studio has published, newest first.
 *
 * Read from the releases page rather than the API, for the same reason the
 * download resolver does: the page carries the whole tag history in one
 * response, and it needs no token. A repository with no releases yields an empty
 * list, which the page renders as "no clips yet" rather than an error.
 */
async function tagsOf(repo: string): Promise<string[]> {
  try {
    const res = await fetch(`https://github.com/${repo}/releases`, { headers: GH_HEADERS });
    if (!res.ok) return [];
    const html = await res.text();
    const escaped = repo.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const re = new RegExp(`/${escaped}/releases/tag/([^"?#]+)`, "g");
    const seen = new Set<string>();
    const out: string[] = [];
    for (const m of html.matchAll(re)) {
      const tag = decodeURIComponent(m[1]);
      if (seen.has(tag)) continue;
      seen.add(tag);
      out.push(tag);
    }
    return out;
  } catch {
    return [];
  }
}

/**
 * The assets attached to one release, and when it was published.
 *
 * Parsed from the anchor `href`s rather than the surrounding markup, because the
 * classes are presentation and change without notice. The size and the publish
 * date sit in the same fragment as the link.
 */
async function releaseOf(
  repo: string,
  tag: string,
): Promise<{ name: string; size: number | null }[]> {
  try {
    const res = await fetch(
      `https://github.com/${repo}/releases/expanded_assets/${encodeURIComponent(tag)}`,
      { headers: GH_HEADERS },
    );
    if (!res.ok) return [];
    const html = await res.text();

    const seen = new Set<string>();
    const out: { name: string; size: number | null }[] = [];

    for (const row of html.split(/<li\b/)) {
      const link = row.match(/href="\/[^"]*\/releases\/download\/[^"]*?\/([^"/]+)"/);
      if (!link) continue;
      const name = decodeURIComponent(link[1]);
      if (seen.has(name)) continue;
      seen.add(name);

      const size = row.match(/([\d.]+)\s*(KB|MB|GB)\b/);
      let bytes: number | null = null;
      if (size) {
        const n = Number(size[1]);
        const factor = size[2] === "GB" ? 1024 ** 3 : size[2] === "MB" ? 1024 ** 2 : 1024;
        bytes = Math.round(n * factor);
      }
      out.push({ name, size: bytes });
    }
    return out;
  } catch {
    return [];
  }
}

/** The publish dates of the tags, so a clip can be listed newest first. */
async function publishedAt(repo: string, tag: string): Promise<string | null> {
  try {
    const res = await fetch(`https://github.com/${repo}/releases/tag/${encodeURIComponent(tag)}`, {
      headers: GH_HEADERS,
    });
    if (!res.ok) return null;
    const html = await res.text();
    const m = html.match(/<relative-time[^>]*datetime="([^"]+)"/);
    return m ? m[1] : null;
  } catch {
    return null;
  }
}

/**
 * Every video attached to any release, newest release first.
 *
 * The result is cached for ten minutes. Reading it costs one request per tag,
 * and a tag that is a month old will not gain a file; ten minutes is short
 * enough that a walkthrough uploaded now shows up while the uploader is still
 * looking at the page.
 */
const CACHE_MS = 600_000;
let cache: { at: number; value: DemoClip[] } | null = null;

export async function resolveDemoClips(options?: { fresh?: boolean }): Promise<DemoClip[]> {
  if (!options?.fresh && cache && Date.now() - cache.at < CACHE_MS) return cache.value;

  const tags = await tagsOf(REPO);
  const clips: DemoClip[] = [];

  for (const tag of tags) {
    const assets = await releaseOf(REPO, tag);
    const videos = assets.filter((a) => VIDEO.test(a.name) && !NOT_A_CLIP.test(a.name));
    if (!videos.length) continue;

    const at = await publishedAt(REPO, tag);
    for (const asset of videos) {
      clips.push({
        tag,
        name: asset.name,
        publishedAt: at,
        size: asset.size,
        src: `/api/public/demo-video?tag=${encodeURIComponent(tag)}&name=${encodeURIComponent(asset.name)}`,
        download: `https://github.com/${REPO}/releases/download/${encodeURIComponent(tag)}/${encodeURIComponent(asset.name)}`,
      });
    }
  }

  // Newest release first; a clip with no date sorts below one that has it.
  clips.sort((a, b) => (b.publishedAt ?? "").localeCompare(a.publishedAt ?? ""));

  if (clips.length) cache = { at: Date.now(), value: clips };
  return clips;
}

export const Route = createFileRoute("/api/public/demo-videos")({
  server: {
    handlers: {
      OPTIONS: async () => new Response(null, { status: 204, headers: CORS }),

      /** The playlist the demo page renders. */
      GET: async ({ request }) => {
        const url = new URL(request.url);
        const fresh = url.searchParams.get("fresh") === "1";
        const clips = await resolveDemoClips({ fresh });
        return Response.json(
          { repo: REPO, count: clips.length, clips },
          {
            headers: {
              ...CORS,
              // The page should pick up a new release quickly, and the list is
              // small, so a short shared cache is right: a burst of visitors
              // after a release shares one read.
              "Cache-Control": fresh ? "no-store" : "public, max-age=300",
            },
          },
        );
      },
    },
  },
});
