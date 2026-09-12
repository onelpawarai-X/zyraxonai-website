import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";

const BUILDER_URL = "https://zyraxon-pro.ai.studio/";

export const Route = createFileRoute("/builder")({
  head: () => ({
    meta: [
      { title: "ZYRAXON AI Builder — Build Without Limits" },
      {
        name: "description",
        content: "Build, preview, edit, export and publish websites with ZYRAXON AI.",
      },
      { property: "og:title", content: "ZYRAXON AI Builder" },
      {
        property: "og:description",
        content: "Build, preview, edit, export and publish websites with ZYRAXON AI.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: BuilderRoute,
});

function BuilderRoute() {
  const [nonce, setNonce] = useState(() => Date.now());
  return (
    <div className="fixed inset-0 w-screen h-screen bg-background">
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
        className="absolute bottom-4 right-4 rounded-full border border-cyan-400/30 bg-black/60 px-4 py-2 text-xs font-medium text-cyan-100 backdrop-blur-xl transition hover:bg-black/80"
      >
        ⟳ Refresh studio
      </button>
    </div>
  );
}
