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
  resolveApiKey,
  streamRaw,
  zenFreeModels,
  zenLiveIds,
  type ChatMessage,
  type ZenModel,
} from "@/lib/builder/zen.server";
import { LaneShedError, lanePool } from "./lane-pool.server";
import {
  ZYRAXON_BRANDS,
  brandView,
  getBrand,
  rotateThrough,
  rotationFor,
  type Brand,
  type BrandView,
} from "./zyraxon-brands";

export { rotationFor, brandView, isBrand, getBrand, rotateThrough, isUpstreamGate } from "./zyraxon-brands";
export type { BrandView, BrandId } from "./zyraxon-brands";

/** Every brand with its live binding, in one catalogue read. */
export async function brandCatalogue(): Promise<BrandView[]> {
  const [pool, live] = await Promise.all([zenFreeModels(), zenLiveIds()]);
  return ZYRAXON_BRANDS.map((b) => brandView(b, pool, live));
}

/** Resolve a brand id to its ordered upstream chain, plus the model the
 *  response should be labelled with (our brand, never the upstream name). */
export async function resolveBrandChain(
  modelId: string,
): Promise<{ brand: Brand; chain: string[] } | null> {
  const brand = getBrand(modelId);
  if (!brand) return null;
  const [pool, live] = await Promise.all([zenFreeModels(), zenLiveIds()]);
  const chain = rotationFor(brand, pool);
  const served = live ? chain.filter((id) => live.has(id)) : chain;
  // A brand whose whole chain is unserved still gets one attempt at its
  // preferred model, so the caller sees the real upstream error instead of a
  // fabricated "unknown model".
  return { brand, chain: served.length ? served : [chain[0] || brand.preferred] };
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
export async function brandChatStream(
  modelId: string,
  messages: ChatMessage[],
  apiKey?: string,
  /** Upstream call to use. Defaults to the real transport; tests inject one so
   *  the rotation and labelling logic can be exercised without network access. */
  send: typeof streamRaw = streamRaw,
  /** Chain resolver. Defaults to the live catalogue; injectable for the same
   *  reason as `send`. */
  resolve: typeof resolveBrandChain = resolveBrandChain,
  /** Optional stable seed so one end user keeps a memory window upstream while
   *  remaining isolated from every other end user. */
  seed?: string,
): Promise<Response> {
  const resolved = await resolve(modelId);
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
  const finalMessages = messages.map((m) => ({
    role: m.role,
    content: typeof m.content === "string" ? m.content : m.content,
  }));

  try {
    return await lanePool.run(async (lane) => {
      const outcome = await rotateThrough(
        chain,
        async (upstream) => {
          if (lane.attemptsLeft <= 0) {
            return { ok: false as const, status: 503, detail: "lane attempt budget exhausted" };
          }
          lane.attemptsLeft--;
          const out = await send(key, upstream, finalMessages, 16000, brand.label, lane.sessionId);
          if (!("failed" in out)) return { ok: true as const, value: out };
          return {
            ok: false as const,
            status: out.failed?.status ?? 502,
            detail: String(out.failed?.detail ?? ""),
          };
        },
        lane.attemptsLeft,
      );
      if (outcome.ok) return outcome.value;
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
