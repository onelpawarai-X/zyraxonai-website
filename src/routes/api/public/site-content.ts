import { createFileRoute } from "@tanstack/react-router";

/**
 * Public feed of everything the owner publishes from the Nebula "Feature Studio":
 * features, screenshots, announcements, changelog notes.
 * Images live in the private `site-content` bucket and are handed out as
 * short-lived signed URLs so the bucket never has to be public.
 */

const HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Cache-Control": "public, max-age=30",
};

export const Route = createFileRoute("/api/public/site-content")({
  server: {
    handlers: {
      OPTIONS: async () => new Response(null, { status: 204, headers: HEADERS }),
      GET: async ({ request }) => {
        try {
          const url = new URL(request.url);
          const kind = url.searchParams.get("kind");
          const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
          let q = supabaseAdmin
            .from("site_content" as any)
            .select("*")
            .eq("published", true)
            .order("position", { ascending: true })
            .order("created_at", { ascending: false })
            .limit(200);
          if (kind) q = q.eq("kind", kind);
          const { data, error } = await q;
          if (error) throw error;

          const items = await Promise.all(
            ((data ?? []) as any[]).map(async (row) => {
              let image = row.image_url as string | null;
              if (image && !/^https?:\/\//.test(image)) {
                const signed = await supabaseAdmin.storage
                  .from("site-content")
                  .createSignedUrl(image, 60 * 60 * 24);
                image = signed.data?.signedUrl ?? null;
              }
              return {
                id: row.id,
                kind: row.kind,
                title: row.title,
                subtitle: row.subtitle,
                body: row.body,
                badge: row.badge,
                accent: row.accent,
                linkUrl: row.link_url,
                imageUrl: image,
                createdAt: row.created_at,
              };
            }),
          );
          return Response.json({ items }, { headers: HEADERS });
        } catch (err: any) {
          return Response.json({ items: [], error: String(err) }, { headers: HEADERS });
        }
      },
    },
  },
});
