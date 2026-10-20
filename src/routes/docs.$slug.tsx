import { createFileRoute } from "@tanstack/react-router";
import DocsShell from "@/components/docs/DocsShell";
import { getDoc } from "@/lib/docs/content";

const ORIGIN = "https://zyraxonai.lovable.app";

export const Route = createFileRoute("/docs/$slug")({
  head: (ctx) => {
    const doc = getDoc(ctx.params.slug);
    const title = doc?.title ?? "Documentation";
    const description = doc?.desc ?? "Official ZYRAXON-AI technical documentation.";
    const url = `${ORIGIN}/docs/${ctx.params.slug}`;
    return {
      meta: [
        { title: `${title} — ZYRAXON AI Docs` },
        { name: "description", content: description },
        {
          name: "keywords",
          content: `${title}, ZYRAXON, ZYRAXON AI, ${doc?.group ?? "documentation"}, AI agent, API`,
        },
        { property: "og:title", content: `${title} — ZYRAXON AI Docs` },
        { property: "og:description", content: description },
        { property: "og:type", content: "article" },
        { property: "og:url", content: url },
        { name: "twitter:card", content: "summary_large_image" },
        { name: "twitter:title", content: `${title} — ZYRAXON AI Docs` },
        { name: "twitter:description", content: description },
      ],
      links: [{ rel: "canonical", href: url }],
      scripts: [
        {
          // TechArticle is the right type for a reference page, and it is what
          // gets a doc page into the results rather than a generic snippet.
          type: "application/ld+json",
          children: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "TechArticle",
            headline: title,
            description,
            url,
            inLanguage: "en",
            author: { "@type": "Organization", name: "ZYRAXON AI", url: ORIGIN },
            publisher: { "@type": "Organization", name: "ZYRAXON AI", url: ORIGIN },
            articleSection: doc?.group ?? "Documentation",
            isPartOf: { "@type": "WebSite", name: "ZYRAXON AI", url: ORIGIN },
          }),
        },
        {
          type: "application/ld+json",
          children: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "BreadcrumbList",
            itemListElement: [
              { "@type": "ListItem", position: 1, name: "Home", item: `${ORIGIN}/` },
              { "@type": "ListItem", position: 2, name: "Documentation", item: `${ORIGIN}/docs` },
              { "@type": "ListItem", position: 3, name: title, item: url },
            ],
          }),
        },
      ],
    };
  },
  component: DocPage,
});

function DocPage() {
  const { slug } = Route.useParams();
  return <DocsShell slug={slug} />;
}
