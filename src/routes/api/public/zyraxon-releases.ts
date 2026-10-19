import { createFileRoute } from "@tanstack/react-router";

/**
 * ZYRAXON releases feed.
 *
 * Reads GitHub with NO token: the public REST API allows 60 requests/hour per
 * IP, which is enough for a handful of repos and their full release history.
 * When a token IS present in the environment it is used, which lifts the rate
 * limit — but the endpoint never requires one.
 *
 * Every release of every repo is returned, not just the newest: the release
 * list is paginated (100 per page) until GitHub returns a short page, so tags
 * published later show up here on the next request without any code change.
 *
 *   GET /api/public/zyraxon-releases
 *   GET /api/public/zyraxon-releases?fresh=1   (bypass the 2-minute cache)
 */

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

const REPOS = [
  {
    id: "zyraxon-agent",
    owner: "onelpawarai-X",
    name: "ZYRAXON-AI",
    label: "ZYRAXON Agent",
    color: "#2563eb",
    description:
      "Desktop AI agent with 11 agent modes, 888 tools across 63 categories, eternal memory, screen vision",
  },
];

const PER_PAGE = 100;
const MAX_PAGES = 10; // hard ceiling of 1000 releases per repo
const CACHE_MS = 120_000;

type GhRelease = {
  id: number;
  tag_name: string;
  name: string;
  html_url: string;
  published_at: string;
  prerelease: boolean;
  draft: boolean;
  body: string | null;
  assets: {
    name: string;
    size: number;
    browser_download_url: string;
    download_count: number;
    content_type: string;
  }[];
};

type RepoInfo = {
  full_name: string;
  description: string | null;
  stargazers_count: number;
  forks_count: number;
  open_issues_count: number;
  language: string | null;
  html_url: string;
};

type NormalizedRelease = {
  id: number;
  tag: string;
  name: string;
  url: string;
  publishedAt: string;
  prerelease: boolean;
  body: string | null;
  totalDownloads: number;
  assets: { name: string; size: number; url: string; downloads: number; type: string }[];
};

type RepoReleases = {
  repo: {
    id: string;
    label: string;
    color: string;
    description: string;
    fullName: string;
    url: string;
    stars: number;
    forks: number;
    language: string | null;
  };
  releases: NormalizedRelease[];
  totalDownloads: number;
  latestTag: string | null;
};

type CacheEntry = { at: number; body: { success: boolean; repos: RepoReleases[] } };
let cache: CacheEntry | null = null;

function ghHeaders(): Record<string, string> {
  const h: Record<string, string> = {
    Accept: "application/vnd.github.v3+json",
    "User-Agent": "zyraxon-releases",
  };
  const token = process.env["GITHUB_PERSONAL_ACCESS_TOKEN"] || process.env.GITHUB_TOKEN;
  if (token) h.Authorization = `Bearer ${token}`;
  return h;
}

async function fetchRepo(owner: string, name: string): Promise<RepoInfo | null> {
  try {
    const res = await fetch(`https://api.github.com/repos/${owner}/${name}`, {
      headers: ghHeaders(),
      signal: AbortSignal.timeout(10000),
    });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

/**
 * Walk every page of the release feed until GitHub returns fewer than a full
 * page. That is what makes later tags appear without touching this file.
 */
async function fetchReleases(owner: string, name: string): Promise<GhRelease[]> {
  const all: GhRelease[] = [];
  for (let page = 1; page <= MAX_PAGES; page++) {
    let batch: GhRelease[] = [];
    try {
      const res = await fetch(
        `https://api.github.com/repos/${owner}/${name}/releases?per_page=${PER_PAGE}&page=${page}`,
        { headers: ghHeaders(), signal: AbortSignal.timeout(15000) },
      );
      if (!res.ok) break;
      const data = await res.json();
      if (!Array.isArray(data)) break;
      batch = data.filter((r: GhRelease) => !r.draft);
    } catch {
      break;
    }
    all.push(...batch);
    if (batch.length < PER_PAGE) break;
  }
  return all;
}

function normalize(r: GhRelease): NormalizedRelease {
  const totalDownloads = r.assets.reduce((sum, a) => sum + (a.download_count || 0), 0);
  return {
    id: r.id,
    tag: r.tag_name,
    name: r.name || r.tag_name,
    url: r.html_url,
    publishedAt: r.published_at,
    prerelease: r.prerelease,
    body: r.body,
    totalDownloads,
    assets: r.assets.map((a) => ({
      name: a.name,
      size: a.size,
      url: a.browser_download_url,
      downloads: a.download_count || 0,
      type: a.content_type || "",
    })),
  };
}

export const Route = createFileRoute("/api/public/zyraxon-releases")({
  server: {
    handlers: {
      OPTIONS: async () => new Response(null, { status: 204, headers: CORS }),

      GET: async ({ request }) => {
        const fresh = new URL(request.url).searchParams.get("fresh") === "1";
        if (!fresh && cache && Date.now() - cache.at < CACHE_MS) {
          return Response.json(cache.body, {
            headers: { ...CORS, "Cache-Control": "public, max-age=120" },
          });
        }

        try {
          const results: RepoReleases[] = await Promise.all(
            REPOS.map(async (repo) => {
              const [repoInfo, releases] = await Promise.all([
                fetchRepo(repo.owner, repo.name),
                fetchReleases(repo.owner, repo.name),
              ]);
              const normalized = releases
                .map(normalize)
                .sort((a, b) => (b.publishedAt ?? "").localeCompare(a.publishedAt ?? ""));
              const totalDownloads = normalized.reduce((sum, r) => sum + r.totalDownloads, 0);
              return {
                repo: {
                  id: repo.id,
                  label: repo.label,
                  color: repo.color,
                  description: repo.description,
                  fullName: `${repo.owner}/${repo.name}`,
                  url: `https://github.com/${repo.owner}/${repo.name}`,
                  stars: repoInfo?.stargazers_count ?? 0,
                  forks: repoInfo?.forks_count ?? 0,
                  language: repoInfo?.language ?? null,
                },
                releases: normalized,
                totalDownloads,
                latestTag: normalized[0]?.tag ?? null,
              };
            }),
          );

          const body = { success: true, repos: results };
          cache = { at: Date.now(), body };
          return Response.json(body, {
            headers: { ...CORS, "Cache-Control": "public, max-age=120" },
          });
        } catch (err) {
          return Response.json(
            { success: false, error: String(err), repos: [] },
            { status: 500, headers: CORS },
          );
        }
      },
    },
  },
});
