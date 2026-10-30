/** Live transcription: audio arrives while the speaker is still speaking.
 *
 *  The batch path waits for a whole recording. This path takes a stream of audio
 *  and produces text as it goes, which is what a live conversation needs.
 *
 *  How it works, and why this shape:
 *
 *    - Audio is accumulated into a *segment*. When the segment reaches
 *      `segmentSeconds`, it is transcribed in full and its text is committed.
 *    - While a segment is still filling, it is re-transcribed every
 *      `partialSeconds` and the result is reported as a partial. That is what
 *      makes words appear as they are spoken rather than in four-second jumps.
 *    - When a segment closes, the last `overlapSeconds` of it carry into the
 *      next one. Without that overlap a word straddling the boundary is cut in
 *      half and lost; with it, the word is heard whole by the next segment and
 *      the duplicate is trimmed.
 *
 *  Committed text is never rewritten, so a client can append partials to a fixed
 *  prefix and the display only ever grows. That is the difference between live
 *  captions and a line that flickers.
 *
 *  Only PCM is accepted here. A compressed container cannot be cut at an
 *  arbitrary byte — a WebM or Opus frame has to be decoded as a unit — so a
 *  client that wants live text sends raw samples, which a browser produces
 *  directly from an AudioWorklet. A client that can only record to a file uses
 *  the batch mode of the same endpoint. */

import { joinPcm, keepNewest, type Pcm } from "./audio";
import { recognize, type AudioInput } from "./engine";

export type LiveOptions = {
  /** Sample rate of the incoming PCM. */
  rate: number;
  /** The locale being spoken, e.g. "bn-BD". Required: the recogniser does not
   *  detect language, and guessing it produces confident nonsense. */
  language: string;
  /** Seconds per committed segment. */
  segmentSeconds?: number;
  /** Seconds of new audio between partial updates. */
  partialSeconds?: number;
  /** Seconds of audio carried from one segment into the next. */
  overlapSeconds?: number;
  signal?: AbortSignal;
};

/** One thing that happened, for the client to render or act on. */
export type LiveEvent =
  | { type: "ready"; rate: number; language: string }
  | { type: "partial"; text: string }
  | { type: "segment"; text: string; seconds: number }
  | { type: "done"; text: string; segments: number; seconds: number };

const DEFAULTS = { segmentSeconds: 4, partialSeconds: 1.2, overlapSeconds: 0.4 };

/** Turn a stream of raw bytes into a stream of 16-bit samples, keeping whatever
 *  half-sample is left over at a chunk boundary. A chunk can end on an odd byte,
 *  and dropping that byte would shift every later sample by one and turn the rest
 *  of the audio into noise. */
export async function* toSamples(
  source: ReadableStream<Uint8Array>,
  signal?: AbortSignal,
): AsyncGenerator<Int16Array> {
  const reader = source.getReader();
  let carry = new Uint8Array(0);
  try {
    for (;;) {
      if (signal?.aborted) break;
      const { value, done } = await reader.read();
      if (done) break;
      if (!value || value.length === 0) continue;

      let bytes: Uint8Array;
      if (carry.length) {
        bytes = new Uint8Array(carry.length + value.length);
        bytes.set(carry, 0);
        bytes.set(value, carry.length);
      } else {
        bytes = value;
      }
      const usable = bytes.length - (bytes.length % 2);
      carry = usable < bytes.length ? bytes.slice(usable) : new Uint8Array(0);
      if (usable === 0) continue;

      const view = new DataView(bytes.buffer, bytes.byteOffset, usable);
      const samples = new Int16Array(usable / 2);
      for (let i = 0; i < samples.length; i++) samples[i] = view.getInt16(i * 2, true);
      yield samples;
    }
  } finally {
    reader.releaseLock?.();
  }
}

/** Transcribe a live PCM stream, yielding events as text becomes available.
 *
 *  The generator is driven by the caller, so back-pressure is natural: the
 *  network read waits while a transcription is in flight. */
export async function* liveTranscript(
  source: ReadableStream<Uint8Array>,
  options: LiveOptions,
): AsyncGenerator<LiveEvent> {
  const segmentSeconds = options.segmentSeconds ?? DEFAULTS.segmentSeconds;
  const partialSeconds = options.partialSeconds ?? DEFAULTS.partialSeconds;
  const overlapSeconds = options.overlapSeconds ?? DEFAULTS.overlapSeconds;
  const rate = options.rate > 0 ? options.rate : 16000;

  yield { type: "ready", rate, language: options.language };

  let committed = "";
  let segments = 0;
  let totalSamples = 0;
  const language = options.language;
  let pending: Int16Array[] = [];
  let pendingLength = 0;
  let samplesSincePartial = 0;
  let busy = false;

  const segmentSamples = Math.max(rate, Math.floor(segmentSeconds * rate));
  const partialSamples = Math.max(rate / 4, Math.floor(partialSeconds * rate));
  const overlapSamples = Math.max(0, Math.floor(overlapSeconds * rate));

  /** Transcribe one buffer and return its text, or "" when it holds no speech.
   *
   *  One language, one call. A live stream re-transcribes every second or so, so
   *  asking several languages per window would multiply the load for a guess
   *  that is wrong more often than right — and the caller knows which language
   *  the person is speaking, which is better information than any detector. */
  const transcribe = async (pcm: Pcm): Promise<string> => {
    const input: AudioInput = { kind: "pcm", pcm };
    const one = await recognize(input, language, options.signal);
    return one.text.trim();
  };

  const currentPcm = (): Pcm => ({
    samples: joinPcm(pending.map((s) => ({ samples: s, sampleRate: rate }))).samples,
    sampleRate: rate,
  });

  /** Fold a fresh transcript into the committed text and return only what it
   *  added. The overlap that carries a word across a segment boundary makes the
   *  recogniser hear that word a second time, so a plain join would print it
   *  twice — `alignAddition` finds the longest suffix of what is committed that
   *  is also a prefix of the fresh text and keeps only what follows. */
  const merge = (text: string): string => {
    const added = alignAddition(committed, text);
    if (added) committed = `${committed} ${added}`.replace(/\s+/g, " ").trim();
    return added;
  };

  const commit = async (): Promise<LiveEvent[]> => {
    const out: LiveEvent[] = [];
    const pcm = currentPcm();
    const text = await transcribe(pcm);
    if (merge(text)) segments++;
    // Carry the tail so a word on the boundary is heard whole by the next
    // segment, then report the new committed text.
    const tail = keepNewest(pcm, overlapSeconds).samples;
    pending = tail.length ? [tail] : [];
    pendingLength = tail.length;
    out.push({
      type: "segment",
      text: committed,
      seconds: Number((pcm.samples.length / rate).toFixed(2)),
    });
    out.push({ type: "partial", text: committed });
    return out;
  };

  for await (const samples of toSamples(source, options.signal)) {
    if (options.signal?.aborted) break;
    pending.push(samples);
    pendingLength += samples.length;
    totalSamples += samples.length;
    samplesSincePartial += samples.length;

    if (pendingLength >= segmentSamples) {
      busy = true;
      try {
        for (const event of await commit()) yield event;
      } finally {
        busy = false;
      }
      samplesSincePartial = 0;
      continue;
    }

    if (!busy && samplesSincePartial >= partialSamples && pendingLength > rate / 2) {
      busy = true;
      try {
        const pcm = currentPcm();
        const text = await transcribe(pcm);
        const added = text ? alignAddition(committed, text) : "";
        yield {
          type: "partial",
          text: added ? `${committed} ${added}`.replace(/\s+/g, " ").trim() : committed,
        };
      } finally {
        busy = false;
      }
      samplesSincePartial = 0;
    }
  }

  // Flush whatever is left: a speaker who stops mid-segment still gets their
  // last words.
  if (pendingLength > rate / 4) {
    const pcm = currentPcm();
    const text = await transcribe(pcm);
    if (merge(text)) segments++;
  }
  yield {
    type: "done",
    text: committed,
    segments,
    seconds: Number((totalSamples / rate).toFixed(2)),
  };
}

/** How a live stream will be cut, for a client that wants to plan its buffer. */
export function segmentPlan(
  rate: number,
  segmentSeconds = DEFAULTS.segmentSeconds,
  partialSeconds = DEFAULTS.partialSeconds,
): { segmentSamples: number; partialSamples: number; bytesPerSecond: number } {
  const safeRate = rate > 0 ? rate : 16000;
  return {
    segmentSamples: Math.floor(segmentSeconds * safeRate),
    partialSamples: Math.floor(partialSeconds * safeRate),
    bytesPerSecond: safeRate * 2,
  };
}

/** Strip whitespace, keeping each surviving character's index in the original. */
function compact(text: string): { text: string; index: number[] } {
  let out = "";
  const index: number[] = [];
  for (let i = 0; i < text.length; i++) {
    if (/\s/.test(text[i]!)) continue;
    out += text[i];
    index.push(i);
  }
  return { text: out, index };
}

/** The part of a fresh transcript that the caller does not already have.
 *
 *  A rolling window loses its first word to the recogniser as it slides — the
 *  audio before that word is no longer there to prime it — so a later transcript
 *  can differ from the committed text in the middle and not only at the end. A
 *  plain prefix check then fails and the whole window is re-emitted, which
 *  duplicates words on screen. So the longest suffix of the committed text that
 *  is also a prefix of the fresh text is found and everything past it is the
 *  addition. Whitespace is ignored in the comparison, because the recogniser is
 *  not consistent about where it puts a space; the addition is still sliced out
 *  of the fresh text with its own spacing intact. */
export function alignAddition(committed: string, fresh: string): string {
  const c = committed.trim();
  const f = fresh.trim();
  if (!c) return f;
  if (!f) return "";
  if (f.startsWith(c)) return f.slice(c.length);

  const cf = compact(c);
  const ff = compact(f);
  // The fresh window is shorter than what the caller already has: the window
  // slid back, and there is nothing new to add.
  if (cf.text.startsWith(ff.text)) return "";

  const max = Math.min(cf.text.length, ff.text.length);
  for (let len = max; len > 0; len--) {
    if (ff.text.startsWith(cf.text.slice(cf.text.length - len))) {
      if (len >= ff.text.length) return "";
      // Slice from just after the matched suffix's last character, so the space
      // that separates the addition from what precedes it is kept. Slicing from
      // the addition's own first character would drop it and run two words
      // together when the client appends.
      const from = ff.index[len - 1]! + 1;
      return f.slice(from);
    }
  }
  return f;
}
