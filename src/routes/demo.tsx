import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
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
      {
        name: "keywords",
        content: "ZYRAXON demo, AI agent demo video, ZYRAXON walkthrough, Bengali AI demo",
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
    links: [{ rel: "canonical", href: "https://zyraxonai.lovable.app/demo" }],
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

const SHOTS = [1, 2, 3, 4, 5, 6].map((n) => ({
  src: `/media/zyraxon-shot-${n}.jpg`,
  caption: `ZYRAXON agent screenshot ${n}`,
}));

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

const ZOOM_STEPS = [1, 1.25, 1.5, 2, 3];

function DemoPage() {
  // Only one clip may play with sound; the rest stay muted so the browser
  // never blocks autoplay.
  const [unmuted, setUnmuted] = useState<string | null>(null);
  const [lightbox, setLightbox] = useState<number | null>(null);

  return (
    <PageShell>
      <PageHeader
        label="ZYRAXON-AI // Demo"
        title="See it in action"
        description="Two full walkthroughs of the ZYRAXON desktop agent — one in English, one in Bengali — from the v19.0.6 release. Both start playing on their own, muted. Press the sound button to hear one. Use zoom and fullscreen for a closer look."
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
          verification. Click any shot to open it full screen and zoom in.
        </p>
        <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {SHOTS.map((shot, i) => (
            <button
              key={shot.src}
              type="button"
              onClick={() => setLightbox(i)}
              aria-label={`Open ${shot.caption} full screen`}
              className="zx-glass group block overflow-hidden rounded-2xl"
            >
              <img
                src={shot.src}
                alt={shot.caption}
                loading="lazy"
                className="aspect-video w-full object-cover transition duration-300 group-hover:scale-[1.03]"
              />
            </button>
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

      {lightbox !== null && (
        <Lightbox
          shots={SHOTS}
          index={lightbox}
          onClose={() => setLightbox(null)}
          onNavigate={setLightbox}
        />
      )}
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
  const wrapRef = useRef<HTMLDivElement>(null);
  const [playing, setPlaying] = useState(true);
  const [time, setTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [isFs, setIsFs] = useState(false);
  const [zoom, setZoom] = useState(1);
  const [fit, setFit] = useState<"contain" | "cover">("contain");

  // The muted state is applied imperatively. Passing `muted` as a JSX prop
  // makes React re-apply the attribute on every render, which silently killed
  // the sound the moment any state changed.
  useEffect(() => {
    const v = ref.current;
    if (!v) return;
    v.muted = muted;
    if (!muted) v.volume = 1;
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

  useEffect(() => {
    const onChange = () => setIsFs(document.fullscreenElement === wrapRef.current);
    document.addEventListener("fullscreenchange", onChange);
    return () => document.removeEventListener("fullscreenchange", onChange);
  }, []);

  const toggle = useCallback(() => {
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
  }, []);

  function enableSound() {
    const v = ref.current;
    if (!v) return;
    onUnmute();
    v.muted = false;
    v.volume = 1;
    // A click is a user gesture, so this is the moment sound is allowed.
    void v.play().catch(() => undefined);
  }

  function seek(e: React.ChangeEvent<HTMLInputElement>) {
    const v = ref.current;
    if (!v || !duration) return;
    const next = (Number(e.target.value) / 100) * duration;
    v.currentTime = next;
    setTime(next);
  }

  function zoomBy(dir: 1 | -1) {
    setZoom((z) => {
      const i = ZOOM_STEPS.indexOf(z);
      const next = i === -1 ? 1 : ZOOM_STEPS[Math.min(ZOOM_STEPS.length - 1, Math.max(0, i + dir))];
      return next;
    });
  }

  async function toggleFullscreen() {
    const el = wrapRef.current;
    const v = ref.current;
    if (!el) return;
    try {
      if (document.fullscreenElement) {
        await document.exitFullscreen();
      } else if (el.requestFullscreen) {
        await el.requestFullscreen();
      } else if (v && "webkitEnterFullscreen" in v) {
        // iOS Safari only exposes fullscreen on the video element itself.
        (v as HTMLVideoElement & { webkitEnterFullscreen: () => void }).webkitEnterFullscreen();
      }
    } catch {
      /* the browser refused; leave the inline view as-is */
    }
  }

  const pct = duration ? (time / duration) * 100 : 0;
  const zoomPct = Math.round(zoom * 100);

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

      <div
        ref={wrapRef}
        className={`relative mt-4 bg-black ${isFs ? "flex h-screen flex-col" : ""}`}
      >
        <div className={`relative overflow-hidden bg-black ${isFs ? "flex-1" : "aspect-video"}`}>
          <video
            ref={ref}
            src={clip.src}
            poster={clip.poster}
            autoPlay
            loop
            playsInline
            preload="metadata"
            onClick={toggle}
            onPlay={() => setPlaying(true)}
            onPause={() => setPlaying(false)}
            style={{ objectFit: fit, transform: `scale(${zoom})` }}
            className="h-full w-full cursor-pointer transition-transform duration-200"
          />

          {muted && (
            <button
              type="button"
              onClick={enableSound}
              className="absolute inset-x-0 bottom-0 top-0 z-10 grid place-items-center bg-black/25 transition hover:bg-black/35"
              aria-label={`Turn on sound (${clip.badge})`}
            >
              <span className="flex items-center gap-2 rounded-full bg-white/95 px-5 py-3 text-[13px] font-semibold text-black shadow-xl">
                <svg
                  width="18"
                  height="18"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.9"
                  strokeLinecap="round"
                >
                  <path d="M11 5L6 9H3v6h3l5 4V5z" />
                  <path d="M15.5 8.5a5 5 0 010 7M18 6a8.5 8.5 0 010 12" />
                </svg>
                Tap for sound
              </span>
            </button>
          )}

          {!playing && (
            <button
              type="button"
              onClick={toggle}
              aria-label={`Play (${clip.badge})`}
              className="absolute inset-0 z-20 grid place-items-center bg-black/30 transition hover:bg-black/40"
            >
              <span className="grid h-16 w-16 place-items-center rounded-full bg-white/95 text-black shadow-xl">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M8 5.5v13l11-6.5-11-6.5z" />
                </svg>
              </span>
            </button>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-x-3 gap-y-2 bg-black/90 px-3 py-2.5">
          <button
            type="button"
            onClick={toggle}
            aria-label={`${playing ? "Pause" : "Play"} (${clip.badge})`}
            className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-white/15 text-white transition hover:bg-white/25"
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
            onClick={muted ? enableSound : onMute}
            aria-label={`${muted ? "Turn on sound" : "Mute"} (${clip.badge})`}
            title={muted ? "Turn on sound" : "Mute"}
            className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-white/15 text-white transition hover:bg-white/25"
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

          <span className="shrink-0 text-[11px] font-medium tabular-nums text-white/85">
            {fmt(time)}
          </span>

          <input
            type="range"
            min={0}
            max={100}
            step={0.1}
            value={pct}
            onChange={seek}
            aria-label={`Seek (${clip.badge})`}
            className="h-1 min-w-[80px] flex-1 cursor-pointer appearance-none rounded-full bg-white/25 accent-white"
          />

          <span className="shrink-0 text-[11px] font-medium tabular-nums text-white/85">
            {fmt(duration)}
          </span>

          <div className="flex shrink-0 items-center gap-1 rounded-full bg-white/10 px-1 py-1">
            <button
              type="button"
              onClick={() => zoomBy(-1)}
              disabled={zoom <= ZOOM_STEPS[0]}
              aria-label={`Zoom out (${clip.badge})`}
              title="Zoom out"
              className="grid h-6 w-6 place-items-center rounded-full text-white transition hover:bg-white/20 disabled:opacity-35"
            >
              <svg
                width="13"
                height="13"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.2"
                strokeLinecap="round"
              >
                <path d="M5 12h14" />
              </svg>
            </button>
            <span className="w-9 text-center text-[11px] font-semibold tabular-nums text-white/85">
              {zoomPct}%
            </span>
            <button
              type="button"
              onClick={() => zoomBy(1)}
              disabled={zoom >= ZOOM_STEPS[ZOOM_STEPS.length - 1]}
              aria-label={`Zoom in (${clip.badge})`}
              title="Zoom in"
              className="grid h-6 w-6 place-items-center rounded-full text-white transition hover:bg-white/20 disabled:opacity-35"
            >
              <svg
                width="13"
                height="13"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.2"
                strokeLinecap="round"
              >
                <path d="M12 5v14M5 12h14" />
              </svg>
            </button>
          </div>

          <button
            type="button"
            onClick={() => {
              setFit((f) => (f === "contain" ? "cover" : "contain"));
              setZoom(1);
            }}
            aria-label={`Toggle fit and fill (${clip.badge})`}
            title={fit === "contain" ? "Fill the frame" : "Fit the whole frame"}
            className="shrink-0 rounded-full bg-white/15 px-2.5 py-1 text-[11px] font-semibold text-white transition hover:bg-white/25"
          >
            {fit === "contain" ? "Fit" : "Fill"}
          </button>

          <button
            type="button"
            onClick={toggleFullscreen}
            aria-label={`Full screen (${clip.badge})`}
            title="Full screen"
            className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-white/15 text-white transition hover:bg-white/25"
          >
            <svg
              width="15"
              height="15"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.9"
              strokeLinecap="round"
            >
              <path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5" />
            </svg>
          </button>
        </div>
      </div>

      <p className="px-5 py-3 text-[11.5px] text-muted-foreground">
        {muted
          ? "Playing muted — press the sound button to hear it."
          : "Sound on — the other clip stays muted."}
      </p>
    </Card>
  );
}

const LIGHTBOX_ZOOM = [1, 1.5, 2, 3, 4];

function Lightbox({
  shots,
  index,
  onClose,
  onNavigate,
}: {
  shots: { src: string; caption: string }[];
  index: number;
  onClose: () => void;
  onNavigate: (i: number) => void;
}) {
  const shot = shots[index];
  const wrapRef = useRef<HTMLDivElement>(null);
  const [mounted, setMounted] = useState(false);
  const [zoom, setZoom] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const drag = useRef<{ x: number; y: number; ox: number; oy: number } | null>(null);

  useEffect(() => setMounted(true), []);

  const step = useCallback(
    (dir: 1 | -1) => onNavigate((index + dir + shots.length) % shots.length),
    [index, shots.length, onNavigate],
  );

  const zoomBy = useCallback((dir: 1 | -1) => {
    setZoom((z) => {
      const i = LIGHTBOX_ZOOM.indexOf(z);
      const next =
        i === -1 ? 1 : LIGHTBOX_ZOOM[Math.min(LIGHTBOX_ZOOM.length - 1, Math.max(0, i + dir))];
      if (next === 1) setOffset({ x: 0, y: 0 });
      return next;
    });
  }, []);

  useEffect(() => {
    setZoom(1);
    setOffset({ x: 0, y: 0 });
  }, [index]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      else if (e.key === "ArrowRight") step(1);
      else if (e.key === "ArrowLeft") step(-1);
      else if (e.key === "+" || e.key === "=") zoomBy(1);
      else if (e.key === "-" || e.key === "_") zoomBy(-1);
    };
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [onClose, step, zoomBy]);

  // Wheel zoom needs a non-passive listener so the page does not scroll behind
  // the overlay while the image is being zoomed.
  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      zoomBy(e.deltaY < 0 ? 1 : -1);
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, [zoomBy]);

  async function toggleFullscreen() {
    const el = wrapRef.current;
    if (!el) return;
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else await el.requestFullscreen();
    } catch {
      /* ignore */
    }
  }

  function onPointerDown(e: React.PointerEvent<HTMLImageElement>) {
    if (zoom <= 1) return;
    drag.current = { x: e.clientX, y: e.clientY, ox: offset.x, oy: offset.y };
    e.currentTarget.setPointerCapture(e.pointerId);
  }

  function onPointerMove(e: React.PointerEvent<HTMLImageElement>) {
    const d = drag.current;
    if (!d) return;
    setOffset({ x: d.ox + (e.clientX - d.x), y: d.oy + (e.clientY - d.y) });
  }

  function onPointerUp(e: React.PointerEvent<HTMLImageElement>) {
    drag.current = null;
    if (e.currentTarget.hasPointerCapture(e.pointerId)) {
      e.currentTarget.releasePointerCapture(e.pointerId);
    }
  }

  // The dialog is portalled to <body> and sits above the sticky site header
  // (z-50); anything lower and the header swallows clicks on these buttons.
  if (!mounted) return null;

  return createPortal(
    <div
      ref={wrapRef}
      className="fixed inset-0 z-[100] flex flex-col bg-black"
      role="dialog"
      aria-modal="true"
      aria-label={shot.caption}
    >
      <div className="flex items-center justify-between gap-3 px-4 py-3">
        <p className="truncate text-[13px] font-medium text-white/90">
          {shot.caption}{" "}
          <span className="text-white/50">
            ({index + 1}/{shots.length})
          </span>
        </p>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1 rounded-full bg-white/10 px-1 py-1">
            <button
              type="button"
              onClick={() => zoomBy(-1)}
              disabled={zoom <= LIGHTBOX_ZOOM[0]}
              aria-label="Zoom out"
              className="grid h-7 w-7 place-items-center rounded-full text-white transition hover:bg-white/20 disabled:opacity-35"
            >
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.2"
                strokeLinecap="round"
              >
                <path d="M5 12h14" />
              </svg>
            </button>
            <span className="w-11 text-center text-[12px] font-semibold tabular-nums text-white/85">
              {Math.round(zoom * 100)}%
            </span>
            <button
              type="button"
              onClick={() => zoomBy(1)}
              disabled={zoom >= LIGHTBOX_ZOOM[LIGHTBOX_ZOOM.length - 1]}
              aria-label="Zoom in"
              className="grid h-7 w-7 place-items-center rounded-full text-white transition hover:bg-white/20 disabled:opacity-35"
            >
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.2"
                strokeLinecap="round"
              >
                <path d="M12 5v14M5 12h14" />
              </svg>
            </button>
          </div>
          <button
            type="button"
            onClick={() => {
              setZoom(1);
              setOffset({ x: 0, y: 0 });
            }}
            aria-label="Reset zoom"
            className="rounded-full bg-white/10 px-3 py-1.5 text-[12px] font-semibold text-white transition hover:bg-white/20"
          >
            Reset
          </button>
          <button
            type="button"
            onClick={toggleFullscreen}
            aria-label="Full screen"
            title="Full screen"
            className="grid h-8 w-8 place-items-center rounded-full bg-white/10 text-white transition hover:bg-white/20"
          >
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.9"
              strokeLinecap="round"
            >
              <path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5" />
            </svg>
          </button>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="grid h-8 w-8 place-items-center rounded-full bg-white/10 text-white transition hover:bg-white/20"
          >
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
            >
              <path d="M6 6l12 12M18 6L6 18" />
            </svg>
          </button>
        </div>
      </div>

      <div className="relative flex-1 overflow-hidden">
        <img
          src={shot.src}
          alt={shot.caption}
          onDoubleClick={() => zoomBy(zoom > 1 ? -1 : 1)}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
          draggable={false}
          style={{
            transform: `translate(${offset.x}px, ${offset.y}px) scale(${zoom})`,
            cursor: zoom > 1 ? "grab" : "zoom-in",
          }}
          className="h-full w-full select-none object-contain transition-transform duration-150"
        />

        {shots.length > 1 && (
          <>
            <button
              type="button"
              onClick={() => step(-1)}
              aria-label="Previous screenshot"
              className="absolute left-3 top-1/2 grid h-11 w-11 -translate-y-1/2 place-items-center rounded-full bg-white/10 text-white transition hover:bg-white/25"
            >
              <svg
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
              >
                <path d="M15 5l-7 7 7 7" />
              </svg>
            </button>
            <button
              type="button"
              onClick={() => step(1)}
              aria-label="Next screenshot"
              className="absolute right-3 top-1/2 grid h-11 w-11 -translate-y-1/2 place-items-center rounded-full bg-white/10 text-white transition hover:bg-white/25"
            >
              <svg
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
              >
                <path d="M9 5l7 7-7 7" />
              </svg>
            </button>
          </>
        )}
      </div>

      <p className="px-4 py-3 text-center text-[11.5px] text-white/55">
        Scroll or use + / − to zoom · double-click to toggle · drag to pan · arrow keys to browse ·
        Esc to close
      </p>
    </div>,
    document.body,
  );
}

function fmt(seconds: number) {
  if (!Number.isFinite(seconds) || seconds < 0) return "0:00";
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${String(s).padStart(2, "0")}`;
}
