/** Multimodal content handling for the ZYRAXON provider.
 *
 *  The OpenAI chat-completions SDK has first-class parts for text and images
 *  only. Video and audio *input* are not in the spec, so a caller who wants to
 *  send them has to smuggle a superset through `content`. This module is the
 *  patch: it normalises that superset into the part shapes the upstream
 *  multimodal models actually accept, reports which modalities a turn needs, and
 *  plans how a large file is cut down to something a model can take.
 *
 *  Pure data and pure functions — no network, no node built-ins — so the provider
 *  page, the browser, and the server can all import it. */

export type MediaKind = "image" | "audio" | "video" | "pdf";

/** A media reference in canonical form: a kind, a data-or-remote URL, and a
 *  name. This is the provider's own vocabulary — deliberately NOT any vendor's
 *  wire format, because the wire format is chosen later, per upstream. */
export type NormalisedPart =
  | { type: "text"; text: string }
  | { type: "media"; kind: MediaKind; url: string; name?: string };

export type MediaRef = {
  kind: MediaKind;
  /** A data URL or a remote http(s) URL. */
  url: string;
  name?: string;
};

/** Base64 inflates by 4/3; the OpenAI part envelopes add a little more. */
const BASE64_RATIO = 4 / 3;

const EXT_MIME: Record<string, MediaKind> = {
  png: "image",
  jpg: "image",
  jpeg: "image",
  gif: "image",
  webp: "image",
  bmp: "image",
  heic: "image",
  mp3: "audio",
  wav: "audio",
  m4a: "audio",
  aac: "audio",
  ogg: "audio",
  opus: "audio",
  flac: "audio",
  mp4: "video",
  mov: "video",
  webm: "video",
  mkv: "video",
  avi: "video",
  m4v: "video",
  pdf: "pdf",
};

export function isDataUrl(url: string): boolean {
  return /^data:/i.test(String(url || ""));
}

export function mimeOf(url: string, fallbackName?: string): string {
  const dataMatch = /^data:([^;,]+)/i.exec(url || "");
  if (dataMatch) return dataMatch[1].toLowerCase();
  const name = fallbackName || url || "";
  const ext = /\.([a-z0-9]{1,5})(?:\?|#|$)/i.exec(name);
  return ext ? `application/${ext[1].toLowerCase()}` : "";
}

/** Byte size of a data URL's payload, or null when the url is remote. Remote
 *  sizes are deliberately unknown here: fetching to measure would turn a cheap
 *  validation into an upload. */
export function dataUrlBytes(url: string): number | null {
  if (!isDataUrl(url)) return null;
  const comma = url.indexOf(",");
  if (comma < 0) return 0;
  const meta = url.slice(0, comma);
  const payload = url.length - comma - 1;
  return /;base64/i.test(meta) ? Math.floor(payload / BASE64_RATIO) : payload;
}

function kindFromMime(mime: string): MediaKind | null {
  if (/^image\//i.test(mime)) return "image";
  if (/^audio\//i.test(mime)) return "audio";
  if (/^video\//i.test(mime)) return "video";
  if (/pdf/i.test(mime)) return "pdf";
  return null;
}

function kindFromName(name: string): MediaKind | null {
  const ext = /\.([a-z0-9]{1,5})(?:\?|#|$)/i.exec(name || "");
  return ext ? EXT_MIME[ext[1].toLowerCase()] || null : null;
}

/** The part types a caller may send. We accept the OpenAI shapes plus the common
 *  community spellings for video and audio, because a client that has no spec to
 *  follow invents its own. */
export function partMediaKind(part: any): MediaKind | null {
  if (!part || typeof part !== "object") return null;
  const type = String(part.type || "").toLowerCase();
  // Canonical shape: the public route normalises inbound parts once, so a part
  // that arrives here may already read `{ type: "media", kind }`. Without this
  // branch a normalised audio/video part is invisible to the router and the
  // turn silently degrades to text.
  if (type === "media") {
    const kind = String(part.kind || "").toLowerCase();
    if (kind === "image" || kind === "audio" || kind === "video" || kind === "pdf") {
      return kind as MediaKind;
    }
    return null;
  }
  if (type === "image_url" || type === "image") return "image";
  if (type === "input_audio" || type === "audio" || type === "audio_url") return "audio";
  if (type === "video_url" || type === "video" || type === "input_video") return "video";
  if (type === "file" || type === "document") {
    const mime = String(part.file?.mime_type || part.mime_type || "");
    return kindFromMime(mime) || "pdf";
  }
  return null;
}

function urlOfPart(part: any, kind: MediaKind): string {
  // Canonical parts already carry the resolved URL.
  if (String(part?.type || "").toLowerCase() === "media" && typeof part.url === "string") {
    return part.url;
  }
  if (kind === "image") return part.image_url?.url ?? part.url ?? part.image ?? "";
  if (kind === "video") return part.video_url?.url ?? part.url ?? part.video ?? "";
  if (kind === "audio") {
    const a = part.input_audio ?? {};
    if (typeof a.data === "string") {
      const fmt = a.format ? `;base64` : ";base64";
      return /^data:/i.test(a.data) ? a.data : `data:audio/${a.format || "mp3"}${fmt},${a.data}`;
    }
    return part.audio_url?.url ?? part.url ?? part.audio ?? "";
  }
  return part.file?.file_data ?? part.url ?? "";
}

/** Every media part in a message's content, with its kind. */
export function collectMedia(content: unknown): MediaRef[] {
  if (!Array.isArray(content)) return [];
  const out: MediaRef[] = [];
  for (const part of content) {
    const kind = partMediaKind(part);
    if (!kind) continue;
    const url = String(urlOfPart(part, kind) || "");
    if (!url) continue;
    out.push({ kind, url, name: part?.name || part?.file?.filename });
  }
  return out;
}

/** The set of input modalities a turn needs before it can be answered. Text is
 *  always implied and never listed. */
export function requiredModalities(messages: Array<{ content: unknown }>): Set<MediaKind> {
  const need = new Set<MediaKind>();
  for (const m of messages) for (const ref of collectMedia(m.content)) need.add(ref.kind);
  return need;
}

/** True when a model advertising `modalities` can take every input the turn
 *  needs. An empty requirement fits any model, including text-only ones. */
export function fitsModalities(need: Set<MediaKind>, modalities: Iterable<string>): boolean {
  if (need.size === 0) return true;
  const have = new Set(Array.from(modalities, (m) => String(m).toLowerCase()));
  for (const k of need) if (!have.has(k)) return false;
  return true;
}

/** Normalise one inbound part to the canonical shape. Returns null for a part
 *  we cannot place, so the caller can drop it rather than forward something the
 *  upstream will reject. */
export function normalisePart(part: any): NormalisedPart | null {
  if (part == null) return null;
  if (typeof part === "string") return { type: "text", text: part };
  const kind = partMediaKind(part);
  if (!kind) {
    if (String(part.type || "").toLowerCase() === "text") {
      return { type: "text", text: String(part.text ?? "") };
    }
    return null;
  }
  const url = String(urlOfPart(part, kind) || "");
  if (!url) return null;
  const name = part?.file?.filename || part?.name || part?.filename;
  return { type: "media", kind, url, ...(name ? { name: String(name) } : {}) };
}

/** Normalise a whole message's content, preserving order and dropping anything
 *  unusable. A plain string stays a string, so text-only turns are untouched. */
export function normaliseContent(content: unknown): string | NormalisedPart[] {
  if (typeof content === "string") return content;
  if (!Array.isArray(content)) return String(content ?? "");
  const parts: NormalisedPart[] = [];
  for (const raw of content) {
    const p = normalisePart(raw);
    if (p) parts.push(p);
  }
  // A parts array that carries no media is just text; collapsing it keeps the
  // upstream payload minimal and the cache key stable.
  if (parts.length && parts.every((p) => p.type === "text")) {
    return parts.map((p) => (p as { text: string }).text).join("\n");
  }
  return parts;
}

/* ───────────────────────── wire-format adaptation ───────────────────────── */

/** A content part in the shape the AI SDK's model-message schema accepts.
 *
 *  The SDK does NOT accept the OpenAI wire shapes (`image_url`, `input_audio`,
 *  `video_url`) in a prompt — passing those throws
 *  "The messages do not match the ModelMessage[] schema". It accepts a narrow
 *  set: `text`, `image` and `file`, and the openai-compatible provider then
 *  renders `image`/`file` back into OpenAI wire parts itself. So the canonical
 *  form is translated here, at the boundary, and nowhere else. */
export type SdkPart =
  | { type: "text"; text: string }
  | { type: "image"; image: string; mediaType?: string }
  | { type: "file"; data: string; mediaType: string; filename?: string };

/** Split a data URL into its media type and payload; a remote URL passes
 *  through unchanged with the caller's fallback media type. */
function dataUrlParts(url: string, fallbackMime: string): { mime: string; data: string } {
  const m = /^data:([^;,]+)(;base64)?,/i.exec(url);
  if (!m) return { mime: fallbackMime, data: url };
  return { mime: m[1].toLowerCase(), data: url.slice(m[0].length) };
}

const DEFAULT_MIME: Record<MediaKind, string> = {
  image: "image/png",
  audio: "audio/mpeg",
  video: "video/mp4",
  pdf: "application/pdf",
};

/** Translate one canonical part into an SDK part.
 *
 *  Image and PDF have first-class SDK parts. Audio and video do not, so they are
 *  sent as `file` parts with their real media type — the provider forwards those
 *  as `input_audio` / a file part, which is the closest the SDK allows. */
export function toSdkPart(part: NormalisedPart): SdkPart | null {
  if (part.type === "text") return { type: "text", text: part.text };
  const fallback = DEFAULT_MIME[part.kind];
  const { mime, data } = dataUrlParts(part.url, fallback);
  if (part.kind === "image") {
    return { type: "image", image: data, mediaType: mime };
  }
  return {
    type: "file",
    data,
    mediaType: mime,
    ...(part.name ? { filename: part.name } : {}),
  };
}

/** Translate a message's canonical content into the SDK's content shape. A plain
 *  string stays a string, so text-only turns are byte-for-byte unchanged. */
export function toSdkContent(
  content: string | NormalisedPart[],
): string | SdkPart[] {
  if (typeof content === "string") return content;
  return content.map(toSdkPart).filter((p): p is SdkPart => p !== null);
}

/* ───────────────────────── raw OpenAI wire form ───────────────────────── */

/** One part in the OpenAI chat-completions wire shape. */
export type WirePart =
  | { type: "text"; text: string }
  | { type: "image_url"; image_url: { url: string } }
  | { type: "input_audio"; input_audio: { data: string; format: string } }
  | { type: "video_url"; video_url: { url: string } }
  | { type: "file"; file: { filename: string; file_data: string } };

const AUDIO_FORMAT: Record<string, string> = {
  "audio/mpeg": "mp3",
  "audio/mp3": "mp3",
  "audio/wav": "wav",
  "audio/x-wav": "wav",
  "audio/ogg": "ogg",
  "audio/webm": "webm",
  "audio/flac": "flac",
  "audio/mp4": "mp4",
  "audio/aac": "aac",
};

/** Translate one canonical part into the OpenAI wire shape.
 *
 *  This is the inverse of `normalisePart`, and it exists because the AI SDK
 *  cannot represent audio or video at all: it has no `input_audio`/`video_url`
 *  part, and it renders a `file` part as a PDF or text blob. Audio and video
 *  turns therefore bypass the SDK and are posted to the upstream in exactly the
 *  shape the OpenAI spec defines. */
export function toWirePart(part: NormalisedPart): WirePart | null {
  if (part.type === "text") return { type: "text", text: part.text };
  if (part.kind === "image") return { type: "image_url", image_url: { url: part.url } };
  if (part.kind === "video") return { type: "video_url", video_url: { url: part.url } };
  if (part.kind === "audio") {
    // `input_audio` wants bare base64 plus a short format token, not a data URL.
    const { mime, data } = dataUrlParts(part.url, DEFAULT_MIME.audio);
    const format = AUDIO_FORMAT[mime] || mime.split("/").pop() || "mp3";
    return { type: "input_audio", input_audio: { data, format } };
  }
  // A PDF goes up as a file part, which is the shape the OpenAI spec defines
  // for documents (and what the vision/document hosts actually accept).
  return {
    type: "file",
    file: { filename: part.name || "document.pdf", file_data: part.url },
  };
}

/** Translate a message's canonical content into the OpenAI wire shape. */
export function toWireContent(content: string | NormalisedPart[]): string | WirePart[] {
  if (typeof content === "string") return content;
  return content.map(toWirePart).filter((p): p is WirePart => p !== null);
}

/* ───────────────────────── large-media planning ───────────────────────── */

export type MediaPlan = {
  /** Send the file as-is, inline. */
  inline: boolean;
  /** Split into this many pieces when it does not fit inline. */
  parts: number;
  /** True when a compressor (ffmpeg) should shrink it before sending. */
  compress: boolean;
  bytes: number | null;
};

export type MediaBudget = {
  /** Largest payload accepted inline, in bytes. */
  inlineMax: number;
  /** Largest payload we will attempt to compress+split at all. */
  hardMax: number;
  /** Preferred size per split part, in bytes. */
  partTarget: number;
  /** Hard ceiling on the number of parts. A model cannot take an unbounded
   *  number of attachments, and neither can a caller's context; past this the
   *  media is compressed harder rather than sliced further. */
  maxParts: number;
};

/** Largest number of media parts one turn may carry. The UI, the chat route and
 *  the media planner all read this one constant, so a file that ffmpeg cuts into
 *  N parts is never silently trimmed to fewer by a narrower cap downstream. */
export const MAX_MEDIA_PARTS = 12;

export const DEFAULT_MEDIA_BUDGET: MediaBudget = {
  // A single base64 data URL inflates 33%, so the encoded payload is what the
  // request body actually pays for. The cap is chosen against
  // MAX_MEDIA_BODY_BYTES below: MAX_MEDIA_PARTS parts at this size, plus base64
  // inflation and text, still fits the body cap with room to spare.
  inlineMax: 2 * 1024 * 1024,
  hardMax: 2 * 1024 * 1024 * 1024,
  partTarget: 2 * 1024 * 1024,
  maxParts: MAX_MEDIA_PARTS,
};

/** Decide how to send one media file. Large video is compressed first and then
 *  cut into parts, because a 1 GB upload cannot be a single content part and
 *  cannot be sent whole over a request-scoped budget.
 *
 *  The part count is capped at `maxParts`: beyond that, compression has to do
 *  the work, since no model will accept eighty attachments in one turn. */
export function planMedia(
  bytes: number | null,
  budget: MediaBudget = DEFAULT_MEDIA_BUDGET,
): MediaPlan {
  if (bytes === null) return { inline: true, parts: 1, compress: false, bytes };
  if (bytes <= budget.inlineMax) return { inline: true, parts: 1, compress: false, bytes };
  const wanted = Math.max(2, Math.ceil(bytes / budget.partTarget));
  const parts = Math.min(budget.maxParts, wanted);
  return { inline: false, parts, compress: bytes > budget.partTarget, bytes };
}

/** How many equal slices to cut a duration into so each part stays under the
 *  target size. Duration-based, because ffmpeg segments by time, not bytes. */
export function videoSliceCount(
  durationSeconds: number,
  bytes: number | null,
  budget: MediaBudget = DEFAULT_MEDIA_BUDGET,
): number {
  if (!Number.isFinite(durationSeconds) || durationSeconds <= 0) return 1;
  const size = bytes ?? 0;
  if (size <= budget.partTarget) return 1;
  const wanted = Math.ceil(size / budget.partTarget);
  return Math.min(budget.maxParts, Math.max(2, wanted));
}

/** Split a duration into `n` near-equal slices, each at least one second. */
export function sliceWindows(
  durationSeconds: number,
  n: number,
): Array<{ start: number; duration: number }> {
  const count = Math.max(1, Math.floor(n));
  if (!Number.isFinite(durationSeconds) || durationSeconds <= 0) {
    return [{ start: 0, duration: 0 }];
  }
  const slice = durationSeconds / count;
  return Array.from({ length: count }, (_, i) => ({
    start: Number((i * slice).toFixed(3)),
    duration: Number(slice.toFixed(3)),
  }));
}

/** A stable, collision-free name for a generated slice. */
export function sliceName(base: string, index: number, ext = "mp4"): string {
  const stem = String(base || "media")
    .replace(/\.[a-z0-9]{1,5}$/i, "")
    .replace(/[^a-z0-9_-]+/gi, "_");
  return `${stem || "media"}_part${String(index + 1).padStart(2, "0")}.${ext}`;
}

/** Request-body ceiling shared by both chat routes.
 *
 *  This is the number the media budget is sized against, and the reason it is
 *  exported: when the two disagreed, a large video was compressed and sliced
 *  correctly and then the whole request was refused with a 413 because the
 *  sliced parts did not fit under a smaller, unrelated cap. */
export const MAX_MEDIA_BODY_BYTES = 40 * 1024 * 1024;

/** Bytes a payload costs once base64-encoded, which is what the body cap sees. */
export function encodedBytes(bytes: number): number {
  return Math.ceil(bytes * BASE64_RATIO);
}

/** The video bitrate, in kbps, that fits `targetBytes` of encoded output into
 *  `durationSeconds` of video.
 *
 *  Clamped to [50, 4000]: below 50 kbps the picture is useless, and above 4000
 *  there is no point when the pipeline is going to re-encode anyway. A zero or
 *  unknown duration cannot be sized, so it falls back to a middle rate rather
 *  than to 0 (which would ask the encoder for an empty file). */
export function fitBitrateKbps(
  targetBytes: number,
  durationSeconds: number,
  audioKbps = 96,
): number {
  if (!Number.isFinite(durationSeconds) || durationSeconds <= 0) return 700;
  // targetBytes is the *raw* payload; the encoded payload is larger by the
  // base64 ratio, so convert back to the raw budget the encoder may spend.
  const rawKbits = (targetBytes * 8) / BASE64_RATIO / 1000;
  const videoKbps = Math.floor(rawKbits / durationSeconds) - audioKbps;
  return Math.max(50, Math.min(4000, videoKbps));
}

/** Total encoded size of a set of attachments, for a pre-flight size check. */
export function attachmentsBodyBytes(
  attachments: Array<{ data: string }>,
): number {
  let total = 0;
  for (const a of attachments) {
    const comma = a.data.indexOf(",");
    const payload = comma >= 0 ? a.data.length - comma - 1 : a.data.length;
    total += payload;
  }
  return total;
}

/** Reduce a set of parts to what one request can actually carry.
 *
 *  The planner caps the part count, but an encoder's real output size is only
 *  known after it runs, and a very long recording cannot be shrunk below a
 *  usable bitrate at all. When that happens the honest move is to send as many
 *  leading parts as fit and report the rest, rather than send an over-cap body
 *  (which the server refuses) or silently drop the tail (which the caller never
 *  learns about). Returns the kept parts and how many were dropped. */
export function trimToBodyBudget<T extends { data: string }>(
  attachments: T[],
  maxParts: number = MAX_MEDIA_PARTS,
  maxBytes: number = MAX_MEDIA_BODY_BYTES,
): { kept: T[]; dropped: number } {
  const kept = attachments.slice(0, Math.max(1, maxParts));
  while (kept.length > 1 && attachmentsBodyBytes(kept) > maxBytes) kept.pop();
  return { kept, dropped: attachments.length - kept.length };
}
