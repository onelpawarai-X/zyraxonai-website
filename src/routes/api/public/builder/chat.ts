import { createFileRoute } from '@tanstack/react-router';
import { BUILDER_SYSTEM_PROMPT, type BuilderAttachment, type ChatMessage, type ContentPart } from '@/lib/builder/zen.server';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'content-type',
  'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
};

// ONE gateway only. The old Console inference route was retired; all three
// branded ZYRAXON aliases now resolve through the current OpenCode Zen route.
const GATEWAY = 'https://opencode.ai/zen/v1';

const MODELS = [
  { id: 'zyraxon-t10', label: 'ZYRAXON T10', upstream: 'mimo-v2.5-free', maxOutputTokens: 32768, multimodal: true },
  { id: 'zyraxon-vector', label: 'ZYRAXON VECTOR', upstream: 'big-pickle', maxOutputTokens: 32768, multimodal: false },
  { id: 'zyraxon-phantom', label: 'ZYRAXON PHANTOM', upstream: 'nemotron-3-ultra-free', maxOutputTokens: 32768, multimodal: false },
] as const;

type GatewayModel = (typeof MODELS)[number];
const DEFAULT_MODEL = MODELS[0];
function modelFor(id: string): GatewayModel { return MODELS.find(model => model.id === id) || DEFAULT_MODEL; }

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

function systemPrompt(messages: ChatMessage[]) {
  const lastUser = [...messages].reverse().find(message => message.role === 'user');
  const excerpt = lastUser ? textFromContent(lastUser.content) : '';
  return `${BUILDER_SYSTEM_PROMPT}\n\nPER-TURN EXECUTION DIRECTIVE\n- Apply the builder contract to the current request now.\n- Current request excerpt (context only): ${excerpt.slice(0, 8000)}\n- Treat unfinished TODO items from previous turns as active work unless explicitly cancelled.\n- Continue all independent work before asking a question.\n- Stream implementation continuously when possible.`;
}

function requestBody(model: GatewayModel, messages: ChatMessage[], attachments: BuilderAttachment[]) {
  const inputMessages = attachMedia(messages.slice(-32), attachments, model.multimodal);
  return { model: model.upstream, stream: true, max_tokens: model.maxOutputTokens, temperature: 0.2, messages: [{ role: 'system', content: systemPrompt(inputMessages) }, ...inputMessages] };
}

async function requestModel(model: GatewayModel, messages: ChatMessage[], attachments: BuilderAttachment[]) {
  return fetch(`${GATEWAY}/chat/completions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'text/event-stream' },
    body: JSON.stringify(requestBody(model, messages, attachments)),
  });
}

function retryable(status: number) { return [408, 409, 429, 500, 502, 503, 504].includes(status); }

function errorResponse(status: number, requested: GatewayModel, detail: string, tried: string[]) {
  let error = 'ZYRAXON could not get a response from the OpenCode model.';
  if (status === 429) error = 'The selected OpenCode free model is temporarily rate-limited.';
  if (status === 401 || status === 403) error = 'The OpenCode gateway rejected the model request.';
  if (status === 404) error = 'The selected OpenCode model is not available on the current gateway.';
  if (status >= 500) error = 'The OpenCode gateway is temporarily unavailable.';
  return new Response(JSON.stringify({ error, detail, provider: 'opencode-zen', model: requested.id, tried, endpoint: `${GATEWAY}/chat/completions` }), { status: status >= 400 && status < 600 ? status : 502, headers: { 'Content-Type': 'application/json', ...CORS } });
}

export const Route = createFileRoute('/api/public/builder/chat')({
  server: { handlers: {
    OPTIONS: async () => new Response(null, { status: 204, headers: CORS }),
    GET: async ({ request }) => {
      const healthModel = new URL(request.url).searchParams.get('health');
      if (healthModel) {
        const model = modelFor(healthModel);
        try {
          const response = await fetch(`${GATEWAY}/chat/completions`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
            body: JSON.stringify({ model: model.upstream, stream: false, max_tokens: 8, messages: [{ role: 'user', content: 'Reply with OK.' }] }),
          });
          const detail = await response.text().catch(() => '');
          return Response.json({ ok: response.ok, status: response.status, model: model.id, upstream: model.upstream, gateway: GATEWAY, userApiKeyRequired: false, detail: response.ok ? undefined : detail.slice(0, 1000) }, { status: response.ok ? 200 : response.status, headers: CORS });
        } catch (error) {
          return Response.json({ ok: false, status: 0, model: model.id, upstream: model.upstream, gateway: GATEWAY, userApiKeyRequired: false, detail: error instanceof Error ? error.message : 'connection failed' }, { status: 502, headers: CORS });
        }
      }
      return Response.json({ models: MODELS, gateway: `${GATEWAY}/chat/completions`, userApiKeyRequired: false }, { headers: CORS });
    },
    POST: async ({ request }) => {
      let body: any;
      try { body = await request.json(); } catch { return Response.json({ error: 'Invalid JSON body' }, { status: 400, headers: CORS }); }
      const messages: ChatMessage[] = Array.isArray(body?.messages) ? body.messages.slice(-32) : [];
      if (!messages.length) return Response.json({ error: 'messages required' }, { status: 400, headers: CORS });
      const requested = modelFor(typeof body?.model === 'string' ? body.model : DEFAULT_MODEL.id);
      const candidates = [requested, ...MODELS.filter(model => model.id !== requested.id)];
      const clean = messages.filter(message => message && typeof message.content === 'string' && (message.role === 'user' || message.role === 'assistant')).map(message => ({ role: message.role, content: String(message.content).slice(0, 60000) }));
      const attachments: BuilderAttachment[] = (Array.isArray(body?.attachments) ? body.attachments : []).filter((a: any) => a && typeof a.name === 'string' && typeof a.mime === 'string' && typeof a.data === 'string').filter((a: any) => /^(image|audio|video)\//i.test(a.mime)).slice(0, 6).map((a: any) => ({ name: a.name.slice(0, 160), mime: a.mime.slice(0, 100), data: a.data }));
      const tried: string[] = [];
      let lastStatus = 502;
      let lastDetail = 'Provider connection failed';
      for (const model of candidates) {
        tried.push(model.id);
        try {
          const upstream = await requestModel(model, clean, attachments);
          if (upstream.ok && upstream.body) return new Response(upstream.body, { headers: { 'Content-Type': 'text/event-stream; charset=utf-8', 'Cache-Control': 'no-cache, no-transform', Connection: 'keep-alive', 'X-Accel-Buffering': 'no', ...CORS, 'X-ZYRAXON-Model': model.id, 'X-ZYRAXON-Upstream': model.upstream, 'X-ZYRAXON-Gateway': 'opencode-zen' } });
          lastStatus = upstream.status || 502;
          lastDetail = (await upstream.text().catch(() => '')).slice(0, 1200) || lastDetail;
          if (!retryable(lastStatus)) break;
        } catch (error) {
          lastStatus = 502;
          lastDetail = error instanceof Error ? error.message : lastDetail;
        }
      }
      return errorResponse(lastStatus, requested, lastDetail, tried);
    },
  } },
});
