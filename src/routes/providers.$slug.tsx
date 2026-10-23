import { createFileRoute } from "@tanstack/react-router";
import ProviderFunctionPage from "@/components/site/ProviderFunctionPage";
import { getProviderFunction } from "@/lib/providers/functions";

const ORIGIN = "https://zyraxonai.lovable.app";

export const Route = createFileRoute("/providers/$slug")({
  head: (ctx) => {
    const fn = getProviderFunction(ctx.params.slug);
    const title = fn
      ? `${fn.name} — ZYRAXON Provider`
      : "Provider function — ZYRAXON Provider";
    const description =
      fn?.summary ??
      "One function of the ZYRAXON Provider: an OpenAI-compatible model line, speech in and out, and every host app that connects to it.";
    const url = `${ORIGIN}/providers/${ctx.params.slug}`;
    return {
      meta: [
        { title },
        { name: "description", content: description },
        {
          name: "keywords",
          content: [
            fn?.name,
            fn?.group,
            "ZYRAXON Provider",
            "OpenAI-compatible",
            ...(fn?.tags ?? []),
          ]
            .filter(Boolean)
            .join(", "),
        },
        { property: "og:title", content: title },
        { property: "og:description", content: description },
        { property: "og:type", content: "article" },
        { property: "og:url", content: url },
        { name: "twitter:card", content: "summary_large_image" },
        { name: "twitter:title", content: title },
        { name: "twitter:description", content: description },
      ],
      links: [{ rel: "canonical", href: url }],
      scripts: fn
        ? [
            {
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
                articleSection: fn.group,
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
                  {
                    "@type": "ListItem",
                    position: 2,
                    name: "Provider",
                    item: `${ORIGIN}/providers`,
                  },
                  { "@type": "ListItem", position: 3, name: fn.name, item: url },
                ],
              }),
            },
          ]
        : [],
    };
  },
  component: ProviderFunctionRoute,
});

function ProviderFunctionRoute() {
  const { slug } = Route.useParams();
  return <ProviderFunctionPage slug={slug} />;
}
