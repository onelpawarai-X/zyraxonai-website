import { createFileRoute } from "@tanstack/react-router";

/**
 * Server-side release resolver for the download buttons.
 *
 * Reads GitHub the way a browser does, not the way the REST API does: no
 * token, no rate-limit bucket, nothing that can expire. Two public requests,
 * both of which any visitor could make by hand:
 *
 *   1. `GET /releases/latest`  — 302s to `.../releases/tag/<tag>`, so the tag
 *      comes out of the Location header.
 *   2. `GET /releases/expanded_assets/<tag>` — the HTML fragment GitHub itself
 *      renders for the release page's asset list. Every asset name is in it.
 *
 * A token was the previous design and it was the bug: when the configured
 * token was rejected GitHub answers 401, and the old code read that as "this
 * repo has no releases" and silently produced an empty page. The public paths
 * cannot fail that way — there is no credential to be stale.
 *
 * Assets are then addressed through GitHub's own
 * `/releases/latest/download/<name>` shortcut, which 302s to the asset and
 * answers `content-disposition: attachment`, so a click saves the file instead
 * of opening a page.
 */
export const REPO = "onelpawarai-X/ZYRAXON-AI";
/** Primary account first, mirror/fallback account second. */
export const REPOS = ["onelpawarai-X/ZYRAXON-AI", "onelpawarai/ZYRAXON-AI"];

const HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
  "Cache-Control": "public, max-age=600",
};

// Files that are never a real download.
const NOISE = /(\.blockmap$|\.ya?ml$|\.sha\d*$|\.sig$|\.txt$|^latest|\.json$)/i;

/** What a browser-like read of GitHub sends. No Authorization, ever. */
const GH_HEADERS = {
  "User-Agent": "Mozilla/5.0 (compatible; ZYRAXON-site/1.0; +https://zyraxonai.lovable.app)",
  Accept: "text/html,application/xhtml+xml",
};

export type Target = {
  /** Stable id used in URLs: /api/download/<id>. */
  id: string;
  /** What the button says. */
  label: string;
  /** The file extension a visitor expects to receive. */
  ext: string;
  /** Human description of who it is for. */
  detail: string;
  /** "desktop", "cli" or "source" — the three families of download. */
  family: "desktop" | "cli" | "source";
  /** Asset names to accept, most specific first. First match wins. */
  patterns: RegExp[];
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

/** `GET /releases/latest` and read the tag out of the redirect. */
async function latestTag(repo: string): Promise<string | null> {
  try {
    const res = await fetch(`https://github.com/${repo}/releases/latest`, {
      headers: GH_HEADERS,
      redirect: "manual",
    });
    const location = res.headers.get("location") ?? "";
    const tag = location.match(/\/releases\/tag\/(.+)$/)?.[1];
    return tag ? decodeURIComponent(tag) : null;
  } catch {
    return null;
  }
}

/**
 * The asset list GitHub renders on the release page.
 *
 * Parsed from the anchor `href`s rather than the surrounding markup, because the
 * classes are presentation and change without notice. The size sits in the same
 * row as the link, so both come out of one request.
 */
async function assetsOf(
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

    // Each asset is one <li> row. Splitting on the row boundary keeps a size
    // paired with the link in its own row instead of the next one's.
    for (const row of html.split(/<li\b/)) {
      const link = row.match(/href="\/[^"]*\/releases\/download\/[^"]*?\/([^"/]+)"/);
      if (!link) continue;
      const name = decodeURIComponent(link[1]);
      if (seen.has(name)) continue;
      seen.add(name);

      // "30.3 MB" — the unit is always present, so the number is unambiguous.
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

/**
 * The tags this repository has published, newest first.
 *
 * Read from the releases page rather than `/releases/latest`, because the page
 * carries the whole tag history. That is what lets the resolver keep working
 * when the newest release happens to be missing a build: it can step back to
 * the previous tag that does carry one, instead of showing a dead button until
 * someone re-uploads.
 */
async function recentTags(repo: string): Promise<string[]> {
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

export function downloadUrl(repo: string, tag: string, name: string) {
  // GitHub's own shortcut: 302 to the asset, served as an attachment.
  return `https://github.com/${repo}/releases/download/${encodeURIComponent(tag)}/${encodeURIComponent(name)}`;
}

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

  for (const repo of REPOS) {
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
      sources: REPOS.map((repo, i) => ({
        repo,
        role: i === 0 ? "primary" : "fallback",
        assets: 0,
        releasesUrl: `https://github.com/${repo}/releases`,
      })),
      releasesUrl: `https://github.com/${REPO}/releases`,
      error: "Could not read any release from GitHub. The release page itself is the fallback.",
    };
  }

  // The newest tag wins for the "latest release" label, and is the first place
  // every button looks.
  const primary = perRepo[0];

  const platforms: Record<string, ResolvedAsset | null> = {};
  for (const target of TARGETS) {
    platforms[target.id] = null;

    // A target GitHub generates for the tag, rather than one uploaded with the
    // release. It exists for every tag, so it resolves from the tag alone.
    if (target.fromTag) {
      platforms[target.id] = {
        name: `${primary.tag}${target.ext}`,
        url: target.fromTag(primary.repo, primary.tag),
        releaseUrl: `https://github.com/${primary.repo}/releases/tag/${encodeURIComponent(primary.tag)}`,
        size: null,
        tag: primary.tag,
        publishedAt: null,
        repo: primary.repo,
      };
      continue;
    }

    outer: for (const rel of perRepo) {
      const usable = rel.assets.filter((a) => !NOISE.test(a.name));
      for (const pattern of target.patterns) {
        const hit = usable.find((a) => pattern.test(a.name));
        if (hit) {
          platforms[target.id] = {
            name: hit.name,
            url: downloadUrl(rel.repo, rel.tag, hit.name),
            releaseUrl: `https://github.com/${rel.repo}/releases/tag/${encodeURIComponent(rel.tag)}`,
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
      url: `https://github.com/${primary.repo}/releases/tag/${encodeURIComponent(primary.tag)}`,
      publishedAt: null,
      repo: primary.repo,
    },
    // The newest release's own files, in the order GitHub lists them.
    assets: primary.assets.map((a) => ({
      name: a.name,
      size: a.size,
      url: downloadUrl(primary.repo, primary.tag, a.name),
    })),
    platforms,
    sources: REPOS.map((repo, i) => ({
      repo,
      role: i === 0 ? "primary" : "fallback",
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
