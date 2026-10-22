// The decoder packages accept a pre-compiled wasm module through a static
// `module` property that their published types omit. The app depends on it —
// see `src/lib/stt/decode.ts` — so the property is declared here. The imports
// make this a module, which is what lets the declarations augment the real
// packages rather than replace them.
import "mpg123-decoder";
import "opus-decoder";

declare module "mpg123-decoder" {
  namespace MPEGDecoder {
    let module: WebAssembly.Module | undefined;
  }
}

declare module "opus-decoder" {
  namespace OpusDecoder {
    let module: WebAssembly.Module | undefined;
  }
}

