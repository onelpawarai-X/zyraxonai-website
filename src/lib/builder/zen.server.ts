/**
 * ZYRAXON provider integration.
 * UI aliases stay stable while every request uses an official current
 * OpenCode Zen model ID. No private/guessed fallback model IDs live here.
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

/**
 * Public ZYRAXON names are aliases only. The upstream IDs are the current
 * OpenCode Zen free model IDs documented by OpenCode.
 */
export const ZEN_FREE_MODELS: ZenModel[] = [
  { id: 'zyraxon-titan', label: 'ZYRAXON TITAN', blurb: 'DeepSeek V4 Flash Free · fast coding and reasoning', upstream: 'deepseek-v4-flash-free', free: true, contextWindowTokens: 200_000, maxOutputTokens: 16_000 },
  { id: 'zyraxon-nova', label: 'ZYRAXON NOVA', blurb: 'MiMo-V2.5 Free · multimodal builder', upstream: 'mimo-v2.5-free', free: true, contextWindowTokens: 1_000_000, maxOutputTokens: 32_768, multimodal: true },
  { id: 'zyraxon-vector', label: 'ZYRAXON VECTOR', blurb: 'Big Pickle · autonomous coding and building', upstream: 'big-pickle', free: true, contextWindowTokens: 200_000, maxOutputTokens: 32_768 },
  { id: 'zyraxon-phantom', label: 'ZYRAXON PHANTOM', blurb: 'Nemotron 3 Ultra Free · deep reasoning', upstream: 'nemotron-3-ultra-free', free: true, contextWindowTokens: 200_000, maxOutputTokens: 32_768 },
  { id: 'zyraxon-lumen', label: 'ZYRAXON LUMEN', blurb: 'Laguna S 2.1 Free · balanced general builder', upstream: 'laguna-s-2.1-free', free: true, contextWindowTokens: 200_000, maxOutputTokens: 16_000 },
  { id: 'zyraxon-pulse', label: 'ZYRAXON PULSE', blurb: 'Ling 3.0 Flash Free · rapid responses', upstream: 'ling-3.0-flash-free', free: true, contextWindowTokens: 200_000, maxOutputTokens: 16_000 },
  { id: 'zyraxon-forge', label: 'ZYRAXON FORGE', blurb: 'North Mini Code Free · focused code generation', upstream: 'north-mini-code-free', free: true, contextWindowTokens: 200_000, maxOutputTokens: 16_000 },
];

export const DEFAULT_ZEN_MODEL = ZEN_FREE_MODELS[0]!.id;

/**
 * If the selected free route is unavailable/rate-limited, try the other
 * official free routes only. We never invent or silently add paid models.
 */
const ZEN_FAILOVER_MODELS = ZEN_FREE_MODELS;

export const BUILDER_SYSTEM_PROMPT = `You are ZYRAXON AI, an autonomous production-grade web builder.
Build complete working projects, not mockups. Preserve existing project behavior unless the user asks to change it. Inspect the project context, implement all required files and interactions, keep responsive/polished UI intact, and verify cross-file references before completion. Never expose credentials or hidden reasoning. For substantial work maintain an honest TODO plan and perform final preview verification.`;

export type ContentPart =
  | { type: 'text'; text: string }
  | { type: 'image_url'; image_url: { url: string } }
  | { type: 'input_audio'; input_audio: { data: string } }
  | { type: 'video_url'; video_url: { url: string }; fps?: number };

export type ChatMessage = { role: 'system' | 'user' | 'assistant'; content: string | ContentPart[] };
export type BuilderAttachment = { name: string; mime: string; data: string };

function headers(apiKey?: string, stream = false): Record<string, string> {
  return {
    'Content-Type': 'application/json',
    Accept: stream ? 'text/event-stream' : 'application/json',
    ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {}),
  };
}

function contentText(content: string | ContentPart[]) {
  return typeof content === 'string' ? content : content.filter((p): p is { type: 'text'; text: string } => p.type === 'text').map(p => p.text).join('\n');
}

export function resolveZenModel(model: string) {
  return ZEN_FREE_MODELS.find(candidate => candidate.id === model);
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

async function requestModel(model: ZenModel, messages: ChatMessage[], apiKey?: string, attachments: BuilderAttachment[] = [], stream = true) {
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
  return Response.json({
    error: status === 429 ? 'OpenCode free models are temporarily rate-limited.' : status === 401 || status === 403 ? 'OpenCode requires a valid API key for this request.' : status === 410 ? 'The configured OpenCode route is retired.' : 'OpenCode request failed.',
    detail: JSON.stringify({ tried: failures }),
    provider: 'opencode-zen', model: model.id, upstream: model.upstream, endpoint: ZEN_CHAT_URL,
  }, { status: status >= 400 && status < 600 ? status : 502, headers: { 'Access-Control-Allow-Origin': '*', ...(retryAfter ? { 'Retry-After': retryAfter } : {}) } });
}

export async function zenChatStream(model: string, messages: ChatMessage[], apiKey?: string, attachments: BuilderAttachment[] = []) {
  const requested = selectedModel(model);
  const order = [requested, ...ZEN_FAILOVER_MODELS.filter(m => m.id !== requested.id)];
  const failures: Array<{ model: string; upstream: string; status: number; detail: string; retryAfter?: string | null }> = [];

  for (const candidate of order) {
    let response: Response;
    try {
      response = await requestModel(candidate, messages, apiKey, attachments, true);
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

    // Authentication failures cannot be fixed by switching models.
    if (response.status === 401 || response.status === 403) break;
  }

  return errorResponse(requested, failures);
}

export async function testZenModel(model: string, apiKey?: string) {
  const selected = selectedModel(model);
  try {
    const response = await requestModel(selected, [{ role: 'user', content: 'Reply with OK.' }], apiKey, [], false);
    const detail = (await response.text().catch(() => '')).slice(0, 1200);
    return { ok: response.ok, status: response.status, model: selected.id, upstream: selected.upstream, detail, retryAfter: response.headers.get('retry-after') };
  } catch (error) {
    return { ok: false, status: 0, model: selected.id, upstream: selected.upstream, detail: error instanceof Error ? error.message : 'connection failed' };
  }
}

export async function discoverConsoleModels(apiKey?: string) {
  try {
    const response = await fetch(ZEN_MODELS_URL, { headers: headers(apiKey) });
    const data = await response.json().catch(() => null);
    const ids = Array.isArray(data?.data) ? data.data.map((item: any) => String(item?.id || '')).filter(Boolean) : [];
    return { ok: response.ok, status: response.status, ids };
  } catch (error) {
    return { ok: false, status: 0, ids: [], detail: error instanceof Error ? error.message : 'model discovery failed' };
  }
}
