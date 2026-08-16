import { createFileRoute } from '@tanstack/react-router';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, content-type',
  'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
};

async function getUser(request: Request) {
  const auth = request.headers.get('authorization') || '';
  if (!auth.startsWith('Bearer ')) return null;
  const { supabaseAdmin } = await import('@/integrations/supabase/client.server');
  const { data } = await supabaseAdmin.auth.getUser(auth.slice(7).trim());
  return data.user || null;
}

function runner() {
  return {
    url: process.env.ZYRAXON_RUNNER_URL?.trim()?.replace(/\/$/, ''),
    secret: process.env.ZYRAXON_RUNNER_SECRET?.trim(),
  };
}

const TOOL_BY_TASK = {
  diagnose: 'powershell_version',
  build: 'powershell_build',
  test: 'powershell_test',
  package: 'powershell_package',
};

export const Route = createFileRoute('/api/public/builder/powershell')({
  server: {
    handlers: {
      OPTIONS: async () => new Response(null, { status: 204, headers: CORS }),
      GET: async ({ request }) => {
        const user = await getUser(request);
        if (!user) return Response.json({ error: 'Authentication required' }, { status: 401, headers: CORS });
        const { url, secret } = runner();
        if (!url) return Response.json({ available: false, configured: false, error: 'Sandbox runner is not configured for this deployment.' }, { status: 503, headers: CORS });
        const response = await fetch(`${url}/health`, { headers: secret ? { authorization: `Bearer ${secret}` } : undefined });
        const data = await response.json().catch(() => ({}));
        return Response.json({ available: response.ok, configured: true, runner: data }, { status: response.status, headers: CORS });
      },
      POST: async ({ request }) => {
        const user = await getUser(request);
        if (!user) return Response.json({ error: 'Authentication required' }, { status: 401, headers: CORS });
        const { url, secret } = runner();
        if (!url) return Response.json({ error: 'Sandbox runner is not configured for this deployment.' }, { status: 503, headers: CORS });
        let body: any;
        try { body = await request.json(); } catch { return Response.json({ error: 'Invalid JSON body' }, { status: 400, headers: CORS }); }
        const tool = TOOL_BY_TASK[String(body?.task) as keyof typeof TOOL_BY_TASK];
        if (!tool) return Response.json({ error: 'Unsupported PowerShell task' }, { status: 400, headers: CORS });

        const response = await fetch(`${url}/execute`, {
          method: 'POST',
          headers: { 'content-type': 'application/json', ...(secret ? { authorization: `Bearer ${secret}` } : {}) },
          body: JSON.stringify({ tool, cwd: '.', timeout: 120000 }),
        });
        const data = await response.json().catch(() => ({ error: 'Runner returned invalid JSON' }));
        return Response.json({ ...data, task: body.task, userId: user.id, execution: 'isolated-runner' }, { status: response.status, headers: CORS });
      },
    },
  },
});
