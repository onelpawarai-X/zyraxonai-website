import { createFileRoute } from "@tanstack/react-router";
import { useState, useEffect } from "react";

export const Route = createFileRoute("/releases")({
  head: () => ({ meta: [{ title: "Releases — ZYRAXON AI" }] }),
  component: ReleasesPage,
});

const REPOS = [
  { owner: "onelpawarai-X", name: "ZYRAXON-AI", label: "ZYRAXON Agent", color: "#2563eb", desc: "Desktop AI agent with 9 modes, 552+ tools" },
  { owner: "onelpawarai-X", name: "Myra-Agent", label: "Myra Agent", color: "#f59e0b", desc: "Android voice AI agent" },
  { owner: "onelpawarai-X", name: "Zyraxon-Code", label: "ZYRAXON Code", color: "#7c3aed", desc: "AI-powered code editor" },
];

function ReleasesPage() {
  return (
    <div style={{ minHeight: "100vh", background: "#f9fafb", fontFamily: "Inter, sans-serif" }}>
      <div style={{ padding: "40px 20px", maxWidth: 800, margin: "0 auto" }}>
        <div style={{ textAlign: "center", marginBottom: 40 }}>
          <p style={{ fontSize: 10, fontFamily: "monospace", textTransform: "uppercase", letterSpacing: "0.3em", color: "#2563eb", marginBottom: 8 }}>ZYRAXON-AI // Releases</p>
          <h1 style={{ fontSize: 36, fontWeight: 900, color: "#111827", letterSpacing: "-0.02em" }}>All Releases</h1>
          <p style={{ fontSize: 14, color: "#6b7280", marginTop: 12 }}>Every version of every ZYRAXON project.</p>
        </div>
        {REPOS.map((repo) => (
          <RepoSection key={repo.name} repo={repo} />
        ))}
      </div>
      <footer style={{ borderTop: "1px solid #e5e7eb", background: "white", padding: "24px 0", textAlign: "center" }}>
        <p style={{ fontSize: 10, fontFamily: "monospace", textTransform: "uppercase", letterSpacing: "0.2em", color: "#9ca3af" }}>ZYRAXON-AI // All in one. Anything. Nothing is impossible.</p>
      </footer>
    </div>
  );
}

function RepoSection({ repo }: { repo: typeof REPOS[0] }) {
  const [releases, setReleases] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<number | null>(null);

  useEffect(() => {
    fetch(`https://api.github.com/repos/${repo.owner}/${repo.name}/releases?per_page=20`, {
      headers: { Accept: "application/vnd.github+json" },
    })
      .then((r) => r.json())
      .then((d) => { if (Array.isArray(d)) setReleases(d.filter((x: any) => !x.draft)); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [repo.owner, repo.name]);

  const totalDownloads = releases.reduce((s, r) => s + (r.assets || []).reduce((s2, a) => s2 + (a.download_count || 0), 0), 0);

  return (
    <div style={{ marginBottom: 48 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16 }}>
        <div style={{ width: 40, height: 40, borderRadius: 12, background: repo.color, color: "white", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700, fontSize: 14, flexShrink: 0 }}>
          {repo.label.charAt(0)}
        </div>
        <div>
          <h2 style={{ fontSize: 20, fontWeight: 700, color: "#111827", margin: 0 }}>{repo.label}</h2>
          <p style={{ fontSize: 13, color: "#6b7280", margin: 0 }}>{repo.desc}</p>
          <p style={{ fontSize: 12, color: "#9ca3af", margin: "4px 0 0" }}>{releases.length} releases · {totalDownloads.toLocaleString()} downloads</p>
        </div>
      </div>
      {loading && <div style={{ textAlign: "center", padding: 32, color: "#9ca3af", fontSize: 13 }}>Loading releases...</div>}
      {!loading && releases.length === 0 && <div style={{ textAlign: "center", padding: 32, color: "#9ca3af", fontSize: 13, border: "1px dashed #d1d5db", borderRadius: 12 }}>No releases yet.</div>}
      {releases.map((r) => {
        const isOpen = expanded === r.id;
        const rDownloads = (r.assets || []).reduce((s, a) => s + (a.download_count || 0), 0);
        return (
          <div key={r.id} style={{ border: "1px solid #e5e7eb", borderRadius: 12, marginBottom: 8, background: "white", overflow: "hidden" }}>
            <button onClick={() => setExpanded(isOpen ? null : r.id)} style={{ width: "100%", textAlign: "left", padding: "16px 20px", border: "none", background: "none", cursor: "pointer", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div>
                <span style={{ fontWeight: 700, fontSize: 15, color: "#111827" }}>{r.name || r.tag_name}</span>
                <span style={{ marginLeft: 8, padding: "2px 8px", background: "#f3f4f6", borderRadius: 6, fontFamily: "monospace", fontSize: 12, color: "#374151" }}>{r.tag_name}</span>
                {r.prerelease && <span style={{ marginLeft: 8, padding: "2px 8px", background: "#fef3c7", borderRadius: 6, fontSize: 11, fontWeight: 700, color: "#b45309" }}>Pre-release</span>}
              </div>
              <span style={{ fontSize: 13, color: "#6b7280" }}>{new Date(r.published_at).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" })} · {rDownloads.toLocaleString()} dl</span>
            </button>
            {isOpen && (
              <div style={{ padding: "0 20px 20px", borderTop: "1px solid #f3f4f6" }}>
                {r.body && <pre style={{ background: "#f9fafb", padding: 12, borderRadius: 8, fontSize: 13, color: "#374151", whiteSpace: "pre-wrap", overflow: "auto", maxHeight: 200 }}>{r.body}</pre>}
                <div style={{ marginTop: 12 }}>
                  {(r.assets || []).map((a) => (
                    <a key={a.name} href={a.browser_download_url} target="_blank" rel="noopener noreferrer" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 14px", border: "1px solid #f3f4f6", borderRadius: 8, marginBottom: 4, textDecoration: "none", transition: "border-color 0.15s" }}>
                      <span style={{ fontSize: 13, color: "#111827" }}>{a.name}</span>
                      <span style={{ fontSize: 12, color: "#6b7280" }}>{fmtSize(a.size)} · {a.download_count} dl</span>
                    </a>
                  ))}
                </div>
                <a href={r.html_url} target="_blank" rel="noopener noreferrer" style={{ display: "inline-block", marginTop: 8, fontSize: 12, color: "#6b7280", textDecoration: "underline" }}>View on GitHub</a>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

function fmtSize(b: number): string {
  if (!b) return "";
  if (b > 1e9) return (b / 1e9).toFixed(1) + " GB";
  if (b > 1e6) return (b / 1e6).toFixed(0) + " MB";
  return (b / 1e3).toFixed(0) + " KB";
}
