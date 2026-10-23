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
  isQuotaFailure,
  noteKeyLimited,
  pickUpstreamKey,
} from "@/lib/builder/zen.server";
import { egressFor, noteRefusal, releaseEgress } from "@/lib/providers/egress.server";
import { clearQuotaReset, quotaResetStatus } from "@/lib/providers/quota.server";
import {
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
  normaliseContent,
  requiredModalities,
  toSdkContent,
  toWireContent,
  type MediaKind,
} from "./media";
import { inlineRemoteMedia } from "./remote-media.server";
import {
  MEDIA_DENIAL,
  ensureCapabilities,
  recordOutcome,
  registerProbeTransport,
  supports,
} from "./media-capability.server";
import {
  AUDIO_VERIFIED_SEED,
  VIDEO_VERIFIED_SEED,
  ZYRAXON_BRANDS,
  brandView,
  getBrand,
  isUpstreamGate,
  measuredTtftMs,
  raceFor,
  rotateThrough,
  rotationFor,
  type Brand,
  type BrandView,
  type PoolModel,
} from "./zyraxon-brands";

export {
  rotationFor,
  brandView,
  isBrand,
  getBrand,
  canonicalBrandId,
  rotateThrough,
  isUpstreamGate,
  measuredTtftMs,
} from "./zyraxon-brands";
export type { BrandView, BrandId } from "./zyraxon-brands";

/** The measured capability of the live pool, as the brand router needs it.
 *
 *  `ensureCapabilities` has its own deadline, so a cold start delays the first
 *  catalogue read by at most that deadline and never fails it.
 */
async function measuredOracle(
  ids: string[],
): Promise<((id: string, m: "image" | "audio" | "video") => boolean | undefined) | undefined> {
  if (!ids.length) return undefined;
  try {
    await ensureCapabilities(ids);
  } catch {
    return undefined;
  }
  return (id, m) => supports(id, m);
}

/** Teach the capability registry how to reach an upstream.
 *
 *  Registered once at module load, from the one place that already knows the
 *  transport. The registry is kept free of this import so it can be driven by a
 *  test without a network, and so the base64 fixtures never reach a module the
 *  browser bundle pulls in. */
registerProbeTransport(async (upstream, messages, maxTokens) => {
  const out = await completeWireRaw(
    pickUpstreamKey(undefined),
    upstream,
    messages,
    maxTokens,
    "capability-probe",
  );
  if ("failed" in out) return { ok: false, status: out.failed.status, detail: out.failed.detail };
  const body = (await out.json().catch(() => null)) as {
    choices?: Array<{ message?: { content?: unknown } }>;
  } | null;
  const content = body?.choices?.[0]?.message?.content;
  return { ok: true, text: typeof content === "string" ? content : "" };
});

/** Every brand with its live binding, in one catalogue read. */
export async function brandCatalogue(): Promise<BrandView[]> {
  const [pool, live] = await Promise.all([zenFreeModels(), zenLiveIds()]);
  const oracle = await measuredOracle(pool.map((m) => m.id));
  return ZYRAXON_BRANDS.map((b) => brandView(b, pool, live, oracle));
}

/** Resolve a brand id to its ordered upstream chain, plus the model the
 *  response should be labelled with (our brand, never the upstream name).
 *
 *  The chain comes from `rotationFor`, so it already puts models that can accept
 *  every required modality first and the fastest of equals next. The head of the
 *  chain is therefore the binding, which is what `activeFor` reports for the
 *  catalogue too — the page and the wire can never disagree about which upstream
 *  a brand is on.
 *
 *  `need` is what the turn actually carries, so the measured capability map is
 *  consulted for those modalities and only those. A turn with no media skips the
 *  probe entirely and keeps its previous, faster path. */
export async function resolveBrandChain(
  modelId: string,
  need: Set<MediaKind> = new Set(),
): Promise<{ brand: Brand; chain: string[]; pool: PoolModel[] } | null> {
  const brand = getBrand(modelId);
  if (!brand) return null;
  const [pool, live] = await Promise.all([zenFreeModels(), zenLiveIds()]);
  // Only measure when the turn carries media; a plain text turn has nothing to
  // measure and should not pay for a sweep.
  const oracle = need.size ? await measuredOracle(pool.map((m) => m.id)) : undefined;
  const chain = rotationFor(brand, pool, live, need, oracle);
  // A caller that only needs the order still gets it; the pool travels along so
  // the fallback below can reach every model, not just the chain's head.
  return { brand, chain, pool };
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
  resolve?: (
    modelId: string,
    need: Set<MediaKind>,
  ) => Promise<{ brand: Brand; chain: string[]; pool?: PoolModel[] } | null>;
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

  // Resolve any media the caller pointed at rather than embedded. This runs
  // before every other shaping step, so `needsWire`, modality routing and the
  // upstream payload all see the same fully-inline turn. A remote reference
  // that cannot be read fails the turn: answering without the media a caller
  // sent is the one outcome worse than not answering.
  const inlined = await inlineRemoteMedia(messages);
  if (inlined.stats.failures.length) {
    const first = inlined.stats.failures[0];
    return Response.json(
      {
        error: {
          message: `Could not read remote media: ${first.reason} (${first.url}). Fetch the file yourself and send it inline as a data URL, or make the URL publicly reachable.`,
          type: "invalid_request_error",
          failed_urls: inlined.stats.failures,
        },
      },
      { status: 400, headers: { "Access-Control-Allow-Origin": "*" } },
    );
  }
  const inbound = inlined.messages as ChatMessage[];

  // Shape every message once. The SDK shape is the default, because the SDK
  // gives us retries and tool plumbing; but audio and video have no SDK part at
  // all, so a turn carrying either is posted on the raw wire path instead, where
  // `input_audio` / `video_url` survive intact.
  //
  // The provider contract is injected here, before any shaping, so it is the
  // first thing the model reads on every turn regardless of which path the turn
  // takes or what the caller sent. A caller-supplied system message is kept and
  // follows the contract; see `withProviderContract`.
  const contracted = withProviderContract(inbound);
  const canonical = contracted.map((m) => {
    const out: any = { role: m.role, content: normaliseContent(m.content) };
    // A tool turn carries an id that ties it to the call that asked for it, and
    // an assistant turn that requests tools carries the calls themselves. Both
    // must survive normalisation or the upstream cannot match result to call.
    if (m.tool_calls?.length) out.tool_calls = m.tool_calls;
    if (m.tool_call_id) out.tool_call_id = m.tool_call_id;
    if (m.name) out.name = m.name;
    return out;
  });
  // Audio and video have no AI-SDK message part, so a turn carrying either is
  // posted on the raw OpenAI wire path, where `input_audio`/`video_url` survive.
  // Caller-defined tools force the same path: the SDK path advertises only the
  // gate catalogue, so a `tools` array would be dropped and the model would
  // answer as though no tools existed. A tool result (or a turn with a tool
  // call) does too — the SDK message schema has no room for `tool_call_id`.
  const wire =
    needsWire(inbound) ||
    (tools?.length ?? 0) > 0 ||
    inbound.some((m) => m.role === "tool" || (m.tool_calls?.length ?? 0) > 0);
  const useSend = send ?? (wire ? streamWireRaw : streamRaw);
  const useComplete = complete ?? (wire ? completeWireRaw : completeRaw);
  const finalMessages = canonical.map((m: any) => ({
    role: m.role,
    content: wire ? toWireContent(m.content) : toSdkContent(m.content),
    ...(m.tool_calls ? { tool_calls: m.tool_calls } : {}),
    ...(m.tool_call_id ? { tool_call_id: m.tool_call_id } : {}),
    ...(m.name ? { name: m.name } : {}),
  }));
  // Modality routing reads the *raw* inbound parts, where the caller's own
  // spelling (`image_url`, `video_url`, `input_audio`) still distinguishes
  // image from audio from video. The SDK shape collapses all three into
  // `image`/`file`, which is too coarse to route on.
  const need = requiredModalities(inbound.map((m) => ({ content: m.content })));

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
  const pool = resolved.pool ?? [];
  // The credential is chosen per turn, not per deployment: a caller's own key
  // wins, otherwise the pool is scanned for one that is not cooling down. The
  // holder below lets the attempt loop swap it when a key reports a spent
  // quota, which is the one failure that following the model rotation cannot
  // fix — the next model is on the same account.
  let key = pickUpstreamKey(apiKey);
  const swapKey = (detail: unknown): boolean => {
    if (apiKey?.trim()) return false; // the caller's own key is not ours to swap
    if (!isQuotaFailure(detail)) return false;
    if (key) noteKeyLimited(key);
    const next = pickUpstreamKey(undefined);
    if (!next || next === key) return false;
    key = next;
    return true;
  };
  const budget = Math.min(maxOutputTokens ?? 16000, 32768);

  try {
    // A streaming turn holds its lane until the body is drained; a non-streaming
    // turn releases as soon as the JSON is built. Either way `maxActive` bounds
    // the number of concurrent upstream conversations, not just their setup.
    //
    // A media turn gets the longer backstop: the model has to take in the bytes
    // before it can answer, and the free models that can do that think for a
    // minute or more first. The text backstop would cut the stream right as the
    // answer began, handing the caller an empty body for a turn that had nearly
    // finished.
    const laneOpts = need.size > 0 ? { workMs: lanePool.mediaWorkMs } : undefined;
    // One clock for the whole turn. The chain and the pool-wide sweep that
    // follows it share it, so their budgets can never sum past the point where
    // an intermediary gives up — which is what produced the opaque 502 this
    // path exists to avoid. Text is bounded well under the edge's patience;
    // media gets longer because the model must take in the bytes first.
    const turnMs = need.size > 0 ? 100_000 : 48_000;
    const turnDeadline = Date.now() + turnMs;
    const remainingMs = () => Math.max(1_000, turnDeadline - Date.now());
    // Attempts are shared by the chain and the pool-wide fallback that follows
    // it, so the budget has to cover both: a chain that exhausts its own passes
    // must still leave room to reach the rest of the pool. The wall-clock
    // budgets, not this count, are what actually stop a turn.
    const laneAttempts = 24;
    const runner = stream
      ? (work: (lane: any) => Promise<Response>, seed?: string) =>
          lanePool.stream(work, seed, laneAttempts, laneOpts)
      : (work: (lane: any) => Promise<Response>, seed?: string) =>
          lanePool.run(work, seed, laneAttempts, laneOpts);

    return await runner(async (lane) => {
      // A media turn must not be answered by a model that never received the
      // bytes. Such a model still returns 200 with a denial, so the refusal is
      // detected here and the attempt is re-asked — or rotated — rather than
      // passed to the caller as an answer.
      const mediaNeed = need.size > 0;
      const rejectsDenial = (text: string) => mediaNeed && MEDIA_DENIAL.test(text);
      // One attempt, shared by every strategy below.
      //
      // A spent free tier is often momentary: the window rolls over, or the
      // address that reported the limit is dropped and the next attempt leaves
      // by another one. So a quota refusal is re-asked on the *same* model with
      // the *same* session fingerprint several times before it is reported —
      // the session is kept alive and only the request is stopped and sent
      // again, which is what the upstream's own client does, and it is what
      // turns a transient 429 into an answer instead of an error.
      //
      // Eight attempts, made back to back: a rolling window opens in seconds,
      // so the re-ask must be fast enough to catch it. A turn that succeeds on
      // any of them is served and the caller never learns a limit was hit.
      // Only when every re-ask is refused does the turn surface the reset clock.
      const quotaAttempts = Math.max(1, Number(process.env.ZYRAXON_QUOTA_ATTEMPTS || 8));
      const tryUpstream = async (
        upstream: string,
      ): Promise<
        { ok: true; value: Response } | { ok: false; status: number; detail: string }
      > => {
        let out: Response | { failed: any } = { failed: { detail: "not attempted" } };
        for (let quotaTry = 1; quotaTry <= quotaAttempts; quotaTry++) {
          if (lane.attemptsLeft <= 0) {
            return { ok: false as const, status: 503, detail: "lane attempt budget exhausted" };
          }
          lane.attemptsLeft--;
          out = stream
            ? await useSend(
                key,
                upstream,
                finalMessages,
                budget,
                brand.label,
                lane.sessionId,
                tools,
                mediaNeed ? { reject: rejectsDenial } : undefined,
              )
            : await useComplete(
                key,
                upstream,
                finalMessages,
                budget,
                brand.label,
                lane.sessionId,
                tools,
                mediaNeed ? { reject: rejectsDenial } : undefined,
              );
          if (!("failed" in out)) {
            // A served turn is proof the pool is open again, whatever the
            // recorded reset still claims. Clearing it here is what turns a
            // countdown into the truth: the next reader is told the pool is
            // serving because a real turn just was, not because a timer
            // happened to run out.
            clearQuotaReset();
            return { ok: true as const, value: out as Response };
          }
          const why = String(out.failed?.detail ?? "");
          // A credential gate is an account decision, not a momentary one: the
          // same request will be refused every time, so re-asking it would only
          // add latency before the same answer.
          if (isUpstreamGate(why)) break;
          if (!isQuotaFailure(why) || quotaTry >= quotaAttempts) break;
          // The address that reported the limit is released here, so the re-ask
          // below is free to leave by a different one when the deployment holds
          // a pool. The pause is deliberately short: a rolling window opens in
          // seconds, so the whole eight-attempt sequence must fit inside the
          // caller's patience rather than backing off into a long wait. This is
          // *not* the address cooldown — that is measured in minutes and would
          // stop the very re-ask that recovers the turn.
          releaseEgress(lane.sessionId);
          await new Promise((r) => setTimeout(r, 150));
        }
        const detail = String((out as { failed?: any }).failed?.detail ?? "");
        // The refusal may be the *address* being over its limit rather than the
        // model or the account being unusable. Park this address so the rest of
        // the turn — and the turns that follow — leave by another one, which is
        // what keeps one limited address from failing everyone routed to it.
        if (isQuotaFailure(detail) || /429|rate.?limit/i.test(detail)) {
          const proxy = egressFor(lane.sessionId);
          // A socket proxy is one address and is parked; a gateway is a pool and
          // only collects a strike, so its rotation survives this refusal.
          if (proxy) noteRefusal(proxy);
          // Drop the held address too: the next attempt on this lane must be
          // free to take a fresh one instead of reusing the limited address.
          releaseEgress(lane.sessionId);
        }
        // A spent quota is the one refusal the model rotation cannot route
        // around: the next model sits on the same account. Swapping to another
        // credential is the only move that can still serve the turn.
        if (swapKey(detail)) {
          return {
            ok: false as const,
            status: (out as { failed?: any }).failed?.status ?? 502,
            detail: `${detail} (key rotated)`,
          };
        }
        return {
          ok: false as const,
          status: (out as { failed?: any }).failed?.status ?? 502,
          detail,
        };
      };

      // A losing racer must not stay open: cancel its body so the upstream
      // conversation and the lane it holds are both released.
      const discard = (value: Response) => {
        value.body?.cancel().catch(() => {});
      };

      const retryHook = async (
        upstream: string,
        failure: { status: number },
        n: number,
      ): Promise<boolean> => {
        if (failure.status !== 422) return false;
        const seeded = need.has("audio")
          ? AUDIO_VERIFIED_SEED.has(upstream)
          : need.has("video")
            ? VIDEO_VERIFIED_SEED.has(upstream)
            : false;
        const able = ["image", "audio", "video"].some(
          (k) => need.has(k as MediaKind) && supports(upstream, k as never) === true,
        );
        if (!seeded && !able) return false;
        const limit = seeded ? 3 : 2;
        if (n >= limit) return false;
        // Space the retries: a back-to-back repeat tends to reproduce the same
        // miss, and a short pause lets the upstream's own load rebalance.
        await new Promise((r) => setTimeout(r, 250 * n));
        return true;
      };

      // A media turn has to go in order. Only one or two models in the pool can
      // actually hear or see the bytes, the rest answer "no audio attached", and
      // racing them in parallel would spend the budget collecting refusals
      // instead of asking the one model that can do the job. A text turn has no
      // such constraint, so it races: the fastest model that answers wins, which
      // is both faster and far harder to fail than walking the chain one by one.
      const outcome = mediaNeed
        ? await rotateThrough(chain, tryUpstream, lane.attemptsLeft, retryHook, {
            budgetMs: Math.floor(remainingMs() * 0.6),
          })
        : await raceFor(chain, tryUpstream, {
            // Width is a cost, not just a latency knob: every racer is another
            // concurrent conversation with the same free upstream, and asking
            // too many at once is itself what makes a free tier start refusing.
            // Three is enough to survive one dead and one slow candidate while
            // staying a light load; the fallback below covers the rest.
            hedgeMs: 1_500,
            budgetMs: Math.floor(remainingMs() * 0.7),
            max: 3,
            discard,
          });

      if (outcome.ok) {
        const res = outcome.value as Response;
        // A real answer from a model that received the media is the strongest
        // evidence there is, so the map learns from the caller's own payload.
        if (mediaNeed) {
          for (const k of need) {
            if (k === "image" || k === "audio" || k === "video")
              recordOutcome(outcome.upstream, k, true);
          }
        }
        const headers = new Headers(res.headers);
        if (need.size) headers.set("X-ZYRAXON-Input-Modalities", Array.from(need).sort().join(","));
        headers.set("X-ZYRAXON-Capacity", lane.tier);
        if (!mediaNeed) headers.set("X-ZYRAXON-Rotation", "race");
        return new Response(res.body, { status: res.status, headers });
      }

      // Nothing answered yet. The race only covered the head of the chain; the
      // rest of the live pool is still there, and a turn is never refused while
      // any reachable model can serve it. This sweep runs the same way — raced,
      // fastest measured first — so a recovery costs about as little as the
      // attempt that failed.
      //
      // A spent quota is the exception: it is an account decision, so the sweep
      // would walk every remaining model only to collect the same 429 from each
      // and make the caller wait through all of it. Report it now.
      const quota = outcome.quota === true || outcome.tried.every((t) => isQuotaFailure(t.detail));
      const attempted = new Set(outcome.tried.map((t: { upstream: string }) => t.upstream));
      const NEUTRAL_TTFT_MS = 3_000;
      const rank = (id: string) => {
        const ms = measuredTtftMs(id);
        return Number.isFinite(ms) ? ms : NEUTRAL_TTFT_MS;
      };
      const sweep = pool
        .map((m) => m.id)
        .filter((id: string) => !attempted.has(id))
        .sort((a: string, b: string) => rank(a) - rank(b));
      if (sweep.length && !quota) {
        const recovered = mediaNeed
          ? await rotateThrough(sweep, tryUpstream, lane.attemptsLeft, retryHook, {
              budgetMs: remainingMs(),
              passes: 2,
            })
          : await rotateThrough(sweep, tryUpstream, lane.attemptsLeft, undefined, {
              // The fallback runs in order rather than in parallel: it exists
              // for the case where the raced head all refused, and racing the
              // whole pool there would multiply the very load that produced the
              // refusal. Each candidate is dropped fast when silent, so walking
              // it is still quick.
              budgetMs: remainingMs(),
            });
        if (recovered.ok) {
          const res = recovered.value as Response;
          if (mediaNeed) {
            for (const k of need) {
              if (k === "image" || k === "audio" || k === "video")
                recordOutcome(recovered.upstream, k, true);
            }
          }
          const headers = new Headers(res.headers);
          if (need.size)
            headers.set("X-ZYRAXON-Input-Modalities", Array.from(need).sort().join(","));
          headers.set("X-ZYRAXON-Capacity", lane.tier);
          headers.set("X-ZYRAXON-Rotation", "pool-fallback");
          return new Response(res.body, { status: res.status, headers });
        }
        outcome.tried.push(...recovered.tried);
      }
      return brandFailureResponse(brand, outcome.tried, outcome.gate, quota);
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
  tried: Array<{ upstream: string; status: number; gate: boolean; detail?: string }>,
  gate: boolean,
  quotaHint = false,
): Response {
  // A spent free-tier quota is not an outage. Every model in the rotation sits
  // on the same account, so a 429 here means the account is out of free turns
  // for now — telling the caller "every model was unavailable" hides the one
  // fact that explains it and the one thing that helps: wait, or add a key.
  const quota = !gate && tried.length > 0 && (quotaHint || tried.every((t) => isQuotaFailure(t.detail)));
  // The upstream's own reset clock. A quota refusal is not a guess: the
  // `retry-after` the official server sent says exactly when its window rolls
  // over, and only that number is published. When the server stated no clock
  // there is no honest number to show, so none is invented — the refusal says
  // so plainly and points at the one path that does not wait (a key).
  const reset = quota ? quotaResetStatus() : { spent: false as const };
  const retryAfterSeconds = reset.retryAfterSeconds;
  const resetAt = reset.resetAt;
  // State the reset in the units a person reads: "in 3h 20m" is an answer,
  // "in 12000 seconds" is arithmetic the caller has to do.
  const humanWait = (seconds: number) => {
    const total = Math.max(0, Math.ceil(seconds));
    const hours = Math.floor(total / 3600);
    const minutes = Math.ceil((total % 3600) / 60);
    if (hours > 0) return minutes > 0 ? `${hours}h ${minutes}m` : `${hours}h`;
    if (minutes > 0) return `${minutes}m`;
    return `${total}s`;
  };
  const message = gate
    ? `${brand.label} could not be served: the upstream free tier refused this caller (FreeTierError). Set OPENCODE_ZEN_API_KEY, or call from a network the upstream free tier serves.`
    : quota && retryAfterSeconds && resetAt
      ? `${brand.label} is temporarily out of free capacity — the shared upstream free tier has spent its quota for this window. It opens again in about ${humanWait(retryAfterSeconds)} (around ${new Date(resetAt).toUTCString()}), as stated by the upstream server. Set OPENCODE_ZEN_API_KEY for a keyed quota that does not wait.`
      : quota
        ? `${brand.label} is temporarily out of free capacity — the shared upstream free tier has spent its quota for this window, and the upstream did not state a reset time, so none is shown rather than a guess. Set OPENCODE_ZEN_API_KEY for a keyed quota that does not wait, or retry shortly.`
        : `${brand.label} could not be served right now — every model in its rotation was unavailable. Retrying in a moment usually works.`;

  return Response.json(
    {
      error: {
        message,
        type: gate ? "upstream_gate" : quota ? "free_tier_quota" : "provider_unavailable",
        model: brand.id,
        // When the free tier opens again, in the same shape the upstream states
        // it: a countdown a client can tick down, and the absolute moment it
        // lands on. Both are published because a countdown needs the seconds
        // and a page that loads late needs the timestamp. Neither is sent when
        // the upstream stated no clock — a client shows a real countdown or
        // nothing, never a fabricated one.
        ...(quota && retryAfterSeconds ? { retryAfterSeconds } : {}),
        ...(quota && resetAt ? { resetAt } : {}),
      },
      tried: tried.map(({ upstream, status, gate: g, detail }) => ({
        upstream,
        status,
        // The upstream's own words, trimmed. An operator cannot tell a rate
        // limit from a retired model from a network fault without them, and a
        // caller reading the failure deserves the same answer an operator gets.
        ...(detail ? { detail: String(detail).slice(0, 200) } : {}),
        ...(g ? { gate: true } : {}),
      })),
    },
    {
      status: gate ? 503 : quota ? 429 : 502,
      headers: {
        "Access-Control-Allow-Origin": "*",
        // Relay the upstream's own clock, never a substitute for it.
        ...(quota && retryAfterSeconds ? { "Retry-After": String(retryAfterSeconds) } : {}),
      },
    },
  );
}
