import type { ApiContext } from "@/lib/api/context.server";
import { requireGitHubToken, githubRequest } from "@/lib/github-connection.server";
import { HttpError } from "@/lib/api/http.server";

const REPO_RE = /^[A-Za-z0-9._-]{1,90}$/;

type PublishInput = {
  repo: string;
  files: Record<string, string>;
  description?: string;
  privateRepo?: boolean;
};

function b64(text: string) {
  const bytes = new TextEncoder().encode(text);
  let bin = "";
  bytes.forEach((b) => {
    bin += String.fromCharCode(b);
  });
  return btoa(bin);
}

export async function publishConnectedSite(ctx: ApiContext, input: PublishInput) {
  const { token, githubLogin } = await requireGitHubToken(ctx);
  const repo = input.repo.trim().replace(/\.git$/, "");
  if (!REPO_RE.test(repo))
    throw new HttpError(400, "INVALID_REPOSITORY", "Invalid repository name.");
  const entries = Object.entries(input.files || {}).filter(
    ([name, content]) => name && typeof content === "string",
  );
  if (!entries.length)
    throw new HttpError(400, "EMPTY_SITE", "Generate a website before publishing.");
  const total = entries.reduce((n, [, v]) => n + v.length, 0);
  if (total > 20_000_000)
    throw new HttpError(413, "SITE_TOO_LARGE", "Website source is too large (20MB limit).");

  let repoInfo = await githubRequest<unknown>(`/repos/${githubLogin}/${repo}`, token).catch(
    () => null,
  );
  if (!repoInfo) {
    repoInfo = await githubRequest<unknown>("/user/repos", token, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: repo,
        description: input.description || "Built with ZYRAXON AI",
        private: Boolean(input.privateRepo),
        auto_init: true,
      }),
    });
    await new Promise((r) => setTimeout(r, 1200));
  }

  for (const [path, content] of entries) {
    const safePath = path.replace(/^\/+/, "").replace(/\.\.\//g, "");
    if (!safePath || safePath.startsWith(".git/")) continue;
    const existing = await githubRequest<unknown>(
      `/repos/${githubLogin}/${repo}/contents/${encodeURIComponent(safePath)}`,
      token,
    ).catch(() => null);
    await githubRequest<unknown>(`/repos/${githubLogin}/${repo}/contents/${safePath}`, token, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        message: `ZYRAXON AI: publish ${safePath}`,
        content: b64(content),
        ...(existing?.sha ? { sha: existing.sha } : {}),
      }),
    });
  }

  const pages = await githubRequest<unknown>(`/repos/${githubLogin}/${repo}/pages`, token).catch(
    () => null,
  );
  if (!pages) {
    await githubRequest<unknown>(`/repos/${githubLogin}/${repo}/pages`, token, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ source: { branch: repoInfo.default_branch || "main", path: "/" } }),
    }).catch(() => undefined);
  }
  const finalPages = await githubRequest<unknown>(
    `/repos/${githubLogin}/${repo}/pages`,
    token,
  ).catch(() => null);
  return {
    ok: true,
    owner: githubLogin,
    repo,
    repoUrl: `https://github.com/${githubLogin}/${repo}`,
    pagesUrl: finalPages?.html_url || `https://${githubLogin}.github.io/${repo}/`,
    note: "GitHub Pages may take a short time to build the first deployment.",
  };
}
