// Teaches tsx the Vite `?raw` import that the app's bundler understands, so the
// provider test can import the real server module instead of a stub. Dev only.
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
    return nextLoad(url, context);
  },
});
