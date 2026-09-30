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

export type UploadProgress = { phase: "uploading" };

/**
 * Sends the raw file to the server as multipart form-data.
 *
 * Earlier this went out as a base64 data URL in a JSON body, which inflated
 * every file by a third and blew past the request body limit for anything but
 * small images — that is why video and audio uploads never completed.
 */
export async function uploadMedia(
  key: string,
  file: File,
  onProgress?: (p: UploadProgress) => void,
) {
  onProgress?.({ phase: "uploading" });
  const body = new FormData();
  body.append("file", file, file.name);

  const res = await fetch(ENDPOINT, {
    method: "POST",
    headers: { "x-nebula-key": key },
    body,
  });
  const json = await res.json().catch(() => ({ error: "Unexpected response" }));
  if (!res.ok || json.error) throw new Error(json.error || `Upload failed (${res.status})`);
  return json.path as string;
}

/** Bucket paths are shown through the signed URL the API hands back. */
export function previewFor(pathOrUrl: string | null | undefined) {
  if (!pathOrUrl) return null;
  return /^https?:\/\//.test(pathOrUrl) ? pathOrUrl : null;
}

export { embedFor, embedKind, mediaTypeOf, publicUrl };
