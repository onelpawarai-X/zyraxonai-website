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

/**
 * How the parts of a split image are rejoined.
 *
 * GitHub refuses an asset larger than 2 GB, so a bigger image is published as
 * `.iso.part00`, `.iso.part01`, … and they must be joined before the file is an
 * ISO again. `cat` in order does exactly that, and the caller passes the parts
 * in order.
 */
export function osRejoinCommand(isoName: string, partNames: string[]): string {
  return `cat ${partNames.join(" ")} > ${isoName}`;
}

/**
 * The download id for one part, taken from the part's own number.
 *
 * Not from its position in the list: a release that numbers its parts
 * `part01`…`part02` (or pads them differently) would be addressed by the wrong
 * id if the index were used, and the button would fetch its neighbour.
 */
export function osPartId(partName: string): string {
  const n = partName.match(/\.part(\d+)$/i)?.[1] ?? "0";
  return `${OS_ID}-part${n}`;
}

/**
 * One command that fetches every part, rejoins them and verifies the result.
 *
 * The card can hand a visitor two links and a `cat` line, but that still leaves
 * them to fetch each part, run the rejoin in the right directory and check the
 * hash themselves — three steps where any one wrong gives an image that will not
 * boot, with nothing to say why. This does all three from a single paste, and it
 * refuses to leave a half-downloaded ISO behind if a part fails.
 */
export function osFetchScript(
  tag: string,
  isoName: string,
  partNames: string[],
  sha256?: string | null,
): string {
  const base = `https://github.com/${OS_REPO}/releases/download/${tag}`;
  const parts = partNames.join(" ");
  const lines = [
    `BASE="${base}"`,
    `for p in ${parts}; do curl -fL --retry 3 -O "$BASE/$p" || exit 1; done`,
    `cat ${parts} > "${isoName}" && rm -f ${parts}`,
  ];
  // The rejoin is only trustworthy if the hash is checked after it, so the
  // published checksum is the last step rather than a note beside the command.
  if (sha256) lines.push(`echo "${sha256}  ${isoName}" | sha256sum -c -`);
  return lines.join("\n");
}

/** The whole image's size, or the sum of its parts, as a human string. */
export function formatBytes(bytes?: number | null): string {
  if (!bytes) return "";
  const gb = bytes / 1024 ** 3;
  if (gb >= 1) return `${gb.toFixed(2)} GB`;
  const mb = bytes / 1024 ** 2;
  return `${mb.toFixed(0)} MB`;
}
