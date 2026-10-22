/** The decoder wasm, compiled at build time rather than at request time.
 *
 *  The decoder libraries ship their wasm as an encoded string and call
 *  `WebAssembly.compile()` the first time a decoder is built. That is fine in a
 *  browser and in Node, and fatal on Cloudflare Workers: workerd refuses to
 *  compile wasm from bytes at runtime — "Wasm code generation disallowed by
 *  embedder" — because it is the same class of hazard as `eval()`. A request
 *  that reaches that call does not fail politely; the runtime sees a worker that
 *  will never answer and cancels it, which surfaced as a 502 on every MP3, WebM
 *  and Ogg upload while WAV and FLAC — the two containers that need no decoder —
 *  kept working.
 *
 *  The fix is to hand the libraries a module that is already compiled. The
 *  bundler turns each `.wasm` import below into a `WebAssembly.Module`, so the
 *  only wasm compilation happens at build time, where it is allowed.
 *
 *  On a runtime that *can* compile wasm — Node, where the test suite runs — the
 *  same import is resolved by `scripts/raw-import-loader.mjs` into an
 *  identically compiled module, so one code path serves both. */

import mpg123Wasm from "./mpg123.wasm";
import opusWasm from "./opus.wasm";

/** An import of a `.wasm` file is a compiled module everywhere this app runs.
 *  The cast is for TypeScript, which has no type for that import. */
export const mpg123Module = mpg123Wasm as unknown as WebAssembly.Module;
export const opusModule = opusWasm as unknown as WebAssembly.Module;
