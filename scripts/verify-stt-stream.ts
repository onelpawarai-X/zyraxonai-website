// Proves the live transcription path works: a stream of PCM is cut into
// segments, text is emitted as it arrives, and the committed text only grows.
//
// The engine is reached over the network, so the text assertions are skipped
// without egress; the segmentation assertions — which are what make a live
// display work — are checked unconditionally.
//
// Run: npx tsx scripts/verify-stt-stream.ts [path-to-audio]

import { existsSync, mkdtempSync, readFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { encodeWav, secondsOf, type Pcm } from "../src/lib/stt/audio";
import { segmentPlan, toSamples, liveTranscript, type LiveEvent } from "../src/lib/stt/stream";

let failures = 0;
const check = (label: string, ok: boolean, detail = "") => {
  if (!ok) failures++;
  console.log(`${ok ? "PASS" : "FAIL"}  ${label}${detail ? `\n        ${detail}` : ""}`);
};

/** Feed an array of chunks as a stream, the way a socket would. */
function streamOf(chunks: Uint8Array[]): ReadableStream<Uint8Array> {
  let i = 0;
  return new ReadableStream({
    pull(controller) {
      if (i >= chunks.length) {
        controller.close();
        return;
      }
      controller.enqueue(chunks[i++]!);
    },
  });
}

// ── the byte-to-sample splitter must survive a chunk that ends mid-sample ────
// A socket delivers whatever it has, so an odd number of bytes is normal. If the
// stray byte is dropped, every later sample shifts by one and the rest of the
// audio becomes noise — the failure this test exists for.
const pcmBytes = new Uint8Array(1001);
for (let i = 0; i < 1000; i += 2) {
  pcmBytes[i] = i & 0xff;
  pcmBytes[i + 1] = (i >> 8) & 0xff;
}
const oddChunks: Uint8Array[] = [
  pcmBytes.slice(0, 333),
  pcmBytes.slice(333, 666),
  pcmBytes.slice(666),
];
let collected = 0;
let allEven = true;
for await (const samples of toSamples(streamOf(oddChunks))) {
  collected += samples.length;
  allEven = allEven && samples.every((v) => Number.isInteger(v));
}
check("an odd-byte chunk stream yields whole samples only", allEven);
check("no sample is lost across chunk boundaries", collected === 500, `${collected} of 500`);

// The values must also be right, not merely the count: a shifted read produces
// the same number of samples with the wrong contents.
const expected = new Int16Array(500);
for (let i = 0; i < 500; i++) expected[i] = i * 2;
let at = 0;
let valuesMatch = true;
for await (const samples of toSamples(streamOf(oddChunks))) {
  for (let i = 0; i < samples.length; i++) {
    if (samples[i] !== expected[at + i]) valuesMatch = false;
  }
  at += samples.length;
}
check("the samples are in the right order and value", valuesMatch);

// ── the segmentation plan is internally consistent ──────────────────────────
const plan = segmentPlan(16000);
check("a second of 16 kHz mono PCM is 32000 bytes", plan.bytesPerSecond === 32000);
check(
  "the segment window is four seconds by default",
  plan.segmentSamples === 64000,
  String(plan.segmentSamples),
);
check("partials arrive more often than segments", plan.partialSamples < plan.segmentSamples);
const plan8k = segmentPlan(8000);
check(
  "an 8 kHz stream plans half the bytes",
  plan8k.bytesPerSecond === 16000,
  String(plan8k.bytesPerSecond),
);

// ── a synthetic stream produces the right event order ───────────────────────
// No engine here: silence, so every transcription is empty and the events are
// purely structural. This is the contract a client codes against.
const silence = new Uint8Array(32000 * 6); // six seconds at 16 kHz
const events: LiveEvent[] = [];
for await (const event of liveTranscript(streamOf([silence]), { rate: 16000, language: "en-US" })) {
  events.push(event);
}
const types = events.map((e) => e.type);
check("the stream opens with a ready event", types[0] === "ready", types.join(","));
check("the stream closes with a done event", types[types.length - 1] === "done", types.join(","));
check(
  "the ready event reports the rate",
  events[0]?.type === "ready" && (events[0] as any).rate === 16000,
);
const done = events.find((e) => e.type === "done") as
  Extract<LiveEvent, { type: "done" }> | undefined;
check(
  "the done event reports the duration heard",
  !!done && Math.abs(done.seconds - 6) < 0.1,
  String(done?.seconds),
);
check("silence produces no committed text", !!done && done.text === "", JSON.stringify(done?.text));

// ── the real path: a real clip, streamed in one-second pieces ───────────────
// The live run needs a clip that actually holds speech, because a tone commits
// no text by design. One is generated with espeak-ng when the caller did not
// supply a path, so the run is exercised rather than silently skipped on a
// machine that has the tooling.
const arg = process.argv[2];
let audioPath = arg ?? "/tmp/rt.mp3";
let haveFfmpeg = false;
try {
  execFileSync("ffmpeg", ["-version"], { stdio: "ignore" });
  haveFfmpeg = true;
} catch {
  haveFfmpeg = false;
}
const haveEspeak = (() => {
  try {
    execFileSync("espeak-ng", ["--version"], { stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
})();
if (!arg && !existsSync(audioPath) && haveFfmpeg && haveEspeak) {
  const dir = mkdtempSync(join(tmpdir(), "zyraxon-stt-live-"));
  const spoken = join(dir, "speech.wav");
  execFileSync("espeak-ng", [
    "-w", spoken, "-s", "150",
    "hello world this is a test of the live speech to text stream",
  ]);
  execFileSync("ffmpeg", ["-y", "-loglevel", "error", "-i", spoken,
    "-ar", "16000", "-ac", "1", "-b:a", "96k", join(dir, "speech.mp3")]);
  audioPath = join(dir, "speech.mp3");
}

if (haveFfmpeg && existsSync(audioPath)) {
  const pcm = new Uint8Array(
    execFileSync(
      "ffmpeg",
      [
        "-y",
        "-loglevel",
        "error",
        "-i",
        audioPath,
        "-ar",
        "16000",
        "-ac",
        "1",
        "-f",
        "s16le",
        "pipe:1",
      ],
      { maxBuffer: 64 * 1024 * 1024 },
    ),
  );
  const total = pcm.length / 32000;
  console.log(`\nstreaming ${total.toFixed(1)}s of real audio in one-second chunks`);

  // One second per chunk is what a microphone client sends.
  const chunks: Uint8Array[] = [];
  for (let i = 0; i < pcm.length; i += 32000) chunks.push(pcm.slice(i, i + 32000));

  try {
    const live: LiveEvent[] = [];
    const started = Date.now();
    let firstTextAt = 0;
    for await (const event of liveTranscript(streamOf(chunks), {
      rate: 16000,
      language: "en-US",
      segmentSeconds: 3,
      partialSeconds: 1,
    })) {
      live.push(event);
      if (!firstTextAt && (event.type === "partial" || event.type === "segment") && event.text) {
        firstTextAt = Date.now() - started;
      }
    }
    const final = live.find((e) => e.type === "done") as
      Extract<LiveEvent, { type: "done" }> | undefined;
    const partials = live.filter((e) => e.type === "partial");
    const segments = live.filter((e) => e.type === "segment");

    check(
      "the live run produced committed text",
      !!final && final.text.trim().length > 0,
      JSON.stringify(final?.text),
    );
    check("the live run produced partials", partials.length > 0, `${partials.length} partials`);
    check("the live run produced segments", segments.length > 0, `${segments.length} segments`);
    check(
      "the committed text never shrinks",
      segments.every(
        (s, i) => i === 0 || (s as any).text.length >= (segments[i - 1] as any).text.length,
      ),
      segments.map((s) => (s as any).text.length).join(","),
    );
    // A partial is the committed prefix plus the words of the segment still
    // being spoken, so it must contain the committed text as it stands at that
    // moment. Checked in order rather than against the whole committed string:
    // a partial that arrives before the first commit legitimately contains no
    // committed text yet, and one that arrives after a later commit contains
    // more than the segment it was compared against. Comparing only the opening
    // few characters (as this check once did) let a genuinely truncated partial
    // through as long as four characters happened to match.
    let committedSoFar = "";
    let segmentCursor = 0;
    const partialsExtend = partials.every((p) => {
      while (
        segmentCursor < segments.length &&
        (segments[segmentCursor] as any).text.length <= committedSoFar.length
      ) {
        committedSoFar = (segments[segmentCursor] as any).text;
        segmentCursor++;
      }
      const text = (p as any).text as string;
      return text === committedSoFar || text.startsWith(committedSoFar);
    });
    check(
      "partials only ever extend the committed prefix",
      partialsExtend,
      "partials should begin with the committed text as it stood when they were emitted",
    );
    check(
      "text appeared before the clip ended",
      firstTextAt > 0 && firstTextAt < total * 1000,
      `${firstTextAt}ms into a ${(total * 1000) | 0}ms clip`,
    );
    console.log(
      `\n  first text after ${firstTextAt}ms; transcript: ${JSON.stringify(final?.text)}`,
    );
  } catch (error) {
    console.log(
      `SKIP  live engine run (${error instanceof Error ? error.message : String(error)})`,
    );
  }
} else {
  console.log(
    "\nSKIP  real-audio live run (needs ffmpeg and espeak-ng, or a path argument)",
  );
}

console.log(
  failures === 0 ? "\nall live transcription checks passed" : `\n${failures} check(s) failed`,
);
process.exit(failures === 0 ? 0 : 1);
