// Teaches tsx the Vite `?raw` import that the app's bundler understands, so the
// provider test can import the real server module instead of a stub. Dev only.
//
// It also teaches it the `*.wasm` import. The bundler hands back an already
// compiled `WebAssembly.Module`; Node can compile wasm, so the loader does the
// same thing here. Without this the speech decoders — which are only reachable
// through the wasm import — could not be exercised by the test suite at all.
import { registerHooks } from "node:module";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

registerHooks({
  resolve(specifier, context, nextResolve) {
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
