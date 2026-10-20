/** Shared SEO helpers, so every page describes itself the same way.
 *
 *  Written once because the failure mode is a page that is reachable but never
 *  indexed: it has a title but no description, or a description but no canonical
 *  URL, or no structured data at all. A single `pageSeo()` call gives a page all
 *  of it, so a new page is indexable by default rather than by remembering to
 *  add six tags. */

export const SITE_ORIGIN = "https://zyraxonai.lovable.app";
export const SITE_NAME = "ZYRAXON AI";

export type SeoInput = {
  /** The path only, e.g. `/docs/speech`. The origin is added. */
  path: string;
  title: string;
  description: string;
  /** Extra search terms, beyond what the description already contains. */
  keywords?: string[];
  /** `website` for a hub, `article` for a page of content. */
  type?: "website" | "article";
  /** A short label for the breadcrumb, e.g. `Documentation`. */
  section?: string;
  /** Structured data to add, merged into an `@graph`. */
  jsonLd?: Array<Record<string, unknown>>;
};

/** The tags a page needs to be found. Spread into a route's `head()`. */
export function pageSeo(input: SeoInput) {
  const url = `${SITE_ORIGIN}${input.path}`;
  const type = input.type ?? "website";
  const keywords = [
    "ZYRAXON",
    "ZYRAXON AI",
    ...(input.section ? [input.section] : []),
    ...(input.keywords ?? []),
  ].join(", ");

  return {
    meta: [
      { title: input.title },
      { name: "description", content: input.description },
      { name: "keywords", content: keywords },
      { property: "og:title", content: input.title },
      { property: "og:description", content: input.description },
      { property: "og:type", content: type },
      { property: "og:url", content: url },
      { property: "og:site_name", content: SITE_NAME },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:title", content: input.title },
      { name: "twitter:description", content: input.description },
    ],
    links: [{ rel: "canonical", href: url }],
    scripts: [
      {
        type: "application/ld+json",
        children: JSON.stringify({
          "@context": "https://schema.org",
          "@graph": [
            {
              "@type": type === "article" ? "TechArticle" : "WebPage",
              headline: input.title,
              name: input.title,
              description: input.description,
              url,
              inLanguage: "en",
              isPartOf: { "@type": "WebSite", name: SITE_NAME, url: SITE_ORIGIN },
              publisher: { "@type": "Organization", name: SITE_NAME, url: SITE_ORIGIN },
            },
            {
              "@type": "BreadcrumbList",
              itemListElement: [
                { "@type": "ListItem", position: 1, name: "Home", item: `${SITE_ORIGIN}/` },
                ...(input.section
                  ? [
                      {
                        "@type": "ListItem",
                        position: 2,
                        name: input.section,
                        item: url,
                      },
                    ]
                  : []),
              ],
            },
            ...(input.jsonLd ?? []),
          ],
        }),
      },
    ],
  };
}

/** A FAQ block, for the pages where a question is what people search. */
export function faqSchema(pairs: Array<[string, string]>) {
  return {
    "@type": "FAQPage",
    mainEntity: pairs.map(([question, answer]) => ({
      "@type": "Question",
      name: question,
      acceptedAnswer: { "@type": "Answer", text: answer },
    })),
  };
}
