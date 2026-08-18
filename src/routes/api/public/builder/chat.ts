import { createFileRoute } from '@tanstack/react-router';
import { BUILDER_SYSTEM_PROMPT, type BuilderAttachment, type ChatMessage, type ContentPart } from '@/lib/builder/zen.server';

const CORS = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'content-type', 'Access-Control-Allow-Methods': 'GET,POST,OPTIONS' };
// Keep one gateway source of truth: the OpenCode Console OpenAI-compatible route used by PR #95.
const GATEWAY = 'https://console.opencode.ai/inference/openai/v1';

// UI aliases are deliberately separate from provider model IDs.
// These are the exact upstream mappings from the known-good PR #95 setup.
const MODELS = [
  { id: 'zyraxon-t10', label: 'ZYRAXON T10', upstream: 'mimo-v2.5-free', maxOutputTokens: 131072, multimodal: true },
  { id: 'zyraxon-vector', label: 'ZYRAXON VECTOR', upstream: 'big-pickle', maxOutputTokens: 32768, multimodal: false },
  { id: 'zyraxon-phantom', label: 'ZYRAXON PHANTOM', upstream: 'nemotron-3-super-free', maxOutputTokens: 131072, multimodal: false },
] as const;

type GatewayModel = (typeof MODELS)[number];
const DEFAULT_MODEL = MODELS[0];

function modelFor(id: string): GatewayModel {
  return MODELS.find(model => model.id === id) || DEFAULT_MODEL;
}

function authHeaders(accept = 'text/event-stream') {
  const key = process.env.OPENCODE_API_KEY?.trim() || process.env.OPENCODE_ZEN_API_KEY?.trim();
  return {
    'Content-Type': 'application/json',
    Accept: accept,
    ...(key ? { Authorization: `Bearer ${key}` } : {}),
  };
}

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

function errorResponse(status: number, model: GatewayModel, detail: string, tried: string[]) {
  let error = `ZYRAXON model gateway error ${status}`;
  if (status === 401) error = 'The OpenCode Console gateway rejected the request.';
  if (status === 403) error = 'The OpenCode Console gateway rejected this request.';
  if (status === 410) error = 'The selected OpenCode Console model endpoint is no longer available.';
  if (status === 429) error = 'The selected free model is rate-limited right now. ZYRAXON tried the other available free models.';
  if (status >= 500) error = 'The OpenCode Console gateway is temporarily unavailable. ZYRAXON tried the other available free models.';
  return new Response(JSON.stringify({ error, detail, provider: 'opencode-console', model: model.id, tried, endpoint: `${GATEWAY}/chat/completions` }), { status: status >= 400 && status < 600 ? status : 502, headers: { 'Content-Type': 'application/json', ...CORS } });
}

async function requestGateway(model: GatewayModel, messages: ChatMessage[], attachments: BuilderAttachment[]) {
  const inputMessages = attachMedia(messages.slice(-32), attachments, model.multimodal);
  const lastUser = [...inputMessages].reverse().find(message => message.role === 'user');
  const excerpt = lastUser ? textFromContent(lastUser.content) : '';
  const system = `${BUILDER_SYSTEM_PROMPT}\n\nPER-TURN EXECUTION DIRECTIVE\n- Apply the builder contract to the current request now.\n- Current request excerpt (context only): ${excerpt.slice(0, 8000)}\n- Treat unfinished TODO items from previous turns as active work unless explicitly cancelled.\n- Continue all independent work before asking a question.\n- Stream implementation continuously when possible.`;
  return fetch(`${GATEWAY}/chat/completions`, {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify({
      model: model.upstream,
      stream: true,
      max_tokens: model.maxOutputTokens,
      temperature: 0.2,
      messages: [{ role: 'system', content: system }, ...inputMessages],
    }),
  });
}

async function checkGateway(model: GatewayModel) {
  const response = await fetch(`${GATEWAY}/chat/completions`, {
    method: 'POST',
    headers: authHeaders('application/json'),
    body: JSON.stringify({ model: model.upstream, stream: false, max_tokens: 8, messages: [{ role: 'system', content: BUILDER_SYSTEM_PROMPT }, { role: 'user', content: 'Reply with OK.' }] }),
  });
  const detail = await response.text().catch(() => '');
  return { ok: response.ok, status: response.status, detail: response.ok ? undefined : detail.slice(0, 600) };
}

export const Route = createFileRoute('/api/public/builder/chat')({
  server: { handlers: {
    OPTIONS: async () => new Response(null, { status: 204, headers: CORS }),
    GET: async ({ request }) => {
      const healthModel = new URL(request.url).searchParams.get('health');
      if (healthModel) {
        try {
          const model = modelFor(healthModel);
          const result = await checkGateway(model);
          return Response.json({ ...result, provider: 'opencode-console', model: model.id, upstream: model.upstream, endpoint: `${GATEWAY}/chat/completions`, freeModels: MODELS.map(({ id, label, upstream }) => ({ id, label, upstream })) }, { status: result.ok ? 200 : 502, headers: CORS });
        } catch (error) {
          return Response.json({ ok: false, status: 502, detail: error instanceof Error ? error.message : 'Gateway connection failed' }, { status: 502, headers: CORS });
        }
      }
      return Response.json({ models: MODELS, provider: 'opencode-console', endpoint: `${GATEWAY}/chat/completions`, userApiKeyRequired: false, serverCredentialConfigured: !!(process.env.OPENCODE_API_KEY || process.env.OPENCODE_ZEN_API_KEY) }, { headers: CORS });
    },
    POST: async ({ request }) => {
      let body: any;
      try { body = await request.json(); } catch { return Response.json({ error: 'Invalid JSON body' }, { status: 400, headers: CORS }); }
      const messages: ChatMessage[] = Array.isArray(body?.messages) ? body.messages.slice(-32) : [];
      if (!messages.length) return Response.json({ error: 'messages required' }, { status: 400, headers: CORS });
      const requested = typeof body?.model === 'string' ? body.model : DEFAULT_MODEL.id;
      const requestedModel = modelFor(requested);
      const candidates = [requestedModel, ...MODELS.filter(model => model.id !== requestedModel.id)];
      const clean: ChatMessage[] = messages
        .filter(message => message && typeof message.content === 'string' && (message.role === 'user' || message.role === 'assistant'))
        .map(message => ({ role: message.role, content: String(message.content).slice(0, 60000) }));
      const attachments: BuilderAttachment[] = (Array.isArray(body?.attachments) ? body.attachments : [])
        .filter((attachment: any) => attachment && typeof attachment.name === 'string' && typeof attachment.mime === 'string' && typeof attachment.data === 'string')
        .filter((attachment: any) => /^(image|audio|video)\//i.test(attachment.mime))
        .slice(0, 6)
        .map((attachment: any) => ({ name: attachment.name.slice(0, 160), mime: attachment.mime.slice(0, 100), data: attachment.data }));

      const tried: string[] = [];
      let lastStatus = 502;
      let lastDetail = 'Provider connection failed';
      for (const candidate of candidates) {
        tried.push(candidate.id);
        try {
          const upstream = await requestGateway(candidate, clean, attachments);
          if (upstream.ok && upstream.body) {
            return new Response(upstream.body, { headers: { 'Content-Type': 'text/event-stream; charset=utf-8', 'Cache-Control': 'no-cache, no-transform', Connection: 'keep-alive', 'X-Accel-Buffering': 'no', ...CORS, 'X-ZYRAXON-Model': candidate.id, 'X-ZYRAXON-Upstream': candidate.upstream, 'X-ZYRAXON-Gateway': GATEWAY } });
          }
          lastStatus = upstream.status || 502;
          lastDetail = (await upstream.text().catch(() => '')).slice(0, 1200) || lastDetail;
          if (lastStatus !== 429 && lastStatus !== 502 && lastStatus !== 503) break;
        } catch (error) {
          lastStatus = 502;
          lastDetail = error instanceof Error ? error.message : lastDetail;
        }
      }
      return errorResponse(lastStatus, requestedModel, lastDetail, tried);
    },
  } },
});
