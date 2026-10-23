// The FLAC decoder keeps the pre-compiled wasm module on its inner class —
// `_FLACDecoder`, which the package exports from a source file but not from its
// entry point — rather than on the class it publicly exports the way the MP3 and
// Opus decoders do. The app sets the module there, so the deep path needs a type.
//
// This file has no imports on purpose: that makes it a global script, so the
// declaration is ambient and stands on its own for a specifier that the
// package's own `exports` map does not expose.
declare module "@wasm-audio-decoders/flac/src/FLACDecoder.js" {
  export function _FLACDecoder(): void;
  export namespace _FLACDecoder {
    let module: WebAssembly.Module | undefined;
  }
  /** The public class. The app takes this from the same file as `_FLACDecoder`
   *  so both share one module instance and the hook above is the one that is
   *  read. */
  export default class FLACDecoder {
    constructor();
    ready: Promise<void>;
    decode(data: Uint8Array): Promise<{
      channelData: Float32Array[];
      samplesDecoded: number;
      sampleRate: number;
    }>;
    flush(): Promise<{
      channelData: Float32Array[];
      samplesDecoded: number;
      sampleRate: number;
    }>;
    free(): void;
  }
}
