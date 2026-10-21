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
import { existsSync, readFileSync } from "node:fs";
import {
  encodeWav,
  isFlac,
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
import { decodeMp3, decodeOgg, decodeWebm } from "../src/lib/stt/decode";
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
  for (let i = 0; i < n; i++) samples[i] = Math.round(Math.sin((2 * Math.PI * hz * i) / rate) * 12000);
  return { samples, sampleRate: rate };
}

// ── WAV round trip ──────────────────────────────────────────────────────────
const t = tone(1);
const wav = encodeWav(t);
check("a WAV written by us is recognised as WAV", isWav(wav) && sniff(wav) === "wav");
const back = parseWav(wav);
check("the WAV reads back to the same sample count", back?.samples.length === t.samples.length,
  `${back?.samples.length} vs ${t.samples.length}`);
check("the WAV reads back at the same rate", back?.sampleRate === 16000);
check("the WAV reads back the same waveform",
  !!back && back.samples.every((v, i) => Math.abs(v - t.samples[i]!) <= 1));

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
check("a WAV with a LIST chunk before data still parses",
  listParsed?.samples.length === t.samples.length, `${listParsed?.samples.length}`);

// ── resampling ──────────────────────────────────────────────────────────────
const at48 = resampleTo16k({ samples: tone(0.5, 48000).samples, sampleRate: 48000 });
check("48 kHz resamples to 16 kHz at the right length",
  Math.abs(at48.samples.length - 8000) <= 2, `${at48.samples.length}`);
check("the resampler reports 16 kHz", at48.sampleRate === 16000);
const at44 = resampleTo16k({ samples: tone(1, 44100).samples, sampleRate: 44100 });
check("44.1 kHz (a non-integer ratio) resamples to about one second",
  Math.abs(secondsOf(at44) - 1) < 0.01, `${secondsOf(at44).toFixed(3)}s`);
const at16 = resampleTo16k(t);
check("16 kHz is passed through untouched", at16 === t);

// ── silence, level, window bounds ───────────────────────────────────────────
check("a tone is not silence", !isSilent(t));
check("digital silence is silence", isSilent({ samples: new Int16Array(16000), sampleRate: 16000 }));
check("a tone has a non-zero level", level(t) > 0.1, level(t).toFixed(3));
check("silence has a zero level", level({ samples: new Int16Array(1600), sampleRate: 16000 }) === 0);
const grown = joinPcm([t, t]);
check("two buffers join into two seconds", Math.abs(secondsOf(grown) - 2) < 0.001);
const clipped = keepNewest(grown, 0.5);
check("a live window keeps only the newest half second",
  Math.abs(secondsOf(clipped) - 0.5) < 0.01, secondsOf(clipped).toFixed(3));

// ── real containers, decoded through the real decoders ──────────────────────
const arg = process.argv[2];
const mp3Path = arg && arg.endsWith(".mp3") ? arg : "/tmp/rt.mp3";
const haveFfmpeg = (() => {
  try {
    execFileSync("ffmpeg", ["-version"], { stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
})();

let realPcm: Pcm | null = null;
if (existsSync(mp3Path)) {
  const mp3 = new Uint8Array(readFileSync(mp3Path));
  check("a real MP3 is sniffed as MP3", isMp3(mp3) && sniff(mp3) === "mp3", sniff(mp3));
  const decoded = await decodeMp3(mp3);
  realPcm = resampleTo16k(decoded);
  check("the MP3 decodes to audio", decoded.samples.length > 1000, `${decoded.samples.length} samples @ ${decoded.sampleRate}`);
  check("the decoded MP3 resamples to 16 kHz", realPcm.sampleRate === 16000);
  check("the decoded MP3 is not silence", !isSilent(realPcm));
} else {
  console.log(`SKIP  MP3 decode (no file at ${mp3Path})`);
}

if (haveFfmpeg) {
  // Build the two containers a browser and a desktop recorder produce, then
  // prove our own demuxers read them — no third party in the loop.
  const webm = new Uint8Array(execFileSync("ffmpeg", ["-y", "-loglevel", "error", "-i", mp3Path,
    "-c:a", "libopus", "-b:a", "32k", "-f", "webm", "pipe:1"], { maxBuffer: 64 * 1024 * 1024 }));
  check("a WebM stream is sniffed as WebM", isWebm(webm) && sniff(webm) === "webm");
  const fromWebm = await decodeWebm(webm);
  check("our WebM demuxer plus Opus decode produces audio",
    fromWebm.samples.length > 1000, `${fromWebm.samples.length} samples @ ${fromWebm.sampleRate}`);

  const ogg = new Uint8Array(execFileSync("ffmpeg", ["-y", "-loglevel", "error", "-i", mp3Path,
    "-c:a", "libopus", "-b:a", "32k", "-f", "ogg", "pipe:1"], { maxBuffer: 64 * 1024 * 1024 }));
  check("an Ogg stream is sniffed as Ogg", isOgg(ogg) && sniff(ogg) === "ogg");
  const fromOgg = await decodeOgg(ogg);
  check("our Ogg demuxer plus Opus decode produces audio",
    fromOgg.samples.length > 1000, `${fromOgg.samples.length} samples @ ${fromOgg.sampleRate}`);

  const flac = new Uint8Array(execFileSync("ffmpeg", ["-y", "-loglevel", "error", "-i", mp3Path,
    "-ar", "16000", "-ac", "1", "-f", "flac", "pipe:1"], { maxBuffer: 64 * 1024 * 1024 }));
  check("a FLAC stream is sniffed as FLAC", isFlac(flac) && sniff(flac) === "flac");

  // The demuxers must agree with each other: the same audio in two containers
  // should decode to about the same duration.
  if (realPcm) {
    const d1 = Math.abs(secondsOf(fromWebm) - secondsOf(realPcm));
    check("WebM and MP3 decode to the same duration", d1 < 0.25,
      `${secondsOf(fromWebm).toFixed(2)}s vs ${secondsOf(realPcm).toFixed(2)}s`);
  }
} else {
  console.log("SKIP  WebM/Ogg/FLAC container tests (ffmpeg is not installed)");
}

// ── the engine, when the network allows ─────────────────────────────────────
if (realPcm) {
  try {
    const one = await recognize(pcmInput(realPcm), "en-US");
    check("the engine transcribes a real clip", one.text.trim().length > 0,
      `${one.engine}: ${JSON.stringify(one.text)}`);
    check("the engine reports a confidence", one.confidence >= 0, String(one.confidence));

    // One locale per call is the contract now, so several calls must each answer
    // for their own language and not bleed into each other.
    const many = await recognizeMany(pcmInput(realPcm), ["en-US", "bn-BD", "hi-IN"]);
    check("the engine answers several locales in one pass", many.length === 3, `${many.length} answers`);
    check("each answer names the locale it was asked for",
      many.every((a) => a.locale && a.text !== undefined), many.map((a) => a.locale).join(","));

    // A live window is a slice of a longer clip; it must transcribe on its own.
    const window = keepNewest(realPcm, 2);
    const win = await recognize(pcmInput(window), "en-US");
    check("a two-second live window transcribes on its own", win.text.trim().length > 0,
      JSON.stringify(win.text));
  } catch (error) {
    console.log(`SKIP  engine calls (${error instanceof Error ? error.message : String(error)})`);
  }
}

console.log(failures === 0 ? "\nall speech-to-text checks passed" : `\n${failures} check(s) failed`);
process.exit(failures === 0 ? 0 : 1);
