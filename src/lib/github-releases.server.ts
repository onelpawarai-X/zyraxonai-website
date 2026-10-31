/**
 * Reading a GitHub release the way a browser does, not the way the REST API
 * does: no token, no rate-limit bucket, nothing that can expire.
 *
 * Three public requests, all of which any visitor could make by hand:
 *
 *   1. `GET /releases/latest`  — 302s to `.../releases/tag/<tag>`, so the tag
 *      comes out of the Location header.
 *   2. `GET /releases`         — the whole tag history, newest first. That is
 *      what lets a caller keep working when the newest release is missing a
 *      build: it can step back to the previous tag that does carry one.
 *   3. `GET /releases/expanded_assets/<tag>` — the HTML fragment GitHub itself
 *      renders for the release page's asset list. Every asset name is in it.
 *
 * A token was the previous design and it was the bug: when the configured token
 * was rejected GitHub answers 401, and the old code read that as "this repo has
 * no releases" and silently produced an empty page. The public paths cannot
 * fail that way — there is no credential to be stale.
 *
 * Two callers share this: the ZYRAXON Agent resolver and the ZyraxonOS one.
 * They read different repositories and serve different buttons, but the read
 * itself is identical, and a second copy would drift.
 */

/** What a browser-like read of GitHub sends. No Authorization, ever. */
export const GH_HEADERS = {
  "User-Agent": "Mozilla/5.0 (compatible; ZYRAXON-site/1.0; +https://zyraxonai.lovable.app)",
  Accept: "text/html,application/xhtml+xml",
};

/** `GET /releases/latest` and read the tag out of the redirect. */
export async function latestTag(repo: string): Promise<string | null> {
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
export async function assetsOf(
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
 * carries the whole tag history. That is what lets a resolver keep working when
 * the newest release happens to be missing a build: it can step back to the
 * previous tag that does carry one, instead of showing a dead button until
 * someone re-uploads.
 */
export async function recentTags(repo: string): Promise<string[]> {
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

/** GitHub's own shortcut: a 302 to the asset, served as an attachment. */
export function downloadUrl(repo: string, tag: string, name: string) {
  return `https://github.com/${repo}/releases/download/${encodeURIComponent(tag)}/${encodeURIComponent(name)}`;
}

/** The page a human may still want, for release notes. */
export function releaseUrl(repo: string, tag: string) {
  return `https://github.com/${repo}/releases/tag/${encodeURIComponent(tag)}`;
}
