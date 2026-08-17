import { createFileRoute } from '@tanstack/react-router';
import { BUILDER_SYSTEM_PROMPT, DEFAULT_ZEN_MODEL, ZEN_FREE_MODELS, resolveZenModel, testZenModel, type BuilderAttachment, type ChatMessage, type ContentPart } from '@/lib/builder/zen.server';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'content-type',
  'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
};

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

function gatewayKey() {
  // Never ship a provider key to the browser. Configure this as a deployment
  // secret. The aliases make migration from older deployments painless.
  return process.env.OPENCODE_ZEN_API_KEY?.trim()
    || process.env.OPENCODE_API_KEY?.trim()
    || process.env.ZEN_API_KEY?.trim()
    || '';
}

function providerError(status: number, model: string, detail: string) {
  let error = `ZYRAXON model gateway error ${status}`;
  if (status === 401) error = 'The ZYRAXON model gateway needs a valid OpenCode Zen API key.';
  if (status === 403) error = 'The ZYRAXON model gateway rejected the configured credentials.';
  if (status === 410) error = 'The previous model gateway endpoint was retired. ZYRAXON now uses the current OpenCode Zen route.';
  if (status === 429) error = 'The configured model gateway quota is exhausted. ZYRAXON will not loop-retry a rate-limited request.';
  if (status >= 500) error = 'The model gateway is temporarily unavailable. Try another model.';
  return new Response(JSON.stringify({ error, detail, provider: 'zyraxon', model }), { status: status >= 400 && status < 600 ? status : 502, headers: { 'Content-Type': 'application/json', ...CORS } });
}

function maxOutputFor(model: string) {
  // Current OpenCode-served limits; do not send the upstream model's larger
  // theoretical output budget to the gateway.
  if (model === 'zyraxon-t10' || model === 'zyraxon-vector') return 32_768;
  if (model === 'zyraxon-phantom') return 131_072;
  return 32_768;
}

async function currentZenStream(modelId: string, messages: ChatMessage[], attachments: BuilderAttachment[], apiKey: string) {
  const selected = resolveZenModel(modelId) || ZEN_FREE_MODELS[0]!;
  const inputMessages = attachMedia(messages.slice(-32), attachments, !!selected.multimodal);
  const lastUser = [...inputMessages].reverse().find(message => message.role === 'user');
  const excerpt = lastUser ? textFromContent(lastUser.content) : '';
  const system = `${BUILDER_SYSTEM_PROMPT}\n\nPER-TURN EXECUTION DIRECTIVE\n- Apply the builder contract to the current request now.\n- Current request excerpt (context only): ${excerpt.slice(0, 8000)}\n- Treat unfinished TODO items from previous turns as active work unless explicitly cancelled.\n- Continue all independent work before asking a question.\n- Stream implementation continuously when possible.`;
  return fetch(`${ZEN_BASE}/chat/completions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'text/event-stream', ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {}) },
    body: JSON.stringify({ model: selected.upstream, stream: true, max_tokens: maxOutputFor(selected.id), temperature: 0.2, messages: [{ role: 'system', content: system }, ...inputMessages] }),
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
          const result = await testZenModel(healthModel, gatewayKey() || undefined);
          return Response.json({ ...result, provider: 'opencode-zen', authenticated: !!gatewayKey(), model: healthModel }, { status: result.ok ? 200 : 502, headers: CORS });
        }
        return Response.json({ models: ZEN_FREE_MODELS, provider: 'opencode-zen', authenticated: !!gatewayKey(), freeWithoutKey: true }, { headers: CORS });
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
          const key = gatewayKey();
          const upstream = await currentZenStream(selected.id, clean, attachments, key);
          if (!upstream.ok || !upstream.body) {
            const detail = (await upstream.text().catch(() => '')).slice(0, 1600);
            return providerError(upstream.status || 502, selected.id, detail);
          }
          return new Response(upstream.body, { headers: { 'Content-Type': 'text/event-stream; charset=utf-8', 'Cache-Control': 'no-cache, no-transform', Connection: 'keep-alive', 'X-Accel-Buffering': 'no', ...CORS, 'X-ZYRAXON-Model': selected.id, 'X-ZYRAXON-Upstream': selected.upstream, 'X-ZYRAXON-Authenticated': key ? 'true' : 'false', 'X-ZYRAXON-Max-Output-Tokens': String(maxOutputFor(selected.id)) } });
        } catch (error) {
          return providerError(502, selected.id, error instanceof Error ? error.message : 'Provider connection failed');
        }
      },
    },
  },
});
