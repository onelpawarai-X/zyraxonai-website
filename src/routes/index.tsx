import { useEffect, useState } from "react";
import { Volume2, VolumeX, Zap } from "lucide-react";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "ZYRAXON AI — All in One. Anything. Nothing is Impossible." },
      {
        name: "description",
        content:
          "The most powerful free & open-source desktop AI coding agent. 50+ tools, Beast Mode, Screen Vision, Unlimited Memory.",
      },
      { property: "og:title", content: "ZYRAXON AI — All in One. Anything. Nothing is Impossible." },
      {
        property: "og:description",
        content:
          "The most powerful free & open-source desktop AI coding agent. 50+ tools, Beast Mode, Screen Vision, Unlimited Memory.",
      },
    ],
  }),
  component: Index,
});

const WELCOME_TEXT =
  "Welcome to ZYRAXON AI — your all-in-one AI workspace. Build, create, and explore with powerful intelligence at your fingertips.";

function speakWelcome() {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
  window.speechSynthesis.cancel();
  const voice = new SpeechSynthesisUtterance(WELCOME_TEXT);
  voice.rate = 0.96;
  voice.pitch = 0.9;
  voice.volume = 0.9;
  window.speechSynthesis.speak(voice);
}

function Index() {
  const [welcome, setWelcome] = useState(true);
  const [sound, setSound] = useState(true);

  useEffect(() => {
    const seen = sessionStorage.getItem("zyraxon.welcome-seen");
    if (seen) setWelcome(false);
  }, []);

  function enter() {
    sessionStorage.setItem("zyraxon.welcome-seen", "1");
    if (sound) speakWelcome();
    setWelcome(false);
  }

  return (
    <main style={{ minHeight: "100vh", height: "100vh", display: "flex", flexDirection: "column", background: "#06060e", overflow: "hidden", position: "relative" }}>
      <style>{`
        .zyraxon-red-pulse{position:absolute;inset:0;z-index:5;pointer-events:none;opacity:0;background:radial-gradient(circle at 50% 45%,rgba(255,20,45,.05),rgba(150,0,15,.28));mix-blend-mode:screen;animation:zyraxonDangerPulse 19s ease-in-out infinite}
        .zyraxon-red-edge{position:absolute;inset:0;z-index:6;pointer-events:none;border:0 solid rgba(255,20,45,0);animation:zyraxonDangerEdge 19s ease-in-out infinite}
        @keyframes zyraxonDangerPulse{0%,78%,100%{opacity:0}82%{opacity:.08}85%{opacity:.28}88%{opacity:.11}91%{opacity:.02}}
        @keyframes zyraxonDangerEdge{0%,78%,100%{box-shadow:inset 0 0 0 rgba(255,20,45,0)}84%{box-shadow:inset 0 0 55px rgba(255,20,45,.18)}87%{box-shadow:inset 0 0 130px rgba(255,20,45,.42)}90%{box-shadow:inset 0 0 35px rgba(255,20,45,.08)}}
        .zyraxon-welcome{position:absolute;inset:0;z-index:20;display:grid;place-items:center;padding:24px;background:rgba(2,2,10,.74);backdrop-filter:blur(18px);-webkit-backdrop-filter:blur(18px)}
        .zyraxon-welcome-card{width:min(560px,100%);padding:36px;border:1px solid rgba(0,245,255,.2);border-radius:28px;background:linear-gradient(145deg,rgba(12,12,32,.95),rgba(8,8,20,.88));box-shadow:0 30px 100px rgba(0,0,0,.5),0 0 60px rgba(0,245,255,.1);text-align:center;color:#f4f4fb}
        .zyraxon-welcome-logo{width:58px;height:58px;margin:0 auto 18px;border-radius:18px;display:grid;place-items:center;background:linear-gradient(135deg,#00f5ff,#7c3aed);color:#03030a;box-shadow:0 0 35px rgba(0,245,255,.3)}
        .zyraxon-welcome-card h2{font-size:clamp(28px,6vw,44px);line-height:1.05;margin:0 0 14px;font-weight:900;letter-spacing:-.04em;background:linear-gradient(135deg,#00f5ff,#a855f7,#ec4899);-webkit-background-clip:text;background-clip:text;color:transparent}
        .zyraxon-welcome-card p{color:#9b9bb5;line-height:1.7;margin:0 auto 26px;max-width:470px}
        .zyraxon-enter-row{display:flex;justify-content:center;gap:10px;flex-wrap:wrap}
        .zyraxon-enter,.zyraxon-sound{border:1px solid rgba(255,255,255,.12);border-radius:14px;padding:13px 18px;cursor:pointer;font:inherit;font-weight:750}
        .zyraxon-enter{background:linear-gradient(135deg,#00f5ff,#7c3aed);color:#05050b;min-width:190px;box-shadow:0 0 35px rgba(0,245,255,.2)}
        .zyraxon-sound{background:rgba(255,255,255,.05);color:#f4f4fb;display:inline-flex;align-items:center;gap:8px}
        @media(prefers-reduced-motion:reduce){.zyraxon-red-pulse,.zyraxon-red-edge{animation:none}}
      `}</style>

      <iframe
        title="ZYRAXON AI"
        src="/zyraxon.html"
        allow="autoplay"
        style={{ display: "block", width: "100%", flex: "1 1 auto", minHeight: 0, border: 0 }}
      />
      <div className="zyraxon-red-pulse" aria-hidden="true" />
      <div className="zyraxon-red-edge" aria-hidden="true" />

      {welcome && (
        <section className="zyraxon-welcome" aria-label="Welcome to ZYRAXON AI">
          <div className="zyraxon-welcome-card">
            <div className="zyraxon-welcome-logo"><Zap size={28} fill="currentColor" /></div>
            <h2>Welcome to ZYRAXON AI</h2>
            <p>Build, create, and explore with a powerful all-in-one AI workspace.</p>
            <div className="zyraxon-enter-row">
              <button className="zyraxon-enter" onClick={enter}>Enter ZYRAXON AI</button>
              <button className="zyraxon-sound" onClick={() => setSound(v => !v)} aria-label={sound ? "Mute welcome voice" : "Enable welcome voice"}>
                {sound ? <Volume2 size={17} /> : <VolumeX size={17} />} {sound ? "Voice on" : "Voice off"}
              </button>
            </div>
          </div>
        </section>
      )}
    </main>
  );
}
