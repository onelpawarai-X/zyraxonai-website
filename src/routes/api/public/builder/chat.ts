import { createFileRoute } from '@tanstack/react-router';
import { BUILDER_SYSTEM_PROMPT, DEFAULT_ZEN_MODEL, ZEN_FREE_MODELS, resolveZenModel, testZenModel, type BuilderAttachment, type ChatMessage, type ContentPart } from '@/lib/builder/zen.server';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'content-type',
  'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
};

// Current OpenCode Zen route. The older Console inference route can return 410
// after endpoint retirement, which was the source of the ZYRAXON gateway error.
const ZEN_BASE = 'https://opencode.ai/zen/v1';

function textFromContent(content: string | ContentPart[]) {
  if (typeof content === 'string') return content;
  return content.filter((part): part is { type: 'text'; text: string } => part.type === 'text').map(part => part.text).join('\n');
}

function attachMedia(messages: ChatMessage[], attachments: BuilderAttachment[], multimodal: boolean): ChatMessage[] {
  if (!attachments.length) return messages;
  const next = [...messages];
  const reverseIndex = [...next].reverse().findIndex(message => message.role === 'user');
  if (reverseIndex < 0) return next;
  const target = next.length - 1 - reverseIndex;
  const base = textFromContent(next[target]!.content);
  if (!multimodal) {
    next[target] = { role: 'user', content: `${base}\n\nThe user attached media (${attachments.map(a => `${a.name} — ${a.mime}`).join(', ')}), but the selected model is text-only. Do not invent observations about the media.` };
    return next;
  }
  const parts: ContentPart[] = [{ type: 'text', text: base }];
  for (const file of attachments) {
    if (file.mime.startsWith('image/')) parts.push({ type: 'image_url', image_url: { url: file.data } });
    else if (file.mime.startsWith('audio/')) parts.push({ type: 'input_audio', input_audio: { data: file.data } });
    else if (file.mime.startsWith('video/')) parts.push({ type: 'video_url', video_url: { url: file.data }, fps: 1 });
  }
  next[target] = { role: 'user', content: parts };
  return next;
}

function providerError(status: number, model: string, detail: string) {
  let error = `ZYRAXON model gateway error ${status}`;
  if (status === 401) error = 'This model requires a valid provider key.';
  if (status === 403) error = 'The model gateway rejected this request.';
  if (status === 410) error = 'The previous model gateway endpoint was retired. ZYRAXON now uses the current OpenCode Zen route.';
  if (status === 429) error = 'Model gateway rate limit reached. Try another model or retry shortly.';
  if (status >= 500) error = 'The model gateway is temporarily unavailable. Try another model.';
  return new Response(JSON.stringify({ error, detail, provider: 'zyraxon', model }), { status: status >= 400 && status < 600 ? status : 502, headers: { 'Content-Type': 'application/json', ...CORS } });
}

async function currentZenStream(modelId: string, messages: ChatMessage[], attachments: BuilderAttachment[]) {
  const selected = resolveZenModel(modelId) || ZEN_FREE_MODELS[0]!;
  const inputMessages = attachMedia(messages.slice(-32), attachments, !!selected.multimodal);
  const lastUser = [...inputMessages].reverse().find(message => message.role === 'user');
  const excerpt = lastUser ? textFromContent(lastUser.content) : '';
  const system = `${BUILDER_SYSTEM_PROMPT}\n\nPER-TURN EXECUTION DIRECTIVE\n- Apply the builder contract to the current request now.\n- Current request excerpt (context only): ${excerpt.slice(0, 8000)}\n- Treat unfinished TODO items from previous turns as active work unless explicitly cancelled.\n- Continue all independent work before asking a question.\n- Stream implementation continuously when possible.`;
  return fetch(`${ZEN_BASE}/chat/completions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'text/event-stream' },
    body: JSON.stringify({ model: selected.upstream, stream: true, max_tokens: selected.maxOutputTokens, temperature: 0.2, messages: [{ role: 'system', content: system }, ...inputMessages] }),
  });
}

export const Route = createFileRoute('/api/public/builder/chat')({
  server: {
    handlers: {
      OPTIONS: async () => new Response(null, { status: 204, headers: CORS }),
      GET: async ({ request }) => {
        const url = new URL(request.url);
        const healthModel = url.searchParams.get('health');
        if (healthModel) {
          const apiKey = url.searchParams.get('apiKey')?.trim() || undefined;
          const result = await testZenModel(healthModel, apiKey);
          return Response.json({ ...result, provider: 'opencode-zen', model: healthModel }, { status: result.ok ? 200 : 502, headers: CORS });
        }
        return Response.json({ models: ZEN_FREE_MODELS, provider: 'opencode-zen', freeWithoutKey: true }, { headers: CORS });
      },
      POST: async ({ request }) => {
        let body: any;
        try { body = await request.json(); } catch { return Response.json({ error: 'Invalid JSON body' }, { status: 400, headers: CORS }); }
        const messages: ChatMessage[] = Array.isArray(body?.messages) ? body.messages.slice(-32) : [];
        if (!messages.length) return Response.json({ error: 'messages required' }, { status: 400, headers: CORS });

        const requested = typeof body?.model === 'string' ? body.model : DEFAULT_ZEN_MODEL;
        const selected = resolveZenModel(requested) || ZEN_FREE_MODELS[0]!;
        const clean: ChatMessage[] = messages
          .filter((m) => m && typeof m.content === 'string' && (m.role === 'user' || m.role === 'assistant'))
          .map((m) => ({ role: m.role, content: String(m.content).slice(0, 60000) }));

        const rawAttachments = Array.isArray(body?.attachments) ? body.attachments : [];
        const attachments: BuilderAttachment[] = rawAttachments
          .filter((a: any) => a && typeof a.name === 'string' && typeof a.mime === 'string' && typeof a.data === 'string')
          .filter((a: any) => /^(image|audio|video)\//i.test(a.mime))
          .slice(0, 6)
          .map((a: any) => ({ name: a.name.slice(0, 160), mime: a.mime.slice(0, 100), data: a.data }));

        try {
          const upstream = await currentZenStream(selected.id, clean, attachments);
          if (!upstream.ok || !upstream.body) return providerError(upstream.status || 502, selected.id, (await upstream.text().catch(() => '')).slice(0, 1200));
          return new Response(upstream.body, { headers: { 'Content-Type': 'text/event-stream; charset=utf-8', 'Cache-Control': 'no-cache, no-transform', Connection: 'keep-alive', 'X-Accel-Buffering': 'no', ...CORS, 'X-ZYRAXON-Model': selected.id, 'X-ZYRAXON-Upstream': selected.upstream } });
        } catch (error) {
          return providerError(502, selected.id, error instanceof Error ? error.message : 'Provider connection failed');
        }
      },
    },
  },
});
