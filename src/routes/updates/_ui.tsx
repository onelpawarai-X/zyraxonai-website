import type { ReactNode } from "react";
import type { PublicItem } from "@/lib/content.server";

/**
 * Renders whatever media an update carries, in priority order:
 * a pasted link that can be embedded (YouTube, Vimeo, Loom, Spotify...),
 * then an uploaded video / audio / image, then nothing.
 */
export function UpdateMedia({ item }: { item: PublicItem }) {
  const { embedUrl, embedKind, imageUrl, mediaType } = item;

  if (embedUrl && embedKind === "video") {
    return (
      <div className="mt-10 overflow-hidden rounded-2xl border border-slate-200 bg-slate-900 shadow-sm">
        <div className="relative w-full" style={{ paddingTop: "56.25%" }}>
          <iframe
            src={`${embedUrl}${embedUrl.includes("?") ? "&" : "?"}rel=0`}
            title={item.title}
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; fullscreen"
            allowFullScreen
            loading="lazy"
            className="absolute inset-0 h-full w-full border-0"
          />
        </div>
      </div>
    );
  }

  if (embedUrl && embedKind === "audio") {
    return (
      <div className="mt-10 rounded-2xl border border-slate-200 bg-slate-50 p-4">
        <iframe
          src={embedUrl}
          title={item.title}
          height={152}
          scrolling="no"
          frameBorder="no"
          allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
          loading="lazy"
          className="w-full rounded-xl"
        />
      </div>
    );
  }

  if (mediaType === "video" && imageUrl) {
    return (
      <div className="mt-10 overflow-hidden rounded-2xl border border-slate-200 bg-slate-900 shadow-sm">
        <video
          src={imageUrl}
          controls
          playsInline
          preload="metadata"
          className="w-full"
        />
      </div>
    );
  }

  if (mediaType === "audio" && imageUrl) {
    return (
      <div className="mt-10 rounded-2xl border border-slate-200 bg-slate-50 p-5">
        <audio src={imageUrl} controls preload="metadata" className="w-full" />
      </div>
    );
  }

  if (imageUrl) {
    return (
      <img
        src={imageUrl}
        alt={item.title}
        loading="lazy"
        className="mt-10 w-full rounded-2xl border border-slate-200 shadow-sm"
      />
    );
  }

  return null;
}

export function UpdateShell({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-white text-slate-900 antialiased">
      <header className="sticky top-0 z-50 border-b border-slate-200/80 bg-white/85 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-5xl items-center justify-between px-6">
          <a href="/" className="flex items-center gap-2.5">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-cyan-500 to-blue-600 text-white shadow-sm">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" aria-hidden="true">
                <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />
              </svg>
            </span>
            <span className="text-[17px] font-bold tracking-tight">ZYRAXON AI</span>
          </a>
          <nav className="flex items-center gap-6 text-sm font-medium text-slate-600">
            <a href="/updates" className="transition hover:text-slate-900">
              Updates
            </a>
            <a href="/docs" className="transition hover:text-slate-900">
              Docs
            </a>
            <a
              href="/"
              className="rounded-full bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-700"
            >
              Website
            </a>
          </nav>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-6">{children}</main>

      <footer className="mt-20 border-t border-slate-200">
        <div className="mx-auto flex max-w-5xl flex-col gap-3 px-6 py-10 text-sm text-slate-500 sm:flex-row sm:items-center sm:justify-between">
          <p>© 2026 ZYRAXON AI Systems. All rights reserved.</p>
          <div className="flex gap-5">
            <a href="/updates" className="transition hover:text-slate-900">
              Updates
            </a>
            <a href="/faq" className="transition hover:text-slate-900">
              FAQ
            </a>
            <a href="/zsl" className="transition hover:text-slate-900">
              ZSL License
            </a>
            <a href="/privacy-policy" className="transition hover:text-slate-900">
              Privacy
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}
