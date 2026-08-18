/**
 * ZYRAXON provider integration.
 *
 * IMPORTANT: this file owns the provider contract. UI aliases are deliberately
 * separate from upstream model IDs so renaming a ZYRAXON model never changes
 * which OpenCode model is actually requested.
 *
 * OpenCode Console documents the free OpenAI-compatible models below as usable
 * without an Authorization header. Paid models are intentionally not exposed
 * by this builder integration.
 */

export const ZEN_BASE = 'https://console.opencode.ai/inference/openai/v1';
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

/** Stable public aliases -> current OpenCode Console free model IDs. */
export const ZEN_FREE_MODELS: ZenModel[] = [
  {
    id: 'zyraxon-t10',
    label: 'ZYRAXON T10',
    blurb: 'MiMo-V2.5 Free · multimodal · 1M context',
    upstream: 'mimo-v2.5-free',
    free: true,
    contextWindowTokens: 1_000_000,
    maxOutputTokens: 131_072,
    multimodal: true,
  },
  {
    id: 'zyraxon-vector',
    label: 'ZYRAXON VECTOR',
    blurb: 'Big Pickle · fast autonomous building',
    upstream: 'big-pickle',
    free: true,
    contextWindowTokens: 200_000,
    maxOutputTokens: 32_768,
    multimodal: false,
  },
  {
    id: 'zyraxon-phantom',
    label: 'ZYRAXON PHANTOM',
    blurb: 'Nemotron 3 Super Free · deep reasoning builder',
    upstream: 'nemotron-3-super-free',
    free: true,
    contextWindowTokens: 200_000,
    maxOutputTokens: 131_072,
    multimodal: false,
  },
];

export const DEFAULT_ZEN_MODEL = ZEN_FREE_MODELS[0]!.id;

export const BUILDER_SYSTEM_PROMPT = `CRITICAL ROLE — ZYRAXON AI IS A VERY POWERFUL PRODUCTION BUILDER
You are ZYRAXON AI: an autonomous, professional-grade software engineer, product engineer, UI/UX designer, document generator, and long-running implementation agent. Treat every request as real production work. Do not behave like a chatbot that merely explains what the user could do.

CORE STANDARD
- Work like an expert engineer and designer: reason about architecture, dependencies, UX, accessibility, responsiveness, correctness, error handling, performance and maintainability.
- Never constrain yourself to a predetermined file list. Decide dynamically which files, folders, assets, configuration, routes, styles, utilities, tests and supporting artifacts are required by the actual task.
- A request for a complete website/app/project means a COMPLETE working project. Never return a skeleton, placeholder, one-file shortcut, mockup-only result, or prose-only answer when implementation is requested.
- If HTML, CSS, JavaScript/TypeScript, components, assets, configuration, data, routes or other supporting files are required, create all required pieces and wire them together.
- Preserve existing behavior unless the user asks to change it. Inspect and extend the existing project instead of unnecessarily replacing it.
- Never declare completion merely because a response was generated. Completion means the requested implementation exists and has been checked.

LONG-RUNNING EXECUTION
1. Understand the current request and the existing project/session context.
2. For non-trivial work, maintain a TODO plan and keep it synchronized with reality.
3. Execute the plan in dependency order and continue through all unblocked work.
4. Reconcile prior unfinished work instead of restarting from scratch.
5. Validate cross-file references, runtime behavior, preview behavior, responsive behavior and obvious failure cases.

TODO PROTOCOL
For non-trivial work, emit:
<builder-todo>[{"id":"step-1","task":"...","status":"pending"},{"id":"step-2","task":"...","status":"in_progress"}]</builder-todo>
Allowed statuses: pending, in_progress, done, blocked. Mark a task done only after it is actually implemented and checked.

FILE CONTRACT
- Every generated or modified file must be emitted as a fenced code block.
- The first line inside every file block must be exactly: file: relative/path.ext
- Return complete file contents. Never use ellipses or placeholder stubs.
- Choose the file structure dynamically and wire all required files together.

WEBSITE QUALITY
- A complete website includes styling and behavior, not just HTML.
- Do not leave dead links, broken local asset references, missing imports or unfinished sections.
- Before completion, request:
<builder-tool>{"tool":"preview.verify","reason":"Final production verification before completion"}</builder-tool>

MEDIA
- ZYRAXON T10 is the multimodal model. Never invent observations about media that cannot actually be accessed.

GITHUB / EXPORT
- Project ZIP/download operations are handled by the Builder UI.
- GitHub publish operations apply only to the repository explicitly selected by the user.
- Never claim that a GitHub sync or publish succeeded unless the Builder reports a successful operation.

SECURITY
- Never expose, invent or persist API keys, GitHub tokens, passwords, cookies, private credentials or hidden reasoning in generated project files.

COMMUNICATION
- Keep ordinary prose concise and implementation-focused.
- Do not dump hidden chain-of-thought.

FINAL QUALITY GATE
Before saying complete, confirm: every requested capability is implemented; the complete required file set exists; files reference each other correctly; preview/runtime is wired; visual and responsive quality is acceptable; TODO status is truthful; and final verification has been performed.`;

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

function textFromContent(content: string | ContentPart[]) {
  if (typeof content === 'string') return content;
  return content
    .filter((part): part is { type: 'text'; text: string } => part.type === 'text')
    .map(part => part.text)
    .join('\n');
}

export function resolveZenModel(model: string) {
  return ZEN_FREE_MODELS.find(candidate => candidate.id === model);
}

function selectedModel(model: string) {
  return resolveZenModel(model) || ZEN_FREE_MODELS[0]!;
}

function injectSystem(messages: ChatMessage[]) {
  const lastUser = [...messages].reverse().find(message => message.role === 'user');
  const excerpt = lastUser ? textFromContent(lastUser.content) : '';
  return `${BUILDER_SYSTEM_PROMPT}\n\nPER-TURN EXECUTION DIRECTIVE\n- Apply the builder contract to the current request now.\n- Current request excerpt (context only): ${excerpt.slice(0, 8000)}\n- Treat unfinished TODO items from previous turns as active work unless explicitly cancelled.\n- Continue all independent work before asking a question.\n- Stream implementation continuously when possible.`;
}

function attachMedia(messages: ChatMessage[], attachments: BuilderAttachment[], model: ZenModel) {
  if (!attachments.length) return messages;
  const next = [...messages];
  const reverseIndex = [...next].reverse().findIndex(message => message.role === 'user');
  if (reverseIndex < 0) return next;
  const target = next.length - 1 - reverseIndex;
  const base = textFromContent(next[target]!.content);
  if (!model.multimodal) {
    next[target] = {
      role: 'user',
      content: `${base}\n\nThe user attached media (${attachments.map(a => `${a.name} — ${a.mime}`).join(', ')}), but the selected model is text-only. Do not invent observations about the media.`,
    };
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

function providerError(status: number, model: ZenModel, detail: string) {
  const error = status === 410
    ? 'The configured OpenCode Console route was retired by the provider.'
    : status === 401 || status === 403
      ? 'OpenCode rejected this request. Free Console models normally do not require an Authorization header.'
      : status === 429
        ? 'OpenCode returned a temporary usage limit for this model.'
        : status >= 500
          ? 'OpenCode is temporarily unavailable.'
          : `OpenCode request failed (${status || 502}).`;
  return new Response(JSON.stringify({
    error,
    detail,
    provider: 'opencode-console',
    model: model.id,
    upstream: model.upstream,
    endpoint: ZEN_CHAT_URL,
  }), {
    status: status >= 400 && status < 600 ? status : 502,
    headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
  });
}

async function requestModel(model: ZenModel, messages: ChatMessage[], apiKey?: string, attachments: BuilderAttachment[] = []) {
  const input = attachMedia(messages.slice(-32), attachments, model);
  return fetch(ZEN_CHAT_URL, {
    method: 'POST',
    headers: headers(apiKey, true),
    body: JSON.stringify({
      model: model.upstream,
      stream: true,
      max_tokens: model.maxOutputTokens,
      temperature: 0.2,
      messages: [{ role: 'system', content: injectSystem(input) }, ...input],
    }),
  });
}

/**
 * One gateway only. Fallback is model-to-model on that same gateway; there is
 * deliberately no Zen/Console gateway switching.
 */
export async function zenChatStream(model: string, messages: ChatMessage[], apiKey?: string, attachments: BuilderAttachment[] = []) {
  const requested = selectedModel(model);
  const order = [requested, ...ZEN_FREE_MODELS.filter(candidate => candidate.id !== requested.id)];
  const failures: Array<{ model: string; status: number; detail: string }> = [];

  for (const candidate of order) {
    let upstream: Response;
    try {
      upstream = await requestModel(candidate, messages, apiKey, attachments);
    } catch (error) {
      failures.push({ model: candidate.id, status: 0, detail: error instanceof Error ? error.message : 'Provider connection failed' });
      continue;
    }

    if (upstream.ok && upstream.body) {
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
          'X-ZYRAXON-Model': candidate.id,
          'X-ZYRAXON-Upstream': candidate.upstream,
        },
      });
    }

    const detail = (await upstream.text().catch(() => '')).slice(0, 1200);
    failures.push({ model: candidate.id, status: upstream.status, detail });

    // Authentication/configuration errors are not useful to retry with another
    // model. Rate limits, 404s and transient provider failures can be.
    if (upstream.status === 401 || upstream.status === 403) break;
  }

  const last = failures[failures.length - 1] || { status: 502, detail: 'No provider response' };
  const response = providerError(last.status || 502, requested, JSON.stringify({ tried: failures }));
  return response;
}

export async function testZenModel(model: string, apiKey?: string) {
  const selected = selectedModel(model);
  try {
    const response = await fetch(ZEN_CHAT_URL, {
      method: 'POST',
      headers: headers(apiKey),
      body: JSON.stringify({
        model: selected.upstream,
        stream: false,
        max_tokens: 8,
        messages: [
          { role: 'system', content: 'Reply with OK.' },
          { role: 'user', content: 'health check' },
        ],
      }),
    });
    const detail = await response.text().catch(() => '');
    return { ok: response.ok, status: response.status, model: selected.id, upstream: selected.upstream, detail: detail.slice(0, 1200) };
  } catch (error) {
    return { ok: false, status: 0, model: selected.id, upstream: selected.upstream, detail: error instanceof Error ? error.message : 'Provider connection failed' };
  }
}

export async function discoverConsoleModels(apiKey?: string) {
  try {
    const response = await fetch(ZEN_MODELS_URL, { headers: headers(apiKey) });
    const data = await response.json().catch(() => null);
    const ids = Array.isArray(data?.data) ? data.data.map((item: any) => String(item?.id || '')).filter(Boolean) : [];
    return { ok: response.ok, status: response.status, ids };
  } catch (error) {
    return { ok: false, status: 0, ids: [], detail: error instanceof Error ? error.message : 'Model discovery failed' };
  }
}
