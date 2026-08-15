/** OpenCode Zen provider integration for the current free model tier. */

export const ZEN_BASE = 'https://opencode.ai/zen/v1';

export type ZenModel = { id: string; label: string; blurb: string };

/** Free OpenCode Zen models documented by OpenCode. Availability is time-limited. */
export const ZEN_FREE_MODELS: ZenModel[] = [
  { id: 'big-pickle', label: 'Big Pickle', blurb: 'Stealth builder · free for a limited time' },
  { id: 'deepseek-v4-flash-free', label: 'DeepSeek V4 Flash Free', blurb: 'Fast coding · free for a limited time' },
  { id: 'mimo-v2.5-free', label: 'MiMo V2.5 Free', blurb: 'Balanced reasoning · free for a limited time' },
  { id: 'laguna-s-2.1-free', label: 'Laguna S 2.1 Free', blurb: 'General builder · free for a limited time' },
  { id: 'ling-3.0-flash-free', label: 'Ling 3.0 Flash Free', blurb: 'Fast generation · free for a limited time' },
  { id: 'north-mini-code-free', label: 'North Mini Code Free', blurb: 'Code focused · free for a limited time' },
  { id: 'nemotron-3-ultra-free', label: 'Nemotron 3 Ultra Free', blurb: 'Deep reasoning · free for a limited time' },
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

export async function zenChatStream(model: string, messages: ChatMessage[], apiKey?: string): Promise<Response> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (apiKey) headers.Authorization = `Bearer ${apiKey}`;

  const upstream = await fetch(`${ZEN_BASE}/chat/completions`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      model,
      stream: true,
      max_tokens: 16000,
      messages: [{ role: 'system', content: BUILDER_SYSTEM_PROMPT }, ...messages],
    }),
  });

  if (!upstream.ok || !upstream.body) {
    const text = await upstream.text().catch(() => '');
    return new Response(JSON.stringify({
      error: upstream.status === 401 ? 'OpenCode Zen authentication is required.' : `Zen error ${upstream.status}`,
      detail: text.slice(0, 800),
    }), {
      status: upstream.status === 401 ? 401 : 502,
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
