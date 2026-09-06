import { createFileRoute } from "@tanstack/react-router";

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
  return (
    <div className="fixed inset-0 w-screen h-screen bg-background">
      <iframe
        src={BUILDER_URL}
        title="ZYRAXON AI Builder"
        className="w-full h-full border-0"
        allow="clipboard-read; clipboard-write; microphone; camera; fullscreen; cross-origin-isolated"
        referrerPolicy="no-referrer-when-downgrade"
      />
    </div>
  );
}
