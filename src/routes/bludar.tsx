import { createFileRoute } from "@tanstack/react-router";

const BUILDER_URL = "https://zyraxon-pro.ai.studio/";

export const Route = createFileRoute("/bludar")({
  head: () => ({
    meta: [
      { title: "ZYRAXON AI Bludar — Build Without Limits" },
      {
        name: "description",
        content: "Build, preview, edit, export and publish websites with ZYRAXON AI.",
      },
      { property: "og:title", content: "ZYRAXON AI Bludar" },
      {
        property: "og:description",
        content: "Build, preview, edit, export and publish websites with ZYRAXON AI.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: BludarRoute,
});

function BludarRoute() {
  return (
    <div className="fixed inset-0 w-screen h-screen bg-background">
      <iframe
        src={BUILDER_URL}
        title="ZYRAXON AI Bludar"
        className="w-full h-full border-0"
        allow="clipboard-read; clipboard-write; microphone; camera; fullscreen; cross-origin-isolated"
        referrerPolicy="no-referrer-when-downgrade"
      />
    </div>
  );
}
