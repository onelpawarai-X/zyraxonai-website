import { createFileRoute } from '@tanstack/react-router';
import { buildContext } from '@/lib/api/context.server';
import { badRequest } from '@/lib/api/http.server';

const CORS = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'content-type, authorization', 'Access-Control-Allow-Methods': 'GET,POST,OPTIONS' };

function slugify(value: string) {
  return value.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 70) || `site-${Date.now()}`;
}

export const Route = createFileRoute('/api/public/builder/sites')({
  server: { handlers: {
    OPTIONS: async () => new Response(null, { status: 204, headers: CORS }),
    GET: async ({ request }) => {
      try {
        const ctx = await buildContext(request, new URL(request.url), {});
        const limit = Math.min(40, Math.max(1, Number(new URL(request.url).searchParams.get('limit') || 20)));
        const { data, error } = await ctx.db.from('builder_sites').select('id,user_id,title,slug,description,preview_html,is_public,repo_url,pages_url,created_at,updated_at').eq('is_public', true).order('updated_at', { ascending: false }).limit(limit);
        if (error) throw error;
        return Response.json({ ok: true, sites: data || [] }, { headers: CORS });
      } catch (e: any) { return Response.json({ ok: false, error: e?.message || 'Could not load sites' }, { status: 500, headers: CORS }); }
    },
    POST: async ({ request }) => {
      try {
        const ctx = await buildContext(request, new URL(request.url), {});
        const userId = ctx.requireUser();
        const body: any = await request.json();
        const title = String(body?.title || 'Untitled website').trim().slice(0, 160);
        const description = String(body?.description || '').trim().slice(0, 600);
        const files = body?.files && typeof body.files === 'object' ? body.files : {};
        const previewHtml = String(body?.preview_html || '').slice(0, 8_000_000);
        const size = JSON.stringify(files).length;
        if (size > 12_000_000) throw badRequest('Project source is too large for database storage; large assets belong in Storage.');
        const slug = slugify(`${title}-${String(body?.slug || '')}`);
        const { data, error } = await ctx.db.from('builder_sites').upsert({ user_id: userId, title, slug, description, files, preview_html: previewHtml, is_public: body?.is_public !== false, repo_url: body?.repo_url || null, pages_url: body?.pages_url || null }, { onConflict: 'user_id,slug' }).select('*').single();
        if (error) throw error;
        return Response.json({ ok: true, site: data }, { headers: CORS });
      } catch (e: any) { return Response.json({ ok: false, error: e?.message || 'Could not save site' }, { status: Number(e?.status || 500), headers: CORS }); }
    },
  } },
});
