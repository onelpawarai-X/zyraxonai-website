/**
 * ZYRAXON provider integration.
 * One gateway, stable ZYRAXON aliases, and current OpenCode Zen model IDs.
 */
import { logRuntime } from '@/lib/builder/runtime-log.server';

export const ZEN_BASE = 'https://opencode.ai/zen/v1';
export const ZEN_CHAT_URL = `${ZEN_BASE}/chat/completions`;
export const ZEN_MODELS_URL = `${ZEN_BASE}/models`;

export type ZenModel = { id: string; label: string; blurb: string; upstream: string; free: true; contextWindowTokens: number; maxOutputTokens: number; multimodal?: boolean };

export const ZEN_FREE_MODELS: ZenModel[] = [
  { id: 'zyraxon-t10', label: 'ZYRAXON T10', blurb: 'MiMo-V2.5 Free · multimodal builder', upstream: 'mimo-v2.5-free', free: true, contextWindowTokens: 1_000_000, maxOutputTokens: 16_000, multimodal: true },
  { id: 'zyraxon-vector', label: 'ZYRAXON VECTOR', blurb: 'Big Pickle · fast autonomous building', upstream: 'big-pickle', free: true, contextWindowTokens: 200_000, maxOutputTokens: 16_000 },
  { id: 'zyraxon-phantom', label: 'ZYRAXON PHANTOM', blurb: 'Nemotron 3 Ultra Free · deep reasoning', upstream: 'nemotron-3-ultra-free', free: true, contextWindowTokens: 200_000, maxOutputTokens: 16_000 },
];

export const DEFAULT_ZEN_MODEL = ZEN_FREE_MODELS[0]!.id;
export const BUILDER_SYSTEM_PROMPT = `You are ZYRAXON AI, an autonomous production-grade web builder. Build complete working projects, not mockups. Preserve existing project behavior unless the user asks to change it. Inspect project context, implement required files and interactions, keep responsive/polished UI intact, verify cross-file references, never expose credentials or hidden reasoning, and perform final preview verification.`;

export type ContentPart = { type: 'text'; text: string } | { type: 'image_url'; image_url: { url: string } } | { type: 'input_audio'; input_audio: { data: string } } | { type: 'video_url'; video_url: { url: string }; fps?: number };
export type ChatMessage = { role: 'system' | 'user' | 'assistant'; content: string | ContentPart[] };
export type BuilderAttachment = { name: string; mime: string; data: string };

function headers(apiKey?: string, stream = false): Record<string, string> {
  return { 'Content-Type': 'application/json', Accept: stream ? 'text/event-stream' : 'application/json', ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {}) };
}
function contentText(content: string | ContentPart[]) { return typeof content === 'string' ? content : content.filter((p): p is { type: 'text'; text: string } => p.type === 'text').map(p => p.text).join('\n'); }
export function resolveZenModel(model: string) { return ZEN_FREE_MODELS.find(candidate => candidate.id === model); }
function selectedModel(model: string) { return resolveZenModel(model) || ZEN_FREE_MODELS[0]!; }
function withSystem(messages: ChatMessage[]) { const lastUser = [...messages].reverse().find(m => m.role === 'user'); const excerpt = lastUser ? contentText(lastUser.content).slice(0, 6000) : ''; return `${BUILDER_SYSTEM_PROMPT}\n\nCURRENT REQUEST:\n${excerpt}`; }

function attachMedia(messages: ChatMessage[], attachments: BuilderAttachment[], model: ZenModel) {
  if (!attachments.length) return messages;
  const next = [...messages]; const index = [...next].reverse().findIndex(m => m.role === 'user'); if (index < 0) return next;
  const target = next.length - 1 - index; const base = contentText(next[target]!.content);
  if (!model.multimodal) { next[target] = { role: 'user', content: `${base}\n\nAttached media: ${attachments.map(a => `${a.name} (${a.mime})`).join(', ')}. The selected model is text-only; do not invent observations about the files.` }; return next; }
  const parts: ContentPart[] = [{ type: 'text', text: base }];
  for (const file of attachments) { if (file.mime.startsWith('image/')) parts.push({ type: 'image_url', image_url: { url: file.data } }); else if (file.mime.startsWith('audio/')) parts.push({ type: 'input_audio', input_audio: { data: file.data } }); else if (file.mime.startsWith('video/')) parts.push({ type: 'video_url', video_url: { url: file.data }, fps: 1 }); }
  next[target] = { role: 'user', content: parts }; return next;
}

async function requestModel(model: ZenModel, messages: ChatMessage[], apiKey: string | undefined, attachments: BuilderAttachment[], stream: boolean, requestId: string) {
  const started = Date.now();
  const input = attachMedia(messages.slice(-32), attachments, model);
  await logRuntime(requestId, 'provider_attempt', { gateway: ZEN_CHAT_URL, uiModel: model.id, upstreamModel: model.upstream, stream, messageCount: input.length, attachmentCount: attachments.length, apiKeyProvided: Boolean(apiKey) });
  try {
    const response = await fetch(ZEN_CHAT_URL, { method: 'POST', headers: headers(apiKey, stream), body: JSON.stringify({ model: model.upstream, stream, max_tokens: model.maxOutputTokens, temperature: 0.2, messages: [{ role: 'system', content: withSystem(input) }, ...input] }) });
    await logRuntime(requestId, 'provider_response_headers', { uiModel: model.id, upstreamModel: model.upstream, status: response.status, ok: response.ok, contentType: response.headers.get('content-type'), server: response.headers.get('server'), requestIdHeader: response.headers.get('x-request-id') }, Date.now() - started);
    return response;
  } catch (error) {
    await logRuntime(requestId, 'provider_network_error', { uiModel: model.id, upstreamModel: model.upstream, errorName: error instanceof Error ? error.name : 'unknown', error: error instanceof Error ? error.message : String(error) }, Date.now() - started);
    throw error;
  }
}

function errorResponse(model: ZenModel, failures: Array<{ model: string; status: number; detail: string }>, requestId: string) {
  const status = failures[failures.length - 1]?.status || 502;
  return Response.json({ error: status === 429 ? 'OpenCode temporarily limited this free model.' : status === 410 ? 'The configured OpenCode route is retired.' : 'OpenCode request failed.', detail: JSON.stringify({ tried: failures }), provider: 'opencode-zen', model: model.id, upstream: model.upstream, endpoint: ZEN_CHAT_URL, requestId }, { status: status >= 400 && status < 600 ? status : 502, headers: { 'Access-Control-Allow-Origin': '*', 'X-ZYRAXON-Request-Id': requestId } });
}

export async function zenChatStream(model: string, messages: ChatMessage[], apiKey: string | undefined, attachments: BuilderAttachment[] = [], requestId: string) {
  const requested = selectedModel(model); const order = [requested, ...ZEN_FREE_MODELS.filter(m => m.id !== requested.id)]; const failures: Array<{ model: string; status: number; detail: string }> = [];
  await logRuntime(requestId, 'fallback_plan', { requestedModel: requested.id, order: order.map(m => ({ ui: m.id, upstream: m.upstream })) });
  for (const candidate of order) {
    let response: Response;
    try { response = await requestModel(candidate, messages, apiKey, attachments, true, requestId); }
    catch (error) { failures.push({ model: candidate.id, status: 0, detail: error instanceof Error ? error.message : 'connection failed' }); continue; }
    if (response.ok && response.body) { await logRuntime(requestId, 'provider_stream_accepted', { uiModel: candidate.id, upstreamModel: candidate.upstream, status: response.status }); return new Response(response.body, { headers: { 'Content-Type': 'text/event-stream; charset=utf-8', 'Cache-Control': 'no-cache, no-transform', Connection: 'keep-alive', 'X-Accel-Buffering': 'no', 'Access-Control-Allow-Origin': '*', 'X-ZYRAXON-Request-Id': requestId, 'X-ZYRAXON-Model': candidate.id, 'X-ZYRAXON-Upstream': candidate.upstream } }); }
    const detail = (await response.text().catch(() => '')).slice(0, 1600); failures.push({ model: candidate.id, status: response.status, detail }); await logRuntime(requestId, 'provider_rejected', { uiModel: candidate.id, upstreamModel: candidate.upstream, status: response.status, detail });
    if (response.status === 401 || response.status === 403) break;
  }
  await logRuntime(requestId, 'all_provider_attempts_failed', { failures });
  return errorResponse(requested, failures, requestId);
}

export async function testZenModel(model: string, apiKey: string | undefined, requestId = 'diagnostic') {
  const selected = selectedModel(model); const started = Date.now();
  try { const response = await requestModel(selected, [{ role: 'user', content: 'Reply with OK.' }], apiKey, [], false, requestId); const detail = (await response.text().catch(() => '')).slice(0, 1600); await logRuntime(requestId, 'diagnostic_body', { status: response.status, detail }, Date.now() - started); return { ok: response.ok, status: response.status, model: selected.id, upstream: selected.upstream, detail }; }
  catch (error) { return { ok: false, status: 0, model: selected.id, upstream: selected.upstream, detail: error instanceof Error ? error.message : 'connection failed' }; }
}

export async function discoverConsoleModels(apiKey: string | undefined, requestId = 'discovery') {
  const started = Date.now();
  try { const response = await fetch(ZEN_MODELS_URL, { headers: headers(apiKey) }); const data = await response.json().catch(() => null); const ids = Array.isArray(data?.data) ? data.data.map((item: any) => String(item?.id || '')).filter(Boolean) : []; await logRuntime(requestId, 'model_discovery_response', { status: response.status, ok: response.ok, ids }, Date.now() - started); return { ok: response.ok, status: response.status, ids }; }
  catch (error) { await logRuntime(requestId, 'model_discovery_error', { error: error instanceof Error ? error.message : String(error) }, Date.now() - started); return { ok: false, status: 0, ids: [], detail: error instanceof Error ? error.message : 'model discovery failed' }; }
}
