/** OpenCode Console gateway integration for the current free model tier. */

export const ZEN_BASE = 'https://console.opencode.ai/inference/openai/v1';

export type ZenModel = { id: string; label: string; blurb: string; free?: boolean };

export const ZEN_FREE_MODELS: ZenModel[] = [
  { id: 'mimo-v2.5-free', label: 'MiMo V2.5 Free', blurb: 'Balanced reasoning · free', free: true },
  { id: 'nemotron-3-super-free', label: 'Nemotron 3 Super Free', blurb: 'Reasoning · free', free: true },
  { id: 'big-pickle', label: 'Big Pickle', blurb: 'Fast builder · free', free: true },
];

export const DEFAULT_ZEN_MODEL = ZEN_FREE_MODELS[0]!.id;
const FREE_FALLBACK_MODELS = ZEN_FREE_MODELS.map((model) => model.id);

export const BUILDER_SYSTEM_PROMPT = `You are ZYRAXON AI, an elite autonomous web engineer and product designer.

OUTPUT CONTRACT:
- Build the complete website/app, not a tutorial and not a plan.
- Stream implementation as multiple file blocks. Each block must use exactly one fenced code block with a language tag and a first-line file marker, for example: 
  \`\`\`html\n<!-- file: index.html -->\n...\n\`\`\`
  \`\`\`css\n/* file: styles.css */\n...\n\`\`\`
  \`\`\`javascript\n// file: script.js\n...\n\`\`\`
- Use whatever file set the project actually needs; do not force everything into one HTML file.
- When modifying an existing project, return the complete contents of every changed file so the Builder can apply them safely.
- Keep generated files self-contained and runnable in the existing project. Do not invent packages unless necessary.
- Make requested interactions actually work: navigation, forms, filters, animations, responsive layouts, media, etc.
- For images, use real source URLs supplied by web research when available. For video, use a real embeddable source URL when one is available. Never invent asset URLs.
- Prefer CSS/SVG/canvas animations when appropriate. Use remote media only when sourced.
- Never expose, invent, or embed API keys, GitHub tokens, passwords, cookies, or secrets.
- Do not expose private chain-of-thought or hidden reasoning. In progress text, give short task/activity summaries only.
- Return production-quality responsive UI with strong accessibility, typography, spacing, visual hierarchy, and premium glass effects.
- When the user asks for a change, output complete replacement contents for every affected file.`;

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
    body: JSON.stringify({ model, stream: true, max_tokens: 16000, messages: [{ role: 'system', content: BUILDER_SYSTEM_PROMPT }, ...messages] }),
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
    try { upstream = await requestStream(candidate, messages, apiKey); }
    catch (error) { lastDetail = error instanceof Error ? error.message : 'Provider connection failed'; continue; }
    if (upstream.ok && upstream.body) {
      return new Response(upstream.body, { headers: {
        'Content-Type': 'text/event-stream; charset=utf-8', 'Cache-Control': 'no-cache, no-transform',
        Connection: 'keep-alive', 'Access-Control-Allow-Origin': '*', 'X-ZYRAXON-Model': candidate,
      }});
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
    const response = await fetch(`${ZEN_BASE}/chat/completions`, {
      method: 'POST', headers: authHeaders(apiKey),
      body: JSON.stringify({ model, stream: false, max_tokens: 8, messages: [{ role: 'user', content: 'Reply with OK.' }] }),
    });
    const text = await response.text().catch(() => '');
    return { ok: response.ok, status: response.status, detail: response.ok ? undefined : text.slice(0, 600) };
  } catch (error) { return { ok: false, status: 0, detail: error instanceof Error ? error.message : 'Provider connection failed' }; }
}