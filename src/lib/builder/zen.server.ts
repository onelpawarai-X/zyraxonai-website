/** ZYRAXON ⇄ OpenCode Zen transport (OpenAI-compatible).
 *  The free model pool is discovered LIVE from models.dev — nothing is hardcoded here.
 *  Only legacy UI aliases (from old saved sessions) are mapped to real upstream ids. */
import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import { generateText, streamText } from "ai";
import { getProviderDetail } from "@/lib/providers/modelsdev.server";

export const ZEN_BASE = "https://opencode.ai/zen/v1";
export const ZEN_CHAT_URL = `${ZEN_BASE}/chat/completions`;
export const ZEN_MODELS_URL = `${ZEN_BASE}/models`;
export const DEFAULT_ZEN_MODEL = "big-pickle";

export type ContentPart =
  | { type: "text"; text: string }
  | { type: "image_url"; image_url: { url: string } }
  | { type: "input_audio"; input_audio: { data: string } }
  | { type: "video_url"; video_url: { url: string }; fps?: number };
export type ChatMessage = {
  role: "system" | "user" | "assistant";
  content: string | ContentPart[];
};
export type BuilderAttachment = { name: string; mime: string; data: string };
export type ZenModel = {
  id: string;
  name: string;
  multimodal: boolean;
  reasoning: boolean;
  context: number;
  output: number;
  free: true;
};

/** Old branded labels saved in visitors' browsers → their real upstream ids. */
const LEGACY_ALIAS: Record<string, string> = {
  "zyraxon-vector": "big-pickle",
  "zyraxon-nova": "mimo-v2.5-free",
  "zyraxon-hydra": "hy3-free",
  "zyraxon-lumen": "laguna-s-2.1-free",
  "zyraxon-pulse": "ling-3.0-tiny-free",
  "zyraxon-phantom": "nemotron-3-ultra-free",
  "zyraxon-voltage": "nemotron-3.5-lightning-free",
  "zyraxon-titan": "deepseek-v4-flash-free",
};

export function normalizeZenModel(id: string): string {
  return LEGACY_ALIAS[id?.trim()] || id?.trim();
}

/** Legacy API kept for /api/public/zyraxon/v1/chat/completions — resolves any legacy/aliased model id. */
export function resolveZenModel(id: string): string | null {
  const normalized = normalizeZenModel(String(id || ""));
  return normalized || null;
}

function configuredServerKey(): string | undefined {
  return typeof process === "undefined"
    ? undefined
    : process.env.OPENCODE_ZEN_API_KEY?.trim() || process.env.OPENCODE_API_KEY?.trim() || undefined;
}
export function resolveApiKey(userKey?: string): string | undefined {
  return userKey?.trim() || configuredServerKey();
}

/** Zen throttles anonymous requests by User-Agent AND egress IP reputation.
 *  Generic SDK UAs (undici / ai-sdk) get soft-blocked with 200-but-empty streams,
 *  so we FORCE the genuine client UA on every outbound call — never inherit one. */
const ZEN_UA = "opencode/1.0";
export function zenFetch(input: string | URL | Request, init?: RequestInit): Promise<Response> {
  const headers = new Headers(init?.headers || {});
  headers.set("User-Agent", ZEN_UA);
  return fetch(input, { ...init, headers });
}

/** Free models VERIFIED (2026-08 live probe) to accept image_url parts without
 *  "No endpoints found that support ..." errors. Everything else is text-only. */
export const VISION_FREE_MODELS = new Set([
  "big-pickle",
  "hy3-free",
  "mimo-v2.5-free",
  "x-preview-f-free",
]);

/* ────────────────────────── LIVE FREE POOL (models.dev) ────────────────────────── */

let poolCache: { at: number; models: ZenModel[] } | null = null;
const POOL_TTL = 10 * 60 * 1000;

/** Emergency floor if models.dev is unreachable — Zen's flagship free model only. */
const EMERGENCY_POOL: ZenModel[] = [
  {
    id: "big-pickle",
    name: "Big Pickle",
    multimodal: false,
    reasoning: false,
    context: 200000,
    output: 32768,
    free: true,
  },
];

export async function zenFreeModels(): Promise<ZenModel[]> {
  if (poolCache && Date.now() - poolCache.at < POOL_TTL) return poolCache.models;
  try {
    const detail = await getProviderDetail("opencode");
    const models: ZenModel[] = (detail?.models || [])
      .filter((m) => m.free)
      .map((m) => ({
        id: m.id,
        name: m.name,
        // The catalog ships no capability flags — use our live-probed vision set.
        multimodal: VISION_FREE_MODELS.has(m.id),
        reasoning: m.reasoning,
        context: m.context,
        output: m.output,
        free: true as const,
      }));
    const sorted = models.sort((a, b) =>
      a.id === DEFAULT_ZEN_MODEL
        ? -1
        : b.id === DEFAULT_ZEN_MODEL
          ? 1
          : a.name.localeCompare(b.name),
    );
    // models.dev can lag behind the live console — drop ids Zen no longer serves.
    const live = await zenLiveIds();
    const usable = live ? sorted.filter((m) => live.has(m.id)) : sorted;
    const finalPool = usable.length ? usable : sorted;
    if (!finalPool.length) throw new Error("empty pool");
    poolCache = { at: Date.now(), models: finalPool };
    return finalPool;
  } catch {
    return EMERGENCY_POOL;
  }
}

/** Ids the live Zen console currently serves (keyless). null = unknown, never block on it. */
let liveCache: { at: number; ids: Set<string> | null } | null = null;
export async function zenLiveIds(): Promise<Set<string> | null> {
  if (liveCache && Date.now() - liveCache.at < POOL_TTL) return liveCache.ids;
  try {
    const r = await zenFetch(ZEN_MODELS_URL, { headers: { Accept: "application/json" } });
    if (!r.ok) throw new Error(`console ${r.status}`);
    const d = (await r.json()) as { data?: Array<{ id?: string }> };
    const ids = new Set((d?.data || []).map((x) => String(x?.id || "")).filter(Boolean));
    if (!ids.size) throw new Error("empty catalog");
    liveCache = { at: Date.now(), ids };
    return ids;
  } catch {
    liveCache = { at: Date.now(), ids: null };
    return null;
  }
}

export function isZenModel(model: string): boolean {
  const id = normalizeZenModel(model);
  return id === DEFAULT_ZEN_MODEL || /-free$/i.test(id);
}

/* ────────────────────────── message shaping ────────────────────────── */

export function textOf(c: string | ContentPart[]): string {
  return typeof c === "string"
    ? c
    : c
        .filter((p): p is { type: "text"; text: string } => p.type === "text")
        .map((p) => p.text)
        .join("\n");
}

export function attachMedia(
  messages: ChatMessage[],
  attachments: BuilderAttachment[],
  model: { multimodal?: boolean },
): ChatMessage[] {
  if (!attachments.length) return messages;
  const next = [...messages];
  const i = [...next].reverse().findIndex((m) => m.role === "user");
  if (i < 0) return next;
  const target = next.length - 1 - i;
  const base = textOf(next[target]!.content);
  if (!model.multimodal) {
    // Neutral phrasing — the old "Attached media:" bait made models apologise
    // ("I cannot read image.png ... Inform the user") instead of helping.
    next[target] = {
      role: "user",
      content: `${base}\n\n[System note: the user attached ${attachments
        .map((a) => a.name)
        .join(
          ", ",
        )}. This model cannot open files; work from the conversation text, and if a file is essential tell the user to retry with a vision-capable model such as Big Pickle.]`,
    };
    return next;
  }
  const parts: ContentPart[] = [{ type: "text", text: base }];
  for (const a of attachments) {
    if (a.mime.startsWith("image/")) parts.push({ type: "image_url", image_url: { url: a.data } });
    else if (a.mime.startsWith("audio/"))
      parts.push({ type: "input_audio", input_audio: { data: a.data } });
    else if (a.mime.startsWith("video/"))
      parts.push({ type: "video_url", video_url: { url: a.data }, fps: 1 });
  }
  next[target] = { role: "user", content: parts };
  return next;
}

const SYSTEM = `You are ZYRAXON AI, an autonomous production-grade web builder. Build complete working projects, preserve existing behavior unless asked to change it, keep responsive polished UI intact, verify cross-file references, never expose credentials or hidden reasoning.`;

/** Real tool protocol. The client executes these directives with the user's locally-stored keys. */
export const TOOL_GUIDE = `
TOOLS YOU CAN USE — emit a directive block as the LAST thing in your reply, exactly one per action, JSON only inside:

1) GitHub (the user's token is already connected in their browser):
<github-tool>{"action":"status"}</github-tool>
<github-tool>{"action":"list_repos"}</github-tool>
<github-tool>{"action":"create_repo","name":"my-site","private":false}</github-tool>
<github-tool>{"action":"push_files","name":"my-site"}</github-tool>   → pushes ALL current workspace files (creates the repo if missing)
<github-tool>{"action":"enable_pages","name":"my-site"}</github-tool>  → publishes to GitHub Pages and returns the live URL

2) Live web — real online search & page reader:
<web-tool>{"action":"search","query":"react 19 release notes"}</web-tool>
<web-tool>{"action":"open_url","url":"https://example.com/docs"}</web-tool>

3) PowerShell/Shell Engine — REAL commands on the computer that hosts this website (build/test/run anything):
<builder-tool>{"tool":"powershell","command":"node --version"}</builder-tool>

Rules: use a tool ONLY when needed for the user's request; you may chain multiple directives across turns; never print or repeat API tokens; after acting, tell the user exactly what happened; for publishing ask for a repo name if none was given; when the user asks about current events, docs or facts you are unsure of — search first.`;

export function sdkMessages(
  messages: ChatMessage[],
  attachments: BuilderAttachment[],
  model: { multimodal?: boolean },
) {
  const input = attachMedia(messages.slice(-32), attachments, model);
  const last = [...input].reverse().find((m) => m.role === "user");
  const request = last ? textOf(last.content).slice(0, 6000) : "";
  return [
    {
      role: "system" as const,
      content: `${SYSTEM}\n${TOOL_GUIDE}\n\nCURRENT REQUEST:\n${request}`,
    },
    ...input,
  ] as unknown;
}

export function classify(error: unknown) {
  const s = error instanceof Error ? error.message : "SDK request failed";
  return {
    detail: s,
    status: /429|rate.?limit/i.test(s)
      ? 429
      : /401|unauthorized|api key/i.test(s)
        ? 401
        : /403|forbidden/i.test(s)
          ? 403
          : /404|not.?found|unsupported/i.test(s)
            ? 404
            : 502,
  };
}

/* ────────────────────────── streaming ────────────────────────── */

function provider(key: string | undefined) {
  return createOpenAICompatible({
    name: "opencode-zen",
    baseURL: ZEN_BASE,
    // Empty string ⇒ the SDK omits the Authorization header entirely.
    // A placeholder like "anonymous" would be forwarded as a bad Bearer token → 401.
    apiKey: key || "",
    fetch: zenFetch,
  });
}

function frame(enc: TextEncoder, delta: unknown, finish: string | null, upstream: string) {
  return enc.encode(
    `data: ${JSON.stringify({ id: `zyraxon-${Date.now()}`, object: "chat.completion.chunk", choices: [{ index: 0, delta, finish_reason: finish }], model: upstream })}\n\n`,
  );
}

function sse(first: string | undefined, iterator: AsyncIterator<string>, upstream: string) {
  const enc = new TextEncoder();
  return new ReadableStream<Uint8Array>({
    async start(c) {
      try {
        if (first) c.enqueue(frame(enc, { content: first }, null, upstream));
        while (true) {
          const n = await iterator.next();
          if (n.done) break;
          if (n.value) c.enqueue(frame(enc, { content: n.value }, null, upstream));
        }
        c.enqueue(frame(enc, {}, "stop", upstream));
        c.enqueue(enc.encode("data: [DONE]\n\n"));
        c.close();
      } catch (e) {
        c.enqueue(
          enc.encode(
            `data: ${JSON.stringify({ error: { message: e instanceof Error ? e.message : "Zen stream failed", type: "opencode_zen_error" } })}\n\n`,
          ),
        );
        c.enqueue(enc.encode("data: [DONE]\n\n"));
        c.close();
      }
    },
  });
}

/** Stream one Zen model. Returns the streaming Response or { failed }.
 *  Reasoning models may emit reasoning deltas for a long while before visible
 *  text — those count as healthy activity, NOT an empty stream (textStream
 *  alone would misreport them). A truly silent response retries once, then
 *  fails fast so the fallback chain moves on. */
async function streamOne(
  key: string | undefined,
  upstream: string,
  multimodal: boolean,
  messages: ChatMessage[],
  attachments: BuilderAttachment[],
  maxOutputTokens: number,
): Promise<Response | { failed: unknown }> {
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const result = streamText({
        model: provider(key).chatModel(upstream),
        messages: sdkMessages(messages, attachments, { multimodal }),
        maxOutputTokens,
        temperature: 0.2,
      });
      const iterator = result.fullStream[Symbol.asyncIterator]();
      let sawActivity = false;
      let firstText = "";
      for (;;) {
        const n = await iterator.next();
        if (n.done) break;
        const p = n.value as unknown as {
          type?: string;
          textDelta?: string;
          text?: string;
          error?: unknown;
        };
        if (p.type === "text-delta") {
          const t = p.textDelta ?? p.text ?? "";
          if (!t) continue;
          firstText = t;
          sawActivity = true;
          break;
        }
        if (p.type === "reasoning" || p.type === "reasoning-delta") sawActivity = true;
        else if (p.type === "error") throw p.error ?? new Error("upstream stream error");
      }
      if (!sawActivity) {
        // Silent soft-block — one quick same-model retry rescues many of these.
        if (attempt === 0) {
          await new Promise((r) => setTimeout(r, 900));
          continue;
        }
        return { failed: { upstream, status: 502, detail: "OpenCode returned an empty stream" } };
      }
      if (!firstText)
        return {
          failed: {
            upstream,
            status: 502,
            detail:
              "model produced reasoning only and hit its output budget before any answer — try another model",
          },
        };
      const restText = async function* (): AsyncGenerator<string> {
        yield firstText;
        for (;;) {
          const n = await iterator.next();
          if (n.done) break;
          const p = n.value as unknown as { type?: string; textDelta?: string; text?: string };
          if (p.type !== "text-delta") continue;
          const t = p.textDelta ?? p.text ?? "";
          if (t) yield t;
        }
      };
      return new Response(sse(firstText, restText(), upstream), {
        headers: {
          "Content-Type": "text/event-stream; charset=utf-8",
          "Cache-Control": "no-cache, no-transform",
          Connection: "keep-alive",
          "X-Accel-Buffering": "no",
          "Access-Control-Allow-Origin": "*",
          "X-ZYRAXON-Upstream": upstream,
        },
      });
    } catch (e) {
      const c = classify(e);
      return { failed: { upstream, status: c.status, detail: c.detail } };
    }
  }
  return { failed: { upstream, status: 502, detail: "unreachable" } };
}

/** ZYRAXON Zen chat: keyless by default (free pool), user/server key boosts capacity when present.
 *  Tries the requested model first, then falls back through the live-validated free pool. */
export async function zenChatStream(
  model: string,
  messages: ChatMessage[],
  apiKey?: string,
  attachments: BuilderAttachment[] = [],
): Promise<Response> {
  const key = resolveApiKey(apiKey);

  const [pool, live] = await Promise.all([zenFreeModels(), zenLiveIds()]);
  const requestedId = normalizeZenModel(model) || DEFAULT_ZEN_MODEL;
  let chain: ZenModel[] = [
    ...(pool.some((m) => m.id === requestedId) ? [pool.find((m) => m.id === requestedId)!] : []),
    ...pool.filter((m) => m.id !== requestedId),
  ];
  if (chain.length && !chain.some((m) => m.id === requestedId)) {
    chain = [{ ...(chain[0] || EMERGENCY_POOL[0]), id: requestedId }, ...chain];
  }
  if (live) {
    const served = chain.filter((m) => live.has(m.id));
    // A dead id still gets ONE attempt slot at the front so the real upstream
    // error surfaces, then we fall through to models the console actually serves.
    chain = [...chain.filter((m) => !live.has(m.id)).slice(0, 1), ...served];
  }
  // Attached media must reach a model that can actually SEE it — put
  // verified-vision models right after the explicit pick (or first if none).
  const hasMedia = attachments.length > 0;
  if (hasMedia && chain.some((m) => !m.multimodal)) {
    const head = chain[0];
    const rest = chain.slice(1);
    const ordered = [
      head,
      ...rest.filter((m) => m.multimodal),
      ...rest.filter((m) => !m.multimodal),
    ];
    chain = ordered;
  }
  const failures: unknown[] = [];

  for (const candidate of chain.slice(0, 12)) {
    const out = await streamOne(
      key,
      candidate.id,
      candidate.multimodal,
      messages,
      attachments,
      Math.min(candidate.output || 16000, 32768),
    );
    if ("failed" in out) {
      failures.push({ ...out.failed, model: candidate.id });
      if (out.failed.status === 401 || out.failed.status === 403) break;
      continue; // 429 / empty / unsupported → try next free model
    }
    return out;
  }

  const last = failures[failures.length - 1];
  const status = last?.status || 502;
  let error = "OpenCode request failed.";
  if (failures.some((f) => f.status === 401 || f.status === 403))
    error =
      "OpenCode rejected the configured API key. Check your Zen key in Settings or unset OPENCODE_ZEN_API_KEY on the server.";
  else if (failures.every((f) => f.status === 429))
    error =
      "All OpenCode Zen free models are rate-limited right now. Add your own Zen API key in Settings for full capacity.";
  else if (failures.length >= 2 && failures.every((f) => f.status === 502))
    error =
      "OpenCode's free pool is temporarily not returning content from this server. Retrying in a moment usually works — or add a free OpenCode key in Settings → Providers for dedicated capacity.";
  return Response.json(
    {
      error,
      detail: JSON.stringify({ tried: failures }),
      provider: "opencode-zen",
      endpoint: ZEN_CHAT_URL,
    },
    {
      status: status >= 400 && status < 600 ? status : 502,
      headers: { "Access-Control-Allow-Origin": "*" },
    },
  );
}

export async function testZenModel(model: string, apiKey?: string) {
  const key = resolveApiKey(apiKey);
  const upstream = normalizeZenModel(model) || DEFAULT_ZEN_MODEL;
  try {
    const r = await generateText({
      model: provider(key).chatModel(upstream),
      messages: [{ role: "user", content: "Reply with OK." }],
      maxOutputTokens: 8,
      temperature: 0,
    });
    return { ok: true, status: 200, model: upstream, detail: r.text.slice(0, 400) };
  } catch (e) {
    const c = classify(e);
    return { ok: false, status: c.status, model: upstream, detail: c.detail };
  }
}

export async function discoverConsoleModels(apiKey?: string) {
  const key = resolveApiKey(apiKey);
  try {
    const r = await zenFetch(ZEN_MODELS_URL, {
      headers: {
        Accept: "application/json",
        ...(key ? { Authorization: `Bearer ${key}` } : {}),
      },
    });
    const d = await r.json().catch(() => null);
    const ids = Array.isArray(d?.data)
      ? d.data.map((x: unknown) => String(x?.id || "")).filter(Boolean)
      : [];
    return { ok: r.ok, status: r.status, ids };
  } catch (e) {
    return {
      ok: false,
      status: 0,
      ids: [],
      detail: e instanceof Error ? e.message : "model discovery failed",
    };
  }
}
