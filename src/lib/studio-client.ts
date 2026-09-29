import { embedFor, embedKind, mediaTypeOf, publicUrl } from "@/lib/content";

/**
 * Thin client for the NEBULA command deck. Everything the owner publishes goes
 * to Lovable Cloud (Supabase) through `/api/public/nebula`, never localStorage,
 * so the website and every other device see the same content immediately.
 */

const ENDPOINT = "/api/public/nebula";

export type StudioItem = {
  id: string;
  kind: string;
  title: string;
  subtitle: string | null;
  body: string | null;
  badge: string | null;
  accent: string | null;
  link_url: string | null;
  image_url: string | null;
  position: number;
  published: boolean;
  created_at: string;
  updated_at: string;
  previewUrl?: string | null;
  mediaType?: string;
  publicUrl?: string;
  embedUrl?: string | null;
};

export type Draft = {
  kind: string;
  title: string;
  subtitle: string;
  body: string;
  badge: string;
  accent: string;
  link_url: string;
  image_url: string;
  published: boolean;
};

export const EMPTY_DRAFT: Draft = {
  kind: "feature",
  title: "",
  subtitle: "",
  body: "",
  badge: "NEW",
  accent: "#06b6d4",
  link_url: "",
  image_url: "",
  published: true,
};

async function call(key: string, body: Record<string, unknown>) {
  const res = await fetch(ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-nebula-key": key },
    body: JSON.stringify(body),
  });
  const json = await res.json().catch(() => ({ error: "Unexpected response" }));
  if (!res.ok) throw new Error(json.error || `Request failed (${res.status})`);
  return json;
}

export function listContent(key: string) {
  return call(key, { action: "content.list" }) as Promise<{ items: StudioItem[]; error?: string }>;
}

export function saveContent(
  key: string,
  draft: Draft,
  id?: string,
) {
  return call(key, {
    action: "content.save",
    id,
    kind: draft.kind,
    title: draft.title,
    subtitle: draft.subtitle || null,
    body: draft.body || null,
    badge: draft.badge || null,
    accent: draft.accent,
    linkUrl: draft.link_url || null,
    imageUrl: draft.image_url || null,
    published: draft.published,
  }) as Promise<{ ok?: boolean; error?: string; item?: StudioItem; publicUrl?: string }>;
}

export function deleteContent(key: string, id: string) {
  return call(key, { action: "content.delete", id }) as Promise<{ ok?: boolean; error?: string }>;
}

export type UploadProgress = { phase: "preparing" | "uploading" | "done" };

/**
 * Streams the file straight into the private storage bucket using a one-time
 * signed URL, so video and audio never pass through the server request body.
 */
export async function uploadMedia(
  key: string,
  file: File,
  onProgress?: (p: UploadProgress) => void,
) {
  onProgress?.({ phase: "preparing" });
  const ticket = await call(key, {
    action: "content.uploadTicket",
    mime: file.type,
    name: file.name,
    ext: file.name.split(".").pop(),
  }) as { error?: string; path?: string; token?: string; signedUrl?: string };

  if (ticket.error || !ticket.signedUrl) throw new Error(ticket.error || "Could not start upload");

  onProgress?.({ phase: "uploading" });
  const put = await fetch(ticket.signedUrl, {
    method: "PUT",
    headers: { "Content-Type": file.type, "x-upsert": "true" },
    body: file,
  });
  if (!put.ok) throw new Error(`Upload failed (${put.status})`);

  onProgress?.({ phase: "done" });
  return ticket.path!;
}

/** Bucket paths are shown through the signed URL the API hands back. */
export function previewFor(pathOrUrl: string | null | undefined) {
  if (!pathOrUrl) return null;
  return /^https?:\/\//.test(pathOrUrl) ? pathOrUrl : null;
}

export { embedFor, embedKind, mediaTypeOf, publicUrl };
