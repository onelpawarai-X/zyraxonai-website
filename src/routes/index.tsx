import { useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "ZYRAXON AI — All in One. Anything. Nothing is Impossible." },
      {
        name: "description",
        content:
          "The most powerful free & open-source desktop AI coding agent. 50+ tools, Beast Mode, Screen Vision, Unlimited Memory.",
      },
      {
        property: "og:title",
        content: "ZYRAXON AI — All in One. Anything. Nothing is Impossible.",
      },
      {
        property: "og:description",
        content:
          "The most powerful free & open-source desktop AI coding agent. 50+ tools, Beast Mode, Screen Vision, Unlimited Memory.",
      },
    ],
  }),
  component: Index,
});

const GREETING = "Hello world! Welcome to Zyraxon AI.";

/** Pick the most pleasant female English voice available in this browser. */
function pickFemaleVoice(): SpeechSynthesisVoice | null {
  const voices = window.speechSynthesis.getVoices();
  const preferred = [
    "Microsoft Aria",
    "Microsoft Jenny",
    "Microsoft Michelle",
    "Microsoft Zira",
    "Google UK English Female",
    "Google US English",
    "Samantha",
    "Karen",
    "Moira",
    "Tessa",
    "Serena",
  ];
  for (const name of preferred) {
    const match = voices.find((v) => v.name.includes(name));
    if (match) return match;
  }
  return (
    voices.find((v) => /female/i.test(v.name)) ||
    voices.find((v) => v.lang?.toLowerCase().startsWith("en")) ||
    voices[0] ||
    null
  );
}

let spoken = false;

function speakGreeting() {
  if (spoken || typeof window === "undefined" || !("speechSynthesis" in window)) return;
  spoken = true;
  try {
    window.speechSynthesis.cancel();
    const voice = new SpeechSynthesisUtterance(GREETING);
    const picked = pickFemaleVoice();
    if (picked) voice.voice = picked;
    voice.rate = 0.94;
    voice.pitch = 1.18;
    voice.volume = 0.9;
    window.speechSynthesis.speak(voice);
  } catch {
    /* speech is a background delight — never break the page for it */
  }
}

function armGreeting() {
  speakGreeting();
  // Voices load async in some browsers — retry once they are ready.
  if ("speechSynthesis" in window) {
    const onVoices = () => {
      if (!window.speechSynthesis.speaking && !window.speechSynthesis.pending) {
        spoken = false;
        speakGreeting();
      }
      window.speechSynthesis.removeEventListener("voiceschanged", onVoices);
    };
    window.speechSynthesis.addEventListener("voiceschanged", onVoices);
    window.setTimeout(
      () => window.speechSynthesis.removeEventListener("voiceschanged", onVoices),
      8000,
    );
  }
  // Browsers may block autoplay until first interaction — speak at the very first touch.
  const events = ["pointerdown", "keydown", "touchstart"] as const;
  const once = () => {
    speakGreeting();
    events.forEach((e) => window.removeEventListener(e, once));
  };
  events.forEach((e) => window.addEventListener(e, once, { passive: true }));
}

function Index() {
  const [rage, setRage] = useState(false);

  useEffect(() => {
    const timer = window.setTimeout(armGreeting, 350);
    return () => window.clearTimeout(timer);
  }, []);

  /** Every ~22s the ENTIRE site transforms into its terrifying blood-red form for a few seconds, then returns to blue. */
  useEffect(() => {
    if (
      typeof window === "undefined" ||
      window.matchMedia?.("(prefers-reduced-motion: reduce)").matches
    )
      return;
    let rageTimer = 0;
    const cycle = window.setInterval(() => {
      setRage(true);
      rageTimer = window.setTimeout(() => setRage(false), 5200);
    }, 22000);
    return () => {
      window.clearInterval(cycle);
      window.clearTimeout(rageTimer);
    };
  }, []);

  return (
    <main
      style={{
        minHeight: "100vh",
        height: "100vh",
        display: "flex",
        flexDirection: "column",
        background: rage ? "#160003" : "#06060e",
        transition: "background .95s ease",
        overflow: "hidden",
        position: "relative",
      }}
    >
      <style>{`
        .zyraxon-stage{transition:filter .95s ease;will-change:filter}
        .zyraxon-stage.rage{filter:sepia(1) saturate(7.5) hue-rotate(-48deg) brightness(.74) contrast(1.22)}
        .zyraxon-red-pulse{position:absolute;inset:0;z-index:5;pointer-events:none;opacity:0;background:radial-gradient(circle at 50% 45%,rgba(255,20,45,.05),rgba(150,0,15,.28));mix-blend-mode:screen;animation:zyraxonDangerPulse 19s ease-in-out infinite}
        .zyraxon-red-edge{position:absolute;inset:0;z-index:6;pointer-events:none;border:0 solid rgba(255,20,45,0);animation:zyraxonDangerEdge 19s ease-in-out infinite}
        .zyraxon-rage-veil{position:absolute;inset:0;z-index:7;pointer-events:none;opacity:0;transition:opacity .95s ease;background:radial-gradient(circle at 50% 42%,rgba(255,12,32,.10),rgba(110,0,8,.42)),linear-gradient(rgba(190,0,18,.10),rgba(70,0,5,.34));mix-blend-mode:multiply}
        .zyraxon-rage-veil.on{opacity:1}
        .zyraxon-rage-glow{position:absolute;inset:0;z-index:7;pointer-events:none;opacity:0;transition:opacity .95s ease;background:radial-gradient(circle at 50% 45%,rgba(255,30,55,.16),transparent 62%);mix-blend-mode:screen}
        .zyraxon-rage-glow.on{opacity:1}
        @keyframes zyraxonDangerPulse{0%,78%,100%{opacity:0}82%{opacity:.08}85%{opacity:.28}88%{opacity:.11}91%{opacity:.02}}
        @keyframes zyraxonDangerEdge{0%,78%,100%{box-shadow:inset 0 0 0 rgba(255,20,45,0)}84%{box-shadow:inset 0 0 55px rgba(255,20,45,.18)}87%{box-shadow:inset 0 0 130px rgba(255,20,45,.42)}90%{box-shadow:inset 0 0 35px rgba(255,20,45,.08)}}
        @media(prefers-reduced-motion:reduce){.zyraxon-red-pulse,.zyraxon-red-edge{animation:none}.zyraxon-stage{transition:none}}
      `}</style>
      <iframe
        title="ZYRAXON AI"
        src="/zyraxon.html"
        allow="autoplay"
        className={`zyraxon-stage ${rage ? "rage" : ""}`}
        style={{ display: "block", width: "100%", flex: "1 1 auto", minHeight: 0, border: 0 }}
      />
      <div className="zyraxon-red-pulse" aria-hidden="true" />
      <div className="zyraxon-red-edge" aria-hidden="true" />
      <div className={`zyraxon-rage-veil ${rage ? "on" : ""}`} aria-hidden="true" />
      <div className={`zyraxon-rage-glow ${rage ? "on" : ""}`} aria-hidden="true" />
    </main>
  );
}
