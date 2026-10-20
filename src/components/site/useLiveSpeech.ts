import { useCallback, useEffect, useRef, useState } from "react";
import { detectLocale } from "@/lib/tts/language";

/** Speak an answer while it is still being written.
 *
 *  This is the difference between "read this to me" and "talking to me". A reply
 *  arrives token by token; feeding completed sentences to the speech endpoint as
 *  they appear means the first sentence is heard while the model is still
 *  writing the second. Waiting for the whole answer — which is what a plain
 *  Listen button does — means seconds of silence and a lag that feels broken.
 *
 *  The mechanism is a small buffer. Text is appended to it as it streams; when it
 *  contains a sentence terminator, the finished sentence is cut off and queued,
 *  and the remainder waits for more text. That guarantees a sentence is spoken
 *  exactly once, in order, and never half-formed. */

/** A sentence terminator, including the Bengali and Devanagari danda. */
const TERMINATOR = /[.!?।॥]\s/;

export function useLiveSpeech(locale?: string) {
  const queueRef = useRef<string[]>([]);
  const bufferRef = useRef("");
  const playingRef = useRef(false);
  const urlsRef = useRef<string[]>([]);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const enabledRef = useRef(false);
  const [enabled, setEnabled] = useState(false);

  const release = useCallback(() => {
    for (const url of urlsRef.current) URL.revokeObjectURL(url);
    urlsRef.current = [];
  }, []);

  const stop = useCallback(() => {
    queueRef.current = [];
    bufferRef.current = "";
    playingRef.current = false;
    audioRef.current?.pause();
    audioRef.current = null;
    release();
  }, [release]);

  const pump = useCallback(async () => {
    if (playingRef.current) return;
    playingRef.current = true;
    try {
      while (enabledRef.current && queueRef.current.length) {
        const piece = queueRef.current.shift()!;
        const res = await fetch("/api/public/tts", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text: piece, locale: locale || detectLocale(piece) }),
        });
        if (!res.ok) continue;
        const url = URL.createObjectURL(await res.blob());
        urlsRef.current.push(url);
        const audio = new Audio(url);
        audioRef.current = audio;
        await new Promise<void>((resolve) => {
          audio.onended = () => resolve();
          audio.onerror = () => resolve();
          audio.play().catch(() => resolve());
        });
      }
    } finally {
      playingRef.current = false;
      audioRef.current = null;
      if (!queueRef.current.length) release();
    }
  }, [locale, release]);

  /** Take whole sentences out of the buffer and queue them. */
  const drain = useCallback(() => {
    const buffer = bufferRef.current;
    let cut = 0;
    for (let i = 0; i < buffer.length; i++) {
      if (TERMINATOR.test(buffer.slice(i, i + 2))) cut = i + 1;
    }
    if (!cut) return;
    const ready = buffer.slice(0, cut).trim();
    bufferRef.current = buffer.slice(cut).trimStart();
    if (ready) {
      queueRef.current.push(ready);
      void pump();
    }
  }, [pump]);

  /** Feed the growing answer. `final` flushes whatever is left. */
  const feed = useCallback(
    (chunk: string, opts: { final?: boolean } = {}) => {
      if (!enabledRef.current) return;
      bufferRef.current += chunk;
      drain();
      if (opts.final) {
        const rest = bufferRef.current.trim();
        bufferRef.current = "";
        if (rest) {
          queueRef.current.push(rest);
          void pump();
        }
      }
    },
    [drain, pump],
  );

  const setLive = useCallback(
    (on: boolean) => {
      enabledRef.current = on;
      setEnabled(on);
      if (!on) stop();
    },
    [stop],
  );

  useEffect(() => () => stop(), [stop]);

  return { enabled, setLive, feed, stop };
}
