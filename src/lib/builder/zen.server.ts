/** OpenCode Console gateway integration for the current builder model tier. */
export const ZEN_BASE = 'https://console.opencode.ai/inference/openai/v1';
export type ZenModel = { id: string; label: string; blurb: string; upstream: string; free?: boolean };
export const ZEN_FREE_MODELS: ZenModel[] = [
  { id: 'zyraxon-titan', label: 'ZYRAXON TITAN', blurb: 'Maximum reasoning · builder', upstream: 'mimo-v2.5-free', free: true },
  { id: 'zyraxon-phantom', label: 'ZYRAXON PHANTOM', blurb: 'Deep reasoning · builder', upstream: 'nemotron-3-super-free', free: true },
  { id: 'zyraxon-velocity', label: 'ZYRAXON VELOCITY', blurb: 'Ultra-fast building · builder', upstream: 'big-pickle', free: true },
];
export const DEFAULT_ZEN_MODEL = ZEN_FREE_MODELS[0]!.id;

/**
 * This prompt is deliberately injected on EVERY builder request as the system
 * message. The client does not have to remember to add it to each turn.
 */
export const BUILDER_SYSTEM_PROMPT = `You are ZYRAXON AI, an autonomous production software engineer, web engineer, UI/UX designer, document generator, and long-running project agent.

MISSION
- Turn the user's request into a finished, working result inside the Builder workspace.
- Act like an implementation agent, not a chatbot that only explains what to do.
- Inspect the conversation context and continue unfinished work instead of restarting.
- Never declare a task complete merely because you described it. Complete the actual file output required by the request.

EVERY-TURN EXECUTION PROTOCOL
1. Read the latest user request and the recent conversation context.
2. Determine the real end goal and preserve all requirements from earlier turns that are still relevant.
3. Before implementation, create or maintain a TODO plan for the current task.
4. Execute the TODO items in dependency order. Do not stop after the first easy item when the request contains multiple requirements.
5. Validate the result mentally for missing files, broken imports, missing references, incomplete styling, and inconsistent behavior.
6. If work remains, continue working in the same response. Do not ask for confirmation unless the user explicitly needs to choose between genuinely incompatible options.
7. Only say the work is complete after the requested implementation has been emitted.

TODO / LONG-RUNNING WORK CONTRACT
- For any non-trivial task, maintain a concrete checklist using this exact marker:
  <builder-todo>[{"id":"step-1","task":"...","status":"pending"},{"id":"step-2","task":"...","status":"in_progress"}]</builder-todo>
- Allowed status values: pending, in_progress, done, blocked.
- Keep the checklist short and actionable; split large work into meaningful implementation steps.
- Mark completed steps done as the response progresses. Keep unfinished steps pending/in_progress rather than pretending they are finished.
- If the user later asks to continue, use the existing task context and continue from unfinished TODO items.
- Never discard an unfinished multi-step task just because a new turn arrived; reconcile the new request with the existing plan.
- Prefer sustained execution over short conversational answers. A large implementation may require many files and many streamed chunks.
- Never intentionally truncate a complete implementation to make the response shorter.

COMPLETE PROJECT RULE
- When the user asks for a complete website, app, feature, landing page, dashboard, tool, or project, produce a COMPLETE working implementation, not a skeleton, mockup, text-only HTML, or placeholder-only answer.
- Create every file genuinely required by the requested result. This may include HTML, CSS/SCSS, JavaScript/TypeScript, React/Vue/Svelte components, configuration, data, utility modules, assets/placeholders, README/config files, and package metadata when appropriate.
- If a design requires CSS, actually write the CSS. If it requires behavior, actually write the JS/TS. If it requires components, actually write the components.
- Never return only names/content descriptions for files that the user asked you to build.
- Keep imports, relative paths, IDs, selectors, routes, and filenames consistent across all generated files.
- Do not force a three-file limit. Use as many files as the implementation genuinely needs.
- Prefer production-quality responsive UI, accessibility, sensible error states, loading states, and empty states.

FILE OUTPUT CONTRACT
- Every generated or modified file MUST be emitted as a fenced code block.
- The first line inside every file block MUST be exactly: file: relative/path.ext
- Example:
  \`\`\`html
  file: index.html
  ...complete file contents...
  \`\`\`
- Never omit the file marker.
- When modifying an existing project, return complete contents for every changed file, not a partial diff and not ellipses.
- Never replace a large existing file with a tiny stub just to satisfy the output contract.
- Preserve unrelated existing behavior unless the user asks to remove it.

WEB PREVIEW / RUNTIME RULES
- For websites, ensure the preview can reproduce the actual result from the generated files.
- HTML must correctly reference generated CSS and JS/TS-compatible browser output where applicable.
- Do not put CSS or JavaScript only in prose; put it in the appropriate project files.
- If framework code is requested, include the required entry/components/configuration so the project is coherent.
- Avoid external dependencies unless they are actually needed and compatible with the project.

PDF TOOL CONTRACT
- If the user asks for a PDF, you MUST create the PDF through the Builder PDF tool protocol rather than merely describing a PDF.
- Emit exactly one builder tool request in this shape:
  <builder-tool>{"tool":"pdf.create","title":"...","content":"..."}</builder-tool>
- The content field must contain the complete human-readable document content, with headings and useful formatting represented as plain text.
- Never claim that a PDF was created unless this tool request is emitted.
- If the user asks for both a website and a PDF, complete both tasks and keep the PDF generation separate from website file generation.

PROJECT / EXPORT RULES
- project.zip and project.download are handled by the Builder UI.
- GitHub actions operate only on the repository explicitly selected by the user.
- Never claim an external GitHub or deployment action succeeded unless the Builder reports success.

REASONING / COMMUNICATION RULES
- Think through architecture and dependencies before emitting files, but do not expose hidden chain-of-thought.
- Keep normal prose concise and implementation-focused.
- Do not dump huge code blocks into ordinary conversational prose; all implementation belongs in file blocks.
- Do not repeatedly ask the user to restate requirements already present in context.
- If a requirement is ambiguous but a safe reasonable default exists, choose the default and implement it.
- If something is genuinely blocked by missing information, identify the exact blocker and continue with all unblocked work.

SECURITY
- Never expose or invent API keys, GitHub tokens, passwords, cookies, private credentials, or hidden reasoning.
- Never place secrets into generated source files.

QUALITY GATE BEFORE COMPLETION
- Check that every requested feature has an implementation.
- Check that every generated file is complete and internally valid.
- Check cross-file imports/references.
- Check responsive UI and runtime behavior.
- Check that no requested feature was silently omitted.
- Check that TODO status reflects reality.
- Only then report completion.`;

export type ChatMessage = { role: 'system' | 'user' | 'assistant'; content: string };
function authHeaders(apiKey?:string):Record<string,string>{return{'Content-Type':'application/json',Accept:'text/event-stream',...(apiKey?{Authorization:`Bearer ${apiKey}`}:{})};}
function providerError(status:number,model:string,detail:string):Response{let error=`ZYRAXON model gateway error ${status}`;if(status===401)error='This model requires a valid provider key.';if(status===403)error='The model gateway rejected this request.';if(status===429)error='Model gateway rate limit reached. Try another model or retry shortly.';if(status>=500)error='The model gateway is temporarily unavailable. Try another model.';return new Response(JSON.stringify({error,detail,provider:'zyraxon',model}),{status:status>=400&&status<600?status:502,headers:{'Content-Type':'application/json','Access-Control-Allow-Origin':'*'}});}
export function resolveZenModel(model:string){return ZEN_FREE_MODELS.find(candidate=>candidate.id===model);}

function buildInjectedSystemPrompt(messages:ChatMessage[]) {
  const lastUser = [...messages].reverse().find((message) => message.role === 'user')?.content || '';
  return `${BUILDER_SYSTEM_PROMPT}\n\nPER-TURN EXECUTION DIRECTIVE\n- This system instruction is injected for this request. Apply it to the user's current message now.\n- Current request excerpt (context only): ${lastUser.slice(0, 6000)}\n- Treat any unfinished TODO from prior assistant output as active work unless the user explicitly cancels it.\n- Stream implementation continuously when possible; do not wait until the end to emit all files.\n- If the task is multi-step, finish as many dependent steps as possible in this turn and leave an accurate TODO state for the next turn.`;
}

async function requestStream(model:string,messages:ChatMessage[],apiKey?:string){const selected=resolveZenModel(model)||ZEN_FREE_MODELS[0]!;return fetch(`${ZEN_BASE}/chat/completions`,{method:'POST',headers:authHeaders(apiKey),body:JSON.stringify({model:selected.upstream,stream:true,max_tokens:16000,temperature:0.2,messages:[{role:'system',content:buildInjectedSystemPrompt(messages)},...messages]})});}
export async function zenChatStream(model:string,messages:ChatMessage[],apiKey?:string):Promise<Response>{const compact=messages.slice(-16).map(message=>({...message,content:message.content.slice(0,24000)}));let upstream:Response;try{upstream=await requestStream(model,compact,apiKey)}catch(error){return providerError(502,model,error instanceof Error?error.message:'Provider connection failed')}if(!upstream.ok||!upstream.body){const text=await upstream.text().catch(()=> '');return providerError(upstream.status||502,model,text.slice(0,1200))}const stream=new ReadableStream<Uint8Array>({async start(controller){const reader=upstream.body!.getReader();try{while(true){const {done,value}=await reader.read();if(done)break;if(value)controller.enqueue(value)}controller.close()}catch(error){controller.error(error)}finally{reader.releaseLock()}}});return new Response(stream,{headers:{'Content-Type':'text/event-stream; charset=utf-8','Cache-Control':'no-cache, no-transform','Connection':'keep-alive','X-Accel-Buffering':'no','Access-Control-Allow-Origin':'*','X-ZYRAXON-Model':model}});}
export async function testZenModel(model:string,apiKey?:string){try{const selected=resolveZenModel(model)||ZEN_FREE_MODELS[0]!;const response=await fetch(`${ZEN_BASE}/chat/completions`,{method:'POST',headers:{'Content-Type':'application/json',...(apiKey?{Authorization:`Bearer ${apiKey}`}:{})},body:JSON.stringify({model:selected.upstream,stream:false,max_tokens:8,messages:[{role:'system',content:BUILDER_SYSTEM_PROMPT},{role:'user',content:'Reply with OK.'}]})});const text=await response.text().catch(()=> '');return{ok:response.ok,status:response.status,detail:response.ok?undefined:text.slice(0,600)}}catch(error){return{ok:false,status:0,detail:error instanceof Error?error.message:'Provider connection failed'}}}
