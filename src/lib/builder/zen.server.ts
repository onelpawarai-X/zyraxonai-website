/** OpenCode Zen provider integration for the free model tier. */

export const ZEN_BASE = 'https://opencode.ai/zen/v1';

export type ZenModel = { id: string; label: string; blurb: string };

/** Current OpenCode Zen models documented as Free. */
export const ZEN_FREE_MODELS: ZenModel[] = [
  { id: 'deepseek-v4-flash-free', label: 'DeepSeek V4 Flash Free', blurb: 'Fast coding' },
  { id: 'mimo-v2.5-free', label: 'MiMo V2.5 Free', blurb: 'Balanced reasoning' },
  { id: 'laguna-s-2.1-free', label: 'Laguna S 2.1 Free', blurb: 'Lightweight' },
  { id: 'ling-3.0-flash-free', label: 'Ling 3.0 Flash Free', blurb: 'Fast generation' },
  { id: 'ling-3.0-tiny-free', label: 'Ling 3.0 Tiny Free', blurb: 'Ultra light' },
  { id: 'north-mini-code-free', label: 'North Mini Code Free', blurb: 'Code focused' },
  { id: 'nemotron-3-ultra-free', label: 'Nemotron 3 Ultra Free', blurb: 'Deep reasoning' },
  { id: 'longcat-2.0-free', label: 'LongCat 2.0 Free', blurb: 'Long context' },
];

export const DEFAULT_ZEN_MODEL = ZEN_FREE_MODELS[0]!.id;

export const BUILDER_SYSTEM_PROMPT = `You are ZYRAXON Blueprint, an elite web engineer that builds world-class responsive websites.

CRITICAL RULES:
1. Always reply with ONE complete, self-contained HTML document inside a single \\`\\`\\`html code fence.
2. Everything MUST be inline: CSS in <style>, JS in <script>, fonts via CDN <link>. No external files or build steps.
3. Use premium dark-first visual design, glass surfaces, gradients, responsive CSS, subtle animation and excellent spacing.
4. Make every generated website production-ready, semantic and accessible.
5. Make all requested interactions actually work in the generated page.
6. When the user asks for a change, output the FULL updated HTML document.
7. Before the code fence, write exactly one short sentence describing the change.
8. Never expose or request GitHub tokens, passwords or other secrets in generated code. Deployment credentials are handled separately by ZYRAXON.
9. Make it look expensive. Every pixel matters.`;

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
    return new Response(JSON.stringify({ error: `Zen error ${upstream.status}`, detail: text.slice(0, 800) }), {
      status: 502,
      headers: { 'Content-Type': 'application/json' },
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
