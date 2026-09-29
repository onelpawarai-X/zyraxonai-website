import { createFileRoute } from "@tanstack/react-router";
import { embedFor, itemAsText, itemPath, mediaTypeOf, publicUrl } from "@/lib/content";

/**
 * One published row, addressed by its public permalink slug.
 *
 * This exists so any AI agent can be handed a single URL and read the whole
 * entry: JSON for tooling, or `?format=text` for a plain readable dump.
 */

const HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Cache-Control": "public, max-age=60",
};

export const Route = createFileRoute("/api/public/site-content/$slug")({
  server: {
    handlers: {
      OPTIONS: async () => new Response(null, { status: 204, headers: HEADERS }),
      GET: async ({ params, request }) => {
        try {
          const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
          const slug = String(params.slug || "").toLowerCase();
          const short = slug.split("-").pop()!;

          const { data, error } = await supabaseAdmin
            .from("site_content" as any)
            .select("*")
            .eq("published", true)
            .like("id", `%${short}`)
            .limit(1);
          if (error) throw error;

          const row = (data ?? [])[0] as any;
          if (!row) return Response.json({ error: "Not found" }, { status: 404, headers: HEADERS });

          let image = row.image_url as string | null;
          if (image && !/^https?:\/\//.test(image)) {
            const signed = await supabaseAdmin.storage
              .from("site-content")
              .createSignedUrl(image, 60 * 60 * 24);
            image = signed.data?.signedUrl ?? null;
          }

          const payload = {
            id: row.id,
            kind: row.kind,
            title: row.title,
            subtitle: row.subtitle,
            body: row.body,
            badge: row.badge,
            accent: row.accent,
            linkUrl: row.link_url,
            imageUrl: image,
            embedUrl: embedFor(row.link_url),
            mediaType: mediaTypeOf(row.image_url),
            publicUrl: publicUrl(row),
            slug: itemPath(row),
            createdAt: row.created_at,
            updatedAt: row.updated_at,
          };

          const format = new URL(request.url).searchParams.get("format");
          if (format === "text") {
            return new Response(itemAsText({ ...row, image_url: payload.imageUrl }), {
              headers: { ...HEADERS, "Content-Type": "text/plain; charset=utf-8" },
            });
          }

          return Response.json(payload, { headers: HEADERS });
        } catch (err: any) {
          return Response.json({ error: String(err) }, { headers: HEADERS });
        }
      },
    },
  },
});
