// The Ogg/Vorbis and AAC decoders keep the pre-compiled wasm module on an inner
// class — `Decoder` and `_AACDecoder` — which each package exports from a source
// file but not from its entry point, the same shape FLAC has. The app sets the
// module there, so the deep paths need types.
//
// This file has no imports on purpose: that makes it a global script, so the
// declarations are ambient and stand on their own for specifiers that neither
// package's `exports` map exposes.
declare module "@wasm-audio-decoders/ogg-vorbis/src/OggVorbisDecoder.js" {
  export function Decoder(): void;
  export namespace Decoder {
    let module: WebAssembly.Module | undefined;
  }
  /** The public class. The app takes this from the same file as `Decoder` so
   *  both share one module instance and the hook above is the one that is read. */
  export default class OggVorbisDecoder {
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

declare module "@wasm-audio-decoders/aac/src/AACDecoder.js" {
  export function _AACDecoder(options?: unknown): void;
  export namespace _AACDecoder {
    let module: WebAssembly.Module | undefined;
  }
  /** The public class, taken from the same file as `_AACDecoder` for the reason
   *  above. */
  export default class AACDecoder {
    constructor(options?: unknown);
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
