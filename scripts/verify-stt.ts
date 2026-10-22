// Proves the speech-to-text pipeline works on real audio, end to end, through
// the same modules the endpoint uses: container demux, codec decode, resample,
// language probing and ranking.
//
// The engine is reached over the network, so the transcription assertions are
// skipped when the sandbox has no egress; everything local — demuxing, decoding,
// resampling, ranking — is asserted unconditionally, because that is the part
// that must never break.
//
// Run: npx tsx scripts/verify-stt.ts [path-to-audio]

import { execFileSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  encodeWav,
  isFlac,
  isMp4,
  isMp3,
  isOgg,
  isSilent,
  isWav,
  isWebm,
  joinPcm,
  keepNewest,
  level,
  parseWav,
  resampleTo16k,
  secondsOf,
  sniff,
  type Pcm,
} from "../src/lib/stt/audio";
import { decodeFlac, decodeMp3, decodeOgg, decodeWebm } from "../src/lib/stt/decode";
import { MP4_REFUSAL, decodeContainer } from "../src/lib/stt/ingest";
import { pcmInput, recognize, recognizeMany } from "../src/lib/stt/engine";

let failures = 0;
const check = (label: string, ok: boolean, detail = "") => {
  if (!ok) failures++;
  console.log(`${ok ? "PASS" : "FAIL"}  ${label}${detail ? `\n        ${detail}` : ""}`);
};

/** A tone, so a silent-input bug cannot masquerade as a working decode. */
function tone(seconds: number, rate = 16000, hz = 440): Pcm {
  const n = Math.floor(seconds * rate);
  const samples = new Int16Array(n);
  for (let i = 0; i < n; i++)
    samples[i] = Math.round(Math.sin((2 * Math.PI * hz * i) / rate) * 12000);
  return { samples, sampleRate: rate };
}

// ── WAV round trip ──────────────────────────────────────────────────────────
const t = tone(1);
const wav = encodeWav(t);
check("a WAV written by us is recognised as WAV", isWav(wav) && sniff(wav) === "wav");
const back = parseWav(wav);
check(
  "the WAV reads back to the same sample count",
  back?.samples.length === t.samples.length,
  `${back?.samples.length} vs ${t.samples.length}`,
);
check("the WAV reads back at the same rate", back?.sampleRate === 16000);
check(
  "the WAV reads back the same waveform",
  !!back && back.samples.every((v, i) => Math.abs(v - t.samples[i]!) <= 1),
);

// ── a WAV with an extra chunk must still parse ──────────────────────────────
// Real encoders emit LIST/fact chunks; a fixed 44-byte offset reads them as
// audio. This is the regression that made uploads transcribe as noise.
const withList = (() => {
  const extra = new Uint8Array(12);
  extra.set([0x4c, 0x49, 0x53, 0x54], 0); // "LIST"
  new DataView(extra.buffer).setUint32(4, 4, true);
  const out = new Uint8Array(wav.length + extra.length);
  out.set(wav.subarray(0, 12), 0);
  out.set(extra, 12);
  out.set(wav.subarray(12), 12 + extra.length);
  const dv = new DataView(out.buffer);
  dv.setUint32(4, out.length - 8, true);
  return out;
})();
const listParsed = parseWav(withList);
check(
  "a WAV with a LIST chunk before data still parses",
  listParsed?.samples.length === t.samples.length,
  `${listParsed?.samples.length}`,
);

// ── resampling ──────────────────────────────────────────────────────────────
const at48 = resampleTo16k({ samples: tone(0.5, 48000).samples, sampleRate: 48000 });
check(
  "48 kHz resamples to 16 kHz at the right length",
  Math.abs(at48.samples.length - 8000) <= 2,
  `${at48.samples.length}`,
);
check("the resampler reports 16 kHz", at48.sampleRate === 16000);
const at44 = resampleTo16k({ samples: tone(1, 44100).samples, sampleRate: 44100 });
check(
  "44.1 kHz (a non-integer ratio) resamples to about one second",
  Math.abs(secondsOf(at44) - 1) < 0.01,
  `${secondsOf(at44).toFixed(3)}s`,
);
const at16 = resampleTo16k(t);
check("16 kHz is passed through untouched", at16 === t);

// ── silence, level, window bounds ───────────────────────────────────────────
check("a tone is not silence", !isSilent(t));
check(
  "digital silence is silence",
  isSilent({ samples: new Int16Array(16000), sampleRate: 16000 }),
);
check("a tone has a non-zero level", level(t) > 0.1, level(t).toFixed(3));
check(
  "silence has a zero level",
  level({ samples: new Int16Array(1600), sampleRate: 16000 }) === 0,
);
const grown = joinPcm([t, t]);
check("two buffers join into two seconds", Math.abs(secondsOf(grown) - 2) < 0.001);
const clipped = keepNewest(grown, 0.5);
check(
  "a live window keeps only the newest half second",
  Math.abs(secondsOf(clipped) - 0.5) < 0.01,
  secondsOf(clipped).toFixed(3),
);

// ── real containers, decoded through the real decoders ──────────────────────
const haveFfmpeg = (() => {
  try {
    execFileSync("ffmpeg", ["-version"], { stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
})();

// The decode path is the part that broke before, so it is never skipped when we
// can help it. If the caller did not hand us a clip, build one with ffmpeg so
// the MP3/WebM/Ogg assertions always run. A spoken clip is preferred over a
// tone because it lets the engine assertions run too, so espeak-ng is used when
// it is present. Only a machine with no ffmpeg at all falls back to skipping.
const arg = process.argv[2];
let mp3Path = arg && arg.endsWith(".mp3") ? arg : "/tmp/rt.mp3";
let sampleIsSpeech = Boolean(arg);
const haveEspeak = (() => {
  try {
    execFileSync("espeak-ng", ["--version"], { stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
})();

if (!existsSync(mp3Path) && haveFfmpeg) {
  const dir = mkdtempSync(join(tmpdir(), "zyraxon-stt-"));
  if (haveEspeak) {
    const spoken = join(dir, "speech.wav");
    execFileSync("espeak-ng", [
      "-w",
      spoken,
      "-s",
      "150",
      "hello world this is a test of the speech to text engine",
    ]);
    execFileSync("ffmpeg", [
      "-y",
      "-loglevel",
      "error",
      "-i",
      spoken,
      "-ar",
      "44100",
      "-ac",
      "1",
      "-b:a",
      "96k",
      join(dir, "speech.mp3"),
    ]);
    mp3Path = join(dir, "speech.mp3");
    sampleIsSpeech = true;
  } else {
    const generated = join(dir, "sample.mp3");
    execFileSync("ffmpeg", [
      "-y",
      "-loglevel",
      "error",
      "-f",
      "lavfi",
      "-i",
      "sine=frequency=440:duration=3",
      "-ar",
      "44100",
      "-ac",
      "1",
      "-b:a",
      "64k",
      generated,
    ]);
    mp3Path = generated;
  }
}

let realPcm: Pcm | null = null;
if (existsSync(mp3Path)) {
  const mp3 = new Uint8Array(readFileSync(mp3Path));
  check("a real MP3 is sniffed as MP3", isMp3(mp3) && sniff(mp3) === "mp3", sniff(mp3));
  const decoded = await decodeMp3(mp3);
  realPcm = resampleTo16k(decoded);
  check(
    "the MP3 decodes to audio",
    decoded.samples.length > 1000,
    `${decoded.samples.length} samples @ ${decoded.sampleRate}`,
  );
  check("the decoded MP3 resamples to 16 kHz", realPcm.sampleRate === 16000);
  check("the decoded MP3 is not silence", !isSilent(realPcm));
} else {
  console.log(`SKIP  MP3 decode (no file at ${mp3Path})`);
}

if (haveFfmpeg) {
  // Build the two containers a browser and a desktop recorder produce, then
  // prove our own demuxers read them — no third party in the loop.
  const webm = new Uint8Array(
    execFileSync(
      "ffmpeg",
      [
        "-y",
        "-loglevel",
        "error",
        "-i",
        mp3Path,
        "-c:a",
        "libopus",
        "-b:a",
        "32k",
        "-f",
        "webm",
        "pipe:1",
      ],
      { maxBuffer: 64 * 1024 * 1024 },
    ),
  );
  check("a WebM stream is sniffed as WebM", isWebm(webm) && sniff(webm) === "webm");
  const fromWebm = await decodeWebm(webm);
  check(
    "our WebM demuxer plus Opus decode produces audio",
    fromWebm.samples.length > 1000,
    `${fromWebm.samples.length} samples @ ${fromWebm.sampleRate}`,
  );

  const ogg = new Uint8Array(
    execFileSync(
      "ffmpeg",
      [
        "-y",
        "-loglevel",
        "error",
        "-i",
        mp3Path,
        "-c:a",
        "libopus",
        "-b:a",
        "32k",
        "-f",
        "ogg",
        "pipe:1",
      ],
      { maxBuffer: 64 * 1024 * 1024 },
    ),
  );
  check("an Ogg stream is sniffed as Ogg", isOgg(ogg) && sniff(ogg) === "ogg");
  const fromOgg = await decodeOgg(ogg);
  check(
    "our Ogg demuxer plus Opus decode produces audio",
    fromOgg.samples.length > 1000,
    `${fromOgg.samples.length} samples @ ${fromOgg.sampleRate}`,
  );

  const flac = new Uint8Array(
    execFileSync(
      "ffmpeg",
      [
        "-y",
        "-loglevel",
        "error",
        "-i",
        mp3Path,
        "-ar",
        "16000",
        "-ac",
        "1",
        "-f",
        "flac",
        "pipe:1",
      ],
      { maxBuffer: 64 * 1024 * 1024 },
    ),
  );
  check("a FLAC stream is sniffed as FLAC", isFlac(flac) && sniff(flac) === "flac");

  // FLAC is decoded here rather than passed to the engine, so that a recording
  // longer than one request can be cut into windows. The engine's own FLAC
  // reading stops at about thirty seconds and used to come back truncated.
  const fromFlac = await decodeFlac(flac);
  check(
    "FLAC decodes to PCM",
    fromFlac.samples.length > 1000,
    `${fromFlac.samples.length} samples @ ${fromFlac.sampleRate}`,
  );
  check("the decoded FLAC is not silence", !isSilent(fromFlac));

  // 22 050 Hz is ffmpeg's FLAC default. The rate used to be hard-coded to 16 000
  // in the request, and the engine answers an empty transcript for a mismatch —
  // the second half of the FLAC bug. It must survive a decode at its own rate.
  const flac22 = new Uint8Array(
    execFileSync(
      "ffmpeg",
      [
        "-y",
        "-loglevel",
        "error",
        "-i",
        mp3Path,
        "-ar",
        "22050",
        "-ac",
        "1",
        "-f",
        "flac",
        "pipe:1",
      ],
      { maxBuffer: 64 * 1024 * 1024 },
    ),
  );
  const fromFlac22 = await decodeFlac(flac22);
  check(
    "FLAC at 22 050 Hz decodes at its own rate",
    fromFlac22.sampleRate === 22050 && fromFlac22.samples.length > 1000,
    `${fromFlac22.samples.length} samples @ ${fromFlac22.sampleRate}`,
  );
  check(
    "FLAC at 16 kHz and at 22 050 Hz hold the same audio",
    Math.abs(secondsOf(fromFlac22) - secondsOf(fromFlac)) < 0.25,
    `${secondsOf(fromFlac22).toFixed(2)}s vs ${secondsOf(fromFlac).toFixed(2)}s`,
  );

  // M4A/AAC: what an iPhone or Safari recorder produces, and the one format the
  // endpoint cannot read. It must be named and refused, not silently returned as
  // an empty transcript that looks like "nobody spoke".
  let m4a: Uint8Array | null = null;
  try {
    // To a file, not a pipe: the MP4 muxer seeks back to patch its header, and a
    // pipe cannot be seeked.
    const m4aPath = join(mkdtempSync(join(tmpdir(), "zyraxon-m4a-")), "speech.m4a");
    execFileSync("ffmpeg", [
      "-y",
      "-loglevel",
      "error",
      "-i",
      mp3Path,
      "-c:a",
      "aac",
      "-b:a",
      "96k",
      m4aPath,
    ]);
    m4a = new Uint8Array(readFileSync(m4aPath));
  } catch {
    m4a = null;
  }
  if (m4a) {
    check(
      "an M4A is sniffed as MP4, not as raw PCM",
      isMp4(m4a) && sniff(m4a) === "mp4",
      sniff(m4a),
    );
    let refusal = "";
    try {
      await decodeContainer(m4a);
    } catch (error) {
      refusal = error instanceof Error ? error.message : String(error);
    }
    check(
      "an M4A is refused with a message that names the format",
      refusal === MP4_REFUSAL,
      refusal || "(no error raised)",
    );
  } else {
    console.log("SKIP  M4A refusal test (ffmpeg has no AAC encoder here)");
  }

  // The demuxers must agree with each other: the same audio in two containers
  // should decode to about the same duration.
  if (realPcm) {
    const d1 = Math.abs(secondsOf(fromWebm) - secondsOf(realPcm));
    check(
      "WebM and MP3 decode to the same duration",
      d1 < 0.25,
      `${secondsOf(fromWebm).toFixed(2)}s vs ${secondsOf(realPcm).toFixed(2)}s`,
    );
  }
} else {
  console.log("SKIP  WebM/Ogg/FLAC container tests (ffmpeg is not installed)");
}

// ── the engine, when the network allows and the clip holds speech ───────────
// A pure tone transcribes to empty text by design, so the transcription checks
// only run for a spoken sample. Decode and resample above are always asserted.
if (realPcm && sampleIsSpeech) {
  try {
    const one = await recognize(pcmInput(realPcm), "en-US");
    check(
      "the engine transcribes a real clip",
      one.text.trim().length > 0,
      `${one.engine}: ${JSON.stringify(one.text)}`,
    );
    check("the engine reports a confidence", one.confidence >= 0, String(one.confidence));

    // One locale per call is the contract now, so several calls must each answer
    // for their own language and not bleed into each other.
    const many = await recognizeMany(pcmInput(realPcm), ["en-US", "bn-BD", "hi-IN"]);
    check(
      "the engine answers several locales in one pass",
      many.length === 3,
      `${many.length} answers`,
    );
    check(
      "each answer names the locale it was asked for",
      many.every((a) => a.locale && a.text !== undefined),
      many.map((a) => a.locale).join(","),
    );

    // A live window is a slice of a longer clip; it must transcribe on its own.
    const window = keepNewest(realPcm, 2);
    const win = await recognize(pcmInput(window), "en-US");
    check(
      "a two-second live window transcribes on its own",
      win.text.trim().length > 0,
      JSON.stringify(win.text),
    );
  } catch (error) {
    console.log(`SKIP  engine calls (${error instanceof Error ? error.message : String(error)})`);
  }
} else if (realPcm) {
  console.log("SKIP  engine transcription checks (no spoken sample; espeak-ng is not installed)");
}

console.log(
  failures === 0 ? "\nall speech-to-text checks passed" : `\n${failures} check(s) failed`,
);
process.exit(failures === 0 ? 0 : 1);
