/** Codec decoding for the speech-to-text endpoint — the one layer that needs a
 *  library.
 *
 *  Container parsing lives in `audio.ts` and is ours. Turning compressed frames
 *  into samples needs a real decoder, and writing an Opus or MP3 decoder from
 *  scratch would be a decade of work. So exactly one small, MIT-licensed,
 *  self-contained WebAssembly decoder is used, and it is loaded lazily: a client
 *  that sends WAV or FLAC — which is what a careful client does, and what our
 *  own browser recorder produces when configured for it — never pays for it.
 *
 *  Both packages are single-purpose and vendor-neutral:
 *    - `mpg123-decoder` — MP3, the format phone and desktop recorders produce.
 *    - `opus-decoder`   — Opus, the format browsers produce.
 *  Neither talks to a network, neither needs a key, and both are wasm blobs
 *  bundled with the app, so there is no CDN to disappear.
 *
 *  Each decoder is handed an already-compiled wasm module from `./wasm`, because
 *  their own loader compiles wasm at runtime and the Workers runtime forbids
 *  that. See `./wasm/index.ts`. */

import type { Pcm } from "./audio";
import { oggCodec, oggOpusPackets, webmOpusFrames } from "./audio";
import { flacModule, mpg123Module, opusModule } from "./wasm";

/** Decoded frames at the codec's own rate; the caller resamples. */
type DecodeResult = { samples: Int16Array; sampleRate: number };

/** Decode a WebM/Opus stream — what a browser's MediaRecorder emits. */
export async function decodeWebm(bytes: Uint8Array): Promise<Pcm> {
  const frames = webmOpusFrames(bytes);
  if (!frames.length) throw new Error("no audio frames found in the WebM stream");
  return decodeOpusFrames(frames);
}

/** Decode an Ogg/Opus stream — what a desktop or Android recorder emits. */
export async function decodeOgg(bytes: Uint8Array): Promise<Pcm> {
  // Ogg carries Vorbis as often as Opus, and Vorbis packets fed to the Opus
  // decoder crash its wasm. Refuse by name instead of 502.
  const codec = oggCodec(bytes);
  if (codec !== "opus" && codec !== "unknown")
    throw new Error(`Ogg ${codec} is not supported; only Ogg Opus is`);
  const packets = oggOpusPackets(bytes);
  if (!packets.length) throw new Error("no audio packets found in the Ogg stream");
  return decodeOpusFrames(packets);
}

async function decodeOpusFrames(frames: Uint8Array[]): Promise<Pcm> {
  const { OpusDecoder } = await import("opus-decoder");
  // Hand over the build-time module so the library never compiles wasm itself,
  // which the Workers runtime refuses to do.
  OpusDecoder.module = opusModule;
  const decoder = new OpusDecoder();
  await decoder.ready;
  try {
    const result = decoder.decodeFrames(frames);
    const channels: Float32Array[] = result.channelData;
    const rate = result.sampleRate;
    const frames2 = result.samplesDecoded;
    if (!frames2) throw new Error("the Opus stream decoded to no samples");
    return { samples: floatsToInt16(channels, frames2), sampleRate: rate };
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
    const result = await decoder.decodeFile(bytes);
    const channels: Float32Array[] = result.channelData;
    const frames = result.samplesDecoded;
    if (!frames) throw new Error("the FLAC stream decoded to no samples");
    return { samples: floatsToInt16(channels, frames), sampleRate: result.sampleRate };
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
    const result = decoder.decode(bytes);
    const channels: Float32Array[] = result.channelData;
    const frames = result.samplesDecoded;
    if (!frames) throw new Error("the MP3 stream decoded to no samples");
    return { samples: floatsToInt16(channels, frames), sampleRate: result.sampleRate };
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
  return container === "webm" || container === "ogg" || container === "mp3";
}

export type { DecodeResult };
