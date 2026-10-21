// Proves the multimodal path end to end without network access: content parts
// are normalised to the shapes the upstream accepts, a media turn is routed to a
// model that can actually see it, and a non-streaming request gets a JSON body
// rather than an SSE stream.
//
// Run: npx tsx --import ./scripts/raw-import-loader.mjs scripts/verify-media.ts
import {
  collectMedia,
  dataUrlBytes,
  DEFAULT_MEDIA_BUDGET,
  MAX_MEDIA_BODY_BYTES,
  MAX_MEDIA_PARTS,
  attachmentsBodyBytes,
  encodedBytes,
  fitBitrateKbps,
  fitsModalities,
  normaliseContent,
  normalisePart,
  partMediaKind,
  planMedia,
  requiredModalities,
  sliceWindows,
  toSdkContent,
  toWireContent,
  trimToBodyBudget,
  videoSliceCount,
  type MediaKind,
} from "../src/lib/providers/media";
import {
  ZYRAXON_BRANDS,
  bindPreferred,
  capabilityScore,
  getBrand,
  rotationFor,
  type PoolModel,
} from "../src/lib/providers/zyraxon-brands";
import { brandChatStream } from "../src/lib/providers/zyraxon-brand.server";
import { needsWire } from "../src/lib/builder/zen.server";

let failures = 0;
const check = (label: string, ok: boolean, detail: unknown = "") => {
  if (!ok) failures++;
  console.log(`${ok ? "PASS" : "FAIL"}  ${label}${detail !== "" ? `\n        ${detail}` : ""}`);
};

const IMG = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";
const AUD = "data:audio/mp3;base64,SUQzBAAAAAAAI1RTU0UAAAAPAAADTGF2ZjU4";
const VID = "data:video/mp4;base64,AAAAIGZ0eXBpc29tAAACAGlzb21pc28yYXZjMW1wNDE=";
const PDF = "data:application/pdf;base64,JVBERi0xLjQKJeLjz9MK";

// ── 1. part normalisation ───────────────────────────────────────────────────
{
  const img = normalisePart({ type: "image_url", image_url: { url: IMG } });
  check("an image part becomes a canonical media part", img?.type === "media");
  check("the image kind is preserved", (img as any)?.kind === "image");
  check("the image url is preserved", (img as any)?.url === IMG);

  const vid = normalisePart({ type: "video_url", video_url: { url: VID }, fps: 2 });
  check("a video part becomes a canonical media part", vid?.type === "media");
  check("the video kind is preserved", (vid as any)?.kind === "video");

  const aud = normalisePart({ type: "input_audio", input_audio: { data: "AAAA", format: "wav" } });
  check("an audio part becomes a canonical media part", aud?.type === "media");
  check("the audio kind is preserved", (aud as any)?.kind === "audio");
  check(
    "audio raw base64 is re-wrapped as a data URL",
    String((aud as any)?.url).startsWith("data:audio/wav;base64,AAAA"),
    (aud as any)?.url,
  );

  const pdf = normalisePart({ type: "file", file: { filename: "a.pdf", file_data: PDF } });
  check("a document part becomes a canonical media part", pdf?.type === "media");
  check("the pdf kind is preserved", (pdf as any)?.kind === "pdf");
  check("the pdf filename is carried through", (pdf as any)?.name === "a.pdf");

  // community spellings
  check("a bare `video` type is understood", (normalisePart({ type: "video", url: VID }) as any)?.kind === "video");
  check("a bare `image` type is understood", (normalisePart({ type: "image", url: IMG }) as any)?.kind === "image");
  check("an unknown part is dropped, not forwarded", normalisePart({ type: "banana" }) === null);
}

// ── 2. content normalisation ────────────────────────────────────────────────
{
  check("a plain string stays a string", normaliseContent("hello") === "hello");
  const textOnly = normaliseContent([{ type: "text", text: "a" }, { type: "text", text: "b" }]);
  check("a text-only parts array collapses to a string", textOnly === "a\nb", textOnly);
  const mixed = normaliseContent([
    { type: "text", text: "look" },
    { type: "image_url", image_url: { url: IMG } },
  ]);
  check("a mixed array stays an array", Array.isArray(mixed) && (mixed as any[]).length === 2);
  check(
    "the media part survived normalisation",
    Array.isArray(mixed) && (mixed as any[])[1].type === "media",
  );
  check(
    "the surviving media part kept its kind",
    Array.isArray(mixed) && (mixed as any[])[1].kind === "image",
  );
}

// ── 2b. SDK wire-format translation ─────────────────────────────────────────
// The AI SDK rejects the OpenAI shapes (`image_url`, `input_audio`, `video_url`)
// in a prompt, so the canonical form must be translated before it is handed over.
{
  const img = toSdkContent(normaliseContent([{ type: "image_url", image_url: { url: IMG } }]));
  check("an image becomes an SDK `image` part", Array.isArray(img) && (img as any[])[0].type === "image");
  check(
    "the image payload is raw base64, not a data URL",
    Array.isArray(img) && (img as any[])[0].image === IMG.split(",")[1],
  );
  check(
    "the image media type is carried",
    Array.isArray(img) && (img as any[])[0].mediaType === "image/png",
  );

  const aud = toSdkContent(normaliseContent([{ type: "input_audio", input_audio: { data: "AAAA", format: "wav" } }]));
  check("audio becomes an SDK `file` part", Array.isArray(aud) && (aud as any[])[0].type === "file");
  check("the audio media type is carried", Array.isArray(aud) && (aud as any[])[0].mediaType === "audio/wav");

  const pdf = toSdkContent(normaliseContent([{ type: "file", file: { filename: "a.pdf", file_data: PDF } }]));
  check("a document becomes an SDK `file` part", Array.isArray(pdf) && (pdf as any[])[0].type === "file");
  check("the pdf media type is carried", Array.isArray(pdf) && (pdf as any[])[0].mediaType === "application/pdf");

  check("text passes through translation unchanged", toSdkContent("hello") === "hello");
  const txt = toSdkContent(normaliseContent([{ type: "text", text: "hi" }, { type: "image_url", image_url: { url: IMG } }]));
  check("a mixed turn keeps text and media in order", Array.isArray(txt) && (txt as any[]).length === 2);
  check(
    "no OpenAI wire shape survives translation",
    !JSON.stringify(txt).includes("image_url"),
    JSON.stringify(txt).slice(0, 120),
  );
}

// ── 3. modality requirement detection ───────────────────────────────────────
{
  const need = requiredModalities([
    { content: "plain text" },
    { content: [{ type: "text", text: "see" }, { type: "video_url", video_url: { url: VID } }] },
    { content: [{ type: "input_audio", input_audio: { data: "AA", format: "mp3" } }] },
  ]);
  check("video is detected as required", need.has("video"));
  check("audio is detected as required", need.has("audio"));
  check("image is not falsely required", !need.has("image"));

  check("a text-only turn fits a text-only model", fitsModalities(new Set(), ["text"]));
  check("a video turn does not fit a text-only model", !fitsModalities(new Set(["video"]), ["text"]));
  check(
    "a video turn fits a video model",
    fitsModalities(new Set(["video"]), ["text", "image", "video"]),
  );
  check(
    "an audio turn needs an audio model, not just video",
    !fitsModalities(new Set(["audio"]), ["text", "video"]),
  );
}

// ── 4. large-media planning ─────────────────────────────────────────────────
{
  const small = planMedia(1024);
  check("a small file is sent inline", small.inline && small.parts === 1);

  const big = planMedia(500 * 1024 * 1024);
  check("a 500 MB file is not sent inline", !big.inline);
  check("and it is sliced into several parts", big.parts > 1, big.parts);
  check("and it is compressed first", big.compress);

  const huge = planMedia(1024 * 1024 * 1024);
  check("the part count is capped so a turn stays sane", huge.parts <= 24 && big.parts <= 24, `${huge.parts}, ${big.parts}`);
  check("a huge file still compresses", huge.compress);

  const remote = planMedia(null);
  check("a remote url is left alone (size unknown)", remote.inline);

  check("slices cover the whole duration", (() => {
    const w = sliceWindows(600, 5);
    const total = w.reduce((n, s) => n + s.duration, 0);
    return Math.abs(total - 600) < 0.01 && w.length === 5;
  })());
  check("a long video yields more slices", videoSliceCount(3600, 1024 * 1024 * 1024) > videoSliceCount(60, 1024 * 1024));
  check("a tiny video is one slice", videoSliceCount(30, 1024) === 1);
}

// ── 4b. the size invariants that make a large upload actually sendable ──────
{
  // The whole pipeline has to agree on one ceiling. These checks fail the moment
  // someone raises a part cap in one place and not another, which is exactly how
  // a correctly sliced video ended up truncated or refused with a 413.
  const encodedAll = encodedBytes(MAX_MEDIA_PARTS * DEFAULT_MEDIA_BUDGET.partTarget);
  check(
    "a full set of parts fits the request body cap",
    encodedAll <= MAX_MEDIA_BODY_BYTES,
    `${encodedAll} vs ${MAX_MEDIA_BODY_BYTES}`,
  );
  check(
    "the planner's part cap is the shared one",
    DEFAULT_MEDIA_BUDGET.maxParts === MAX_MEDIA_PARTS,
  );

  // Sizing to the duration is what makes a long-but-sendable recording fit.
  // One hour at the 50 kbps floor is ~35 MB, inside the cap.
  const oneHour = fitBitrateKbps(MAX_MEDIA_PARTS * DEFAULT_MEDIA_BUDGET.partTarget, 3600, 32);
  const oneHourBytes = ((oneHour + 32) * 1000 * 3600) / 8;
  check("an hour-long video is sized to fit the budget", oneHourBytes <= MAX_MEDIA_BODY_BYTES, `${oneHour} kbps -> ${Math.round(oneHourBytes / 1024 / 1024)} MB`);

  // Past that, the bitrate floor is reached and no rate fits the cap: two hours
  // needs at least ~45 MB. The helper must still return a usable rate rather
  // than a negative or zero one, and the trim below is what handles the excess.
  const twoHours = fitBitrateKbps(MAX_MEDIA_PARTS * DEFAULT_MEDIA_BUDGET.partTarget, 7200, 32);
  check("a two-hour video is floored at a usable rate, not zero", twoHours === 50, twoHours);

  const short = fitBitrateKbps(MAX_MEDIA_PARTS * DEFAULT_MEDIA_BUDGET.partTarget, 30, 96);
  check("a short clip is not starved", short >= 300, short);
  check("an unknown duration falls back, not to zero", fitBitrateKbps(1024, 0) === 700);

  // The encoded body of a set of attachments is what the cap measures.
  const parts = Array.from({ length: 3 }, () => ({ data: "data:video/mp4;base64," + "A".repeat(1000) }));
  check("body bytes count the payload, not the prefix", attachmentsBodyBytes(parts) === 3000, attachmentsBodyBytes(parts));

  // A recording long enough to defeat the bitrate floor still has to produce a
  // sendable request. The trim sends the leading parts and reports the rest.
  const many = Array.from({ length: 30 }, () => ({
    data: "data:video/mp4;base64," + "A".repeat(3 * 1024 * 1024),
  }));
  const trimmed = trimToBodyBudget(many);
  check("an over-long recording is trimmed to the part cap", trimmed.kept.length === MAX_MEDIA_PARTS, trimmed.kept.length);
  check("the dropped parts are reported, not hidden", trimmed.dropped === 30 - MAX_MEDIA_PARTS, trimmed.dropped);
  check("what is kept fits the body cap", attachmentsBodyBytes(trimmed.kept) <= MAX_MEDIA_BODY_BYTES);

  const overBytes = Array.from({ length: MAX_MEDIA_PARTS }, () => ({
    data: "data:video/mp4;base64," + "A".repeat(5 * 1024 * 1024),
  }));
  const byBytes = trimToBodyBudget(overBytes);
  check("a set that is over on bytes is trimmed further", attachmentsBodyBytes(byBytes.kept) <= MAX_MEDIA_BODY_BYTES, byBytes.kept.length);
  check("and at least one part always survives", byBytes.kept.length >= 1);
}

// ── 5. capability-aware binding ─────────────────────────────────────────────
{
  const pool: PoolModel[] = [
    { id: "text-only", modalities: ["text"], context: 200_000, output: 32_000, reasoning: true },
    { id: "vision", modalities: ["text", "image"], context: 1_000_000, output: 131_072, reasoning: true },
    { id: "omni", modalities: ["text", "image", "audio", "video"], context: 1_000_000, output: 131_072, reasoning: true },
  ];

  const cyber = getBrand("zyraxon-cyber")!; // prefers mimo-v2.5-free (absent)
  // Capability only decides between models when the turn needs the capability,
  // so the media need is passed in. With no need every model is equally
  // "capable" and speed alone decides — that is the fix, not a gap.
  const mediaNeed = new Set<MediaKind>(["image", "video", "audio"]);
  check(
    "a vision brand scores the omni model above text-only",
    capabilityScore(cyber, pool[2], mediaNeed) > capabilityScore(cyber, pool[0], mediaNeed),
  );
  check(
    "an absent preference binds to a capability-compatible model",
    bindPreferred(cyber, pool, null, mediaNeed) === "omni",
    bindPreferred(cyber, pool, null, mediaNeed),
  );

  // The preferred model wins when it is actually served. Use the brand's real
  // `preferred` id, not a remembered one: a hardcoded id drifts the moment the
  // upstream pool swaps a model out, and the check then fails for a reason that
  // has nothing to do with the binding rule.
  const withPreferred: PoolModel[] = [
    ...pool,
    {
      id: cyber.preferred,
      modalities: ["text", "image", "audio", "video"],
      context: 200_000,
    },
  ];
  check(
    "a served preference is used as-is",
    bindPreferred(cyber, withPreferred, null) === cyber.preferred,
    `preferred=${cyber.preferred} bound=${bindPreferred(cyber, withPreferred, null)}`,
  );
  // And it must really be served — a preference that is not in the pool is not
  // "served", so this cannot pass by accident.
  check(
    "and the preference is genuinely present in the pool",
    withPreferred.some((m) => m.id === cyber.preferred),
  );

  // Rotation keeps capable models near the front for a video brand — but only
  // when the turn actually carries video. A text turn to the same brand must not
  // be pinned to the one video model in the pool.
  const visionary = getBrand("zyraxon-visionary")!;
  const servedPool: PoolModel[] = [
    ...pool,
    { id: visionary.preferred, modalities: ["text", "image", "video", "pdf"], context: 200_000 },
  ];
  const videoChain = rotationFor(visionary, servedPool, null, new Set<MediaKind>(["video"]));
  check(
    "rotation leads with the preference when it is served",
    videoChain[0] === visionary.preferred,
    videoChain.join(" → "),
  );
  check(
    "a video brand's video turn puts video models first",
    videoChain.indexOf("omni") < videoChain.indexOf("text-only"),
    videoChain.join(" → "),
  );
  // Regression: a brand that *supports* a rare modality must not be pinned to
  // the one model that serves it on turns that do not carry it. Before this, the
  // pdf bonus alone put the single pdf-capable model ahead of a model that was
  // equally capable and ten times faster, so an ordinary question to an
  // every-modality brand landed on the slowest model in the pool.
  const genesis = getBrand("zyraxon-genesis")!; // profile includes pdf; preference absent here
  const rarePool: PoolModel[] = [
    { id: "minimax-m3.1-flash-free", modalities: ["text"], context: 200_000, output: 32_000, reasoning: true },
    { id: "glm-5.3-flash-free", modalities: ["text", "pdf"], context: 200_000, output: 32_000, reasoning: true },
  ];
  check(
    "a text turn does not chase a brand's rare-modality model",
    bindPreferred(genesis, rarePool, null) === "minimax-m3.1-flash-free",
    String(bindPreferred(genesis, rarePool, null)),
  );
  // The same pool on a turn that *does* carry a document: now the pdf-capable
  // model is the better answer, so the preference flips.
  check(
    "a document turn does prefer a model that takes the document",
    bindPreferred(genesis, rarePool, null, new Set<MediaKind>(["pdf"])) === "glm-5.3-flash-free",
    String(bindPreferred(genesis, rarePool, null, new Set<MediaKind>(["pdf"]))),
  );

  check("every brand carries a profile", ZYRAXON_BRANDS.every((b) => !!b.profile));
  check("exactly ten brands remain", ZYRAXON_BRANDS.length === 10);
}

// ── 6. media turn routes to a capable model, and labels the brand ───────────
{
  const seen: Array<{ upstream: string; label: string; modalities: string }> = [];
  const send = (async (_k: any, upstream: string, msgs: any[], _t: any, label: string) => {
    seen.push({ upstream, label, modalities: JSON.stringify(msgs.at(-1)?.content) });
    return new Response("streamed:" + label, { headers: { "X-ZYRAXON-Model": label } });
  }) as any;

  const pool: PoolModel[] = [
    { id: "text-only", modalities: ["text"], context: 200_000 },
    { id: "vision", modalities: ["text", "image"], context: 1_000_000 },
  ];
  const resolve = (async (id: string, need: Set<string>) => {
    if (id !== "zyraxon-matrix") return null;
    const ordered = need.size
      ? ["vision", "text-only"]
      : ["text-only", "vision"];
    return { brand: getBrand("zyraxon-matrix")!, chain: ordered };
  }) as any;

  const res = await brandChatStream(
    "zyraxon-matrix",
    [{ role: "user", content: [{ type: "text", text: "what is this" }, { type: "image_url", image_url: { url: IMG } }] }],
    undefined,
    { send, resolve },
  );
  check("a media turn is answered", res.status === 200, res.status);
  check("the vision model is tried first for an image turn", seen[0]?.upstream === "vision", seen[0]?.upstream);
  check("the caller still sees the brand label", seen[0]?.label === "ZYRAXON Matrix", seen[0]?.label);
  check(
    "the upstream receives a real image part, not a string",
    /"type":"image"/.test(seen[0]?.modalities || "") &&
      !/"type":"image_url"/.test(seen[0]?.modalities || ""),
    seen[0]?.modalities,
  );
  check(
    "the response advertises the input modality used",
    res.headers.get("X-ZYRAXON-Input-Modalities") === "image",
    res.headers.get("X-ZYRAXON-Input-Modalities"),
  );
}

// ── 7. non-streaming request returns a JSON completion ──────────────────────
{
  let completed = false;
  const complete = (async (_k: any, _u: string, _m: any[], _t: any, label: string) => {
    completed = true;
    return Response.json(
      {
        object: "chat.completion",
        model: label,
        choices: [{ index: 0, message: { role: "assistant", content: "hi" }, finish_reason: "stop" }],
      },
      { headers: { "X-ZYRAXON-Model": label } },
    );
  }) as any;
  const send = (async () => {
    throw new Error("the streaming transport must not be used when stream=false");
  }) as any;
  const resolve = (async (id: string) =>
    id === "zyraxon-neural"
      ? { brand: getBrand("zyraxon-neural")!, chain: ["big-pickle"] }
      : null) as any;

  const res = await brandChatStream(
    "zyraxon-neural",
    [{ role: "user", content: "hi" }],
    undefined,
    { stream: false, complete, send, resolve },
  );
  check("a non-streaming turn uses the completion transport", completed);
  check("and answers 200 with a JSON body", res.status === 200, res.status);
  check(
    "the body is a chat.completion object",
    (await res.clone().json()).object === "chat.completion",
  );
}
// The wire-path predicate decides whether a turn bypasses the SDK. Getting it
// wrong sends an audio/video part through a schema that silently drops it, so
// the boundary is pinned here.
{
  check("a text turn stays on the SDK path", needsWire([{ content: "hello" }]) === false);
  check(
    "an image part stays on the SDK path",
    needsWire([{ content: [{ type: "image", image: "data:image/png;base64,AA" }] }]) === false,
  );
  check(
    "an input_audio part takes the wire path",
    needsWire([{ content: [{ type: "input_audio", input_audio: { data: "AA", format: "wav" } }] }]) === true,
  );
  check(
    "a video_url part takes the wire path",
    needsWire([{ content: [{ type: "video_url", video_url: { url: "https://x/y.mp4" } }] }]) === true,
  );
  check(
    "an audio file part takes the wire path",
    needsWire([{ content: [{ type: "file", file: { mime_type: "audio/mpeg" } }] }]) === true,
  );
  check(
    "a video file part takes the wire path",
    needsWire([{ content: [{ type: "file", mime_type: "video/mp4" }] }]) === true,
  );
  check(
    "a pdf file part stays on the SDK path",
    needsWire([{ content: [{ type: "file", file: { mime_type: "application/pdf" } }] }]) === false,
  );

  // The public route normalises inbound parts before the provider sees them, so
  // routing must understand the canonical `{ type: "media", kind }` shape too.
  // Reading only the raw OpenAI spellings silently dropped every audio/video
  // turn into a text-only answer.
  check(
    "a canonical audio part takes the wire path",
    needsWire([{ content: [{ type: "media", kind: "audio", url: "data:audio/wav;base64,AAAA" }] }]) === true,
  );
  check(
    "a canonical video part takes the wire path",
    needsWire([{ content: [{ type: "media", kind: "video", url: "data:video/mp4;base64,AAAA" }] }]) === true,
  );
  check(
    "a canonical image part stays on the SDK path",
    needsWire([{ content: [{ type: "media", kind: "image", url: "data:image/png;base64,AAAA" }] }]) === false,
  );
  check(
    "partMediaKind reads a canonical media part",
    partMediaKind({ type: "media", kind: "audio", url: "data:audio/wav;base64,AAAA" }) === "audio" &&
      partMediaKind({ type: "media", kind: "video", url: "x" }) === "video",
  );
  check(
    "requiredModalities sees canonical audio+video",
    (() => {
      const need = requiredModalities([
        {
          content: [
            { type: "media", kind: "audio", url: "data:audio/wav;base64,AAAA" },
            { type: "media", kind: "video", url: "data:video/mp4;base64,AAAA" },
          ],
        },
      ]);
      return need.has("audio") && need.has("video") && need.size === 2;
    })(),
  );
  check(
    "a canonical media part survives a normalise→wire round trip",
    (() => {
      const canonical = normaliseContent([
        { type: "text", text: "hi" },
        { type: "video_url", video_url: { url: "data:video/mp4;base64,AAAA" } },
      ]);
      if (typeof canonical === "string") return false;
      const wire = toWireContent(canonical);
      if (typeof wire === "string") return false;
      return wire.some((p: any) => p.type === "video_url" && p.video_url.url.endsWith("AAAA"));
    })(),
  );
}


console.log(`\n${failures === 0 ? "ALL MEDIA CHECKS PASSED" : failures + " CHECK(S) FAILED"}`);
process.exit(failures === 0 ? 0 : 1);
