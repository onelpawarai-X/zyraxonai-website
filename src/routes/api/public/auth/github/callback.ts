import { createFileRoute } from '@tanstack/react-router';
import { buildContext } from '@/lib/api/context.server';
import { githubCallbackRedirect } from '@/lib/api/auth.server';

/**
 * GitHub OAuth callback endpoint.
 * GitHub must redirect to this exact endpoint. It forwards the one-time code
 * to the application origin where the client completes the server exchange.
 */
export const Route = createFileRoute('/api/public/auth/github/callback')({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url);
        const ctx = await buildContext(request, url, {});
        return githubCallbackRedirect(ctx);
      },
      OPTIONS: async () => new Response(null, { status: 204 }),
    },
  },
});
