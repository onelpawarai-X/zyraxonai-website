import { createFileRoute } from '@tanstack/react-router';
import { buildContext } from '@/lib/api/context.server';
import { githubCallback } from '@/lib/api/auth.server';

export const Route = createFileRoute('/api/public/auth/github/callback')({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url);
        const ctx = await buildContext(request, url, {});
        return githubCallback(ctx);
      },
      OPTIONS: async () => new Response(null, { status: 204 }),
    },
  },
});
