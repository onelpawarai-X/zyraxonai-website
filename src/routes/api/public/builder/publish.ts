import { createFileRoute } from '@tanstack/react-router';
import { buildContext } from '@/lib/api/context.server';
import { publishConnectedSite } from '@/lib/builder/github-connected-publish.server';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'content-type, authorization',
  'Access-Control-Allow-Methods': 'POST,OPTIONS',
};

export const Route = createFileRoute('/api/public/builder/publish')({
  server: {
    handlers: {
      OPTIONS: async () => new Response(null, { status: 204, headers: CORS }),
      POST: async ({ request }) => {
        try {
          const body: any = await request.json();
          const ctx = await buildContext(request, new URL(request.url), {});
          const result = await publishConnectedSite(ctx, {
            repo: String(body?.repo || ''),
            files: body?.files && typeof body.files === 'object' ? body.files : { 'index.html': String(body?.html || '') },
            description: body?.description ? String(body.description) : undefined,
            privateRepo: Boolean(body?.privateRepo),
          });
          return Response.json(result, { status: 200, headers: CORS });
        } catch (error: any) {
          const status = Number(error?.status || 500);
          return Response.json({ ok: false, error: error?.message || 'Publish failed', code: error?.code }, { status, headers: CORS });
        }
      },
    },
  },
});
