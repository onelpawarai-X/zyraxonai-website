/** Server-owned GitHub OAuth flow for ZYRAXON. */
import { createClient } from "@supabase/supabase-js";
import { HttpError, badRequest, readJson, requireString } from "./http.server";
import type { ApiContext } from "./context.server";
import { encryptGitHubToken } from "@/lib/github-token.server";

type GitHubUser = {
  id: number;
  login: string;
  name: string | null;
  avatar_url: string | null;
  bio: string | null;
  blog: string | null;
  location: string | null;
  email: string | null;
};
type GitHubTokenResponse = {
  access_token?: string;
  refresh_token?: string;
  expires_in?: number;
  refresh_token_expires_in?: number;
  scope?: string;
  error?: string;
  error_description?: string;
};
type GitHubEmail = { email: string; primary: boolean; verified: boolean };

// This is the client ID supplied for the production GitHub OAuth application.
// It is public by design. Never put GITHUB_CLIENT_SECRET in client-side code.
export const GITHUB_CLIENT_ID = "Ov23liDGlT46vtrvOSqo";
export const GITHUB_REDIRECT_URI = "https://zyraxonai.lovable.app/api/public/auth/github/callback";
const STATE_COOKIE = "zyraxon_github_oauth_state";
const ACCESS_COOKIE = "zyraxon_session";
const REFRESH_COOKIE = "zyraxon_refresh";

function cookieValue(request: Request, name: string): string | null {
  const raw = request.headers.get("cookie") || "";
  const match = raw
    .split(";")
    .map((v) => v.trim())
    .find((v) => v.startsWith(`${name}=`));
  return match ? decodeURIComponent(match.slice(name.length + 1)) : null;
}
function cookie(name: string, value: string, maxAge: number, httpOnly = true) {
  const parts = [
    `${name}=${encodeURIComponent(value)}`,
    "Path=/",
    "Secure",
    "SameSite=Lax",
    `Max-Age=${maxAge}`,
  ];
  if (httpOnly) parts.push("HttpOnly");
  return parts.join("; ");
}
function clearCookie(name: string) {
  return `${name}=; Path=/; Secure; SameSite=Lax; Max-Age=0; HttpOnly`;
}

async function githubToken(code: string): Promise<GitHubTokenResponse> {
  const clientSecret = process.env["GITHUB_CLIENT_SECRET"];
  if (!clientSecret)
    throw new HttpError(500, "NOT_CONFIGURED", "GitHub OAuth backend is not configured");
  const res = await fetch("https://github.com/login/oauth/access_token", {
    method: "POST",
    headers: { Accept: "application/json", "Content-Type": "application/json" },
    body: JSON.stringify({
      client_id: GITHUB_CLIENT_ID,
      client_secret: clientSecret,
      code,
      redirect_uri: GITHUB_REDIRECT_URI,
    }),
  });
  const body = (await res.json()) as GitHubTokenResponse;
  if (!body.access_token)
    throw badRequest(
      body.error_description || body.error || "GitHub rejected the authorization code",
    );
  return body;
}
async function githubGet<T>(path: string, token: string): Promise<T> {
  const res = await fetch(`https://api.github.com${path}`, {
    headers: {
      Accept: "application/vnd.github+json",
      Authorization: `Bearer ${token}`,
      "User-Agent": "zyraxon-api",
    },
  });
  if (!res.ok) throw new HttpError(502, "GITHUB_ERROR", `GitHub API ${res.status} on ${path}`);
  return (await res.json()) as T;
}
async function mintSession(email: string) {
  const url = process.env["SUPABASE_URL"];
  const publishable = process.env["SUPABASE_PUBLISHABLE_KEY"];
  if (!url || !publishable)
    throw new HttpError(500, "NOT_CONFIGURED", "Backend auth is not configured");
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data, error } = await supabaseAdmin.auth.admin.generateLink({ type: "magiclink", email });
  if (error || !data.properties?.hashed_token)
    throw new HttpError(500, "AUTH_ERROR", error?.message ?? "Could not create a session");
  const anon = createClient(url, publishable, {
    auth: { persistSession: false, autoRefreshToken: false, storage: undefined },
    global: {
      fetch: (input, init) => {
        const headers = new Headers(init?.headers);
        headers.delete("Authorization");
        headers.set("apikey", publishable);
        return fetch(input, { ...init, headers });
      },
    },
  });
  const verified = await anon.auth.verifyOtp({
    token_hash: data.properties.hashed_token,
    type: "email",
  });
  if (verified.error || !verified.data.session)
    throw new HttpError(
      500,
      "AUTH_ERROR",
      verified.error?.message ?? "Could not verify the session",
    );
  return verified.data.session;
}
async function completeGitHubLogin(ctx: ApiContext, code: string) {
  const github = await githubToken(code);
  const accessToken = github.access_token!;
  const ghUser = await githubGet<GitHubUser>("/user", accessToken);
  const emails = await githubGet<GitHubEmail[]>("/user/emails", accessToken).catch(
    () => [] as GitHubEmail[],
  );
  const email =
    emails.find((e) => e.primary && e.verified)?.email ??
    emails.find((e) => e.verified)?.email ??
    ghUser.email ??
    `${ghUser.login}@users.noreply.github.com`;
  const { data: existing } = await ctx.db
    .from("profiles")
    .select("id")
    .eq("github_id", ghUser.id)
    .maybeSingle();
  if (!existing) {
    const created = await ctx.db.auth.admin.createUser({
      email,
      email_confirm: true,
      user_metadata: {
        user_name: ghUser.login,
        full_name: ghUser.name,
        avatar_url: ghUser.avatar_url,
      },
    });
    if (created.error && !/already/i.test(created.error.message))
      throw new HttpError(500, "AUTH_ERROR", created.error.message);
  }
  const session = await mintSession(email);
  await ctx.db
    .from("profiles")
    .update({
      github_id: ghUser.id,
      github_login: ghUser.login,
      name: ghUser.name,
      avatar_url: ghUser.avatar_url,
      bio: ghUser.bio,
      blog: ghUser.blog,
      location: ghUser.location,
      email,
    })
    .eq("id", session.user.id);
  const encryptedAccessToken = await encryptGitHubToken(accessToken);
  const encryptedRefreshToken = github.refresh_token
    ? await encryptGitHubToken(github.refresh_token)
    : null;
  const now = Date.now();
  await ctx.db.from("github_connections").upsert({
    user_id: session.user.id,
    github_id: ghUser.id,
    github_login: ghUser.login,
    encrypted_access_token: encryptedAccessToken,
    token_expires_at: github.expires_in
      ? new Date(now + github.expires_in * 1000).toISOString()
      : null,
    refresh_token_encrypted: encryptedRefreshToken,
    refresh_token_expires_at: github.refresh_token_expires_in
      ? new Date(now + github.refresh_token_expires_in * 1000).toISOString()
      : null,
    scopes: (github.scope ?? "").split(/\s+/).filter(Boolean),
  });
  return {
    session,
    user: {
      id: session.user.id,
      login: ghUser.login,
      github_id: ghUser.id,
      name: ghUser.name,
      avatar_url: ghUser.avatar_url,
      email,
    },
  };
}
export function githubStart(_ctx: ApiContext): Response {
  const state = crypto.randomUUID();
  const url = new URL("https://github.com/login/oauth/authorize");
  url.searchParams.set("client_id", GITHUB_CLIENT_ID);
  // Let GitHub use the callback registered on the OAuth app. This prevents
  // preview/alternate-origin redirect_uri values from breaking production login.
  url.searchParams.set("scope", "repo user:email");
  url.searchParams.set("state", state);
  return new Response(null, {
    status: 302,
    headers: {
      Location: url.toString(),
      "Set-Cookie": cookie(STATE_COOKIE, state, 600),
      "Cache-Control": "no-store",
    },
  });
}
export async function githubCallback(ctx: ApiContext): Promise<Response> {
  const code = ctx.url.searchParams.get("code");
  const state = ctx.url.searchParams.get("state");
  const expected = cookieValue(ctx.request, STATE_COOKIE);
  if (!code) {
    const target = new URL("/builder", ctx.url.origin);
    target.searchParams.set(
      "github_error",
      ctx.url.searchParams.get("error") || "authorization_failed",
    );
    return new Response(null, {
      status: 302,
      headers: { Location: target.toString(), "Set-Cookie": clearCookie(STATE_COOKIE) },
    });
  }
  if (!state || !expected || state !== expected) {
    const target = new URL("/builder", ctx.url.origin);
    target.searchParams.set("github_error", "state_mismatch");
    return new Response(null, {
      status: 302,
      headers: { Location: target.toString(), "Set-Cookie": clearCookie(STATE_COOKIE) },
    });
  }
  try {
    const result = await completeGitHubLogin(ctx, code);
    const target = new URL("/builder", ctx.url.origin);
    target.searchParams.set("github", "connected");
    const headers = new Headers();
    headers.set("Location", target.toString());
    headers.set("Cache-Control", "no-store");
    headers.append(
      "Set-Cookie",
      cookie(
        ACCESS_COOKIE,
        result.session.access_token,
        Math.max(60, result.session.expires_in || 3600),
      ),
    );
    if (result.session.refresh_token)
      headers.append(
        "Set-Cookie",
        cookie(REFRESH_COOKIE, result.session.refresh_token, 60 * 60 * 24 * 30),
      );
    headers.append("Set-Cookie", clearCookie(STATE_COOKIE));
    return new Response(null, { status: 302, headers });
  } catch (error: unknown) {
    const target = new URL("/builder", ctx.url.origin);
    target.searchParams.set("github_error", error?.message || "github_sign_in_failed");
    return new Response(null, {
      status: 302,
      headers: { Location: target.toString(), "Set-Cookie": clearCookie(STATE_COOKIE) },
    });
  }
}
export async function githubExchange(ctx: ApiContext) {
  const body = await readJson<{ code?: string }>(ctx.request);
  const code = requireString(body.code, "code", 400);
  const result = await completeGitHubLogin(ctx, code);
  return {
    user: result.user,
    token: result.session.access_token,
    refresh_token: result.session.refresh_token,
    expires_at: result.session.expires_at,
  };
}
export async function githubMe(ctx: ApiContext) {
  const userId = ctx.requireUser();
  const { data: profile } = await ctx.db
    .from("profiles")
    .select("*")
    .eq("id", userId)
    .maybeSingle();
  return {
    user: profile
      ? {
          id: profile.id,
          login: profile.github_login,
          github_id: profile.github_id,
          name: profile.name,
          avatar_url: profile.avatar_url,
          email: profile.email,
        }
      : null,
  };
}
export function githubLogout(): Response {
  const headers = new Headers({ "Content-Type": "application/json", "Cache-Control": "no-store" });
  headers.append("Set-Cookie", clearCookie(ACCESS_COOKIE));
  headers.append("Set-Cookie", clearCookie(REFRESH_COOKIE));
  headers.append("Set-Cookie", clearCookie(STATE_COOKIE));
  return new Response(JSON.stringify({ ok: true }), { status: 200, headers });
}
