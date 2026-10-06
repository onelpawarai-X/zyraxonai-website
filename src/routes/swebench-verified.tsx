import { useEffect, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";

export const Route = createFileRoute("/swebench-verified")({
  head: () => ({
    meta: [
      { title: "SWE-bench Verified Report — ZYRAXON AI, Inc." },
      { name: "description", content: "ZYRAXON AI SWE-bench Verified results: methodology, first run vs re-run, and downloadable evidence." },
      { property: "og:title", content: "SWE-bench Verified Report — ZYRAXON AI" },
      { property: "og:description", content: "Methodology, authors, first run vs re-run results and evidence." },
      { property: "og:type", content: "article" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: SwePage,
});

type R = Record<string, any>;
const FIELDS: [string, string, boolean][] = [
  ["title", "Title", false], ["score", "Score (e.g. 72.4% resolved)", false], ["authors", "Authors", true],
  ["contribution", "Contributions", true], ["methodology", "Methodology report", true],
  ["first_run", "First run results", true], ["rerun", "Re-run results", true],
  ["code_url", "Code link", false], ["results_url", "Results link", false],
  ["report_url", "Methodology report link", false], ["download_url", "Download link", false],
];
const input = "w-full rounded-lg border border-border bg-background/60 px-3 py-2 text-sm outline-none focus:border-primary";

function SwePage() {
  const [r, setR] = useState<R>({});
  const [key, setKey] = useState("");
  const [owner, setOwner] = useState(false);
  const [msg, setMsg] = useState("");

  const load = (k = key) =>
    fetch("/api/public/swebench", { headers: k ? { "x-nebula-key": k } : {} })
      .then((x) => x.json()).then((d) => { setR(d.report ?? {}); setOwner(!!d.owner); if (k && !d.owner) setMsg("Wrong password"); });
  useEffect(() => { const k = sessionStorage.getItem("nebula.key") || ""; setKey(k); load(k); }, []);

  async function save() {
    const res = await fetch("/api/public/swebench", { method: "POST", headers: { "Content-Type": "application/json", "x-nebula-key": key }, body: JSON.stringify(r) });
    const d = await res.json().catch(() => ({}));
    setMsg(res.ok ? "Saved." : d.error || "Failed");
  }

  return (
    <main className="min-h-screen bg-background text-foreground">
      <div className="mx-auto max-w-4xl px-5 py-12">
        <Link to="/" className="text-sm text-muted-foreground hover:text-foreground">← ZYRAXON AI</Link>
        <h1 className="mt-4 text-4xl font-bold tracking-tight">{r.title || "ZYRAXON AI — SWE-bench Verified"}</h1>
        {r.score && <p className="mt-3 text-3xl font-semibold text-primary">{r.score}</p>}

        {!owner ? (
          <>
            {[["Authors", r.authors], ["Contributions", r.contribution], ["Methodology", r.methodology]].map(([t, v]) => v ? (
              <section key={t} className="mt-8"><h2 className="text-lg font-semibold">{t}</h2><p className="mt-2 whitespace-pre-wrap text-muted-foreground">{v}</p></section>
            ) : null)}
            {(r.first_run || r.rerun) && (
              <section className="mt-8 grid gap-4 sm:grid-cols-2">
                <div className="rounded-xl border border-border bg-card p-4"><h3 className="font-semibold">First run</h3><p className="mt-2 whitespace-pre-wrap text-sm text-muted-foreground">{r.first_run || "—"}</p></div>
                <div className="rounded-xl border border-border bg-card p-4"><h3 className="font-semibold">Re-run</h3><p className="mt-2 whitespace-pre-wrap text-sm text-muted-foreground">{r.rerun || "—"}</p></div>
              </section>
            )}
            <section className="mt-8 flex flex-wrap gap-3">
              {[["Code", r.code_url], ["Results", r.results_url], ["Methodology report", r.report_url], ["Download evidence", r.download_url]].map(([t, u]) => u ? (
                <a key={t} href={u} target="_blank" rel="noopener noreferrer" className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground">{t}</a>
              ) : null)}
            </section>
            {!r.score && !r.methodology && <p className="mt-8 text-muted-foreground">The report will be published soon.</p>}
            <details className="mt-16 text-xs text-muted-foreground">
              <summary className="cursor-pointer">Owner</summary>
              <div className="mt-2 flex gap-2">
                <input type="password" className={input} value={key} onChange={(e) => setKey(e.target.value)} placeholder="Password" />
                <button onClick={() => { sessionStorage.setItem("nebula.key", key); setMsg(""); load(key); }} className="rounded-lg bg-primary px-4 text-primary-foreground">Open</button>
              </div>
              {msg && <p className="mt-2">{msg}</p>}
            </details>
          </>
        ) : (
          <section className="mt-8 space-y-3">
            {FIELDS.map(([k, label, multi]) => (
              <label key={k} className="block text-sm">
                <span className="font-medium">{label}</span>
                {multi
                  ? <textarea rows={4} className={input + " mt-1"} value={r[k] ?? ""} onChange={(e) => setR({ ...r, [k]: e.target.value })} />
                  : <input className={input + " mt-1"} value={r[k] ?? ""} onChange={(e) => setR({ ...r, [k]: e.target.value })} />}
              </label>
            ))}
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={!!r.links_public} onChange={(e) => setR({ ...r, links_public: e.target.checked })} />
              Make code / results / report / download links visible to everyone
            </label>
            <div className="flex gap-3">
              <button onClick={save} className="rounded-lg bg-primary px-5 py-2 text-sm font-semibold text-primary-foreground">Save report</button>
              <button onClick={() => { sessionStorage.removeItem("nebula.key"); setKey(""); load(""); }} className="text-sm text-muted-foreground">Exit owner mode</button>
            </div>
            {msg && <p className="text-sm text-muted-foreground">{msg}</p>}
          </section>
        )}
      </div>
    </main>
  );
}
