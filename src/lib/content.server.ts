import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { embedFor, embedKind, itemPath, mediaTypeOf, publicUrl, SITE_ORIGIN } from "@/lib/content";

export type PublicItem = {
  id: string;
  kind: string;
  title: string;
  subtitle: string | null;
  body: string | null;
  badge: string | null;
  accent: string;
  linkUrl: string | null;
  imageUrl: string | null;
  embedUrl: string | null;
  embedKind: "video" | "audio" | "image" | null;
  mediaType: "image" | "video" | "audio" | "file";
  publicUrl: string;
  slug: string;
  createdAt: string;
  updatedAt: string;
};

function shape(row: any, mediaUrl: string | null): PublicItem {
  const embedUrl = embedFor(row.link_url);
  return {
    id: row.id,
    kind: row.kind,
    title: row.title,
    subtitle: row.subtitle ?? null,
    body: row.body ?? null,
    badge: row.badge ?? null,
    accent: row.accent || "#06b6d4",
    linkUrl: row.link_url ?? null,
    imageUrl: mediaUrl,
    embedUrl,
    embedKind: embedKind(embedUrl),
    mediaType: mediaTypeOf(row.image_url),
    publicUrl: publicUrl(row),
    slug: itemPath(row),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

async function signedMedia(path: string | null) {
  if (!path) return null;
  if (/^https?:\/\//.test(path)) return path;
  const { data } = await supabaseAdmin.storage
    .from("site-content")
    .createSignedUrl(path, 60 * 60 * 24);
  return data?.signedUrl ?? null;
}

/** Everything published from the Feature Studio, newest first. */
export async function loadPublishedContent(): Promise<PublicItem[]> {
  const { data, error } = await supabaseAdmin
    .from("site_content" as any)
    .select("*")
    .eq("published", true)
    .order("position", { ascending: true })
    .order("created_at", { ascending: false })
    .limit(200);
  if (error) throw error;

  return Promise.all(
    ((data ?? []) as any[]).map(async (row) => shape(row, await signedMedia(row.image_url))),
  );
}

/** A single entry addressed by its public slug, e.g. `voice-bridge-v3-a1b2c3d4`. */
export async function loadContentBySlug(slug: string): Promise<PublicItem | null> {
  const short = slug.toLowerCase().split("-").pop()!;
  const { data, error } = await supabaseAdmin
    .from("site_content" as any)
    .select("*")
    .eq("published", true)
    .like("id", `%${short}`)
    .limit(1);
  if (error) throw error;

  const row = (data ?? [])[0] as any;
  if (!row) return null;
  return shape(row, await signedMedia(row.image_url));
}

export { SITE_ORIGIN };
