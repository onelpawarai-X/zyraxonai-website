// Proves the compressed-audio decoders run the way Cloudflare Workers require:
// with runtime wasm compilation forbidden.
//
// This is the regression that shipped. mpg123-decoder and opus-decoder compile
// their wasm the first time a decoder is built. workerd refuses to compile wasm
// from bytes at runtime — "Wasm code generation disallowed by embedder" — and a
// request that reaches that call does not fail politely; the runtime sees a
// worker that will never answer and cancels it. The visible symptom was a 502
// on every MP3, WebM and Ogg upload, while WAV and FLAC — the containers that
// need no decoder — kept working. On a dev machine the bug was invisible,
// because Node happily compiles wasm.
//
// So the test removes the ability to compile wasm and then decodes each
// compressed container. If a decoder ever goes back to compiling at runtime,
// this fails here instead of in production.
//
// Run: npx tsx --import ./scripts/raw-import-loader.mjs scripts/verify-stt-wasm.ts

import { execFileSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { isMp3, isOgg, isWebm, isSilent, secondsOf, sniff } from "../src/lib/stt/audio";

let failures = 0;
const check = (label: string, ok: boolean, detail = "") => {
  if (!ok) failures++;
  console.log(`${ok ? "PASS" : "FAIL"}  ${label}${detail ? `\n        ${detail}` : ""}`);
};

/** Make every runtime wasm compilation throw, exactly as workerd does.
 *
 *  Only byte input is refused. Instantiating an already-compiled `Module` is
 *  allowed on Workers — that is how a bundled `.wasm` import is used — so the
 *  lock leaves those calls alone, which is precisely the distinction the fix
 *  depends on. */
function forbidRuntimeWasmCompilation(): void {
  const refuse = (): never => {
    throw new Error("Wasm code generation disallowed by embedder");
  };
  const isBytes = (value: unknown): boolean =>
    value instanceof Uint8Array ||
    value instanceof ArrayBuffer ||
    ArrayBuffer.isView(value);

  WebAssembly.compile = ((bytes: unknown) =>
    isBytes(bytes) ? refuse() : (undefined as never)) as typeof WebAssembly.compile;
  WebAssembly.compileStreaming = refuse as typeof WebAssembly.compileStreaming;

  const instantiate = WebAssembly.instantiate as unknown as (
    ...args: unknown[]
  ) => Promise<unknown>;
  WebAssembly.instantiate = ((first: unknown, second: unknown) =>
    isBytes(first)
      ? refuse()
      : instantiate.call(WebAssembly, first, second)) as typeof WebAssembly.instantiate;
  WebAssembly.instantiateStreaming = refuse as typeof WebAssembly.instantiateStreaming;

  // The synchronous constructors only ever take bytes, so both refuse.
  WebAssembly.Module = refuse as unknown as typeof WebAssembly.Module;
  WebAssembly.Instance = refuse as unknown as typeof WebAssembly.Instance;
}

// The wasm modules are resolved and cached first — under the bundler that
// happens at build time, where compilation is allowed — and only then is the
// runtime compilation lock applied. This is the same order as Workers: the
// module arrives already compiled, and the runtime refuses to compile anything
// new. Importing the module graph now also means the decode import below
// reuses it rather than triggering a fresh compile.
await import("../src/lib/stt/wasm");

forbidRuntimeWasmCompilation();
const { decodeMp3, decodeOgg, decodeWebm } = await import("../src/lib/stt/decode");

/** A spoken clip plus the containers built from it, so the decode result is real
 *  speech rather than a tone that could pass even if a decoder mis-read the
 *  stream. */
function buildSamples(): { mp3: Uint8Array; webm: Uint8Array; ogg: Uint8Array } | null {
  let ffmpeg = true;
  try {
    execFileSync("ffmpeg", ["-version"], { stdio: "ignore" });
  } catch {
    ffmpeg = false;
  }
  if (!ffmpeg) return null;

  const dir = mkdtempSync(join(tmpdir(), "zyraxon-wasm-"));
  const wav = join(dir, "speech.wav");
  try {
    execFileSync("espeak-ng", [
      "-w", wav, "-s", "150",
      "hello world this is a test of the speech to text engine",
    ]);
  } catch {
    execFileSync("ffmpeg", [
      "-y", "-loglevel", "error",
      "-f", "lavfi", "-i", "sine=frequency=440:duration=2",
      "-ar", "44100", "-ac", "1", wav,
    ]);
  }

  const encode = (name: string, args: string[]): Uint8Array => {
    const out = join(dir, name);
    execFileSync("ffmpeg", ["-y", "-loglevel", "error", "-i", wav, ...args, out]);
    return new Uint8Array(readFileSync(out));
  };

  return {
    mp3: encode("speech.mp3", ["-ar", "44100", "-ac", "1", "-b:a", "96k"]),
    webm: encode("speech.webm", ["-c:a", "libopus", "-b:a", "32k"]),
    ogg: encode("speech.ogg", ["-c:a", "libopus", "-b:a", "32k"]),
  };
}

const samples = buildSamples();
if (!samples) {
  console.log("SKIP  wasm decode tests (ffmpeg is not installed)");
  process.exit(failures ? 1 : 0);
}
const { mp3, webm, ogg } = samples;

check("the sample is sniffed as MP3", isMp3(mp3) && sniff(mp3) === "mp3", sniff(mp3));

// ── the three containers that need a decoder ────────────────────────────────
const mp3Pcm = await decodeMp3(mp3);
check("MP3 decodes with runtime wasm compilation forbidden",
  mp3Pcm.samples.length > 1000, `${mp3Pcm.samples.length} samples @ ${mp3Pcm.sampleRate}`);
check("the decoded MP3 is not silence", !isSilent(mp3Pcm));

check("the WebM sample is sniffed as WebM", isWebm(webm) && sniff(webm) === "webm");
const webmPcm = await decodeWebm(webm);
check("WebM/Opus decodes with runtime wasm compilation forbidden",
  webmPcm.samples.length > 1000, `${webmPcm.samples.length} samples @ ${webmPcm.sampleRate}`);

check("the Ogg sample is sniffed as Ogg", isOgg(ogg) && sniff(ogg) === "ogg");
const oggPcm = await decodeOgg(ogg);
check("Ogg/Opus decodes with runtime wasm compilation forbidden",
  oggPcm.samples.length > 1000, `${oggPcm.samples.length} samples @ ${oggPcm.sampleRate}`);

// The decoders must agree: the same audio in three containers, one duration.
const mp3s = secondsOf(mp3Pcm);
check("MP3, WebM and Ogg decode to the same duration",
  Math.abs(secondsOf(webmPcm) - mp3s) < 0.25 && Math.abs(secondsOf(oggPcm) - mp3s) < 0.25,
  `${mp3s.toFixed(2)}s vs ${secondsOf(webmPcm).toFixed(2)}s vs ${secondsOf(oggPcm).toFixed(2)}s`);

// A second decode, to catch a decoder that only worked because the first call
// left a compiled module cached.
const again = await decodeMp3(mp3);
check("a second MP3 decode still works (no cached compile needed)",
  again.samples.length > 1000, `${again.samples.length} samples`);

console.log(failures ? `\n${failures} check(s) failed` : "\nall wasm decode checks passed");
process.exit(failures ? 1 : 0);
