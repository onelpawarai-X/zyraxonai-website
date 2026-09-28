import { useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { NebulaDeck } from "./nebula-core";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "ZYRAXON AI — All in One. Anything. Nothing is Impossible." },
      {
        name: "description",
        content:
          "The World's Most Advanced Desktop AI Agent. 805 tools across 63 categories, 10 agent modes, Screen Vision, Eternal Memory.",
      },
      {
        property: "og:title",
        content: "ZYRAXON AI — All in One. Anything. Nothing is Impossible.",
      },
      {
        property: "og:description",
        content:
          "The World's Most Advanced Desktop AI Agent. 805 tools across 63 categories, 10 agent modes, Screen Vision, Eternal Memory.",
      },
      { property: "og:type", content: "website" },
      { property: "og:url", content: "https://zyraxonai.lovable.app" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:title", content: "ZYRAXON AI — All in One. Anything. Nothing is Impossible." },
      {
        name: "twitter:description",
        content:
          "The World's Most Advanced Desktop AI Agent. 805 tools across 63 categories, 10 agent modes, Screen Vision, Eternal Memory.",
      },
    ],
    scripts: [
      {
        type: "application/ld+json",
        children: JSON.stringify({
          "@context": "https://schema.org",
          "@type": "SoftwareApplication",
          name: "ZYRAXON AI",
          applicationCategory: "DeveloperApplication",
          operatingSystem: "Windows, macOS, Linux",
          description:
            "Free and open-source desktop AI agent with 805 tools across 63 categories, 10 agent modes, screen vision and eternal memory.",
          url: "https://zyraxonai.lovable.app",
          offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
        }),
      },
    ],
  }),
  component: Index,
});

const GREETING = "Hello world! Welcome to Zyraxon AI.";

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
  } catch {}
}

function armGreeting() {
  speakGreeting();
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
  const events = ["pointerdown", "keydown", "touchstart"] as const;
  const once = () => {
    speakGreeting();
    events.forEach((e) => window.removeEventListener(e, once));
  };
  events.forEach((e) => window.addEventListener(e, once, { passive: true }));
}

function Index() {
  const [nebula, setNebula] = useState(false);

  useEffect(() => {
    const timer = window.setTimeout(armGreeting, 350);
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    const onMessage = (e: MessageEvent) => {
      if ((e.data as any)?.type === "zyraxon:nebula") setNebula(true);
      if ((e.data as any)?.type === "zyraxon:navigate" && (e.data as any).path) {
        window.top!.location.href = (e.data as any).path;
      }
    };
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, []);

  return (
    <main
      style={{
        minHeight: "100vh",
        height: "100vh",
        display: "flex",
        flexDirection: "column",
        background: "#06060e",
        overflow: "hidden",
        position: "relative",
      }}
    >
      <iframe
        title="ZYRAXON AI"
        src="/zyraxon.html"
        allow="autoplay"
        style={{ display: "block", width: "100%", flex: "1 1 auto", minHeight: 0, border: 0 }}
      />
      {nebula && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 60,
            background: "rgba(2,4,12,.86)",
            backdropFilter: "blur(10px)",
            display: "flex",
            overflow: "auto",
          }}
        >
          <NebulaDeck onClose={() => setNebula(false)} />
        </div>
      )}
    </main>
  );
}
