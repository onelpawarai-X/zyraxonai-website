/**
 * Shared ZyraxonOS facts for the site.
 *
 * Kept apart from the server resolver (`os-releases.server.ts`) because the
 * pages import this and must not pull a `.server` module into the browser
 * bundle. Nothing here is a release fact — the tag, the file name and the part
 * count all come from the resolver at request time. These are the things that
 * are true of the product whatever the release is.
 */

export const OS_REPO = "onelpawarai-X/ZyraxonOS";
export const OS_RELEASES_URL = `https://github.com/${OS_REPO}/releases`;

/** The button id the download route answers. */
export const OS_ID = "zyraxon-os";

export const OS_NAME = "ZyraxonOS";
export const OS_TAGLINE =
  "A glass-morphism Linux OS built on Debian, with the ZYRAXON AI agent permanently built in.";
export const OS_DETAIL = "64-bit PC (amd64) · boot from USB or install to disk";
export const OS_REQUIREMENTS = [
  "64-bit processor (amd64)",
  "8 GB RAM recommended · 4 GB minimum",
  "20 GB free disk space",
  "USB drive, 4 GB or larger",
];

/**
 * The one-line description used wherever the OS is offered, so the homepage and
 * the download page cannot describe it differently.
 */
export const OS_BLURB =
  "Boot the whole machine into ZYRAXON. Debian underneath, the agent on top — no install of the app first, no separate download.";

/** The whole image's size, or the sum of its parts, as a human string. */
export function formatBytes(bytes?: number | null): string {
  if (!bytes) return "";
  const gb = bytes / 1024 ** 3;
  if (gb >= 1) return `${gb.toFixed(2)} GB`;
  const mb = bytes / 1024 ** 2;
  return `${mb.toFixed(0)} MB`;
}
