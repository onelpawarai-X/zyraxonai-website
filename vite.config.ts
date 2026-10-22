// @lovable.dev/vite-tanstack-config already includes the following — do NOT add them manually
// or the app will break with duplicate plugins:
//   - TanStack devtools (dev-only, first), tanstackStart, viteReact, tailwindcss, tsConfigPaths,
//     nitro (build-only using cloudflare as a default target), VITE_* env injection, @ path alias,
//     React/TanStack dedupe, error logger plugins, and sandbox detection (port/host/strictPort).
// You can pass additional config via defineConfig({ vite: { ... }, etc... }) if needed.
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { defineConfig } from "@lovable.dev/vite-tanstack-config";
import { wasmModulePlugin } from "./src/lib/stt/wasm/vite-plugin";

// The FLAC decoder reads its pre-compiled wasm module from an inner class it
// exports from a source file but not from its entry point, and its `exports`
// map hides that file from a bare specifier. The alias re-exposes the one file,
// resolved through the map so the layout stays the package manager's business.
// See `src/lib/stt/decode.ts`.
const flacEntry = createRequire(import.meta.url).resolve("@wasm-audio-decoders/flac");
const flacInner = join(dirname(flacEntry), "src", "FLACDecoder.js");

export default defineConfig({
  // The speech decoders are wasm, and the Workers runtime forbids compiling wasm
  // at request time. Nitro's own wasm plugin does not reach the SSR environment
  // that bundles the speech route, so this one supplies the same behaviour there.
  vite: {
    plugins: [wasmModulePlugin()],
    resolve: { alias: { "@wasm-audio-decoders/flac/src/FLACDecoder.js": flacInner } },
  },
  tanstackStart: {
    // Redirect TanStack Start's bundled server entry to src/server.ts (our SSR error wrapper).
    server: { entry: "server" },
  },
  // Explicitly keep the legacy standalone homepage as a production public asset.
  // The homepage is embedded by src/routes/index.tsx at /zyraxon.html. Without an
  // explicit Nitro public asset entry, some hosted Nitro presets can fall through
  // unknown .html requests to the hosting platform's starter page.
  nitro: {
    // @ts-expect-error publicAssets is supported by Nitro but missing from the wrapper types
    publicAssets: [
      {
        dir: "public",
        baseURL: "/",
      },
    ],
  },
});
