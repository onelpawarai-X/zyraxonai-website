import type { ReactNode } from "react";
import type { PublicItem } from "@/lib/content.server";
import { SiteFooter, SiteHeader } from "@/components/site/SiteChrome";

/**
 * Renders whatever media an update carries, in priority order:
 * a pasted link that can be embedded (YouTube, Vimeo, Loom, Spotify...),
 * then an uploaded video / audio / image, then nothing.
 */
export function UpdateMedia({ item }: { item: PublicItem }) {
  const { embedUrl, embedKind, imageUrl, mediaType } = item;

  if (embedUrl && embedKind === "video") {
    return (
      <div className="mt-10 overflow-hidden rounded-2xl border border-border bg-[#0a0a0f] shadow-sm">
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
      <div className="zx-glass mt-10 rounded-2xl p-4">
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
      <div className="mt-10 overflow-hidden rounded-2xl border border-border bg-[#0a0a0f] shadow-sm">
        <video src={imageUrl} controls playsInline preload="metadata" className="w-full" />
      </div>
    );
  }

  if (mediaType === "audio" && imageUrl) {
    return (
      <div className="zx-glass mt-10 rounded-2xl p-5">
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
        className="mt-10 w-full rounded-2xl border border-border shadow-sm"
      />
    );
  }

  return null;
}

export function UpdateShell({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-[var(--plane)]">
      <SiteHeader />
      <main className="px-3 pt-4 sm:px-5 sm:pt-5">
        <div className="mx-auto max-w-5xl">
          <div className="zx-sheet px-6 py-10 sm:px-10 sm:py-14">{children}</div>
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
