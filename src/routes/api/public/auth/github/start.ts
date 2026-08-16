import { createFileRoute } from '@tanstack/react-router';

const CLIENT_ID = process.env['GITHUB_CLIENT_ID'] ?? 'Ov23liDGlT46vtrvOSqo';
const CALLBACK_PATH = '/api/public/auth/github/callback';

function randomState() {
  const bytes = new Uint8Array(24);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
}

export const Route = createFileRoute('/api/public/auth/github/start')({
  server: {
    handlers: {
      GET: async ({ request }) => {
        if (!CLIENT_ID) {
          return new Response('GitHub OAuth is not configured', { status: 500 });
        }

        const url = new URL(request.url);
        const origin = url.origin;
        const redirectUri = `${origin}${CALLBACK_PATH}`;
        const state = randomState();
        const authorize = new URL('https://github.com/login/oauth/authorize');
        authorize.searchParams.set('client_id', CLIENT_ID);
        authorize.searchParams.set('redirect_uri', redirectUri);
        authorize.searchParams.set('scope', 'repo user:email');
        authorize.searchParams.set('state', state);

        return new Response(null, {
          status: 302,
          headers: {
            Location: authorize.toString(),
            'Cache-Control': 'no-store',
            'Set-Cookie': `zyraxon_github_oauth_state=${state}; Path=/; Max-Age=600; HttpOnly; Secure; SameSite=Lax`,
          },
        });
      },
      OPTIONS: async () => new Response(null, { status: 204 }),
    },
  },
});
