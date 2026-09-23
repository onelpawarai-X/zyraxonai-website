import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";

const BUILDER_URL = "https://zyraxon-pro-x.lovable.app/";

export const Route = createFileRoute("/bludar")({
  head: () => ({
    meta: [
      { title: "ZYRAXON AI Bludar — Build Without Limits" },
      {
        name: "description",
        content: "Build, preview, edit, export and publish websites with ZYRAXON AI Bludar website builder.",
      },
      { property: "og:title", content: "ZYRAXON AI Bludar" },
      {
        property: "og:description",
        content: "Build, preview, edit, export and publish websites with ZYRAXON AI Bludar website builder.",
      },
      { property: "og:type", content: "website" },
      { property: "og:url", content: "https://zyraxonai.lovable.app/bludar" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
    scripts: [
      {
        type: "application/ld+json",
        children: JSON.stringify({
          "@context": "https://schema.org",
          "@type": "SoftwareApplication",
          name: "ZYRAXON AI Bludar",
          applicationCategory: "DeveloperApplication",
          operatingSystem: "Web",
          description: "AI-powered website builder to create, preview, edit and publish websites from natural language.",
          url: "https://zyraxonai.lovable.app/bludar",
        }),
      },
    ],
  }),
  component: BludarRoute,
});

function BludarRoute() {
  // Bumping this key forces a completely fresh load of the studio.
  const [nonce, setNonce] = useState(() => Date.now());

  return (
    <div className="fixed inset-0 w-screen h-screen bg-background">
      <h1 className="sr-only">ZYRAXON AI Bludar — Build Websites with AI</h1>
      <iframe
        key={nonce}
        src={`${BUILDER_URL}?fresh=${nonce}`}
        title="ZYRAXON AI Bludar"
        className="w-full h-full border-0"
        allow="clipboard-read; clipboard-write; microphone; camera; fullscreen; cross-origin-isolated"
        referrerPolicy="no-referrer-when-downgrade"
      />
      <button
        type="button"
        onClick={() => setNonce(Date.now())}
        aria-label="Refresh ZYRAXON AI Bludar studio"
        className="absolute bottom-4 right-4 rounded-full border border-cyan-400/30 bg-black/60 px-4 py-2 text-xs font-medium text-cyan-100 backdrop-blur-xl transition hover:bg-black/80"
      >
        ⟳ Refresh studio
      </button>
    </div>
  );
}
