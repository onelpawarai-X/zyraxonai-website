import { createFileRoute } from "@tanstack/react-router";
import DocsShell from "@/components/docs/DocsShell";

export const Route = createFileRoute("/docs/")({
  head: () => ({
    meta: [
      { title: "Documentation — ZYRAXON AI" },
      {
        name: "description",
        content:
          "Complete technical reference for ZYRAXON-AI: 3 platforms, 9 agent modes, 805+ tools, 224 control systems, vision system, eternal memory, self-healing, build guides and more.",
      },
      { property: "og:title", content: "Documentation — ZYRAXON AI" },
      {
        property: "og:description",
        content:
          "Complete technical reference for ZYRAXON-AI: 3 platforms, 9 agent modes, 805+ tools, 224 control systems, vision system, eternal memory and build guides.",
      },
      { property: "og:type", content: "website" },
      { property: "og:url", content: "https://zyraxonai.lovable.app/docs" },
      { name: "twitter:card", content: "summary" },
      { name: "twitter:title", content: "Documentation — ZYRAXON AI" },
      {
        name: "twitter:description",
        content:
          "Complete technical reference for ZYRAXON-AI: 3 platforms, 9 agent modes, 805+ tools, 224 control systems and build guides.",
      },
    ],
  }),
  component: DocsIndex,
});

function DocsIndex() {
  return <DocsShell />;
}
