/** From whatever a client uploads to the shape the recogniser wants.
 *
 *  One function, so every entry point — the batch endpoint, the live stream, the
 *  tests — turns audio into the same thing, and a container added in one place
 *  works everywhere. The order is: read the container, decode the codec if there
 *  is one, resample, and report what happened.
 *
 *  Every container ends up as PCM. FLAC used to be handed to the engine
 *  untouched, because the engine can read it — but only up to the length of a
 *  single request, so a long FLAC recording came back truncated. Decoding it
 *  here puts it on the same windowed path as everything else. */

import {
  isSilent,
  parseWav,
  resampleTo16k,
  sniff,
  secondsOf,
  type Container,
  type Pcm,
} from "./audio";
import { decodeFlac, decodeMp3, decodeOgg, decodeWebm } from "./decode";
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

/** Said plainly, because the format arrives by default from every iPhone and
 *  Safari recorder and the endpoint cannot transcribe it. */
export const MP4_REFUSAL =
  "M4A/MP4/AAC is not supported. It is what iPhone and Safari recorders produce " +
  "by default, so re-record as WebM (browsers) or MP3 (phones), or convert it first.";

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
      return fromPcm(await decodeFlac(bytes), "flac");
    case "webm":
      return fromPcm(await decodeWebm(bytes), "webm");
    case "ogg":
      return fromPcm(await decodeOgg(bytes), "ogg");
    case "mp3":
      return fromPcm(await decodeMp3(bytes), "mp3");
    case "pcm":
      return fromPcm(rawPcm(bytes, declared), "pcm");
    case "mp4":
      throw new Error(MP4_REFUSAL);
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

/** Resample a decoded PCM buffer to the rate the recogniser is fed. */
export function toInput(decoded: Decoded): AudioInput {
  return { kind: "pcm", pcm: resampleTo16k(decoded.input.pcm) };
}

/** Seconds of audio in the input the engine will actually receive. */
export function inputSeconds(input: AudioInput): number {
  return secondsOf(input.pcm);
}
