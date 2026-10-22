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
// So the test removes the ability to compile wasm and then decodes every
// container that needs a decoder — MP3, WebM, Ogg, and FLAC, which now decodes
// too so that a long recording can be windowed. If a decoder ever goes back to compiling at runtime,
// this fails here instead of in production.
//
// Run: npx tsx --import ./scripts/raw-import-loader.mjs scripts/verify-stt-wasm.ts

import { execFileSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  isAdts,
  isMp3,
  isOgg,
  isWebm,
  isSilent,
  oggCodec,
  secondsOf,
  sniff,
} from "../src/lib/stt/audio";
import { wasmModulePlugin } from "../src/lib/stt/wasm/vite-plugin";

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
    value instanceof Uint8Array || value instanceof ArrayBuffer || ArrayBuffer.isView(value);

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
const { decodeAac, decodeFlac, decodeMp3, decodeOgg, decodeVorbis, decodeWebm } = await import(
  "../src/lib/stt/decode"
);

/** A spoken clip plus the containers built from it, so the decode result is real
 *  speech rather than a tone that could pass even if a decoder mis-read the
 *  stream. */
function buildSamples(): {
  mp3: Uint8Array;
  webm: Uint8Array;
  ogg: Uint8Array;
  vorbis: Uint8Array;
  aac: Uint8Array;
  flac: Uint8Array;
} | null {
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
      "-w",
      wav,
      "-s",
      "150",
      "hello world this is a test of the speech to text engine",
    ]);
  } catch {
    execFileSync("ffmpeg", [
      "-y",
      "-loglevel",
      "error",
      "-f",
      "lavfi",
      "-i",
      "sine=frequency=440:duration=2",
      "-ar",
      "44100",
      "-ac",
      "1",
      wav,
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
    // Vorbis, the codec Wikimedia serves and the one the endpoint used to refuse
    // by name. A different codec inside the same container is the whole point.
    vorbis: encode("speech-vorbis.ogg", ["-c:a", "libvorbis", "-b:a", "64k"]),
    // Raw AAC in an ADTS wrapper — the `.aac` file, without an MP4 around it.
    aac: encode("speech.aac", ["-c:a", "aac", "-b:a", "96k", "-f", "adts"]),
    // 22 050 Hz, like ffmpeg's FLAC default, so a hard-coded rate in the request
    // would be wrong — which is the second half of the FLAC bug.
    flac: encode("speech.flac", ["-ar", "22050", "-ac", "1"]),
  };
}

const samples = buildSamples();
if (!samples) {
  console.log("SKIP  wasm decode tests (ffmpeg is not installed)");
  process.exit(failures ? 1 : 0);
}
const { mp3, webm, ogg, vorbis, aac, flac } = samples;

check("the sample is sniffed as MP3", isMp3(mp3) && sniff(mp3) === "mp3", sniff(mp3));

// ── the three containers that need a decoder ────────────────────────────────
const mp3Pcm = await decodeMp3(mp3);
check(
  "MP3 decodes with runtime wasm compilation forbidden",
  mp3Pcm.samples.length > 1000,
  `${mp3Pcm.samples.length} samples @ ${mp3Pcm.sampleRate}`,
);
check("the decoded MP3 is not silence", !isSilent(mp3Pcm));

check("the WebM sample is sniffed as WebM", isWebm(webm) && sniff(webm) === "webm");
const webmPcm = await decodeWebm(webm);
check(
  "WebM/Opus decodes with runtime wasm compilation forbidden",
  webmPcm.samples.length > 1000,
  `${webmPcm.samples.length} samples @ ${webmPcm.sampleRate}`,
);

check("the Ogg sample is sniffed as Ogg", isOgg(ogg) && sniff(ogg) === "ogg");
const oggPcm = await decodeOgg(ogg);
check(
  "Ogg/Opus decodes with runtime wasm compilation forbidden",
  oggPcm.samples.length > 1000,
  `${oggPcm.samples.length} samples @ ${oggPcm.sampleRate}`,
);

// Ogg/Vorbis: a different codec in the same container as the Opus sample above.
check(
  "the Vorbis sample is sniffed as Ogg/Vorbis",
  isOgg(vorbis) && oggCodec(vorbis) === "vorbis",
  oggCodec(vorbis),
);
const vorbisPcm = await decodeVorbis(vorbis);
check(
  "Ogg/Vorbis decodes with runtime wasm compilation forbidden",
  vorbisPcm.samples.length > 1000,
  `${vorbisPcm.samples.length} samples @ ${vorbisPcm.sampleRate}`,
);
check("the decoded Vorbis is not silence", !isSilent(vorbisPcm));

// Raw AAC (ADTS). The twelve-bit sync word also satisfies the eleven-bit MP3
// test, so sniffing is where this format is easy to lose.
check("the AAC sample is sniffed as AAC", isAdts(aac) && sniff(aac) === "aac", sniff(aac));
const aacPcm = await decodeAac(aac);
check(
  "raw AAC decodes with runtime wasm compilation forbidden",
  aacPcm.samples.length > 1000,
  `${aacPcm.samples.length} samples @ ${aacPcm.sampleRate}`,
);
check("the decoded AAC is not silence", !isSilent(aacPcm));

// FLAC: the container that used to bypass decoding, and so bypassed windowing
// and rate detection with it.
const flacPcm = await decodeFlac(flac);
check(
  "FLAC decodes with runtime wasm compilation forbidden",
  flacPcm.samples.length > 1000,
  `${flacPcm.samples.length} samples @ ${flacPcm.sampleRate}`,
);
check("the decoded FLAC is not silence", !isSilent(flacPcm));

// The decoders must agree: the same audio in every container, one duration.
const mp3s = secondsOf(mp3Pcm);
const durations = {
  WebM: secondsOf(webmPcm),
  Ogg: secondsOf(oggPcm),
  Vorbis: secondsOf(vorbisPcm),
  AAC: secondsOf(aacPcm),
  FLAC: secondsOf(flacPcm),
};
check(
  "every container decodes to the same duration",
  Object.values(durations).every((d) => Math.abs(d - mp3s) < 0.25),
  `${mp3s.toFixed(2)}s vs ${Object.entries(durations)
    .map(([k, d]) => `${k} ${d.toFixed(2)}s`)
    .join(" vs ")}`,
);

// A second decode, to catch a decoder that only worked because the first call
// left a compiled module cached.
const again = await decodeMp3(mp3);
check(
  "a second MP3 decode still works (no cached compile needed)",
  again.samples.length > 1000,
  `${again.samples.length} samples`,
);

// The FLAC hook lives on an inner class, and the public class reads it from the
// same module. If the two are ever imported through different specifiers — the
// package entry for one, the deep path for the other — a bundler emits two
// copies of the file and the hook lands on the copy nothing reads, which puts
// the runtime compile back and hangs the request. Node resolves both to one
// module, so the decode above cannot see it; this checks the shape that the
// bundler acts on.
const decodeSource = readFileSync(new URL("../src/lib/stt/decode.ts", import.meta.url), "utf8");
for (const [name, pkg, inner] of [
  ["FLAC", "@wasm-audio-decoders/flac", "@wasm-audio-decoders/flac/src/FLACDecoder.js"],
  [
    "Ogg/Vorbis",
    "@wasm-audio-decoders/ogg-vorbis",
    "@wasm-audio-decoders/ogg-vorbis/src/OggVorbisDecoder.js",
  ],
  ["AAC", "@wasm-audio-decoders/aac", "@wasm-audio-decoders/aac/src/AACDecoder.js"],
] as const) {
  const importsEntryPoint = new RegExp(`from\\s+"${pkg}"`).test(decodeSource);
  check(
    `the ${name} classes are imported from one specifier only`,
    !importsEntryPoint && decodeSource.includes(`"${inner}"`),
    importsEntryPoint ? "the package entry point is imported as well" : "",
  );
}

// The dev server must not see the virtual asset specifier. In a build the
// plugin rewrites that specifier in `generateBundle`; dev never bundles, so the
// rewrite never runs and the specifier reaches Vite's loader as if it were a
// file path — the null byte in it makes `readFile` throw, and the whole module
// graph dies with it. That took the home page and every route down, so the two
// outputs are asserted here rather than trusted.
const flacWasmPath = new URL("../src/lib/stt/wasm/flac.wasm", import.meta.url).pathname;
for (const command of ["serve", "build"] as const) {
  const plugin = wasmModulePlugin() as unknown as {
    configResolved(config: { command: string }): void;
    resolveId(this: unknown, id: string, importer?: string): Promise<unknown>;
    load(id: string): { code: string } | null;
  };
  plugin.configResolved({ command });
  const resolved = (await plugin.resolveId.call(
    { resolve: async () => ({ id: flacWasmPath }) },
    "./flac.wasm",
    "/anywhere.ts",
  )) as { id?: string } | string | null;
  const id = typeof resolved === "string" ? resolved : (resolved?.id ?? "");
  const code = plugin.load(id)?.code ?? "";
  const selfContained = code.includes("WebAssembly.Module") && !code.includes("zyraxon-wasm-asset");
  check(
    command === "serve"
      ? "dev compiles the wasm itself, with no virtual asset specifier"
      : "build still defers to the bundled asset",
    command === "serve" ? selfContained : code.includes("zyraxon-wasm-asset"),
    (code.split("\n")[0] ?? "").slice(0, 60),
  );
}

console.log(failures ? `\n${failures} check(s) failed` : "\nall wasm decode checks passed");
process.exit(failures ? 1 : 0);
