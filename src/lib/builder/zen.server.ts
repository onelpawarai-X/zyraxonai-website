/**
 * ZYRAXON -> OpenCode Zen integration.
 * Upstream IDs and the OpenAI-compatible transport follow the current
 * OpenCode Zen documentation. ZYRAXON aliases are UI-only.
 */

import { createOpenAICompatible } from '@ai-sdk/openai-compatible';
import { generateText, streamText } from 'ai';

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

/** Free Zen models explicitly requested for the ZYRAXON builder. */
export const ZEN_FREE_MODELS: ZenModel[] = [
  { id: 'zyraxon-titan', label: 'ZYRAXON TITAN', blurb: 'DeepSeek V4 Flash Free · rapid builder', upstream: 'deepseek-v4-flash-free', free: true, contextWindowTokens: 200_000, maxOutputTokens: 16_000 },
  { id: 'zyraxon-nova', label: 'ZYRAXON NOVA', blurb: 'MiMo-V2.5 Free · multimodal builder', upstream: 'mimo-v2.5-free', free: true, contextWindowTokens: 1_000_000, maxOutputTokens: 32_768, multimodal: true },
  { id: 'zyraxon-vector', label: 'ZYRAXON VECTOR', blurb: 'Big Pickle · autonomous coding', upstream: 'big-pickle', free: true, contextWindowTokens: 200_000, maxOutputTokens: 32_768 },
  { id: 'zyraxon-hydra', label: 'ZYRAXON HYDRA', blurb: 'Hy3 Free · general intelligence', upstream: 'hy3-free', free: true, contextWindowTokens: 200_000, maxOutputTokens: 16_000 },
  { id: 'zyraxon-lumen', label: 'ZYRAXON LUMEN', blurb: 'Laguna S 2.1 Free · balanced builder', upstream: 'laguna-s-2.1-free', free: true, contextWindowTokens: 200_000, maxOutputTokens: 16_000 },
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

export function resolveZenModel(model: string) {
  return ZEN_FREE_MODELS.find(candidate => candidate.id === model || candidate.upstream === model);
}

function selectedModel(model: string) {
  return resolveZenModel(model) || ZEN_FREE_MODELS[0]!;
}

function contentText(content: string | ContentPart[]) {
  return typeof content === 'string' ? content : content.filter((p): p is { type: 'text'; text: string } => p.type === 'text').map(p => p.text).join('\n');
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

function sdkProvider(apiKey: string) {
  return createOpenAICompatible({ name: 'opencode-zen', baseURL: ZEN_BASE, apiKey });
}

function sdkMessages(messages: ChatMessage[], attachments: BuilderAttachment[], model: ZenModel) {
  const input = attachMedia(messages.slice(-32), attachments, model);
  return [{ role: 'system' as const, content: withSystem(input) }, ...input] as any;
}

function openAiSseStream(first: string | undefined, iterator: AsyncIterator<string>, model: ZenModel) {
  const encoder = new TextEncoder();
  return new ReadableStream<Uint8Array>({
    async start(controller) {
      try {
        if (first) controller.enqueue(encoder.encode(`data: ${JSON.stringify({ id: `zyraxon-${Date.now()}`, object: 'chat.completion.chunk', choices: [{ index: 0, delta: { content: first }, finish_reason: null }], model: model.upstream })}\n\n`));
        while (true) {
          const next = await iterator.next();
          if (next.done) break;
          const delta = next.value;
          if (!delta) continue;
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ id: `zyraxon-${Date.now()}`, object: 'chat.completion.chunk', choices: [{ index: 0, delta: { content: delta }, finish_reason: null }], model: model.upstream })}\n\n`));
        }
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ id: `zyraxon-${Date.now()}`, object: 'chat.completion.chunk', choices: [{ index: 0, delta: {}, finish_reason: 'stop' }], model: model.upstream })}\n\n`));
        controller.enqueue(encoder.encode('data: [DONE]\n\n'));
        controller.close();
      } catch (error) {
        const message = error instanceof Error ? error.message : 'OpenCode Zen stream failed';
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ error: { message, type: 'opencode_zen_error' } })}\n\n`));
        controller.enqueue(encoder.encode('data: [DONE]\n\n'));
        controller.close();
      }
    },
  });
}

function errorResponse(model: ZenModel, failures: Array<{ model: string; upstream: string; status: number; detail: string; retryAfter?: string | null }>) {
  const status = failures[failures.length - 1]?.status || 502;
  const retryAfter = failures.find(f => f.retryAfter)?.retryAfter;
  let error = 'OpenCode request failed.';
  if (status === 401 || status === 403) error = 'OpenCode Zen requires a valid API key. Add your OpenCode Zen key in the builder or configure OPENCODE_ZEN_API_KEY on the server.';
  else if (status === 429) error = 'OpenCode Zen reported a rate limit for the selected free model. Use an available model or an OpenCode Zen API key with available capacity.';
  else if (status === 410) error = 'The configured OpenCode route is retired.';
  return Response.json({ error, detail: JSON.stringify({ tried: failures }), provider: 'opencode-zen', model: model.id, upstream: model.upstream, endpoint: ZEN_CHAT_URL }, { status: status >= 400 && status < 600 ? status : 502, headers: { 'Access-Control-Allow-Origin': '*', ...(retryAfter ? { 'Retry-After': retryAfter } : {}) } });
}

export async function zenChatStream(model: string, messages: ChatMessage[], apiKey?: string, attachments: BuilderAttachment[] = []) {
  const key = resolveApiKey(apiKey);
  const requested = selectedModel(model);
  if (!key) return Response.json({ error: 'OpenCode Zen API key required.', detail: 'Add your OpenCode Zen key in the ZYRAXON API-key control or configure OPENCODE_ZEN_API_KEY on the server.', provider: 'opencode-zen', model: requested.id, upstream: requested.upstream, endpoint: ZEN_CHAT_URL }, { status: 401, headers: { 'Access-Control-Allow-Origin': '*' } });

  const order = [requested, ...ZEN_FREE_MODELS.filter(m => m.id !== requested.id)];
  const failures: Array<{ model: string; upstream: string; status: number; detail: string; retryAfter?: string | null }> = [];
  const provider = sdkProvider(key);

  for (const candidate of order) {
    try {
      const result = streamText({ model: provider.chatModel(candidate.upstream), messages: sdkMessages(messages, attachments, candidate), maxOutputTokens: candidate.maxOutputTokens, temperature: 0.2 });
      const iterator = result.textStream[Symbol.asyncIterator]();
      const first = await iterator.next();
      if (first.done) {
        failures.push({ model: candidate.id, upstream: candidate.upstream, status: 502, detail: 'OpenCode returned an empty stream' });
        continue;
      }
      return new Response(openAiSseStream(first.value, iterator, candidate), { headers: { 'Content-Type': 'text/event-stream; charset=utf-8', 'Cache-Control': 'no-cache, no-transform', Connection: 'keep-alive', 'X-Accel-Buffering': 'no', 'Access-Control-Allow-Origin': '*', 'X-ZYRAXON-Model': candidate.id, 'X-ZYRAXON-Upstream': candidate.upstream } });
    } catch (error) {
      const detail = error instanceof Error ? error.message : 'SDK request failed';
      const status = /429|rate.?limit/i.test(detail) ? 429 : /401|unauthorized|api key/i.test(detail) ? 401 : /403|forbidden/i.test(detail) ? 403 : /404|not.?found|unsupported/i.test(detail) ? 404 : 502;
      failures.push({ model: candidate.id, upstream: candidate.upstream, status, detail });
      if (status === 401 || status === 403 || status === 429) break;
    }
  }

  return errorResponse(requested, failures);
}

export async function testZenModel(model: string, apiKey?: string) {
  const selected = selectedModel(model);
  const key = resolveApiKey(apiKey);
  if (!key) return { ok: false, status: 401, model: selected.id, upstream: selected.upstream, detail: 'API key required' };
  try {
    const result = await generateText({ model: sdkProvider(key).chatModel(selected.upstream), messages: [{ role: 'user', content: 'Reply with OK.' }], maxOutputTokens: 8, temperature: 0 });
    return { ok: true, status: 200, model: selected.id, upstream: selected.upstream, detail: result.text.slice(0, 1200) };
  } catch (error) {
    const detail = error instanceof Error ? error.message : 'SDK request failed';
    const status = /429|rate.?limit/i.test(detail) ? 429 : /401|unauthorized|api key/i.test(detail) ? 401 : 502;
    return { ok: false, status, model: selected.id, upstream: selected.upstream, detail };
  }
}

export async function discoverConsoleModels(apiKey?: string) {
  const key = resolveApiKey(apiKey);
  if (!key) return { ok: false, status: 401, ids: [], detail: 'API key required' };
  try {
    const response = await fetch(ZEN_MODELS_URL, { headers: { Authorization: `Bearer ${key}`, Accept: 'application/json' } });
    const data = await response.json().catch(() => null);
    const ids = Array.isArray(data?.data) ? data.data.map((item: any) => String(item?.id || '')).filter(Boolean) : [];
    return { ok: response.ok, status: response.status, ids };
  } catch (error) {
    return { ok: false, status: 0, ids: [], detail: error instanceof Error ? error.message : 'model discovery failed' };
  }
}
