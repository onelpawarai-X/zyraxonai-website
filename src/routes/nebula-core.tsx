import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";

export const Route = createFileRoute("/nebula-core")({
  head: () => ({
    meta: [
      { title: "Nebula Core — ZYRAXON Control Deck" },
      {
        name: "description",
        content:
          "Private ZYRAXON control deck: live runtime telemetry, project loader with in-browser editing, feature studio and dual-account release routing.",
      },
      { name: "robots", content: "noindex, nofollow" },
      { property: "og:type", content: "website" },
      { property: "og:title", content: "Nebula Core — ZYRAXON Control Deck" },
      { property: "og:description", content: "Private ZYRAXON control deck." },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: () => <NebulaDeck />,
});

const KEY_STORAGE = "nebula.key";
const REPOS = ["onelpawarai-X/ZYRAXON-AI", "onelpawarai/ZYRAXON-AI"];

type Entry = { name: string; path: string; type: string; size: number };
type Tab = "core" | "studio" | "loader" | "releases";

function Gauge({ label, value, max, unit }: { label: string; value: number; max: number; unit: string }) {
  const pct = Math.min(100, Math.round((value / Math.max(max, 1)) * 100));
  return (
    <div className="rounded-2xl border border-cyan-400/20 bg-white/5 p-4 backdrop-blur-xl">
      <div className="flex items-baseline justify-between">
        <span className="text-xs uppercase tracking-widest text-cyan-200/70">{label}</span>
        <span className="text-sm font-semibold text-cyan-100">
          {value}
          <span className="ml-1 text-xs text-cyan-200/60">{unit}</span>
        </span>
      </div>
      <div className="mt-3 h-2 overflow-hidden rounded-full bg-cyan-950/60">
        <div
          className="h-full rounded-full bg-gradient-to-r from-cyan-400 via-sky-400 to-fuchsia-400 transition-all duration-700"
          style={{ width: `${pct}%` }}
        />
      </div>
      <div className="mt-1 text-right text-[10px] text-cyan-200/50">{pct}% of {max}{unit}</div>
    </div>
  );
}

/** The full control deck. Rendered standalone at /nebula-core and inside the landing-page overlay. */
export function NebulaDeck({ onClose }: { onClose?: () => void }) {
  const [key, setKey] = useState("");
  const [unlocked, setUnlocked] = useState(false);
  const [tab, setTab] = useState<Tab>("studio");
  const [error, setError] = useState<string | null>(null);
  const [checking, setChecking] = useState(false);

  useEffect(() => {
    const saved = typeof window !== "undefined" ? localStorage.getItem(KEY_STORAGE) : null;
    if (saved) {
      setKey(saved);
      setUnlocked(true);
    }
  }, []);

  const call = useCallback(
    async (qs: string, init?: RequestInit) => {
      const res = await fetch(`/api/public/nebula${qs}`, {
        ...init,
        headers: { "Content-Type": "application/json", "x-nebula-key": key, ...(init?.headers ?? {}) },
      });
      if (res.status === 401) {
        setUnlocked(false);
        localStorage.removeItem(KEY_STORAGE);
        throw new Error("Access key rejected");
      }
      return res.json();
    },
    [key],
  );

  if (!unlocked) {
    return (
      <main className="relative flex min-h-full flex-1 items-center justify-center overflow-hidden bg-[#03060f] px-4 py-16 text-cyan-50">
        <div className="pointer-events-none absolute -top-40 left-1/2 h-[560px] w-[560px] -translate-x-1/2 rounded-full bg-cyan-500/20 blur-[140px]" />
        <div className="pointer-events-none absolute bottom-0 right-0 h-[420px] w-[420px] rounded-full bg-fuchsia-500/20 blur-[140px]" />
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            setError(null);
            setChecking(true);
            try {
              const res = await fetch(`/api/public/nebula?action=telemetry`, {
                headers: { "x-nebula-key": key },
              });
              if (res.ok) {
                localStorage.setItem(KEY_STORAGE, key);
                setUnlocked(true);
              } else {
                setError("Wrong password.");
              }
            } finally {
              setChecking(false);
            }
          }}
          className="relative w-full max-w-sm rounded-3xl border border-cyan-400/20 bg-white/5 p-8 backdrop-blur-2xl"
        >
          {onClose && (
            <button
              type="button"
              onClick={onClose}
              className="absolute right-4 top-4 text-xs text-cyan-200/50 hover:text-cyan-100"
            >
              ✕
            </button>
          )}
          <h1 className="text-2xl font-semibold tracking-tight">Nebula Core</h1>
          <p className="mt-1 text-sm text-cyan-200/60">Restricted control deck. Enter password.</p>
          <input
            type="password"
            value={key}
            autoFocus
            onChange={(e) => setKey(e.target.value)}
            placeholder="Password"
            className="mt-6 w-full rounded-xl border border-cyan-400/20 bg-black/40 px-4 py-3 text-sm outline-none placeholder:text-cyan-200/30 focus:border-cyan-400/60"
          />
          {error && <p className="mt-3 text-xs text-rose-300">{error}</p>}
          <button
            type="submit"
            disabled={checking}
            className="mt-5 w-full rounded-xl bg-gradient-to-r from-cyan-500 to-fuchsia-500 px-4 py-3 text-sm font-semibold text-black transition hover:brightness-110 disabled:opacity-60"
          >
            {checking ? "Checking…" : "Unlock"}
          </button>
        </form>
      </main>
    );
  }

  return (
    <main className="relative min-h-full flex-1 overflow-y-auto bg-[#03060f] text-cyan-50">
      <div className="pointer-events-none absolute -top-56 left-1/3 h-[620px] w-[620px] rounded-full bg-cyan-500/15 blur-[160px]" />
      <div className="pointer-events-none absolute bottom-[-10rem] right-0 h-[520px] w-[520px] rounded-full bg-fuchsia-500/15 blur-[160px]" />

      <header className="relative border-b border-cyan-400/10 px-6 py-5 backdrop-blur-xl">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-xl font-semibold tracking-tight">Nebula Core</h1>
            <p className="text-xs text-cyan-200/50">ZYRAXON private control deck</p>
          </div>
          <div className="flex items-center gap-3">
            <nav className="flex gap-1 rounded-full border border-cyan-400/20 bg-white/5 p-1 text-sm backdrop-blur-xl">
              {(["studio", "core", "loader", "releases"] as const).map((t) => (
                <button
                  key={t}
                  onClick={() => setTab(t)}
                  className={`rounded-full px-4 py-1.5 capitalize transition ${
                    tab === t ? "bg-cyan-400/90 text-black" : "text-cyan-100/70 hover:text-cyan-100"
                  }`}
                >
                  {t === "studio" ? "Features" : t}
                </button>
              ))}
            </nav>
            <button
              onClick={() => {
                localStorage.removeItem(KEY_STORAGE);
                setUnlocked(false);
              }}
              className="rounded-full border border-cyan-400/20 px-3 py-1.5 text-xs text-cyan-100/70 hover:text-cyan-100"
            >
              Lock
            </button>
            {onClose && (
              <button
                onClick={onClose}
                className="rounded-full border border-cyan-400/20 px-3 py-1.5 text-xs text-cyan-100/70 hover:text-cyan-100"
              >
                Close
              </button>
            )}
          </div>
        </div>
      </header>

      <div className="relative mx-auto max-w-6xl px-6 py-8">
        {tab === "studio" && <StudioPanel call={call} />}
        {tab === "core" && <CorePanel call={call} />}
        {tab === "loader" && <LoaderPanel call={call} />}
        {tab === "releases" && <ReleasesPanel />}
      </div>
    </main>
  );
}

/* ------------------------------- Feature Studio ------------------------------- */

type ContentRow = {
  id?: string;
  kind: string;
  title: string;
  subtitle?: string | null;
  body?: string | null;
  image_url?: string | null;
  link_url?: string | null;
  badge?: string | null;
  accent?: string | null;
  position?: number;
  published?: boolean;
  previewUrl?: string | null;
};

const EMPTY: ContentRow = {
  kind: "feature",
  title: "",
  subtitle: "",
  body: "",
  image_url: "",
  link_url: "",
  badge: "",
  accent: "#22d3ee",
  position: 0,
  published: true,
};

function StudioPanel({ call }: { call: (qs: string, init?: RequestInit) => Promise<any> }) {
  const [items, setItems] = useState<ContentRow[]>([]);
  const [draft, setDraft] = useState<ContentRow>(EMPTY);
  const [status, setStatus] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const post = useCallback(
    (payload: any) => call("", { method: "POST", body: JSON.stringify(payload) }),
    [call],
  );

  const refresh = useCallback(async () => {
    const d = await post({ action: "content.list" });
    setItems(d.items ?? []);
  }, [post]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const upload = async (file: File) => {
    setBusy(true);
    setStatus("Uploading image…");
    const dataUrl: string = await new Promise((resolve, reject) => {
      const fr = new FileReader();
      fr.onload = () => resolve(String(fr.result));
      fr.onerror = reject;
      fr.readAsDataURL(file);
    });
    const d = await post({ action: "content.upload", dataUrl });
    if (d.ok) {
      setDraft((s) => ({ ...s, image_url: d.path, previewUrl: d.previewUrl }));
      setStatus("Image uploaded.");
    } else setStatus(`Upload failed: ${d.error}`);
    setBusy(false);
  };

  const save = async () => {
    setBusy(true);
    setStatus("Publishing…");
    const d = await post({
      action: "content.save",
      id: draft.id,
      kind: draft.kind,
      title: draft.title,
      subtitle: draft.subtitle,
      body: draft.body,
      imageUrl: draft.image_url,
      linkUrl: draft.link_url,
      badge: draft.badge,
      accent: draft.accent,
      position: draft.position,
      published: draft.published,
    });
    setStatus(d.ok ? "Live on the website." : `Failed: ${d.error}`);
    if (d.ok) {
      setDraft(EMPTY);
      await refresh();
    }
    setBusy(false);
  };

  const remove = async (id?: string) => {
    if (!id) return;
    setBusy(true);
    await post({ action: "content.delete", id });
    await refresh();
    setBusy(false);
  };

  const field = "w-full rounded-lg border border-cyan-400/20 bg-black/40 px-3 py-2 text-sm outline-none focus:border-cyan-400/60";

  return (
    <div className="grid gap-5 lg:grid-cols-[minmax(0,420px)_1fr]">
      <section className="rounded-2xl border border-cyan-400/20 bg-white/5 p-5 backdrop-blur-xl">
        <h2 className="text-sm font-semibold">{draft.id ? "Edit item" : "Publish something new"}</h2>
        <p className="mt-1 text-xs text-cyan-200/55">
          Anything you publish here appears instantly on the public website — no re-upload, no redeploy.
        </p>

        <div className="mt-4 space-y-3">
          <select
            className={field}
            value={draft.kind}
            onChange={(e) => setDraft({ ...draft, kind: e.target.value })}
          >
            <option value="feature">Feature</option>
            <option value="announcement">Announcement</option>
            <option value="screenshot">Screenshot / gallery</option>
            <option value="changelog">Changelog</option>
          </select>
          <input className={field} placeholder="Title" value={draft.title} onChange={(e) => setDraft({ ...draft, title: e.target.value })} />
          <input className={field} placeholder="Subtitle" value={draft.subtitle ?? ""} onChange={(e) => setDraft({ ...draft, subtitle: e.target.value })} />
          <textarea className={`${field} h-28 resize-none`} placeholder="Description" value={draft.body ?? ""} onChange={(e) => setDraft({ ...draft, body: e.target.value })} />
          <div className="grid grid-cols-2 gap-3">
            <input className={field} placeholder="Badge (NEW)" value={draft.badge ?? ""} onChange={(e) => setDraft({ ...draft, badge: e.target.value })} />
            <input className={field} type="color" value={draft.accent || "#22d3ee"} onChange={(e) => setDraft({ ...draft, accent: e.target.value })} />
          </div>
          <input className={field} placeholder="Link URL (optional)" value={draft.link_url ?? ""} onChange={(e) => setDraft({ ...draft, link_url: e.target.value })} />
          <div className="rounded-xl border border-dashed border-cyan-400/25 p-3">
            <input
              type="file"
              accept="image/*"
              onChange={(e) => e.target.files?.[0] && upload(e.target.files[0]!)}
              className="w-full text-xs text-cyan-100/70 file:mr-3 file:rounded-lg file:border-0 file:bg-cyan-400/90 file:px-3 file:py-1.5 file:text-xs file:font-semibold file:text-black"
            />
            {draft.previewUrl && (
              <img src={draft.previewUrl} alt="Upload preview" className="mt-3 max-h-40 rounded-lg object-cover" />
            )}
          </div>
          <label className="flex items-center gap-2 text-xs text-cyan-200/70">
            <input
              type="checkbox"
              checked={draft.published !== false}
              onChange={(e) => setDraft({ ...draft, published: e.target.checked })}
            />
            Visible to visitors
          </label>
          <div className="flex items-center gap-2">
            <button
              disabled={busy || !draft.title}
              onClick={save}
              className="rounded-lg bg-gradient-to-r from-cyan-500 to-fuchsia-500 px-4 py-2 text-xs font-semibold text-black disabled:opacity-50"
            >
              {draft.id ? "Update" : "Publish"}
            </button>
            {draft.id && (
              <button onClick={() => setDraft(EMPTY)} className="rounded-lg border border-cyan-400/20 px-3 py-2 text-xs">
                Cancel
              </button>
            )}
            {status && <span className="text-[11px] text-cyan-200/60">{status}</span>}
          </div>
        </div>
      </section>

      <section className="space-y-3">
        {items.length === 0 && <p className="text-sm text-cyan-200/60">Nothing published yet.</p>}
        {items.map((it) => (
          <article
            key={it.id}
            className="flex gap-4 rounded-2xl border border-cyan-400/20 bg-white/5 p-4 backdrop-blur-xl"
          >
            {it.previewUrl && <img src={it.previewUrl} alt={it.title} className="h-20 w-28 rounded-lg object-cover" />}
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded-full bg-cyan-400/15 px-2 py-0.5 text-[10px] uppercase tracking-wide">{it.kind}</span>
                {it.badge && <span className="rounded-full bg-fuchsia-400/20 px-2 py-0.5 text-[10px]">{it.badge}</span>}
                {!it.published && <span className="text-[10px] text-rose-300/80">hidden</span>}
              </div>
              <h3 className="mt-1 truncate text-sm font-semibold">{it.title}</h3>
              <p className="truncate text-xs text-cyan-200/60">{it.subtitle || it.body}</p>
            </div>
            <div className="flex flex-col gap-2">
              <button onClick={() => setDraft(it)} className="rounded-lg border border-cyan-400/20 px-3 py-1 text-xs">
                Edit
              </button>
              <button onClick={() => remove(it.id)} className="rounded-lg border border-rose-400/30 px-3 py-1 text-xs text-rose-200">
                Delete
              </button>
            </div>
          </article>
        ))}
      </section>
    </div>
  );
}

function CorePanel({ call }: { call: (qs: string, init?: RequestInit) => Promise<any> }) {
  const [data, setData] = useState<any>(null);
  const [live, setLive] = useState(true);

  useEffect(() => {
    let stop = false;
    const tick = async () => {
      try {
        const d = await call(`?action=telemetry`);
        if (!stop) setData(d);
      } catch {
        /* ignore */
      }
    };
    tick();
    if (!live) return;
    const id = setInterval(tick, 5000);
    return () => {
      stop = true;
      clearInterval(id);
    };
  }, [call, live]);

  if (!data) return <p className="text-sm text-cyan-200/60">Reading telemetry…</p>;
  const b = data.buildMachine ?? {};
  const e = data.edge ?? {};

  return (
    <div className="space-y-8">
      <section>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm uppercase tracking-widest text-cyan-200/70">Compute cells</h2>
          <button
            onClick={() => setLive((v) => !v)}
            className="rounded-full border border-cyan-400/20 px-3 py-1 text-xs text-cyan-100/70 hover:text-cyan-100"
          >
            {live ? "Live · 5s" : "Paused"}
          </button>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Gauge label="CPU cores" value={b.cpuCores ?? 0} max={16} unit="" />
          <Gauge label="RAM used" value={+((b.ramTotalGb ?? 0) - (b.ramFreeGb ?? 0)).toFixed(1)} max={b.ramTotalGb ?? 32} unit="GB" />
          <Gauge label="Scratch storage" value={b.scratchStorageGb ?? 0} max={b.scratchStorageGb ?? 32} unit="GB" />
          <Gauge label="Edge compute score" value={e.computeScore ?? 0} max={2000} unit="" />
        </div>
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-2xl border border-cyan-400/20 bg-white/5 p-5 backdrop-blur-xl">
          <h3 className="text-sm font-semibold">{b.label}</h3>
          <dl className="mt-3 space-y-2 text-sm text-cyan-100/80">
            <Row k="Operating system" v={b.os} />
            <Row k="CPU cores" v={`${b.cpuCores} vCPU`} />
            <Row k="Total RAM" v={`${b.ramTotalGb} GB`} />
            <Row k="Free RAM" v={`${b.ramFreeGb} GB`} />
            <Row k="Scratch disk" v={`${b.scratchStorageGb} GB`} />
            <Row k="GPU / VRAM" v={b.gpu} />
            <Row k="Swap" v={`${b.swapGb} GB`} />
          </dl>
        </div>
        <div className="rounded-2xl border border-fuchsia-400/20 bg-white/5 p-5 backdrop-blur-xl">
          <h3 className="text-sm font-semibold">{e.label}</h3>
          <dl className="mt-3 space-y-2 text-sm text-cyan-100/80">
            <Row k="Compute probe" v={`${e.computeProbeMs} ms / 2M ops`} />
            <Row k="Compute score" v={String(e.computeScore)} />
            <Row k="JS heap used" v={e.heapUsedMb ? `${e.heapUsedMb} MB` : "not exposed"} />
            <Row k="JS heap limit" v={e.heapLimitMb ? `${e.heapLimitMb} MB` : "not exposed"} />
            <Row k="Isolate uptime" v={`${e.uptimeHint} ms`} />
            <Row k="Sampled at" v={new Date(data.generatedAt).toLocaleTimeString()} />
          </dl>
        </div>
      </section>

      <section className="rounded-2xl border border-cyan-400/20 bg-white/5 p-5 backdrop-blur-xl">
        <h3 className="text-sm font-semibold">Storage backends</h3>
        <p className="mt-1 text-xs text-cyan-200/60">{data.storage?.backend}</p>
        <ul className="mt-3 space-y-1 text-sm text-cyan-100/80">
          {(data.storage?.repos ?? []).map((r: string, i: number) => (
            <li key={r}>
              <span className="mr-2 rounded-full bg-cyan-400/15 px-2 py-0.5 text-[10px] uppercase tracking-wide">
                {i === 0 ? "primary" : "fallback"}
              </span>
              {r}
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

function Row({ k, v }: { k: string; v: any }) {
  return (
    <div className="flex justify-between gap-4 border-b border-white/5 pb-1">
      <dt className="text-cyan-200/55">{k}</dt>
      <dd className="text-right font-medium">{String(v)}</dd>
    </div>
  );
}

function LoaderPanel({ call }: { call: (qs: string, init?: RequestInit) => Promise<any> }) {
  const [repo, setRepo] = useState(REPOS[0]);
  const [path, setPath] = useState("");
  const [entries, setEntries] = useState<Entry[]>([]);
  const [file, setFile] = useState<any>(null);
  const [draft, setDraft] = useState("");
  const [status, setStatus] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const loadDir = useCallback(
    async (p: string) => {
      setBusy(true);
      setFile(null);
      const d = await call(`?action=tree&repo=${encodeURIComponent(repo)}&path=${encodeURIComponent(p)}`);
      setEntries(d.entries ?? []);
      setPath(p);
      setStatus(d.error ?? null);
      setBusy(false);
    },
    [call, repo],
  );

  useEffect(() => {
    loadDir("");
  }, [loadDir]);

  const openFile = async (p: string) => {
    setBusy(true);
    const d = await call(`?action=file&repo=${encodeURIComponent(repo)}&path=${encodeURIComponent(p)}`);
    setFile(d);
    setDraft(d.content ?? "");
    setStatus(d.error ?? null);
    setBusy(false);
  };

  const save = async () => {
    setBusy(true);
    setStatus("Saving…");
    const d = await call("", {
      method: "POST",
      body: JSON.stringify({
        action: "save",
        repo,
        path: file.path,
        sha: file.sha,
        content: draft,
        message: `nebula: update ${file.path}`,
      }),
    });
    setStatus(d.ok ? "Saved and committed." : `Failed: ${d.error}`);
    if (d.ok) setFile({ ...file, sha: d.sha });
    setBusy(false);
  };

  const parent = path.includes("/") ? path.slice(0, path.lastIndexOf("/")) : "";

  return (
    <div className="grid gap-5 lg:grid-cols-[300px_1fr]">
      <aside className="rounded-2xl border border-cyan-400/20 bg-white/5 p-4 backdrop-blur-xl">
        <select
          value={repo}
          onChange={(e) => {
            setRepo(e.target.value);
            setPath("");
          }}
          className="w-full rounded-lg border border-cyan-400/20 bg-black/40 px-3 py-2 text-xs"
        >
          {REPOS.map((r, i) => (
            <option key={r} value={r}>
              {r} {i === 0 ? "(primary)" : "(fallback)"}
            </option>
          ))}
        </select>
        <p className="mt-3 truncate text-[11px] text-cyan-200/50">/{path || ""}</p>
        <ul className="mt-2 max-h-[60vh] space-y-0.5 overflow-auto text-sm">
          {path && (
            <li>
              <button onClick={() => loadDir(parent)} className="w-full rounded px-2 py-1 text-left text-cyan-200/60 hover:bg-white/5">
                ../
              </button>
            </li>
          )}
          {entries.map((e) => (
            <li key={e.path}>
              <button
                onClick={() => (e.type === "dir" ? loadDir(e.path) : openFile(e.path))}
                className={`w-full truncate rounded px-2 py-1 text-left hover:bg-white/5 ${
                  e.type === "dir" ? "text-cyan-200" : "text-cyan-100/70"
                }`}
              >
                {e.type === "dir" ? "▸ " : "· "}
                {e.name}
              </button>
            </li>
          ))}
        </ul>
      </aside>

      <section className="rounded-2xl border border-cyan-400/20 bg-white/5 p-4 backdrop-blur-xl">
        {!file ? (
          <p className="text-sm text-cyan-200/60">
            {busy ? "Loading…" : "Pick a file on the left to load it into the editor."}
          </p>
        ) : file.binary ? (
          <p className="text-sm text-cyan-200/60">Binary file — cannot be edited here.</p>
        ) : (
          <>
            <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
              <span className="truncate text-sm font-medium">{file.path}</span>
              <div className="flex items-center gap-2">
                {status && <span className="text-[11px] text-cyan-200/60">{status}</span>}
                <button
                  disabled={busy}
                  onClick={save}
                  className="rounded-lg bg-gradient-to-r from-cyan-500 to-fuchsia-500 px-4 py-1.5 text-xs font-semibold text-black disabled:opacity-50"
                >
                  Commit change
                </button>
              </div>
            </div>
            <textarea
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              spellCheck={false}
              className="h-[62vh] w-full resize-none rounded-xl border border-cyan-400/15 bg-black/50 p-4 font-mono text-xs leading-relaxed outline-none focus:border-cyan-400/50"
            />
          </>
        )}
      </section>
    </div>
  );
}

function ReleasesPanel() {
  const [data, setData] = useState<any>(null);
  useEffect(() => {
    fetch("/api/public/downloads")
      .then((r) => r.json())
      .then(setData)
      .catch(() => setData({ error: true }));
  }, []);

  if (!data) return <p className="text-sm text-cyan-200/60">Scanning both accounts…</p>;

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2">
        {(data.sources ?? []).map((s: any) => (
          <div key={s.repo} className="rounded-2xl border border-cyan-400/20 bg-white/5 p-5 backdrop-blur-xl">
            <span className="rounded-full bg-cyan-400/15 px-2 py-0.5 text-[10px] uppercase tracking-wide">{s.role}</span>
            <h3 className="mt-2 text-sm font-semibold">{s.repo}</h3>
            <p className="mt-1 text-xs text-cyan-200/60">{s.releases} releases reachable</p>
            <a href={s.releasesUrl} target="_blank" rel="noreferrer" className="mt-3 inline-block text-xs text-cyan-300 underline">
              Open on GitHub
            </a>
          </div>
        ))}
      </div>

      <div className="rounded-2xl border border-cyan-400/20 bg-white/5 p-5 backdrop-blur-xl">
        <h3 className="text-sm font-semibold">Resolved downloads</h3>
        <ul className="mt-3 space-y-2 text-sm">
          {Object.entries(data.platforms ?? {}).map(([k, v]: any) => (
            <li key={k} className="flex flex-wrap items-center justify-between gap-2 border-b border-white/5 pb-2">
              <span className="capitalize text-cyan-200/60">{k}</span>
              {v ? (
                <a href={v.url} className="text-right text-cyan-100 underline">
                  {v.name} <span className="text-cyan-200/50">({v.tag})</span>
                </a>
              ) : (
                <span className="text-rose-300/70">not available</span>
              )}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
