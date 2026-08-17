/** OpenCode Console gateway integration for the current builder model tier. */

export const ZEN_BASE = 'https://console.opencode.ai/inference/openai/v1';

export type ZenModel = { id: string; label: string; blurb: string; upstream: string; free?: boolean };

export const ZEN_FREE_MODELS: ZenModel[] = [
  { id: 'zyraxon-titan', label: 'ZYRAXON TITAN', blurb: 'Maximum reasoning · builder', upstream: 'mimo-v2.5-free', free: true },
  { id: 'zyraxon-phantom', label: 'ZYRAXON PHANTOM', blurb: 'Deep reasoning · builder', upstream: 'nemotron-3-super-free', free: true },
  { id: 'zyraxon-velocity', label: 'ZYRAXON VELOCITY', blurb: 'Ultra-fast building · builder', upstream: 'big-pickle', free: true },
];

export const DEFAULT_ZEN_MODEL = ZEN_FREE_MODELS[0]!.id;

export const BUILDER_SYSTEM_PROMPT = `You are ZYRAXON AI, an elite autonomous web engineer and product designer.

BEHAVIOR:
- Speak naturally and concisely.
- Build or modify the requested project instead of giving a tutorial.
- Keep progress messages short. Never dump implementation code into prose.
- Return production-quality responsive UI and working interactions.

FILE OUTPUT CONTRACT:
- Stream implementation as file blocks. Each block must use one fenced code block with a language tag and a first-line file marker.
- The first line inside every code block must be: file: relative/path.ext
- Use the file set the project actually needs; never force a fixed three-file set.
- When modifying an existing project, return complete contents for every changed file.

BUILDER TOOLS:
The Builder supports these tool intents: pdf.create, pdf.addText, pdf.addPage, pdf.preview, pdf.download, project.zip, project.download, github.listRepos, github.listFiles, github.readFile, github.writeFile. When the user explicitly requests one of these actions, emit a compact request inside <builder-tool>...</builder-tool>. Never put secrets in tool requests.
- pdf.create: create a PDF document from structured content.
- pdf.addText: add text to the current PDF.
- pdf.addPage: add a new PDF page.
- pdf.preview: render the current PDF in the Builder.
- pdf.download: provide a downloadable PDF.
- project.zip: package the generated project files.
- project.download: download the generated project archive.
- GitHub actions operate only on the repository explicitly selected by the user.

SECURITY:
- Never expose, invent, or embed API keys, GitHub tokens, passwords, cookies, or secrets.
- Never expose hidden reasoning.
- Never claim a tool succeeded unless the Builder reports success.
`;

export type ChatMessage = { role: 'system' | 'user' | 'assistant'; content: string };

function authHeaders(apiKey?: string): Record<string, string> {
  return {
    'Content-Type': 'application/json',
    Accept: 'text/event-stream',
    ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {}),
  };
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
      max_tokens: 12000,
      messages: [{ role: 'system', content: BUILDER_SYSTEM_PROMPT }, ...messages],
    }),
  });
}

export async function zenChatStream(model: string, messages: ChatMessage[], apiKey?: string): Promise<Response> {
  const compact = messages.slice(-10).map((message) => ({ ...message, content: message.content.slice(0, 24000) }));
  let upstream: Response;
  try {
    upstream = await requestStream(model, compact, apiKey);
  } catch (error) {
    return providerError(502, model, error instanceof Error ? error.message : 'Provider connection failed');
  }
  if (!upstream.ok || !upstream.body) {
    const text = await upstream.text().catch(() => '');
    return providerError(upstream.status || 502, model, text.slice(0, 1200));
  }
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const reader = upstream.body!.getReader();
      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          if (value) controller.enqueue(value);
        }
        controller.close();
      } catch (error) {
        controller.error(error);
      } finally {
        reader.releaseLock();
      }
    },
  });
  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
      'Access-Control-Allow-Origin': '*',
      'X-ZYRAXON-Model': model,
    },
  });
}

export async function testZenModel(model: string, apiKey?: string): Promise<{ ok: boolean; status: number; detail?: string }> {
  try {
    const selected = resolveZenModel(model) ?? ZEN_FREE_MODELS[0]!;
    const response = await fetch(`${ZEN_BASE}/chat/completions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {}) },
      body: JSON.stringify({ model: selected.upstream, stream: false, max_tokens: 8, messages: [{ role: 'user', content: 'Reply with OK.' }] }),
    });
    const text = await response.text().catch(() => '');
    return { ok: response.ok, status: response.status, detail: response.ok ? undefined : text.slice(0, 600) };
  } catch (error) {
    return { ok: false, status: 0, detail: error instanceof Error ? error.message : 'Provider connection failed' };
  }
}