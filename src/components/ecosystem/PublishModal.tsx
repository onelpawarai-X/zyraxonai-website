import { useState, useEffect } from "react";

const ENDPOINT = "https://agent-ecosystem-hub.lovable.app/api/public/v1";

interface PublishModalProps {
  isOpen: boolean;
  onClose: () => void;
  onPublished?: () => void;
}

interface PublishResult {
  slug: string;
  status: string;
  scan?: { score: number; blocked: boolean; findings: string[] };
  url: string;
}

const CATEGORIES = [
  "website", "plugin", "template", "theme", "bot", "tool",
  "cli", "sdk", "model", "app", "other",
];

const AGENTS = ["cloud", "desktop", "mobile", "code"];

interface SourceFile {
  path: string;
  content: string;
}

async function readFilesAsSourceFiles(files: FileList): Promise<SourceFile[]> {
  const results: SourceFile[] = [];
  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    try {
      const content = await file.text();
      results.push({ path: file.name, content });
    } catch {
      results.push({ path: file.name, content: "[binary file]" });
    }
  }
  return results;
}

const inputStyle: React.CSSProperties = {
  width: "100%", padding: "10px 12px", border: "1px solid #e5e7eb", borderRadius: 8,
  fontSize: 14, outline: "none", boxSizing: "border-box", fontFamily: "inherit",
  background: "white", color: "#1f2937",
};
const labelStyle: React.CSSProperties = { display: "block", fontSize: 13, fontWeight: 500, color: "#374151", marginBottom: 6 };

export const PublishModal: React.FC<PublishModalProps> = ({ isOpen, onClose, onPublished }) => {
  const [apiKey, setApiKey] = useState("");
  const [form, setForm] = useState({
    name: "", slug: "", tagline: "", description: "", category: "website",
    source_agent: "cloud", author_name: "", live_url: "", repo_url: "",
    version: "1.0.0", tags: "",
  });
  const [sourceFiles, setSourceFiles] = useState<SourceFile[]>([]);
  const [dragOver, setDragOver] = useState(false);
  const [step, setStep] = useState<"form" | "publishing" | "done" | "error">("form");
  const [result, setResult] = useState<PublishResult | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!isOpen) {
      setStep("form");
      setResult(null);
      setError("");
      setSourceFiles([]);
    }
  }, [isOpen]);

  const update = (field: string, value: string) => setForm((p) => ({ ...p, [field]: value }));

  const generateSlug = () => {
    const slug = form.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
    update("slug", slug);
  };

  const handlePublish = async () => {
    if (!form.name || !form.slug || !apiKey) return;
    setStep("publishing");
    setError("");
    try {
      const tags = form.tags.split(",").map((t) => t.trim()).filter(Boolean);
      const body: any = {
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
      if (sourceFiles.length > 0) {
        body.files = sourceFiles;
      }
      const res = await fetch(`${ENDPOINT}/ingest`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-zyraxon-key": apiKey },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (data.slug || data.status) {
        setResult(data);
        setStep("done");
        onPublished?.();
      } else {
        setError(data.message || data.error || "Publish failed. Check your API key.");
        setStep("error");
      }
    } catch (e: any) {
      setError(e?.message || "Connection failed. Is the endpoint reachable?");
      setStep("error");
    }
  };

  if (!isOpen) return null;

  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, zIndex: 1000, background: "rgba(0,0,0,0.4)", backdropFilter: "blur(4px)", display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
      <div onClick={(e) => e.stopPropagation()} style={{ background: "white", borderRadius: 16, width: "100%", maxWidth: 640, maxHeight: "90vh", overflow: "hidden", display: "flex", flexDirection: "column", boxShadow: "0 24px 60px rgba(0,0,0,0.15)" }}>
        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "16px 20px", borderBottom: "1px solid #e5e7eb" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div style={{ width: 32, height: 32, borderRadius: 8, background: "linear-gradient(135deg, #059669, #10b981)", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <svg style={{ width: 18, height: 18, color: "white" }} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" /></svg>
            </div>
            <h2 style={{ fontSize: 18, fontWeight: 600, color: "#111827", margin: 0 }}>
              {step === "form" && "Publish to ZYRAXON Hub"}
              {step === "publishing" && "Publishing..."}
              {step === "done" && "Published!"}
              {step === "error" && "Publish Failed"}
            </h2>
          </div>
          <button onClick={onClose} aria-label="Close publish dialog" style={{ width: 32, height: 32, borderRadius: 8, background: "none", border: "1px solid #e5e7eb", color: "#6b7280", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16 }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><path d="M18 6L6 18M6 6l12 12" /></svg>
          </button>
        </div>

        {/* Body */}
        <div style={{ overflow: "auto", flex: 1, padding: 20 }}>
          {step === "form" && (
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              <div style={{ background: "#eff6ff", border: "1px solid #bfdbfe", borderRadius: 8, padding: 14, marginBottom: 4 }}>
                <p style={{ fontSize: 13, color: "#1e40af", margin: 0, lineHeight: 1.6 }}>
                  Publish directly to the ZYRAXON Ecosystem Hub. Your project will be auto-scanned for security. No critical findings = goes live instantly.
                </p>
              </div>

              <div>
                <label style={labelStyle}>Agent API Key *</label>
                <input type="password" value={apiKey} onChange={(e) => setApiKey(e.target.value)} placeholder="x-zyraxon-key from your agent" style={inputStyle} />
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
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
                <input value={form.tagline} onChange={(e) => update("tagline", e.target.value)} placeholder="One line about your project" style={inputStyle} />
              </div>

              <div>
                <label style={labelStyle}>Description *</label>
                <textarea value={form.description} onChange={(e) => update("description", e.target.value)} rows={3} placeholder="Full description..." style={{ ...inputStyle, resize: "vertical", minHeight: 80 }} />
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 14 }}>
                <div>
                  <label style={labelStyle}>Category</label>
                  <select value={form.category} onChange={(e) => update("category", e.target.value)} style={{ ...inputStyle, cursor: "pointer" }}>
                    {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
                <div>
                  <label style={labelStyle}>Source Agent</label>
                  <select value={form.source_agent} onChange={(e) => update("source_agent", e.target.value)} style={{ ...inputStyle, cursor: "pointer" }}>
                    {AGENTS.map((a) => <option key={a} value={a}>{a}</option>)}
                  </select>
                </div>
                <div>
                  <label style={labelStyle}>Version</label>
                  <input value={form.version} onChange={(e) => update("version", e.target.value)} placeholder="1.0.0" style={inputStyle} />
                </div>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
                <div>
                  <label style={labelStyle}>Author Name</label>
                  <input value={form.author_name} onChange={(e) => update("author_name", e.target.value)} placeholder="Your name" style={inputStyle} />
                </div>
                <div>
                  <label style={labelStyle}>Tags (comma separated)</label>
                  <input value={form.tags} onChange={(e) => update("tags", e.target.value)} placeholder="react, landing, saas" style={inputStyle} />
                </div>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
                <div>
                  <label style={labelStyle}>Live URL</label>
                  <input value={form.live_url} onChange={(e) => update("live_url", e.target.value)} placeholder="https://..." style={inputStyle} />
                </div>
                <div>
                  <label style={labelStyle}>GitHub Repo</label>
                  <input value={form.repo_url} onChange={(e) => update("repo_url", e.target.value)} placeholder="https://github.com/..." style={inputStyle} />
                </div>
              </div>

              <div>
                <label style={labelStyle}>Source Code (optional — upload your project files)</label>
                <div
                  onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                  onDragLeave={() => setDragOver(false)}
                  onDrop={async (e) => {
                    e.preventDefault();
                    setDragOver(false);
                    const files = e.dataTransfer.files;
                    if (files.length > 0) {
                      const newFiles = await readFilesAsSourceFiles(files);
                      setSourceFiles((prev) => [...prev, ...newFiles]);
                    }
                  }}
                  style={{
                    border: `2px dashed ${dragOver ? "#059669" : "#d1d5db"}`,
                    borderRadius: 8,
                    padding: 24,
                    textAlign: "center",
                    background: dragOver ? "#f0fdf4" : "#f9fafb",
                    cursor: "pointer",
                    transition: "all 0.15s",
                  }}
                >
                  <input
                    type="file"
                    multiple
                    id="source-files-input"
                    onChange={async (e) => {
                      const files = e.target.files;
                      if (files && files.length > 0) {
                        const newFiles = await readFilesAsSourceFiles(files);
                        setSourceFiles((prev) => [...prev, ...newFiles]);
                      }
                      e.target.value = "";
                    }}
                    style={{ display: "none" }}
                  />
                  <svg style={{ width: 32, height: 32, color: "#9ca3af", margin: "0 auto 8px" }} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" /></svg>
                  <p style={{ fontSize: 13, color: "#6b7280", margin: "0 0 4px" }}>
                    Drop files here or <span style={{ color: "#059669", fontWeight: 600 }} onClick={() => document.getElementById("source-files-input")?.click()}>browse</span>
                  </p>
                  <p style={{ fontSize: 11, color: "#9ca3af", margin: 0 }}>Source code files for auto-scan & publish</p>
                </div>
                {sourceFiles.length > 0 && (
                  <div style={{ marginTop: 8, display: "flex", flexDirection: "column", gap: 4, maxHeight: 120, overflow: "auto" }}>
                    {sourceFiles.map((f, i) => (
                      <div key={i} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "4px 8px", background: "#f3f4f6", borderRadius: 4, fontSize: 12 }}>
                        <span style={{ color: "#374151", fontFamily: "monospace" }}>{f.path}</span>
                        <button onClick={() => setSourceFiles((prev) => prev.filter((_, j) => j !== i))} aria-label={`Remove file ${f.path}`} style={{ background: "none", border: "none", color: "#dc2626", cursor: "pointer", fontSize: 14, padding: 0 }}>×</button>
                      </div>
                    ))}
                    <button onClick={() => setSourceFiles([])} style={{ background: "none", border: "none", color: "#6b7280", cursor: "pointer", fontSize: 12, textAlign: "left", padding: "2px 0" }}>Clear all</button>
                  </div>
                )}
              </div>
            </div>
          )}

          {step === "publishing" && (
            <div style={{ textAlign: "center", padding: 48 }}>
              <div style={{ width: 48, height: 48, border: "3px solid #e5e7eb", borderTopColor: "#059669", borderRadius: "50%", animation: "spin 0.8s linear infinite", margin: "0 auto 16px" }} />
              <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
              <p style={{ fontSize: 15, color: "#6b7280", margin: 0 }}>Scanning and publishing your project...</p>
            </div>
          )}

          {step === "done" && result && (
            <div style={{ textAlign: "center", padding: 48 }}>
              <div style={{ width: 64, height: 64, borderRadius: "50%", background: "#ecfdf5", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 16px" }}>
                <svg style={{ width: 32, height: 32, color: "#059669" }} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
              </div>
              <h3 style={{ fontSize: 20, fontWeight: 700, color: "#111827", margin: "0 0 8px" }}>Published!</h3>
              <p style={{ fontSize: 14, color: "#6b7280", marginBottom: 20 }}>
                {result.scan?.blocked ? "Published with warnings." : "Live on the marketplace."}
              </p>
              {result.scan && (
                <div style={{ background: result.scan.blocked ? "#fef2f2" : "#f0fdf4", border: `1px solid ${result.scan.blocked ? "#fecaca" : "#bbf7d0"}`, borderRadius: 8, padding: 16, marginBottom: 20, textAlign: "left" }}>
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
                  style={{ display: "inline-block", padding: "8px 16px", borderRadius: 8, background: "#059669", color: "white", fontSize: 13, fontWeight: 600, textDecoration: "none" }}>
                  View on Marketplace
                </a>
              )}
            </div>
          )}

          {step === "error" && (
            <div style={{ textAlign: "center", padding: 48 }}>
              <div style={{ width: 64, height: 64, borderRadius: "50%", background: "#fef2f2", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 16px" }}>
                <svg style={{ width: 32, height: 32, color: "#dc2626" }} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
              </div>
              <h3 style={{ fontSize: 18, fontWeight: 600, color: "#111827", margin: "0 0 8px" }}>Failed</h3>
              <p style={{ fontSize: 14, color: "#dc2626", marginBottom: 16 }}>{error}</p>
            </div>
          )}
        </div>

        {/* Footer */}
        {step === "form" && (
          <div style={{ padding: "16px 20px", borderTop: "1px solid #e5e7eb", display: "flex", gap: 10, justifyContent: "flex-end" }}>
            <button onClick={onClose} style={{ padding: "8px 16px", borderRadius: 8, border: "1px solid #e5e7eb", background: "white", color: "#6b7280", fontSize: 13, cursor: "pointer" }}>Cancel</button>
            <button onClick={handlePublish} disabled={!form.name || !form.slug || !apiKey}
              style={{ padding: "8px 20px", borderRadius: 8, background: form.name && form.slug && apiKey ? "#059669" : "#d1d5db", border: "none", color: "white", fontSize: 13, fontWeight: 600, cursor: form.name && form.slug && apiKey ? "pointer" : "not-allowed" }}>
              Publish
            </button>
          </div>
        )}
        {(step === "done" || step === "error") && (
          <div style={{ padding: "16px 20px", borderTop: "1px solid #e5e7eb", display: "flex", justifyContent: "flex-end" }}>
            <button onClick={onClose} style={{ padding: "8px 16px", borderRadius: 8, background: "#059669", border: "none", color: "white", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>Done</button>
          </div>
        )}
      </div>
    </div>
  );
};
