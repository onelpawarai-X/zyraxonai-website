/** Build plugin: make `import mod from "./x.wasm"` resolve to an
 *  already-compiled `WebAssembly.Module`.
 *
 *  The Workers runtime refuses to compile wasm from bytes at request time —
 *  "Wasm code generation disallowed by embedder" — so a decoder library that
 *  calls `WebAssembly.compile()` never resolves and the worker is cancelled.
 *  A module the bundler emitted and the runtime imported as a `CompiledWasm`
 *  asset is compiled at deploy time, which the runtime does allow.
 *
 *  Nitro ships exactly this as `unwasm` with `esmImport`, but it only runs in
 *  Nitro's own environment. The speech route is bundled by the TanStack Start
 *  *SSR* environment first, so the import arrives there as a bare `.wasm` file
 *  with no `default` export and the build fails. This plugin gives every
 *  environment the same behaviour.
 *
 *  Two details are load-bearing:
 *
 *  - The asset specifier must not end in `.wasm`. Vite's own wasm plugin claims
 *    any id that does and tries to read it from disk, which throws on a virtual
 *    id. The specifier carries an index into `FILES` instead.
 *  - The rewrite and the `emitFile` both happen in `generateBundle`. Each
 *    environment is a separate plugin instance, and the wasm import is written
 *    by Nitro's, which never resolved the file itself. Working from the
 *    finished bundle needs no shared state, and `emitFile` in `generateBundle`
 *    lands the asset in that environment's own output directory — which is what
 *    keeps the emitted path correct once Nitro copies the SSR chunks into
 *    `_ssr/`. */

import { copyFileSync, mkdirSync, readFileSync } from "node:fs";
import { basename, dirname, isAbsolute, resolve } from "node:path";
import type { Plugin } from "vite";

/** The module whose body we generate, and the asset it imports. */
const MODULE_PREFIX = "\0zyraxon-wasm-module:";
const ASSET_PREFIX = "\0zyraxon-wasm-asset:";

/** Absolute wasm paths, indexed by the number in a specifier. Module scope, so
 *  a second plugin instance can still resolve an index the first one minted. */
const FILES: string[] = [];

const WASM_RE = /\.wasm$/;
/** The specifier as it appears in finished code. Rolldown writes the `\0` as an
 *  escape, so both spellings have to be matched. */
const ASSET_RE = /(\0|\\0)zyraxon-wasm-asset:(\d+)/g;

type BundleItem = { type: string; fileName?: string; code?: string; source?: string | Uint8Array };

function assetNameFor(index: string): string | null {
  const file = FILES[Number(index)];
  return file ? `wasm/${basename(file)}` : null;
}

export function wasmModulePlugin(): Plugin {
  return {
    name: "zyraxon:wasm-module",
    enforce: "pre" as const,

    async resolveId(id: string, importer?: string) {
      if (id.startsWith(ASSET_PREFIX)) return { id, external: true };
      const clean = id.split("?")[0] ?? id;
      if (!WASM_RE.test(clean)) return null;
      const resolved = await this.resolve(id, importer, { skipSelf: true });
      if (!resolved) return null;
      const file = resolved.id.split("?")[0] ?? resolved.id;
      let index = FILES.indexOf(file);
      if (index === -1) index = FILES.push(file) - 1;
      return MODULE_PREFIX + index;
    },

    load(id: string) {
      if (!id.startsWith(MODULE_PREFIX)) return null;
      const index = id.slice(MODULE_PREFIX.length);
      return {
        code: `import _mod from ${JSON.stringify(ASSET_PREFIX + index)};\nexport default _mod;\n`,
        map: { mappings: "" },
      };
    },

    generateBundle(_options, bundle) {
      const emitted = new Set<string>();
      for (const item of Object.values(bundle)) {
        if (item.type !== "chunk" || !item.code || !item.code.includes("zyraxon-wasm-asset:"))
          continue;
        const chunk = item as BundleItem & { code: string };
        // The runtime resolves the import from the chunk's own directory, so the
        // path has to climb back to the output root first.
        const depth = (chunk.fileName ?? "").split("/").filter(Boolean).length - 1;
        const up = depth > 0 ? "../".repeat(depth) : "./";
        const used = new Set<string>();
        chunk.code = chunk.code.replace(ASSET_RE, (_m, _nul, index: string) => {
          const name = assetNameFor(index);
          if (!name) return _m;
          used.add(name);
          return up + name;
        });
        for (const name of used) {
          if (emitted.has(name)) continue;
          emitted.add(name);
          const file = FILES.find((f) => `wasm/${basename(f)}` === name);
          if (file) this.emitFile({ type: "asset", fileName: name, source: readFileSync(file) });
        }
      }
    },

    closeBundle() {
      // `emitFile` from `generateBundle` is not reliably copied into a Nitro
      // output written with `no_bundle`, so the assets are also written to disk.
      // Nitro puts the real output directory on the bundler's `output.dir`, and
      // that is the one the chunk paths above are relative to.
      if (!FILES.length) return;
      const build = this.environment.config.build as {
        outDir?: string;
        rollupOptions?: { output?: { dir?: string } | { dir?: string }[] };
        rolldownOptions?: { output?: { dir?: string } | { dir?: string }[] };
      };
      const output = build.rollupOptions?.output ?? build.rolldownOptions?.output;
      const first = Array.isArray(output) ? output[0] : output;
      const dir = first?.dir ?? build.outDir;
      if (!dir) return;
      const root = isAbsolute(dir) ? dir : resolve(process.cwd(), dir);
      for (const file of FILES) {
        const target = resolve(root, "wasm", basename(file));
        mkdirSync(dirname(target), { recursive: true });
        copyFileSync(file, target);
      }
    },
  };
}
