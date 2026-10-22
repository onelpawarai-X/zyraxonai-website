// Teaches tsx the Vite `?raw` import that the app's bundler understands, so the
// provider test can import the real server module instead of a stub. Dev only.
//
// It also teaches it the `*.wasm` import. The bundler hands back an already
// compiled `WebAssembly.Module`; Node can compile wasm, so the loader does the
// same thing here. Without this the speech decoders — which are only reachable
// through the wasm import — could not be exercised by the test suite at all.
import { createRequire, registerHooks } from "node:module";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

// The FLAC decoder hides the file that carries its inner class behind an
// `exports` map, so a bare deep specifier is refused. The app aliases it in
// `vite.config.ts`; the test runner needs the same alias. See `decode.ts`.
const require_ = createRequire(import.meta.url);
const innerOf = (pkg, file) =>
  pathToFileURL(join(dirname(require_.resolve(pkg)), "src", file)).href;
const innerModules = {
  "@wasm-audio-decoders/flac/src/FLACDecoder.js": innerOf(
    "@wasm-audio-decoders/flac",
    "FLACDecoder.js",
  ),
  "@wasm-audio-decoders/ogg-vorbis/src/OggVorbisDecoder.js": innerOf(
    "@wasm-audio-decoders/ogg-vorbis",
    "OggVorbisDecoder.js",
  ),
  "@wasm-audio-decoders/aac/src/AACDecoder.js": innerOf(
    "@wasm-audio-decoders/aac",
    "AACDecoder.js",
  ),
};

registerHooks({
  resolve(specifier, context, nextResolve) {
    if (innerModules[specifier]) {
      return { url: innerModules[specifier], shortCircuit: true };
    }
    if (specifier.endsWith("?raw")) {
      const r = nextResolve(specifier.slice(0, -4), context);
      return { url: r.url + "?raw", shortCircuit: true };
    }
    return nextResolve(specifier, context);
  },
  load(url, context, nextLoad) {
    if (url.endsWith("?raw")) {
      const src = readFileSync(fileURLToPath(url.slice(0, -4)), "utf8");
      return {
        format: "module",
        source: "export default " + JSON.stringify(src) + ";",
        shortCircuit: true,
      };
    }
    if (url.endsWith(".wasm")) {
      const file = fileURLToPath(url);
      return {
        format: "module",
        source:
          "import { readFileSync } from 'node:fs';\n" +
          "export default new WebAssembly.Module(readFileSync(" +
          JSON.stringify(file) +
          "));\n",
        shortCircuit: true,
      };
    }
    return nextLoad(url, context);
  },
});
