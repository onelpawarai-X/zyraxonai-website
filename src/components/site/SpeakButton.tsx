import { useCallback, useEffect, useRef, useState } from "react";
import { detectLocale, intoSentences } from "@/lib/tts/language";

/** Speak text aloud, starting on the first bytes rather than after the download.
 *
 *  Two things make this feel live, and both matter:
 *
 *  1. **Play as soon as a piece is ready.** The previous version awaited
 *     `res.blob()` on the whole answer, so a long reply meant seconds of silence
 *     before the first sound. Each sentence is fetched and played on its own now,
 *     so speech starts almost immediately and the rest is produced while the
 *     first sentence is already being heard.
 *  2. **Sentence by sentence, in order.** A whole answer is one long synthesis;
 *     splitting it means the first sentence is heard at once. Pieces are played
 *     in order through a queue, so nothing is reordered or dropped.
 *
 *  The language is detected from the text. An English voice reading Bengali is
 *  unintelligible — the letters are simply not pronounced — so the locale is
 *  taken from the text itself unless the caller names one. */
export default function SpeakButton({
  text,
  locale,
  className = "",
}: {
  text: string;
  locale?: string;
  className?: string;
}) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const queueRef = useRef<string[]>([]);
  const playingRef = useRef(false);
  const urlsRef = useRef<string[]>([]);
  const [state, setState] = useState<"idle" | "playing">("idle");

  const releaseUrls = useCallback(() => {
    for (const url of urlsRef.current) URL.revokeObjectURL(url);
    urlsRef.current = [];
  }, []);

  const stop = useCallback(() => {
    queueRef.current = [];
    playingRef.current = false;
    audioRef.current?.pause();
    audioRef.current = null;
    releaseUrls();
    setState("idle");
  }, [releaseUrls]);

  // Never leave audio running after the message is gone.
  useEffect(() => () => stop(), [stop]);

  const pump = useCallback(async () => {
    if (playingRef.current) return;
    playingRef.current = true;
    try {
      while (queueRef.current.length) {
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
      if (!queueRef.current.length) {
        releaseUrls();
        setState("idle");
      }
    }
  }, [locale, releaseUrls]);

  const speak = useCallback(() => {
    if (state !== "idle") {
      stop();
      return;
    }
    const pieces = intoSentences(text);
    if (!pieces.length) return;
    queueRef.current = pieces;
    setState("playing");
    void pump();
  }, [state, stop, text, pump]);

  return (
    <button
      type="button"
      onClick={speak}
      aria-label={state === "idle" ? "Read this aloud" : "Stop reading aloud"}
      title={state === "idle" ? "Read aloud" : "Stop"}
      className={`inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-muted-foreground transition-colors hover:bg-foreground/5 hover:text-foreground ${className}`}
    >
      {state === "idle" ? (
        <>
          <svg
            width="12"
            height="12"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <path d="M11 5L6 9H3v6h3l5 4V5z" />
            <path d="M15.5 8.5a5 5 0 010 7M18.5 5.5a9 9 0 010 13" />
          </svg>
          Listen
        </>
      ) : (
        <>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
            <rect x="6" y="5" width="4" height="14" rx="1" />
            <rect x="14" y="5" width="4" height="14" rx="1" />
          </svg>
          Stop
        </>
      )}
    </button>
  );
}
