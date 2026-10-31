/**
 * The ZyraxonOS release resolver.
 *
 * ZyraxonOS ships from its own repository (`onelpawarai-X/ZyraxonOS`) on its own
 * version, so it is read the way the ZYRAXON Agent releases are — public HTML, no
 * token — and answers from whatever release carries an ISO at the moment of the
 * request. Nothing is hardcoded: not the tag, not the file name, not the size. A
 * release published a minute ago is on the page after the next cache lapse, with
 * no deploy.
 *
 * One file, one button. The page offers exactly one thing — the `.iso` — and a
 * single click saves it. A release that carries no `.iso` is skipped and the
 * resolver steps back to the newest one that does, so the button is never dead
 * while a downloadable image exists anywhere in the history. The ZyraxonOS
 * repository has shipped releases whose image is over GitHub's 2 GB per-asset
 * limit and therefore cut into `.iso.part00`, `.iso.part01`, … assets; those are
 * deliberately not offered, because a part is not a file a visitor can boot.
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

/** The stable id the download button and the redirect route use. */
export const OS_ID = "zyraxon-os";

/** True for the one id this module answers. */
export function isOsId(id: string): boolean {
  return id.toLowerCase() === OS_ID;
}

export type OsAsset = {
  name: string;
  /** Direct-download URL: a click saves the file, it does not open a page. */
  url: string;
  size: number | null;
};

export type OsRelease = {
  tag: string;
  releaseUrl: string;
  /**
   * True when this is GitHub's newest release for the repository.
   *
   * Usually it is. It is not when the newest release carries no `.iso` — the
   * image was over GitHub's 2 GB cap and published as parts — and the resolver
   * stepped back to the newest release that does. The page says which release the
   * file comes from, so an older image is never labelled as the newest one.
   */
  isLatest: boolean;
  /** The one downloadable image: a single `.iso` file. */
  iso: OsAsset;
  /** Its checksum, when the release publishes one beside it. */
  sha256: string | null;
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

/** How many recent tags to search for an ISO, newest first. */
const TAG_LOOKBACK = 8;

/** A single image file. `.iso.part00` and `.iso.sha256` do not end in `.iso`. */
const ISO = /\.iso$/i;
const CHECKSUM = /(sha256sums|\.sha256$|\.sha256sum$)/i;
const IMAGE = /\.(png|jpe?g|webp)$/i;

/** The `.iso` in one release's asset list, or null when it has none. */
export function readIso(
  repo: string,
  tag: string,
  assets: { name: string; size: number | null }[],
): OsAsset | null {
  const file = assets.find((a) => ISO.test(a.name));
  if (!file) return null;
  return { name: file.name, url: downloadUrl(repo, tag, file.name), size: file.size };
}

/** The checksum the release publishes for the ISO, or null. */
async function readChecksum(
  repo: string,
  tag: string,
  assets: { name: string; size: number | null }[],
  isoName: string,
): Promise<string | null> {
  const file = assets.find((a) => CHECKSUM.test(a.name));
  if (!file) return null;
  try {
    // A checksum file is a few hundred bytes; the cap is only so a mislabelled
    // 2 GB asset can never be pulled into memory by a name match.
    if (file.size !== null && file.size > 64 * 1024) return null;
    const res = await fetch(downloadUrl(repo, tag, file.name), { headers: GH_HEADERS });
    if (!res.ok) return null;
    const text = await res.text();
    // The checksum names the ISO on its own line; one release wrote a path
    // (`build/ZyraxonOS-1.0-amd64.iso`), so the basename is what is matched.
    const base = isoName.split("/").pop();
    for (const line of text.split("\n")) {
      // "<64 hex>  <name>" — the two spaces are what sha256sum writes.
      const m = line.trim().match(/^([0-9a-f]{64})\s+\*?(.+)$/i);
      if (m && m[2]!.trim().split("/").pop() === base) return m[1]!.toLowerCase();
    }
    return null;
  } catch {
    return null;
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
  const newest = tags[0] ?? null;
  for (const tag of tags.slice(0, TAG_LOOKBACK)) {
    const assets = await assetsOf(OS_REPO, tag);
    if (!assets.length) continue;
    const iso = readIso(OS_REPO, tag, assets);
    if (!iso) continue;

    const shot = assets.find((a) => IMAGE.test(a.name));
    return {
      repo: OS_REPO,
      latest: { tag, url: releaseUrl(OS_REPO, tag), repo: OS_REPO },
      release: {
        tag,
        releaseUrl: releaseUrl(OS_REPO, tag),
        isLatest: tag === newest,
        iso,
        sha256: await readChecksum(OS_REPO, tag, assets, iso.name),
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
      "Could not read an ISO from the ZyraxonOS releases. The release page itself is the fallback.",
  };
}

/** The asset a download button id resolves to, or null. */
export async function resolveOsTarget(id: string): Promise<OsAsset | null> {
  if (!isOsId(id)) return null;
  const { release } = await resolveOs();
  return release?.iso ?? null;
}
