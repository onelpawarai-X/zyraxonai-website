/** ZYRAXON rooted provider — our own branded model line over the OpenCode Zen
 *  free pool.
 *
 *  Callers see ten ZYRAXON models and never see an upstream name. Each brand is
 *  bound to a preferred upstream model, but the binding is a *preference*, not a
 *  fact: the upstream catalogue changes without notice (models are added and
 *  retired weekly). So every brand carries a full rotation chain of the other
 *  live free models, and `resolveBrandChain` walks it in order.
 *
 *  The upstream path is the public `inference` host. The console-gated `zen`
 *  host answers every public request with FreeTierError regardless of the
 *  session fingerprint, so pointing at `zen` made every model look broken.
 */
import {
  DEFAULT_ZEN_MODEL,
  completeRaw,
  completeWireRaw,
  needsWire,
  resolveApiKey,
  streamRaw,
  streamWireRaw,
  zenFreeModels,
  zenLiveIds,
  type ChatMessage,
  type WireTool,
  type ZenModel,
} from "@/lib/builder/zen.server";
import { LaneShedError, lanePool } from "./lane-pool.server";
import { withProviderContract } from "./provider-contract";
import {
  fitsModalities,
  normaliseContent,
  requiredModalities,
  toSdkContent,
  toWireContent,
  type MediaKind,
  type NormalisedPart,
} from "./media";
import {
  ZYRAXON_BRANDS,
  brandView,
  capabilityScore,
  getBrand,
  rotateThrough,
  rotationFor,
  type Brand,
  type BrandView,
} from "./zyraxon-brands";

export {
  rotationFor,
  brandView,
  isBrand,
  getBrand,
  rotateThrough,
  isUpstreamGate,
} from "./zyraxon-brands";
export type { BrandView, BrandId } from "./zyraxon-brands";

/** Every brand with its live binding, in one catalogue read. */
export async function brandCatalogue(): Promise<BrandView[]> {
  const [pool, live] = await Promise.all([zenFreeModels(), zenLiveIds()]);
  return ZYRAXON_BRANDS.map((b) => brandView(b, pool, live));
}

/** Resolve a brand id to its ordered upstream chain, plus the model the
 *  response should be labelled with (our brand, never the upstream name).
 *
 *  When the turn carries media, the chain is ordered so models that can actually
 *  accept every required modality come first. A request that needs video is
 *  never sent to a text-only model first and made to fail its way down the list. */
export async function resolveBrandChain(
  modelId: string,
  need: Set<MediaKind> = new Set(),
): Promise<{ brand: Brand; chain: string[] } | null> {
  const brand = getBrand(modelId);
  if (!brand) return null;
  const [pool, live] = await Promise.all([zenFreeModels(), zenLiveIds()]);
  const chain = rotationFor(brand, pool);
  const served = live ? chain.filter((id) => live.has(id)) : chain;
  const base = served.length ? served : [chain[0] || brand.preferred];
  if (need.size === 0) return { brand, chain: base };

  const byId = new Map(pool.map((m) => [m.id, m]));
  const fits = (id: string) => fitsModalities(need, byId.get(id)?.modalities ?? ["text"]);
  // Capable models first (best capability score among them), then the rest, so a
  // media turn still degrades to a real attempt instead of a fabricated error.
  const capable = base.filter(fits).sort((a, b) => {
    const ma = byId.get(a);
    const mb = byId.get(b);
    return capabilityScore(brand, mb ?? { id: b }) - capabilityScore(brand, ma ?? { id: a });
  });
  const rest = base.filter((id) => !fits(id));
  return { brand, chain: [...capable, ...rest] };
}

/** Run a chat turn for a brand, rotating through the upstream pool when a
 *  model is retired, rate-limited, or returns nothing. The caller only ever
 *  sees the ZYRAXON name.
 *
 *  The whole turn runs inside one lane from `lanePool`, so a burst of inbound
 *  requests becomes a bounded number of concurrent upstream conversations
 *  instead of one per caller. Each lane carries its own session fingerprint:
 *  the upstream throttles the request that caused the load, never the
 *  deployment as a whole. A lane that cannot start within the queue deadline is
 *  shed with a 503 rather than queued forever, so no caller is silently stuck
 *  behind another. */
export type BrandTurnOptions = {
  /** Ask for a single JSON completion instead of an SSE stream. */
  stream?: boolean;
  /** Upstream call to use for a streaming turn. Injectable for tests. */
  send?: typeof streamRaw;
  /** Upstream call to use for a non-streaming turn. Injectable for tests. */
  complete?: typeof completeRaw;
  /** Chain resolver. Injectable for tests. */
  resolve?: typeof resolveBrandChain;
  /** Optional stable seed so one end user keeps a memory window upstream while
   *  remaining isolated from every other end user. */
  seed?: string;
  /** Output token budget. Defaults to the brand's live cap, capped for safety. */
  maxOutputTokens?: number;
  /** Caller-defined tools, in OpenAI wire form. A turn that carries tools is
   *  posted on the wire path, because the SDK path advertises only the gate
   *  catalogue and would silently drop the caller's definitions. */
  tools?: WireTool[];
};

/** Run a chat turn for a brand, rotating through the upstream pool when a
 *  model is retired, rate-limited, or returns nothing. The caller only ever
 *  sees the ZYRAXON name.
 *
 *  The whole turn runs inside one lane from `lanePool`, so a burst of inbound
 *  requests becomes a bounded number of concurrent upstream conversations
 *  instead of one per caller. Each lane carries its own session fingerprint:
 *  the upstream throttles the request that caused the load, never the
 *  deployment as a whole. A lane that cannot start within the queue deadline is
 *  shed with a 503 rather than queued forever, so no caller is silently stuck
 *  behind another. */
export async function brandChatStream(
  modelId: string,
  messages: ChatMessage[],
  apiKey?: string,
  options: BrandTurnOptions = {},
): Promise<Response> {
  const {
    stream = true,
    send,
    complete,
    resolve = resolveBrandChain,
    seed,
    maxOutputTokens,
    tools,
  } = options;

  // Shape every message once. The SDK shape is the default, because the SDK
  // gives us retries and tool plumbing; but audio and video have no SDK part at
  // all, so a turn carrying either is posted on the raw wire path instead, where
  // `input_audio` / `video_url` survive intact.
  //
  // The provider contract is injected here, before any shaping, so it is the
  // first thing the model reads on every turn regardless of which path the turn
  // takes or what the caller sent. A caller-supplied system message is kept and
  // follows the contract; see `withProviderContract`.
  const contracted = withProviderContract(messages);
  const canonical = contracted.map((m) => ({
    role: m.role,
    content: normaliseContent(m.content),
  }));
  // Audio and video have no AI-SDK message part, so a turn carrying either is
  // posted on the raw OpenAI wire path, where `input_audio`/`video_url` survive.
  // Caller-defined tools force the same path: the SDK path advertises only the
  // gate catalogue, so a `tools` array would be dropped and the model would
  // answer as though no tools existed. Everything else keeps the SDK path
  // (retries, tool plumbing, usage).
  const wire = needsWire(messages) || (tools?.length ?? 0) > 0;
  const useSend = send ?? (wire ? streamWireRaw : streamRaw);
  const useComplete = complete ?? (wire ? completeWireRaw : completeRaw);
  const finalMessages = canonical.map((m) => ({
    role: m.role,
    content: wire ? toWireContent(m.content) : toSdkContent(m.content),
  }));
  // Modality routing reads the *raw* inbound parts, where the caller's own
  // spelling (`image_url`, `video_url`, `input_audio`) still distinguishes
  // image from audio from video. The SDK shape collapses all three into
  // `image`/`file`, which is too coarse to route on.
  const need = requiredModalities(messages.map((m) => ({ content: m.content })));

  const resolved = await resolve(modelId, need);
  if (!resolved) {
    return Response.json(
      {
        error: {
          message: `Unknown model: ${modelId || "(missing)"}. Call GET /api/public/zyraxon/v1/models for the ZYRAXON model list.`,
          type: "invalid_request_error",
        },
      },
      { status: 400, headers: { "Access-Control-Allow-Origin": "*" } },
    );
  }
  const { brand, chain } = resolved;
  const key = resolveApiKey(apiKey);
  const budget = Math.min(maxOutputTokens ?? 16000, 32768);

  try {
    // A streaming turn holds its lane until the body is drained; a non-streaming
    // turn releases as soon as the JSON is built. Either way `maxActive` bounds
    // the number of concurrent upstream conversations, not just their setup.
    const runner = stream
      ? (work: (lane: any) => Promise<Response>, seed?: string) => lanePool.stream(work, seed)
      : (work: (lane: any) => Promise<Response>, seed?: string) => lanePool.run(work, seed);

    return await runner(async (lane) => {
      const outcome = await rotateThrough(
        chain,
        async (upstream) => {
          if (lane.attemptsLeft <= 0) {
            return { ok: false as const, status: 503, detail: "lane attempt budget exhausted" };
          }
          lane.attemptsLeft--;
          const out = stream
            ? await useSend(key, upstream, finalMessages, budget, brand.label, lane.sessionId, tools)
            : await useComplete(key, upstream, finalMessages, budget, brand.label, lane.sessionId, tools);
          if (!("failed" in out)) return { ok: true as const, value: out };
          return {
            ok: false as const,
            status: out.failed?.status ?? 502,
            detail: String(out.failed?.detail ?? ""),
          };
        },
        lane.attemptsLeft,
      );
      if (outcome.ok) {
        const res = outcome.value as Response;
        // Advertise two things the caller (and an operator) can act on: the
        // modalities the turn actually used, so a real media answer is
        // distinguishable from a degraded text-only one, and the capacity tier
        // that served it. `spill` means the primary lane budget was full and the
        // turn was handed to the OpenCode Zen free pool instead of being shed —
        // a successful answer, just served from the overflow.
        const headers = new Headers(res.headers);
        if (need.size) headers.set("X-ZYRAXON-Input-Modalities", Array.from(need).sort().join(","));
        headers.set("X-ZYRAXON-Capacity", lane.tier);
        return new Response(res.body, { status: res.status, headers });
      }
      return brandFailureResponse(brand, outcome.tried, outcome.gate);
    }, seed);
  } catch (e) {
    if (e instanceof LaneShedError) {
      return Response.json(
        {
          error: {
            message: `${brand.label} is at capacity right now — the request was shed instead of queued so it does not block other callers. Retry in a moment.`,
            type: "overloaded",
            model: brand.id,
          },
        },
        { status: 503, headers: { "Access-Control-Allow-Origin": "*", "Retry-After": "1" } },
      );
    }
    throw e;
  }
}

/** The failure body. Says which of the two very different things happened:
 *  telling a caller the pool is "unavailable" when the truth is a credential
 *  gate sends them to debug the wrong system. */
function brandFailureResponse(
  brand: Brand,
  tried: Array<{ upstream: string; status: number; gate: boolean }>,
  gate: boolean,
): Response {
  const message = gate
    ? `${brand.label} could not be served: the upstream free tier refused this caller (FreeTierError). Set OPENCODE_ZEN_API_KEY, or call from a network the upstream free tier serves.`
    : `${brand.label} could not be served right now — every model in its rotation was unavailable. Retrying in a moment usually works.`;

  return Response.json(
    {
      error: { message, type: gate ? "upstream_gate" : "provider_unavailable", model: brand.id },
      tried: tried.map(({ upstream, status, gate: g }) => ({
        upstream,
        status,
        ...(g ? { gate: true } : {}),
      })),
    },
    { status: gate ? 503 : 502, headers: { "Access-Control-Allow-Origin": "*" } },
  );
}
