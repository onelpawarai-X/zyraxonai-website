/** Remote media intake for the ZYRAXON provider.
 *
 *  A caller may point at media instead of embedding it: `image_url.url`,
 *  `video_url.url`, `audio_url.url`, `input_audio.url` and `file.file_data` all
 *  accept an http(s) URL. Most upstream models cannot fetch one — the OpenAI
 *  `input_audio` part has no URL form at all — and a model handed a URL it
 *  cannot reach answers as though no media were sent, which is the silent
 *  failure this provider exists to prevent. So a remote reference is resolved
 *  here, once, before routing: the bytes are fetched and re-encoded as a data
 *  URL, and from that point the turn is indistinguishable from one that arrived
 *  inline.
 *
 *  Bounds are enforced while reading, not after. A caller-supplied URL is a
 *  memory-exhaustion surface, so the response is streamed under a byte ceiling,
 *  a wall-clock deadline, and a cap on how many are fetched at once. A URL that
 *  cannot be read is reported to the caller rather than quietly dropped: a turn
 *  answered without the media it carried is worse than a turn that fails. */

import type { MediaKind } from "./media";

/** Wall-clock ceiling for one fetch. A media host that accepts the connection
 *  and then stalls must not hold a lane open indefinitely. */
const FETCH_TIMEOUT_MS = 20_000;
/** Largest single remote object we will inline. Past this the caller is told to
 *  compress and slice, which is the same advice the inline budget gives. */
const MAX_REMOTE_BYTES = 25 * 1024 * 1024;
/** Ceiling on the total inlined per turn, so several large URLs cannot add up
 *  to an unbounded body. */
const MAX_TOTAL_BYTES = 32 * 1024 * 1024;
/** How many remote objects are read at once. Bounded so a turn carrying ten
 *  URLs does not open ten sockets against one host. */
const MAX_CONCURRENT = 4;

export type RemoteMediaFailure = { url: string; reason: string };
export type InlineStats = {
  /** Remote references replaced with inline data URLs. */
  fetched: number;
  /** Bytes read across every fetch. */
  bytes: number;
  /** References left as-is because they could not be read. */
  failures: RemoteMediaFailure[];
};

/** One remote reference: the object that holds it, the property to rewrite, and
 *  what kind of media it is (so the right data-URL mime can be chosen). */
type Slot = { holder: Record<string, unknown>; key: string; url: string; kind: MediaKind };

const EXT_MIME: Record<string, MediaKind> = {
  png: "image",
  jpg: "image",
  jpeg: "image",
  gif: "image",
  webp: "image",
  bmp: "image",
  heic: "image",
  svg: "image",
  mp3: "audio",
  wav: "audio",
  m4a: "audio",
  aac: "audio",
  ogg: "audio",
  opus: "audio",
  flac: "audio",
  webm: "audio",
  mp4: "video",
  mov: "video",
  mkv: "video",
  avi: "video",
  m4v: "video",
  pdf: "pdf",
};

const DEFAULT_MIME: Record<MediaKind, string> = {
  image: "image/png",
  audio: "audio/mpeg",
  video: "video/mp4",
  pdf: "application/pdf",
};

/** A URL we are willing to fetch. Only http(s): a `data:` URL is already inline
 *  and a `file:`/`blob:` reference is meaningless to the server. */
function isRemote(url: unknown): url is string {
  return typeof url === "string" && /^https?:\/\//i.test(url);
}

function kindFor(url: string, declared?: MediaKind): MediaKind {
  if (declared) return declared;
  const ext = (/\.([a-z0-9]{1,5})(?:[?#]|$)/i.exec(url)?.[1] || "").toLowerCase();
  return EXT_MIME[ext] || "image";
}

/** Pull the string URL out of a part field that may be either a bare string or
 *  the OpenAI `{ url }` envelope. */
function urlField(value: unknown): string | null {
  if (typeof value === "string") return value;
  if (value && typeof value === "object" && typeof (value as any).url === "string") {
    return (value as any).url;
  }
  return null;
}

/** Every remote reference inside one content part, with the property that must
 *  be rewritten. Handles both the raw OpenAI spellings and the canonical
 *  `media` part this provider also accepts. */
function slotsInPart(part: any): Slot[] {
  if (!part || typeof part !== "object") return [];
  const type = String(part.type || "").toLowerCase();
  const out: Slot[] = [];
  const push = (holder: any, key: string, url: unknown, declared?: MediaKind) => {
    if (isRemote(url)) out.push({ holder, key, url, kind: kindFor(url, declared) });
  };

  if (type === "image_url") {
    if (typeof part.image_url === "string") push(part, "image_url", part.image_url, "image");
    else if (part.image_url) push(part.image_url, "url", part.image_url.url, "image");
  } else if (type === "video_url") {
    if (typeof part.video_url === "string") push(part, "video_url", part.video_url, "video");
    else if (part.video_url) push(part.video_url, "url", part.video_url.url, "video");
  } else if (type === "input_audio") {
    // `input_audio` is base64-only in the spec; a caller who puts a URL in
    // `data` or in an `audio_url`/`url` sub-field means "go and get this". The
    // rewrite target is `input_audio.url`, which `urlOfPart` reads.
    if (part.input_audio && typeof part.input_audio === "object") {
      push(part.input_audio, "url", urlField(part.input_audio.url) || urlField(part.input_audio.data), "audio");
    }
    push(part, "url", part.url, "audio");
    if (part.audio_url) push(part.audio_url, "url", part.audio_url.url, "audio");
  } else if (type === "audio_url") {
    if (typeof part.audio_url === "string") push(part, "audio_url", part.audio_url, "audio");
    else if (part.audio_url) push(part.audio_url, "url", part.audio_url.url, "audio");
  } else if (type === "file") {
    const f = part.file;
    if (f && typeof f === "object") {
      push(f, "file_data", f.file_data, (/\.pdf(?:[?#]|$)/i.test(String(f.filename || "")) ? "pdf" : undefined));
    }
  } else if (type === "media") {
    push(part, "url", part.url, undefined);
  } else {
    // Bare `{ image }` / `{ video }` / `{ audio }` spellings, plus a plain
    // `url` on an otherwise untyped part.
    push(part, "image", part.image, "image");
    push(part, "video", part.video, "video");
    push(part, "audio", part.audio, "audio");
    push(part, "url", part.url, undefined);
  }
  return out;
}

/** Every remote reference in the whole message list. */
function collectSlots(messages: any[]): Slot[] {
  const slots: Slot[] = [];
  for (const m of messages) {
    if (!m || !Array.isArray(m.content)) continue;
    for (const part of m.content) slots.push(...slotsInPart(part));
  }
  return slots;
}

const B64 = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";

/** Base64 of a byte buffer, written by hand so this works identically in the
 *  worker and under a test runner without `Buffer` or `btoa`. */
function toBase64(bytes: Uint8Array): string {
  let out = "";
  const len = bytes.length;
  for (let i = 0; i < len; i += 3) {
    const b0 = bytes[i];
    const b1 = i + 1 < len ? bytes[i + 1] : 0;
    const b2 = i + 2 < len ? bytes[i + 2] : 0;
    out += B64[b0 >> 2];
    out += B64[((b0 & 3) << 4) | (b1 >> 4)];
    out += i + 1 < len ? B64[((b1 & 15) << 2) | (b2 >> 6)] : "=";
    out += i + 2 < len ? B64[b2 & 63] : "=";
  }
  return out;
}

/** Read a response body under a byte ceiling, aborting as soon as it is passed
 *  rather than buffering first and checking afterwards. */
async function readCapped(res: Response, cap: number): Promise<Uint8Array> {
  const declared = Number(res.headers.get("content-length") || 0);
  if (declared && declared > cap) throw new Error(`too large (${declared} bytes)`);
  if (!res.body) return new Uint8Array(await res.arrayBuffer());
  const reader = res.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    if (!value) continue;
    size += value.byteLength;
    if (size > cap) {
      await reader.cancel().catch(() => {});
      throw new Error(`too large (over ${cap} bytes)`);
    }
    chunks.push(value);
  }
  const merged = new Uint8Array(size);
  let at = 0;
  for (const c of chunks) {
    merged.set(c, at);
    at += c.byteLength;
  }
  return merged;
}

/** Fetch one remote object and return its bytes plus a usable mime type.
 *
 *  Shared by the media inliner and by any endpoint that accepts a URL instead
 *  of an upload, so the byte ceiling, the deadline and the "read under a cap,
 *  do not buffer first" rule are enforced in exactly one place. */
export async function fetchRemoteBytes(
  url: string,
  capBytes: number = MAX_REMOTE_BYTES,
  fallbackMime: string = "application/octet-stream",
): Promise<{ bytes: Uint8Array; mime: string } | { reason: string }> {
  if (!isRemote(url)) return { reason: "not an http(s) URL" };
  if (capBytes <= 0) return { reason: "size budget exhausted" };
  let res: Response;
  try {
    res = await fetch(url, {
      redirect: "follow",
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
      headers: { accept: "*/*" },
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { reason: /timed? ?out|abort/i.test(msg) ? "fetch timed out" : `fetch failed: ${msg}` };
  }
  if (!res.ok) {
    await res.body?.cancel().catch(() => {});
    return { reason: `HTTP ${res.status}` };
  }
  let bytes: Uint8Array;
  try {
    bytes = await readCapped(res, capBytes);
  } catch (e) {
    return { reason: e instanceof Error ? e.message : String(e) };
  }
  const declared = String(res.headers.get("content-type") || "").split(";")[0].trim();
  const mime = declared && declared !== "application/octet-stream" ? declared : fallbackMime;
  return { bytes, mime };
}

/** Fetch one remote reference and rewrite it in place as a data URL. */
async function inlineSlot(slot: Slot, budget: number): Promise<{ bytes: number } | { reason: string }> {
  const cap = Math.min(MAX_REMOTE_BYTES, budget);
  if (cap <= 0) return { reason: "turn media budget exhausted" };
  const got = await fetchRemoteBytes(slot.url, cap, DEFAULT_MIME[slot.kind]);
  if ("reason" in got) return { reason: got.reason };
  slot.holder[slot.key] = `data:${got.mime};base64,${toBase64(got.bytes)}`;
  return { bytes: got.bytes.byteLength };
}

/** Clone a part deeply enough that rewriting a nested URL field never reaches
 *  the object the caller passed in. The URL-bearing sub-objects are the only
 *  nested structures that matter, so they are copied explicitly rather than
 *  deep-cloning the whole part (which may hold a multi-megabyte data URL). */
function clonePart(part: any): any {
  if (!part || typeof part !== "object") return part;
  const copy: any = { ...part };
  for (const key of ["image_url", "video_url", "input_audio", "audio_url", "file"]) {
    if (copy[key] && typeof copy[key] === "object") copy[key] = { ...copy[key] };
  }
  return copy;
}

/** Resolve every remote media reference in `messages` into an inline data URL.
 *
 *  Returns a shallow-copied message list so the caller's array is never
 *  mutated. A turn with no remote references is returned untouched and costs
 *  nothing — no fetch is attempted, and the routing decision that follows is
 *  byte-for-byte the one it would have made anyway. */
export async function inlineRemoteMedia<T extends { content?: unknown }>(
  messages: T[],
): Promise<{ messages: T[]; stats: InlineStats }> {
  const stats: InlineStats = { fetched: 0, bytes: 0, failures: [] };
  const slots = collectSlots(messages as any[]);
  if (!slots.length) return { messages, stats };

  // Clone only the messages that actually carry a remote reference, and only
  // down to the parts, so a large inline turn is not deep-copied for nothing.
  const copy = messages.map((m) => m);
  for (let i = 0; i < copy.length; i++) {
    const m: any = copy[i];
    if (m && Array.isArray(m.content) && m.content.some((p: any) => slotsInPart(p).length)) {
      copy[i] = { ...m, content: m.content.map(clonePart) } as T;
    }
  }
  // Re-collect against the clones, so a rewrite lands on the copy the caller
  // receives and never on the object they passed in.
  const targets = collectSlots(copy as any[]);

  let cursor = 0;
  const workers = Array.from({ length: Math.min(MAX_CONCURRENT, targets.length) }, async () => {
    for (;;) {
      const index = cursor++;
      if (index >= targets.length) return;
      const slot = targets[index];
      const remaining = MAX_TOTAL_BYTES - stats.bytes;
      const out = await inlineSlot(slot, remaining);
      if ("bytes" in out) {
        stats.fetched++;
        stats.bytes += out.bytes;
      } else {
        stats.failures.push({ url: slot.url, reason: out.reason });
      }
    }
  });
  await Promise.all(workers);
  return { messages: copy, stats };
}
