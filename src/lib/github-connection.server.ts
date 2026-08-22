import type { ApiContext } from "@/lib/api/context.server";
import { decryptGitHubToken } from "./github-token.server";
import { HttpError } from "@/lib/api/http.server";

export async function requireGitHubToken(
  ctx: ApiContext,
): Promise<{ token: string; githubLogin: string; githubId: number }> {
  const userId = ctx.requireUser();
  const { data, error } = await ctx.db
    .from("github_connections")
    .select("github_id, github_login, encrypted_access_token, token_expires_at")
    .eq("user_id", userId)
    .maybeSingle();

  if (error || !data)
    throw new HttpError(409, "GITHUB_NOT_CONNECTED", "Connect GitHub before using GitHub actions");
  if (data.token_expires_at && new Date(data.token_expires_at).getTime() <= Date.now()) {
    throw new HttpError(
      401,
      "GITHUB_TOKEN_EXPIRED",
      "GitHub authorization has expired; reconnect GitHub",
    );
  }

  return {
    token: await decryptGitHubToken(data.encrypted_access_token),
    githubLogin: data.github_login,
    githubId: data.github_id,
  };
}

export async function githubRequest<T>(
  path: string,
  token: string,
  init: RequestInit = {},
): Promise<T> {
  const response = await fetch(`https://api.github.com${path}`, {
    ...init,
    headers: {
      Accept: "application/vnd.github+json",
      Authorization: `Bearer ${token}`,
      "X-GitHub-Api-Version": "2022-11-28",
      "User-Agent": "zyraxon-ai",
      ...(init.headers ?? {}),
    },
  });
  const body = await response.json().catch(() => null);
  if (!response.ok) {
    const message =
      body && typeof body.message === "string" ? body.message : `GitHub API ${response.status}`;
    throw new HttpError(response.status === 401 ? 401 : 502, "GITHUB_ERROR", message);
  }
  return body as T;
}
