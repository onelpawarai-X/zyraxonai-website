/** Reads the repository's live star count, and the release download total.
 *
 *  Both come from the same public GitHub API and are cached together, because
 *  the provider gate needs the star count and the homepage shows both. The
 *  cache is what keeps a page of visitors from each spending a request on
 *  GitHub: the numbers move slowly, and a five-minute-old count is a truthful
 *  answer to "how many stars".
 *
 *  A failure never throws and never caches. A caller that cannot read GitHub
 *  gets `null`, which every surface renders as "unknown" rather than as zero —
 *  showing zero stars would be a worse lie than showing none. */
import { STAR_REPO } from "./star-gate";

const CACHE_MS = 5 * 60_000;

/** GitHub refuses a request without a User-Agent. */
const HEADERS = {
  "User-Agent": "ZYRAXON-site/1.0 (+https://zyraxonai.lovable.app)",
  Accept: "application/vnd.github+json",
};

type Snapshot = {
  stars: number | null;
  forks: number | null;
  downloads: number | null;
  /** When the repository was created, for the star-rate projection. */
  createdAt: string | null;
  at: string;
};

let cache: { at: number; value: Snapshot } | null = null;

/** The token is optional. Unauthenticated reads are rate-limited per IP but
 *  work, and a deployment that sets one gets the higher ceiling. Either way it
 *  is only ever used for a public read of a public repository. */
function authHeaders(): Record<string, string> {
  const token = (process.env.GITHUB_TOKEN || process.env.GITHUB_PERSONAL_ACCESS_TOKEN || "").trim();
  return token ? { ...HEADERS, Authorization: `Bearer ${token}` } : HEADERS;
}

type RepoJson = { stargazers_count?: number; forks_count?: number; created_at?: string };
type ReleaseJson = { assets?: Array<{ download_count?: number }> };

async function readJson<T>(url: string): Promise<T | null> {
  try {
    const res = await fetch(url, { headers: authHeaders() });
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

/** Stars, forks and the creation time in one read.
 *
 *  The creation time rides along because the star-rate projection needs it and
 *  GitHub returns it in this same response — measuring the rate costs no
 *  additional request. */
async function readRepo(): Promise<{
  stars: number | null;
  forks: number | null;
  createdAt: string | null;
}> {
  const data = await readJson<RepoJson>(`https://api.github.com/repos/${STAR_REPO}`);
  const stars = typeof data?.stargazers_count === "number" ? data.stargazers_count : null;
  const forks = typeof data?.forks_count === "number" ? data.forks_count : null;
  const createdAt = typeof data?.created_at === "string" ? data.created_at : null;
  return { stars, forks, createdAt };
}

/** The sum of `download_count` over every asset of every release.
 *
 *  GitHub does not publish a repository-wide download total, so this is the
 *  honest way to get one: page through the releases and add up what each asset
 *  reports. Ten pages of a hundred releases is the ceiling, which is far more
 *  than this repository will have for a long time and still bounds the work. */
async function readDownloads(): Promise<number | null> {
  let total = 0;
  let sawAny = false;
  for (let page = 1; page <= 10; page++) {
    const releases = await readJson<ReleaseJson[]>(
      `https://api.github.com/repos/${STAR_REPO}/releases?per_page=100&page=${page}`,
    );
    if (!Array.isArray(releases)) break;
    if (!releases.length) break;
    sawAny = true;
    for (const release of releases) {
      for (const asset of release?.assets ?? []) {
        if (typeof asset?.download_count === "number") total += asset.download_count;
      }
    }
    if (releases.length < 100) break;
  }
  return sawAny ? total : null;
}

/** The current numbers, from cache when it is fresh.
 *
 *  `fresh` skips the cache, which is what the homepage's "refresh" affordance
 *  and any caller that has just starred the repository wants. */
export async function repoSnapshot(options?: { fresh?: boolean }): Promise<Snapshot> {
  if (!options?.fresh && cache && Date.now() - cache.at < CACHE_MS) return cache.value;

  const [repo, downloads] = await Promise.all([readRepo(), readDownloads()]);
  const value: Snapshot = {
    stars: repo.stars,
    forks: repo.forks,
    downloads,
    createdAt: repo.createdAt,
    at: new Date().toISOString(),
  };
  // Only a read that produced something is worth remembering. A blank result is
  // usually a rate limit, and holding it for five minutes would turn a moment
  // of throttling into five minutes of "unknown" for everyone.
  if (value.stars !== null || value.downloads !== null) cache = { at: Date.now(), value };
  return value;
}

/** Just the star count, for the provider gate. */
export async function starCount(): Promise<number | null> {
  return (await repoSnapshot()).stars;
}
