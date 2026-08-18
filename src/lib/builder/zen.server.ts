/** ZYRAXON's single OpenCode Zen provider contract. UI aliases never become upstream model IDs. */

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

/** Stable ZYRAXON names -> currently documented OpenCode Zen free models. */
export const ZEN_FREE_MODELS: ZenModel[] = [
  { id: 'zyraxon-t10', label: 'ZYRAXON T10', blurb: 'MiMo-V2.5 Free · multimodal', upstream: 'mimo-v2.5-free', free: true, contextWindowTokens: 1_000_000, maxOutputTokens: 131_072, multimodal: true },
  { id: 'zyraxon-vector', label: 'ZYRAXON VECTOR', blurb: 'Big Pickle · fast autonomous building', upstream: 'big-pickle', free: true, contextWindowTokens: 200_000, maxOutputTokens: 32_768 },
  { id: 'zyraxon-phantom', label: 'ZYRAXON PHANTOM', blurb: 'Nemotron 3 Ultra Free · deep reasoning', upstream: 'nemotron-3-ultra-free', free: true, contextWindowTokens: 200_000, maxOutputTokens: 131_072 },
];

export const DEFAULT_ZEN_MODEL = ZEN_FREE_MODELS[0]!.id;

export const BUILDER_SYSTEM_PROMPT = `You are ZYRAXON AI, an autonomous production software engineer and UI/UX designer.
Treat implementation requests as real production work. Inspect the existing project, preserve working behavior, implement every required file and interaction, wire imports/routes/assets correctly, and validate the result before declaring completion.
For non-trivial work maintain a truthful builder TODO plan. Never claim a feature is complete unless it exists and has been checked.
A complete website means working HTML/CSS/JS/TS/components/assets/configuration, not a skeleton or mockup.
Never expose credentials, tokens, passwords, cookies, private keys, or hidden reasoning.
Before completion request <builder-tool>{"tool":"preview.verify","reason":"Final production verification before completion"}</builder-tool>.`;

export type ContentPart =
  | { type: 'text'; text: string }
  | { type: 'image_url'; image_url: { url: string } }
  | { type: 'input_audio'; input_audio: { data: string } }
  | { type: 'video_url'; video_url: { url: string }; fps?: number };
export type ChatMessage = { role: 'system' | 'user' | 'assistant'; content: string | ContentPart[] };
export type BuilderAttachment = { name: string; mime: string; data: string };

function requestHeaders(apiKey?: string, stream = false) {
  return {
    'Content-Type': 'application/json',
    Accept: stream ? 'text/event-stream' : 'application/json',
    ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {}),
  };
}

function textOf(content: string | ContentPart[]) {
  return typeof content === 'string' ? content : content.filter((p): p is { type: 'text'; text: string } => p.type === 'text').map(p => p.text).join('\n');
}

export function resolveZenModel(model: string) { return ZEN_FREE_MODELS.find(m => m.id === model); }
function selectedModel(model: string) { return resolveZenModel(model) || ZEN_FREE_MODELS[0]!; }

function messagesForRequest(messages: ChatMessage[], attachments: BuilderAttachment[], model: ZenModel) {
  const input = messages.slice(-32).map(m => ({ ...m }));
  const index = [...input].reverse().findIndex(m => m.role === 'user');
  if (index < 0 || !attachments.length) return input;
  const target = input.length - 1 - index;
  const base = textOf(input[target]!.content);
  if (!model.multimodal) {
    input[target] = { role: 'user', content: `${base}\n\nAttached media: ${attachments.map(a => `${a.name} (${a.mime})`).join(', ')}. Do not invent observations because this model is text-only.` };
    return input;
  }
  const parts: ContentPart[] = [{ type: 'text', text: base }];
  for (const file of attachments) {
    if (file.mime.startsWith('image/')) parts.push({ type: 'image_url', image_url: { url: file.data } });
    else if (file.mime.startsWith('audio/')) parts.push({ type: 'input_audio', input_audio: { data: file.data } });
    else if (file.mime.startsWith('video/')) parts.push({ type: 'video_url', video_url: { url: file.data }, fps: 1 });
  }
  input[target] = { role: 'user', content: parts };
  return input;
}

async function requestModel(model: ZenModel, messages: ChatMessage[], apiKey?: string, attachments: BuilderAttachment[] = []) {
  const input = messagesForRequest(messages, attachments, model);
  const lastUser = [...input].reverse().find(m => m.role === 'user');
  const system = `${BUILDER_SYSTEM_PROMPT}\n\nCURRENT REQUEST:\n${lastUser ? textOf(lastUser.content).slice(0, 8000) : ''}`;
  return fetch(ZEN_CHAT_URL, {
    method: 'POST',
    headers: requestHeaders(apiKey, true),
    body: JSON.stringify({ model: model.upstream, stream: true, max_tokens: model.maxOutputTokens, temperature: 0.2, messages: [{ role: 'system', content: system }, ...input] }),
  });
}

function failure(status: number, requested: ZenModel, failures: Array<{ model: string; upstream: string; status: number; detail: string }>) {
  const message = status === 429 ? 'OpenCode temporarily rate-limited the free model.' : status === 401 || status === 403 ? 'OpenCode rejected the provider request.' : status >= 500 ? 'OpenCode is temporarily unavailable.' : `OpenCode request failed (${status || 502}).`;
  return new Response(JSON.stringify({ error: message, detail: JSON.stringify({ tried: failures }), provider: 'opencode-zen', model: requested.id, upstream: requested.upstream, endpoint: ZEN_CHAT_URL }), { status: status >= 400 && status < 600 ? status : 502, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' } });
}

/** One gateway only. Fallback changes models, never gateways. */
export async function zenChatStream(model: string, messages: ChatMessage[], apiKey?: string, attachments: BuilderAttachment[] = []) {
  const requested = selectedModel(model);
  const order = [requested, ...ZEN_FREE_MODELS.filter(m => m.id !== requested.id)];
  const failures: Array<{ model: string; upstream: string; status: number; detail: string }> = [];

  for (const candidate of order) {
    let response: Response;
    try { response = await requestModel(candidate, messages, apiKey, attachments); }
    catch (error) { failures.push({ model: candidate.id, upstream: candidate.upstream, status: 0, detail: error instanceof Error ? error.message : 'Provider connection failed' }); continue; }

    if (response.ok && response.body) {
      return new Response(response.body, { headers: { 'Content-Type': 'text/event-stream; charset=utf-8', 'Cache-Control': 'no-cache, no-transform', Connection: 'keep-alive', 'X-Accel-Buffering': 'no', 'Access-Control-Allow-Origin': '*', 'X-ZYRAXON-Model': candidate.id, 'X-ZYRAXON-Upstream': candidate.upstream } });
    }

    const detail = (await response.text().catch(() => '')).slice(0, 1200);
    failures.push({ model: candidate.id, upstream: candidate.upstream, status: response.status, detail });
    if (response.status === 401 || response.status === 403) break;
  }
  const last = failures[failures.length - 1];
  return failure(last?.status || 502, requested, failures);
}

export async function testZenModel(model: string, apiKey?: string) {
  const selected = selectedModel(model);
  try {
    const response = await fetch(ZEN_CHAT_URL, { method: 'POST', headers: requestHeaders(apiKey), body: JSON.stringify({ model: selected.upstream, stream: false, max_tokens: 8, messages: [{ role: 'user', content: 'Reply with OK.' }] }) });
    return { ok: response.ok, status: response.status, model: selected.id, upstream: selected.upstream, endpoint: ZEN_CHAT_URL, detail: (await response.text().catch(() => '')).slice(0, 1200) };
  } catch (error) {
    return { ok: false, status: 0, model: selected.id, upstream: selected.upstream, endpoint: ZEN_CHAT_URL, detail: error instanceof Error ? error.message : 'Provider connection failed' };
  }
}

export async function discoverConsoleModels(apiKey?: string) {
  try {
    const response = await fetch(ZEN_MODELS_URL, { headers: requestHeaders(apiKey) });
    const data = await response.json().catch(() => null);
    const ids = Array.isArray(data?.data) ? data.data.map((item: any) => String(item?.id || '')).filter(Boolean) : [];
    return { ok: response.ok, status: response.status, ids };
  } catch (error) { return { ok: false, status: 0, ids: [], detail: error instanceof Error ? error.message : 'Model discovery failed' }; }
}
