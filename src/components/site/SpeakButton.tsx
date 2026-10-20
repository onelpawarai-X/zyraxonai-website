import { useCallback, useEffect, useRef, useState } from "react";

/** Play an AI answer aloud, using the site's own speech endpoint.
 *
 *  The endpoint streams MP3 as it synthesises, so playback can start almost
 *  immediately. The browser is given the URL and does the streaming and the
 *  decoding itself, which keeps this component small and means the audio is
 *  produced in the language the answer was written in — the endpoint picks the
 *  voice from the text's own locale, and `locale` can override that.
 *
 *  Speech is opt-in per message: a visitor who does not want it is never made to
 *  hear anything, and one who does gets it for the answer they are looking at
 *  rather than the whole conversation. */
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
  const [state, setState] = useState<"idle" | "loading" | "playing">("idle");

  // Stop the audio if the message unmounts, so a closed panel is never talking.
  useEffect(() => {
    return () => {
      audioRef.current?.pause();
      audioRef.current = null;
    };
  }, []);

  const stop = useCallback(() => {
    audioRef.current?.pause();
    audioRef.current = null;
    setState("idle");
  }, []);

  const speak = useCallback(async () => {
    if (state === "playing") {
      stop();
      return;
    }
    setState("loading");
    try {
      // The endpoint takes the text and streams MP3 back. The browser plays it
      // as it arrives, so the first words are heard long before the sentence is
      // finished being synthesised.
      const res = await fetch("/api/public/tts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text, locale: locale || undefined }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const blob = await res.blob();
      const audio = new Audio(URL.createObjectURL(blob));
      audioRef.current = audio;
      audio.onended = () => setState("idle");
      audio.onerror = () => setState("idle");
      await audio.play();
      setState("playing");
    } catch {
      setState("idle");
    }
  }, [state, stop, text, locale]);

  return (
    <button
      type="button"
      onClick={speak}
      aria-label={state === "playing" ? "Stop reading aloud" : "Read this aloud"}
      title={state === "playing" ? "Stop" : "Read aloud"}
      className={`inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-muted-foreground transition-colors hover:bg-foreground/5 hover:text-foreground ${className}`}
    >
      {state === "playing" ? (
        <>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
            <rect x="6" y="5" width="4" height="14" rx="1" />
            <rect x="14" y="5" width="4" height="14" rx="1" />
          </svg>
          Stop
        </>
      ) : state === "loading" ? (
        <>
          <svg
            width="12"
            height="12"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            className="animate-spin"
          >
            <path d="M12 3a9 9 0 109 9" />
          </svg>
          Loading
        </>
      ) : (
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
      )}
    </button>
  );
}
