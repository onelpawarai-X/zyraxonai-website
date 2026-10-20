/** Client-side media compression and slicing with ffmpeg.wasm.
 *
 *  A one- or two-hour recording can be a gigabyte. Uploading that as one request
 *  is both slow and, for a content part, impossible. The browser already holds
 *  the file, so it is the cheapest place to transcode: shrink it to a size a
 *  model can take, and cut it into ordered slices when it is still too big.
 *
 *  The core is loaded lazily from a CDN the first time a file is actually too
 *  large. A page that only ever sends text never pays for it. If the core cannot
 *  load (offline, blocked), the original file is returned untouched so the caller
 *  still gets a working — if larger — upload rather than a hard failure. */

import {
  DEFAULT_MEDIA_BUDGET,
  MAX_MEDIA_BODY_BYTES,
  MAX_MEDIA_PARTS,
  fitBitrateKbps,
  planMedia,
  sliceName,
  videoSliceCount,
  sliceWindows,
  trimToBodyBudget,
  type MediaBudget,
} from "./media";

const CORE_VERSION = "0.12.6";
const CDN = `https://unpkg.com/@ffmpeg/core@${CORE_VERSION}/dist/umd`;
const FFMPEG_CDN = `https://unpkg.com/@ffmpeg/ffmpeg@${CORE_VERSION}/dist/umd`;

export type SlicedMedia = {
  /** Ready-to-send data URLs, in playback order. */
  parts: string[];
  /** How the input was handled, for the caller to show. */
  action: "as-is" | "compressed" | "compressed+sliced" | "sliced";
  /** Size of the original input, in bytes. */
  originalBytes: number;
  /** Total size of what will actually be sent, in bytes. */
  sentBytes: number;
};

export type CompressOptions = {
  budget?: MediaBudget;
  /** Target video bitrate in kbps for the compressed output. */
  videoKbps?: number;
  /** Scale cap; -2 keeps the aspect ratio. */
  maxWidth?: number;
  /** Called with ffmpeg's log lines, for a progress strip. */
  onLog?: (line: string) => void;
};

/** One attachment, in the shape the chat routes accept. `data` is a data URL. */
export type PreparedAttachment = { name: string; mime: string; data: string };

/** How an attachment was prepared, so a UI can tell the user what happened
 *  ("compressed 240 MB → 4 MB", "split into 3 parts"). */
export type Prepared = {
  attachments: PreparedAttachment[];
  notes: string[];
};

function dataUrlToBytes(url: string): Uint8Array {
  const comma = url.indexOf(",");
  const meta = url.slice(0, comma);
  const payload = url.slice(comma + 1);
  if (!/;base64/i.test(meta)) {
    return new TextEncoder().encode(decodeURIComponent(payload));
  }
  const bin = atob(payload);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

function bytesToDataUrl(bytes: Uint8Array, mime: string): string {
  let bin = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    bin += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return `data:${mime};base64,${btoa(bin)}`;
}

export function fileToDataUrl(file: File | Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result || ""));
    r.onerror = () => reject(r.error);
    r.readAsDataURL(file);
  });
}

type FFmpegLike = {
  load: (opts: { coreURL: string; wasmURL: string }) => Promise<void>;
  writeFile: (name: string, data: Uint8Array) => Promise<boolean>;
  exec: (args: string[]) => Promise<number>;
  readFile: (name: string) => Promise<Uint8Array | string>;
  deleteFile: (name: string) => Promise<boolean>;
  on: (event: "log", cb: (e: { message: string }) => void) => void;
};

let ffmpegPromise: Promise<FFmpegLike> | null = null;

/** Load ffmpeg.wasm once per page, from the CDN, on first real need. */
async function loadFFmpeg(onLog?: (line: string) => void): Promise<FFmpegLike> {
  if (ffmpegPromise) return ffmpegPromise;
  ffmpegPromise = (async () => {
    const [{ FFmpeg }, { toBlobURL }] = await Promise.all([
      import(/* @vite-ignore */ `${FFMPEG_CDN}/ffmpeg.js` as string),
      import(/* @vite-ignore */ `${FFMPEG_CDN}/util.js` as string),
    ]);
    const ff = new FFmpeg() as FFmpegLike;
    ff.on("log", (e) => onLog?.(e.message));
    await ff.load({
      coreURL: await toBlobURL(`${CDN}/ffmpeg-core.js`, "text/javascript"),
      wasmURL: await toBlobURL(`${CDN}/ffmpeg-core.wasm`, "application/wasm"),
    });
    return ff;
  })();
  try {
    return await ffmpegPromise;
  } catch (e) {
    ffmpegPromise = null;
    throw e;
  }
}

/** Shrink a video and, when still too large, cut it into ordered slices.
 *
 *  Returns data URLs that can be dropped straight into content parts. On any
 *  failure the original file is returned whole, so the caller degrades to a
 *  larger upload rather than no upload. */
export async function compressVideo(
  file: File | Blob,
  name = "video.mp4",
  options: CompressOptions = {},
): Promise<SlicedMedia> {
  const budget = options.budget ?? DEFAULT_MEDIA_BUDGET;
  const originalBytes = file.size;
  const original = await fileToDataUrl(file);
  const plan = planMedia(originalBytes, budget);
  if (plan.inline) {
    return { parts: [original], action: "as-is", originalBytes, sentBytes: originalBytes };
  }

  let ff: FFmpegLike;
  try {
    ff = await loadFFmpeg(options.onLog);
  } catch {
    return { parts: [original], action: "as-is", originalBytes, sentBytes: originalBytes };
  }

  const ext = (name.match(/\.([a-z0-9]{1,5})$/i)?.[1] || "mp4").toLowerCase();
  const input = `in.${ext}`;
  const compressed = "out.mp4";
  const maxWidth = options.maxWidth ?? 1280;

  try {
    await ff.writeFile(input, dataUrlToBytes(original));

    // Size the bitrate to the duration, not to a fixed constant. A fixed
    // bitrate cannot fit a long recording into the request budget at all: two
    // hours at 700 kbps is ~630 MB of video, which no amount of slicing makes
    // sendable. Knowing the duration up front lets the encoder aim the whole
    // output at the budget the rest of the pipeline actually enforces.
    const duration = await probeDurationSeconds(ff, original);
    const targetBytes = MAX_MEDIA_PARTS * budget.partTarget;
    const audioKbps = duration > 600 ? 32 : 96;
    const videoKbps = options.videoKbps ?? fitBitrateKbps(targetBytes, duration, audioKbps);

    await ff.exec([
      "-i",
      input,
      "-vf",
      `scale='min(${maxWidth},iw)':-2`,
      "-c:v",
      "libx264",
      "-preset",
      "veryfast",
      "-b:v",
      `${videoKbps}k`,
      "-c:a",
      "aac",
      "-b:a",
      `${audioKbps}k`,
      "-movflags",
      "+faststart",
      compressed,
    ]);
    const out = await ff.readFile(compressed);
    const outBytes = typeof out === "string" ? new TextEncoder().encode(out) : out;
    await ff.deleteFile(input).catch(() => {});
    await ff.deleteFile(compressed).catch(() => {});

    const compressedUrl = bytesToDataUrl(outBytes, "video/mp4");
    const afterPlan = planMedia(outBytes.byteLength, budget);
    if (afterPlan.parts <= 1) {
      return {
        parts: [compressedUrl],
        action: "compressed",
        originalBytes,
        sentBytes: outBytes.byteLength,
      };
    }

    // Still too large: cut it into near-equal slices in playback order.
    const count = videoSliceCount(duration, outBytes.byteLength, budget);
    const slices = await sliceMedia(ff, outBytes, count, "mp4", duration, "video/mp4");
    if (slices.length <= 1) {
      return {
        parts: [compressedUrl],
        action: "compressed",
        originalBytes,
        sentBytes: outBytes.byteLength,
      };
    }
    return {
      parts: slices,
      action: "compressed+sliced",
      originalBytes,
      sentBytes: slices.reduce((n, s) => n + dataUrlToBytes(s).byteLength, 0),
    };
  } catch {
    ffmpegPromise = null;
    return { parts: [original], action: "as-is", originalBytes, sentBytes: originalBytes };
  }
}

async function probeDurationSeconds(ff: FFmpegLike, originalDataUrl: string): Promise<number> {
  // ffmpeg.wasm has no ffprobe; read the duration from the demuxer log instead.
  let duration = 0;
  const tmp = "probe.mp4";
  try {
    await ff.writeFile(tmp, dataUrlToBytes(originalDataUrl));
    let log = "";
    const capture = (e: { message: string }) => (log += e.message + "\n");
    ff.on("log", capture);
    await ff.exec(["-i", tmp]).catch(() => 0);
    const m = /Duration:\s*(\d+):(\d+):(\d+\.\d+)/.exec(log);
    if (m) duration = Number(m[1]) * 3600 + Number(m[2]) * 60 + Number(m[3]);
  } catch {
    duration = 0;
  } finally {
    await ff.deleteFile(tmp).catch(() => {});
  }
  return duration;
}

async function sliceMedia(
  ff: FFmpegLike,
  bytes: Uint8Array,
  count: number,
  outExt: string,
  durationSeconds: number,
  mime = "video/mp4",
): Promise<string[]> {
  if (count <= 1) return [];
  const windows = sliceWindows(durationSeconds, count);
  const out: string[] = [];
  const src = `slice-src.${outExt}`;
  await ff.writeFile(src, bytes);
  try {
    for (let i = 0; i < windows.length; i++) {
      const w = windows[i];
      const outName = `slice-out-${i}.${outExt}`;
      await ff.exec([
        "-ss",
        String(w.start),
        "-t",
        String(w.duration),
        "-i",
        src,
        "-c",
        "copy",
        "-avoid_negative_ts",
        "make_zero",
        outName,
      ]);
      const data = await ff.readFile(outName);
      const sliceBytes = typeof data === "string" ? new TextEncoder().encode(data) : data;
      if (sliceBytes.byteLength > 0) out.push(bytesToDataUrl(sliceBytes, mime));
      await ff.deleteFile(outName).catch(() => {});
    }
  } finally {
    await ff.deleteFile(src).catch(() => {});
  }
  return out;
}

const MB = 1024 * 1024;
const fmtMb = (n: number) => `${(n / MB).toFixed(1)} MB`;

/** Trim a prepared set to what one request can actually carry.
 *
 *  The planner caps part count, but a compressed video's bitrate is not known
 *  until it is encoded, so the encoded total can still overrun the body cap.
 *  Dropping the tail here — and saying so — is the honest failure: the caller
 *  sees which parts were sent, instead of the whole turn dying on a 413 after a
 *  long compression. */
function finalize(
  attachments: PreparedAttachment[],
  notes: string[],
): Prepared {
  const { kept, dropped } = trimToBodyBudget(attachments);
  if (dropped > 0) {
    notes.push(`Sent the first ${kept.length} of ${attachments.length} parts to stay within the per-request limit.`);
  }
  return { attachments: kept, notes };
}

/** Prepare one user-picked file for the chat routes, whatever its type.
 *
 *  This is the single entry point the UI should call: it applies the right
 *  strategy per MIME type and always returns something sendable. Video is
 *  compressed and, if still oversized, sliced; audio is passed through when it
 *  fits and otherwise transcoded down to mono speech bitrates; images and PDFs
 *  are passed through with a size note. A file that is too big and that we
 *  cannot shrink is reported in `notes` and dropped, so a caller is never left
 *  with a silently truncated request. */
export async function prepareAttachment(
  file: File,
  options: CompressOptions = {},
): Promise<Prepared> {
  const budget = options.budget ?? DEFAULT_MEDIA_BUDGET;
  const mime = (file.type || "").toLowerCase();
  const notes: string[] = [];

  if (mime.startsWith("video/")) {
    const out = await compressVideo(file, file.name, options);
    if (out.action === "as-is" && out.originalBytes > budget.inlineMax) {
      // The core failed to load and the file is still oversized: say so rather
      // than send a part the upstream will reject.
      notes.push(`${file.name}: ${fmtMb(out.originalBytes)} exceeds the limit and could not be compressed in this browser.`);
      return { attachments: [], notes };
    }
    if (out.parts.length > 1) {
      notes.push(`${file.name}: compressed and split into ${out.parts.length} parts (${fmtMb(out.originalBytes)} → ${fmtMb(out.sentBytes)}).`);
    } else if (out.action.startsWith("compressed")) {
      notes.push(`${file.name}: compressed ${fmtMb(out.originalBytes)} → ${fmtMb(out.sentBytes)}.`);
    }
    return finalize(
      out.parts.map((data, i) => ({
        name: out.parts.length > 1 ? sliceName(file.name, i, "mp4") : file.name,
        mime: "video/mp4",
        data,
      })),
      notes,
    );
  }

  if (mime.startsWith("audio/")) {
    const data = await fileToDataUrl(file);
    if (file.size <= budget.inlineMax) {
      return finalize([{ name: file.name, mime, data }], notes);
    }
    const shrunk = await compressAudio(file, options);
    if (!shrunk) {
      notes.push(`${file.name}: ${fmtMb(file.size)} exceeds the limit and could not be compressed in this browser.`);
      return { attachments: [], notes };
    }
    if (shrunk.parts.length > 1) {
      notes.push(`${file.name}: compressed and split into ${shrunk.parts.length} parts (${fmtMb(file.size)} → ${fmtMb(shrunk.bytes)}).`);
    } else {
      notes.push(`${file.name}: compressed ${fmtMb(file.size)} → ${fmtMb(shrunk.bytes)}.`);
    }
    return finalize(
      shrunk.parts.map((part, i) => ({
        name: shrunk.parts.length > 1 ? sliceName(file.name, i, shrunk.ext) : file.name,
        mime: shrunk.mime,
        data: part,
      })),
      notes,
    );
  }

  // Images and PDFs are not transcoded here; they are small enough that the
  // cap is the right control.
  const data = await fileToDataUrl(file);
  if (file.size > budget.inlineMax) {
    notes.push(`${file.name}: ${fmtMb(file.size)} exceeds the per-request limit.`);
    return { attachments: [], notes };
  }
  return finalize([{ name: file.name, mime: mime || "application/octet-stream", data }], notes);
}

/** Transcode audio down to a compact speech codec and, when it is still too
 *  large, cut it into ordered slices.
 *
 *  MP3 at a low mono bitrate is the target, not WAV: a WAV of a one-hour
 *  recording is well over a hundred megabytes, so "compressing" to WAV made a
 *  large file larger and guaranteed the upload was rejected. Returns null when
 *  ffmpeg is unavailable or the file cannot be decoded, so the caller can fall
 *  back rather than fail. */
async function compressAudio(
  file: File,
  options: CompressOptions,
): Promise<{ data: string; bytes: number; parts: string[]; mime: string; ext: string } | null> {
  let ff: FFmpegLike;
  try {
    ff = await loadFFmpeg(options.onLog);
  } catch {
    return null;
  }
  const budget = options.budget ?? DEFAULT_MEDIA_BUDGET;
  const original = await fileToDataUrl(file);
  const ext = (file.name.match(/\.([a-z0-9]{1,5})$/i)?.[1] || "bin").toLowerCase();
  const input = `audio-in.${ext}`;
  // mp3 first: it is the format the wire shape names, and libmp3lame is in the
  // bundled core. AAC in m4a is the fallback when the core lacks the encoder.
  const codecs: Array<{ ext: string; mime: string; args: string[] }> = [
    { ext: "mp3", mime: "audio/mpeg", args: ["-c:a", "libmp3lame", "-b:a", "48k", "-ac", "1", "-ar", "16000"] },
    { ext: "m4a", mime: "audio/mp4", args: ["-c:a", "aac", "-b:a", "48k", "-ac", "1", "-ar", "16000"] },
  ];
  try {
    await ff.writeFile(input, dataUrlToBytes(original));
    for (const codec of codecs) {
      const output = `audio-out.${codec.ext}`;
      try {
        await ff.exec(["-i", input, ...codec.args, output]);
        const data = await ff.readFile(output);
        const bytes = typeof data === "string" ? new TextEncoder().encode(data) : data;
        await ff.deleteFile(output).catch(() => {});
        if (!bytes.byteLength) continue;
        const encoded = bytesToDataUrl(bytes, codec.mime);
        const after = planMedia(bytes.byteLength, budget);
        if (after.parts <= 1) {
          return { data: encoded, bytes: bytes.byteLength, parts: [encoded], mime: codec.mime, ext: codec.ext };
        }
        const duration = await probeDurationSeconds(ff, original);
        const slices = await sliceMedia(ff, bytes, after.parts, codec.ext, duration);
        if (slices.length > 1) {
          return {
            data: encoded,
            bytes: bytes.byteLength,
            parts: slices,
            mime: codec.mime,
            ext: codec.ext,
          };
        }
        return { data: encoded, bytes: bytes.byteLength, parts: [encoded], mime: codec.mime, ext: codec.ext };
      } catch {
        // Try the next codec.
      }
    }
    return null;
  } catch {
    return null;
  } finally {
    await ff.deleteFile(input).catch(() => {});
  }
}
