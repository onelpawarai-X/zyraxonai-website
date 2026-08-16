import { createFileRoute } from '@tanstack/react-router';

const CALLBACK_PATH = '/api/public/auth/github/callback';
const STATE_COOKIE = 'zyraxon_github_oauth_state';

function randomState() {
  const bytes = new Uint8Array(24);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
}

function cookie(name: string, value: string, maxAge: number) {
  return `${name}=${encodeURIComponent(value)}; Path=/; Max-Age=${maxAge}; HttpOnly; Secure; SameSite=Lax`;
}

export const Route = createFileRoute('/api/public/auth/github/start')({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const clientId = process.env['GITHUB_CLIENT_ID'];
        if (!clientId) return new Response('GitHub OAuth is not configured', { status: 500 });

        // GitHub uses the OAuth App's registered callback when redirect_uri is omitted.
        // This deliberately avoids deriving a callback from the current browser URL.
        const state = randomState();
        const authorize = new URL('https://github.com/login/oauth/authorize');
        authorize.searchParams.set('client_id', clientId);
        authorize.searchParams.set('scope', 'repo user:email');
        authorize.searchParams.set('state', state);

        const headers = new Headers({
          Location: authorize.toString(),
          'Cache-Control': 'no-store',
        });
        headers.set('Set-Cookie', cookie(STATE_COOKIE, state, 600));

        // Keep the canonical callback documented in source without sending it as a
        // request parameter; GitHub will use the callback configured on the OAuth App.
        void CALLBACK_PATH;

        return new Response(null, { status: 302, headers });
      },
      OPTIONS: async () => new Response(null, { status: 204 }),
    },
  },
});
