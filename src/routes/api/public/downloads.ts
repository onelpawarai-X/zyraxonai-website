import { createFileRoute } from "@tanstack/react-router";
import { assetsOf, downloadUrl, recentTags, releaseUrl } from "@/lib/github-releases.server";

/**
 * Server-side release resolver for the ZYRAXON Agent download buttons.
 *
 * The GitHub read itself lives in `@/lib/github-releases.server` — public HTML,
 * no token — and is shared with the ZyraxonOS resolver. This module is what
 * turns that read into one answer per button: which asset a platform gets, and
 * which release it came from.
 */
export const REPO = "onelpawarai-X/ZYRAXON-AI";
/** Primary account first, mirror/fallback account second. */
export const REPOS = ["onelpawarai-X/ZYRAXON-AI", "onelpawarai/ZYRAXON-AI"];
/** The Android app is built and released from its own repository. */
export const MOBILE_REPO = "onelpawarai-X/zyraxon-mobile-ai";

/**
 * Every repository a download can come from.
 *
 * The desktop repo stays first, and it is what the page's "latest release"
 * label and its full file list report. The mobile repo is read as well so the
 * Android button resolves from the newest mobile release, which is versioned
 * independently — the two do not ship on the same tag.
 */
const ALL_REPOS = [...REPOS, MOBILE_REPO];

const HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
  "Cache-Control": "public, max-age=600",
};

// Files that are never a real download.
const NOISE = /(\.blockmap$|\.ya?ml$|\.sha\d*$|\.sig$|\.txt$|^latest|\.json$)/i;

export type Target = {
  /** Stable id used in URLs: /api/download/<id>. */
  id: string;
  /** What the button says. */
  label: string;
  /** The file extension a visitor expects to receive. */
  ext: string;
  /** Human description of who it is for. */
  detail: string;
  /** "desktop", "mobile", "cli" or "source" — the four families of download. */
  family: "desktop" | "mobile" | "cli" | "source";
  /** Asset names to accept, most specific first. First match wins. */
  patterns: RegExp[];
  /**
   * Repositories to look in, when this target does not come from the desktop
   * repo. Without it a target searches `REPOS`; with it, only these — so the
   * Android build cannot be answered with a file from the desktop release.
   */
  repos?: string[];
  /**
   * For a target that is not a release asset. GitHub serves a source archive
   * for every tag at a predictable URL, so there is nothing to look up.
   */
  fromTag?: (repo: string, tag: string) => string;
};

/**
 * Every downloadable target, in the order the buttons appear.
 *
 * The patterns are anchored on the end of the name and are deliberately
 * specific. A loose `/\.zip$/` would hand the Windows button a macOS build the
 * moment a release shipped one and not the other.
 */
export const TARGETS: Target[] = [
  // ── Mobile application ────────────────────────────────────────────────
  {
    id: "android",
    label: "Android",
    ext: ".apk",
    detail: "Android 8+ · install the APK directly",
    family: "mobile",
    // The Android build ships from its own repository, so the search is scoped
    // to it. A desktop release does not contain an .apk, but scoping means the
    // Android button can never be answered by the wrong repo's release.
    repos: ["onelpawarai-X/zyraxon-mobile-ai"],
    patterns: [/^zyraxon.*\.apk$/i, /\.apk$/i],
  },

  // ── Desktop application ───────────────────────────────────────────────
  {
    id: "windows",
    label: "Windows (x64)",
    ext: ".exe",
    detail: "Windows 10/11 · 64-bit installer",
    family: "desktop",
    patterns: [
      /^ZYRAXON-Dev-win-x64-installer\.exe$/i,
      /win.*x64.*installer.*\.exe$/i,
      /win.*(x64|amd64).*\.exe$/i,
      /(setup|installer).*\.exe$/i,
      /win.*\.exe$/i,
      // Only Windows ships an .exe, so this still cannot hand out another
      // platform even if a release renames the file to something unrecognisable.
      /\.exe$/i,
    ],
  },
  {
    id: "windows-arm64",
    label: "Windows on ARM",
    ext: ".exe",
    detail: "Surface Pro X, Snapdragon laptops",
    family: "desktop",
    patterns: [
      /^ZYRAXON-Dev-win-arm64-installer\.exe$/i,
      /win.*arm64.*installer.*\.exe$/i,
      /win.*(arm64|aarch64).*\.exe$/i,
    ],
  },
  {
    id: "mac-arm",
    label: "macOS · Apple Silicon",
    ext: ".dmg",
    detail: "macOS 12+ · M-series chips",
    family: "desktop",
    patterns: [
      /^zyraxon-desktop-mac-arm64\.dmg$/i,
      /(mac|darwin|osx).*(arm64|aarch64|silicon).*\.dmg$/i,
      /-(arm64|aarch64|silicon)\.dmg$/i,
    ],
  },
  {
    id: "mac-intel",
    label: "macOS · Intel",
    ext: ".dmg",
    detail: "macOS 12+ · Intel chips",
    family: "desktop",
    patterns: [
      /^zyraxon-desktop-mac-x64\.dmg$/i,
      /(mac|darwin|osx).*(x64|x86_64|amd64|intel).*\.dmg$/i,
      /-(x64|x86_64|amd64|intel)\.dmg$/i,
    ],
  },
  {
    id: "linux-appimage",
    label: "Linux · AppImage",
    ext: ".AppImage",
    detail: "Any distro · no install needed",
    family: "desktop",
    patterns: [/linux.*(x86_64|amd64|x64).*\.AppImage$/i, /\.AppImage$/i],
  },
  {
    id: "linux-deb",
    label: "Linux · .deb",
    ext: ".deb",
    detail: "Debian, Ubuntu, Mint",
    family: "desktop",
    patterns: [/linux.*(amd64|x86_64|x64)\.deb$/i, /\.deb$/i],
  },
  {
    id: "linux-rpm",
    label: "Linux · .rpm",
    ext: ".rpm",
    detail: "Fedora, RHEL, openSUSE",
    family: "desktop",
    patterns: [/linux.*(x86_64|amd64|x64)\.rpm$/i, /\.rpm$/i],
  },

  // ── Command line ──────────────────────────────────────────────────────
  {
    id: "cli-windows",
    label: "CLI for Windows",
    ext: ".zip",
    detail: "Unpack, then rename it to zyraxon.exe",
    family: "cli",
    patterns: [
      /^zyraxon-windows-x64\.zip$/i,
      /^zyraxon-windows-x64-baseline\.zip$/i,
      /windows.*(x64|amd64).*\.zip$/i,
      // Only the Windows build is named for Windows, so the platform token is
      // enough even if the rest of the name changes.
      /windows.*\.zip$/i,
    ],
  },
  {
    id: "cli-windows-arm64",
    label: "CLI for Windows on ARM",
    ext: ".zip",
    detail: "Windows on ARM devices",
    family: "cli",
    patterns: [/^zyraxon-windows-arm64\.zip$/i, /windows.*(arm64|aarch64).*\.zip$/i],
  },
  {
    id: "cli-mac-arm",
    label: "CLI for macOS · Apple Silicon",
    ext: ".zip",
    detail: "M-series Macs",
    family: "cli",
    patterns: [
      /^zyraxon-darwin-arm64\.zip$/i,
      /(darwin|mac|osx).*(arm64|aarch64|silicon).*\.zip$/i,
    ],
  },
  {
    id: "cli-mac-intel",
    label: "CLI for macOS · Intel",
    ext: ".zip",
    detail: "Intel Macs",
    family: "cli",
    patterns: [
      /^zyraxon-darwin-x64\.zip$/i,
      /^zyraxon-darwin-x64-baseline\.zip$/i,
      /(darwin|mac|osx).*(x64|x86_64|amd64|intel).*\.zip$/i,
    ],
  },
  {
    id: "cli-linux",
    label: "CLI for Linux",
    ext: ".tar.gz",
    detail: "glibc · most distros",
    family: "cli",
    patterns: [
      /^zyraxon-linux-x64\.tar\.gz$/i,
      // The lookahead keeps the glibc button off the musl archive, which has
      // its own target below.
      /linux.*(x64|amd64|x86_64)(?!.*musl).*\.tar\.gz$/i,
    ],
  },
  {
    id: "cli-linux-musl",
    label: "CLI for Linux · musl",
    ext: ".tar.gz",
    detail: "Alpine and other musl distros",
    family: "cli",
    patterns: [/^zyraxon-linux-x64-musl\.tar\.gz$/i, /linux.*musl\.tar\.gz$/i],
  },
  {
    id: "cli-linux-arm64",
    label: "CLI for Linux · ARM64",
    ext: ".tar.gz",
    detail: "ARM servers and boards",
    family: "cli",
    patterns: [/^zyraxon-linux-arm64\.tar\.gz$/i, /linux.*(arm64|aarch64).*\.tar\.gz$/i],
  },

  // ── Source ────────────────────────────────────────────────────────────
  {
    id: "source",
    label: "Source code",
    ext: ".zip",
    detail: "The full tree at this tag",
    family: "source",
    // GitHub publishes these for every tag; no asset to look up.
    patterns: [],
    fromTag: (repo, tag) =>
      `https://github.com/${repo}/archive/refs/tags/${encodeURIComponent(tag)}.zip`,
  },
  {
    id: "source-tar",
    label: "Source code",
    ext: ".tar.gz",
    detail: "The full tree at this tag",
    family: "source",
    patterns: [],
    fromTag: (repo, tag) =>
      `https://github.com/${repo}/archive/refs/tags/${encodeURIComponent(tag)}.tar.gz`,
  },
];

export type ResolvedAsset = {
  name: string;
  /** Direct-download URL: a click saves the file, it does not open a page. */
  url: string;
  /** The page a human may still want, for release notes. */
  releaseUrl: string;
  size: number | null;
  tag: string;
  publishedAt: string | null;
  repo: string;
};

export type Resolved = {
  latest: { tag: string; url: string; publishedAt: string | null; repo: string } | null;
  /** Every asset of the newest release, in the order GitHub lists them. */
  assets: { name: string; size: number | null; url: string }[];
  platforms: Record<string, ResolvedAsset | null>;
  sources: { repo: string; role: string; assets: number; releasesUrl: string }[];
  releasesUrl: string;
  /** Set when nothing could be read, so the page can say why instead of "empty". */
  error?: string;
};

/**
 * Resolve every target against the newest release that actually carries it.
 *
 * Walks the primary account first, then the mirror. For each target the first
 * release that has a matching asset wins, so a release that shipped only some
 * platforms cannot blank out the rest.
 *
 * The result is held for a minute. Reading the release costs a handful of
 * requests to github.com, and a page of buttons plus a click would otherwise
 * repeat that work several times over for an answer that only changes when a
 * new tag is published. A minute is short enough that a freshly published
 * release shows up on its own, with no deploy.
 */
const CACHE_MS = 60_000;
let cache: { at: number; value: Resolved } | null = null;

/**
 * How many recent tags each button may search for its build.
 *
 * The newest tag is tried first, so in the ordinary case this costs one extra
 * request per older tag only when a build is genuinely missing. Three is enough
 * to ride out a release whose CI leg failed, without turning every page load
 * into a crawl of the whole release history.
 */
const TAG_LOOKBACK = 3;

export async function resolveReleases(options?: { fresh?: boolean }): Promise<Resolved> {
  if (!options?.fresh && cache && Date.now() - cache.at < CACHE_MS) return cache.value;
  const value = await computeReleases();
  // Only a real answer is worth keeping. A failure is usually a momentary
  // network hiccup, and holding it for a minute would turn a blip into an
  // outage for everyone who arrives in that minute.
  if (value.latest) cache = { at: Date.now(), value };
  return value;
}

async function computeReleases(): Promise<Resolved> {
  const perRepo: { repo: string; tag: string; assets: { name: string; size: number | null }[] }[] =
    [];

  for (const repo of ALL_REPOS) {
    // The newest tag, then the handful before it. Stepping back matters because
    // a release is occasionally published without every build — a platform can
    // fail in CI, or a matrix leg can be skipped. Falling back to the previous
    // tag that does carry a build keeps the button live instead of showing a
    // dead end until someone re-uploads.
    const tags = await recentTags(repo);
    if (!tags.length) continue;

    for (const tag of tags.slice(0, TAG_LOOKBACK)) {
      const assets = await assetsOf(repo, tag);
      if (!assets.length) continue;
      perRepo.push({ repo, tag, assets });
    }
  }

  if (!perRepo.length) {
    return {
      latest: null,
      assets: [],
      platforms: Object.fromEntries(TARGETS.map((t) => [t.id, null])),
      sources: ALL_REPOS.map((repo, i) => ({
        repo,
        role: i === 0 ? "primary" : repo === MOBILE_REPO ? "mobile" : "fallback",
        assets: 0,
        releasesUrl: `https://github.com/${repo}/releases`,
      })),
      releasesUrl: `https://github.com/${REPO}/releases`,
      error: "Could not read any release from GitHub. The release page itself is the fallback.",
    };
  }

  // The desktop repo's newest tag wins for the "latest release" label, and is
  // the first place every desktop and CLI button looks. The mobile repo is
  // versioned on its own tag, so it must not displace this label.
  const primary = perRepo.find((r) => r.repo === REPO) ?? perRepo[0];

  const platforms: Record<string, ResolvedAsset | null> = {};
  for (const target of TARGETS) {
    platforms[target.id] = null;

    // A target GitHub generates for the tag, rather than one uploaded with the
    // release. It exists for every tag, so it resolves from the tag alone.
    if (target.fromTag) {
      platforms[target.id] = {
        name: `${primary.tag}${target.ext}`,
        url: target.fromTag(primary.repo, primary.tag),
        releaseUrl: releaseUrl(primary.repo, primary.tag),
        size: null,
        tag: primary.tag,
        publishedAt: null,
        repo: primary.repo,
      };
      continue;
    }

    // A target that names its repositories is searched only there, in the order
    // given; everything else searches the desktop list.
    const scope = target.repos ? perRepo.filter((r) => target.repos!.includes(r.repo)) : perRepo;

    outer: for (const rel of scope) {
      const usable = rel.assets.filter((a) => !NOISE.test(a.name));
      for (const pattern of target.patterns) {
        const hit = usable.find((a) => pattern.test(a.name));
        if (hit) {
          platforms[target.id] = {
            name: hit.name,
            url: downloadUrl(rel.repo, rel.tag, hit.name),
            releaseUrl: releaseUrl(rel.repo, rel.tag),
            size: hit.size,
            tag: rel.tag,
            publishedAt: null,
            repo: rel.repo,
          };
          break outer;
        }
      }
    }
  }

  return {
    latest: {
      tag: primary.tag,
      url: releaseUrl(primary.repo, primary.tag),
      publishedAt: null,
      repo: primary.repo,
    },
    // The newest desktop release's own files, in the order GitHub lists them.
    assets: primary.assets.map((a) => ({
      name: a.name,
      size: a.size,
      url: downloadUrl(primary.repo, primary.tag, a.name),
    })),
    platforms,
    sources: ALL_REPOS.map((repo, i) => ({
      repo,
      role: i === 0 ? "primary" : repo === MOBILE_REPO ? "mobile" : "fallback",
      assets: perRepo.filter((r) => r.repo === repo).length,
      releasesUrl: `https://github.com/${repo}/releases`,
    })),
    releasesUrl: `https://github.com/${REPO}/releases`,
  };
}

/** Resolve one target id. Returns null for an unknown id. */
export async function resolveTarget(id: string): Promise<ResolvedAsset | null> {
  const target = TARGETS.find((t) => t.id === id.toLowerCase());
  if (!target) return null;
  const data = await resolveReleases();
  return data.platforms[target.id] ?? null;
}

export const Route = createFileRoute("/api/public/downloads")({
  server: {
    handlers: {
      OPTIONS: async () => new Response(null, { status: 204, headers: HEADERS }),
      GET: async ({ request }) => {
        // `?fresh=1` skips the minute-long cache, so a release published a
        // moment ago can be picked up without waiting for the cache to lapse.
        const fresh = new URL(request.url).searchParams.get("fresh") === "1";
        try {
          return Response.json(await resolveReleases({ fresh }), { headers: HEADERS });
        } catch (err) {
          return Response.json(
            {
              latest: null,
              assets: [],
              platforms: {},
              releasesUrl: `https://github.com/${REPO}/releases`,
              error: String(err),
            },
            { status: 200, headers: HEADERS },
          );
        }
      },
    },
  },
});
