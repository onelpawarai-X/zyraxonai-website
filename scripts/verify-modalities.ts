// Proves the two halves of the "every model takes every modality" promise:
//
//  1. The published catalogue advertises the full media intake on every brand,
//     while the routing truth stays visible as `routed_modalities`. A caller
//     picks a brand by name; the line routes the turn to a model measured able
//     to take it, so the catalogue must not push that choice onto the caller.
//
//  2. A caller may point at media with an http(s) URL instead of embedding it.
//     The server fetches it and inlines it, so routing and the upstream payload
//     see an ordinary inline turn. A URL that cannot be read fails the turn
//     rather than silently dropping the media.
//
// Run: npx tsx --import ./scripts/raw-import-loader.mjs scripts/verify-modalities.ts
import {
  ADVERTISED_INPUT_MODALITIES,
  ZYRAXON_BRANDS,
  brandView,
  getBrand,
  rotationFor,
  type CapabilityOracle,
  type PoolModel,
} from "../src/lib/providers/zyraxon-brands";
import { inlineRemoteMedia } from "../src/lib/providers/remote-media.server";
import { normaliseContent, requiredModalities, toWireContent } from "../src/lib/providers/media";

let failures = 0;
const check = (label: string, ok: boolean, detail: unknown = "") => {
  if (!ok) failures++;
  console.log(`${ok ? "PASS" : "FAIL"}  ${label}${detail !== "" ? `\n        ${detail}` : ""}`);
};

const EXPECTED = ["text", "image", "audio", "video", "pdf"];
const IMG = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";
const AUD = "data:audio/mp3;base64,SUQzBAAAAAAAI1RTU0UAAAAPAAADTGF2ZjU4";

const POOL: PoolModel[] = [
  { id: "beam-free", modalities: ["text"], context: 262_144, output: 131_072, reasoning: true },
  { id: "glm-5.3-flash-free", modalities: ["text", "image", "video"], context: 200_000, output: 32_000, reasoning: true },
  { id: "nemotron-3.5-super-vl-free", modalities: ["text", "image"], context: 1_000_000, output: 32_000, reasoning: true },
];

// ── 1. the published catalogue advertises every modality on every brand ─────
{
  check(
    "the advertised modality set is exactly the five we serve",
    [...ADVERTISED_INPUT_MODALITIES].join(",") === EXPECTED.join(","),
    ADVERTISED_INPUT_MODALITIES.join(","),
  );
  for (const brand of ZYRAXON_BRANDS) {
    const view = brandView(brand, POOL, null);
    check(
      `${brand.id} advertises text, image, audio, video and pdf`,
      EXPECTED.every((m) => view.modalities.includes(m)) && view.modalities.length === EXPECTED.length,
      view.modalities.join(","),
    );
    check(
      `${brand.id} is marked multimodal`,
      view.multimodal === true,
    );
  }
  // The routing truth is still published, and still reflects the bound model —
  // the catalogue widening must not have erased the operational view.
  {
    const view = brandView(getBrand("zyraxon-pulse")!, POOL, null);
    check(
      "routed_modalities still reports what the bound upstream accepts",
      view.routed_modalities.includes("text"),
      view.routed_modalities.join(","),
    );
  }
}

// ── 2. routing still sends a turn only to a model that can take it ──────────
{
  // A text-only turn leads with a text-only model when one is equally able.
  const pulse = getBrand("zyraxon-pulse")!; // speed profile, no modality profile
  const textChain = rotationFor(pulse, POOL, null, new Set());
  check(
    "a text-only turn leads with a text-only model",
    textChain[0] === "beam-free",
    textChain.join(" → "),
  );

  // An image turn must not lead with the text-only model.
  const oracle: CapabilityOracle = (id, m) =>
    m === "image" ? id !== "beam-free" : undefined;
  const imageChain = rotationFor(pulse, POOL, null, new Set(["image"]), oracle);
  check(
    "an image turn leads with a model measured able to see",
    imageChain[0] !== "beam-free" && oracle(imageChain[0], "image") === true,
    imageChain.join(" → "),
  );
}

// ── 3. a remote URL is fetched and inlined, and survives the wire transform ──
{
  const served: Record<string, { body: Uint8Array; type: string }> = {
    "https://cdn.example.com/talk.mp3": { body: new TextEncoder().encode("ID3-fake-mp3-bytes"), type: "audio/mpeg" },
    "https://cdn.example.com/pic.png": { body: new TextEncoder().encode("\x89PNG-fake"), type: "image/png" },
  };
  const realFetch = globalThis.fetch;
  globalThis.fetch = (async (input: any) => {
    const url = String(input);
    const hit = served[url];
    if (!hit) return new Response("not found", { status: 404 });
    return new Response(hit.body, { status: 200, headers: { "content-type": hit.type } });
  }) as typeof fetch;

  try {
    const messages = [
      {
        role: "user",
        content: [
          { type: "text", text: "Transcribe this and describe the image." },
          { type: "input_audio", input_audio: { url: "https://cdn.example.com/talk.mp3" } },
          { type: "image_url", image_url: { url: "https://cdn.example.com/pic.png" } },
        ],
      },
    ];
    const { messages: out, stats } = await inlineRemoteMedia(messages as any);
    check("both remote references are fetched", stats.fetched === 2, JSON.stringify(stats));
    check("no fetch failures", stats.failures.length === 0, JSON.stringify(stats.failures));
    const audio = (out[0] as any).content[1].input_audio.url;
    const image = (out[0] as any).content[2].image_url.url;
    check("the audio URL became a data URL", /^data:audio\/mpeg;base64,/.test(audio), audio.slice(0, 40));
    check("the image URL became a data URL", /^data:image\/png;base64,/.test(image), image.slice(0, 40));

    // The caller's own array is untouched.
    check(
      "the caller's messages are not mutated",
      (messages[0].content[1] as any).input_audio.url === "https://cdn.example.com/talk.mp3",
    );

    // Routing sees audio + image from the inlined turn, and the wire transform
    // emits a real `input_audio` part with the fetched bytes, not the URL.
    const need = requiredModalities(out.map((m: any) => ({ content: m.content })));
    check("routing sees both audio and image", need.has("audio") && need.has("image"), Array.from(need).join(","));
    const canonical = out.map((m: any) => normaliseContent(m.content));
    const wire = toWireContent(canonical[0] as any);
    const audioPart = (wire as any[]).find((p) => p.type === "input_audio");
    check(
      "the wire part carries the fetched base64, not the URL",
      !!audioPart && audioPart.input_audio.data.length > 0 && !/https?:/.test(audioPart.input_audio.data),
      JSON.stringify(audioPart).slice(0, 80),
    );
  } finally {
    globalThis.fetch = realFetch;
  }
}

// ── 4. an unreadable URL fails the turn instead of dropping the media ───────
{
  const realFetch = globalThis.fetch;
  globalThis.fetch = (async () => new Response("nope", { status: 404 })) as typeof fetch;
  try {
    const { stats } = await inlineRemoteMedia([
      { role: "user", content: [{ type: "image_url", image_url: { url: "https://cdn.example.com/gone.png" } }] },
    ] as any);
    check("a 404 is reported as a failure", stats.failures.length === 1, JSON.stringify(stats.failures));
    check("the reason names the status", /404/.test(stats.failures[0]?.reason || ""), stats.failures[0]?.reason);
  } finally {
    globalThis.fetch = realFetch;
  }
}

// ── 5. a turn with no remote reference costs nothing and is unchanged ───────
{
  const realFetch = globalThis.fetch;
  let called = 0;
  globalThis.fetch = (async () => {
    called++;
    return new Response("x", { status: 200 });
  }) as typeof fetch;
  try {
    const messages = [
      { role: "user", content: [{ type: "image_url", image_url: { url: IMG } }] },
      { role: "user", content: "plain text" },
    ];
    const { messages: out, stats } = await inlineRemoteMedia(messages as any);
    check("an inline-only turn performs no fetch", called === 0, String(called));
    check("an inline-only turn reports no stats", stats.fetched === 0 && stats.bytes === 0);
    check("an inline-only turn is returned as the same array", out === messages);
  } finally {
    globalThis.fetch = realFetch;
  }
}

// ── 6. a plain base64 audio part is not mistaken for a remote reference ─────
{
  const realFetch = globalThis.fetch;
  let called = 0;
  globalThis.fetch = (async () => {
    called++;
    return new Response("x", { status: 200 });
  }) as typeof fetch;
  try {
    const { stats } = await inlineRemoteMedia([
      { role: "user", content: [{ type: "input_audio", input_audio: { data: "SUQzBAAA", format: "mp3" } }] },
    ] as any);
    check("bare base64 audio triggers no fetch", called === 0, String(called));
    check("bare base64 audio reports no failure", stats.failures.length === 0);
  } finally {
    globalThis.fetch = realFetch;
  }
}

// A data URL already inlined by the caller is likewise never fetched.
{
  const realFetch = globalThis.fetch;
  let called = 0;
  globalThis.fetch = (async () => {
    called++;
    return new Response("x", { status: 200 });
  }) as typeof fetch;
  try {
    await inlineRemoteMedia([
      { role: "user", content: [{ type: "input_audio", input_audio: { url: AUD } }] },
    ] as any);
    check("an audio data URL triggers no fetch", called === 0, String(called));
  } finally {
    globalThis.fetch = realFetch;
  }
}

// ── 7. the fetch identifies itself, refuses an HTML page, and retries a 403 ──
{
  const realFetch = globalThis.fetch;
  const seen: Array<{ url: string; ua: string; accept: string }> = [];
  globalThis.fetch = (async (input: any, init: any) => {
    const headers = (init?.headers || {}) as Record<string, string>;
    seen.push({ url: String(input), ua: String(headers["user-agent"] || ""), accept: String(headers.accept || "") });
    return new Response(new TextEncoder().encode("ID3-fake"), {
      status: 200,
      headers: { "content-type": "audio/mpeg" },
    });
  }) as typeof fetch;
  try {
    const { stats } = await inlineRemoteMedia([
      { role: "user", content: [{ type: "input_audio", input_audio: { url: "https://cdn.example.com/a.mp3" } }] },
    ] as any);
    check("the fetch succeeds", stats.fetched === 1 && stats.failures.length === 0, JSON.stringify(stats));
    check(
      "the request identifies itself with a user-agent",
      seen[0]?.ua.length > 0 && /ZYRAXON/.test(seen[0]?.ua || ""),
      seen[0]?.ua,
    );
    check(
      "the request asks for the media kind it expects",
      /audio\//.test(seen[0]?.accept || ""),
      seen[0]?.accept,
    );
  } finally {
    globalThis.fetch = realFetch;
  }
}

// A host that answers with an HTML page is a failure, not a media file: sending
// the model a login page as if it were audio is the silent failure to avoid.
{
  const realFetch = globalThis.fetch;
  globalThis.fetch = (async () =>
    new Response("<html><body>sign in</body></html>", {
      status: 200,
      headers: { "content-type": "text/html; charset=utf-8" },
    })) as typeof fetch;
  try {
    const { stats } = await inlineRemoteMedia([
      { role: "user", content: [{ type: "image_url", image_url: { url: "https://cdn.example.com/login" } }] },
    ] as any);
    check("an HTML page is reported as a failure", stats.failures.length === 1, JSON.stringify(stats.failures));
    check(
      "the reason says it was not media",
      /HTML/i.test(stats.failures[0]?.reason || ""),
      stats.failures[0]?.reason,
    );
  } finally {
    globalThis.fetch = realFetch;
  }
}

// A 403 to an unidentified client is retried once under a browser-shaped
// request, because a CDN that rejects an unknown client often serves the same
// public bytes to a browser.
{
  const realFetch = globalThis.fetch;
  let calls = 0;
  globalThis.fetch = (async () => {
    calls++;
    if (calls === 1) return new Response("forbidden", { status: 403 });
    return new Response(new TextEncoder().encode("\x89PNG-fake"), {
      status: 200,
      headers: { "content-type": "image/png" },
    });
  }) as typeof fetch;
  try {
    const { messages, stats } = await inlineRemoteMedia([
      { role: "user", content: [{ type: "image_url", image_url: { url: "https://cdn.example.com/pic.png" } }] },
    ] as any);
    check("a 403 is retried once", calls === 2, String(calls));
    check("the retry recovers the media", stats.fetched === 1, JSON.stringify(stats));
    check(
      "the recovered media is inlined",
      /^data:image\/png;base64,/.test((messages[0] as any).content[0].image_url.url),
      String((messages[0] as any).content[0].image_url.url).slice(0, 30),
    );
  } finally {
    globalThis.fetch = realFetch;
  }
}

// A host that rejects both attempts is still a clean, loud failure.
{
  const realFetch = globalThis.fetch;
  globalThis.fetch = (async () => new Response("forbidden", { status: 403 })) as typeof fetch;
  try {
    const { stats } = await inlineRemoteMedia([
      { role: "user", content: [{ type: "image_url", image_url: { url: "https://cdn.example.com/private.png" } }] },
    ] as any);
    check("a doubly-rejected URL fails the turn", stats.failures.length === 1, JSON.stringify(stats.failures));
    check(
      "the reason names the status",
      /403/.test(stats.failures[0]?.reason || ""),
      stats.failures[0]?.reason,
    );
  } finally {
    globalThis.fetch = realFetch;
  }
}

console.log(`\n${failures === 0 ? "ALL MODALITY CHECKS PASSED" : failures + " CHECK(S) FAILED"}`);
process.exit(failures === 0 ? 0 : 1);
