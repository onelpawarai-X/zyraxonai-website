/** ZYRAXON ⇄ OpenCode Zen transport (OpenAI-compatible).
 *  The free model pool is discovered LIVE from models.dev — nothing is hardcoded here.
 *  Only legacy UI aliases (from old saved sessions) are mapped to real upstream ids. */
import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import { generateText, streamText, tool } from "ai";
import { z } from "zod";
import { getProviderDetail } from "@/lib/providers/modelsdev.server";
import { egressFetch, egressFor } from "@/lib/providers/egress.server";
import { fitsModalities, type MediaKind } from "@/lib/providers/media";
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

/** How often to send an SSE comment while the upstream is silent.
 *
 *  A reasoning model can think for tens of seconds before its first token, and
 *  a stream that writes nothing in that window looks dead to Cloudflare, a load
 *  balancer or a phone's network, which then drops it. A comment line every few
 *  seconds keeps the connection provably alive without the client seeing
 *  anything it has to parse. Ten seconds is well under the shortest idle
 *  timeout we are likely to sit behind. */
export const HEARTBEAT_MS = Number(process.env.ZYRAXON_HEARTBEAT_MS || 10_000);
/** How long to wait for a first token before deciding a model is merely slow
 *  rather than broken. Inside this window a failure can still rotate to another
 *  model; past it the turn is committed and the keepalive holds the connection
 *  while the model finishes thinking. Kept well under the caller's own timeout
 *  so a genuinely dead model still rotates quickly.
 *
 *  A real first token is fast: measured across the free pool, the median is
 *  1.6–2.5s and the slowest healthy model still answers in under four seconds.
 *  The only models that exceed that are reasoning models that emit their
 *  thinking before their answer, and those already stream reasoning deltas —
 *  which count as activity and commit the turn without waiting for text. So the
 *  ceiling only has to be long enough to catch a token on a slow network, and
 *  every millisecond past that is a millisecond a *dead* model delays rotation.
 *  Four seconds is comfortably above the healthy distribution and short enough
 *  that a broken model is swapped before the caller gives up. */
export const PROBE_MS = Number(process.env.ZYRAXON_PROBE_MS || 4_000);

/** How long a whole turn may take before the upstream is treated as dead.
 *
 *  The probe above only bounds the *first* token, and only on the streaming SDK
 *  path. Two other paths had no ceiling at all: the non-streaming SDK path
 *  (`completeRaw`) awaits its stream to completion, and both wire paths
 *  (`streamWireRaw`, `completeWireRaw`) drain the upstream body before they
 *  return. On those, a model that accepts the connection and then goes silent
 *  held the caller for the full 50–60s that Cloudflare allows before it answers
 *  502 — and rotation, which is the whole point of the chain, never got a chance
 *  to run, because the attempt never *failed*, it just never finished.
 *
 *  Measured across the live free pool, the slowest healthy model emits its first
 *  token in under 8s and finishes a short answer well inside 30s. A ceiling of
 *  30s is therefore several times the healthy worst case and short enough that a
 *  dead model rotates to a live one while the caller is still waiting.
 *
 *  The ceiling is on *silence*, not on the whole turn: `sse` emits a heartbeat
 *  comment every `HEARTBEAT_MS`, and an answer that is still producing tokens is
 *  still working. Only a turn that produces nothing for this long is abandoned. */
export const TURN_IDLE_MS = Number(process.env.ZYRAXON_TURN_IDLE_MS || 30_000);

/** How long the non-streaming path may wait for *any* activity — a token, a
 *  reasoning delta, a tool call — before it gives up. Deliberately the same
 *  number as `TURN_IDLE_MS`: the two paths fail the same way and should fail at
 *  the same time, so a caller sees one behaviour rather than two. */
export const COMPLETE_DEADLINE_MS = Number(
  process.env.ZYRAXON_COMPLETE_DEADLINE_MS || TURN_IDLE_MS,
);

/** How long the non-streaming path may wait for the *first* activity.
 *
 *  Much shorter than the mid-answer silence bound, because the two waits are
 *  not the same risk. A model that has said nothing at all is dead or refusing,
 *  and the racer behind it should have the lane now; waiting the full silence
 *  bound on each dead candidate spends the whole turn budget on models that
 *  were never going to answer. Measured on the live pool, a healthy model
 *  emits its first token in under 8s, so 6s costs nothing real and hands a dead
 *  candidate's turn to a live one several times faster. */
export const FIRST_ACTIVITY_MS = Number(process.env.ZYRAXON_FIRST_ACTIVITY_MS || 10_000);

export type ContentPart =
  | { type: "text"; text: string }
  | { type: "image_url"; image_url: { url: string } }
  | { type: "input_audio"; input_audio: { data: string } }
  | { type: "video_url"; video_url: { url: string }; fps?: number };
export type ChatMessage = {
  role: "system" | "user" | "assistant" | "tool";
  content: string | ContentPart[];
  /** Set on an assistant message that is asking for tool calls. Carried through
   *  so the tool results that follow can be matched to the call that produced
   *  them; an upstream that cannot match them refuses the turn. */
  tool_calls?: Array<{
    id: string;
    type?: "function";
    function: { name: string; arguments: string };
  }>;
  /** Set on a `role: "tool"` message: which call it answers. */
  tool_call_id?: string;
  /** Optional tool name on a `role: "tool"` message. */
  name?: string;
};
export type BuilderAttachment = { name: string; mime: string; data: string };
export type ZenModel = {
  id: string;
  name: string;
  /** Input modalities: any of text, image, audio, video, pdf. */
  modalities: string[];
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

export {
  upstreamKeys,
  isQuotaFailure,
  noteKeyLimited,
  keyLimited,
  pickUpstreamKey,
} from "./upstream-keys.server";

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
  init?: RequestInit & {
    sessionId?: string;
    /** Abort if the upstream has not even sent its response headers by then.
     *  Bounds the connect-and-first-byte wait, which is where a wedged upstream
     *  shows up as "the request just hangs". It is cleared the moment headers
     *  arrive, so a long but healthy stream body is never cut by it. */
    firstByteMs?: number;
  },
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

  // Bound the wait for response headers. Without this, an upstream that accepts
  // the connection and then never answers holds the attempt open until the
  // gateway times out — the caller gets a 502 from the edge and the rotation
  // never sees a failure it could act on. The clock is cleared as soon as the
  // headers land, so only the *silent* part of the wait is bounded.
  const firstByteMs = init?.firstByteMs ?? TURN_IDLE_MS;
  if (!firstByteMs || firstByteMs <= 0) {
    return egressFetch(url, { ...init, headers }, proxy);
  }
  const abort = new AbortController();
  const timer = setTimeout(() => {
    abort.abort(new Error(`upstream sent no response headers within ${firstByteMs}ms`));
  }, firstByteMs);
  if (typeof timer?.unref === "function") timer.unref();
  return egressFetch(url, { ...init, headers, signal: abort.signal }, proxy).finally(() => {
    clearTimeout(timer);
  });
}

/** Free models VERIFIED (2026-08 live probe) to accept image_url parts without
 *  "No endpoints found that support ..." errors. Used only as a fallback when
 *  the catalogue ships no modality data; the catalogue is authoritative. */
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
    modalities: ["text"],
    multimodal: false,
    reasoning: false,
    context: 200000,
    output: 32768,
    free: true,
  },
];

/** Normalise a model's declared input modalities. Falls back to the live-probed
 *  vision set when the catalogue is silent, so a genuinely multimodal model is
 *  never mislabelled text-only. */
function modalitiesFor(id: string, declared: string[] | undefined): string[] {
  const mods = (declared || []).map((m) => String(m).toLowerCase()).filter(Boolean);
  if (mods.length) return Array.from(new Set(mods));
  return VISION_FREE_MODELS.has(id) ? ["text", "image"] : ["text"];
}

export async function zenFreeModels(): Promise<ZenModel[]> {
  if (poolCache && Date.now() - poolCache.at < POOL_TTL) return poolCache.models;
  try {
    const detail = await getProviderDetail("opencode");
    const models: ZenModel[] = (detail?.models || [])
      .filter((m) => m.free)
      .map((m) => {
        const modalities = modalitiesFor(m.id, m.modalities);
        return {
          id: m.id,
          name: m.name,
          modalities,
          // The catalogue is authoritative for modality; the probed set is the
          // fallback when it is silent.
          multimodal: modalities.some((x) => x !== "text"),
          reasoning: m.reasoning,
          context: m.context,
          output: m.output,
          free: true as const,
        };
      });
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

/** Which input modalities a set of builder attachments actually needs. Derived
 *  from each attachment's MIME type, mirroring `attachMedia`'s mapping so the
 *  routing decision and the payload agree: if `attachMedia` would send an
 *  `input_audio` part, the audio modality must be required here. */
export function attachmentModalities(attachments: BuilderAttachment[]): Set<MediaKind> {
  const need = new Set<MediaKind>();
  for (const a of attachments) {
    const mime = String(a.mime || "").toLowerCase();
    if (mime.startsWith("image/")) need.add("image");
    else if (mime.startsWith("audio/")) need.add("audio");
    else if (mime.startsWith("video/")) need.add("video");
    else if (mime === "application/pdf") need.add("pdf");
  }
  return need;
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
  const status = Number(error?.statusCode ?? error?.status ?? error?.response?.status ?? 0);
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
    fetch: ((input: any, init?: any) => zenFetch(input, { ...init, sessionId })) as typeof fetch,
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
      // Keep the connection provably alive while the upstream is silent.
      //
      // A reasoning model can think for tens of seconds before its first token.
      // With nothing written in that window, an intermediary — Cloudflare, a
      // load balancer, a phone's network — treats the stream as dead and drops
      // it, so the caller sees a truncated answer. An SSE comment every few
      // seconds is valid, is ignored by every client, and holds the line open.
      let timer: ReturnType<typeof setTimeout> | null = null;
      const arm = () => {
        if (timer) clearTimeout(timer);
        timer = setTimeout(() => {
          try {
            c.enqueue(enc.encode(": zyraxon-keepalive\n\n"));
          } catch {
            /* the client is gone; the write below will notice */
          }
          arm();
        }, HEARTBEAT_MS);
        if (typeof timer?.unref === "function") timer.unref();
      };
      const disarm = () => {
        if (timer) clearTimeout(timer);
        timer = null;
      };
      arm();
      try {
        let emitted = false;
        if (first) {
          c.enqueue(frame(enc, { content: first }, null, upstream));
          emitted = true;
        }
        while (true) {
          // Race the next token against the silence clock. The heartbeat keeps
          // the *connection* alive, but without this the stream would never
          // close if the upstream died mid-answer: the caller would hold an open
          // response forever with no way to tell it was over. An idle timeout
          // ends the turn with an error frame instead.
          let idleTimer: ReturnType<typeof setTimeout> | null = null;
          const idle = new Promise<"idle">((resolve) => {
            idleTimer = setTimeout(() => resolve("idle"), TURN_IDLE_MS);
            if (typeof idleTimer?.unref === "function") idleTimer.unref();
          });
          const n = await Promise.race([iterator.next(), idle]);
          if (idleTimer) clearTimeout(idleTimer);
          if (n === "idle") {
            // A stall after the first token is not a failure to report as an
            // error: the caller has already received part of the answer. Closing
            // the stream cleanly hands them a complete-looking, partial reply —
            // far better than an error frame that discards the text they just
            // read. Only a stall *before* any token is an error, and that case
            // is caught by the probe, not here.
            if (emitted) break;
            throw new Error(`upstream sent nothing within ${TURN_IDLE_MS}ms`);
          }
          if (n.done) break;
          if (n.value) emitted = true;
          if (n.value) c.enqueue(frame(enc, { content: n.value }, null, upstream));
        }
        disarm();
        c.enqueue(frame(enc, {}, "stop", upstream));
        c.enqueue(enc.encode("data: [DONE]\n\n"));
        c.close();
      } catch (e) {
        disarm();
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

/** The same gate catalogue in raw OpenAI wire form. The SDK path gets this for
 *  free from `FREE_TIER_GATE_TOOLS`, but the wire path hand-writes the JSON, so
 *  it needs the plain shape the gate inspects (`tools[].function.name`). */
const GATE_TOOLS_WIRE: WireTool[] = [
  {
    type: "function",
    function: {
      name: "read",
      description: "Read the contents of a file.",
      parameters: {
        type: "object",
        properties: {
          filePath: { type: "string", description: "The absolute path to the file to read" },
        },
        required: ["filePath"],
      },
    },
  },
];

/** A caller-supplied tool in OpenAI wire form. The public provider accepts
 *  these verbatim, so a client can define its own tools exactly as it would
 *  against OpenAI. */
export type WireTool = {
  type: "function";
  function: {
    name: string;
    description?: string;
    parameters?: unknown;
  };
};

/** The gate catalogue plus whatever tools the caller defined.
 *
 *  The upstream free tier inspects the advertised catalogue, so the gate tool
 *  must always be present — dropping it makes the upstream refuse the turn. The
 *  caller's own tools are appended after it, deduplicated by name so a caller
 *  who re-declares `read` cannot shadow the gate entry. */
function withGateTools(tools?: WireTool[]): WireTool[] {
  const extra = (tools || []).filter(
    (t) => t && t.type === "function" && t.function && typeof t.function.name === "string",
  );
  const seen = new Set(GATE_TOOLS_WIRE.map((t) => t.function.name));
  return [
    ...GATE_TOOLS_WIRE,
    ...extra.filter((t) => {
      if (seen.has(t.function.name)) return false;
      seen.add(t.function.name);
      return true;
    }),
  ];
}

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
  /** Caller-defined tools. Ignored here: the SDK path carries only the gate
   *  tool, so a turn with caller tools is routed to the wire path instead. */
  _tools?: WireTool[],
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

      // Prove the stream is healthy before committing to it, but with a ceiling
      // on how long that proof may take.
      //
      // Two failure modes have to be satisfied at once:
      //   - a retired or refused model fails at once, and rotation must fall
      //     through to the next model — so the first token has to be pulled
      //     here, before the Response is handed back;
      //   - a reasoning model can legitimately think for a long while before its
      //     first token, and the caller must not be left with no connection
      //     during that time, or an intermediary drops the stream.
      //
      // So wait for the first token, but only up to PROBE_MS. A failure inside
      // that window returns `{ failed }` and rotation continues. A model that is
      // merely slow passes the deadline and the Response is returned at once,
      // with the keepalive in `sse` holding the connection while it finishes
      // thinking — the caller is connected, and the answer still arrives.
      let sawActivity = false;
      let firstText = "";
      let probed = false;
      const probeDeadline = new Promise<"timeout">((resolve) => {
        const t = setTimeout(() => resolve("timeout"), PROBE_MS);
        if (typeof t?.unref === "function") t.unref();
      });
      for (;;) {
        const next = await Promise.race([iterator.next(), probeDeadline]);
        if (next === "timeout") {
          probed = true;
          break;
        }
        if (next.done) break;
        const p = next.value as any as {
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
      if (!probed) {
        if (!sawActivity) {
          // A silent, immediate response is the upstream soft-block. One quick
          // same-model retry rescues many of these; a second failure rotates.
          if (attempt === 0) {
            await new Promise((r) => setTimeout(r, 900));
            continue;
          }
          return { failed: { upstream, status: 502, detail: "OpenCode returned an empty stream" } };
        }
        if (!firstText) {
          return {
            failed: {
              upstream,
              status: 502,
              detail:
                "model produced reasoning only and hit its output budget before any answer — try another model",
            },
          };
        }
      }

      // The tail continues from wherever the probe stopped. `firstText`, when it
      // was already pulled, is emitted once by `sse` and never again here.
      const pump = async function* (): AsyncGenerator<string> {
        for (;;) {
          const n = await iterator.next();
          if (n.done) break;
          const p = n.value as any as { type?: string; textDelta?: string; text?: string };
          if (p.type !== "text-delta") continue;
          const t = p.textDelta ?? p.text ?? "";
          if (t) yield t;
        }
      };

      return new Response(sse(firstText || undefined, pump(), label || upstream), {
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

/** True when a message carries a part the AI SDK cannot represent, and so must
 *  be sent on the raw wire path. The SDK's model-message schema accepts only
 *  `text`, `image` and `file`; audio and video have no part of their own, and
 *  the openai-compatible provider renders every `file` as a PDF or a text blob.
 *  So a turn containing audio or video bypasses the SDK and is posted to the
 *  upstream in OpenAI wire form, where `input_audio` and `video_url` survive. */
export function needsWire(messages: Array<{ content: unknown }>): boolean {
  for (const m of messages) {
    if (!Array.isArray(m.content)) continue;
    for (const p of m.content as Array<Record<string, unknown>>) {
      const t = String(p?.type || "").toLowerCase();
      if (t === "input_audio" || t === "video_url" || t === "input_video") return true;
      // Canonical parts (normalised by the public route) name their kind
      // directly. Audio and video have no SDK part, so they must take the wire
      // path; a part that arrives in this shape would otherwise be routed to the
      // SDK, which cannot represent it.
      if (t === "media") {
        const kind = String(p?.kind || "").toLowerCase();
        if (kind === "audio" || kind === "video") return true;
        continue;
      }
      if (t === "file") {
        const mime = String(
          (p?.file as Record<string, unknown> | undefined)?.mime_type || p?.mime_type || "",
        ).toLowerCase();
        if (mime.startsWith("audio/") || mime.startsWith("video/")) return true;
      }
    }
  }
  return false;
}

/** Read one chunk, but give up if the upstream stays silent for `idleMs`.
 *
 *  A relay that simply awaits `reader.read()` waits forever on an upstream that
 *  accepted the connection and then said nothing — the caller sees a request
 *  that never returns, which is exactly the "it just hangs" report. Racing the
 *  read against a clock turns that into a definite failure the caller can act
 *  on. The read itself is not abandoned: its chunk, if it ever arrives, is still
 *  delivered to the next call.
 *
 *  Returns `"idle"` when the clock wins, so the caller can close the stream with
 *  an error frame rather than a truncated success. */
async function readWithIdle(
  reader: { read: () => Promise<{ done: boolean; value?: Uint8Array }> },
  idleMs: number,
  carry: { pending: Promise<{ done: boolean; value?: Uint8Array }> | null },
): Promise<{ done: boolean; value?: Uint8Array } | "idle"> {
  if (!idleMs || idleMs <= 0) return carry.pending ?? reader.read();
  const read = carry.pending ?? reader.read();
  carry.pending = read;
  let timer: ReturnType<typeof setTimeout> | null = null;
  const expired = new Promise<"idle">((resolve) => {
    timer = setTimeout(() => resolve("idle"), idleMs);
    if (typeof timer?.unref === "function") timer.unref();
  });
  const next = await Promise.race([read, expired]);
  if (timer) clearTimeout(timer);
  if (next === "idle") return "idle";
  carry.pending = null;
  return next;
}

function sseFromOpenAI(body: ReadableStream<Uint8Array>, label: string) {
  const enc = new TextEncoder();
  const dec = new TextDecoder();
  const reader = body.getReader();
  // Re-frame the upstream stream so the caller-facing model name is the ZYRAXON
  // brand, never the upstream id. The bytes are otherwise passed through
  // untouched, which keeps `tool_calls`, `reasoning` and usage chunks intact.
  let buffer = "";
  // Bound the silence, not the answer: `readWithIdle` only fires when the
  // upstream has sent nothing at all for a while, so a long answer that keeps
  // producing tokens is never cut.
  const carry: { pending: Promise<{ done: boolean; value?: Uint8Array }> | null } = { pending: null };
  let forwarded = false;
  const rewrite = (chunk: string) =>
    chunk.replace(/"model"\s*:\s*"[^"]*"/g, `"model":${JSON.stringify(label)}`);
  return new ReadableStream<Uint8Array>({
    async pull(c) {
      // Hold the connection open while the upstream thinks.
      //
      // A reasoning model can be silent for tens of seconds before its first
      // token. A relay that only writes when the upstream writes goes completely
      // idle for that whole time, and an intermediary — Cloudflare, a load
      // balancer, a phone's network — treats an idle stream as dead and drops
      // it. The caller then sees a truncated answer even though the model was
      // working fine. A comment line every few seconds is valid SSE that clients
      // ignore, and it keeps the connection provably alive.
      let timer: ReturnType<typeof setTimeout> | null = null;
      const ping = () => {
        try {
          c.enqueue(enc.encode(": zyraxon-keepalive\n\n"));
        } catch {
          /* the client is gone; the read below will notice */
        }
      };
      const arm = () => {
        if (timer) clearTimeout(timer);
        timer = setTimeout(() => {
          ping();
          arm();
        }, HEARTBEAT_MS);
        if (typeof timer?.unref === "function") timer.unref();
      };
      const disarm = () => {
        if (timer) clearTimeout(timer);
        timer = null;
      };

      arm();
      try {
        const next = await readWithIdle(reader, TURN_IDLE_MS, carry);
        if (next === "idle") {
          disarm();
          // Bytes already reached the caller, so this is a stall mid-answer, not
          // a failed turn: close cleanly so they keep what they received. A
          // throw here would discard a partial reply that was already delivered.
          if (forwarded) {
            if (buffer) c.enqueue(enc.encode(rewrite(buffer)));
            c.close();
            return;
          }
          throw new Error(`upstream sent nothing within ${TURN_IDLE_MS}ms`);
        }
        const { done, value } = next;
        if (done) {
          disarm();
          if (buffer) c.enqueue(enc.encode(rewrite(buffer)));
          c.close();
          return;
        }
        buffer += dec.decode(value, { stream: true });
        // Emit only complete SSE events; a partial line stays buffered so a JSON
        // payload split across two reads is never forwarded half-formed.
        const cut = buffer.lastIndexOf("\n\n");
        if (cut === -1) return;
        const ready = buffer.slice(0, cut + 2);
        buffer = buffer.slice(cut + 2);
        disarm();
        forwarded = true;
        c.enqueue(enc.encode(rewrite(ready)));
      } catch (e) {
        disarm();
        throw e;
      }
    },
    cancel() {
      return reader.cancel();
    },
  });
}

/** Post a chat turn to the upstream in raw OpenAI wire form and return the raw
 *  SSE `Response`.
 *
 *  Used only for turns the SDK cannot carry (audio/video). Everything else goes
 *  through the SDK, which handles retries, tool-call plumbing and usage
 *  accounting for us. Here we are deliberately closer to the metal: the wire
 *  shape is exactly what a caller sent, so nothing is lost in translation. */
export async function streamWireRaw(
  key: string | undefined,
  upstream: string,
  finalMessages: any[],
  maxOutputTokens: number,
  label?: string,
  sessionId?: string,
  tools?: WireTool[],
  opts?: {
    /** Called with the answer text seen so far, before any of it is forwarded.
     *  Returning true abandons the attempt as `status: 422` so the rotation can
     *  try a different upstream. This exists because a model that did not
     *  receive the media still answers 200 with a denial ("no audio was
     *  attached"); without the check that 200 looks like success and the turn
     *  stops on a model that never saw the file. */
    reject?: (textSoFar: string) => boolean;
  },
): Promise<Response | { failed: any }> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    Accept: "text/event-stream",
  };
  if (key) headers.Authorization = `Bearer ${key}`;
  const body = JSON.stringify({
    model: upstream,
    messages: finalMessages,
    max_tokens: maxOutputTokens,
    temperature: 0.2,
    stream: true,
    tools: withGateTools(tools),
  });
  try {
    const res = await zenFetch(ZEN_CHAT_URL, {
      method: "POST",
      headers,
      body,
      sessionId,
    });
    if (!res.ok || !res.body) {
      const detail = await res.text().catch(() => "");
      const c = classify(detail || `HTTP ${res.status}`);
      return { failed: { upstream, status: res.status || c.status, detail: c.detail } };
    }
    if (!opts?.reject) {
      return new Response(sseFromOpenAI(res.body, label || upstream), {
        headers: wireHeaders(label || upstream),
      });
    }
    // Read just far enough to judge the answer, then hand the caller a stream
    // that replays what was buffered and continues live. The peek is bounded by
    // both a byte ceiling and a deadline, so a model that is simply slow to
    // start is never mistaken for one that is refusing.
    const peek = await peekForRejection(res.body, opts.reject, PEEK_MEDIA_DEADLINE_MS);
    if (peek.rejected) {
      return {
        failed: {
          upstream,
          status: 422,
          detail: `media not received: ${peek.text.slice(0, 160)}`,
        },
      };
    }
    return new Response(replayThenPipe(peek.raw, peek.rest, label || upstream), {
      headers: wireHeaders(label || upstream),
    });
  } catch (e) {
    const c = classify(e);
    return { failed: { upstream, status: c.status, detail: c.detail } };
  }
}

function wireHeaders(label: string): Record<string, string> {
  return {
    "Content-Type": "text/event-stream; charset=utf-8",
    "Cache-Control": "no-cache, no-transform",
    Connection: "keep-alive",
    "X-Accel-Buffering": "no",
    "Access-Control-Allow-Origin": "*",
    "X-ZYRAXON-Model": label,
  };
}

/** How much *answer* text is enough to judge whether the model received the
 *  media. A denial is stated up front; an answer that has run this long without
 *  one has plainly engaged with the request.
 *
 *  This is measured on the answer alone, never on the raw stream: a reasoning
 *  model emits its thinking as a separate `reasoning` field, and counting that
 *  would spend the whole budget before the first word of the answer arrived —
 *  which is exactly how a denial used to slip through. */
const PEEK_MAX_CHARS = 240;
const PEEK_MAX_BYTES = 512 * 1024;
/** How long to wait for the answer to begin, for a turn with no media. */
const PEEK_DEADLINE_MS = 1_500;
/** The same wait for a turn that carries media. A model handed audio or video
 *  reasons about it for a while before it says anything, and the refusal — if
 *  there is one — only appears once it starts answering. The window is longer,
 *  but still short enough that the caller is not left in silence. */
const PEEK_MEDIA_DEADLINE_MS = 30_000;

/** The visible answer text in an upstream SSE chunk, or "" for a chunk that
 *  carries only reasoning, role, or usage. */
function answerTextOf(chunk: string): string {
  let out = "";
  const re = /"delta"\s*:\s*\{([\s\S]*?)\}\s*[,}]/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(chunk))) {
    const body = m[1];
    const c = /"content"\s*:\s*"((?:[^"\\]|\\.)*)"/.exec(body);
    if (c) out += c[1];
  }
  // A non-streaming chunk (`message` instead of `delta`) carries the whole
  // answer at once.
  if (!out) {
    const c = /"message"\s*:\s*\{[\s\S]*?"content"\s*:\s*"((?:[^"\\]|\\.)*)"/.exec(chunk);
    if (c) out = c[1];
  }
  return out;
}

/** Read the head of an upstream SSE body and decide whether to keep it.
 *
 *  Returns every byte consumed in `raw` (so the caller can replay it verbatim
 *  rather than re-serialise it) and the untouched remainder as a reader. */
async function peekForRejection(
  body: ReadableStream<Uint8Array>,
  reject: (text: string) => boolean,
  deadlineMs = PEEK_DEADLINE_MS,
): Promise<{
  rejected: boolean;
  text: string;
  raw: Uint8Array[];
  rest: StreamReader;
}> {
  const dec = new TextDecoder();
  const reader = body.getReader();
  const raw: Uint8Array[] = [];
  let bytes = 0;
  let answer = "";
  // Race each read against the deadline. A read is a promise that only settles
  // when the upstream sends something, so checking the clock between reads
  // would never run again on a socket that went quiet — the peek itself would
  // hang and the caller would get no answer at all.
  //
  // A read that is still pending when the deadline fires is *not* abandoned:
  // dropping it would lose whatever chunk it eventually carried. It is carried
  // forward and becomes the first read of the continuation.
  let pending: Promise<{ done: boolean; value?: Uint8Array }> | null = null;
  let timer: ReturnType<typeof setTimeout> | null = null;
  const expired = new Promise<"expired">((resolve) => {
    timer = setTimeout(() => resolve("expired"), Math.max(0, deadlineMs));
  });
  const rest: StreamReader = {
    read: () => {
      if (pending) {
        const p = pending;
        pending = null;
        return p;
      }
      return reader.read();
    },
    cancel: (reason?: unknown) => reader.cancel(reason),
  };
  try {
    for (;;) {
      const p = reader.read();
      const next = await Promise.race([p, expired]);
      if (next === "expired") {
        // Hand the un-settled read to the continuation; its chunk is not lost.
        pending = p;
        break;
      }
      pending = null;
      const { done, value } = next;
      if (done) break;
      if (!value) continue;
      raw.push(value);
      bytes += value.byteLength;
      answer += answerTextOf(dec.decode(value, { stream: true }));
      if (answer && reject(answer)) return { rejected: true, text: answer, raw, rest };
      if (answer.length >= PEEK_MAX_CHARS || bytes >= PEEK_MAX_BYTES) break;
    }
  } catch {
    /* a read failure is not a denial; fall through and let the stream surface it */
  } finally {
    if (timer) clearTimeout(timer);
  }
  return { rejected: false, text: answer, raw, rest };
}

/** The read half of the upstream body after a peek: the standard reader, except
 *  that a read left pending by the deadline is served first. */
type StreamReader = {
  read: () => Promise<{ done: boolean; value?: Uint8Array }>;
  cancel: (reason?: unknown) => Promise<void>;
};

/** Replay the bytes already read, then continue streaming the upstream body. */
function replayThenPipe(
  raw: Uint8Array[],
  reader: StreamReader,
  label: string,
): ReadableStream<Uint8Array> {
  const enc = new TextEncoder();
  const dec = new TextDecoder();
  const rewrite = (chunk: string) =>
    chunk.replace(/"model"\s*:\s*"[^"]*"/g, `"model":${JSON.stringify(label)}`);
  let buffered = "";
  let replayed = false;
  // Same silence bound as `sseFromOpenAI`: a wedged upstream must surface as an
  // error the caller can see, not as a stream that never ends.
  const carry: { pending: Promise<{ done: boolean; value?: Uint8Array }> | null } = { pending: null };
  return new ReadableStream<Uint8Array>({
    async pull(c) {
      if (!replayed) {
        replayed = true;
        // Decode the replayed bytes as one stream so a JSON payload split across
        // the peek boundary is still forwarded whole.
        const joined = raw.reduce((n, v) => n + v.byteLength, 0);
        const merged = new Uint8Array(joined);
        let at = 0;
        for (const v of raw) {
          merged.set(v, at);
          at += v.byteLength;
        }
        buffered += dec.decode(merged, { stream: true });
        const cut = buffered.lastIndexOf("\n\n");
        if (cut !== -1) {
          c.enqueue(enc.encode(rewrite(buffered.slice(0, cut + 2))));
          buffered = buffered.slice(cut + 2);
        }
        return;
      }
      const next = await readWithIdle(reader, TURN_IDLE_MS, carry);
      if (next === "idle") {
        throw new Error(`upstream sent nothing within ${TURN_IDLE_MS}ms`);
      }
      const { done, value } = next;
      if (done) {
        if (buffered) c.enqueue(enc.encode(rewrite(buffered)));
        c.close();
        return;
      }
      buffered += dec.decode(value, { stream: true });
      const cut = buffered.lastIndexOf("\n\n");
      if (cut === -1) return;
      c.enqueue(enc.encode(rewrite(buffered.slice(0, cut + 2))));
      buffered = buffered.slice(cut + 2);
    },
    cancel() {
      return reader.cancel();
    },
  });
}

/** Read an upstream OpenAI SSE body to completion and build one
 *  `chat.completion` object. Shared by the non-streaming wire path. */
async function drainOpenAi(body: ReadableStream<Uint8Array>, upstream: string, label?: string) {
  const dec = new TextDecoder();
  const reader = body.getReader();
  let buffer = "";
  let text = "";
  let reasoning = "";
  let finishReason = "stop";
  let usage: any = null;
  let sawActivity = false;
  // Tool calls stream in fragments: the first delta carries `index`, `id` and
  // `function.name`, and every later delta appends to `function.arguments`. They
  // must be reassembled by index or a caller receives a name with no arguments.
  const toolCalls: any[] = [];
  const handleEvent = (ev: string) => {
    for (const raw of ev.split("\n")) {
      const line = raw.trim();
      if (!line.startsWith("data:")) continue;
      const payload = line.slice(5).trim();
      if (!payload) continue;
      let j: any = null;
      try {
        j = JSON.parse(payload);
      } catch {
        continue;
      }
      const ch = j?.choices?.[0];
      const d = ch?.delta || {};
      if (typeof d.content === "string" && d.content) {
        text += d.content;
        sawActivity = true;
      }
      const r = d.reasoning_content ?? d.reasoning;
      if (typeof r === "string" && r) {
        reasoning += r;
        sawActivity = true;
      }
      if (ch?.finish_reason) finishReason = ch.finish_reason;
      if (j?.usage) usage = j.usage;
      if (Array.isArray(d.tool_calls)) {
        for (const tc of d.tool_calls) {
          sawActivity = true;
          const at = typeof tc.index === "number" ? tc.index : toolCalls.length;
          const slot = (toolCalls[at] ||= {
            id: "",
            type: "function",
            function: { name: "", arguments: "" },
          });
          if (tc.id) slot.id = tc.id;
          if (tc.type) slot.type = tc.type;
          if (tc.function?.name) slot.function.name += tc.function.name;
          if (tc.function?.arguments) slot.function.arguments += tc.function.arguments;
        }
      }
      if (j?.error) throw new Error(String(j.error?.message || j.error));
    }
  };

  // A silent upstream must not hold the turn open. `drainOpenAi` reads the whole
  // body before it returns, so without a ceiling a model that accepts the
  // connection and then says nothing would keep the caller waiting until the
  // gateway gave up — and the rotation, which exists to swap such a model out,
  // would never run, because the attempt never failed. Each chunk that arrives
  // resets the clock, so this bounds silence, not the length of a long answer.
  let idleTimer: ReturnType<typeof setTimeout> | null = null;
  let idleExpired = false;
  const armIdle = () => {
    if (idleTimer) clearTimeout(idleTimer);
    idleTimer = setTimeout(() => {
      idleExpired = true;
      reader.cancel("upstream silent").catch(() => {});
    }, TURN_IDLE_MS);
  };
  armIdle();
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      armIdle();
      buffer += dec.decode(value, { stream: true });
      const chunks = buffer.split("\n\n");
      buffer = chunks.pop() ?? "";
      for (const c of chunks) handleEvent(c);
    }
    if (buffer.trim()) handleEvent(buffer);
  } finally {
    if (idleTimer) clearTimeout(idleTimer);
  }
  if (idleExpired && !sawActivity) {
    return {
      failed: {
        upstream,
        status: 502,
        detail: `upstream sent nothing within ${TURN_IDLE_MS}ms`,
      },
    };
  }
  try {
    reader.releaseLock();
  } catch {}

  if (!sawActivity) {
    return {
      failed: { upstream, status: 502, detail: `empty upstream stream from ${label || upstream}` },
    };
  }

  const message: any = { role: "assistant", content: text || reasoning };
  if (reasoning) message.reasoning_content = reasoning;
  if (toolCalls.length) {
    message.tool_calls = toolCalls.filter(Boolean);
    // An assistant turn that asks for a tool has nothing to "stop" on; the
    // OpenAI spec reports `tool_calls` here and a strict client will not run the
    // call if it sees `stop`.
    if (finishReason === "stop") finishReason = "tool_calls";
  }
  return Response.json({
    id: `chatcmpl-${crypto.randomUUID().replace(/-/g, "")}`,
    object: "chat.completion",
    created: Math.floor(Date.now() / 1000),
    // Report the caller-facing label, never the upstream id: which upstream
    // backs a brand is an implementation detail and exposing it would leak the
    // rotation. The streaming path already labels its frames; this one must too.
    model: label || upstream,
    choices: [{ index: 0, message, finish_reason: finishReason }],
    usage: usage || { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 },
  });
}

/** Non-streaming twin of `streamWireRaw`: drain the upstream SSE in wire form
 *  and answer with one OpenAI `chat.completion` object. */
export async function completeWireRaw(
  key: string | undefined,
  upstream: string,
  finalMessages: any[],
  maxOutputTokens: number,
  label?: string,
  sessionId?: string,
  tools?: WireTool[],
  opts?: {
    /** Same contract as `streamWireRaw`'s `reject`: return true to abandon this
     *  attempt as `status: 422` so the rotation can retry or move on. */
    reject?: (text: string) => boolean;
  },
): Promise<Response | { failed: any }> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    Accept: "text/event-stream",
  };
  if (key) headers.Authorization = `Bearer ${key}`;
  const body = JSON.stringify({
    model: upstream,
    messages: finalMessages,
    max_tokens: maxOutputTokens,
    temperature: 0.2,
    stream: true,
    tools: withGateTools(tools),
  });
  try {
    const res = await zenFetch(ZEN_CHAT_URL, { method: "POST", headers, body, sessionId });
    if (!res.ok || !res.body) {
      const detail = await res.text().catch(() => "");
      const c = classify(detail || `HTTP ${res.status}`);
      return { failed: { upstream, status: res.status || c.status, detail: c.detail } };
    }
    const built = await drainOpenAi(res.body, upstream, label);
    if (opts?.reject && !("failed" in built)) {
      const text = await readAnswerText(built);
      if (opts.reject(text)) {
        return {
          failed: { upstream, status: 422, detail: `media not received: ${text.slice(0, 160)}` },
        };
      }
    }
    return built;
  } catch (e) {
    const c = classify(e);
    return { failed: { upstream, status: c.status, detail: c.detail } };
  }
}

/** The answer text of a built `chat.completion` response, without consuming it
 *  for the caller (the body is cloned). */
async function readAnswerText(res: Response): Promise<string> {
  try {
    const body = (await res.clone().json()) as {
      choices?: Array<{ message?: { content?: unknown; reasoning_content?: unknown } }>;
    };
    const m = body?.choices?.[0]?.message;
    const content = typeof m?.content === "string" ? m.content : "";
    const reasoning = typeof m?.reasoning_content === "string" ? m.reasoning_content : "";
    // Judge the answer, not the thinking. A model may muse about whether the
    // media is really there and still answer correctly; only its visible answer
    // decides. Reasoning is consulted solely when there is no answer at all,
    // which is the reasoning-only failure the caller must not receive either.
    return content || reasoning;
  } catch {
    return "";
  }
}

export async function completeRaw(
  key: string | undefined,
  upstream: string,
  finalMessages: any[],
  maxOutputTokens: number,
  label?: string,
  sessionId?: string,
): Promise<Response | { failed: any }> {
  {
    try {
      // A silent upstream must not hold the caller for the whole gateway
      // timeout. The controller is aborted by the deadline below, which makes
      // the SDK throw, which `classify` turns into a failure the rotation can
      // act on. Without it a hung model never fails — it simply never finishes,
      // and the chain never rotates.
      const abort = new AbortController();
      const result = streamText({
        model: provider(key, sessionId).chatModel(upstream),
        messages: finalMessages,
        maxOutputTokens,
        temperature: 0.2,
        tools: FREE_TIER_GATE_TOOLS as any,
        abortSignal: abort.signal,
      });
      let text = "";
      let reasoning = "";
      let finishReason = "stop";
      let usage: any = null;
      let sawActivity = false;
      let aborted = false;
      // The deadline covers the wait for *activity*, not the whole answer: a
      // turn already producing tokens is reset below and allowed to finish.
      const trip = () => {
        aborted = true;
        abort.abort(new Error(`no activity within ${COMPLETE_DEADLINE_MS}ms`));
      };
      let deadline: ReturnType<typeof setTimeout> | null = setTimeout(trip, FIRST_ACTIVITY_MS);
      const clearDeadline = () => {
        if (deadline) clearTimeout(deadline);
        deadline = null;
      };
      try {
      for await (const p of result.fullStream as any) {
        const type = p?.type;
        if (type === "text-delta") {
          const t = p.textDelta ?? p.text ?? "";
          if (t) {
            text += t;
            sawActivity = true;
            aborted = false;
            clearDeadline();
            deadline = setTimeout(trip, COMPLETE_DEADLINE_MS);
          }
        } else if (type === "reasoning" || type === "reasoning-delta") {
          reasoning += p.textDelta ?? p.text ?? "";
          sawActivity = true;
          aborted = false;
          clearDeadline();
          deadline = setTimeout(trip, COMPLETE_DEADLINE_MS);
        } else if (type === "finish") {
          finishReason = p.finishReason || finishReason;
          usage = p.totalUsage ?? p.usage ?? usage;
        } else if (type === "error") {
          throw p.error ?? new Error("upstream stream error");
        }
      }
      } catch (e) {
        // The deadline fired. A turn that already produced part of an answer is
        // not a failure: the caller asked a question and most of the reply is
        // sitting in `text`. Returning it — marked as truncated by its finish
        // reason — is strictly better than discarding it and reporting the model
        // as unavailable, which is what the caller would otherwise see for a
        // slow model that was working the whole time.
        if (!(aborted && sawActivity)) throw e;
      } finally {
        clearDeadline();
      }
      if (!sawActivity) {
        // No same-model retry here. The caller is now a racer with other models
        // already in flight, so repeating this one only spends the shared turn
        // budget on a candidate that has just proved silent — and delays the
        // hand-off to one that is answering. A second look at the same model is
        // the racer's job, and it does it across models rather than within one.
        return { failed: { upstream, status: 502, detail: "OpenCode returned an empty stream" } };
      }
      // A truncated answer must say so, or a caller cannot tell a complete reply
      // from one the deadline cut short.
      if (aborted) finishReason = "length";
      if (!text && reasoning) {
        // Reasoning-only turns are still a valid answer when there is no visible
        // text: surface the reasoning so the caller is not handed an empty body.
        text = reasoning;
        reasoning = "";
      }
      const body = {
        id: `zyraxon-${Date.now()}`,
        object: "chat.completion",
        created: Math.floor(Date.now() / 1000),
        model: label || upstream,
        choices: [
          {
            index: 0,
            message: {
              role: "assistant",
              content: text,
              ...(reasoning ? { reasoning_content: reasoning } : {}),
            },
            finish_reason: finishReason,
          },
        ],
        ...(usage
          ? {
              usage: {
                prompt_tokens: usage.inputTokens ?? usage.promptTokens ?? 0,
                completion_tokens: usage.outputTokens ?? usage.completionTokens ?? 0,
                total_tokens:
                  usage.totalTokens ??
                  Number(usage.inputTokens ?? 0) + Number(usage.outputTokens ?? 0),
              },
            }
          : {}),
      };
      return Response.json(body, {
        headers: {
          "Access-Control-Allow-Origin": "*",
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
  // Attached media must reach a model that can actually SEE it — put models
  // that accept *every* required modality right after the explicit pick (or
  // first if none). The check is per modality, not the blunt `multimodal` flag:
  // a model that takes images but not audio is no use for a voice note, and
  // ordering it ahead of an audio-capable model only wastes an attempt.
  const need = attachmentModalities(attachments);
  if (need.size && chain.some((m) => !fitsModalities(need, m.modalities))) {
    const head = chain[0];
    const rest = chain.slice(1);
    chain = [
      head,
      ...rest.filter((m) => fitsModalities(need, m.modalities)),
      ...rest.filter((m) => !fitsModalities(need, m.modalities)),
    ];
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
