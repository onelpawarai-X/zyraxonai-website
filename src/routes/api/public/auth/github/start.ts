import { createFileRoute } from '@tanstack/react-router';

// Public client identifier for the production ZYRAXON OAuth application.
// The secret remains server-side in GITHUB_CLIENT_SECRET.
const CLIENT_ID = 'Ov23liDGlT46vtrvOSqo';
const STATE_COOKIE = 'zyraxon_github_oauth_state';
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
        const state = randomState();
        const authorize = new URL('https://github.com/login/oauth/authorize');
        authorize.searchParams.set('client_id', CLIENT_ID);
        // Deliberately omit redirect_uri. GitHub then uses the single callback
        // registered on this OAuth application, eliminating origin/preview URL
        // drift and the redirect_uri mismatch that previously broke sign-in.
        authorize.searchParams.set('scope', 'repo user:email');
        authorize.searchParams.set('state', state);

        return new Response(null, {
          status: 302,
          headers: {
            Location: authorize.toString(),
            'Cache-Control': 'no-store',
            'Set-Cookie': `${STATE_COOKIE}=${encodeURIComponent(state)}; Path=/; Max-Age=600; HttpOnly; Secure; SameSite=Lax`,
          },
        });
      },
      OPTIONS: async () => new Response(null, { status: 204 }),
    },
  },
});
