import { createFileRoute } from "@tanstack/react-router";
import { loadPublishedContent, SITE_ORIGIN, type PublicItem } from "@/lib/content.server";
import { UpdateMedia, UpdateShell } from "./_ui";

export const Route = createFileRoute("/updates/")({
  loader: async () => {
    const items = await loadPublishedContent().catch(() => []);
    return { items };
  },
  head: () => ({
    meta: [
      { title: "Latest Updates — ZYRAXON AI" },
      {
        name: "description",
        content:
          "Every feature, release and announcement published from the ZYRAXON AI command deck — each with its own permanent link.",
      },
      { property: "og:title", content: "Latest Updates — ZYRAXON AI" },
      {
        property: "og:description",
        content: "Features, releases and announcements from ZYRAXON AI.",
      },
      { property: "og:type", content: "website" },
      { property: "og:url", content: `${SITE_ORIGIN}/updates` },
    ],
  }),
  component: UpdatesIndex,
});

function UpdatesIndex() {
  const { items = [] } = Route.useLoaderData() ?? { items: [] };

  return (
    <UpdateShell>
      <div className="py-14">
        <p className="text-xs font-bold tracking-[0.18em] text-primary uppercase">Newsroom</p>
        <h1 className="mt-3 text-4xl font-bold tracking-tight text-foreground sm:text-5xl">
          Latest from ZYRAXON
        </h1>
        <p className="mt-4 max-w-2xl text-lg leading-relaxed text-muted-foreground">
          Every entry has its own permanent link. Share one with an AI agent and it can read the
          full record — title, media, reference links and the complete text.
        </p>
      </div>

      {items.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border px-6 py-20 text-center">
          <p className="text-muted-foreground">No updates published yet.</p>
        </div>
      ) : (
          <div className="grid gap-8 pb-16 sm:grid-cols-2">
          {items.map((item: PublicItem) => (
            <article
              key={item.id}
              className="group flex flex-col overflow-hidden rounded-2xl border border-border zx-glass transition hover:border-border hover:shadow-lg"
            >
              <UpdateMedia item={item} />
              <div className="flex flex-1 flex-col gap-3 p-6">
                <div className="flex flex-wrap items-center gap-2">
                  {item.badge && (
                    <span
                      className="rounded-full px-2.5 py-1 text-[10px] font-bold tracking-widest uppercase"
                      style={{ color: item.accent, background: `${item.accent}14` }}
                    >
                      {item.badge}
                    </span>
                  )}
                  <time className="text-[11px] font-medium tracking-wide text-muted-foreground uppercase">
                    {new Date(item.createdAt).toLocaleDateString("en-GB", {
                      day: "numeric",
                      month: "short",
                      year: "numeric",
                    })}
                  </time>
                </div>
                <h2 className="text-lg font-bold tracking-tight text-foreground">
                  <a href={`/updates/${item.slug}`} className="transition group-hover:text-primary">
                    {item.title}
                  </a>
                </h2>
                {item.subtitle && <p className="text-sm text-muted-foreground">{item.subtitle}</p>}
                {item.body && (
                  <p className="line-clamp-4 text-sm leading-relaxed whitespace-pre-wrap text-muted-foreground">
                    {item.body}
                  </p>
                )}
                <a
                  href={`/updates/${item.slug}`}
                  className="mt-auto inline-flex items-center gap-1.5 pt-2 text-sm font-semibold text-primary transition hover:gap-2.5"
                >
                  Read the full update
                  <svg width="15" height="15" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                    <path d="M6 3l5 5-5 5" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </a>
              </div>
            </article>
          ))}
        </div>
      )}
    </UpdateShell>
  );
}
