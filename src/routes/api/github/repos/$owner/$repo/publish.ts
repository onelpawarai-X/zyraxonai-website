import { createFileRoute } from '@tanstack/react-router';
import { buildContext } from '@/lib/api/context.server';
import { badRequest, readJson } from '@/lib/api/http.server';
import { githubRequest, requireGitHubToken } from '@/lib/github-connection.server';

type Repo = { full_name: string; default_branch: string; owner: { login: string } };
type Ref = { object: { sha: string } };
type Commit = { sha: string };
type Blob = { sha: string };
type Tree = { sha: string };

type PublishFile = { path: string; content: string; encoding?: 'utf-8' | 'base64' };

function validatePath(path: string): string {
  const normalized = path.trim().replace(/^\/+/, '');
  if (!normalized || normalized.includes('..') || normalized.startsWith('.git/')) throw badRequest(`Invalid file path: ${path}`);
  return normalized;
}

export const Route = createFileRoute('/api/github/repos/$owner/$repo/publish')({
  server: {
    handlers: {
      POST: async ({ request, params }) => {
        try {
          const ctx = await buildContext(request, new URL(request.url), params as Record<string, string>);
          const connection = await requireGitHubToken(ctx);
          const owner = params.owner;
          const repoName = params.repo;
          if (owner.toLowerCase() !== connection.githubLogin.toLowerCase()) {
            throw badRequest('Publishing is limited to repositories owned by the connected GitHub account');
          }

          const body = await readJson<{ files?: PublishFile[]; message?: string; branch?: string }>(request);
          const files = body.files ?? [];
          if (!files.length) throw badRequest('At least one file is required');
          if (files.length > 500) throw badRequest('Maximum 500 files per publish');

          const repo = await githubRequest<Repo>(`/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repoName)}`, connection.token);
          const branch = body.branch?.trim() || repo.default_branch;
          const ref = await githubRequest<Ref>(`/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repoName)}/git/ref/heads/${encodeURIComponent(branch)}`, connection.token);
          const parentSha = ref.object.sha;
          const parentCommit = await githubRequest<{ tree: { sha: string } }>(`/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repoName)}/git/commits/${parentSha}`, connection.token);

          const blobs = await Promise.all(files.map(async (file) => {
            const content = typeof file.content === 'string' ? file.content : '';
            const blob = await githubRequest<Blob>(`/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repoName)}/git/blobs`, connection.token, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ content, encoding: file.encoding ?? 'utf-8' }),
            });
            return { path: validatePath(file.path), mode: '100644', type: 'blob', sha: blob.sha };
          }));

          const tree = await githubRequest<Tree>(`/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repoName)}/git/trees`, connection.token, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ base_tree: parentCommit.tree.sha, tree: blobs }),
          });

          const commit = await githubRequest<Commit>(`/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repoName)}/git/commits`, connection.token, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              message: body.message?.trim() || 'Publish project from ZYRAXON AI',
              tree: tree.sha,
              parents: [parentSha],
            }),
          });

          await githubRequest(`/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repoName)}/git/refs/heads/${encodeURIComponent(branch)}`, connection.token, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ sha: commit.sha, force: false }),
          });

          return Response.json({
            success: true,
            repository: repo.full_name,
            branch,
            commit: commit.sha,
            files: blobs.map((file) => file.path),
          });
        } catch (error) {
          const status = error && typeof error === 'object' && 'status' in error ? Number((error as { status?: number }).status) : 500;
          return Response.json({ error: { message: error instanceof Error ? error.message : 'GitHub publish failed' } }, { status });
        }
      },
    },
  },
});
