/** Audio handling for the speech-to-text endpoint.
 *
 *  The transcription engine accepts only raw PCM and FLAC. Everything a real
 *  client actually records — a browser's WebM/Opus, a phone recorder's MP3, a
 *  desktop app's Ogg — has to be turned into that shape first. This module is
 *  that step, and it is deliberately pure: no network, no Node built-ins, no
 *  third-party code. Only the WAV/OGG/WebM *containers* are demuxed here, which
 *  is byte-shuffling that cannot rot; the codec decoders (Opus, MP3) are the one
 *  part that needs a library, and they are imported separately so a caller that
 *  sends WAV or FLAC never loads them at all.
 *
 *  The reason for the split: the endpoint's reliability should not depend on a
 *  vendor keeping a URL alive. Container parsing, resampling and silence
 *  trimming are ours, and stay ours. */

/** Mono, 16-bit PCM at a known rate — the interchange shape between the
 *  demuxer, the resampler and the engine. */
export type Pcm = { samples: Int16Array; sampleRate: number };

/** The rate the engine is fed. 16 kHz mono is what speech models want and what
 *  the engine transcribes most accurately. */
export const TARGET_RATE = 16000;

export type Container = "wav" | "flac" | "ogg" | "webm" | "mp3" | "aac" | "mp4" | "pcm" | "unknown";

/* ───────────────────────────── container sniffing ───────────────────────── */

function ascii(b: Uint8Array, at: number, s: string): boolean {
  for (let i = 0; i < s.length; i++) if (b[at + i] !== s.charCodeAt(i)) return false;
  return true;
}

export function isWav(b: Uint8Array): boolean {
  return b.length > 12 && ascii(b, 0, "RIFF") && ascii(b, 8, "WAVE");
}
export function isFlac(b: Uint8Array): boolean {
  return b.length > 4 && ascii(b, 0, "fLaC");
}

export function isOgg(b: Uint8Array): boolean {
  return b.length > 4 && ascii(b, 0, "OggS");
}
export function isWebm(b: Uint8Array): boolean {
  // EBML magic; Matroska and WebM share it.
  return b.length > 4 && b[0] === 0x1a && b[1] === 0x45 && b[2] === 0xdf && b[3] === 0xa3;
}
/** MP4-family container: `.m4a`, `.mp4`, `.aac` in a wrapper. Every ISO base
 *  media file opens with a `ftyp` box, so the brand it names tells them apart
 *  from the formats this endpoint can actually decode.
 *
 *  Recognised only so the caller gets an honest refusal. An `.m4a` upload is
 *  what an iPhone or Safari produces by default, so it arrives often, and the
 *  audio inside it is AAC. A bare AAC stream is now decoded; the wrapper is not,
 *  because lifting the audio out means walking the box tree, which is a separate
 *  job. Detecting the wrapper turns a silent empty transcript — indistinguishable
 *  from "nobody spoke" — into a message that names the format and what works. */
export function isMp4(b: Uint8Array): boolean {
  return b.length > 12 && ascii(b, 4, "ftyp");
}
/** Raw AAC in an ADTS wrapper — a `.aac` file, or the audio a recorder wrote
 *  without an MP4 container around it.
 *
 *  The sync word is twelve set bits, and the two bits after it are the layer,
 *  which is always `00` here. An MP3 frame sync is eleven set bits with a
 *  non-zero layer, so the twelve-bit test has to run first or every ADTS stream
 *  would be claimed as MP3. */
export function isAdts(b: Uint8Array): boolean {
  return b.length > 2 && b[0] === 0xff && (b[1]! & 0xf6) === 0xf0;
}
export function isMp3(b: Uint8Array): boolean {
  if (b.length < 3) return false;
  if (ascii(b, 0, "ID3")) return true;
  if (isAdts(b)) return false;
  // Frame sync: eleven set bits.
  return b[0] === 0xff && (b[1]! & 0xe0) === 0xe0;
}

/** The container a buffer holds, read from its first bytes rather than from the
 *  declared MIME type — a client that mislabels its upload should still work. */
export function sniff(bytes: Uint8Array): Container {
  if (isWav(bytes)) return "wav";
  if (isFlac(bytes)) return "flac";
  if (isOgg(bytes)) return "ogg";
  if (isWebm(bytes)) return "webm";
  // ADTS before MP3: the MP3 test accepts an ADTS sync word, so the narrower
  // twelve-bit test has to be asked first.
  if (isAdts(bytes)) return "aac";
  if (isMp3(bytes)) return "mp3";
  if (isMp4(bytes)) return "mp4";
  // No header at all: a client streaming a live microphone often sends bare
  // samples, which is exactly the shape the engine wants.
  return bytes.length >= 2 ? "pcm" : "unknown";
}

/* ─────────────────────────────── WAV ─────────────────────────────── */

/** Read a RIFF/WAVE file into mono 16-bit PCM.
 *
 *  Walks the chunk list rather than assuming a 44-byte header: encoders add
 *  `LIST`/`fact` chunks, and a fixed offset then reads metadata as audio, which
 *  the engine transcribes as noise or as nothing. */
export function parseWav(bytes: Uint8Array): Pcm | null {
  if (!isWav(bytes)) return null;
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let format = 1;
  let channels = 1;
  let sampleRate = TARGET_RATE;
  let bits = 16;
  let data: Uint8Array | null = null;

  let pos = 12;
  while (pos + 8 <= bytes.length) {
    const id = String.fromCharCode(bytes[pos]!, bytes[pos + 1]!, bytes[pos + 2]!, bytes[pos + 3]!);
    const size = view.getUint32(pos + 4, true);
    const body = pos + 8;
    if (body + size > bytes.length) break;
    if (id === "fmt ") {
      format = view.getUint16(body, true);
      channels = view.getUint16(body + 2, true) || 1;
      sampleRate = view.getUint32(body + 4, true) || TARGET_RATE;
      bits = view.getUint16(body + 14, true) || 16;
    } else if (id === "data") {
      data = bytes.subarray(body, body + size);
    }
    // Chunks are word-aligned: an odd size carries a pad byte.
    pos = body + size + (size % 2);
  }
  if (!data) return null;

  if (format === 3 && bits === 32) {
    const f = new Float32Array(data.buffer, data.byteOffset, Math.floor(data.length / 4));
    return floatToPcm(f, channels, sampleRate);
  }
  if (bits === 8) return { samples: u8ToPcm(data, channels), sampleRate };
  if (bits === 24) return { samples: s24ToPcm(data, channels), sampleRate };
  if (bits !== 16) return null;
  const s = new Int16Array(data.buffer, data.byteOffset, Math.floor(data.length / 2));
  return { samples: downmix(s, channels), sampleRate };
}

/** The header facts of a WAV, without its audio.
 *
 *  `parseWav` reads a whole file into one buffer, which is exactly what a very
 *  large upload cannot afford. This reads only the header, so the data chunk can
 *  then be streamed: `dataOffset`/`dataSize` say where the audio is and how much
 *  of it there is, and the caller walks it in pieces. Returns null when the
 *  header is incomplete, which tells a streaming caller to read more bytes. */
export type WavHeader = {
  format: number;
  channels: number;
  sampleRate: number;
  bits: number;
  dataOffset: number;
  dataSize: number;
};

export function readWavHeader(bytes: Uint8Array): WavHeader | null {
  if (!isWav(bytes)) return null;
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let format = 1;
  let channels = 1;
  let sampleRate = TARGET_RATE;
  let bits = 16;
  let pos = 12;
  while (pos + 8 <= bytes.length) {
    const id = String.fromCharCode(bytes[pos]!, bytes[pos + 1]!, bytes[pos + 2]!, bytes[pos + 3]!);
    const size = view.getUint32(pos + 4, true);
    const body = pos + 8;
    if (id === "fmt ") {
      if (body + 16 > bytes.length) return null;
      format = view.getUint16(body, true);
      channels = view.getUint16(body + 2, true) || 1;
      sampleRate = view.getUint32(body + 4, true) || TARGET_RATE;
      bits = view.getUint16(body + 14, true) || 16;
    } else if (id === "data") {
      // The declared size may exceed what has arrived; the caller clamps it to
      // the bytes it actually holds.
      return { format, channels, sampleRate, bits, dataOffset: body, dataSize: size };
    }
    // Chunks are word-aligned: an odd size carries a pad byte.
    pos = body + size + (size % 2);
  }
  return null;
}

/** Decode one piece of a WAV data chunk to mono 16-bit, for a streaming reader
 *  that never holds the whole file. Only the interleaved 16-bit case is handled
 *  here; the other bit depths are rare enough that the whole-file parser is
 *  still the right tool, and a caller falls back to it. */
export function wavChunkToMono(data: Uint8Array, channels: number): Int16Array {
  const usable = data.length - (data.length % 2);
  const interleaved = new Int16Array(
    data.buffer.slice(data.byteOffset, data.byteOffset + usable),
  );
  return channels <= 1 ? interleaved : downmix(interleaved, channels);
}

/** Average interleaved channels down to one. Speech recognition gains nothing
 *  from stereo. */
export function downmix(interleaved: Int16Array, channels: number): Int16Array {
  if (channels <= 1) return interleaved;
  const frames = Math.floor(interleaved.length / channels);
  const out = new Int16Array(frames);
  for (let i = 0; i < frames; i++) {
    let sum = 0;
    for (let c = 0; c < channels; c++) sum += interleaved[i * channels + c]!;
    out[i] = Math.max(-32768, Math.min(32767, Math.round(sum / channels)));
  }
  return out;
}

function floatToPcm(f: Float32Array, channels: number, sampleRate: number): Pcm {
  const frames = Math.floor(f.length / channels);
  const out = new Int16Array(frames);
  for (let i = 0; i < frames; i++) {
    let sum = 0;
    for (let c = 0; c < channels; c++) sum += f[i * channels + c]!;
    const v = Math.max(-1, Math.min(1, sum / channels));
    out[i] = Math.round(v * 32767);
  }
  return { samples: out, sampleRate };
}

function u8ToPcm(b: Uint8Array, channels: number): Int16Array {
  const frames = Math.floor(b.length / channels);
  const out = new Int16Array(frames);
  for (let i = 0; i < frames; i++) {
    let sum = 0;
    for (let c = 0; c < channels; c++) sum += b[i * channels + c]! - 128;
    out[i] = Math.max(-32768, Math.min(32767, Math.round((sum / channels) * 256)));
  }
  return out;
}

function s24ToPcm(b: Uint8Array, channels: number): Int16Array {
  const per = 3;
  const frames = Math.floor(b.length / (per * channels));
  const out = new Int16Array(frames);
  for (let i = 0; i < frames; i++) {
    let sum = 0;
    for (let c = 0; c < channels; c++) {
      const at = (i * channels + c) * per;
      let v = b[at]! | (b[at + 1]! << 8) | (b[at + 2]! << 16);
      if (v & 0x800000) v -= 0x1000000;
      sum += v;
    }
    out[i] = Math.max(-32768, Math.min(32767, Math.round(sum / channels / 256)));
  }
  return out;
}

/** Wrap mono 16-bit PCM in a minimal WAV container.
 *
 *  Used by the tests, so a decoded buffer can be re-fed through the WAV reader,
 *  and by a caller that saves a live window and expects a playable file. */
export function encodeWav(pcm: Pcm): Uint8Array {
  const dataBytes = pcm.samples.length * 2;
  const out = new Uint8Array(44 + dataBytes);
  const view = new DataView(out.buffer);
  const write = (at: number, s: string) => {
    for (let i = 0; i < s.length; i++) out[at + i] = s.charCodeAt(i);
  };
  write(0, "RIFF");
  view.setUint32(4, 36 + dataBytes, true);
  write(8, "WAVE");
  write(12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, pcm.sampleRate, true);
  view.setUint32(28, pcm.sampleRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  write(36, "data");
  view.setUint32(40, dataBytes, true);
  new Int16Array(out.buffer, 44).set(pcm.samples);
  return out;
}

/* ─────────────────────────── Ogg / Opus demux ─────────────────────────── */

function concat(parts: Uint8Array[]): Uint8Array {
  if (parts.length === 1) return parts[0]!;
  let total = 0;
  for (const p of parts) total += p.length;
  const out = new Uint8Array(total);
  let at = 0;
  for (const p of parts) {
    out.set(p, at);
    at += p.length;
  }
  return out;
}

/** Pull the Opus packets out of an Ogg stream.
 *
 *  A codec decoder takes one packet at a time, so the container has to be
 *  unwrapped first. Each page carries a segment table; a packet ends where a
 *  segment is shorter than 255 bytes. The leading `OpusHead` and `OpusTags`
 *  packets are metadata, not audio, and are dropped. */
export function oggOpusPackets(bytes: Uint8Array): Uint8Array[] {
  const packets: Uint8Array[] = [];
  let pending: Uint8Array[] = [];
  let pos = 0;
  while (pos + 27 <= bytes.length) {
    if (!ascii(bytes, pos, "OggS")) {
      // A truncated or re-wrapped stream can start mid-page; resync on the magic.
      const next = bytes.indexOf(0x4f, pos + 1);
      if (next < 0) break;
      pos = next;
      continue;
    }
    const segCount = bytes[pos + 26]!;
    const tableAt = pos + 27;
    const bodyAt = tableAt + segCount;
    if (bodyAt > bytes.length) break;
    let bodyLen = 0;
    for (let i = 0; i < segCount; i++) bodyLen += bytes[tableAt + i]!;
    if (bodyAt + bodyLen > bytes.length) break;

    let at = bodyAt;
    for (let i = 0; i < segCount; i++) {
      const len = bytes[tableAt + i]!;
      pending.push(bytes.subarray(at, at + len));
      at += len;
      if (len < 255) {
        packets.push(concat(pending));
        pending = [];
      }
    }
    pos = bodyAt + bodyLen;
  }
  if (pending.length) packets.push(concat(pending));
  return packets.filter((p) => !ascii(p, 0, "OpusHead") && !ascii(p, 0, "OpusTags"));
}

/** The codec an Ogg stream carries, read from its identification header.
 *
 *  Ogg is a container, not a codec: a desktop converter writes Vorbis by
 *  default. The demuxer here only knows Opus, and handing it Vorbis packets
 *  crashes the decoder wasm — a 502 that reads like an outage. Naming the codec
 *  turns that into an honest refusal. */
export function oggCodec(bytes: Uint8Array): "opus" | "vorbis" | "flac" | "unknown" {
  if (!isOgg(bytes) || bytes.length < 35) return "unknown";
  const bodyAt = 27 + bytes[26]!;
  if (bodyAt + 8 > bytes.length) return "unknown";
  if (ascii(bytes, bodyAt, "OpusHead")) return "opus";
  if (bytes[bodyAt] === 0x01 && ascii(bytes, bodyAt + 1, "vorbis")) return "vorbis";
  if (ascii(bytes, bodyAt, "fLaC") || ascii(bytes, bodyAt, "\x7fFLAC")) return "flac";
  return "unknown";
}

/** A byte range read as latin1 text, for searching EBML string elements. */
function asciiOf(b: Uint8Array, from: number, to: number): string {
  let out = "";
  for (let i = from; i < to; i++) out += String.fromCharCode(b[i]!);
  return out;
}

/* ─────────────────────────── WebM / Opus demux ─────────────────────────── */

/** Read an EBML variable-length integer.
 *
 *  The width is the number of leading zero bits of the first byte, and
 *  `keepMarker` decides whether that length byte is part of the value: element
 *  IDs keep it, sizes strip it. */
function readVint(
  b: Uint8Array,
  at: number,
  keepMarker: boolean,
): { value: number; next: number } | null {
  if (at >= b.length) return null;
  const first = b[at]!;
  if (first === 0) return null;
  let length = 1;
  let mask = 0x80;
  while (length <= 8 && !(first & mask)) {
    length++;
    mask >>= 1;
  }
  if (length > 8 || at + length > b.length) return null;
  let value = keepMarker ? first : first & (mask - 1);
  for (let i = 1; i < length; i++) value = value * 256 + b[at + i]!;
  // All-ones size bits mean "unknown length", which only the top level uses.
  if (!keepMarker && value === Math.pow(2, 7 * length) - 1) return { value: -1, next: at + length };
  return { value, next: at + length };
}

/** One block's audio frame, or null when it is laced or too short to hold one.
 *
 *  Laced blocks are rare from a microphone and are skipped rather than guessed
 *  at: a mis-split frame decodes to a click, and a click transcribes as a wrong
 *  word, which is worse than a slightly shorter transcript. */
function frameFromBlock(b: Uint8Array, at: number, end: number): Uint8Array | null {
  const track = readVint(b, at, false);
  if (!track) return null;
  const timeAt = track.next;
  if (timeAt + 3 > end) return null;
  const flags = b[timeAt + 2]!;
  const lacing = (flags & 0x06) >> 1;
  if (lacing !== 0) return null;
  const dataAt = timeAt + 3;
  if (dataAt >= end) return null;
  return b.subarray(dataAt, end);
}

/** Pull the Opus frames out of a WebM/Matroska stream.
 *
 *  This is the shape a browser's `MediaRecorder` produces, so it is the one
 *  container a microphone client sends by default. Only `SimpleBlock` and
 *  `Block` payloads carry audio. The tree is walked only as deep as those live —
 *  Segment, then Cluster, then Block — because a full EBML walk would cost more
 *  than the decode it feeds. */
export function webmCodec(bytes: Uint8Array): "opus" | "vorbis" | "unknown" {
  // The `CodecID` sits in the header, so a bounded search over the first
  // kilobytes settles it without walking the whole tree.
  const head = asciiOf(bytes, 0, Math.min(bytes.length, 8192));
  if (head.includes("A_OPUS")) return "opus";
  if (head.includes("A_VORBIS")) return "vorbis";
  return "unknown";
}

export function webmOpusFrames(bytes: Uint8Array): Uint8Array[] {
  // A WebM can carry Vorbis too, and its packets would crash the Opus decoder.
  if (webmCodec(bytes) === "vorbis")
    throw new Error("WebM Vorbis is not supported; only WebM Opus is");

  const frames: Uint8Array[] = [];
  const SEGMENT = 0x18538067;
  const CLUSTER = 0x1f43b675;
  const SIMPLE_BLOCK = 0xa3;
  const BLOCK_GROUP = 0xa0;
  const BLOCK = 0xa1;

  const walk = (from: number, to: number): void => {
    let pos = from;
    while (pos < to) {
      const id = readVint(bytes, pos, true);
      if (!id) break;
      const size = readVint(bytes, id.next, false);
      if (!size) break;
      const bodyAt = size.next;
      if (bodyAt > to) break;
      const bodyEnd = size.value < 0 ? to : Math.min(to, bodyAt + size.value);

      if (id.value === SEGMENT || id.value === CLUSTER) {
        walk(bodyAt, bodyEnd);
      } else if (id.value === SIMPLE_BLOCK) {
        const frame = frameFromBlock(bytes, bodyAt, bodyEnd);
        if (frame) frames.push(frame);
      } else if (id.value === BLOCK_GROUP) {
        // A BlockGroup wraps a Block plus its duration; find the Block inside.
        let inner = bodyAt;
        while (inner < bodyEnd) {
          const bid = readVint(bytes, inner, true);
          if (!bid) break;
          const bsize = readVint(bytes, bid.next, false);
          if (!bsize) break;
          const bAt = bsize.next;
          const bEnd = bsize.value < 0 ? bodyEnd : Math.min(bodyEnd, bAt + bsize.value);
          if (bid.value === BLOCK) {
            const frame = frameFromBlock(bytes, bAt, bEnd);
            if (frame) frames.push(frame);
          }
          if (bsize.value < 0) break;
          inner = bEnd;
        }
      }
      if (size.value < 0) break;
      pos = bodyEnd;
    }
  };
  walk(0, bytes.length);
  return frames;
}

/* ──────────────────────────── resampling ──────────────────────────── */

/** Resample mono 16-bit PCM to 16 kHz.
 *
 *  Averaging whole input samples per output sample is a box filter, which is a
 *  good enough anti-alias for speech and, unlike dropping samples, does not fold
 *  high frequencies down into the band the recogniser cares about. A
 *  non-integer ratio is interpolated between neighbours. */
export function resampleTo16k(pcm: Pcm): Pcm {
  const { samples, sampleRate } = pcm;
  if (sampleRate === TARGET_RATE) return pcm;
  if (sampleRate <= 0 || samples.length === 0) return { samples, sampleRate: TARGET_RATE };

  const ratio = sampleRate / TARGET_RATE;
  const outLen = Math.max(1, Math.floor(samples.length / ratio));
  const out = new Int16Array(outLen);

  if (Number.isInteger(ratio)) {
    const step = ratio;
    for (let i = 0; i < outLen; i++) {
      let sum = 0;
      const base = Math.floor(i * step);
      for (let k = 0; k < step; k++) sum += samples[base + k] ?? 0;
      out[i] = Math.round(sum / step);
    }
    return { samples: out, sampleRate: TARGET_RATE };
  }

  for (let i = 0; i < outLen; i++) {
    const at = i * ratio;
    const i0 = Math.floor(at);
    const frac = at - i0;
    const a = samples[i0] ?? 0;
    const b = samples[i0 + 1] ?? a;
    out[i] = Math.round(a + (b - a) * frac);
  }
  return { samples: out, sampleRate: TARGET_RATE };
}

/** True when the buffer is digital silence, or near it.
 *
 *  Sending silence costs a round trip and returns nothing, and in a live stream
 *  that happens between every phrase. Skipping it is what keeps a
 *  second-by-second loop from spending most of its calls on nothing. */
export function isSilent(pcm: Pcm, threshold = 220): boolean {
  const s = pcm.samples;
  if (s.length === 0) return true;
  // Sample a stride rather than every value: a long window costs less to judge.
  const stride = Math.max(1, Math.floor(s.length / 4000));
  let peak = 0;
  for (let i = 0; i < s.length; i += stride) {
    const v = Math.abs(s[i]!);
    if (v > peak) peak = v;
  }
  return peak < threshold;
}

/** Root-mean-square level, 0..1. Lets a client tell a silent microphone from a
 *  working one, which is the difference between "not working" and "too quiet". */
export function level(pcm: Pcm): number {
  const s = pcm.samples;
  if (s.length === 0) return 0;
  const stride = Math.max(1, Math.floor(s.length / 8000));
  let sum = 0;
  let n = 0;
  for (let i = 0; i < s.length; i += stride) {
    const v = s[i]! / 32768;
    sum += v * v;
    n++;
  }
  return n ? Math.sqrt(sum / n) : 0;
}

/** Join consecutive PCM buffers into one, for a growing live window. */
export function joinPcm(parts: Pcm[]): Pcm {
  const rate = parts[0]?.sampleRate ?? TARGET_RATE;
  let total = 0;
  for (const p of parts) total += p.samples.length;
  const out = new Int16Array(total);
  let at = 0;
  for (const p of parts) {
    out.set(p.samples, at);
    at += p.samples.length;
  }
  return { samples: out, sampleRate: rate };
}

/** Keep only the newest `seconds` of audio, so a live window cannot grow without
 *  bound. A caller that streams for an hour must not accumulate an hour. */
export function keepNewest(pcm: Pcm, seconds: number): Pcm {
  const want = Math.floor(seconds * pcm.sampleRate);
  if (pcm.samples.length <= want) return pcm;
  return { samples: pcm.samples.subarray(pcm.samples.length - want), sampleRate: pcm.sampleRate };
}

/** How many seconds of audio a PCM buffer holds. */
export function secondsOf(pcm: Pcm): number {
  return pcm.sampleRate > 0 ? pcm.samples.length / pcm.sampleRate : 0;
}
