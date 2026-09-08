import { createFileRoute } from "@tanstack/react-router";
import { REPOS } from "../downloads";

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

function authed(request: Request) {
  const expected = process.env["NEBULA_ACCESS_KEY"];
  if (!expected) return false;
  const url = new URL(request.url);
  const given = request.headers.get("x-nebula-key") || url.searchParams.get("key");
  return given === expected;
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

async function handleGet(request: Request) {
  const url = new URL(request.url);
  const action = url.searchParams.get("action") || "telemetry";
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

async function handlePost(request: Request) {
  const body: any = await request.json().catch(() => ({}));
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
