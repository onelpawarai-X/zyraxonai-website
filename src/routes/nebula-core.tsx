import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";

export const Route = createFileRoute("/nebula-core")({
  head: () => ({
    meta: [
      { title: "Nebula Core — ZYRAXON Control Deck" },
      {
        name: "description",
        content:
          "Private ZYRAXON control deck: live runtime telemetry, project loader with in-browser editing, and dual-account release routing.",
      },
      { name: "robots", content: "noindex, nofollow" },
      { property: "og:type", content: "website" },
      { property: "og:title", content: "Nebula Core — ZYRAXON Control Deck" },
      { property: "og:description", content: "Private ZYRAXON control deck." },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: NebulaCore,
});

const KEY_STORAGE = "nebula.key";
const REPOS = ["onelpawarai/ZYRAXON-AI", "onelpawarai-X/ZYRAXON-AI"];

type Entry = { name: string; path: string; type: string; size: number };

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

function NebulaCore() {
  const [key, setKey] = useState("");
  const [unlocked, setUnlocked] = useState(false);
  const [tab, setTab] = useState<"core" | "loader" | "releases">("core");
  const [error, setError] = useState<string | null>(null);

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
      <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[#03060f] px-4 text-cyan-50">
        <div className="pointer-events-none absolute -top-40 left-1/2 h-[560px] w-[560px] -translate-x-1/2 rounded-full bg-cyan-500/20 blur-[140px]" />
        <div className="pointer-events-none absolute bottom-0 right-0 h-[420px] w-[420px] rounded-full bg-fuchsia-500/20 blur-[140px]" />
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            setError(null);
            const res = await fetch(`/api/public/nebula?action=telemetry`, {
              headers: { "x-nebula-key": key },
            });
            if (res.ok) {
              localStorage.setItem(KEY_STORAGE, key);
              setUnlocked(true);
            } else {
              setError("Wrong access key.");
            }
          }}
          className="relative w-full max-w-sm rounded-3xl border border-cyan-400/20 bg-white/5 p-8 backdrop-blur-2xl"
        >
          <h1 className="text-2xl font-semibold tracking-tight">Nebula Core</h1>
          <p className="mt-1 text-sm text-cyan-200/60">Restricted control deck. Enter access key.</p>
          <input
            type="password"
            value={key}
            onChange={(e) => setKey(e.target.value)}
            placeholder="Access key"
            className="mt-6 w-full rounded-xl border border-cyan-400/20 bg-black/40 px-4 py-3 text-sm outline-none placeholder:text-cyan-200/30 focus:border-cyan-400/60"
          />
          {error && <p className="mt-3 text-xs text-rose-300">{error}</p>}
          <button
            type="submit"
            className="mt-5 w-full rounded-xl bg-gradient-to-r from-cyan-500 to-fuchsia-500 px-4 py-3 text-sm font-semibold text-black transition hover:brightness-110"
          >
            Unlock
          </button>
        </form>
      </main>
    );
  }

  return (
    <main className="relative min-h-screen overflow-hidden bg-[#03060f] text-cyan-50">
      <div className="pointer-events-none absolute -top-56 left-1/3 h-[620px] w-[620px] rounded-full bg-cyan-500/15 blur-[160px]" />
      <div className="pointer-events-none absolute bottom-[-10rem] right-0 h-[520px] w-[520px] rounded-full bg-fuchsia-500/15 blur-[160px]" />

      <header className="relative border-b border-cyan-400/10 px-6 py-5 backdrop-blur-xl">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-xl font-semibold tracking-tight">Nebula Core</h1>
            <p className="text-xs text-cyan-200/50">ZYRAXON private control deck</p>
          </div>
          <nav className="flex gap-1 rounded-full border border-cyan-400/20 bg-white/5 p-1 text-sm backdrop-blur-xl">
            {(["core", "loader", "releases"] as const).map((t) => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={`rounded-full px-4 py-1.5 capitalize transition ${
                  tab === t ? "bg-cyan-400/90 text-black" : "text-cyan-100/70 hover:text-cyan-100"
                }`}
              >
                {t}
              </button>
            ))}
          </nav>
        </div>
      </header>

      <div className="relative mx-auto max-w-6xl px-6 py-8">
        {tab === "core" && <CorePanel call={call} />}
        {tab === "loader" && <LoaderPanel call={call} />}
        {tab === "releases" && <ReleasesPanel />}
      </div>
    </main>
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
