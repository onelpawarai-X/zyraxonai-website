/** OpenCode Console gateway integration for the current free model tier. */

export const ZEN_BASE = 'https://console.opencode.ai/inference/openai/v1';

export type ZenModel = { id: string; label: string; blurb: string; free?: boolean };

/** Models currently documented by OpenCode Console as available to the builder. */
export const ZEN_FREE_MODELS: ZenModel[] = [
  { id: 'mimo-v2.5-free', label: 'MiMo V2.5 Free', blurb: 'Balanced reasoning · free', free: true },
  { id: 'nemotron-3-super-free', label: 'Nemotron 3 Super Free', blurb: 'Reasoning · free', free: true },
  { id: 'big-pickle', label: 'Big Pickle', blurb: 'Fast builder · free', free: true },
];

export const DEFAULT_ZEN_MODEL = ZEN_FREE_MODELS[0]!.id;

const FREE_FALLBACK_MODELS = ZEN_FREE_MODELS.map((model) => model.id);

export const BUILDER_SYSTEM_PROMPT = `You are ZYRAXON Blueprint, an elite web engineer that builds polished, production-ready responsive websites.

CRITICAL RULES:
1. Return one complete self-contained HTML document in one html code block.
2. Put CSS in a style tag and JavaScript in a script tag. Do not require a build step.
3. Use premium dark-first visual design, glass surfaces, gradients, responsive layouts, subtle animation and excellent spacing.
4. Make every requested interaction actually work.
5. When the user asks for a change, return the FULL updated HTML document.
6. Never expose, invent, or embed API keys, GitHub tokens, passwords, cookies, or other secrets.
7. Deployment credentials are handled separately by ZYRAXON.
8. Make the result look expensive and intentional. Every pixel matters.`;

export type ChatMessage = { role: 'system' | 'user' | 'assistant'; content: string };

function authHeaders(apiKey?: string): Record<string, string> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (apiKey) headers.Authorization = `Bearer ${apiKey}`;
  return headers;
}

function providerError(status: number, model: string, detail: string): Response {
  let error = `OpenCode Console error ${status}`;
  if (status === 401) error = 'This model requires an OpenCode Console API key.';
  if (status === 403) error = 'OpenCode Console rejected this model request.';
  if (status === 429) error = 'OpenCode Console rate limit reached. Try another free model or retry shortly.';
  if (status >= 500) error = 'OpenCode Console is temporarily unavailable. Try another free model.';

  return new Response(JSON.stringify({ error, detail, provider: 'opencode-console', model }), {
    status: status >= 400 && status < 600 ? status : 502,
    headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
  });
}

async function requestStream(model: string, messages: ChatMessage[], apiKey?: string): Promise<Response> {
  return fetch(`${ZEN_BASE}/chat/completions`, {
    method: 'POST',
    headers: authHeaders(apiKey),
    body: JSON.stringify({
      model,
      stream: true,
      max_tokens: 16000,
      messages: [{ role: 'system', content: BUILDER_SYSTEM_PROMPT }, ...messages],
    }),
  });
}

/**
 * Send a generation request. When no key is supplied, a free-model request that
 * is rejected for authentication is automatically retried with the next
 * documented free model. This prevents one unavailable free model from making
 * the entire Builder chat unusable.
 */
export async function zenChatStream(model: string, messages: ChatMessage[], apiKey?: string): Promise<Response> {
  const candidates = apiKey
    ? [model]
    : [model, ...FREE_FALLBACK_MODELS.filter((candidate) => candidate !== model)];

  let lastStatus = 502;
  let lastDetail = '';
  let lastModel = model;

  for (const candidate of candidates) {
    lastModel = candidate;
    let upstream: Response;
    try {
      upstream = await requestStream(candidate, messages, apiKey);
    } catch (error) {
      lastStatus = 502;
      lastDetail = error instanceof Error ? error.message : 'Provider connection failed';
      continue;
    }

    if (upstream.ok && upstream.body) {
      return new Response(upstream.body, {
        headers: {
          'Content-Type': 'text/event-stream; charset=utf-8',
          'Cache-Control': 'no-cache, no-transform',
          Connection: 'keep-alive',
          'Access-Control-Allow-Origin': '*',
          'X-ZYRAXON-Model': candidate,
        },
      });
    }

    const text = await upstream.text().catch(() => '');
    lastStatus = upstream.status || 502;
    lastDetail = text.slice(0, 1200);

    // A no-key free model may temporarily require authentication. Try the
    // next free model rather than surfacing a dead-end error immediately.
    if (!apiKey && (upstream.status === 401 || upstream.status === 403 || upstream.status === 429 || upstream.status >= 500)) {
      continue;
    }

    return providerError(lastStatus, candidate, lastDetail);
  }

  return providerError(lastStatus, lastModel, lastDetail);
}

/** Small non-streaming provider probe used by the Builder's model health UI. */
export async function testZenModel(model: string, apiKey?: string): Promise<{ ok: boolean; status: number; detail?: string }> {
  try {
    const response = await fetch(`${ZEN_BASE}/chat/completions`, {
      method: 'POST',
      headers: authHeaders(apiKey),
      body: JSON.stringify({
        model,
        stream: false,
        max_tokens: 8,
        messages: [{ role: 'user', content: 'Reply with OK.' }],
      }),
    });
    const text = await response.text().catch(() => '');
    return { ok: response.ok, status: response.status, detail: response.ok ? undefined : text.slice(0, 600) };
  } catch (error) {
    return { ok: false, status: 0, detail: error instanceof Error ? error.message : 'Provider connection failed' };
  }
}
