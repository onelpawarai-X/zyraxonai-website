// Proves the rooted-provider contract: ten stable ZYRAXON names, and a
// rotation that keeps each one answering when its preferred upstream model is
// retired, rate-limited, or missing from the live catalogue entirely.
//
// Run: npx tsx scripts/verify-brand-provider.ts
import {
  AUDIO_VERIFIED_SEED,
  MEASURED_TTFT_MS,
  ZYRAXON_BRANDS,
  acceptsAudio,
  activeFor,
  capabilityScore,
  getBrand,
  isBrand,
  measuredTtftMs,
  type CapabilityOracle,
} from "../src/lib/providers/zyraxon-brands";
import {
  rotationFor,
  brandView,
  rotateThrough,
  type PoolModel,
} from "../src/lib/providers/zyraxon-brands";

let failures = 0;
const check = (label: string, ok: boolean, detail = "") => {
  if (!ok) failures++;
  console.log(`${ok ? "PASS" : "FAIL"}  ${label}${detail ? `\n        ${detail}` : ""}`);
};

const mk = (id: string, extra: Partial<PoolModel> = {}): PoolModel => ({
  id,
  name: id,
  multimodal: false,
  reasoning: true,
  context: 200000,
  output: 32000,
  ...extra,
});

// 1. The line itself.
check("exactly ten brands are published", ZYRAXON_BRANDS.length === 10, `${ZYRAXON_BRANDS.length}`);
check(
  "every brand id is unique",
  new Set(ZYRAXON_BRANDS.map((b) => b.id)).size === 10,
);
check(
  "every brand id is prefixed and routable",
  ZYRAXON_BRANDS.every((b) => b.id.startsWith("zyraxon-") && isBrand(b.id)),
);
check("an unknown id is not a brand", !isBrand("gpt-4o") && !isBrand(""));
check(
  "the ten requested names are all present",
  [
    "zyraxon-apex",
    "zyraxon-matrix",
    "zyraxon-pulse",
    "zyraxon-titan",
    "zyraxon-neural",
    "zyraxon-codex",
    "zyraxon-visionary",
    "zyraxon-cyber",
    "zyraxon-quantum",
    "zyraxon-genesis",
  ].every((id) => isBrand(id)),
);

// 2. Rotation when the preferred model is present: it goes first, and every
//    other pool model still follows it as a fallback.
{
  const brand = getBrand("zyraxon-apex")!;
  const pool = [mk("beam-free"), mk("big-pickle"), mk("glm-5.3-flash-free")];
  const chain = rotationFor(brand, pool);
  check("preferred model leads the chain", chain[0] === "beam-free", chain.join(" → "));
  check("the whole pool is behind it", chain.length === pool.length);
  check(
    "no duplicates in the chain",
    new Set(chain).size === chain.length,
    chain.join(" → "),
  );
}

// 3. The case the user asked about: the preferred model is GONE from the live
//    catalogue. The brand must still resolve, to a different model.
{
  const brand = getBrand("zyraxon-genesis")!; // prefers jev-1.13-free
  const pool = [mk("big-pickle"), mk("glm-5.3-flash-free")]; // preferred absent
  const chain = rotationFor(brand, pool);
  check(
    "a retired preferred model does not empty the chain",
    chain.length > 0,
    chain.join(" → "),
  );
  check(
    "rotation moves to a live model instead",
    chain[0] === "big-pickle",
    chain.join(" → "),
  );

  const view = brandView(brand, pool, new Set(["big-pickle"]));
  check("the brand still reports an active model", !!view.active, view.active);
  check(
    "and it is flagged as rotated, not failed",
    view.preferredAvailable === false && view.active === "big-pickle",
    `active=${view.active} preferredAvailable=${view.preferredAvailable}`,
  );
}

// 4. When the console serves only a subset, the chain is filtered to what is
//    actually being served — but never becomes empty.
{
  const brand = getBrand("zyraxon-codex")!;
  const pool = [mk("deepseek-v4.1-flash-free"), mk("big-pickle"), mk("beam-free")];
  const live = new Set(["beam-free"]);
  const view = brandView(brand, pool, live);
  check(
    "the active model is one the console serves",
    live.has(view.active),
    `active=${view.active}`,
  );
  check(
    "the brand is marked rotated when its preference is not served",
    view.preferredAvailable === false,
  );
}

// 5. A brand whose entire chain is gone still reports an active model, so the
//    caller gets a real upstream error rather than a fabricated 400.
{
  const brand = getBrand("zyraxon-titan")!;
  const view = brandView(brand, [], null);
  check("an empty pool still yields an active model", !!view.active, view.active);
}

// 6. Capability metadata flows through from the pool, so the catalogue and the
//    page can show real context sizes rather than hardcoded ones.
{
  const brand = getBrand("zyraxon-quantum")!;
  const pool = [mk("longcat-2.5-preview-free", { context: 1000000, output: 131072, multimodal: true })];
  const view = brandView(brand, pool, null);
  check("context is read from the live model", view.context === 1000000, String(view.context));
  check("output is read from the live model", view.output === 131072, String(view.output));
  check("modality is read from the live model", view.multimodal === true);
}

// 7. The rotation policy itself. These cases are what make "a model is missing
//    → rotate to another" a fact rather than a claim.
{
  // Success on the first model: no extra upstreams are touched.
  const calls: string[] = [];
  const out = await rotateThrough(["a", "b", "c"], async (u) => {
    calls.push(u);
    return { ok: true as const, value: `served:${u}` };
  });
  check("the first healthy model is used", out.ok && out.value === "served:a");
  check("no further models are tried once one succeeds", calls.length === 1, calls.join(","));

  // The preferred model fails, a later one works: the caller still gets an answer.
  const tried2: string[] = [];
  const out2 = await rotateThrough(["gone", "broken", "good"], async (u) => {
    tried2.push(u);
    if (u === "good") return { ok: true as const, value: "answer" };
    return { ok: false as const, status: 404, detail: "model not found" };
  });
  check("a missing model rotates to the next one", out2.ok && out2.value === "answer");
  check(
    "rotation stops at the first success",
    tried2.join(",") === "gone,broken,good",
    tried2.join(","),
  );

  // Every model fails: the caller is told, and the report names what was tried.
  const out3 = await rotateThrough(["x", "y"], async (u) => ({
    ok: false as const,
    status: 502,
    detail: `upstream ${u} empty`,
  }));
  check("a fully failed rotation reports failure", !out3.ok);
  check(
    "and lists every attempt",
    !out3.ok && out3.tried.length === 2,
    !out3.ok ? out3.tried.map((t) => t.upstream).join(",") : "",
  );

  // The free-tier gate fails every model identically, so rotation must stop at
  // the first refusal rather than burning the whole pool.
  const gateCalls: string[] = [];
  const out4 = await rotateThrough(["a", "b", "c"], async (u) => {
    gateCalls.push(u);
    return {
      ok: false as const,
      status: 403,
      detail: '{"error":{"type":"FreeTierError","message":"free tier can only be used from within OpenCode"}}',
    };
  });
  check("the upstream gate is detected", !out4.ok && out4.gate === true);
  check("the gate stops rotation after one attempt", gateCalls.length === 1, gateCalls.join(","));

  // A rejected credential also fails every model, so it stops too.
  const authCalls: string[] = [];
  const out5 = await rotateThrough(["a", "b"], async (u) => {
    authCalls.push(u);
    return { ok: false as const, status: 401, detail: "unauthorized" };
  });
  check("a 401 stops rotation", !out5.ok && authCalls.length === 1, authCalls.join(","));

  // A retired preferred model is a normal miss, not a gate — rotation continues.
  const notFoundCalls: string[] = [];
  await rotateThrough(["retired", "live"], async (u) => {
    notFoundCalls.push(u);
    return { ok: false as const, status: 404, detail: "model not found" };
  });
  check(
    "a retired model does not stop rotation",
    notFoundCalls.length === 2,
    notFoundCalls.join(","),
  );

  // A media refusal is not an answer. The retry hook exists for the case where
  // the same model is the only one that can serve the modality: asking it again
  // beats rotating to a model that cannot hear the file at all.
  const retryCalls: string[] = [];
  const out6 = await rotateThrough(
    ["only-hearer", "deaf-sibling"],
    async (u) => {
      retryCalls.push(u);
      if (u === "only-hearer" && retryCalls.filter((x) => x === u).length === 1) {
        return { ok: false as const, status: 422, detail: "media not received" };
      }
      return { ok: true as const, value: `served:${u}` };
    },
    8,
    (_u, failure, n) => failure.status === 422 && n < 2,
  );
  check("a refusal is retried on the same model", out6.ok && out6.value === "served:only-hearer");
  check(
    "the retry happens before rotating away",
    retryCalls.join(",") === "only-hearer,only-hearer",
    retryCalls.join(","),
  );

  // A non-refusal failure is never retried: the hook must not slow down the
  // ordinary miss path.
  const noRetry: string[] = [];
  await rotateThrough(
    ["a", "b"],
    async (u) => {
      noRetry.push(u);
      return { ok: false as const, status: 404, detail: "model not found" };
    },
    8,
    (_u, failure, n) => failure.status === 422 && n < 2,
  );
  check("an ordinary miss is not retried", noRetry.join(",") === "a,b", noRetry.join(","));
}

// ── speed must break ties, but never override capability ────────────────────
// Two models that fit a brand equally are not equally good: the faster one is
// the answer. The order must put the fast model first, and it must NOT put a
// fast-but-incapable model ahead of a slower capable one.
{
  // Two synthetic models of equal capability but different measured speed: the
  // tiebreak must put the faster one first, and the slower one after it. Both
  // carry `reasoning` so they score identically for a reasoning-only brand.
  const fast: PoolModel = {
    id: "beam-free", // measured 1620ms
    modalities: ["text"],
    context: 200_000,
    reasoning: true,
  };
  const slow: PoolModel = {
    id: "deepseek-v4.1-flash-free", // measured 27470ms
    modalities: ["text"],
    context: 200_000,
    reasoning: true,
  };
  check("measured latency is read for a known model", measuredTtftMs("minimax-m3.1-flash-free") === 1560);
  check("an unmeasured model sorts last (Infinity)", measuredTtftMs("brand-new-free") === Infinity);

  // Both fit equally (same score), so the tiebreak decides. `zyraxon-neural`
  // prefers big-pickle, which is absent from this pool.
  const neural = getBrand("zyraxon-neural")!; // prefers big-pickle, profile reasoning only
  const pool: PoolModel[] = [slow, fast];
  check(
    "the two models score equally for this brand",
    capabilityScore(neural, fast) === capabilityScore(neural, slow),
    `${capabilityScore(neural, fast)} vs ${capabilityScore(neural, slow)}`,
  );
  const ordered = rotationFor(neural, pool, null);
  check(
    "the faster of two equal models leads",
    ordered[0] === "beam-free" && ordered[1] === "deepseek-v4.1-flash-free",
    ordered.join(" → "),
  );

  // Real-world shape: the pool the console actually serves, minus the brand's
  // preference, must lead with the fastest capable model — not with whatever
  // happens to be first in the alphabetical pool.
  const livePool: PoolModel[] = [
    { id: "deepseek-v4.1-flash-free", modalities: ["text", "image"], context: 200_000 },
    { id: "glm-5.3-flash-free", modalities: ["text", "image", "video", "pdf"], context: 200_000 },
    { id: "longcat-2.5-preview-free", modalities: ["text", "image"], context: 1_000_000 },
    { id: "minimax-m3.1-flash-free", modalities: ["text", "image", "video"], context: 1_000_000 },
    { id: "big-pickle", modalities: ["text"], context: 200_000 },
  ];
  // A vision brand with its preference absent must not land on the 27s or 14s
  // model when the 1.6s model fits exactly as well.
  const matrix = getBrand("zyraxon-matrix")!;
  const matrixChain = rotationFor(matrix, livePool, null);
  check(
    "a vision brand with an absent preference leads with the fastest vision model",
    matrixChain[0] === "minimax-m3.1-flash-free",
    matrixChain.join(" → "),
  );

  // Need-dependence, cleanly: a fast text-only model and a slower video-capable
  // one, for a brand whose profile does not itself demand video. Without media
  // the fast model leads; with a video part required the capable model must.
  const depPool: PoolModel[] = [
    { id: "beam-free", modalities: ["text"], context: 262_144, reasoning: true },
    { id: "glm-5.3-flash-free", modalities: ["text", "image", "video"], context: 262_144, reasoning: true },
  ];
  const general = getBrand("zyraxon-neural")!; // reasoning only
  check(
    "the two need-dependency models tie on capability",
    capabilityScore(general, depPool[0]) === capabilityScore(general, depPool[1]),
    `${capabilityScore(general, depPool[0])} vs ${capabilityScore(general, depPool[1])}`,
  );
  check(
    "with no media needed, the faster model leads",
    rotationFor(general, depPool, null)[0] === "beam-free",
    rotationFor(general, depPool, null).join(" → "),
  );
  // A declaration is not evidence, so the capable model only leads once a
  // measurement says it can see. `glm` is measured able; `beam` was not measured
  // for video at all, which is not the same as being measured unable.
  const videoOracle: CapabilityOracle = (id, m) => (id === "glm-5.3-flash-free" ? m === "video" : undefined);
  check(
    "with video needed, the measured-capable model leads even though it is slower",
    rotationFor(general, depPool, null, new Set(["video"] as const), videoOracle)[0] === "glm-5.3-flash-free",
    rotationFor(general, depPool, null, new Set(["video"] as const), videoOracle).join(" → "),
  );

  // MEASURED_TTFT_MS must not silently drift from what the pool serves: every
  // id in it should be a real free-pool upstream shape, and every timed value
  // must be a finite, positive number.
  check("every measured latency is finite and positive", Object.values(MEASURED_TTFT_MS).every((v) => Number.isFinite(v) && v > 0));
  check("the measured table is not empty", Object.keys(MEASURED_TTFT_MS).length > 0);

  // The reported binding and the chain head must be the same model, so the
  // catalogue page cannot name one upstream while the wire uses another.
  const { active, chain } = activeFor(matrix, livePool, null);
  check("activeFor reports the head of the chain", active === chain[0], `${active} vs ${chain[0]}`);
}

// ── audio routing must not trust the catalogue ──────────────────────────────
// The catalogue declares audio for models that then drop it and answer "no
// audio attached". Only the probed seed, or a live measurement, may be handed
// audio — never the catalogue alone.
{
  const claimsAudio = (id: string) => ({
    id,
    modalities: ["text", "audio"],
    context: 200000,
    output: 32000,
  });
  check(
    "a model the catalogue calls audio-capable but was never probed is refused",
    !acceptsAudio(claimsAudio("some-model-that-declares-audio")),
  );
  for (const id of AUDIO_VERIFIED_SEED) {
    check(`the probed audio seed ${id} is accepted`, acceptsAudio(claimsAudio(id)));
  }
  check(
    "a text-only model that is not a probed seed is never given audio",
    !acceptsAudio({ id: "some-text-only-model", modalities: ["text"] }),
  );
  // A measurement overrides the seed in both directions: it can promote a model
  // the seed does not list, and it can demote one the seed lists once that model
  // is found to drop audio.
  const saysYes = () => true;
  const saysNo = () => false;
  check(
    "a measurement can promote a model the seed does not list",
    acceptsAudio(claimsAudio("some-model-that-declares-audio"), saysYes),
  );
  check(
    "a measurement can demote a model the seed lists",
    !acceptsAudio(claimsAudio("mimo-v2.6-flash-free"), saysNo),
  );
  // Every brand that leads with audio must resolve to a probed upstream, or an
  // audio turn would be routed to a model that cannot hear it. The brand's
  // preference need not be the probed one — the rotation swaps to a model that
  // hears — so the check is on the chain, not on the preference alone.
  for (const brand of ZYRAXON_BRANDS.filter((b) => b.profile.audio)) {
    const chain = rotationFor(brand, [
      mk(brand.preferred, { modalities: ["text", "audio", "image", "video"] }),
      mk("mimo-v2.6-flash-free", { modalities: ["text", "audio", "image", "video"] }),
    ], null, new Set(["audio"]));
    check(
      `${brand.id} resolves an audio turn to a probed upstream`,
      chain.some((id) => AUDIO_VERIFIED_SEED.has(id)),
      chain.join(" → "),
    );
  }
}

console.log(`\n${failures === 0 ? "ALL BRAND CHECKS PASSED" : failures + " CHECK(S) FAILED"}`);
process.exit(failures === 0 ? 0 : 1);
