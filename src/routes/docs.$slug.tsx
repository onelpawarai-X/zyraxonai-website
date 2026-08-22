import { createFileRoute } from "@tanstack/react-router";
import DocsShell from "@/components/docs/DocsShell";
import { getDoc } from "@/lib/docs/content";

export const Route = createFileRoute("/docs/$slug")({
  head: (ctx) => ({
    meta: [
      { title: `${getDoc(ctx.params.slug)?.title ?? "Documentation"} — ZYRAXON AI Docs` },
      {
        name: "description",
        content: getDoc(ctx.params.slug)?.desc ?? "Official ZYRAXON-AI technical documentation.",
      },
    ],
  }),
  component: DocPage,
});

function DocPage() {
  const { slug } = Route.useParams();
  return <DocsShell slug={slug} />;
}
