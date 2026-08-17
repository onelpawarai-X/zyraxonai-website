/** OpenCode Console gateway integration for the current builder model tier. */
export const ZEN_BASE = 'https://console.opencode.ai/inference/openai/v1';
export type ZenModel = { id: string; label: string; blurb: string; upstream: string; free?: boolean };
export const ZEN_FREE_MODELS: ZenModel[] = [
  { id: 'zyraxon-titan', label: 'ZYRAXON TITAN', blurb: 'Maximum reasoning · builder', upstream: 'mimo-v2.5-free', free: true },
  { id: 'zyraxon-phantom', label: 'ZYRAXON PHANTOM', blurb: 'Deep reasoning · builder', upstream: 'nemotron-3-super-free', free: true },
  { id: 'zyraxon-velocity', label: 'ZYRAXON VELOCITY', blurb: 'Ultra-fast building · builder', upstream: 'big-pickle', free: true },
];
export const DEFAULT_ZEN_MODEL = ZEN_FREE_MODELS[0]!.id;

export const BUILDER_SYSTEM_PROMPT = `You are ZYRAXON AI, an autonomous production web engineer and product designer.

CORE RULES:
- Do the work, do not give a tutorial.
- Be concise outside file output. Never paste implementation code into normal prose.
- When the user asks for a complete website/app/project, build a COMPLETE working result, not a skeleton or just text. Create every required file: HTML, CSS, JS/TS/React, config/data/assets placeholders as appropriate.
- If styling or behavior is required, actually create the CSS and JS/TS files and make the entry file reference them correctly.
- When modifying a project, return complete contents for every changed file.

FILE OUTPUT CONTRACT:
- Every generated file MUST be a fenced block.
- The first line inside each block MUST be exactly `file: relative/path.ext`.
- Example: ```html then `file: index.html` on the next line, followed by the complete file.
- Use as many files as the project needs. Do not force a three-file limit.
- Keep each file self-contained and valid for its language.

PDF TOOL CONTRACT:
- When the user asks you to create a PDF, do not merely say it is complete. Emit exactly one builder tool request containing JSON: <builder-tool>{"tool":"pdf.create","title":"...","content":"..."}</builder-tool>
- Put the complete human-readable PDF content in `content`. The Builder renders it, previews it, and exposes the download button.

PROJECT TOOL CONTRACT:
- project.zip and project.download are handled by the Builder UI.
- GitHub actions operate only on the repository explicitly selected by the user.
- Never claim an external action succeeded unless the Builder reports success.

SECURITY:
- Never expose or invent API keys, GitHub tokens, passwords, cookies, or hidden reasoning.
`;
export type ChatMessage = { role: 'system' | 'user' | 'assistant'; content: string };
function authHeaders(apiKey?: string): Record<string,string> { return { 'Content-Type':'application/json', Accept:'text/event-stream', ...(apiKey ? { Authorization:`Bearer ${apiKey}` } : {}) }; }
function providerError(status:number, model:string, detail:string):Response { let error=`ZYRAXON model gateway error ${status}`; if(status===401)error='This model requires a valid provider key.'; if(status===403)error='The model gateway rejected this request.'; if(status===429)error='Model gateway rate limit reached. Try another model or retry shortly.'; if(status>=500)error='The model gateway is temporarily unavailable. Try another model.'; return new Response(JSON.stringify({error,detail,provider:'zyraxon',model}),{status:status>=400&&status<600?status:502,headers:{'Content-Type':'application/json','Access-Control-Allow-Origin':'*'}}); }
export function resolveZenModel(model:string){ return ZEN_FREE_MODELS.find(candidate=>candidate.id===model); }
async function requestStream(model:string,messages:ChatMessage[],apiKey?:string){ const selected=resolveZenModel(model)||ZEN_FREE_MODELS[0]!; return fetch(`${ZEN_BASE}/chat/completions`,{method:'POST',headers:authHeaders(apiKey),body:JSON.stringify({model:selected.upstream,stream:true,max_tokens:8000,messages:[{role:'system',content:BUILDER_SYSTEM_PROMPT},...messages]})}); }
export async function zenChatStream(model:string,messages:ChatMessage[],apiKey?:string):Promise<Response>{ const compact=messages.slice(-8).map(message=>({...message,content:message.content.slice(0,18000)})); let upstream:Response; try{upstream=await requestStream(model,compact,apiKey)}catch(error){return providerError(502,model,error instanceof Error?error.message:'Provider connection failed')} if(!upstream.ok||!upstream.body){const text=await upstream.text().catch(()=> '');return providerError(upstream.status||502,model,text.slice(0,1200))} const stream=new ReadableStream<Uint8Array>({async start(controller){const reader=upstream.body!.getReader();try{while(true){const {done,value}=await reader.read();if(done)break;if(value)controller.enqueue(value)}controller.close()}catch(error){controller.error(error)}finally{reader.releaseLock()}}}); return new Response(stream,{headers:{'Content-Type':'text/event-stream; charset=utf-8','Cache-Control':'no-cache, no-transform','Connection':'keep-alive','X-Accel-Buffering':'no','Access-Control-Allow-Origin':'*','X-ZYRAXON-Model':model}}); }
export async function testZenModel(model:string,apiKey?:string){ try{const selected=resolveZenModel(model)||ZEN_FREE_MODELS[0]!;const response=await fetch(`${ZEN_BASE}/chat/completions`,{method:'POST',headers:{'Content-Type':'application/json',...(apiKey?{Authorization:`Bearer ${apiKey}`}: {})},body:JSON.stringify({model:selected.upstream,stream:false,max_tokens:8,messages:[{role:'user',content:'Reply with OK.'}]})});const text=await response.text().catch(()=> '');return{ok:response.ok,status:response.status,detail:response.ok?undefined:text.slice(0,600)}}catch(error){return{ok:false,status:0,detail:error instanceof Error?error.message:'Provider connection failed'}} }
