import { useEffect, useRef, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { PageShell } from "@/components/site/PageShell";
import { PageHeader, SectionLabel } from "@/components/site/SiteChrome";
import { ButtonLink, Card, Tag } from "@/components/site/ui";

export const Route = createFileRoute("/demo")({
  head: () => ({
    meta: [
      { title: "Demo — ZYRAXON AI in action" },
      {
        name: "description",
        content:
          "Watch ZYRAXON AI work: full product walkthroughs in English and Bengali, plus screenshots from the desktop agent.",
      },
      { property: "og:title", content: "Demo — ZYRAXON AI in action" },
      {
        property: "og:description",
        content: "Full ZYRAXON AI walkthroughs in English and Bengali, plus screenshots.",
      },
      { property: "og:type", content: "video.other" },
      { property: "og:url", content: "https://zyraxonai.lovable.app/demo" },
      { name: "twitter:card", content: "player" },
    ],
  }),
  component: DemoPage,
});

type Clip = {
  id: string;
  badge: string;
  title: string;
  subtitle: string;
  src: string;
  poster: string;
};

const CLIPS: Clip[] = [
  {
    id: "en",
    badge: "EN",
    title: "English walkthrough",
    subtitle: "The complete ZYRAXON agent demo, narrated in English.",
    src: "/media/zyraxon-viral-en.mp4",
    poster: "/media/zyraxon-viral-en-poster.jpg",
  },
  {
    id: "bn",
    badge: "BN",
    title: "বাংলা ওয়াকথ্রু",
    subtitle: "সম্পূর্ণ ডেমো, বাংলায় বর্ণিত।",
    src: "/media/zyraxon-viral-bn.mp4",
    poster: "/media/zyraxon-viral-bn-poster.jpg",
  },
];

const SHOTS = [1, 2, 3, 4, 5, 6].map((n) => `/media/zyraxon-shot-${n}.jpg`);

const HIGHLIGHTS = [
  {
    title: "Preview-first agent",
    body: "Every task starts in the Preview panel, then reaches for the tools behind it — Jarvis Browser, Nuphus, Touchpoint, desktop-commander.",
  },
  {
    title: "Hundreds of parallel sub-agents",
    body: "Big jobs fan out across hundreds of sub-agents, and ZYRAXON verifies every result itself before assembling the output.",
  },
  {
    title: "No API, no problem",
    body: "When an API cannot do it, the agent drives the real application through the interface, exactly the way a person would.",
  },
  {
    title: "Self-healing steps",
    body: "If a step fails the agent finds the cause, resolves it and runs the step again instead of giving up.",
  },
];

function DemoPage() {
  // Which clip is allowed to make sound. Everything else stays muted so the
  // browser never blocks autoplay.
  const [unmuted, setUnmuted] = useState<string | null>(null);

  return (
    <PageShell>
      <PageHeader
        label="ZYRAXON-AI // Demo"
        title="See it in action"
        description="Two full walkthroughs of the ZYRAXON desktop agent — one in English, one in Bengali — pulled straight from the v19.0.6 release. Both start playing on their own, muted. Unmute either one to hear it."
      />

      <div className="grid gap-6 lg:grid-cols-2">
        {CLIPS.map((clip) => (
          <ClipPlayer
            key={clip.id}
            clip={clip}
            muted={unmuted !== clip.id}
            onUnmute={() => setUnmuted(clip.id)}
            onMute={() => setUnmuted((cur) => (cur === clip.id ? null : cur))}
          />
        ))}
      </div>

      <section className="mt-12">
        <SectionLabel>Screenshots</SectionLabel>
        <h2 className="mt-2 text-2xl font-bold tracking-tight text-foreground">Inside the agent</h2>
        <p className="mt-2 max-w-2xl text-[14px] leading-relaxed text-muted-foreground">
          Frames captured from the walkthrough — planning, tool selection, parallel execution and
          verification.
        </p>
        <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {SHOTS.map((src, i) => (
            <a
              key={src}
              href={src}
              target="_blank"
              rel="noopener noreferrer"
              className="zx-glass group block overflow-hidden rounded-2xl"
            >
              <img
                src={src}
                alt={`ZYRAXON agent screenshot ${i + 1}`}
                loading="lazy"
                className="aspect-video w-full object-cover transition duration-300 group-hover:scale-[1.03]"
              />
            </a>
          ))}
        </div>
      </section>

      <section className="mt-12">
        <SectionLabel>What you are watching</SectionLabel>
        <h2 className="mt-2 text-2xl font-bold tracking-tight text-foreground">
          Why ZYRAXON is different
        </h2>
        <div className="mt-5 grid gap-3 sm:grid-cols-2">
          {HIGHLIGHTS.map((h) => (
            <Card key={h.title} className="p-5">
              <h3 className="text-[15px] font-bold text-foreground">{h.title}</h3>
              <p className="mt-2 text-[13px] leading-relaxed text-muted-foreground">{h.body}</p>
            </Card>
          ))}
        </div>
      </section>

      <Card className="mt-12 flex flex-wrap items-center justify-between gap-4 p-6">
        <div>
          <h3 className="text-[16px] font-bold text-foreground">Ready to try it yourself?</h3>
          <p className="mt-1 text-[13px] text-muted-foreground">
            Download the desktop agent for Windows, macOS or Linux.
          </p>
        </div>
        <div className="flex flex-wrap gap-3">
          <ButtonLink to="/download/zyraxon-agent" variant="primary" size="sm">
            Download
          </ButtonLink>
          <ButtonLink to="/releases" variant="glass" size="sm">
            All releases
          </ButtonLink>
        </div>
      </Card>
    </PageShell>
  );
}

function ClipPlayer({
  clip,
  muted,
  onUnmute,
  onMute,
}: {
  clip: Clip;
  muted: boolean;
  onUnmute: () => void;
  onMute: () => void;
}) {
  const ref = useRef<HTMLVideoElement>(null);
  const [playing, setPlaying] = useState(true);
  const [time, setTime] = useState(0);
  const [duration, setDuration] = useState(0);

  // Browsers only autoplay muted media, so the element starts muted and we
  // toggle the property imperatively when the user asks for sound.
  useEffect(() => {
    const v = ref.current;
    if (v) v.muted = muted;
  }, [muted]);

  useEffect(() => {
    const v = ref.current;
    if (!v) return;
    const tick = () => setTime(v.currentTime);
    const meta = () => setDuration(v.duration || 0);
    v.addEventListener("timeupdate", tick);
    v.addEventListener("loadedmetadata", meta);
    v.addEventListener("durationchange", meta);
    meta();
    return () => {
      v.removeEventListener("timeupdate", tick);
      v.removeEventListener("loadedmetadata", meta);
      v.removeEventListener("durationchange", meta);
    };
  }, []);

  function toggle() {
    const v = ref.current;
    if (!v) return;
    if (v.paused) {
      v.play()
        .then(() => setPlaying(true))
        .catch(() => setPlaying(false));
    } else {
      v.pause();
      setPlaying(false);
    }
  }

  function seek(e: React.ChangeEvent<HTMLInputElement>) {
    const v = ref.current;
    if (!v || !duration) return;
    const next = (Number(e.target.value) / 100) * duration;
    v.currentTime = next;
    setTime(next);
  }

  const pct = duration ? (time / duration) * 100 : 0;

  return (
    <Card className="overflow-hidden p-0">
      <div className="flex items-start justify-between gap-3 px-5 pt-5">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <Tag tone="primary">{clip.badge}</Tag>
            <h2 className="truncate text-[16px] font-bold text-foreground">{clip.title}</h2>
          </div>
          <p className="mt-1.5 text-[13px] leading-relaxed text-muted-foreground">
            {clip.subtitle}
          </p>
        </div>
      </div>

      <div className="relative mt-4 bg-black">
        <video
          ref={ref}
          src={clip.src}
          poster={clip.poster}
          autoPlay
          muted
          loop
          playsInline
          preload="metadata"
          onClick={toggle}
          onPlay={() => setPlaying(true)}
          onPause={() => setPlaying(false)}
          className="aspect-video w-full cursor-pointer object-contain"
        />

        {!playing && (
          <button
            type="button"
            onClick={toggle}
            aria-label="Play video"
            className="absolute inset-0 grid place-items-center bg-black/35 transition hover:bg-black/45"
          >
            <span className="grid h-16 w-16 place-items-center rounded-full bg-white/95 text-black shadow-xl">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
                <path d="M8 5.5v13l11-6.5-11-6.5z" />
              </svg>
            </span>
          </button>
        )}

        <div className="absolute inset-x-0 bottom-0 flex items-center gap-3 bg-gradient-to-t from-black/80 to-transparent px-4 pb-3 pt-8">
          <button
            type="button"
            onClick={toggle}
            aria-label={playing ? "Pause" : "Play"}
            className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-white/15 text-white backdrop-blur transition hover:bg-white/25"
          >
            {playing ? (
              <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                <path d="M7 5h4v14H7zM13 5h4v14h-4z" />
              </svg>
            ) : (
              <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                <path d="M8 5.5v13l11-6.5-11-6.5z" />
              </svg>
            )}
          </button>

          <button
            type="button"
            onClick={muted ? onUnmute : onMute}
            aria-label={muted ? "Unmute" : "Mute"}
            className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-white/15 text-white backdrop-blur transition hover:bg-white/25"
          >
            {muted ? (
              <svg
                width="15"
                height="15"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.9"
                strokeLinecap="round"
              >
                <path d="M11 5L6 9H3v6h3l5 4V5z" />
                <path d="M16 9l5 6M21 9l-5 6" />
              </svg>
            ) : (
              <svg
                width="15"
                height="15"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.9"
                strokeLinecap="round"
              >
                <path d="M11 5L6 9H3v6h3l5 4V5z" />
                <path d="M15.5 8.5a5 5 0 010 7M18 6a8.5 8.5 0 010 12" />
              </svg>
            )}
          </button>

          <input
            type="range"
            min={0}
            max={100}
            step={0.1}
            value={pct}
            onChange={seek}
            aria-label="Seek"
            className="h-1 w-full cursor-pointer appearance-none rounded-full bg-white/25 accent-white"
          />

          <span className="shrink-0 text-[11px] font-medium tabular-nums text-white/85">
            {fmt(time)} / {fmt(duration)}
          </span>
        </div>
      </div>

      <p className="px-5 py-3 text-[11.5px] text-muted-foreground">
        {muted
          ? "Playing muted — press the speaker to hear it."
          : "Sound on — playing the other clip stays muted."}
      </p>
    </Card>
  );
}

function fmt(seconds: number) {
  if (!Number.isFinite(seconds) || seconds < 0) return "0:00";
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${String(s).padStart(2, "0")}`;
}
