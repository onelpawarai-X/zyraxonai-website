import { createFileRoute } from "@tanstack/react-router";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "content-type",
  "Access-Control-Allow-Methods": "GET,OPTIONS",
};

type Result = { title: string; url: string; snippet?: string };

export const Route = createFileRoute("/api/public/builder/search")({
  server: {
    handlers: {
      OPTIONS: async () => new Response(null, { status: 204, headers: CORS }),

      POST: async ({ request }) => {
        let body: any;
        try {
          body = await request.json();
        } catch {
          return Response.json({ error: "Invalid JSON body" }, { status: 400, headers: CORS });
        }
        const rawUrl = typeof body?.url === "string" ? body.url.trim() : "";
        if (!rawUrl)
          return Response.json({ error: "url is required" }, { status: 400, headers: CORS });
        let target: URL;
        try {
          target = new URL(rawUrl.startsWith("http") ? rawUrl : `https://${rawUrl}`);
        } catch {
          return Response.json({ error: "Invalid URL" }, { status: 400, headers: CORS });
        }
        if (!/^https?:$/.test(target.protocol))
          return Response.json(
            { error: "Only http(s) URLs are allowed" },
            { status: 400, headers: CORS },
          );
        try {
          const r = await fetch(`https://r.jina.ai/${target.toString()}`, {
            headers: { Accept: "text/plain", "User-Agent": "zyraxon-agent" },
          });
          if (!r.ok) throw new Error(`reader failed (${r.status})`);
          const text = await r.text();
          return Response.json(
            {
              url: target.toString(),
              content: text.slice(0, 24_000),
              truncated: text.length > 24_000,
            },
            { headers: CORS },
          );
        } catch (error) {
          try {
            const page = await fetch(target, {
              headers: { "User-Agent": "Mozilla/5.0 ZYRAXON-Agent" },
            });
            const html = await page.text();
            const text = html
              .replace(/<script[\s\S]*?<\/script>/gi, "")
              .replace(/<style[\s\S]*?<\/style>/gi, "")
              .replace(/<[^>]+>/g, " ")
              .replace(/\s+/g, " ")
              .trim();
            return Response.json(
              { url: target.toString(), content: text.slice(0, 16_000), truncated: true },
              { headers: CORS },
            );
          } catch (e2) {
            return Response.json(
              {
                error: e2 instanceof Error ? e2.message : "URL read failed",
                detail: error instanceof Error ? error.message : undefined,
              },
              { status: 502, headers: CORS },
            );
          }
        }
      },

      GET: async ({ request }) => {
        const query = new URL(request.url).searchParams.get("q")?.trim();
        if (!query)
          return Response.json({ error: "q is required" }, { status: 400, headers: CORS });

        try {
          const [duck, wikiText, wikiImgs] = await Promise.allSettled([
            fetch(
              `https://api.duckduckgo.com/?q=${encodeURIComponent(query)}&format=json&no_html=1&skip_disambig=1`,
              { headers: { Accept: "application/json" } },
            ),
            fetch(
              `https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(query)}&srlimit=6&format=json&origin=*`,
              { headers: { Accept: "application/json" } },
            ),
            fetch(
              `https://commons.wikimedia.org/w/api.php?action=query&generator=search&gsrsearch=${encodeURIComponent(query)}&gsrnamespace=6&gsrlimit=8&prop=imageinfo&iiprop=url|extmetadata&iiurlwidth=900&format=json&origin=*`,
              { headers: { Accept: "application/json" } },
            ),
          ]);

          const results: Result[] = [];
          if (duck.status === "fulfilled" && duck.value.ok) {
            const data = await duck.value.json();
            if (data.AbstractURL)
              results.push({
                title: data.Heading || query,
                url: data.AbstractURL,
                snippet: data.AbstractText,
              });
            for (const item of data.RelatedTopics || []) {
              const topic = item.Topics ? item.Topics[0] : item;
              if (topic?.FirstURL)
                results.push({
                  title: topic.Text || topic.FirstURL,
                  url: topic.FirstURL,
                  snippet: topic.Text,
                });
              if (results.length >= 6) break;
            }
          }
          if (wikiText.status === "fulfilled" && wikiText.value.ok) {
            const data = await wikiText.value.json();
            for (const item of data?.query?.search || []) {
              if (results.length >= 8) break;
              results.push({
                title: item.title,
                url: `https://en.wikipedia.org/wiki/${encodeURIComponent(String(item.title).replace(/ /g, "_"))}`,
                snippet: String(item.snippet || "").replace(/<[^>]+>/g, ""),
              });
            }
          }
          if (wikiImgs.status === "fulfilled" && wikiImgs.value.ok) {
            const data = await wikiImgs.value.json();
            for (const page of Object.values<unknown>(data?.query?.pages || {})) {
              const info = page?.imageinfo?.[0];
              if (!info?.url) continue;
              results.push({
                title: page.title?.replace(/^File:/, "") || "Wikimedia image",
                url: info.descriptionurl || info.url,
                snippet: info.extmetadata?.ImageDescription?.value
                  ?.replace(/<[^>]+>/g, "")
                  .slice(0, 240),
              });
              if (results.length >= 12) break;
            }
          }
          return Response.json({ query, results }, { headers: CORS });
        } catch (error) {
          return Response.json(
            { error: error instanceof Error ? error.message : "Web search failed" },
            { status: 502, headers: CORS },
          );
        }
      },
    },
  },
});
