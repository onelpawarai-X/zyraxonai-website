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
 * ZYRAXON UI aliases for the active OpenCode Console models.
 * T10 -> MiMo-V2.5 Free (text/image/audio/video)
 * Vector -> Big Pickle
 * Phantom -> Nemotron 3 Ultra Free
 * Limits below are the current OpenCode-served model limits, not the upstream
 * model's theoretical limits.
 */
export const ZEN_FREE_MODELS: ZenModel[] = [
  { id: 'zyraxon-t10', label: 'ZYRAXON T10', blurb: 'MiMo-V2.5 Free · multimodal · 200K context · 32K output', upstream: 'mimo-v2.5-free', free: true, contextWindowTokens: 200_000, maxOutputTokens: 32_000, multimodal: true },
  { id: 'zyraxon-vector', label: 'ZYRAXON VECTOR', blurb: 'Big Pickle · 200K context · 32K output', upstream: 'big-pickle', free: true, contextWindowTokens: 200_000, maxOutputTokens: 32_000, multimodal: false },
  { id: 'zyraxon-phantom', label: 'ZYRAXON PHANTOM', blurb: 'Nemotron 3 Ultra Free · 1M context · 128K output', upstream: 'nemotron-3-ultra-free', free: true, contextWindowTokens: 1_000_000, maxOutputTokens: 128_000, multimodal: false },
];

export const DEFAULT_ZEN_MODEL = ZEN_FREE_MODELS[0]!.id;

export const BUILDER_SYSTEM_PROMPT = `CRITICAL ROLE — ZYRAXON AI IS A VERY POWERFUL PRODUCTION BUILDER
You are ZYRAXON AI: an autonomous, professional-grade software engineer, product engineer, UI/UX designer, document generator, and long-running implementation agent. Treat every request as real production work. Do not behave like a chatbot that merely explains what the user could do.

CORE STANDARD
- Work like an expert engineer and designer: reason about architecture, dependencies, UX, accessibility, responsiveness, correctness, error handling, performance and maintainability.
- Never constrain yourself to a predetermined file list. Decide dynamically which files, folders, assets, configuration, routes, styles, utilities, tests and supporting artifacts are required by the actual task.
- A request for a complete website/app/project means a COMPLETE working project. Never return a skeleton, placeholder, one-file shortcut, mockup-only result, or prose-only answer when implementation is requested.
- If HTML, CSS, JavaScript/TypeScript, components, assets, configuration, data, routes or other supporting files are required, create all required pieces and wire them together. Do not omit styling or behavior just because HTML is easier.
- Preserve existing behavior unless the user asks to change it. Inspect and extend the existing project instead of unnecessarily replacing it.
- Never declare completion merely because a response was generated. Completion means the requested implementation exists and has been checked.

LONG-RUNNING EXECUTION
1. Understand the current request and the existing project/session context.
2. For non-trivial work, maintain a TODO plan and keep it synchronized with reality.
3. Execute the plan in dependency order and continue through all unblocked work.
4. Reconcile prior unfinished work instead of restarting from scratch.
5. Validate cross-file references, runtime behavior, preview behavior, responsive behavior and obvious failure cases.
6. Use the available output budget for implementation rather than unnecessary explanation. If the task cannot fit in one turn, leave an accurate TODO state and continue from it on the next turn.

TODO PROTOCOL
For non-trivial work, emit:
<builder-todo>[{"id":"step-1","task":"...","status":"pending"},{"id":"step-2","task":"...","status":"in_progress"}]</builder-todo>
Allowed statuses: pending, in_progress, done, blocked. Mark a task done only after it is actually implemented and checked.

QUESTIONS
- You may ask one concise, targeted question when a genuinely missing or contradictory requirement would materially change the correct implementation.
- Do not ask questions to avoid work. Finish every independent/unblocked part first.
- When a safe professional default exists, choose it and continue.

FILE CONTRACT
- Every generated or modified file must be emitted as a fenced code block.
- The first line inside every file block must be exactly: file: relative/path.ext
- Return COMPLETE file contents. Never use ellipses, partial snippets, placeholder comments, or tiny stubs for large files.
- Choose the file structure dynamically. Never say or imply that only a named set of file types may be created.
- Keep each language/file in its own code block so the Builder can create separate project files.

WEBSITE QUALITY
- A complete website must include the styling and behavior needed to satisfy the request, not just semantic HTML.
- Wire CSS, JS/TS, assets, routes and configuration correctly.
- Do not leave dead links, broken local asset references, missing imports, placeholder text or unfinished sections when the request calls for a finished product.
- Before completion, request:
<builder-tool>{"tool":"preview.verify","reason":"Final production verification before completion"}</builder-tool>
- Only claim completion after the TODO state and verification reflect the actual workspace.

PDF TOOL
- If the user asks for a PDF, CREATE it. Do not merely claim that a PDF was created.
- Emit exactly one tool request:
<builder-tool>{"tool":"pdf.create","title":"...","content":"..."}</builder-tool>
- The content must be the complete human-readable document. The Builder will render it, preview it in-app and expose a PDF-only download action.

MEDIA
- ZYRAXON T10 is the multimodal model. When image, audio or video attachments are provided, inspect them when the model supports that modality and use the observations in the task.
- Never invent observations about media that you cannot actually access.

GITHUB / EXPORT
- Project ZIP/download operations are handled by the Builder UI.
- GitHub actions apply only to the repository explicitly selected by the user.
- Never claim that a GitHub sync or publish succeeded unless the Builder reports a successful operation.

SECURITY
- Never expose, invent or persist API keys, GitHub tokens, passwords, cookies, private credentials or hidden reasoning in generated project files.

COMMUNICATION
- Keep ordinary prose concise and implementation-focused.
- Do not dump hidden chain-of-thought.
- Do not repeat requirements that are already known.

FINAL QUALITY GATE
Before saying complete, confirm: every requested capability is implemented; the complete required file set exists; files reference each other correctly; preview/runtime is wired; visual and responsive quality is acceptable; PDF/tool requests were actually emitted when requested; TODO status is truthful; and final verification has been performed.`;

export type ContentPart =
  | { type: 'text'; text: string }
  | { type: 'image_url'; image_url: { url: string } }
  | { type: 'input_audio'; input_audio: { data: string } }
  | { type: 'video_url'; video_url: { url: string }; fps?: number };

export type ChatMessage = { role: 'system' | 'user' | 'assistant'; content: string | ContentPart[] };
export type BuilderAttachment = { name: string; mime: string; data: string };

function authHeaders(apiKey?: string): Record<string, string> {
  return { 'Content-Type': 'application/json', Accept: 'text/event-stream', ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {}) };
}

function providerError(status: number, model: string, detail: string): Response {
  let error = `ZYRAXON model gateway error ${status}`;
  if (status === 401) error = 'This model requires a valid provider key.';
  if (status === 403) error = 'The model gateway rejected this request.';
  if (status === 429) error = 'Model gateway rate limit reached. Try another model or retry shortly.';
  if (status >= 500) error = 'The model gateway is temporarily unavailable. Try another model.';
  return new Response(JSON.stringify({ error, detail, provider: 'zyraxon', model }), { status: status >= 400 && status < 600 ? status : 502, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' } });
}

export function resolveZenModel(model: string) { return ZEN_FREE_MODELS.find(candidate => candidate.id === model); }

function textFromContent(content: string | ContentPart[]) {
  if (typeof content === 'string') return content;
  return content.filter((part): part is { type: 'text'; text: string } => part.type === 'text').map(part => part.text).join('\n');
}

function buildInjectedSystemPrompt(messages: ChatMessage[]) {
  const lastUser = [...messages].reverse().find(message => message.role === 'user');
  const excerpt = lastUser ? textFromContent(lastUser.content) : '';
  return `${BUILDER_SYSTEM_PROMPT}\n\nPER-TURN EXECUTION DIRECTIVE\n- Apply the builder contract to the current request now.\n- Current request excerpt (context only): ${excerpt.slice(0, 8000)}\n- Treat unfinished TODO items from previous turns as active work unless explicitly cancelled.\n- Continue all independent work before asking a question.\n- Stream implementation continuously when possible.`;
}

function requestInput(messages: ChatMessage[]) {
  return messages.slice(-32).map(message => typeof message.content === 'string' ? { ...message, content: message.content.slice(0, 30000) } : message);
}

function attachToLastUser(messages: ChatMessage[], attachments: BuilderAttachment[], selected: ZenModel) {
  if (!attachments.length) return messages;
  const next = [...messages];
  const reverseIndex = [...next].reverse().findIndex(message => message.role === 'user');
  if (reverseIndex < 0) return next;
  const target = next.length - 1 - reverseIndex;
  const base = textFromContent(next[target]!.content);
  if (!selected.multimodal) {
    next[target] = { role: 'user', content: `${base}\n\nThe user attached media (${attachments.map(a => `${a.name} — ${a.mime}`).join(', ')}), but the selected model is text-only. Do not invent observations about the media.` };
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

async function requestStream(model: string, messages: ChatMessage[], apiKey?: string, attachments: BuilderAttachment[] = []) {
  const selected = resolveZenModel(model) || ZEN_FREE_MODELS[0]!;
  const inputMessages = attachToLastUser(requestInput(messages), attachments, selected);
  return fetch(`${ZEN_BASE}/chat/completions`, { method: 'POST', headers: authHeaders(apiKey), body: JSON.stringify({ model: selected.upstream, stream: true, max_tokens: selected.maxOutputTokens, temperature: 0.2, messages: [{ role: 'system', content: buildInjectedSystemPrompt(inputMessages) }, ...inputMessages] }) });
}

export async function zenChatStream(model: string, messages: ChatMessage[], apiKey?: string, attachments: BuilderAttachment[] = []): Promise<Response> {
  let upstream: Response;
  try { upstream = await requestStream(model, messages, apiKey, attachments); } catch (error) { return providerError(502, model, error instanceof Error ? error.message : 'Provider connection failed'); }
  if (!upstream.ok || !upstream.body) return providerError(upstream.status || 502, model, (await upstream.text().catch(() => '')).slice(0, 1200));
  const stream = new ReadableStream<Uint8Array>({ async start(controller) { const reader = upstream.body!.getReader(); try { while (true) { const { done, value } = await reader.read(); if (done) break; if (value) controller.enqueue(value); } controller.close(); } catch (error) { controller.error(error); } finally { reader.releaseLock(); } } });
  const selected = resolveZenModel(model) || ZEN_FREE_MODELS[0]!;
  return new Response(stream, { headers: { 'Content-Type': 'text/event-stream; charset=utf-8', 'Cache-Control': 'no-cache, no-transform', Connection: 'keep-alive', 'X-Accel-Buffering': 'no', 'Access-Control-Allow-Origin': '*', 'X-ZYRAXON-Model': model, 'X-ZYRAXON-Upstream': selected.upstream, 'X-ZYRAXON-Context-Window': String(selected.contextWindowTokens), 'X-ZYRAXON-Max-Output-Tokens': String(selected.maxOutputTokens) } });
}

export async function testZenModel(model: string, apiKey?: string) {
  try {
    const selected = resolveZenModel(model) || ZEN_FREE_MODELS[0]!;
    const response = await fetch(`${ZEN_BASE}/chat/completions`, { method: 'POST', headers: { 'Content-Type': 'application/json', ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {}) }, body: JSON.stringify({ model: selected.upstream, stream: false, max_tokens: 8, messages: [{ role: 'system', content: BUILDER_SYSTEM_PROMPT }, { role: 'user', content: 'Reply with OK.' }] }) });
    const text = await response.text().catch(() => '');
    return { ok: response.ok, status: response.status, detail: response.ok ? undefined : text.slice(0, 600) };
  } catch (error) { return { ok: false, status: 0, detail: error instanceof Error ? error.message : 'Provider connection failed' }; }
}
