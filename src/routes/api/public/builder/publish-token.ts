import { createFileRoute } from '@tanstack/react-router';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'content-type',
  'Access-Control-Allow-Methods': 'POST,OPTIONS',
};
const REPO_RE = /^[A-Za-z0-9._-]{1,90}$/;

async function github(path: string, token: string, init: RequestInit = {}) {
  const r = await fetch(`https://api.github.com${path}`, {
    ...init,
    headers: {
      Accept: 'application/vnd.github+json',
      Authorization: `Bearer ${token}`,
      'X-GitHub-Api-Version': '2022-11-28',
      'User-Agent': 'zyraxon-ai-builder',
      ...(init.headers || {}),
    },
  });
  const body = await r.json().catch(() => null);
  if (!r.ok) throw new Error(typeof body?.message === 'string' ? body.message : `GitHub API ${r.status}`);
  return body;
}

function b64(text: string) {
  return Buffer.from(new TextEncoder().encode(text)).toString('base64');
}

export const Route = createFileRoute('/api/public/builder/publish-token')({
  server: {
    handlers: {
      OPTIONS: async () => new Response(null, { status: 204, headers: CORS }),
      POST: async ({ request }) => {
        try {
          const body: any = await request.json();
          const token = String(body?.token || '').trim();
          const repo = String(body?.repo || '').trim().replace(/\.git$/, '');
          const files = body?.files && typeof body.files === 'object' ? body.files as Record<string, unknown> : {};
          if (!token) return Response.json({ ok: false, error: 'GitHub token is required.' }, { status: 400, headers: CORS });
          if (!REPO_RE.test(repo)) return Response.json({ ok: false, error: 'Invalid repository name.' }, { status: 400, headers: CORS });
          const entries = Object.entries(files).filter(([name, content]) => name && typeof content === 'string') as Array<[string, string]>;
          if (!entries.length) return Response.json({ ok: false, error: 'Generate a project before publishing.' }, { status: 400, headers: CORS });

          // Validate the token and discover the authenticated owner. The raw token is never written to localStorage,
          // the builder session, chat history, database, logs, or the AI conversation.
          const user = await github('/user', token);
          const owner = String(user?.login || '');
          if (!owner) throw new Error('GitHub did not return an authenticated user.');

          let repoInfo = await github(`/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}`, token).catch(() => null);
          if (!repoInfo) {
            repoInfo = await github('/user/repos', token, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ name: repo, description: 'Built with ZYRAXON AI', private: false, auto_init: true }),
            });
            await new Promise(r => setTimeout(r, 800));
          }

          for (const [rawPath, content] of entries) {
            const safePath = rawPath.replace(/^\/+/, '').replace(/\.\.\//g, '');
            if (!safePath || safePath.startsWith('.git/')) continue;
            const existing = await github(`/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/contents/${safePath}`, token).catch(() => null);
            await github(`/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/contents/${safePath}`, token, {
              method: 'PUT',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ message: `ZYRAXON AI: publish ${safePath}`, content: b64(content), ...(existing?.sha ? { sha: existing.sha } : {}) }),
            });
          }

          let pages = await github(`/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/pages`, token).catch(() => null);
          if (!pages) {
            pages = await github(`/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/pages`, token, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ source: { branch: repoInfo.default_branch || 'main', path: '/' } }),
            }).catch(() => null);
          }
          const finalPages = pages || await github(`/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/pages`, token).catch(() => null);
          return Response.json({ ok: true, owner, repo, repoUrl: `https://github.com/${owner}/${repo}`, pagesUrl: finalPages?.html_url || `https://${owner}.github.io/${repo}/`, note: 'GitHub Pages may take a short time to become available.' }, { headers: CORS });
        } catch (error: any) {
          return Response.json({ ok: false, error: error?.message || 'GitHub publish failed.' }, { status: 502, headers: CORS });
        }
      },
    },
  },
});
