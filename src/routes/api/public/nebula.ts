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
  return error ? { error: error.message } : { ok: true, item: data };
}

async function contentDelete(body: any) {
  const db = await admin();
  const { error } = await db
    .from("site_content" as any)
    .delete()
    .eq("id", body.id);
  return error ? { error: error.message } : { ok: true };
}

async function contentUpload(body: any) {
  const db = await admin();
  const raw = String(body.dataUrl || "");
  const m = /^data:([^;]+);base64,(.+)$/.exec(raw);
  if (!m) return { error: "Expected a base64 data URL" };
  const mime = m[1]!;
  const bin = atob(m[2]!);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  const ext = (mime.split("/")[1] || "bin").replace(/[^a-z0-9]/gi, "");
  const key = `uploads/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
  const { error } = await db.storage
    .from("site-content")
    .upload(key, bytes, { contentType: mime, upsert: false });
  if (error) return { error: error.message };
  const signed = await db.storage.from("site-content").createSignedUrl(key, 3600);
  return { ok: true, path: key, previewUrl: signed.data?.signedUrl ?? null };
}

async function handlePost(request: Request) {
  const body: any = await request.json().catch(() => ({}));

  if (body.action === "content.list") return Response.json(await contentList(), { headers: HEADERS });
  if (body.action === "content.save") return Response.json(await contentSave(body), { headers: HEADERS });
  if (body.action === "content.delete") return Response.json(await contentDelete(body), { headers: HEADERS });
  if (body.action === "content.upload") return Response.json(await contentUpload(body), { headers: HEADERS });

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
