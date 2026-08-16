/** OpenCode Console gateway integration for the current builder model tier. */

export const ZEN_BASE = 'https://console.opencode.ai/inference/openai/v1';

export type ZenModel = { id: string; label: string; blurb: string; upstream: string; free?: boolean };

/**
 * Public display aliases. The IDs are stable ZYRAXON IDs; upstream model IDs
 * remain server-side so the UI and provider configuration do not depend on them.
 */
export const ZEN_FREE_MODELS: ZenModel[] = [
  { id: 'zyraxon-titan', label: 'ZYRAXON TITAN', blurb: 'Maximum reasoning · builder', upstream: 'mimo-v2.5-free', free: true },
  { id: 'zyraxon-phantom', label: 'ZYRAXON PHANTOM', blurb: 'Deep reasoning · builder', upstream: 'nemotron-3-super-free', free: true },
  { id: 'zyraxon-velocity', label: 'ZYRAXON VELOCITY', blurb: 'Ultra-fast building · builder', upstream: 'big-pickle', free: true },
];

export const DEFAULT_ZEN_MODEL = ZEN_FREE_MODELS[0]!.id;
const FREE_FALLBACK_MODELS = ZEN_FREE_MODELS.map((model) => model.id);

export const BUILDER_SYSTEM_PROMPT = `You are ZYRAXON AI, an elite autonomous web engineer and product designer.

BEHAVIOR:
- Speak naturally and concisely. If the user asks what you are doing, answer like a helpful assistant, not like a generated tutorial.
- When asked to build or modify something, actually build it. Do not tell the user to manually save code, create files, open VS Code, or deploy it themselves.
- While work is running, give short live activity updates. Do not dump implementation code into the chat narrative.
- After successful work, briefly state what was changed and what is ready. Do not invent work that was not performed.

OUTPUT CONTRACT:
- Build the complete website/app, not a tutorial and not a plan.
- Stream implementation as multiple file blocks. Each block must use exactly one fenced code block with a language tag and a first-line file marker.
- Use whatever file set the project actually needs; never force a fixed three-file set.
- When modifying an existing project, return complete contents of every changed file so the Builder can apply them safely.
- Make requested interactions actually work: navigation, forms, filters, animations, responsive layouts, media, etc.
- For external media, use real source URLs from authorized web research when available. Never invent asset URLs.
- Prefer CSS/SVG/canvas animations when appropriate.
- Never expose, invent, or embed API keys, GitHub tokens, passwords, cookies, or secrets.
- Never expose private chain-of-thought or hidden reasoning. Progress text must contain short task/activity summaries only.
- Return production-quality responsive UI with strong accessibility, typography, spacing, visual hierarchy, and premium dense black-glass effects.
- When the user asks for a change, output complete replacement contents for every affected file.`;

export type ChatMessage = { role: 'system' | 'user' | 'assistant'; content: string };

function authHeaders(apiKey?: string): Record<string, string> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (apiKey) headers.Authorization = `Bearer ${apiKey}`;
  return headers;
}

function providerError(status: number, model: string, detail: string): Response {
  let error = `ZYRAXON model gateway error ${status}`;
  if (status === 401) error = 'This model requires a valid provider key.';
  if (status === 403) error = 'The model gateway rejected this request.';
  if (status === 429) error = 'Model gateway rate limit reached. Try another model or retry shortly.';
  if (status >= 500) error = 'The model gateway is temporarily unavailable. Try another model.';
  return new Response(JSON.stringify({ error, detail, provider: 'zyraxon', model }), {
    status: status >= 400 && status < 600 ? status : 502,
    headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
  });
}

export function resolveZenModel(model: string): ZenModel | undefined {
  return ZEN_FREE_MODELS.find((candidate) => candidate.id === model);
}

async function requestStream(model: string, messages: ChatMessage[], apiKey?: string): Promise<Response> {
  const selected = resolveZenModel(model) ?? ZEN_FREE_MODELS[0]!;
  return fetch(`${ZEN_BASE}/chat/completions`, {
    method: 'POST',
    headers: authHeaders(apiKey),
    body: JSON.stringify({
      model: selected.upstream,
      stream: true,
      max_tokens: 16000,
      messages: [{ role: 'system', content: BUILDER_SYSTEM_PROMPT }, ...messages],
    }),
  });
}

export async function zenChatStream(model: string, messages: ChatMessage[], apiKey?: string): Promise<Response> {
  const candidates = apiKey ? [model] : [model, ...FREE_FALLBACK_MODELS.filter((candidate) => candidate !== model)];
  let lastStatus = 502;
  let lastDetail = '';
  let lastModel = model;

  for (const candidate of candidates) {
    lastModel = candidate;
    let upstream: Response;
    try {
      upstream = await requestStream(candidate, messages, apiKey);
    } catch (error) {
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
    if (!apiKey && (upstream.status === 401 || upstream.status === 403 || upstream.status === 429 || upstream.status >= 500)) continue;
    return providerError(lastStatus, candidate, lastDetail);
  }

  return providerError(lastStatus, lastModel, lastDetail);
}

export async function testZenModel(model: string, apiKey?: string): Promise<{ ok: boolean; status: number; detail?: string }> {
  try {
    const selected = resolveZenModel(model) ?? ZEN_FREE_MODELS[0]!;
    const response = await fetch(`${ZEN_BASE}/chat/completions`, {
      method: 'POST',
      headers: authHeaders(apiKey),
      body: JSON.stringify({ model: selected.upstream, stream: false, max_tokens: 8, messages: [{ role: 'user', content: 'Reply with OK.' }] }),
    });
    const text = await response.text().catch(() => '');
    return { ok: response.ok, status: response.status, detail: response.ok ? undefined : text.slice(0, 600) };
  } catch (error) {
    return { ok: false, status: 0, detail: error instanceof Error ? error.message : 'Provider connection failed' };
  }
}
