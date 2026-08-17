/** OpenCode Console gateway integration for the ZYRAXON Builder. */
export const ZEN_BASE = 'https://console.opencode.ai/inference/openai/v1';

export type ZenModel = {
  id: string;
  label: string;
  blurb: string;
  upstream: string;
  free?: boolean;
  contextWindowTokens: number;
  maxOutputTokens: number;
  multimodal?: boolean;
};

/**
 * UI names intentionally map to the real upstream models used by the Builder:
 * T10 -> MiMo-V2.5 Free, Vector -> Big Pickle, Phantom -> Nemotron 3 Super Free.
 * MiMo-V2.5 officially supports text, image, audio and video inputs.
 */
export const ZEN_FREE_MODELS: ZenModel[] = [
  {
    id: 'zyraxon-t10',
    label: 'ZYRAXON T10',
    blurb: 'MiMo-V2.5 · multimodal · maximum context',
    upstream: 'mimo-v2.5-free',
    free: true,
    contextWindowTokens: 1000000,
    maxOutputTokens: 131072,
    multimodal: true,
  },
  {
    id: 'zyraxon-vector',
    label: 'ZYRAXON VECTOR',
    blurb: 'Big Pickle · fast autonomous building',
    upstream: 'big-pickle',
    free: true,
    contextWindowTokens: 200000,
    maxOutputTokens: 32768,
    multimodal: false,
  },
  {
    id: 'zyraxon-phantom',
    label: 'ZYRAXON PHANTOM',
    blurb: 'Nemotron · deep reasoning · builder',
    upstream: 'nemotron-3-super-free',
    free: true,
    contextWindowTokens: 200000,
    maxOutputTokens: 131072,
    multimodal: false,
  },
];

export const DEFAULT_ZEN_MODEL = ZEN_FREE_MODELS[0]!.id;

export const BUILDER_SYSTEM_PROMPT = `CRITICAL ROLE — ZYRAXON AI IS A VERY POWERFUL PRODUCTION BUILDER
You are ZYRAXON AI: an autonomous, professional-grade software engineer, product engineer, UI/UX designer, document generator, and long-running implementation agent. Treat every build request as real production work. Understand the goal, plan it, implement it completely, verify it, and keep working until the requested result is genuinely finished.

NON-NEGOTIABLE BUILDER STANDARD
- Work like a highly skilled professional engineer and designer, not a chatbot that only explains.
- Own architecture, implementation quality, UX, accessibility, responsive behavior, correctness, error handling, and completion.
- Never use a fixed or predetermined file list. Decide dynamically which files, folders, assets, configuration, routes, styles, utilities, tests, and other artifacts are actually required.
- When a complete website/app/project is requested, create a COMPLETE working project. Do not return a skeleton, mockup, placeholder, one-file shortcut, or prose-only answer.
- If the project needs HTML, CSS, JavaScript/TypeScript, components, assets, configuration, data, routing, or other supporting files, create all of them. Do not inline everything into one file just to finish faster.
- Never silently omit difficult work. Never declare completion until the implementation exists.
- Preserve existing project behavior unless the user explicitly requests a change.

EVERY REQUEST
1. Understand the current request plus the existing project/session context.
2. Maintain a concrete TODO plan for non-trivial work.
3. Execute the plan in dependency order and stream useful implementation progress.
4. Reconcile the plan with previous turns instead of restarting.
5. Validate cross-file references, runtime behavior, preview behavior, visual quality, and obvious failure cases.
6. Keep working for as long as the model output budget permits. If the task is larger than one response, leave an accurate TODO state and continue from it on the next turn.

TODO PROTOCOL
Use exactly this marker for a non-trivial task:
<builder-todo>[{"id":"step-1","task":"...","status":"pending"},{"id":"step-2","task":"...","status":"in_progress"}]</builder-todo>
Allowed status: pending, in_progress, done, blocked. Mark done only after the work is actually complete and checked.

CLARIFICATION AUTHORITY
- You MAY ask one concise, targeted question if a genuinely missing or contradictory requirement would materially change the correct implementation.
- Do not ask questions merely to avoid work. Finish all unblocked work first and continue after the answer.
- If a safe professional default exists, choose it and proceed.

FILE OUTPUT CONTRACT
- Every generated or modified file MUST be emitted as a fenced code block.
- The first line inside every file block MUST be exactly: file: relative/path.ext
- Return complete contents for changed files. Never use ellipses, partial snippets, or tiny replacement stubs for large existing files.
- Do not constrain yourself to a named set of file types. Choose the complete architecture appropriate to the actual request.

PREVIEW / QUALITY
- The Builder preview must represent the real generated project, not merely show raw HTML text.
- Wire CSS, JS/TS, assets, routes, and configuration together correctly.
- Do not declare a website complete if its styling or behavior is missing.
- At the end of substantial work, request verification with:
  <builder-tool>{"tool":"preview.verify","reason":"Final production verification before completion"}</builder-tool>
- Only report completion after verification is available and the TODO state is accurate.

PDF TOOL
- If a PDF is requested, CREATE it. Do not merely say you created it.
- Emit exactly one request in this shape:
  <builder-tool>{"tool":"pdf.create","title":"...","content":"..."}</builder-tool>
- Content must be the complete human-readable document.
- The Builder renders the PDF locally, previews it in-app, and exposes download only for the generated PDF.

GITHUB / EXPORT
- project.zip and project.download are handled by the Builder UI.
- GitHub operations apply only to the repository explicitly selected by the user.
- Never claim GitHub sync/publish succeeded unless the Builder reports success.

MULTIMODAL INPUT
- If media is attached, inspect it and use it as part of the user's request when the selected model supports it.
- ZYRAXON T10 is the Builder's multimodal model and can receive image, audio, and video input.
- Do not invent observations about an attachment you cannot actually access.

SECURITY
- Never expose or invent API keys, GitHub tokens, passwords, cookies, private credentials, or hidden reasoning.
- Never put secrets into generated project files.

COMMUNICATION
- Keep ordinary prose concise and implementation-focused.
- Do not dump hidden chain-of-thought.
- Do not repeatedly ask for requirements already present in context.

FINAL QUALITY GATE
Before saying complete, confirm: every requested capability is implemented; complete files exist; references/imports are coherent; preview/runtime is wired; responsive UX is polished; PDF/tool requests were actually emitted when requested; TODO status reflects reality; and verification has been performed.`;

export type ContentPart =
  | { type: 'text'; text: string }
  | { type: 'image_url'; image_url: { url: string } }
  | { type: 'input_audio'; input_audio: { data: string } }
  | { type: 'video_url'; video_url: { url: string }; fps?: number };

export type ChatMessage = {
  role: 'system' | 'user' | 'assistant';
  content: string | ContentPart[];
};

export type BuilderAttachment = {
  name: string;
  mime: string;
  data: string;
};

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

export function resolveZenModel(model: string) {
  return ZEN_FREE_MODELS.find(candidate => candidate.id === model);
}

function textFromContent(content: string | ContentPart[]) {
  if (typeof content === 'string') return content;
  return content.filter((part): part is { type: 'text'; text: string } => part.type === 'text').map(part => part.text).join('\n');
}

function buildInjectedSystemPrompt(messages: ChatMessage[]) {
  const lastUser = [...messages].reverse().find(message => message.role === 'user');
  const excerpt = lastUser ? textFromContent(lastUser.content) : '';
  return `${BUILDER_SYSTEM_PROMPT}\n\nPER-TURN EXECUTION DIRECTIVE\n- Apply this instruction to the user's current request now.\n- Current request excerpt (context only): ${excerpt.slice(0, 8000)}\n- Treat unfinished TODO items from prior assistant output as active work unless explicitly cancelled.\n- Stream implementation continuously when possible.\n- If a materially important decision cannot be inferred safely, ask one concise targeted question while continuing all independent work.`;
}

function requestInput(messages: ChatMessage[]) {
  return messages.slice(-32).map(message => {
    if (typeof message.content === 'string') return { ...message, content: message.content.slice(0, 30000) };
    return message;
  });
}

function attachToLastUser(messages: ChatMessage[], attachments: BuilderAttachment[], selected: ZenModel) {
  if (!attachments.length) return messages;
  const next = [...messages];
  const index = [...next].reverse().findIndex(message => message.role === 'user');
  if (index < 0) return next;
  const target = next.length - 1 - index;
  const base = textFromContent(next[target]!.content);
  if (!selected.multimodal) {
    next[target] = {
      role: 'user',
      content: `${base}\n\nAttachments were provided by the user (${attachments.map(a => `${a.name} — ${a.mime}`).join(', ')}). The selected model cannot directly inspect these media bytes; do not invent observations.`,
    };
    return next;
  }
  const parts: ContentPart[] = [{ type: 'text', text: base }];
  for (const file of attachments) {
    if (file.mime.startsWith('image/')) {
      parts.push({ type: 'image_url', image_url: { url: file.data } });
    } else if (file.mime.startsWith('audio/')) {
      parts.push({ type: 'input_audio', input_audio: { data: file.data } });
    } else if (file.mime.startsWith('video/')) {
      parts.push({ type: 'video_url', video_url: { url: file.data }, fps: 1 });
    }
  }
  next[target] = { role: 'user', content: parts };
  return next;
}

async function requestStream(model: string, messages: ChatMessage[], apiKey?: string, attachments: BuilderAttachment[] = []) {
  const selected = resolveZenModel(model) || ZEN_FREE_MODELS[0]!;
  const inputMessages = attachToLastUser(requestInput(messages), attachments, selected);
  return fetch(`${ZEN_BASE}/chat/completions`, {
    method: 'POST',
    headers: authHeaders(apiKey),
    body: JSON.stringify({
      model: selected.upstream,
      stream: true,
      max_tokens: selected.maxOutputTokens,
      temperature: 0.2,
      messages: [{ role: 'system', content: buildInjectedSystemPrompt(inputMessages) }, ...inputMessages],
    }),
  });
}

export async function zenChatStream(model: string, messages: ChatMessage[], apiKey?: string, attachments: BuilderAttachment[] = []): Promise<Response> {
  const compact = requestInput(messages);
  let upstream: Response;
  try {
    upstream = await requestStream(model, compact, apiKey, attachments);
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
  const selected = resolveZenModel(model) || ZEN_FREE_MODELS[0]!;
  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
      'Access-Control-Allow-Origin': '*',
      'X-ZYRAXON-Model': model,
      'X-ZYRAXON-Upstream': selected.upstream,
      'X-ZYRAXON-Context-Window': String(selected.contextWindowTokens),
      'X-ZYRAXON-Max-Output-Tokens': String(selected.maxOutputTokens),
    },
  });
}

export async function testZenModel(model: string, apiKey?: string) {
  try {
    const selected = resolveZenModel(model) || ZEN_FREE_MODELS[0]!;
    const response = await fetch(`${ZEN_BASE}/chat/completions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {}) },
      body: JSON.stringify({
        model: selected.upstream,
        stream: false,
        max_tokens: 8,
        messages: [{ role: 'system', content: BUILDER_SYSTEM_PROMPT }, { role: 'user', content: 'Reply with OK.' }],
      }),
    });
    const text = await response.text().catch(() => '');
    return { ok: response.ok, status: response.status, detail: response.ok ? undefined : text.slice(0, 600) };
  } catch (error) {
    return { ok: false, status: 0, detail: error instanceof Error ? error.message : 'Provider connection failed' };
  }
}
