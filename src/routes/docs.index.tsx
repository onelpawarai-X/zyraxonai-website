import { createFileRoute } from "@tanstack/react-router";
import DocsShell from "@/components/docs/DocsShell";

export const Route = createFileRoute("/docs/")({
  head: () => ({
    meta: [
      { title: "Documentation — ZYRAXON AI" },
      {
        name: "description",
        content:
          "Complete technical reference for ZYRAXON-AI: 3 platforms, 9 agent modes, 552+ tools, vision system, eternal memory, self-healing, build guides and more.",
      },
    ],
  }),
  component: DocsIndex,
});

function DocsIndex() {
  return <DocsShell />;
}
