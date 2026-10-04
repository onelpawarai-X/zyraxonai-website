import { createFileRoute } from "@tanstack/react-router";
import { loadContentBySlug, SITE_ORIGIN } from "@/lib/content.server";
import { UpdateMedia, UpdateShell } from "./_ui";

export const Route = createFileRoute("/updates/$slug")({
  loader: async ({ params }) => {
    const item = await loadContentBySlug(params.slug).catch(() => null);
    return { item };
  },
  head: ({ loaderData }) => {
    const item = loaderData?.item;
    if (!item) {
      return {
        meta: [
          { title: "Update not found — ZYRAXON AI" },
          { name: "robots", content: "noindex" },
        ],
      };
    }
    const description =
      item.body?.slice(0, 300) || item.subtitle || `Latest from ZYRAXON AI: ${item.title}`;
    const url = `${SITE_ORIGIN}/updates/${item.slug}`;
    return {
      meta: [
        { title: `${item.title} — ZYRAXON AI` },
        { name: "description", content: description },
        { property: "og:title", content: item.title },
        { property: "og:description", content: description },
        { property: "og:type", content: "article" },
        { property: "og:url", content: url },
        { property: "og:image", content: item.imageUrl || "" },
        { name: "twitter:card", content: "summary_large_image" },
        { name: "twitter:title", content: item.title },
        { name: "twitter:description", content: description },
      ],
      scripts: [
        {
          type: "application/ld+json",
          children: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "NewsArticle",
            headline: item.title,
            description,
            datePublished: item.createdAt,
            dateModified: item.updatedAt,
            url,
            mainEntityOfPage: url,
            author: { "@type": "Organization", name: "onelpawarai", url: "https://github.com/onelpawarai-X" },
            publisher: {
              "@type": "Organization",
              name: "ZYRAXON AI",
              url: SITE_ORIGIN,
              logo: { "@type": "ImageObject", url: `${SITE_ORIGIN}/favicon.ico` },
            },
            ...(item.imageUrl ? { image: [item.imageUrl] } : {}),
            ...(item.embedUrl ? { associatedMedia: { "@type": "VideoObject", contentUrl: item.embedUrl } } : {}),
            articleBody: item.body ?? "",
            keywords: ["ZYRAXON", "ZYRAXON AI", item.kind, "desktop AI agent", "AI automation"],
          }),
        },
      ],
    };
  },
  component: UpdateDetail,
  notFoundComponent: () => (
    <UpdateShell>
      <div className="py-24 text-center">
        <p className="text-sm font-semibold tracking-widest text-cyan-600 uppercase">404</p>
        <h1 className="mt-3 text-3xl font-bold text-slate-900">Update not found</h1>
        <p className="mx-auto mt-3 max-w-md text-slate-600">
          This permalink does not match a published update. It may have been unpublished or renamed.
        </p>
        <a
          href="/updates"
          className="mt-8 inline-flex items-center gap-2 rounded-full bg-slate-900 px-6 py-3 text-sm font-semibold text-white transition hover:bg-slate-700"
        >
          See all updates
        </a>
      </div>
    </UpdateShell>
  ),
});

function UpdateDetail() {
  const { item } = Route.useLoaderData() ?? { item: null };

  if (!item) return null;

  return (
    <UpdateShell>
      <article className="mx-auto max-w-3xl py-10">
        <a
          href="/updates"
          className="inline-flex items-center gap-2 text-sm font-medium text-slate-500 transition hover:text-cyan-600"
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
            <path d="M10 3L5 8l5 5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          All updates
        </a>

        <header className="mt-8">
          <div className="flex flex-wrap items-center gap-3">
            {item.badge && (
              <span
                className="rounded-full px-3 py-1 text-[11px] font-bold tracking-widest uppercase"
                style={{ color: item.accent, background: `${item.accent}14` }}
              >
                {item.badge}
              </span>
            )}
            <span className="text-xs font-medium tracking-wider text-slate-400 uppercase">
              {new Date(item.createdAt).toLocaleDateString("en-GB", {
                day: "numeric",
                month: "long",
                year: "numeric",
              })}
            </span>
          </div>
          <h1 className="mt-4 text-4xl font-bold tracking-tight text-slate-900 sm:text-5xl">
            {item.title}
          </h1>
          {item.subtitle && (
            <p className="mt-4 text-lg leading-relaxed text-slate-600">{item.subtitle}</p>
          )}
        </header>

        <UpdateMedia item={item} />

        {item.body && (
          <div className="mt-10 text-[17px] leading-[1.75] whitespace-pre-wrap text-slate-700">
            {item.body}
          </div>
        )}

        <footer className="mt-14 border-t border-slate-200 pt-8">
          <p className="text-sm text-slate-500">
            Permanent link for this update — share it with any AI or tool to get the full record:
          </p>
          <code className="mt-3 block overflow-x-auto rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm break-all text-slate-700">
            {item.publicUrl}
          </code>
          <div className="mt-4 flex flex-wrap gap-3">
            <a
              href={`/api/public/site-content/${item.slug}`}
              className="inline-flex items-center rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 transition hover:border-cyan-300 hover:text-cyan-700"
            >
              JSON
            </a>
            <a
              href={`/api/public/site-content/${item.slug}?format=text`}
              className="inline-flex items-center rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 transition hover:border-cyan-300 hover:text-cyan-700"
            >
              Plain text
            </a>
            {item.linkUrl && (
              <a
                href={item.linkUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-700"
              >
                Open reference
              </a>
            )}
          </div>
        </footer>
      </article>
    </UpdateShell>
  );
}
