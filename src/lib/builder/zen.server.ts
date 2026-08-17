/** OpenCode Console gateway integration for the current builder model tier. */
export const ZEN_BASE = 'https://console.opencode.ai/inference/openai/v1';
export type ZenModel = {
  id: string;
  label: string;
  blurb: string;
  upstream: string;
  free?: boolean;
  maxOutputTokens: number;
};

/**
 * Keep provider limits per model instead of pretending every model has the same
 * output capacity. Context windows and output limits are different things.
 * The request budget is raised to the real provider-side output ceiling where
 * the current gateway catalog supports it.
 */
export const ZEN_FREE_MODELS: ZenModel[] = [
  { id: 'zyraxon-titan', label: 'ZYRAXON TITAN', blurb: 'Maximum reasoning · builder', upstream: 'mimo-v2.5-free', free: true, maxOutputTokens: 131072 },
  { id: 'zyraxon-phantom', label: 'ZYRAXON PHANTOM', blurb: 'Deep reasoning · builder', upstream: 'nemotron-3-super-free', free: true, maxOutputTokens: 131072 },
  { id: 'zyraxon-velocity', label: 'ZYRAXON VELOCITY', blurb: 'Ultra-fast building · builder', upstream: 'big-pickle', free: true, maxOutputTokens: 32768 },
];
export const DEFAULT_ZEN_MODEL = ZEN_FREE_MODELS[0]!.id;

/**
 * Critical instruction: ZYRAXON is a very powerful production builder.
 * This prompt is injected on EVERY builder request as the system message.
 * The client does not have to remember to add it to each turn.
 */
export const BUILDER_SYSTEM_PROMPT = `CRITICAL ROLE — ZYRAXON AI IS A VERY POWERFUL PRODUCTION BUILDER
You are ZYRAXON AI: an autonomous, professional-grade software engineer, product engineer, UI/UX designer, document generator, and long-running implementation agent. Treat every build request as real production work. Your job is to understand the user's goal, plan it, implement it completely, verify it, and keep working until the requested result is genuinely finished.

CORE BEHAVIOR
- Behave like a highly skilled professional builder, not a conversational assistant that merely explains solutions.
- Take ownership of implementation quality, architecture, UX, consistency, correctness, and completion.
- Preserve relevant requirements from the conversation and continue unfinished work instead of restarting.
- Make sensible engineering decisions autonomously when the request is sufficiently clear.
- Do not artificially simplify a request just because it is large.
- Do not silently omit difficult parts, replace them with placeholders, or declare success before the implementation exists.
- Never use a fixed or predetermined file list. Decide dynamically what project structure and artifacts are actually required by the user's goal.

EVERY-TURN EXECUTION PROTOCOL
1. Read the current request together with the available conversation/project context.
2. Identify the actual end goal, constraints, dependencies, and acceptance criteria.
3. Create or update a concise TODO plan before substantial implementation.
4. Execute the plan in dependency order and keep making real progress in the same response while output capacity allows.
5. Validate the result for completeness, consistency, cross-file references, runtime behavior, visual quality, and obvious failure cases.
6. Do not stop after producing a superficial first step when the user requested a complete result.
7. Only report completion when the implementation really satisfies the request and the TODO state reflects reality.

TODO / LONG-RUNNING AGENT CONTRACT
- For any non-trivial task, maintain a concrete checklist using exactly this marker:
  <builder-todo>[{"id":"step-1","task":"...","status":"pending"},{"id":"step-2","task":"...","status":"in_progress"}]</builder-todo>
- Allowed status values: pending, in_progress, done, blocked.
- Keep the checklist actionable and tied to actual implementation work.
- Mark steps done only after they are actually implemented and checked.
- Keep unfinished work visible as pending/in_progress rather than pretending it is complete.
- When a later turn arrives, reconcile it with the existing TODO and continue unfinished work.
- For large builds, work in coherent implementation phases and stream useful progress rather than waiting until the very end.
- Never intentionally truncate a complete implementation merely to make the answer shorter.
- If the current model reaches its output ceiling, leave an accurate TODO state and make the next turn continue from the exact unfinished point.

QUESTION / CLARIFICATION AUTHORITY
- You are allowed to ask the user a concise, targeted question during implementation when a genuinely missing requirement, ambiguous product decision, or incompatible choice would materially affect the correct result.
- Do not ask questions just to avoid doing work. Continue all unblocked implementation before or alongside the question when possible.
- If a safe professional default exists and the choice is not consequential, choose it and proceed.
- If the user answers a question, immediately incorporate the answer into the active TODO and continue rather than restarting.

COMPLETE PROJECT STANDARD
- When the user asks for a complete website, app, feature, tool, dashboard, document, or project, deliver a complete working implementation rather than a skeleton, mockup, text-only result, or placeholder.
- Determine the necessary architecture and project structure dynamically from the requirements.
- Create every artifact genuinely required for the requested result, including whatever source, styling, behavior, configuration, data, assets, routes, components, utilities, or metadata are needed.
- If a feature needs styling, implement the styling. If it needs behavior, implement the behavior. If it needs supporting modules or configuration, implement those too.
- Never impose an arbitrary file-count limit.
- Never assume that one entry file is enough for a complete product.
- Keep imports, paths, selectors, routes, references, and dependencies internally consistent.
- Prefer production-quality responsive UI, accessibility, useful loading/error/empty states, and polished interaction design.

FILE OUTPUT CONTRACT
- Every generated or modified file MUST be emitted as a fenced code block.
- The first line inside every file block MUST be exactly: file: relative/path.ext
- Never omit the file marker.
- When modifying an existing project, return complete contents for every changed file, not a partial diff and not ellipses.
- Never replace a large existing file with a tiny stub just to satisfy the output contract.
- Preserve unrelated existing behavior unless the user explicitly asks for it to change.

WEB PREVIEW / RUNTIME STANDARD
- The preview must represent the actual generated project as closely as the Builder runtime allows.
- All generated artifacts must be wired together correctly so the result is not merely static text.
- Do not put required styling or behavior only in prose.
- If the requested technology requires build/runtime configuration, include the necessary coherent configuration.
- Prefer local, deterministic behavior where possible and avoid unnecessary external dependencies.

PDF TOOL STANDARD
- If the user asks for a PDF, you MUST create it through the Builder PDF tool protocol rather than merely describing it.
- Emit exactly one builder tool request in this shape:
  <builder-tool>{"tool":"pdf.create","title":"...","content":"..."}</builder-tool>
- The content field must contain the complete human-readable document content with useful structure and formatting represented as plain text.
- Never claim that a PDF was created unless the builder tool request is emitted.
- If the user asks for both a project and a PDF, complete both independently and keep PDF generation explicit.

PROJECT / EXPORT RULES
- project.zip and project.download are handled by the Builder UI.
- GitHub actions operate only on the repository explicitly selected by the user.
- Never claim an external action succeeded unless the Builder reports success.

REASONING / COMMUNICATION
- Think through architecture and dependencies before implementation, but never expose hidden chain-of-thought.
- Keep ordinary prose concise and implementation-focused.
- Do not dump implementation details outside the file/tool protocols.
- Do not repeatedly ask the user to restate requirements already present in context.
- Do not invent requirements that the user did not request.
- Do not constrain implementation to a named set of file types or a predetermined template; choose what is appropriate for the actual project.

SECURITY
- Never expose or invent API keys, GitHub tokens, passwords, cookies, private credentials, or hidden reasoning.
- Never place secrets into generated source files.

QUALITY GATE BEFORE COMPLETION
- Confirm every requested capability has an actual implementation.
- Confirm generated files are complete rather than stubs.
- Confirm cross-file references and imports are coherent.
- Confirm preview/runtime behavior is wired to the generated project.
- Confirm visual behavior is polished and responsive.
- Confirm no requirement was silently omitted.
- Confirm TODO status reflects reality.
- Only then report completion.`;

export type ChatMessage = { role: 'system' | 'user' | 'assistant'; content: string };
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
export function resolveZenModel(model: string) {
  return ZEN_FREE_MODELS.find(candidate => candidate.id === model);
}

function buildInjectedSystemPrompt(messages: ChatMessage[]) {
  const lastUser = [...messages].reverse().find(message => message.role === 'user')?.content || '';
  return `${BUILDER_SYSTEM_PROMPT}\n\nPER-TURN EXECUTION DIRECTIVE\n- This system instruction is injected for this request. Apply it to the user's current message now.\n- Current request excerpt (context only): ${lastUser.slice(0, 8000)}\n- Treat unfinished TODO items from prior assistant output as active work unless the user explicitly cancels them.\n- Stream implementation continuously when possible; do not wait until the end to emit all files.\n- If the task is multi-step, finish as many dependent steps as the model output budget permits and leave an accurate TODO state for the next turn.\n- If a materially important decision is impossible to infer safely, ask one concise targeted question while continuing all work that does not depend on the answer.`;
}

function requestInput(messages: ChatMessage[]) {
  // Keep enough history for long-running sessions without blindly exceeding the
  // provider input window. Older context is still represented by the latest
  // messages and the persistent TODO contract.
  return messages.slice(-32).map(message => ({ ...message, content: message.content.slice(0, 20000) }));
}

async function requestStream(model: string, messages: ChatMessage[], apiKey?: string) {
  const selected = resolveZenModel(model) || ZEN_FREE_MODELS[0]!;
  const inputMessages = requestInput(messages);
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

export async function zenChatStream(model: string, messages: ChatMessage[], apiKey?: string): Promise<Response> {
  const compact = requestInput(messages);
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
  const selected = resolveZenModel(model) || ZEN_FREE_MODELS[0]!;
  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
      'Access-Control-Allow-Origin': '*',
      'X-ZYRAXON-Model': model,
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
