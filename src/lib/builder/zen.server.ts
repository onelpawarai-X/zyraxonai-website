/**
 * ZYRAXON -> OpenCode Zen integration.
 * UI aliases are stable; upstream IDs follow the current official Zen docs.
 */

export const ZEN_BASE = 'https://opencode.ai/zen/v1';
export const ZEN_CHAT_URL = `${ZEN_BASE}/chat/completions`;
export const ZEN_MODELS_URL = `${ZEN_BASE}/models`;

export type ZenModel = {
  id: string;
  label: string;
  blurb: string;
  upstream: string;
  free: true;
  contextWindowTokens: number;
  maxOutputTokens: number;
  multimodal?: boolean;
};

/** Current free models listed by OpenCode Zen. */
export const ZEN_FREE_MODELS: ZenModel[] = [
  { id: 'zyraxon-titan', label: 'ZYRAXON TITAN', blurb: 'DeepSeek V4 Flash Free · fast coding', upstream: 'deepseek-v4-flash-free', free: true, contextWindowTokens: 200_000, maxOutputTokens: 16_000 },
  { id: 'zyraxon-nova', label: 'ZYRAXON NOVA', blurb: 'MiMo V2.5 Free · multimodal builder', upstream: 'mimo-v2.5-free', free: true, contextWindowTokens: 1_000_000, maxOutputTokens: 32_768, multimodal: true },
  { id: 'zyraxon-vector', label: 'ZYRAXON VECTOR', blurb: 'Big Pickle · autonomous coding', upstream: 'big-pickle', free: true, contextWindowTokens: 200_000, maxOutputTokens: 32_768 },
  { id: 'zyraxon-hydra', label: 'ZYRAXON HYDRA', blurb: 'Hy3 Free · general coding', upstream: 'hy3-free', free: true, contextWindowTokens: 200_000, maxOutputTokens: 16_000 },
  { id: 'zyraxon-lumen', label: 'ZYRAXON LUMEN', blurb: 'Laguna S 2.1 Free · balanced builder', upstream: 'laguna-s-2.1-free', free: true, contextWindowTokens: 200_000, maxOutputTokens: 16_000 },
  { id: 'zyraxon-pulse', label: 'ZYRAXON PULSE', blurb: 'Ling 3.0 Tiny Free · rapid responses', upstream: 'ling-3.0-tiny-free', free: true, contextWindowTokens: 200_000, maxOutputTokens: 16_000 },
  { id: 'zyraxon-phantom', label: 'ZYRAXON PHANTOM', blurb: 'Nemotron 3 Ultra Free · deep reasoning', upstream: 'nemotron-3-ultra-free', free: true, contextWindowTokens: 200_000, maxOutputTokens: 32_768 },
  { id: 'zyraxon-voltage', label: 'ZYRAXON VOLTAGE', blurb: 'Nemotron 3.5 Lightning Free · fast reasoning', upstream: 'nemotron-3.5-lightning-free', free: true, contextWindowTokens: 200_000, maxOutputTokens: 32_768 },
];

export const DEFAULT_ZEN_MODEL = ZEN_FREE_MODELS[0]!.id;

export const BUILDER_SYSTEM_PROMPT = `You are ZYRAXON AI, an autonomous production-grade web builder.
Build complete working projects, not mockups. Preserve existing project behavior unless the user asks to change it. Inspect project context, implement required files and interactions, keep responsive/polished UI intact, and verify cross-file references before completion. Never expose credentials or hidden reasoning. For substantial work maintain an honest TODO plan and perform final preview verification.`;

export type ContentPart =
  | { type: 'text'; text: string }
  | { type: 'image_url'; image_url: { url: string } }
  | { type: 'input_audio'; input_audio: { data: string } }
  | { type: 'video_url'; video_url: { url: string }; fps?: number };

export type ChatMessage = { role: 'system' | 'user' | 'assistant'; content: string | ContentPart[] };
export type BuilderAttachment = { name: string; mime: string; data: string };

function configuredServerKey() {
  if (typeof process === 'undefined') return undefined;
  return process.env.OPENCODE_ZEN_API_KEY?.trim() || process.env.OPENCODE_API_KEY?.trim() || undefined;
}

export function resolveApiKey(userKey?: string) {
  return userKey?.trim() || configuredServerKey();
}

function headers(apiKey: string, stream = false): Record<string, string> {
  return {
    'Content-Type': 'application/json',
    Accept: stream ? 'text/event-stream' : 'application/json',
    Authorization: `Bearer ${apiKey}`,
  };
}

function contentText(content: string | ContentPart[]) {
  return typeof content === 'string' ? content : content.filter((p): p is { type: 'text'; text: string } => p.type === 'text').map(p => p.text).join('\n');
}

export function resolveZenModel(model: string) {
  return ZEN_FREE_MODELS.find(candidate => candidate.id === model || candidate.upstream === model);
}

function selectedModel(model: string) {
  return resolveZenModel(model) || ZEN_FREE_MODELS[0]!;
}

function withSystem(messages: ChatMessage[]) {
  const lastUser = [...messages].reverse().find(m => m.role === 'user');
  const excerpt = lastUser ? contentText(lastUser.content).slice(0, 6000) : '';
  return `${BUILDER_SYSTEM_PROMPT}\n\nCURRENT REQUEST:\n${excerpt}`;
}

function attachMedia(messages: ChatMessage[], attachments: BuilderAttachment[], model: ZenModel) {
  if (!attachments.length) return messages;
  const next = [...messages];
  const index = [...next].reverse().findIndex(m => m.role === 'user');
  if (index < 0) return next;
  const target = next.length - 1 - index;
  const base = contentText(next[target]!.content);
  if (!model.multimodal) {
    next[target] = { role: 'user', content: `${base}\n\nAttached media: ${attachments.map(a => `${a.name} (${a.mime})`).join(', ')}. The selected model is text-only; do not invent observations about the files.` };
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

async function requestModel(model: ZenModel, messages: ChatMessage[], apiKey: string, attachments: BuilderAttachment[] = [], stream = true) {
  const input = attachMedia(messages.slice(-32), attachments, model);
  return fetch(ZEN_CHAT_URL, {
    method: 'POST',
    headers: headers(apiKey, stream),
    body: JSON.stringify({
      model: model.upstream,
      stream,
      max_tokens: model.maxOutputTokens,
      temperature: 0.2,
      messages: [{ role: 'system', content: withSystem(input) }, ...input],
    }),
  });
}

function errorResponse(model: ZenModel, failures: Array<{ model: string; upstream: string; status: number; detail: string; retryAfter?: string | null }>) {
  const status = failures[failures.length - 1]?.status || 502;
  const retryAfter = failures.find(f => f.retryAfter)?.retryAfter;
  let error = 'OpenCode request failed.';
  if (status === 401 || status === 403) error = 'OpenCode Zen requires a valid API key. Add your OpenCode Zen key in the builder or configure OPENCODE_ZEN_API_KEY on the server.';
  else if (status === 429) error = 'The selected OpenCode free model is temporarily rate-limited. Try another free model or use an OpenCode Zen API key with available capacity.';
  else if (status === 410) error = 'The configured OpenCode route is retired.';
  return Response.json({
    error,
    detail: JSON.stringify({ tried: failures }),
    provider: 'opencode-zen', model: model.id, upstream: model.upstream, endpoint: ZEN_CHAT_URL,
  }, { status: status >= 400 && status < 600 ? status : 502, headers: { 'Access-Control-Allow-Origin': '*', ...(retryAfter ? { 'Retry-After': retryAfter } : {}) } });
}

export async function zenChatStream(model: string, messages: ChatMessage[], apiKey?: string, attachments: BuilderAttachment[] = []) {
  const key = resolveApiKey(apiKey);
  const requested = selectedModel(model);
  if (!key) {
    return Response.json({
      error: 'OpenCode Zen API key required.',
      detail: 'Current OpenCode Zen documentation requires authentication for Zen API requests. Add your key in the ZYRAXON API-key control or configure OPENCODE_ZEN_API_KEY on the server.',
      provider: 'opencode-zen', model: requested.id, upstream: requested.upstream, endpoint: ZEN_CHAT_URL,
    }, { status: 401, headers: { 'Access-Control-Allow-Origin': '*' } });
  }

  const order = [requested, ...ZEN_FREE_MODELS.filter(m => m.id !== requested.id)];
  const failures: Array<{ model: string; upstream: string; status: number; detail: string; retryAfter?: string | null }> = [];

  for (const candidate of order) {
    let response: Response;
    try {
      response = await requestModel(candidate, messages, key, attachments, true);
    } catch (error) {
      failures.push({ model: candidate.id, upstream: candidate.upstream, status: 0, detail: error instanceof Error ? error.message : 'connection failed' });
      continue;
    }

    if (response.ok && response.body) {
      return new Response(response.body, { headers: {
        'Content-Type': 'text/event-stream; charset=utf-8', 'Cache-Control': 'no-cache, no-transform',
        Connection: 'keep-alive', 'X-Accel-Buffering': 'no', 'Access-Control-Allow-Origin': '*',
        'X-ZYRAXON-Model': candidate.id, 'X-ZYRAXON-Upstream': candidate.upstream,
      }});
    }

    const detail = (await response.text().catch(() => '')).slice(0, 1200);
    failures.push({ model: candidate.id, upstream: candidate.upstream, status: response.status, detail, retryAfter: response.headers.get('retry-after') });

    // A shared rate limit should not cause a pointless burst across every free model.
    if (response.status === 401 || response.status === 403 || response.status === 429) break;
  }

  return errorResponse(requested, failures);
}

export async function testZenModel(model: string, apiKey?: string) {
  const selected = selectedModel(model);
  const key = resolveApiKey(apiKey);
  if (!key) return { ok: false, status: 401, model: selected.id, upstream: selected.upstream, detail: 'API key required' };
  try {
    const response = await requestModel(selected, [{ role: 'user', content: 'Reply with OK.' }], key, [], false);
    const detail = (await response.text().catch(() => '')).slice(0, 1200);
    return { ok: response.ok, status: response.status, model: selected.id, upstream: selected.upstream, detail, retryAfter: response.headers.get('retry-after') };
  } catch (error) {
    return { ok: false, status: 0, model: selected.id, upstream: selected.upstream, detail: error instanceof Error ? error.message : 'connection failed' };
  }
}

export async function discoverConsoleModels(apiKey?: string) {
  const key = resolveApiKey(apiKey);
  if (!key) return { ok: false, status: 401, ids: [], detail: 'API key required' };
  try {
    const response = await fetch(ZEN_MODELS_URL, { headers: headers(key) });
    const data = await response.json().catch(() => null);
    const ids = Array.isArray(data?.data) ? data.data.map((item: any) => String(item?.id || '')).filter(Boolean) : [];
    return { ok: response.ok, status: response.status, ids };
  } catch (error) {
    return { ok: false, status: 0, ids: [], detail: error instanceof Error ? error.message : 'model discovery failed' };
  }
}
