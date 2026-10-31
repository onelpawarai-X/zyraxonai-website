/**
 * The ZyraxonOS release resolver.
 *
 * ZyraxonOS ships from its own repository (`onelpawarai-X/ZyraxonOS`) on its own
 * version, so it is read the same way the ZYRAXON Agent releases are — public
 * HTML, no token — and answers from whatever the newest release is at the moment
 * of the request. Nothing about the OS is hardcoded: not the tag, not the file
 * name, not the part count. A release published a minute ago is on the page
 * after the next cache lapse, with no deploy.
 *
 * Two release shapes exist and both must work, because the repository has used
 * each one:
 *
 *   single  — `ZyraxonOS-1.0-amd64.iso`                  (one file)
 *   split   — `ZyraxonOS-9.0.0-amd64.iso.part00` …       (GitHub's 2 GB cap)
 *
 * A split ISO is not a curiosity: GitHub refuses an asset over 2 GB, so an image
 * that grows past that must be cut. The parts are not interchangeable and must
 * all be downloaded, so the primary button fetches the first part and the page
 * lists every part with the command that rejoins them. `split` and `parts` are
 * what let the page say that instead of offering a file that is not the whole
 * image.
 */
import {
  assetsOf,
  downloadUrl,
  GH_HEADERS,
  recentTags,
  releaseUrl,
} from "./github-releases.server";

export const OS_REPO = "onelpawarai-X/ZyraxonOS";
export const OS_RELEASES_URL = `https://github.com/${OS_REPO}/releases`;

/** The stable id the buttons and the redirect route use. */
export const OS_ID = "zyraxon-os";

/** Ids for the later parts of a split image: `zyraxon-os-part01`, … */
export const OS_PART_PREFIX = `${OS_ID}-part`;

/** True for every id this module answers. */
export function isOsId(id: string): boolean {
  const wanted = id.toLowerCase();
  return wanted === OS_ID || wanted.startsWith(OS_PART_PREFIX);
}

export type OsAsset = {
  name: string;
  /** Direct-download URL: a click saves the file, it does not open a page. */
  url: string;
  size: number | null;
};

export type OsChecksum = { name: string; hash: string };

export type OsRelease = {
  tag: string;
  releaseUrl: string;
  /** The file a single click should fetch: the only ISO, or the first part. */
  primary: OsAsset | null;
  /** Every part of the image, in order. One entry for a single-file release. */
  parts: OsAsset[];
  /** True when the image is cut into parts that must be rejoined. */
  split: boolean;
  /** The name the parts rejoin to, e.g. `ZyraxonOS-9.0.0-amd64.iso`. */
  isoName: string | null;
  /** The whole image's size when it is one file, or the sum of the parts. */
  totalBytes: number | null;
  /** Published checksums, when the release carries them. */
  checksums: OsChecksum[];
  /** A release screenshot, when one was uploaded. */
  screenshot: OsAsset | null;
};

export type OsResolved = {
  repo: string;
  latest: { tag: string; url: string; repo: string } | null;
  release: OsRelease | null;
  releasesUrl: string;
  /** Set when nothing could be read, so the page can say why instead of "empty". */
  error?: string;
};

/** How many recent tags to search for an image, newest first. */
const TAG_LOOKBACK = 4;

const ISO_PART = /\.iso\.part(\d+)$/i;
const ISO_PLAIN = /\.iso$/i;
const CHECKSUM = /(sha256sums|\.sha256$|\.sha256sum$)/i;
const IMAGE = /\.(png|jpe?g|webp)$/i;

/** Pull the ISO (or its parts) out of one release's asset list. */
export function readImage(
  repo: string,
  tag: string,
  assets: { name: string; size: number | null }[],
): Pick<OsRelease, "primary" | "parts" | "split" | "isoName" | "totalBytes"> | null {
  const at = (a: { name: string; size: number | null }): OsAsset => ({
    name: a.name,
    url: downloadUrl(repo, tag, a.name),
    size: a.size,
  });

  const parts = assets
    .filter((a) => ISO_PART.test(a.name))
    .map((a) => ({ a, index: Number(a.name.match(ISO_PART)![1]) }))
    .sort((x, y) => x.index - y.index);

  if (parts.length) {
    const list = parts.map((p) => at(p.a));
    // The name the parts rejoin to is the first part's name with only the
    // `.part<NN>` suffix removed — the `.iso` in front of it stays, because the
    // rejoined file is the ISO.
    const isoName = parts[0]!.a.name.replace(/\.part\d+$/i, "");
    const sizes = list.map((p) => p.size).filter((n): n is number => n !== null);
    return {
      primary: list[0]!,
      parts: list,
      split: true,
      isoName,
      totalBytes: sizes.length === list.length ? sizes.reduce((a, b) => a + b, 0) : null,
    };
  }

  const single = assets.find((a) => ISO_PLAIN.test(a.name));
  if (!single) return null;
  return {
    primary: at(single),
    parts: [at(single)],
    split: false,
    isoName: single.name,
    totalBytes: single.size,
  };
}

/** Read the checksum file's text into `{ hash, name }` pairs. */
async function readChecksums(
  repo: string,
  tag: string,
  assets: { name: string; size: number | null }[],
): Promise<OsChecksum[]> {
  const file = assets.find((a) => CHECKSUM.test(a.name));
  if (!file) return [];
  try {
    // A checksum file is a few hundred bytes; the cap is only so a mislabelled
    // 2 GB asset can never be pulled into memory by a name match.
    if (file.size !== null && file.size > 64 * 1024) return [];
    const res = await fetch(downloadUrl(repo, tag, file.name), { headers: GH_HEADERS });
    if (!res.ok) return [];
    const text = await res.text();
    const out: OsChecksum[] = [];
    for (const line of text.split("\n")) {
      // "<64 hex>  <name>" — the two spaces are what sha256sum writes.
      const m = line.trim().match(/^([0-9a-f]{64})\s+\*?(.+)$/i);
      if (m) out.push({ hash: m[1]!.toLowerCase(), name: m[2]!.trim() });
    }
    return out;
  } catch {
    return [];
  }
}

const CACHE_MS = 60_000;
let cache: { at: number; value: OsResolved } | null = null;

export async function resolveOs(options?: { fresh?: boolean }): Promise<OsResolved> {
  if (!options?.fresh && cache && Date.now() - cache.at < CACHE_MS) return cache.value;
  const value = await computeOs();
  // Only a real answer is worth keeping, so a momentary network failure does not
  // become a minute-long outage for everyone who arrives in that minute.
  if (value.release) cache = { at: Date.now(), value };
  return value;
}

async function computeOs(): Promise<OsResolved> {
  const tags = await recentTags(OS_REPO);
  for (const tag of tags.slice(0, TAG_LOOKBACK)) {
    const assets = await assetsOf(OS_REPO, tag);
    if (!assets.length) continue;
    const image = readImage(OS_REPO, tag, assets);
    if (!image) continue;

    const shot = assets.find((a) => IMAGE.test(a.name));
    return {
      repo: OS_REPO,
      latest: { tag, url: releaseUrl(OS_REPO, tag), repo: OS_REPO },
      release: {
        tag,
        releaseUrl: releaseUrl(OS_REPO, tag),
        ...image,
        checksums: await readChecksums(OS_REPO, tag, assets),
        screenshot: shot
          ? { name: shot.name, url: downloadUrl(OS_REPO, tag, shot.name), size: shot.size }
          : null,
      },
      releasesUrl: OS_RELEASES_URL,
    };
  }

  return {
    repo: OS_REPO,
    latest: null,
    release: null,
    releasesUrl: OS_RELEASES_URL,
    error:
      "Could not read an image from the ZyraxonOS releases. The release page itself is the fallback.",
  };
}

/**
 * Resolve one OS button id.
 *
 * `zyraxon-os` is the file a single click should fetch — the only ISO, or the
 * first part of a split one. `zyraxon-os-part<NN>` names a later part, matched
 * on the part's own number so a release that pads differently (`part0` vs
 * `part00`) still resolves.
 */
export async function resolveOsTarget(id: string): Promise<OsAsset | null> {
  const wanted = id.toLowerCase();
  if (!isOsId(wanted)) return null;
  const { release } = await resolveOs();
  if (!release) return null;
  if (wanted === OS_ID) return release.primary;

  const digits = wanted.slice(OS_PART_PREFIX.length);
  if (!/^\d+$/.test(digits)) return null;
  const index = Number(digits);
  return release.parts.find((p) => Number(p.name.match(ISO_PART)?.[1] ?? -1) === index) ?? null;
}
