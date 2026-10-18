import { createFileRoute } from "@tanstack/react-router";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

const REPOS = [
  { id: "zyraxon-agent", owner: "onelpawarai-X", name: "ZYRAXON-AI", label: "ZYRAXON Agent", color: "#2563eb", description: "Desktop AI agent with 11 agent modes, 888 tools across 63 categories, eternal memory, screen vision" },
];

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
  repo: { id: string; label: string; color: string; description: string; fullName: string; url: string; stars: number; forks: number; language: string | null };
  releases: NormalizedRelease[];
  totalDownloads: number;
  latestTag: string | null;
};

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
    const res = await fetch(`https://api.github.com/repos/${owner}/${name}`, { headers: ghHeaders(), signal: AbortSignal.timeout(10000) });
    if (!res.ok) return null;
    return await res.json();
  } catch { return null; }
}

async function fetchReleases(owner: string, name: string, perPage = 50): Promise<GhRelease[]> {
  try {
    const res = await fetch(`https://api.github.com/repos/${owner}/${name}/releases?per_page=${perPage}`, { headers: ghHeaders(), signal: AbortSignal.timeout(15000) });
    if (!res.ok) return [];
    const data = await res.json();
    return Array.isArray(data) ? data.filter((r: GhRelease) => !r.draft) : [];
  } catch { return []; }
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
      GET: async () => {
        try {
          const results: RepoReleases[] = await Promise.all(
            REPOS.map(async (repo) => {
              const [repoInfo, releases] = await Promise.all([
                fetchRepo(repo.owner, repo.name),
                fetchReleases(repo.owner, repo.name),
              ]);
              const normalized = releases.map(normalize);
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

          return Response.json({ success: true, repos: results }, { headers: { ...CORS, "Cache-Control": "public, max-age=120" } });
        } catch (err) {
          return Response.json({ success: false, error: String(err), repos: [] }, { status: 500, headers: CORS });
        }
      },
    },
  },
});
