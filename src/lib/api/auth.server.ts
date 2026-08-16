/** GitHub OAuth exchange backed by the ZYRAXON Supabase session. */
import { createClient } from '@supabase/supabase-js';
import { HttpError, badRequest, readJson, requireString } from './http.server';
import type { ApiContext } from './context.server';
import { encryptGitHubToken } from '@/lib/github-token.server';

type GitHubUser = { id: number; login: string; name: string | null; avatar_url: string | null; bio: string | null; blog: string | null; location: string | null; email: string | null };
type GitHubTokenResponse = { access_token?: string; refresh_token?: string; expires_in?: number; refresh_token_expires_in?: number; scope?: string; error?: string; error_description?: string };

// GitHub OAuth binds the one-time authorization code to the exact redirect URI.
// Keep this value identical in the browser authorize request, this server-side
// token exchange, and the GitHub OAuth App settings.
const DEFAULT_GITHUB_REDIRECT_URI = 'https://zyraxonai.lovable.app/api/public/auth/github/callback';

async function githubToken(code: string, redirectUri: string): Promise<GitHubTokenResponse> {
  const clientId = process.env['GITHUB_CLIENT_ID'];
  const clientSecret = process.env['GITHUB_CLIENT_SECRET'];
  if (!clientId || !clientSecret) throw new HttpError(500, 'NOT_CONFIGURED', 'GitHub OAuth backend is not configured');
  const res = await fetch('https://github.com/login/oauth/access_token', {
    method: 'POST', headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
    body: JSON.stringify({ client_id: clientId, client_secret: clientSecret, code, redirect_uri: redirectUri }),
  });
  const body = (await res.json()) as GitHubTokenResponse;
  if (!body.access_token) throw badRequest(body.error_description || body.error || 'GitHub rejected the authorization code');
  return body;
}

async function githubGet<T>(path: string, token: string): Promise<T> {
  const res = await fetch(`https://api.github.com${path}`, { headers: { Accept: 'application/vnd.github+json', Authorization: `Bearer ${token}`, 'User-Agent': 'zyraxon-api' } });
  if (!res.ok) throw new HttpError(502, 'GITHUB_ERROR', `GitHub API ${res.status} on ${path}`);
  return (await res.json()) as T;
}

async function mintSession(email: string) {
  const url = process.env['SUPABASE_URL'];
  const publishable = process.env['SUPABASE_PUBLISHABLE_KEY'];
  if (!url || !publishable) throw new HttpError(500, 'NOT_CONFIGURED', 'Backend auth is not configured');
  const { supabaseAdmin } = await import('@/integrations/supabase/client.server');
  const { data, error } = await supabaseAdmin.auth.admin.generateLink({ type: 'magiclink', email });
  if (error || !data.properties?.hashed_token) throw new HttpError(500, 'AUTH_ERROR', error?.message ?? 'Could not create a session');
  const anon = createClient(url, publishable, { auth: { persistSession: false, autoRefreshToken: false, storage: undefined }, global: { fetch: (input, init) => { const headers = new Headers(init?.headers); if (headers.get('Authorization') === `Bearer ${publishable}`) headers.delete('Authorization'); headers.set('apikey', publishable); return fetch(input, { ...init, headers }); } } });
  const verified = await anon.auth.verifyOtp({ token_hash: data.properties.hashed_token, type: 'email' });
  if (verified.error || !verified.data.session) throw new HttpError(500, 'AUTH_ERROR', verified.error?.message ?? 'Could not verify the session');
  return verified.data.session;
}

export async function githubExchange(ctx: ApiContext) {
  const body = await readJson<{ code?: string; redirect_uri?: string }>(ctx.request);
  const code = requireString(body.code, 'code', 400);

  // Never accept a caller-controlled redirect URI. The browser and GitHub App
  // must use the single canonical callback below.
  const redirectUri = DEFAULT_GITHUB_REDIRECT_URI;

  const github = await githubToken(code, redirectUri);
  const accessToken = github.access_token!;
  const ghUser = await githubGet<GitHubUser>('/user', accessToken);
  const emails = await githubGet<{ email: string; primary: boolean; verified: boolean }[]>('/user/emails', accessToken).catch(() => []);
  const email = emails.find(e => e.primary && e.verified)?.email ?? emails.find(e => e.verified)?.email ?? ghUser.email ?? `${ghUser.login}@users.noreply.github.com`;
  const { data: existing } = await ctx.db.from('profiles').select('id').eq('github_id', ghUser.id).maybeSingle();
  if (!existing) {
    const created = await ctx.db.auth.admin.createUser({ email, email_confirm: true, user_metadata: { user_name: ghUser.login, full_name: ghUser.name, avatar_url: ghUser.avatar_url } });
    if (created.error && !/already/i.test(created.error.message)) throw new HttpError(500, 'AUTH_ERROR', created.error.message);
  }
  const session = await mintSession(email);
  await ctx.db.from('profiles').update({ github_id: ghUser.id, github_login: ghUser.login, name: ghUser.name, avatar_url: ghUser.avatar_url, bio: ghUser.bio, blog: ghUser.blog, location: ghUser.location, email }).eq('id', session.user.id);
  const encryptedAccessToken = await encryptGitHubToken(accessToken);
  const encryptedRefreshToken = github.refresh_token ? await encryptGitHubToken(github.refresh_token) : null;
  const now = Date.now();
  await ctx.db.from('github_connections').upsert({ user_id: session.user.id, github_id: ghUser.id, github_login: ghUser.login, encrypted_access_token: encryptedAccessToken, token_expires_at: github.expires_in ? new Date(now + github.expires_in * 1000).toISOString() : null, refresh_token_encrypted: encryptedRefreshToken, refresh_token_expires_at: github.refresh_token_expires_in ? new Date(now + github.refresh_token_expires_in * 1000).toISOString() : null, scopes: (github.scope ?? '').split(/\s+/).filter(Boolean) });
  const { data: profile } = await ctx.db.from('profiles').select('*').eq('id', session.user.id).maybeSingle();
  return { user: { id: session.user.id, login: profile?.github_login ?? ghUser.login, github_id: ghUser.id, name: profile?.name ?? ghUser.name, avatar_url: profile?.avatar_url ?? ghUser.avatar_url, email }, token: session.access_token, refresh_token: session.refresh_token, expires_at: session.expires_at };
}

/**
 * Compatibility bridge for an older registered callback. It immediately sends
 * the one-time OAuth code to the browser callback surface; no credentials are
 * exposed in the URL beyond GitHub's short-lived code/state parameters.
 */
export function githubCallbackRedirect(ctx: ApiContext): Response {
  const code = ctx.url.searchParams.get('code') ?? '';
  const state = ctx.url.searchParams.get('state') ?? '';
  const error = ctx.url.searchParams.get('error') ?? '';
  const target = new URL('/', ctx.url.origin);
  if (code) target.searchParams.set('code', code);
  if (state) target.searchParams.set('state', state);
  if (error) target.searchParams.set('github_error', error);
  return new Response(null, { status: 302, headers: { Location: target.toString(), 'Cache-Control': 'no-store' } });
}
