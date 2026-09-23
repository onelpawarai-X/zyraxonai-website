import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";

const BUILDER_URL = "https://zyraxon-pro-x.lovable.app/";

export const Route = createFileRoute("/builder")({
  head: () => ({
    meta: [
      { title: "ZYRAXON AI Builder — Build Without Limits" },
      {
        name: "description",
        content:
          "Build, preview, edit, export and publish websites with ZYRAXON AI Builder. Describe your idea and watch it come to life with live preview and one-click deploy.",
      },
      { property: "og:title", content: "ZYRAXON AI Builder — Build Without Limits" },
      {
        property: "og:description",
        content:
          "Build, preview, edit, export and publish websites with ZYRAXON AI Builder. Describe your idea and watch it come to life with live preview and one-click deploy.",
      },
      { property: "og:type", content: "website" },
      { property: "og:url", content: "https://zyraxonai.lovable.app/builder" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:title", content: "ZYRAXON AI Builder — Build Without Limits" },
      {
        name: "twitter:description",
        content:
          "Build, preview, edit, export and publish websites with ZYRAXON AI Builder. Describe your idea and watch it come to life with live preview and one-click deploy.",
      },
    ],
    scripts: [
      {
        type: "application/ld+json",
        children: JSON.stringify({
          "@context": "https://schema.org",
          "@type": "SoftwareApplication",
          name: "ZYRAXON AI Builder",
          applicationCategory: "DeveloperApplication",
          operatingSystem: "Web",
          description:
            "AI-powered website builder that lets you create, preview, edit and publish production-ready websites from natural language prompts.",
          url: "https://zyraxonai.lovable.app/builder",
          offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
        }),
      },
    ],
  }),
  component: BuilderRoute,
});

function BuilderRoute() {
  const [nonce, setNonce] = useState(() => Date.now());
  return (
    <div className="fixed inset-0 w-screen h-screen bg-background">
      <h1 className="sr-only">ZYRAXON AI Builder — Build Websites with AI</h1>
      <iframe
        key={nonce}
        src={`${BUILDER_URL}?fresh=${nonce}`}
        title="ZYRAXON AI Builder"
        className="w-full h-full border-0"
        allow="clipboard-read; clipboard-write; microphone; camera; fullscreen; cross-origin-isolated"
        referrerPolicy="no-referrer-when-downgrade"
      />
      <button
        type="button"
        onClick={() => setNonce(Date.now())}
        aria-label="Refresh ZYRAXON AI Builder studio"
        className="absolute bottom-4 right-4 rounded-full border border-cyan-400/30 bg-black/60 px-4 py-2 text-xs font-medium text-cyan-100 backdrop-blur-xl transition hover:bg-black/80"
      >
        ⟳ Refresh studio
      </button>
    </div>
  );
}
