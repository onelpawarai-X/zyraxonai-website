/** From whatever a client uploads to the shape the recogniser wants.
 *
 *  One function, so every entry point — the batch endpoint, the live stream, the
 *  tests — turns audio into the same thing, and a container added in one place
 *  works everywhere. The order is: read the container, decode the codec if there
 *  is one, resample, and report what happened.
 *
 *  Every container ends up as PCM. FLAC used to be handed to the engine
 *  untouched, because the engine can read it — but with a hard-coded 16 kHz rate
 *  the engine took on trust, so a 22 050 Hz FLAC (ffmpeg's default) produced an
 *  empty transcript. Decoding it here puts it on the same windowed path as
 *  everything else and reports the rate the file actually carries. */

import {
  isSilent,
  parseWav,
  readWavHeader,
  resampleTo16k,
  sniff,
  secondsOf,
  wavChunkToMono,
  TARGET_RATE,
  type Container,
  type Pcm,
} from "./audio";
import {
  decodeAac,
  decodeFlac,
  decodeMp3,
  decodeOgg,
  decodeVorbis,
  decodeWebm,
  streamDecoderFor,
} from "./decode";
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
 *  Safari recorder and the endpoint cannot transcribe it. The audio inside is
 *  AAC, which is decoded when it arrives as a bare ADTS stream; what is missing
 *  is the MP4 demuxer that would lift it out of the wrapper. */
export const MP4_REFUSAL =
  "M4A/MP4 is not supported: the audio inside is AAC, but the MP4 wrapper is not " +
  "unpacked. Send raw AAC (.aac) instead, or re-record as WebM (browsers) or MP3 " +
  "(phones), or convert it first.";

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
    case "aac":
      return fromPcm(await decodeAac(bytes), "aac");
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

/** Seconds of audio in a window the recogniser is sent.
 *
 *  The batch endpoint imports this rather than keeping its own copy: the
 *  streaming decoder and the whole-file slicer must cut at the same length, or
 *  a recording transcribed from its stream and the same recording transcribed
 *  from memory would be joined from different pieces. A window is sized in the
 *  *source* rate's samples and resampled after, so this is a duration, not a
 *  count. */
export const WINDOW_SECONDS = 30;

/** The audio of one window, already mono and resampled to the rate the
 *  recogniser is fed. */
export type Window = { samples: Int16Array; sampleRate: number };

/** Where the audio starts and how big each sample is, for a container whose
 *  data can be walked without decoding it — a WAV, or bare PCM. Null for every
 *  format that needs a codec. */
type PcmLayout = { dataOffset: number; dataSize: number; channels: number; sampleRate: number };

function pcmLayout(bytes: Uint8Array, container: Container, declared: string): PcmLayout | null {
  if (container === "wav") {
    const header = readWavHeader(bytes);
    // 16-bit is the only depth the streaming reader handles; anything else goes
    // through the whole-file parser, which is fine for the small files those
    // depths come in.
    if (!header || header.bits !== 16 || header.format === 3) return null;
    return {
      dataOffset: header.dataOffset,
      dataSize: Math.min(header.dataSize, bytes.length - header.dataOffset),
      channels: header.channels,
      sampleRate: header.sampleRate,
    };
  }
  if (container === "pcm") {
    const match = /rate\s*=\s*(\d+)/i.exec(declared);
    return {
      dataOffset: 0,
      dataSize: bytes.length,
      channels: 1,
      sampleRate: match ? Number(match[1]) : 16000,
    };
  }
  return null;
}

/** The audio of `bytes` as a series of ~`WINDOW_SECONDS` windows.
 *
 *  This is what makes a very large recording work. Decoding the whole file and
 *  then slicing it holds the entire recording as PCM — a hundred-megabyte MP3 is
 *  well over an hour, which is hundreds of megabytes of samples — and the Worker
 *  heap is gone long before the first window is sent. Producing windows lazily
 *  means one window is live at a time, so the peak is a function of the window
 *  length rather than the recording's.
 *
 *  WAV and raw PCM need no codec, so their data is read in slices directly;
 *  everything else is decoded by the streaming decoder for its container. */
export async function* audioChunks(
  bytes: Uint8Array,
  container: Container,
  declared = "",
): AsyncGenerator<Window> {
  const layout = pcmLayout(bytes, container, declared);
  if (layout) {
    yield* pcmWindows(bytes, layout);
    return;
  }

  const decode = streamDecoderFor(container);
  if (!decode) {
    // FLAC has a streaming decoder, so this only covers a container the sniffer
    // named but no decoder knows — refused rather than decoded wrongly.
    throw new Error(`${container} cannot be streamed`);
  }

  // A decoder hands back slices whose size it chooses, not ours, so slices are
  // packed into windows until a window is full and only then resampled and
  // yielded. Resampling per window rather than per slice keeps the sample count
  // exact at the boundaries.
  // The decoder's own rate, not the recogniser's: the slices are packed while
  // still at the source rate, so a window is `WINDOW_SECONDS` of source audio
  // and only then resampled. Sizing the window in target samples here would
  // make it a fraction of a window for any rate above 16 kHz.
  let rate = 0;
  let perWindow = 0;
  let carried: Int16Array[] = [];
  let held = 0;
  let tail: Int16Array = new Int16Array(0);

  const pack = (mono: Int16Array): void => {
    if (tail.length) {
      const joined = new Int16Array(tail.length + mono.length);
      joined.set(tail, 0);
      joined.set(mono, tail.length);
      mono = joined;
      tail = new Int16Array(0);
    }
    let at = 0;
    while (at + perWindow <= mono.length) {
      carried.push(mono.subarray(at, at + perWindow));
      held += perWindow;
      at += perWindow;
    }
    if (at < mono.length) tail = mono.subarray(at);
  };

  for await (const chunk of decode(bytes)) {
    if (!rate) {
      rate = chunk.sampleRate;
      perWindow = WINDOW_SECONDS * rate;
    }
    pack(chunk.samples);
    if (held >= perWindow) {
      yield { samples: resampleTo16k({ samples: joinParts(carried, held), sampleRate: rate }).samples, sampleRate: TARGET_RATE };
      carried = [];
      held = 0;
    }
  }
  // Whatever is left: the carried windows and the sub-window tail.
  if (tail.length) {
    carried.push(tail);
    held += tail.length;
  }
  if (held) {
    yield { samples: resampleTo16k({ samples: joinParts(carried, held), sampleRate: rate }).samples, sampleRate: TARGET_RATE };
  }
}

/** Windows straight out of a headerless or WAV buffer, with no codec involved. */
function* pcmWindows(bytes: Uint8Array, layout: PcmLayout): Generator<Window> {
  const bytesPerFrame = layout.channels * 2;
  const perWindow = WINDOW_SECONDS * layout.sampleRate;
  const windowBytes = perWindow * bytesPerFrame;
  const end = Math.min(bytes.length, layout.dataOffset + layout.dataSize);
  // A stride that is a whole number of frames, so a window never splits one.
  const stride = Math.floor(windowBytes / bytesPerFrame) * bytesPerFrame || bytesPerFrame;

  for (let at = layout.dataOffset; at < end; at += stride) {
    const slice = bytes.subarray(at, Math.min(end, at + stride));
    const mono = wavChunkToMono(slice, layout.channels);
    yield { samples: resampleTo16k({ samples: mono, sampleRate: layout.sampleRate }).samples, sampleRate: TARGET_RATE };
  }
}

function joinParts(parts: Int16Array[], total: number): Int16Array {
  if (parts.length === 1) return parts[0]!;
  const out = new Int16Array(total);
  let at = 0;
  for (const part of parts) {
    out.set(part, at);
    at += part.length;
  }
  return out;
}

/** True when this container's audio can be produced window by window without
 *  holding the whole recording. WAV and bare PCM need no codec, and every other
 *  decodable container has a streaming decoder. */
export function canStream(container: Container): boolean {
  if (container === "wav" || container === "pcm") return true;
  return streamDecoderFor(container) !== null;
}

/** Resample a decoded PCM buffer to the rate the recogniser is fed. */
export function toInput(decoded: Decoded): AudioInput {
  return { kind: "pcm", pcm: resampleTo16k(decoded.input.pcm) };
}

/** Seconds of audio in the input the engine will actually receive. */
export function inputSeconds(input: AudioInput): number {
  return secondsOf(input.pcm);
}
