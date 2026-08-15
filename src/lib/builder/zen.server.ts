/** OpenCode Console gateway integration for the current free model tier. */

// OpenCode's current Console gateway explicitly supports free chat models without
// an Authorization header. A user-supplied API key is still accepted for paid
// models, so the builder works in both no-key and BYO-key modes.
export const ZEN_BASE = 'https://console.opencode.ai/inference/openai/v1';

export type ZenModel = { id: string; label: string; blurb: string; free?: boolean };

/** Models currently documented by OpenCode Console as available to the builder. */
export const ZEN_FREE_MODELS: ZenModel[] = [
  { id: 'big-pickle', label: 'Big Pickle', blurb: 'Fast builder · free', free: true },
  { id: 'mimo-v2.5-free', label: 'MiMo V2.5 Free', blurb: 'Balanced reasoning · free', free: true },
  { id: 'nemotron-3-super-free', label: 'Nemotron 3 Super Free', blurb: 'Reasoning · free', free: true },
];

export const DEFAULT_ZEN_MODEL = ZEN_FREE_MODELS[0]!.id;

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

export async function zenChatStream(model: string, messages: ChatMessage[], apiKey?: string): Promise<Response> {
  const upstream = await fetch(`${ZEN_BASE}/chat/completions`, {
    method: 'POST',
    headers: authHeaders(apiKey),
    body: JSON.stringify({
      model,
      stream: true,
      max_tokens: 16000,
      messages: [{ role: 'system', content: BUILDER_SYSTEM_PROMPT }, ...messages],
    }),
  });

  if (!upstream.ok || !upstream.body) {
    const text = await upstream.text().catch(() => '');
    const detail = text.slice(0, 1200);
    let error = `OpenCode Console error ${upstream.status}`;
    if (upstream.status === 401) error = 'This model requires an OpenCode Console API key.';
    if (upstream.status === 429) error = 'OpenCode Console rate limit reached. Try another free model or retry shortly.';
    if (upstream.status >= 500) error = 'OpenCode Console is temporarily unavailable. Try another free model.';

    return new Response(JSON.stringify({ error, detail, provider: 'opencode-console', model }), {
      status: upstream.status >= 400 && upstream.status < 600 ? upstream.status : 502,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
    });
  }

  return new Response(upstream.body, {
    headers: {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'Access-Control-Allow-Origin': '*',
    },
  });
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
