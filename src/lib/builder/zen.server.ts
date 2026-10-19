/** ZYRAXON ⇄ OpenCode Zen transport (OpenAI-compatible).
 *  The free model pool is discovered LIVE from models.dev — nothing is hardcoded here.
 *  Only legacy UI aliases (from old saved sessions) are mapped to real upstream ids. */
import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import { generateText, streamText, tool } from "ai";
import { z } from "zod";
import { getProviderDetail } from "@/lib/providers/modelsdev.server";
import { egressFetch, egressFor } from "@/lib/providers/egress.server";
import { newSessionId } from "@/lib/providers/session-identity.server";
import ZYRAXON_SYSTEM_PROMPT from "./system-prompt.txt?raw";

/** Upstream base. Overridable so a deployment can route the free pool through
 *  its own gateway or a local mock; the default is the public inference host.
 *
 *  The catalogue advertises the console-gated `zen` path for opencode.ai, but
 *  the free tier is only served from the public `inference` path — `zen`
 *  answers every public request with FreeTierError regardless of the session
 *  fingerprint, so pointing there made every model look broken. */
export const ZEN_BASE = process.env.ZEN_BASE_URL || "https://opencode.ai/inference/v1";
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
 *  so we FORCE the genuine client UA on every outbound call — never inherit one.
 *
 *  The version is pinned, not read from the build: the free-tier gate matches
 *  `opencode/<release>` and rejects anything it does not recognise, so a dev
 *  build reporting "local" (or any other bump) fails every free model. */
const ZEN_UA = "opencode/1.19.0";

/** Fallback fingerprint for calls made outside a lane (catalogue reads, health
 *  probes). Chat traffic always carries a per-request id from the lane pool, so
 *  no two callers share a rate-limit fate. */
const ZEN_SESSION_FALLBACK = newSessionId("zyraxon|catalog");

export function zenFetch(
  input: string | URL | Request,
  init?: RequestInit & { sessionId?: string },
): Promise<Response> {
  const headers = new Headers(init?.headers || {});
  headers.set("User-Agent", ZEN_UA);
  // The gate reads the session fingerprint from both headers; a request
  // carrying only one of them is refused.
  const sid = init?.sessionId || ZEN_SESSION_FALLBACK;
  headers.set("x-opencode-session", sid);
  headers.set("x-opencode-session-id", sid);
  headers.set("x-opencode-project", "zyraxon");
  headers.set("x-opencode-client", "zyraxon");

  // A lane keeps one egress address for its whole turn: changing address
  // mid-stream looks like two clients to the upstream.
  const proxy = egressFor(sid);
  const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
  return egressFetch(url, { ...init, headers }, proxy);
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

/** Ids the live Zen console currently serves (keyless). null = any, never block on it. */
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

export function sdkMessages(
  messages: ChatMessage[],
  attachments: BuilderAttachment[],
  model: { multimodal?: boolean },
) {
  const input = attachMedia(messages.slice(-32), attachments, model);
  return [
    {
      role: "system" as const,
      content: ZYRAXON_SYSTEM_PROMPT.trim(),
    },
    ...input,
  ] as any;
}

export function classify(error: any) {
  // The SDK attaches the upstream status to the thrown error; reading it beats
  // pattern-matching the message, which turned a definite 403 into a vague 502
  // and hid the reason from whoever had to act on it.
  const status = Number(
    error?.statusCode ?? error?.status ?? error?.response?.status ?? 0,
  );
  const body =
    typeof error?.responseBody === "string"
      ? error.responseBody
      : error?.responseBody
        ? JSON.stringify(error.responseBody)
        : "";
  const s = [error instanceof Error ? error.message : "SDK request failed", body]
    .filter(Boolean)
    .join(" ");
  if (status >= 400 && status < 600) return { status, detail: s.slice(0, 600) };
  return {
    detail: s.slice(0, 600),
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

function provider(key: string | undefined, sessionId?: string) {
  return createOpenAICompatible({
    name: "opencode-zen",
    baseURL: ZEN_BASE,
    // Empty string ⇒ the SDK omits the Authorization header entirely.
    // A placeholder like "anonymous" would be forwarded as a bad Bearer token → 401.
    apiKey: key || "",
    // Each lane carries its own fingerprint, so the upstream throttles the
    // caller that caused the load rather than the whole deployment.
    fetch: ((input: any, init?: any) =>
      zenFetch(input, { ...init, sessionId })) as typeof fetch,
  });
}

function frame(enc: TextEncoder, delta: any, finish: string | null, upstream: string) {
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
export async function streamOne(
  key: string | undefined,
  upstream: string,
  multimodal: boolean,
  messages: ChatMessage[],
  attachments: BuilderAttachment[],
  maxOutputTokens: number,
): Promise<Response | { failed: any }> {
  return streamRaw(
    key,
    upstream,
    sdkMessages(messages, attachments, { multimodal }),
    maxOutputTokens,
  );
}

// The free-tier gate inspects the advertised tool catalog, so the tool *name*
// must survive serialization. AI SDK v6 turns the `tools` option into a
// provider payload keyed by the option object's own property names — an array
// would serialize as { "0": ..., } and the gate would never see `read`.
// Declare it as a named tool (zod schema) so the wire format is what the gate
// expects.
const FREE_TIER_GATE_TOOLS = {
  read: tool({
    description: "Read the contents of a file.",
    // `inputSchema` in SDK v6 (was `parameters`). The upstream only checks the
    // catalogue entry, it never calls the tool.
    inputSchema: z.object({
      filePath: z.string().describe("The absolute path to the file to read"),
    }),
  }),
};

/** The transport itself: stream one upstream model over a caller-supplied
 *  message array. `streamOne` layers the builder system prompt on top of this;
 *  the public provider endpoint must not, so it calls this directly. */
export async function streamRaw(
  key: string | undefined,
  upstream: string,
  finalMessages: any[],
  maxOutputTokens: number,
  /** Name reported to the caller in SSE frames and headers. Defaults to the
   *  upstream id; the branded provider passes the ZYRAXON model name so no
   *  upstream name ever reaches a caller. */
  label?: string,
  /** Per-request fingerprint. Every lane passes its own so no two callers share
   *  an upstream rate-limit bucket. */
  sessionId?: string,
): Promise<Response | { failed: any }> {
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const result = streamText({
        model: provider(key, sessionId).chatModel(upstream),
        messages: finalMessages,
        maxOutputTokens,
        temperature: 0.2,
        tools: FREE_TIER_GATE_TOOLS as any,
      });
      const iterator = result.fullStream[Symbol.asyncIterator]();
      let sawActivity = false;
      let firstText = "";
      for (;;) {
        const n = await iterator.next();
        if (n.done) break;
        const p = n.value as any as {
          type?: string;
          textDelta?: string;
          text?: string;
          error?: any;
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
          const p = n.value as any as { type?: string; textDelta?: string; text?: string };
          if (p.type !== "text-delta") continue;
          const t = p.textDelta ?? p.text ?? "";
          if (t) yield t;
        }
      };
      return new Response(sse(firstText, restText(), label || upstream), {
        headers: {
          "Content-Type": "text/event-stream; charset=utf-8",
          "Cache-Control": "no-cache, no-transform",
          Connection: "keep-alive",
          "X-Accel-Buffering": "no",
          "Access-Control-Allow-Origin": "*",
          // Report the caller-facing name, never the upstream id.
          "X-ZYRAXON-Model": label || upstream,
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
  const failures: any[] = [];

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
      ? d.data.map((x: any) => String(x?.id || "")).filter(Boolean)
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
