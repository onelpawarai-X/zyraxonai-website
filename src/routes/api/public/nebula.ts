import { createFileRoute } from "@tanstack/react-router";
import { REPOS } from "./downloads";

/**
 * NEBULA CORE — private control surface.
 * Guarded by the NEBULA_ACCESS_KEY secret (sent as `x-nebula-key`).
 *
 * actions:
 *   GET  ?action=telemetry            -> runtime + build machine metrics
 *   GET  ?action=tree&path=&repo=     -> repository directory listing (loader)
 *   GET  ?action=file&path=&repo=     -> single file content
 *   POST { action:"save", path, content, message, repo, sha }
 */

const HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, x-nebula-key",
  "Cache-Control": "no-store",
};

const DEFAULT_REPO = REPOS[0];

/** Owner password (short, memorable) plus the long secret key both unlock the deck. */
const OWNER_PASSWORD = "ZYRAXON";

function authed(request: Request) {
  const expected = process.env["NEBULA_ACCESS_KEY"];
  const url = new URL(request.url);
  const given = request.headers.get("x-nebula-key") || url.searchParams.get("key");
  if (!given) return false;
  return given === OWNER_PASSWORD || (!!expected && given === expected);
}

function gh(path: string, init: RequestInit = {}) {
  const token = process.env["GITHUB_PERSONAL_ACCESS_TOKEN"];
  return fetch(`https://api.github.com${path}`, {
    ...init,
    headers: {
      Accept: "application/vnd.github+json",
      "User-Agent": "zyraxon-nebula",
      "X-GitHub-Api-Version": "2022-11-28",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(init.headers ?? {}),
    },
  });
}

function pickRepo(value: string | null) {
  return value && REPOS.includes(value) ? value : DEFAULT_REPO;
}

function telemetry() {
  const started = Date.now();
  // Synthetic compute probe: how fast this edge isolate crunches numbers right now.
  let acc = 0;
  for (let i = 0; i < 2_000_000; i++) acc += Math.sqrt(i % 1024);
  const computeMs = Date.now() - started;

  const anyPerf = performance as any;
  const mem = anyPerf?.memory ?? null;

  return {
    generatedAt: new Date().toISOString(),
    edge: {
      label: "Edge runtime (serves this website)",
      region: "auto",
      computeProbeMs: computeMs,
      computeScore: Math.max(0, Math.round(100000 / Math.max(computeMs, 1))),
      checksum: Math.round(acc),
      heapUsedMb: mem ? +(mem.usedJSHeapSize / 1048576).toFixed(1) : null,
      heapLimitMb: mem ? +(mem.jsHeapSizeLimit / 1048576).toFixed(1) : null,
      uptimeHint: typeof performance !== "undefined" ? Math.round(performance.now()) : null,
    },
    buildMachine: {
      label: "Build / agent machine",
      os: "Linux x86_64 (gVisor sandbox)",
      cpuCores: 16,
      ramTotalGb: 32,
      ramFreeGb: 30,
      scratchStorageGb: 32,
      gpu: "none (CPU only)",
      swapGb: 0,
    },
    storage: {
      backend: "GitHub + Lovable Cloud",
      repos: REPOS,
    },
  };
}

function verifyPassword(password: string) {
  if (password === OWNER_PASSWORD) return { success: true, token: `nebula_${OWNER_PASSWORD}` };
  const expected = process.env["NEBULA_ACCESS_KEY"];
  if (expected && password === expected) return { success: true, token: `nebula_${expected}` };
  return { success: false };
}

async function handleGet(request: Request) {
  const url = new URL(request.url);
  const action = url.searchParams.get("action") || "telemetry";

  if (action === "verify") {
    const password = url.searchParams.get("password") || "";
    const result = verifyPassword(password);
    return Response.json(result, { headers: HEADERS });
  }

  if (!authed(request))
    return Response.json({ error: "Unauthorized" }, { status: 401, headers: HEADERS });

  const repo = pickRepo(url.searchParams.get("repo"));
  const path = (url.searchParams.get("path") || "").replace(/^\/+/, "");

  if (action === "telemetry") {
    return Response.json(telemetry(), { headers: HEADERS });
  }

  if (action === "tree") {
    const res = await gh(`/repos/${repo}/contents/${path}`);
    if (!res.ok) {
      return Response.json(
        { error: `GitHub ${res.status}`, repo, path, entries: [] },
        { status: 200, headers: HEADERS },
      );
    }
    const body: any = await res.json();
    const list = Array.isArray(body) ? body : [body];
    const entries = list
      .map((e: any) => ({ name: e.name, path: e.path, type: e.type, size: e.size ?? 0 }))
      .sort((a: any, b: any) =>
        a.type === b.type ? a.name.localeCompare(b.name) : a.type === "dir" ? -1 : 1,
      );
    return Response.json({ repo, path, entries }, { headers: HEADERS });
  }

  if (action === "file") {
    const res = await gh(`/repos/${repo}/contents/${path}`);
    if (!res.ok) {
      return Response.json({ error: `GitHub ${res.status}` }, { status: 200, headers: HEADERS });
    }
    const body: any = await res.json();
    if (body.type !== "file") {
      return Response.json({ error: "Not a file" }, { status: 200, headers: HEADERS });
    }
    let content = "";
    let binary = false;
    try {
      content = atob(String(body.content || "").replace(/\n/g, ""));
      binary = /[\u0000-\u0008\u000E-\u001F]/.test(content.slice(0, 2000));
    } catch {
      binary = true;
    }
    return Response.json(
      {
        repo,
        path: body.path,
        sha: body.sha,
        size: body.size,
        binary,
        content: binary ? "" : content,
        htmlUrl: body.html_url,
      },
      { headers: HEADERS },
    );
  }

  return Response.json({ error: "Unknown action" }, { status: 400, headers: HEADERS });
}

/* ---------------- Feature Studio (Lovable Cloud content) ---------------- */

async function admin() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}

async function contentList() {
  const db = await admin();
  const { data, error } = await db
    .from("site_content" as any)
    .select("*")
    .order("position", { ascending: true })
    .order("created_at", { ascending: false })
    .limit(300);
  if (error) return { items: [], error: error.message };
  const items = await Promise.all(
    ((data ?? []) as any[]).map(async (row) => {
      let preview = row.image_url as string | null;
      if (preview && !/^https?:\/\//.test(preview)) {
        const s = await db.storage.from("site-content").createSignedUrl(preview, 3600);
        preview = s.data?.signedUrl ?? null;
      }
      return { ...row, previewUrl: preview };
    }),
  );
  return { items };
}

async function contentSave(body: any) {
  const db = await admin();
  const row = {
    kind: body.kind || "feature",
    title: String(body.title || "").slice(0, 200),
    subtitle: body.subtitle ?? null,
    body: body.body ?? null,
    image_url: body.imageUrl ?? null,
    link_url: body.linkUrl ?? null,
    badge: body.badge ?? null,
    accent: body.accent ?? null,
    position: Number(body.position ?? 0),
    published: body.published !== false,
  };
  if (!row.title) return { error: "Title is required" };
  const q = body.id
    ? db
        .from("site_content" as any)
        .update(row)
        .eq("id", body.id)
        .select()
        .single()
    : db
        .from("site_content" as any)
        .insert(row)
        .select()
        .single();
  const { data, error } = await q;
  if (error) return { error: error.message };
  const saved = data as { id: string; title?: string | null } | null;
  const { publicUrl } = await import("@/lib/content");
  return { ok: true, item: saved, publicUrl: saved ? publicUrl(saved) : null };
}

async function contentDelete(body: any) {
  const db = await admin();
  const { error } = await db
    .from("site_content" as any)
    .delete()
    .eq("id", body.id);
  return error ? { error: error.message } : { ok: true };
}

const UPLOAD_EXT: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
  "image/avif": "avif",
  "image/svg+xml": "svg",
  "video/mp4": "mp4",
  "video/webm": "webm",
  "video/quicktime": "mov",
  "video/ogg": "ogv",
  "audio/mpeg": "mp3",
  "audio/mp3": "mp3",
  "audio/mp4": "m4a",
  "audio/x-m4a": "m4a",
  "audio/wav": "wav",
  "audio/x-wav": "wav",
  "audio/ogg": "ogg",
  "audio/webm": "weba",
  "audio/aac": "aac",
  "audio/flac": "flac",
  "audio/x-flac": "flac",
};

/**
 * Uploads one media file into the private `site-content` bucket.
 *
 * The browser posts raw bytes as multipart form-data instead of a base64 data
 * URL: video and audio stay roughly a third of the size and skip the JSON body
 * limit that made large uploads fail outright before.
 */
async function contentUploadForm(request: Request) {
  const db = await admin();
  const form = await request.formData().catch(() => null);
  const file = form?.get("file");
  if (!(file instanceof File)) return { error: "No file received" };
  if (file.size === 0) return { error: "The file is empty" };
  if (file.size > 200 * 1024 * 1024) return { error: "File is larger than 200 MB" };

  const mime = (file.type || "application/octet-stream").toLowerCase();
  const ext = UPLOAD_EXT[mime];
  if (!ext) return { error: `Unsupported media type: ${mime}` };

  const safeName =
    file.name
      .replace(/\.[^.]*$/, "")
      .replace(/[^a-z0-9-]/gi, "-")
      .replace(/-+/g, "-")
      .slice(0, 40)
      .toLowerCase() || "upload";

  const key = `uploads/${Date.now()}-${safeName}.${ext}`;
  const bytes = new Uint8Array(await file.arrayBuffer());

  const { error } = await db.storage
    .from("site-content")
    .upload(key, bytes, { contentType: mime, upsert: false });
  if (error) return { error: error.message };

  const signed = await db.storage.from("site-content").createSignedUrl(key, 3600);
  return { ok: true, path: key, previewUrl: signed.data?.signedUrl ?? null };
}

async function handlePost(request: Request) {
  // Media arrives as multipart/form-data; every other command is JSON.
  if ((request.headers.get("content-type") || "").includes("multipart/form-data")) {
    return Response.json(await contentUploadForm(request), { headers: HEADERS });
  }

  const body: any = await request.json().catch(() => ({}));

  if (body.action === "content.list") return Response.json(await contentList(), { headers: HEADERS });
  if (body.action === "content.save") return Response.json(await contentSave(body), { headers: HEADERS });
  if (body.action === "content.delete") return Response.json(await contentDelete(body), { headers: HEADERS });

  if (body.action !== "save") {
    return Response.json({ error: "Unknown action" }, { status: 400, headers: HEADERS });
  }
  if (!process.env["GITHUB_PERSONAL_ACCESS_TOKEN"]) {
    return Response.json(
      { error: "GitHub write token is not configured" },
      { status: 200, headers: HEADERS },
    );
  }
  const repo = pickRepo(body.repo);
  const path = String(body.path || "").replace(/^\/+/, "");
  if (!path) return Response.json({ error: "Missing path" }, { status: 400, headers: HEADERS });

  const encoded = btoa(unescape(encodeURIComponent(String(body.content ?? ""))));
  const res = await gh(`/repos/${repo}/contents/${path}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      message: body.message || `nebula: update ${path}`,
      content: encoded,
      ...(body.sha ? { sha: body.sha } : {}),
    }),
  });
  const out: any = await res.json().catch(() => ({}));
  if (!res.ok) {
    return Response.json(
      { error: out?.message || `GitHub ${res.status}` },
      { status: 200, headers: HEADERS },
    );
  }
  return Response.json(
    { ok: true, sha: out?.content?.sha, commit: out?.commit?.html_url },
    { headers: HEADERS },
  );
}

export const Route = createFileRoute("/api/public/nebula")({
  server: {
    handlers: {
      OPTIONS: async () => new Response(null, { status: 204, headers: HEADERS }),
      GET: async ({ request }) => {
        const url = new URL(request.url);
        const action = url.searchParams.get("action");
        if (action === "verify") {
          try {
            return await handleGet(request);
          } catch (err: any) {
            return Response.json({ error: String(err) }, { status: 200, headers: HEADERS });
          }
        }
        if (!authed(request))
          return Response.json({ error: "Unauthorized" }, { status: 401, headers: HEADERS });
        try {
          return await handleGet(request);
        } catch (err: any) {
          return Response.json({ error: String(err) }, { status: 200, headers: HEADERS });
        }
      },
      POST: async ({ request }) => {
        if (!authed(request))
          return Response.json({ error: "Unauthorized" }, { status: 401, headers: HEADERS });
        try {
          return await handlePost(request);
        } catch (err: any) {
          return Response.json({ error: String(err) }, { status: 200, headers: HEADERS });
        }
      },
    },
  },
});
