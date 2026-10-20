import { createFileRoute } from "@tanstack/react-router";
import { DOCS } from "@/lib/docs/content";

const ORIGIN = "https://zyraxonai.lovable.app";

/** A sitemap for the pages whose URLs are not known until runtime.
 *
 *  Updates, ecosystem items and community profiles live in the database, so they
 *  cannot appear in the static `public/sitemap.xml` — the generator has no idea
 *  what ids exist when it runs. A crawler fetches this instead and gets whatever
 *  exists at that moment, which is the only honest way to index a collection
 *  that keeps growing.
 *
 *  The docs pages are included here too, so a crawl never comes back empty even
 *  if the database is unreachable. */
export const Route = createFileRoute("/api/public/sitemap-dynamic")({
  server: {
    handlers: {
      GET: async () => {
        const urls: Array<{ loc: string; changefreq: string; priority: string }> = [];
        const add = (path: string, changefreq = "weekly", priority = "0.6") =>
          urls.push({ loc: `${ORIGIN}${path}`, changefreq, priority });

        for (const doc of DOCS) add(`/docs/${doc.slug}`, "weekly", "0.7");

        try {
          const { loadPublishedContent } = await import("@/lib/content.server");
          const items = await loadPublishedContent();
          for (const item of items) {
            if (item.slug) add(`/updates/${item.slug}`, "weekly", "0.7");
          }
        } catch {
          /* the docs above are still worth returning */
        }

        try {
          const res = await fetch(`${ORIGIN}/api/public/community`, {
            headers: { Accept: "application/json" },
          });
          if (res.ok) {
            const data: any = await res.json();
            for (const member of data?.members ?? []) {
              if (member?.id) add(`/community/${member.id}`, "weekly", "0.5");
            }
          }
        } catch {
          /* optional */
        }

        const body =
          `<?xml version="1.0" encoding="UTF-8"?>\n` +
          `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n` +
          urls
            .map(
              (u) =>
                `  <url>\n` +
                `    <loc>${u.loc.replace(/&/g, "&amp;")}</loc>\n` +
                `    <changefreq>${u.changefreq}</changefreq>\n` +
                `    <priority>${u.priority}</priority>\n` +
                `  </url>`,
            )
            .join("\n") +
          `\n</urlset>\n`;

        return new Response(body, {
          headers: {
            "Content-Type": "application/xml; charset=utf-8",
            "Cache-Control": "public, max-age=1800",
          },
        });
      },
    },
  },
});
