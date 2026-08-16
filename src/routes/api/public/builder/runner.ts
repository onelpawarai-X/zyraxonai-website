import { createFileRoute } from '@tanstack/react-router';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, content-type, x-runner-session',
  'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
};

function runnerConfig() {
  const url = process.env.ZYRAXON_RUNNER_URL?.trim();
  const secret = process.env.ZYRAXON_RUNNER_SECRET?.trim();
  return { url: url?.replace(/\/$/, ''), secret };
}

async function authenticated(request: Request) {
  const authorization = request.headers.get('authorization') || '';
  if (!authorization.startsWith('Bearer ')) return false;
  const { supabaseAdmin } = await import('@/integrations/supabase/client.server');
  const token = authorization.slice(7).trim();
  const { data } = await supabaseAdmin.auth.getUser(token);
  return Boolean(data.user);
}

export const Route = createFileRoute('/api/public/builder/runner')({
  server: {
    handlers: {
      OPTIONS: async () => new Response(null, { status: 204, headers: CORS }),
      GET: async ({ request }) => {
        if (!(await authenticated(request))) return Response.json({ error: 'Authentication required' }, { status: 401, headers: CORS });
        const { url, secret } = runnerConfig();
        if (!url) return Response.json({ configured: false, error: 'ZYRAXON_RUNNER_URL is not configured' }, { status: 503, headers: CORS });
        const response = await fetch(`${url}/health`, { headers: secret ? { authorization: `Bearer ${secret}` } : undefined });
        const data = await response.json().catch(() => ({}));
        return Response.json({ configured: true, ...data }, { status: response.status, headers: CORS });
      },
      POST: async ({ request }) => {
        if (!(await authenticated(request))) return Response.json({ error: 'Authentication required' }, { status: 401, headers: CORS });
        const { url, secret } = runnerConfig();
        if (!url) return Response.json({ configured: false, error: 'ZYRAXON_RUNNER_URL is not configured' }, { status: 503, headers: CORS });
        let body: unknown;
        try { body = await request.json(); } catch { return Response.json({ error: 'Invalid JSON body' }, { status: 400, headers: CORS }); }
        const response = await fetch(`${url}/execute`, {
          method: 'POST',
          headers: {
            'content-type': 'application/json',
            ...(secret ? { authorization: `Bearer ${secret}` } : {}),
          },
          body: JSON.stringify(body),
        });
        const data = await response.json().catch(() => ({ error: 'Runner returned invalid JSON' }));
        return Response.json(data, { status: response.status, headers: CORS });
      },
    },
  },
});
