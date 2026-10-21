// Proves the rooted-provider contract: ten stable ZYRAXON names, and a
// rotation that keeps each one answering when its preferred upstream model is
// retired, rate-limited, or missing from the live catalogue entirely.
//
// Run: npx tsx scripts/verify-brand-provider.ts
import {
  AUDIO_VERIFIED_UPSTREAMS,
  ZYRAXON_BRANDS,
  acceptsAudio,
  getBrand,
  isBrand,
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
}

// ── audio routing must not trust the catalogue ──────────────────────────────
// The catalogue declares audio for models that then drop it and answer "no
// audio attached". Only the probed set may be handed audio.
{
  const claimsAudio = (id: string) => ({
    id,
    modalities: ["text", "audio"],
    context: 200000,
    output: 32000,
  });
  check(
    "a model the catalogue calls audio-capable but was not probed is refused",
    !acceptsAudio(claimsAudio("mimo-v2.6-flash-free")),
  );
  for (const id of [
    "mimo-v2.5-free",
    "muse-spark-1.3-contributor-free",
    "nemotron-3-nano-omni-30b-a3b-reasoning-free",
  ]) {
    check(`the probed audio model ${id} is accepted`, acceptsAudio(claimsAudio(id)));
  }
  check(
    "a text-only model is never given audio",
    !acceptsAudio({ id: "mimo-v2.5-free", modalities: ["text"] }),
  );
  // Every brand that leads with audio must point at a probed upstream, or an
  // audio turn would be routed to a model that cannot hear it.
  for (const brand of ZYRAXON_BRANDS.filter((b) => b.profile.audio)) {
    check(
      `${brand.id} prefers a probed audio upstream`,
      AUDIO_VERIFIED_UPSTREAMS.has(brand.preferred),
      brand.preferred,
    );
  }
}

console.log(`\n${failures === 0 ? "ALL BRAND CHECKS PASSED" : failures + " CHECK(S) FAILED"}`);
process.exit(failures === 0 ? 0 : 1);
