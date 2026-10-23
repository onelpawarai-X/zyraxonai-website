/** Codec decoding for the speech-to-text endpoint — the one layer that needs a
 *  library.
 *
 *  Container parsing lives in `audio.ts` and is ours. Turning compressed frames
 *  into samples needs a real decoder, and writing an Opus or MP3 decoder from
 *  scratch would be a decade of work. So exactly one small, MIT-licensed,
 *  self-contained WebAssembly decoder is used, and it is loaded lazily: a client
 *  that sends WAV — which is what a careful client does, and what our own
 *  browser recorder produces when configured for it — never pays for it.
 *
 *  The packages are single-purpose and vendor-neutral:
 *    - `mpg123-decoder`          — MP3, the format phone and desktop recorders produce.
 *    - `opus-decoder`            — Opus, the format browsers produce.
 *    - `@wasm-audio-decoders/flac`, `/ogg-vorbis`, `/aac`
 *  None talks to a network, none needs a key, and all are wasm blobs bundled
 *  with the app, so there is no CDN to disappear.
 *
 *  Each decoder is handed an already-compiled wasm module from `./wasm`, because
 *  their own loader compiles wasm at runtime and the Workers runtime forbids
 *  that. See `./wasm/index.ts`.
 *
 *  Every decode here is done in slices, never in one call. The libraries' own
 *  `decodeFile` decodes a whole stream at once and returns planar Float32 — four
 *  bytes per sample per channel — so a five-minute stereo recording is over
 *  100 MB held live at once, past a Worker's heap, and the request dies as a 502
 *  with no message. Feeding the same decoder its own incremental `decode` and
 *  narrowing each slice to 16-bit mono immediately keeps one slice of float
 *  audio alive at a time, and assembles the result at a quarter of the bytes.
 *  That is what makes a long recording decode at all. */

import type { Pcm } from "./audio";
import { oggCodec, oggOpusPackets, webmCodec, webmOpusFrames } from "./audio";
import { aacModule, flacModule, mpg123Module, oggVorbisModule, opusModule } from "./wasm";

/** Decoded frames at the codec's own rate; the caller resamples. */
type DecodeResult = { samples: Int16Array; sampleRate: number };

/** One slice of a compressed stream handed to a decoder at a time. Sized so a
 *  slice decodes to a few hundred milliseconds of float audio at most, which is
 *  what keeps the live heap flat regardless of how long the recording is. */
const SLICE_BYTES = 65536;

/** How many Opus frames are decoded per call. Frames are already separate, so
 *  this is the same idea as `SLICE_BYTES` for the frame-based path. */
const FRAME_BATCH = 256;

/** One decoded slice, as every decoder here reports it. */
type DecodedSlice = { channelData: Float32Array[]; samplesDecoded: number; sampleRate: number };

/** Collects slices into one mono 16-bit track.
 *
 *  Each slice is downmixed and narrowed as soon as it arrives, so only one slice
 *  of float audio is ever live. The output is built once at the end, from Int16
 *  parts, which is the smallest the whole recording ever needs to be. */
class PcmBuilder {
  private readonly parts: Int16Array[] = [];
  private rate = 0;
  private count = 0;

  push(slice: DecodedSlice): void {
    const frames = slice.samplesDecoded;
    if (!frames) return;
    if (!this.rate) this.rate = slice.sampleRate;
    this.parts.push(floatsToInt16(slice.channelData, frames));
    this.count += frames;
  }

  finish(emptyMessage: string): Pcm {
    if (!this.count) throw new Error(emptyMessage);
    const samples = new Int16Array(this.count);
    let at = 0;
    for (const part of this.parts) {
      samples.set(part, at);
      at += part.length;
    }
    return { samples, sampleRate: this.rate };
  }
}

/** Decode a WebM/Opus stream — what a browser's MediaRecorder emits. */
export async function decodeWebm(bytes: Uint8Array): Promise<Pcm> {
  // WebM carries Vorbis as readily as Opus, and a Vorbis packet fed to the Opus
  // decoder crashes its wasm — a 502 that reads like an outage. Name the codec
  // instead. Ogg/Vorbis is decoded, but a WebM demuxer for it is not bundled.
  if (webmCodec(bytes) === "vorbis")
    throw new Error("WebM Vorbis is not supported; use WebM Opus, or Ogg Vorbis");
  const frames = webmOpusFrames(bytes);
  if (!frames.length) throw new Error("no audio frames found in the WebM stream");
  return decodeOpusFrames(frames);
}

/** Decode an Ogg stream — Opus or Vorbis, whichever the pages carry.
 *
 *  Vorbis used to be refused by name, because the Opus decoder crashes on a
 *  Vorbis packet and no Vorbis decoder was bundled. That made a whole class of
 *  ordinary files unreadable: Wikimedia's audio, and anything a desktop encoder
 *  produced, is Vorbis far more often than Opus. Both codecs now have a decoder,
 *  so the stream is routed by the codec its first page declares. */
export async function decodeOgg(bytes: Uint8Array): Promise<Pcm> {
  const codec = oggCodec(bytes);
  if (codec === "vorbis") return decodeVorbis(bytes);
  if (codec !== "opus" && codec !== "unknown")
    throw new Error(`Ogg ${codec} is not supported; only Ogg Opus and Ogg Vorbis are`);
  const packets = oggOpusPackets(bytes);
  if (!packets.length) throw new Error("no audio packets found in the Ogg stream");
  return decodeOpusFrames(packets);
}

/** Decode an Ogg/Vorbis stream — Wikimedia's audio, and most desktop encoders. */
export async function decodeVorbis(bytes: Uint8Array): Promise<Pcm> {
  // The inner class carries the `module` hook, and it has to come from the same
  // module as the public class it is handed to. See `decodeFlac` for why.
  const { default: OggVorbisDecoder, Decoder } = await import(
    "@wasm-audio-decoders/ogg-vorbis/src/OggVorbisDecoder.js"
  );
  Decoder.module = oggVorbisModule;
  const decoder = new OggVorbisDecoder();
  await decoder.ready;
  try {
    return await decodeInSlices(bytes, decoder, "the Vorbis stream decoded to no samples");
  } finally {
    decoder.free();
  }
}

/** Decode a raw AAC stream — ADTS, ADIF, or a bare frame sequence.
 *
 *  This is the audio inside an `.m4a` or `.mp4` once its wrapper is stripped,
 *  and what a `.aac` file holds outright. The container itself is still refused
 *  by name: unwrapping MP4 means demuxing its boxes, which is a separate job. */
export async function decodeAac(bytes: Uint8Array): Promise<Pcm> {
  const { default: AACDecoder, _AACDecoder } = await import(
    "@wasm-audio-decoders/aac/src/AACDecoder.js"
  );
  _AACDecoder.module = aacModule;
  const decoder = new AACDecoder();
  await decoder.ready;
  try {
    return await decodeInSlices(bytes, decoder, "the AAC stream decoded to no samples");
  } finally {
    decoder.free();
  }
}

/** A decoder that takes the stream in pieces and reports each piece's audio.
 *  Every library here exposes this shape; `decodeFile` is just this loop with a
 *  single, whole-stream iteration, which is what runs the heap out. */
type SliceDecoder = {
  decode(data: Uint8Array): Promise<DecodedSlice>;
  flush(): Promise<DecodedSlice>;
};

/** Decode a whole buffer through a decoder's incremental API, one slice at a
 *  time, narrowing each slice as it lands. */
async function decodeInSlices(
  bytes: Uint8Array,
  decoder: SliceDecoder,
  emptyMessage: string,
): Promise<Pcm> {
  const builder = new PcmBuilder();
  for (let at = 0; at < bytes.length; at += SLICE_BYTES) {
    builder.push(await decoder.decode(bytes.subarray(at, at + SLICE_BYTES)));
  }
  // Whatever the last slice left mid-frame.
  builder.push(await decoder.flush());
  return builder.finish(emptyMessage);
}

async function decodeOpusFrames(frames: Uint8Array[]): Promise<Pcm> {
  const { OpusDecoder } = await import("opus-decoder");
  // Hand over the build-time module so the library never compiles wasm itself,
  // which the Workers runtime refuses to do.
  OpusDecoder.module = opusModule;
  const decoder = new OpusDecoder();
  await decoder.ready;
  try {
    const builder = new PcmBuilder();
    // Batched for the same reason the byte decoders are sliced: `decodeFrames`
    // over every frame at once holds the whole recording as float audio.
    for (let at = 0; at < frames.length; at += FRAME_BATCH) {
      builder.push(decoder.decodeFrames(frames.slice(at, at + FRAME_BATCH)));
    }
    return builder.finish("the Opus stream decoded to no samples");
  } finally {
    // The wasm heap is large; release it rather than wait for the collector.
    decoder.free();
  }
}

/** Decode a FLAC stream to PCM.
 *
 *  FLAC is the one container the recogniser could read itself, so it used to be
 *  passed through untouched. That was wrong for anything longer than the
 *  service's single-request limit: a long recording came back truncated, or —
 *  with the rate field hard-coded — empty. Decoding it here puts FLAC on the
 *  same path as every other container: one buffer of PCM, cut into windows of
 *  the length the service accepts, joined back together. */
export async function decodeFlac(bytes: Uint8Array): Promise<Pcm> {
  // Both classes must come from this one file, and never from the package's
  // entry point as well. The public class builds its decoder from the inner
  // `_FLACDecoder`, so the module hook has to be set on the very object the
  // public class will use — and importing the entry point too bundles a second
  // copy of the file, which leaves the hook on the copy nothing reads. The
  // symptom is the original bug back again: a runtime compile the Workers
  // runtime refuses, and a request that hangs rather than fails.
  const { default: FLACDecoder, _FLACDecoder } =
    await import("@wasm-audio-decoders/flac/src/FLACDecoder.js");
  // Hand over the build-time module, so nothing compiles wasm at request time.
  // See `./wasm/index.ts`.
  _FLACDecoder.module = flacModule;
  const decoder = new FLACDecoder();
  await decoder.ready;
  try {
    return await decodeInSlices(bytes, decoder, "the FLAC stream decoded to no samples");
  } finally {
    decoder.free();
  }
}

/** Decode an MP3 stream — what phone and desktop recorders emit. */
export async function decodeMp3(bytes: Uint8Array): Promise<Pcm> {
  const { MPEGDecoder } = await import("mpg123-decoder");
  // As with Opus: the module comes from the build, not from a runtime compile.
  MPEGDecoder.module = mpg123Module;
  const decoder = new MPEGDecoder();
  await decoder.ready;
  try {
    const builder = new PcmBuilder();
    for (let at = 0; at < bytes.length; at += SLICE_BYTES) {
      builder.push(decoder.decode(bytes.subarray(at, at + SLICE_BYTES)));
    }
    return builder.finish("the MP3 stream decoded to no samples");
  } finally {
    decoder.free();
  }
}

/** Average the decoder's float channels into one 16-bit track. The decoders hand
 *  back planar float audio; the engine wants interleaved-free signed 16-bit. */
function floatsToInt16(channels: Float32Array[], frames: number): Int16Array {
  const out = new Int16Array(frames);
  const n = channels.length;
  if (n === 0) return out;
  if (n === 1) {
    const c = channels[0]!;
    for (let i = 0; i < frames; i++) {
      const v = Math.max(-1, Math.min(1, c[i] ?? 0));
      out[i] = Math.round(v * 32767);
    }
    return out;
  }
  for (let i = 0; i < frames; i++) {
    let sum = 0;
    for (let c = 0; c < n; c++) sum += channels[c]![i] ?? 0;
    const v = Math.max(-1, Math.min(1, sum / n));
    out[i] = Math.round(v * 32767);
  }
  return out;
}

/** True when a decoder for this container is available. Used by the endpoint to
 *  explain an unsupported upload rather than fail with a decode error. */
export function canDecode(container: string): boolean {
  return container === "webm" || container === "ogg" || container === "mp3" || container === "aac";
}

export type { DecodeResult };
