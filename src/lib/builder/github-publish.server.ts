/**
 * Publish a generated Builder project to the user's GitHub account.
 *
 * The GitHub token is supplied per publish request and is never persisted by
 * this module. The caller may provide a complete file map; index.html remains
 * the required entry point for GitHub Pages.
 */

const GH = "https://api.github.com";

type GhInit = { token: string; method?: string; body?: unknown };

async function gh<T = unknown>(
  path: string,
  { token, method = "GET", body }: GhInit,
): Promise<{ ok: boolean; status: number; data: T }> {
  const res = await fetch(`${GH}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
      "User-Agent": "zyraxon-ai-builder",
      ...(body ? { "Content-Type": "application/json" } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  const text = await res.text();
  let data: unknown = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = { raw: text };
  }
  return { ok: res.ok, status: res.status, data };
}

function b64(text: string): string {
  const bytes = new TextEncoder().encode(text);
  let bin = "";
  bytes.forEach((byte) => {
    bin += String.fromCharCode(byte);
  });
  return btoa(bin);
}

function safePath(path: string) {
  return path
    .replace(/^\/+/, "")
    .replace(/\\/g, "/")
    .split("/")
    .filter((part) => part && part !== "." && part !== "..")
    .join("/");
}

async function putFile(
  token: string,
  owner: string,
  repo: string,
  path: string,
  content: string,
  message: string,
) {
  const encoded = path.split("/").map(encodeURIComponent).join("/");
  const existing = await gh<unknown>(`/repos/${owner}/${repo}/contents/${encoded}`, { token });
  const sha = existing.ok ? existing.data?.sha : undefined;
  return gh(`/repos/${owner}/${repo}/contents/${encoded}`, {
    token,
    method: "PUT",
    body: { message, content: b64(content), ...(sha ? { sha } : {}) },
  });
}

export type PublishInput = {
  token: string;
  repo: string;
  html?: string;
  files?: Record<string, string>;
  description?: string;
  customDomain?: string;
  privateRepo?: boolean;
};

export type PublishResult = {
  ok: boolean;
  error?: string;
  owner?: string;
  repo?: string;
  repoUrl?: string;
  pagesUrl?: string;
  customDomain?: string | null;
  dns?: { type: string; name: string; value: string }[];
  note?: string;
};

const DOMAIN_RE = /^(?!-)[a-z0-9-]{1,63}(\.[a-z0-9-]{1,63})+$/i;
const REPO_RE = /^[A-Za-z0-9._-]{1,90}$/;

export async function publishSite(input: PublishInput): Promise<PublishResult> {
  const token = input.token.trim();
  const repo = (input.repo || "").trim().replace(/\.git$/, "");
  const customDomain = (input.customDomain || "")
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, "")
    .replace(/\/.*$/, "");
  const files: Record<string, string> = { ...(input.files || {}) };
  if (!files["index.html"] && input.html) files["index.html"] = input.html;

  if (!token) return { ok: false, error: "GitHub access token is required." };
  if (!REPO_RE.test(repo)) return { ok: false, error: "Invalid repository name." };
  if (!files["index.html"] || files["index.html"].length < 30)
    return { ok: false, error: "Nothing to publish yet — generate a site first." };
  if (customDomain && !DOMAIN_RE.test(customDomain))
    return { ok: false, error: "Invalid custom domain." };

  const entries = Object.entries(files)
    .map(([path, content]) => [safePath(path), String(content)] as const)
    .filter(([path, content]) => path && content.length <= 5_000_000 && !path.startsWith(".git/"));
  const total = entries.reduce((sum, [, content]) => sum + content.length, 0);
  if (total > 20_000_000) return { ok: false, error: "Website source is too large (20MB limit)." };

  const me = await gh<{ login: string }>("/user", { token });
  if (!me.ok || !me.data?.login) {
    return {
      ok: false,
      error:
        "GitHub token rejected. Use a token with permission to create/update repositories and GitHub Pages.",
    };
  }
  const owner = me.data.login;

  let repoInfo = await gh<unknown>(`/repos/${owner}/${repo}`, { token });
  if (!repoInfo.ok) {
    const created = await gh<unknown>("/user/repos", {
      token,
      method: "POST",
      body: {
        name: repo,
        description: input.description || "Built with ZYRAXON AI",
        private: Boolean(input.privateRepo),
        auto_init: true,
      },
    });
    if (!created.ok) {
      return {
        ok: false,
        error: `Could not create repository: ${created.data?.message || created.status}`,
      };
    }
    repoInfo = created;
    await new Promise((resolve) => setTimeout(resolve, 1500));
  }

  for (const [path, content] of entries) {
    const put = await putFile(token, owner, repo, path, content, `ZYRAXON AI: publish ${path}`);
    if (!put.ok) {
      return { ok: false, error: `Could not write ${path}: ${put.data?.message || put.status}` };
    }
  }

  await putFile(token, owner, repo, ".nojekyll", "", "ZYRAXON AI: disable Jekyll");
  if (customDomain) {
    const cname = await putFile(
      token,
      owner,
      repo,
      "CNAME",
      `${customDomain}\n`,
      "ZYRAXON AI: custom domain",
    );
    if (!cname.ok)
      return { ok: false, error: `Could not write CNAME: ${cname.data?.message || cname.status}` };
  }

  const branch = repoInfo.data?.default_branch || "main";
  let pages = await gh<unknown>(`/repos/${owner}/${repo}/pages`, { token });
  if (!pages.ok) {
    pages = await gh<unknown>(`/repos/${owner}/${repo}/pages`, {
      token,
      method: "POST",
      body: { source: { branch, path: "/" } },
    });
  }
  if (!pages.ok && pages.status !== 409) {
    return {
      ok: false,
      error: `Could not enable GitHub Pages: ${pages.data?.message || pages.status}`,
    };
  }

  if (customDomain) {
    const domainResult = await gh<unknown>(`/repos/${owner}/${repo}/pages`, {
      token,
      method: "PUT",
      body: { cname: customDomain, https_enforced: true },
    });
    if (!domainResult.ok && domainResult.status !== 409) {
      return {
        ok: false,
        error: `Could not configure custom domain: ${domainResult.data?.message || domainResult.status}`,
      };
    }
  }

  const final = await gh<unknown>(`/repos/${owner}/${repo}/pages`, { token });
  const pagesUrl =
    final.ok && final.data?.html_url ? final.data.html_url : `https://${owner}.github.io/${repo}/`;
  const apex = customDomain ? customDomain.split(".").length === 2 : false;

  return {
    ok: true,
    owner,
    repo,
    repoUrl: `https://github.com/${owner}/${repo}`,
    pagesUrl: customDomain ? `https://${customDomain}/` : pagesUrl,
    customDomain: customDomain || null,
    dns: customDomain
      ? apex
        ? [
            { type: "A", name: "@", value: "185.199.108.153" },
            { type: "A", name: "@", value: "185.199.109.153" },
            { type: "A", name: "@", value: "185.199.110.153" },
            { type: "A", name: "@", value: "185.199.111.153" },
          ]
        : [{ type: "CNAME", name: customDomain.split(".")[0]!, value: `${owner}.github.io` }]
      : undefined,
    note: "GitHub Pages can take 1–2 minutes for the first build. Custom domains also need the DNS records above.",
  };
}
