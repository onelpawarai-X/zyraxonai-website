/**
 * Shared helpers for the NEBULA "Feature Studio" content pipeline.
 *
 * Every row the owner publishes lives in the `site_content` table and any
 * media lands in the private `site-content` storage bucket. The helpers here
 * turn a stored row into everything a surface needs: a rendered media block,
 * an embeddable URL for pasted links, and the public permalink that AI agents
 * can read.
 */

export const SITE_ORIGIN = "https://zyraxonai.lovable.app";

export type MediaType = "image" | "video" | "audio" | "file";

export type ContentKind = "feature" | "announcement" | "update" | "model" | "highlight";

export type ContentItem = {
  id: string;
  kind: string;
  title: string;
  subtitle: string | null;
  body: string | null;
  badge: string | null;
  accent: string | null;
  link_url: string | null;
  image_url: string | null;
  position: number;
  published: boolean;
  created_at: string;
  updated_at: string;
};

const IMAGE_EXT = new Set(["jpg", "jpeg", "png", "webp", "gif", "avif", "bmp", "svg"]);
const VIDEO_EXT = new Set(["mp4", "webm", "mov", "m4v", "ogv", "mkv"]);
const AUDIO_EXT = new Set(["mp3", "wav", "ogg", "oga", "m4a", "aac", "flac", "opus"]);

/** Strips the signed-URL query string so extension sniffing sees the real path. */
function cleanPath(value: string) {
  return value.split("?")[0].split("#")[0];
}

export function extensionOf(value: string | null | undefined) {
  if (!value) return "";
  const name = cleanPath(value).split("/").pop() || "";
  const ext = name.includes(".") ? name.split(".").pop()! : "";
  return ext.toLowerCase();
}

/**
 * Media is stored as a bucket path like `uploads/1712-ab.mp4`, so the kind of
 * media is derived from the extension instead of an extra column.
 */
export function mediaTypeOf(value: string | null | undefined): MediaType {
  const ext = extensionOf(value);
  if (IMAGE_EXT.has(ext)) return "image";
  if (VIDEO_EXT.has(ext)) return "video";
  if (AUDIO_EXT.has(ext)) return "audio";
  return "file";
}

const ACCEPTED_MEDIA = "image/*,video/*,audio/*";

function acceptAttrFor(kind: "image" | "video" | "audio") {
  if (kind === "image") return "image/*";
  if (kind === "video") return "video/*";
  return "audio/*";
}

export { ACCEPTED_MEDIA, acceptAttrFor };

/* -------------------------------------------------------------------------- */
/*                              Link -> embed URL                              */
/* -------------------------------------------------------------------------- */

function youtubeId(url: URL) {
  const host = url.hostname.replace(/^www\./, "");
  if (host === "youtu.be") return url.pathname.slice(1).split("/")[0] || null;
  if (host === "youtube.com" || host === "m.youtube.com" || host === "music.youtube.com") {
    if (url.pathname === "/watch") return url.searchParams.get("v");
    const m = /^\/(embed|shorts|v|live)\/([^/?#]+)/.exec(url.pathname);
    return m ? m[2]! : null;
  }
  if (host === "youtube-nocookie.com") {
    const m = /^\/embed\/([^/?#]+)/.exec(url.pathname);
    return m ? m[1]! : null;
  }
  return null;
}

function vimeoId(url: URL) {
  const host = url.hostname.replace(/^www\./, "");
  if (host !== "vimeo.com" && host !== "player.vimeo.com") return null;
  const m = /(\d{6,})/.exec(url.pathname);
  return m ? m[1]! : null;
}

function loomId(url: URL) {
  const host = url.hostname.replace(/^www\./, "");
  if (host !== "loom.com" && host !== "www.loom.com") return null;
  const m = /\/share\/([a-z0-9]+)/i.exec(url.pathname);
  return m ? m[1]! : null;
}

function tiktokId(url: URL) {
  const host = url.hostname.replace(/^www\./, "");
  if (host !== "tiktok.com") return null;
  const m = /\/video\/(\d+)/.exec(url.pathname);
  return m ? m[1]! : null;
}

function xId(url: URL) {
  const host = url.hostname.replace(/^www\./, "").toLowerCase();
  if (host !== "twitter.com" && host !== "x.com") return null;
  const m = /\/status\/(\d+)/.exec(url.pathname);
  return m ? m[1]! : null;
}

function spotifyId(url: URL) {
  const host = url.hostname.replace(/^www\./, "").toLowerCase();
  if (host !== "open.spotify.com" && host !== "spotify.link") return null;
  const m = /\/([a-z]+)\/([A-Za-z0-9]{15,})/.exec(url.pathname);
  if (!m) return null;
  return `https://open.spotify.com/embed/${m[1]}/${m[2]}`;
}

function soundcloudPath(url: URL) {
  const host = url.hostname.replace(/^www\./, "").toLowerCase();
  if (host !== "soundcloud.com") return null;
  return `https://w.soundcloud.com/player/?url=${encodeURIComponent(url.href)}`;
}

function streamableId(url: URL) {
  const host = url.hostname.replace(/^www\./, "").toLowerCase();
  if (host !== "streamable.com") return null;
  const m = /^\/(?:e|s)\/([A-Za-z0-9]+)/.exec(url.pathname);
  return m ? `https://streamable.com/${m[1]}` : null;
}

function isDirectMedia(url: URL) {
  if (!/^https?:$/.test(url.protocol)) return false;
  const ext = extensionOf(url.pathname);
  return IMAGE_EXT.has(ext) || VIDEO_EXT.has(ext) || AUDIO_EXT.has(ext);
}

/**
 * Turns any pasted link into something renderable in place:
 *   - YouTube / Vimeo / Loom / TikTok / X / Streamable -> iframe
 *   - Spotify / SoundCloud -> iframe player
 *   - direct .mp4 / .mp3 / .jpg links -> native <video>/<audio>/<img>
 *   - anything else -> null, so the surface falls back to a plain link
 */
export function embedFor(rawUrl: string | null | undefined): string | null {
  if (!rawUrl) return null;
  const trimmed = rawUrl.trim();
  if (!trimmed) return null;
  let url: URL;
  try {
    url = new URL(/^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`);
  } catch {
    return null;
  }

  if (isDirectMedia(url)) return url.href;

  const yt = youtubeId(url);
  if (yt) return `https://www.youtube-nocookie.com/embed/${yt}`;

  const vimeo = vimeoId(url);
  if (vimeo) return `https://player.vimeo.com/video/${vimeo}`;

  const loom = loomId(url);
  if (loom) return `https://www.loom.com/embed/${loom}`;

  const tiktok = tiktokId(url);
  if (tiktok) return `https://www.tiktok.com/embed/v2/${tiktok}`;

  const x = xId(url);
  if (x) return `https://platform.twitter.com/embed/Tweet.html?id=${x}`;

  const spotify = spotifyId(url);
  if (spotify) return spotify;

  const soundcloud = soundcloudPath(url);
  if (soundcloud) return soundcloud;

  return streamableId(url);
}

/** How the embedded block should be laid out once the embed URL is resolved. */
export function embedKind(embedUrl: string | null | undefined): "video" | "audio" | "image" | null {
  if (!embedUrl) return null;
  let url: URL;
  try {
    url = new URL(embedUrl);
  } catch {
    return null;
  }
  const ext = extensionOf(url.pathname);
  if (VIDEO_EXT.has(ext)) return "video";
  if (AUDIO_EXT.has(ext)) return "audio";
  if (IMAGE_EXT.has(ext)) return "image";
  if (/(youtube|youtu\.be|vimeo|loom|tiktok|twitter|x\.com)/i.test(url.hostname)) return "video";
  if (/(spotify|soundcloud)/i.test(url.hostname)) return "audio";
  return null;
}

/* -------------------------------------------------------------------------- */
/*                               Public permalink                             */
/* -------------------------------------------------------------------------- */

export function slugify(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .slice(0, 70);
}

/** Stable id fragment so `/updates/<slug>-<id>` stays unique and readable. */
export function itemPath(item: { id: string; title?: string | null }) {
  const slug = slugify(item.title || "");
  const short = item.id.replace(/-/g, "").slice(-8).toLowerCase();
  return slug ? `${slug}-${short}` : short;
}

export function publicUrl(item: { id: string; title?: string | null }) {
  return `${SITE_ORIGIN}/updates/${itemPath(item)}`;
}

/** Flat, AI-friendly text version of an item (used by the permalink page). */
export function itemAsText(item: ContentItem) {
  return [
    `# ${item.title}`,
    item.subtitle ? `Subtitle: ${item.subtitle}` : null,
    `Type: ${item.kind}`,
    item.badge ? `Badge: ${item.badge}` : null,
    `Published: ${item.created_at}`,
    `Updated: ${item.updated_at}`,
    `Permanent URL: ${publicUrl(item)}`,
    item.link_url ? `Reference link: ${item.link_url}` : null,
    item.image_url ? `Media: ${item.image_url}` : null,
    "",
    item.body ?? "",
  ]
    .filter((l): l is string => l !== null)
    .join("\n");
}
