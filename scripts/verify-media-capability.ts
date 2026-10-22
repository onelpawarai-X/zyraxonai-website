// Proves the measured-capability layer without touching the network: a probe
// transport is injected, so every verdict, cache rule and rotation decision can
// be asserted exactly. This is the regression guard for the audio bug — a
// hardcoded verified-set went stale and silently routed spoken turns to a
// text-only model, and these checks fail loudly if that shape returns.
//
// Run: npx tsx --import ./scripts/raw-import-loader.mjs scripts/verify-media-capability.ts
import {
  capabilityOf,
  ensureCapabilities,
  isTransientStatus,
  recordOutcome,
  registerProbeTransport,
  resetCapabilities,
  snapshot,
  supports,
  warmCapabilities,
  type ProbeTransport,
} from "../src/lib/providers/media-capability.server";
import {
  AUDIO_VERIFIED_SEED,
  VIDEO_VERIFIED_SEED,
  acceptsModality,
  rotationFor,
  getBrand,
  type PoolModel,
} from "../src/lib/providers/zyraxon-brands";

let failures = 0;
const check = (label: string, ok: boolean, detail: unknown = "") => {
  if (!ok) failures++;
  console.log(`${ok ? "PASS" : "FAIL"}  ${label}${detail !== "" ? `\n        ${detail}` : ""}`);
};

const POOL: PoolModel[] = [
  { id: "hears", modalities: ["text", "image", "audio", "video"], context: 200_000, output: 64_000 },
  { id: "sees", modalities: ["text", "image", "video"], context: 200_000, output: 64_000 },
  { id: "reads", modalities: ["text", "image"], context: 200_000, output: 64_000 },
  { id: "blind", modalities: ["text", "image", "audio", "video"], context: 200_000, output: 64_000 },
];

/** A transport that answers according to a fixed script, so a verdict is the
 *  only variable. `HEARD` / `SEEN` stand in for the probe's expected words. */
function scripted(answers: Record<string, string>): ProbeTransport {
  return async (upstream) => ({ ok: true, text: answers[upstream] ?? "NO_MEDIA" });
}

/** What each modality's prompt part looks like, so a scripted transport can
 *  tell which modality it was asked about without re-implementing the probe. */
const PART_KIND = (part: any): string =>
  part?.type === "image_url" ? "image" : part?.type === "input_audio" ? "audio" : "video";

function kindOf(messages: unknown[]): string {
  const content = (messages[0] as any).content as any[];
  return PART_KIND(content[1]);
}

/** Answer every modality per model from a table. */
function table(byModel: Record<string, Record<string, string>>): ProbeTransport {
  return async (upstream, messages) => {
    const kind = kindOf(messages);
    return { ok: true, text: byModel[upstream]?.[kind] ?? "NO_MEDIA" };
  };
}

const GOOD = {
  hears: { image: "red", audio: "Good morning and welcome", video: "blue clip" },
  sees: { image: "red", audio: "NO_MEDIA", video: "blue clip" },
  reads: { image: "red", audio: "NO_MEDIA", video: "NO_MEDIA" },
  blind: { image: "NO_MEDIA", audio: "NO_MEDIA", video: "NO_MEDIA" },
};

// ── 1. The probe measures, and the measurement is what routing uses ──────────
resetCapabilities();
registerProbeTransport(table(GOOD));
await ensureCapabilities(POOL.map((m) => m.id), { deadlineMs: 5_000 });

check("a model that transcribes audio is measured as able", supports("hears", "audio") === true);
check("a model that answers NO_MEDIA is measured as unable", supports("sees", "audio") === false);
check("a model that drops video is measured as unable", supports("reads", "video") === false);
check("a blind model is measured unable for every media kind",
  supports("blind", "image") === false && supports("blind", "audio") === false && supports("blind", "video") === false);

check("the snapshot reports the measurements", snapshot(["hears", "sees"]).size === 2);

// ── 2. An audio turn leads with a model that actually hears ─────────────────
const brand = getBrand("zyraxon-apex")!;
const audioChain = rotationFor(brand, POOL, null, new Set(["audio"]));
check("an audio turn leads with the hearing model", audioChain[0] === "hears", audioChain.join(" > "));
check("a model measured unable to hear does not lead an audio turn",
  audioChain[0] !== "sees" && audioChain[0] !== "blind");

const videoChain = rotationFor(brand, POOL, null, new Set(["video"]));
check("a video turn leads with a model that sees video", videoChain[0] === "hears", videoChain.join(" > "));

const imageChain = rotationFor(brand, POOL, null, new Set(["image"]));
check("an image turn leads with a model that sees images",
  imageChain[0] === "hears" || imageChain[0] === "sees", imageChain.join(" > "));

// A model measured unable is kept in the chain, not dropped: it can still
// answer the text half of the turn.
check("a measured-unable model is kept in the chain, behind the able ones",
  audioChain.includes("sees") && audioChain.includes("blind"), audioChain.join(" > "));

// ── 3. A transient failure is never recorded as "cannot" ────────────────────
resetCapabilities();
let calls = 0;
registerProbeTransport(async (_u, messages) => {
  calls++;
  // Always a 503: the upstream is down, which says nothing about capability.
  return { ok: false, status: 503, detail: "upstream unavailable" };
});
await ensureCapabilities(["hears"], { deadlineMs: 5_000 });
check("a 503 leaves the verdict unestablished rather than 'no'",
  supports("hears", "audio") === undefined, String(supports("hears", "audio")));
check("a transient failure is retried before giving up", calls >= 2, `calls=${calls}`);
check("isTransientStatus covers the retry-able statuses",
  isTransientStatus(429) && isTransientStatus(500) && isTransientStatus(503) && !isTransientStatus(400));

// ── 4. A definite 400 is evidence, and is recorded ──────────────────────────
resetCapabilities();
registerProbeTransport(async () => ({ ok: false, status: 400, detail: "SDK request failed" }));
await ensureCapabilities(["reads"], { deadlineMs: 5_000 });
check("a definite 400 is recorded as unable", supports("reads", "image") === false);

// ── 5. A cold start still routes audio to a known-hearing seed ──────────────
resetCapabilities();
const seedPool: PoolModel[] = [
  { id: "mimo-v2.6-flash-free", modalities: ["text", "image", "audio", "video"], context: 200_000, output: 64_000 },
  { id: "glm-5.3-flash-free", modalities: ["text", "image", "audio", "video"], context: 200_000, output: 64_000 },
  { id: "beam-free", modalities: ["text", "image", "audio", "video"], context: 200_000, output: 64_000 },
];
const coldChain = rotationFor(brand, seedPool, null, new Set(["audio"]));
check("with nothing measured, an audio turn leads with the probed seed",
  coldChain[0] === "mimo-v2.6-flash-free", coldChain.join(" > "));
check("the audio seed is not empty", AUDIO_VERIFIED_SEED.size > 0);
check("the video seed is not empty", VIDEO_VERIFIED_SEED.size > 0);

// ── 6. An unmeasured model is not assumed able for audio or video ───────────
check("an unmeasured model is not assumed able to hear",
  acceptsModality({ id: "unknown-model", modalities: ["text", "audio"] }, "audio") === false);
check("an unmeasured model is not assumed able to see video",
  acceptsModality({ id: "unknown-model", modalities: ["text", "video"] }, "video") === false);
check("an unmeasured model that declares image is taken at its word for image",
  acceptsModality({ id: "unknown-model", modalities: ["text", "image"] }, "image") === true);

// ── 7. Real traffic teaches the map ─────────────────────────────────────────
resetCapabilities();
recordOutcome("hears", "audio", true);
check("a successful audio turn is recorded as able", supports("hears", "audio") === true);
recordOutcome("sees", "audio", false, 400, "no audio attached");
check("an explicit denial is recorded as unable", supports("sees", "audio") === false);
resetCapabilities();
recordOutcome("sees", "audio", false, 503, "upstream unavailable");
check("a transient turn failure records nothing", supports("sees", "audio") === undefined);
resetCapabilities();
recordOutcome("sees", "audio", false, 400, "SDK request failed");
check("a 400 with no denial text records nothing", supports("sees", "audio") === undefined);

// ── 8. A pool change is picked up: only new ids are probed ──────────────────
resetCapabilities();
const probed: string[] = [];
registerProbeTransport(async (upstream, messages) => {
  probed.push(upstream);
  const kind = kindOf(messages);
  return { ok: true, text: GOOD[upstream as keyof typeof GOOD]?.[kind] ?? "NO_MEDIA" };
});
await ensureCapabilities(["hears", "sees"], { deadlineMs: 5_000 });
const firstRound = [...probed];
check("the first sweep probes each model", firstRound.includes("hears") && firstRound.includes("sees"));
probed.length = 0;
await ensureCapabilities(["hears", "sees"], { deadlineMs: 5_000 });
check("a second sweep of known models probes nothing", probed.length === 0, `probed=${probed.join(",")}`);

probed.length = 0;
await ensureCapabilities(["hears", "sees", "reads"], { deadlineMs: 5_000 });
check("a newly added model is the only one probed",
  probed.length > 0 && probed.every((id) => id === "reads"), `probed=${[...new Set(probed)].join(",")}`);

// ── 9. The deadline is honoured: a slow probe never blocks a turn ───────────
resetCapabilities();
registerProbeTransport(() => new Promise((r) => setTimeout(() => r({ ok: true, text: "red" }), 60_000)));
const t0 = Date.now();
await ensureCapabilities(["slow"], { deadlineMs: 150 });
const waited = Date.now() - t0;
check("ensureCapabilities returns by its deadline, not the probe's", waited < 3_000, `${waited}ms`);
check("an unmeasured model is reported as unknown, not as unable",
  supports("slow", "audio") === undefined);

// ── 10. Warming is fire-and-forget and never throws ─────────────────────────
resetCapabilities();
warmCapabilities(["hears"], scripted({ hears: "red" }));
check("warmCapabilities does not throw and starts a sweep", true);
await new Promise((r) => setTimeout(r, 200));
check("a warmed model becomes measured", capabilityOf("hears") !== null);

resetCapabilities();
console.log(failures ? `\n${failures} check(s) failed` : "\nall checks passed");
process.exit(failures ? 1 : 0);
