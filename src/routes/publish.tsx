import { createFileRoute } from "@tanstack/react-router";
import { useState, useEffect, useCallback, useRef } from "react";

export const Route = createFileRoute("/publish")({
  head: () => ({ meta: [{ title: "Publish — ZYRAXON AI" }] }),
  component: PublishPage,
});

const ENDPOINT = "https://agent-ecosystem-hub.lovable.app/api/public/v1";

interface PublishedApp {
  slug: string;
  name: string;
  tagline: string;
  description: string;
  category: string;
  source_agent: string;
  author_name: string;
  cover_url: string;
  live_url: string;
  repo_url: string;
  version: string;
  tags: string[];
  published_at: string;
  scan?: { score: number; blocked: boolean; findings: string[] };
}

interface PublishResult {
  slug: string;
  status: string;
  scan?: { score: number; blocked: boolean; findings: string[] };
  url: string;
}

function PublishPage() {
  return (
    <div style={{ minHeight: "100vh", background: "#f9fafb", fontFamily: "Inter, sans-serif" }}>
      <header style={{ borderBottom: "1px solid #e5e7eb", background: "rgba(255,255,255,0.9)", backdropFilter: "blur(12px)", position: "sticky", top: 0, zIndex: 50 }}>
        <div style={{ maxWidth: 960, margin: "0 auto", padding: "12px 16px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <a href="/" target="_top" style={{ display: "flex", alignItems: "center", gap: 12, textDecoration: "none" }}>
              <div style={{ width: 36, height: 36, borderRadius: 12, background: "linear-gradient(135deg, #059669, #10b981)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <svg style={{ width: 20, height: 20, color: "white" }} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" /></svg>
              </div>
              <div>
                <h1 style={{ fontSize: 18, fontWeight: 700, color: "#111827", margin: 0 }}>Publish</h1>
                <p style={{ fontSize: 12, color: "#6b7280", margin: 0 }}>ZYRAXON Ecosystem Hub</p>
              </div>
            </a>
          </div>
          <a href="/ecosystem" style={{ fontSize: 13, color: "#6b7280", textDecoration: "none", padding: "6px 12px", borderRadius: 8, border: "1px solid #e5e7eb" }}>Back to Ecosystem</a>
        </div>
      </header>
      <main style={{ maxWidth: 960, margin: "0 auto", padding: "24px 16px" }}>
        <PublishForm />
        <PublishedAppsSection />
      </main>
      <footer style={{ borderTop: "1px solid #e5e7eb", background: "white", padding: "24px 0", textAlign: "center" }}>
        <p style={{ fontSize: 10, fontFamily: "monospace", textTransform: "uppercase", letterSpacing: "0.2em", color: "#9ca3af" }}>ZYRAXON-AI // All in one. Anything. Nothing is impossible.</p>
      </footer>
    </div>
  );
}

function PublishForm() {
  const [apiKey, setApiKey] = useState("");
  const [form, setForm] = useState({
    name: "", slug: "", tagline: "", description: "", category: "website",
    source_agent: "cloud", author_name: "", live_url: "", repo_url: "",
    version: "1.0.0", tags: "", publish: false,
  });
  const [step, setStep] = useState<"form" | "preview" | "publishing" | "done" | "error">("form");
  const [result, setResult] = useState<PublishResult | null>(null);
  const [error, setError] = useState("");

  const update = (field: string, value: string | boolean) =>
    setForm((p) => ({ ...p, [field]: value }));

  const generateSlug = () => {
    const slug = form.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
    update("slug", slug);
  };

  const handleSubmit = async () => {
    if (!form.name || !form.slug || !apiKey) return;
    setStep("publishing");
    setError("");
    try {
      const tags = form.tags.split(",").map((t) => t.trim()).filter(Boolean);
      const body = {
        name: form.name,
        slug: form.slug,
        tagline: form.tagline,
        description: form.description,
        category: form.category,
        source_agent: form.source_agent,
        author_name: form.author_name,
        live_url: form.live_url || undefined,
        repo_url: form.repo_url || undefined,
        version: form.version,
        tags,
        publish: true,
      };
      const res = await fetch(`${ENDPOINT}/ingest`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-zyraxon-key": apiKey },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (data.slug || data.status) {
        setResult(data);
        setStep("done");
      } else {
        setError(data.message || data.error || "Publish failed");
        setStep("error");
      }
    } catch (e: any) {
      setError(e?.message || "Connection failed");
      setStep("error");
    }
  };

  const inputStyle: React.CSSProperties = {
    width: "100%", padding: "10px 12px", border: "1px solid #e5e7eb", borderRadius: 8,
    fontSize: 14, outline: "none", boxSizing: "border-box", fontFamily: "inherit",
  };
  const labelStyle: React.CSSProperties = { display: "block", fontSize: 13, fontWeight: 500, color: "#374151", marginBottom: 6 };

  return (
    <div style={{ marginBottom: 48 }}>
      <div style={{ marginBottom: 24 }}>
        <h2 style={{ fontSize: 24, fontWeight: 700, color: "#111827", margin: "0 0 4px" }}>Publish Your Project</h2>
        <p style={{ fontSize: 14, color: "#6b7280", margin: 0 }}>Send your project to the ZYRAXON Ecosystem Hub. Auto-scanned, then published live.</p>
      </div>

      <div style={{ border: "1px solid #e5e7eb", borderRadius: 12, background: "white", padding: 24, marginBottom: 24 }}>
        <div style={{ background: "#eff6ff", border: "1px solid #bfdbfe", borderRadius: 8, padding: 16, marginBottom: 20 }}>
          <h3 style={{ fontSize: 14, fontWeight: 600, color: "#1e40af", margin: "0 0 8px" }}>How it works</h3>
          <ol style={{ fontSize: 13, color: "#1e3a5f", margin: 0, paddingLeft: 20, lineHeight: 1.8 }}>
            <li>Enter your agent API key (get it from your ZYRAXON agent)</li>
            <li>Fill in your project details</li>
            <li>Click <strong>Publish</strong> — the system auto-scans your code</li>
            <li>If no critical findings, your project goes live on the marketplace</li>
            <li>Share the link or connect your GitHub to track stats</li>
          </ol>
        </div>

        {step === "form" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <div>
              <label style={labelStyle}>Agent API Key *</label>
              <input type="password" value={apiKey} onChange={(e) => setApiKey(e.target.value)} placeholder="x-zyraxon-key" style={inputStyle} />
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
              <div>
                <label style={labelStyle}>Project Name *</label>
                <input value={form.name} onChange={(e) => update("name", e.target.value)} onBlur={generateSlug} placeholder="My Awesome Project" style={inputStyle} />
              </div>
              <div>
                <label style={labelStyle}>Slug *</label>
                <input value={form.slug} onChange={(e) => update("slug", e.target.value)} placeholder="my-awesome-project" style={inputStyle} />
              </div>
            </div>
            <div>
              <label style={labelStyle}>Tagline</label>
              <input value={form.tagline} onChange={(e) => update("tagline", e.target.value)} placeholder="One line description" style={inputStyle} />
            </div>
            <div>
              <label style={labelStyle}>Description *</label>
              <textarea value={form.description} onChange={(e) => update("description", e.target.value)} rows={4} placeholder="Full description of your project..." style={{ ...inputStyle, resize: "vertical", minHeight: 80 }} />
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 16 }}>
              <div>
                <label style={labelStyle}>Category</label>
                <select value={form.category} onChange={(e) => update("category", e.target.value)} style={{ ...inputStyle, cursor: "pointer" }}>
                  {["website", "plugin", "template", "theme", "bot", "tool", "cli", "sdk", "model", "app", "other"].map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </div>
              <div>
                <label style={labelStyle}>Source Agent</label>
                <select value={form.source_agent} onChange={(e) => update("source_agent", e.target.value)} style={{ ...inputStyle, cursor: "pointer" }}>
                  {["cloud", "desktop", "mobile", "code"].map((a) => (
                    <option key={a} value={a}>{a}</option>
                  ))}
                </select>
              </div>
              <div>
                <label style={labelStyle}>Version</label>
                <input value={form.version} onChange={(e) => update("version", e.target.value)} placeholder="1.0.0" style={inputStyle} />
              </div>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
              <div>
                <label style={labelStyle}>Author Name</label>
                <input value={form.author_name} onChange={(e) => update("author_name", e.target.value)} placeholder="Your name" style={inputStyle} />
              </div>
              <div>
                <label style={labelStyle}>Tags (comma separated)</label>
                <input value={form.tags} onChange={(e) => update("tags", e.target.value)} placeholder="react, typescript, landing" style={inputStyle} />
              </div>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
              <div>
                <label style={labelStyle}>Live URL</label>
                <input value={form.live_url} onChange={(e) => update("live_url", e.target.value)} placeholder="https://..." style={inputStyle} />
              </div>
              <div>
                <label style={labelStyle}>GitHub Repo URL</label>
                <input value={form.repo_url} onChange={(e) => update("repo_url", e.target.value)} placeholder="https://github.com/..." style={inputStyle} />
              </div>
            </div>
            <div style={{ display: "flex", gap: 12, justifyContent: "flex-end", marginTop: 8 }}>
              <button onClick={handleSubmit} disabled={!form.name || !form.slug || !apiKey}
                style={{ padding: "10px 24px", borderRadius: 8, background: form.name && form.slug && apiKey ? "#059669" : "#d1d5db", border: "none", color: "white", fontSize: 14, fontWeight: 600, cursor: form.name && form.slug && apiKey ? "pointer" : "not-allowed" }}>
                Publish
              </button>
            </div>
          </div>
        )}

        {step === "publishing" && (
          <div style={{ textAlign: "center", padding: 40 }}>
            <div style={{ width: 40, height: 40, border: "3px solid #e5e7eb", borderTopColor: "#059669", borderRadius: "50%", animation: "spin 0.8s linear infinite", margin: "0 auto 16px" }} />
            <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
            <p style={{ fontSize: 14, color: "#6b7280" }}>Publishing... scanning code for security findings.</p>
          </div>
        )}

        {step === "done" && result && (
          <div style={{ textAlign: "center", padding: 40 }}>
            <div style={{ width: 64, height: 64, borderRadius: "50%", background: "#ecfdf5", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 16px" }}>
              <svg style={{ width: 32, height: 32, color: "#059669" }} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
            </div>
            <h3 style={{ fontSize: 20, fontWeight: 700, color: "#111827", margin: "0 0 8px" }}>Published!</h3>
            <p style={{ fontSize: 14, color: "#6b7280", marginBottom: 16 }}>
              {result.scan?.blocked ? "Published with warnings — some findings detected." : "Your project is live on the marketplace."}
            </p>
            {result.scan && (
              <div style={{ background: result.scan.blocked ? "#fef2f2" : "#f0fdf4", border: `1px solid ${result.scan.blocked ? "#fecaca" : "#bbf7d0"}`, borderRadius: 8, padding: 16, marginBottom: 16, textAlign: "left" }}>
                <p style={{ fontSize: 13, fontWeight: 600, margin: "0 0 4px" }}>Security Score: {result.scan.score}/100</p>
                {result.scan.findings.length > 0 && (
                  <ul style={{ fontSize: 12, color: "#6b7280", margin: 0, paddingLeft: 16 }}>
                    {result.scan.findings.map((f, i) => <li key={i}>{f}</li>)}
                  </ul>
                )}
              </div>
            )}
            {result.url && (
              <a href={result.url} target="_blank" rel="noopener noreferrer"
                style={{ display: "inline-block", padding: "8px 16px", borderRadius: 8, background: "#059669", color: "white", fontSize: 13, fontWeight: 600, textDecoration: "none", marginRight: 8 }}>
                View on Marketplace
              </a>
            )}
            <button onClick={() => { setStep("form"); setResult(null); setForm({ name: "", slug: "", tagline: "", description: "", category: "website", source_agent: "cloud", author_name: "", live_url: "", repo_url: "", version: "1.0.0", tags: "", publish: false }); }}
              style={{ padding: "8px 16px", borderRadius: 8, border: "1px solid #e5e7eb", background: "white", color: "#374151", fontSize: 13, cursor: "pointer" }}>
              Publish Another
            </button>
          </div>
        )}

        {step === "error" && (
          <div style={{ textAlign: "center", padding: 40 }}>
            <div style={{ width: 64, height: 64, borderRadius: "50%", background: "#fef2f2", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 16px" }}>
              <svg style={{ width: 32, height: 32, color: "#dc2626" }} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
            </div>
            <h3 style={{ fontSize: 18, fontWeight: 600, color: "#111827", margin: "0 0 8px" }}>Publish Failed</h3>
            <p style={{ fontSize: 14, color: "#dc2626", marginBottom: 16 }}>{error}</p>
            <button onClick={() => setStep("form")} style={{ padding: "8px 16px", borderRadius: 8, border: "1px solid #e5e7eb", background: "white", color: "#374151", fontSize: 13, cursor: "pointer" }}>Try Again</button>
          </div>
        )}
      </div>
    </div>
  );
}

function PublishedAppsSection() {
  const [apps, setApps] = useState<PublishedApp[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<string | null>(null);

  useEffect(() => {
    fetch(`${ENDPOINT}/apps`)
      .then((r) => r.json())
      .then((d) => { if (Array.isArray(d)) setApps(d); else if (d.apps) setApps(d.apps); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  return (
    <div>
      <div style={{ marginBottom: 24 }}>
        <h2 style={{ fontSize: 22, fontWeight: 700, color: "#111827", margin: "0 0 4px" }}>Published Apps</h2>
        <p style={{ fontSize: 14, color: "#6b7280", margin: 0 }}>
          {loading ? "Loading..." : `${apps.length} projects live on the marketplace`}
        </p>
      </div>
      {loading && (
        <div style={{ textAlign: "center", padding: 40, color: "#9ca3af", fontSize: 13 }}>Loading published apps...</div>
      )}
      {!loading && apps.length === 0 && (
        <div style={{ textAlign: "center", padding: 40, border: "1px dashed #d1d5db", borderRadius: 12, color: "#9ca3af", fontSize: 13 }}>
          No published apps yet. Be the first to publish!
        </div>
      )}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: 16 }}>
        {apps.map((app) => (
          <div key={app.slug} style={{ border: "1px solid #e5e7eb", borderRadius: 12, background: "white", overflow: "hidden", transition: "box-shadow 0.15s" }}>
            {app.cover_url && (
              <div style={{ height: 160, overflow: "hidden", background: "#f3f4f6" }}>
                <img src={app.cover_url} alt={app.name} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
              </div>
            )}
            <div style={{ padding: 16 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                <span style={{ padding: "2px 8px", borderRadius: 6, fontSize: 11, fontWeight: 600, background: "#f3f4f6", color: "#6b7280", textTransform: "capitalize" }}>
                  {app.category}
                </span>
                <span style={{ padding: "2px 8px", borderRadius: 6, fontSize: 11, fontWeight: 600, background: "#dbeafe", color: "#2563eb" }}>
                  {app.source_agent}
                </span>
                {app.version && <span style={{ fontSize: 11, color: "#9ca3af" }}>v{app.version}</span>}
              </div>
              <h3 style={{ fontSize: 16, fontWeight: 700, color: "#111827", margin: "0 0 4px" }}>{app.name}</h3>
              {app.tagline && <p style={{ fontSize: 13, color: "#6b7280", margin: "0 0 8px" }}>{app.tagline}</p>}
              <p style={{ fontSize: 12, color: "#9ca3af", margin: "0 0 12px" }}>by {app.author_name || "Anonymous"}</p>
              {app.tags && app.tags.length > 0 && (
                <div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginBottom: 12 }}>
                  {app.tags.slice(0, 5).map((t) => (
                    <span key={t} style={{ padding: "2px 8px", borderRadius: 12, fontSize: 11, background: "#f3f4f6", color: "#6b7280" }}>{t}</span>
                  ))}
                </div>
              )}
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                {app.live_url && (
                  <a href={app.live_url} target="_blank" rel="noopener noreferrer"
                    style={{ padding: "6px 12px", borderRadius: 6, background: "#059669", color: "white", fontSize: 12, fontWeight: 600, textDecoration: "none" }}>
                    Live Demo
                  </a>
                )}
                {app.repo_url && (
                  <a href={app.repo_url} target="_blank" rel="noopener noreferrer"
                    style={{ padding: "6px 12px", borderRadius: 6, border: "1px solid #e5e7eb", background: "white", color: "#374151", fontSize: 12, textDecoration: "none" }}>
                    GitHub
                  </a>
                )}
                {app.scan && (
                  <span style={{ padding: "6px 12px", borderRadius: 6, fontSize: 12, fontWeight: 600, color: app.scan.blocked ? "#dc2626" : "#059669", background: app.scan.blocked ? "#fef2f2" : "#f0fdf4" }}>
                    Score: {app.scan.score}/100
                  </span>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
