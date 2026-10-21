/** From whatever a client uploads to the shape the recogniser wants.
 *
 *  One function, so every entry point — the batch endpoint, the live stream, the
 *  tests — turns audio into the same thing, and a container added in one place
 *  works everywhere. The order is: read the container, decode the codec if there
 *  is one, resample, and report what happened.
 *
 *  FLAC is the exception. The engine reads it natively, so decoding and
 *  re-encoding a lossless container would cost time and quality for nothing; it
 *  is passed through untouched, and only measured. */

import {
  isSilent,
  parseWav,
  resampleTo16k,
  sniff,
  secondsOf,
  type Container,
  type Pcm,
} from "./audio";
import { decodeMp3, decodeOgg, decodeWebm } from "./decode";
import type { AudioInput } from "./engine";

export type Decoded = {
  /** The audio the engine will be given. */
  input: AudioInput;
  container: Container;
  /** Duration in seconds, before any resampling. */
  seconds: number;
  /** True when the buffer held no audible signal. Not an error: a client that
   *  opened its microphone and said nothing sends exactly this. */
  silent: boolean;
};

/** Decode any supported container to what the recogniser takes.
 *
 *  `declared` is the caller's MIME type, used only for raw PCM, whose sample rate
 *  cannot be sniffed from the bytes — a headerless stream has no rate field, so
 *  the caller's `audio/l16; rate=8000` is the only clue. */
export async function decodeContainer(
  bytes: Uint8Array,
  container: Container = sniff(bytes),
  declared = "",
): Promise<Decoded> {
  switch (container) {
    case "wav": {
      const parsed = parseWav(bytes);
      if (!parsed) throw new Error("the WAV container could not be read");
      return fromPcm(parsed, "wav");
    }
    case "flac":
      return {
        input: { kind: "flac", bytes },
        container: "flac",
        seconds: estimateFlacSeconds(bytes),
        silent: false,
      };
    case "webm":
      return fromPcm(await decodeWebm(bytes), "webm");
    case "ogg":
      return fromPcm(await decodeOgg(bytes), "ogg");
    case "mp3":
      return fromPcm(await decodeMp3(bytes), "mp3");
    case "pcm":
      return fromPcm(rawPcm(bytes, declared), "pcm");
    default:
      throw new Error("unsupported audio format");
  }
}

/** Wrap bare PCM, taking the sample rate from the caller's MIME parameters.
 *
 *  `audio/l16; rate=8000` is what a phone sends; `audio/pcm` with no rate is
 *  assumed to be 16 kHz, which is what a browser's AudioWorklet produces when it
 *  is configured as ours is. */
function rawPcm(bytes: Uint8Array, declared: string): Pcm {
  const match = /rate\s*=\s*(\d+)/i.exec(declared);
  const rate = match ? Number(match[1]) : 16000;
  // The byte count has to be even to be read as 16-bit samples.
  const usable = bytes.length - (bytes.length % 2);
  const view = new DataView(bytes.buffer, bytes.byteOffset, usable);
  const samples = new Int16Array(usable / 2);
  for (let i = 0; i < samples.length; i++) samples[i] = view.getInt16(i * 2, true);
  return { samples, sampleRate: rate };
}

function fromPcm(pcm: Pcm, container: Container): Decoded {
  return {
    input: { kind: "pcm", pcm },
    container,
    seconds: secondsOf(pcm),
    silent: pcm.samples.length === 0 ? true : isSilent(pcm),
  };
}

/** Duration of a FLAC stream, read from its STREAMINFO block.
 *
 *  STREAMINFO is the first metadata block and holds the total sample count and
 *  the sample rate as two 20-bit fields. Reading them is four lines and avoids
 *  reporting every FLAC upload as zero seconds. */
function estimateFlacSeconds(bytes: Uint8Array): number {
  // "fLaC" + a 4-byte block header, then the 34-byte STREAMINFO body.
  if (bytes.length < 4 + 4 + 34) return 0;
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const body = 8;
  // Sample rate: 20 bits starting at byte 10 of the body. Total samples: 36 bits
  // starting 4 bits into byte 13.
  const rate =
    (view.getUint8(body + 10) << 12) |
    (view.getUint8(body + 11) << 4) |
    (view.getUint8(body + 12) >> 4);
  const high = view.getUint8(body + 13) & 0x0f;
  const samples = high * 2 ** 32 + view.getUint32(body + 14, false);
  if (!rate || !samples) return 0;
  return samples / rate;
}

/** Resample a decoded PCM buffer to the rate the recogniser is fed. FLAC passes
 *  through untouched, so it returns its input unchanged. */
export function toInput(decoded: Decoded): AudioInput {
  if (decoded.input.kind === "flac") return decoded.input;
  return { kind: "pcm", pcm: resampleTo16k(decoded.input.pcm) };
}

/** Seconds of audio in the input the engine will actually receive. */
export function inputSeconds(input: AudioInput): number {
  return input.kind === "pcm" ? secondsOf(input.pcm) : 0;
}
