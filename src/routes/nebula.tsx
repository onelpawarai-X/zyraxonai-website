import { createFileRoute } from "@tanstack/react-router";
import { useState, useEffect, useMemo } from "react";

export const Route = createFileRoute("/nebula")({
  head: () => ({
    meta: [
      { title: "ZYRAXON Nebula — Autonomous Command Deck" },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: NebulaStandalonePage,
});

const GITHUB_REPO = "onelpawarai-X/ZYRAXON-AI";
const KEY_STORAGE = "nebula.key";
const FEATURES_STORAGE = "zyraxon.features.v2";

type ContentRow = {
  id: string;
  kind: "feature" | "announcement" | "update" | "model";
  title: string;
  subtitle?: string;
  body?: string;
  image_url?: string;
  link_url?: string;
  badge?: string;
  accent?: string;
  published: boolean;
  updatedAt: string;
};

const DEFAULT_FEATURES: ContentRow[] = [
  {
    id: "f-1",
    kind: "feature",
    title: "Dual Core Engine v19",
    subtitle: "Real-time Autonomous Coding Agent",
    body: "Powered by 805 tools across 63 categories and 10 agent modes with screen vision and eternal memory.",
    badge: "CORE",
    accent: "#06b6d4",
    link_url: `https://github.com/${GITHUB_REPO}`,
    published: true,
    updatedAt: new Date().toISOString(),
  },
  {
    id: "f-2",
    kind: "announcement",
    title: "Official Native Desktop Binaries",
    subtitle: "Windows EXE, Linux DEB & macOS DMG",
    body: "Download pre-compiled builds directly synced from GitHub Releases.",
    badge: "RELEASE",
    accent: "#a855f7",
    link_url: `https://github.com/${GITHUB_REPO}/releases`,
    published: true,
    updatedAt: new Date().toISOString(),
  },
];

export function NebulaStandalonePage() {
  const [unlocked, setUnlocked] = useState(false);
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [tab, setTab] = useState<"studio" | "docs" | "releases" | "telemetry">("studio");
  const [features, setFeatures] = useState<ContentRow[]>(DEFAULT_FEATURES);
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  // New feature form state
  const [form, setForm] = useState<Partial<ContentRow>>({
    kind: "feature",
    title: "",
    subtitle: "",
    body: "",
    badge: "NEW",
    accent: "#06b6d4",
    link_url: "",
    image_url: "",
    published: true,
  });

  // Docs state
  const [docsList, setDocsList] = useState<{ name: string; path: string; download_url?: string }[]>([]);
  const [selectedDoc, setSelectedDoc] = useState<string>("README.md");
  const [docContent, setDocContent] = useState<string>("");
  const [loadingDoc, setLoadingDoc] = useState(false);
  const [docSearch, setDocSearch] = useState("");

  // Releases state
  const [releases, setReleases] = useState<any[]>([]);
  const [loadingReleases, setLoadingReleases] = useState(false);

  // Check existing login
  useEffect(() => {
    const saved = localStorage.getItem(KEY_STORAGE);
    if (saved === "ZYRAXON" || (saved && saved.length >= 4)) {
      setUnlocked(true);
    }
    const local = localStorage.getItem(FEATURES_STORAGE);
    if (local) {
      try {
        const parsed = JSON.parse(local);
        if (Array.isArray(parsed) && parsed.length) setFeatures(parsed);
      } catch {}
    }
  }, []);

  // Unlock check
  const handleUnlock = (e: React.FormEvent) => {
    e.preventDefault();
    if (password.trim() === "ZYRAXON" || password.trim().toUpperCase() === "ZYRAXON") {
      localStorage.setItem(KEY_STORAGE, "ZYRAXON");
      setUnlocked(true);
      setError("");
    } else {
      setError("ভুল পাসওয়ার্ড! মাস্টার পাসওয়ার্ড হলো: ZYRAXON");
    }
  };

  const handleLock = () => {
    localStorage.removeItem(KEY_STORAGE);
    setUnlocked(false);
    setPassword("");
  };

  // Add Feature
  const handleAddFeature = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.title?.trim()) return;
    setSaving(true);
    const newRow: ContentRow = {
      id: "f-" + Date.now(),
      kind: form.kind || "feature",
      title: form.title.trim(),
      subtitle: form.subtitle?.trim(),
      body: form.body?.trim(),
      badge: form.badge?.trim() || "NEW",
      accent: form.accent || "#06b6d4",
      link_url: form.link_url?.trim(),
      image_url: form.image_url?.trim(),
      published: form.published ?? true,
      updatedAt: new Date().toISOString(),
    };
    const updated = [newRow, ...features];
    setFeatures(updated);
    localStorage.setItem(FEATURES_STORAGE, JSON.stringify(updated));

    // Reset Form
    setForm({
      kind: "feature",
      title: "",
      subtitle: "",
      body: "",
      badge: "NEW",
      accent: "#06b6d4",
      link_url: "",
      image_url: "",
      published: true,
    });
    setSaving(false);
    setSaveSuccess(true);
    setTimeout(() => setSaveSuccess(false), 3000);
  };

  // Delete Feature
  const handleDelete = (id: string) => {
    const updated = features.filter((f) => f.id !== id);
    setFeatures(updated);
    localStorage.setItem(FEATURES_STORAGE, JSON.stringify(updated));
  };

  // Toggle Publish
  const handleToggle = (id: string) => {
    const updated = features.map((f) => (f.id === id ? { ...f, published: !f.published } : f));
    setFeatures(updated);
    localStorage.setItem(FEATURES_STORAGE, JSON.stringify(updated));
  };

  // Fetch Docs from GitHub
  useEffect(() => {
    if (!unlocked || tab !== "docs") return;
    async function loadDocs() {
      setLoadingDoc(true);
      try {
        const res = await fetch(`https://api.github.com/repos/${GITHUB_REPO}/contents/docs`);
        if (res.ok) {
          const files = await res.json();
          if (Array.isArray(files)) {
            const list = files
              .filter((f) => f.name.endsWith(".md") || f.name.endsWith(".txt"))
              .map((f) => ({ name: f.name, path: f.path, download_url: f.download_url }));
            setDocsList([{ name: "README.md", path: "README.md" }, ...list]);
          }
        }
      } catch {}
      // Load README default
      loadDocFile("README.md");
    }
    loadDocs();
  }, [unlocked, tab]);

  const loadDocFile = async (path: string) => {
    setSelectedDoc(path);
    setLoadingDoc(true);
    try {
      const res = await fetch(`https://raw.githubusercontent.com/${GITHUB_REPO}/main/${path}`);
      if (res.ok) {
        const text = await res.text();
        setDocContent(text);
      } else {
        setDocContent(`### Error: File ${path} could not be loaded from GitHub.`);
      }
    } catch {
      setDocContent(`### Error connecting to GitHub repository ${GITHUB_REPO}.`);
    } finally {
      setLoadingDoc(false);
    }
  };

  // Fetch Releases from GitHub
  useEffect(() => {
    if (!unlocked || tab !== "releases") return;
    async function loadReleases() {
      setLoadingReleases(true);
      try {
        const res = await fetch(`https://api.github.com/repos/${GITHUB_REPO}/releases`);
        if (res.ok) {
          const data = await res.json();
          if (Array.isArray(data)) setReleases(data);
        }
      } catch {}
      setLoadingReleases(false);
    }
    loadReleases();
  }, [unlocked, tab]);

  /* ======================================================================== */
  /* PASSWORD LOCK SCREEN                                                     */
  /* ======================================================================== */
  if (!unlocked) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#05070f", color: "#f1f5f9", fontFamily: "sans-serif", position: "relative", overflow: "hidden" }}>
        {/* Neon Glow Rings */}
        <div style={{ position: "absolute", top: "20%", left: "30%", width: 400, height: 400, background: "radial-gradient(circle, rgba(168,85,247,0.15) 0%, transparent 70%)", filter: "blur(40px)", pointerEvents: "none" }} />
        <div style={{ position: "absolute", bottom: "20%", right: "30%", width: 400, height: 400, background: "radial-gradient(circle, rgba(6,182,212,0.15) 0%, transparent 70%)", filter: "blur(40px)", pointerEvents: "none" }} />

        <div style={{ width: "100%", maxWidth: 440, padding: 36, background: "rgba(15, 23, 42, 0.75)", border: "1px solid rgba(148, 163, 184, 0.15)", borderRadius: 20, backdropFilter: "blur(20px)", boxShadow: "0 25px 50px -12px rgba(0,0,0,0.7)" }}>
          <div style={{ textAlign: "center", marginBottom: 28 }}>
            <div style={{ width: 60, height: 60, borderRadius: 16, background: "linear-gradient(135deg, #06b6d4, #a855f7)", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 16px", boxShadow: "0 0 25px rgba(6,182,212,0.4)" }}>
              <span style={{ fontSize: 26 }}>⚡</span>
            </div>
            <h1 style={{ fontSize: 24, fontWeight: 800, margin: 0, letterSpacing: "-0.03em" }}>ZYRAXON NEBULA</h1>
            <p style={{ fontSize: 13, color: "#94a3b8", marginTop: 6 }}>Master Autonomous Command Center</p>
          </div>

          <form onSubmit={handleUnlock}>
            <div style={{ marginBottom: 16 }}>
              <label style={{ display: "block", fontSize: 12, textTransform: "uppercase", letterSpacing: "0.08em", color: "#94a3b8", marginBottom: 8 }}>Master Key</label>
              <input
                type="password"
                placeholder="Enter password (default: ZYRAXON)"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoFocus
                style={{ width: "100%", padding: "12px 16px", background: "rgba(2, 6, 23, 0.7)", border: "1px solid rgba(148, 163, 184, 0.2)", borderRadius: 10, color: "#f8fafc", fontSize: 14, outline: "none", boxSizing: "border-box" }}
              />
            </div>

            {error && <div style={{ padding: "10px 14px", background: "rgba(239, 68, 68, 0.15)", border: "1px solid rgba(239, 68, 68, 0.3)", borderRadius: 8, color: "#fca5a5", fontSize: 13, marginBottom: 16 }}>{error}</div>}

            <button
              type="submit"
              style={{ width: "100%", padding: "12px 0", background: "linear-gradient(90deg, #06b6d4, #a855f7)", border: "none", borderRadius: 10, color: "#ffffff", fontWeight: 700, fontSize: 14, cursor: "pointer", boxShadow: "0 0 20px rgba(6,182,212,0.3)" }}
            >
              Unlock Command Deck →
            </button>
          </form>

          <div style={{ marginTop: 24, textAlign: "center" }}>
            <a href="/" style={{ color: "#64748b", fontSize: 12, textDecoration: "none" }}>← Back to Public Website</a>
          </div>
        </div>
      </div>
    );
  }

  /* ======================================================================== */
  /* COMMAND DECK INTERFACE                                                   */
  /* ======================================================================== */
  return (
    <div style={{ minHeight: "100vh", background: "#020617", color: "#f8fafc", fontFamily: "sans-serif" }}>
      {/* Top Navbar */}
      <header style={{ height: 64, borderBottom: "1px solid rgba(148, 163, 184, 0.1)", background: "rgba(15, 23, 42, 0.8)", backdropFilter: "blur(12px)", display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 28px", position: "sticky", top: 0, zIndex: 50 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <div style={{ width: 36, height: 36, borderRadius: 10, background: "linear-gradient(135deg, #06b6d4, #a855f7)", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 900 }}>⚡</div>
          <div>
            <div style={{ fontWeight: 800, fontSize: 16, letterSpacing: "-0.02em" }}>ZYRAXON NEBULA DECK</div>
            <div style={{ fontSize: 11, color: "#22c55e", display: "flex", alignItems: "center", gap: 6 }}>
              <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#22c55e", display: "inline-block" }} />
              Live Connected: {GITHUB_REPO}
            </div>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div style={{ display: "flex", gap: 8 }}>
          {(["studio", "docs", "releases", "telemetry"] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              style={{
                padding: "8px 16px",
                borderRadius: 8,
                border: "none",
                background: tab === t ? "rgba(6, 182, 212, 0.15)" : "transparent",
                color: tab === t ? "#38bdf8" : "#94a3b8",
                fontWeight: tab === t ? 700 : 500,
                fontSize: 13,
                cursor: "pointer",
                textTransform: "capitalize",
              }}
            >
              {t === "studio" ? "✨ Features Studio" : t === "docs" ? "📚 GitHub Docs" : t === "releases" ? "📦 Releases" : "📊 Telemetry"}
            </button>
          ))}
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <a href="/" target="_blank" style={{ fontSize: 13, color: "#94a3b8", textDecoration: "none", padding: "6px 12px", border: "1px solid rgba(148, 163, 184, 0.2)", borderRadius: 8 }}>View Website ↗</a>
          <button onClick={handleLock} style={{ padding: "6px 12px", background: "rgba(239, 68, 68, 0.15)", color: "#f87171", border: "1px solid rgba(239, 68, 68, 0.3)", borderRadius: 8, fontSize: 13, cursor: "pointer" }}>Lock Deck</button>
        </div>
      </header>

      {/* Main Content Area */}
      <main style={{ maxWidth: 1280, margin: "0 auto", padding: "32px 24px" }}>
        {/* ================================================================== */}
        {/* TAB 1: FEATURES STUDIO                                             */}
        {/* ================================================================== */}
        {tab === "studio" && (
          <div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1.5fr", gap: 28 }}>
              {/* Left Column: Add New Feature Form */}
              <div style={{ background: "rgba(15, 23, 42, 0.6)", border: "1px solid rgba(148, 163, 184, 0.1)", borderRadius: 16, padding: 24 }}>
                <h2 style={{ fontSize: 18, fontWeight: 700, margin: "0 0 16px", color: "#38bdf8" }}>+ নতুন ফিচার বা আপডেট যোগ করুন</h2>
                <form onSubmit={handleAddFeature}>
                  <div style={{ marginBottom: 12 }}>
                    <label style={{ display: "block", fontSize: 12, color: "#94a3b8", marginBottom: 6 }}>ধরন (Type)</label>
                    <select
                      value={form.kind}
                      onChange={(e: any) => setForm({ ...form, kind: e.target.value })}
                      style={{ width: "100%", padding: 10, background: "#090d1a", border: "1px solid rgba(148, 163, 184, 0.2)", borderRadius: 8, color: "white" }}
                    >
                      <option value="feature">Feature (নতুন প্রযুক্তি)</option>
                      <option value="announcement">Announcement (ঘোষণা)</option>
                      <option value="update">Update (আপডেট নোট)</option>
                      <option value="model">AI Model (মডেল তথ্য)</option>
                    </select>
                  </div>

                  <div style={{ marginBottom: 12 }}>
                    <label style={{ display: "block", fontSize: 12, color: "#94a3b8", marginBottom: 6 }}>শিরোনাম (Title)*</label>
                    <input
                      type="text"
                      placeholder="e.g. ZYRAXON Voice Bridge v3"
                      value={form.title}
                      onChange={(e) => setForm({ ...form, title: e.target.value })}
                      required
                      style={{ width: "100%", padding: 10, background: "#090d1a", border: "1px solid rgba(148, 163, 184, 0.2)", borderRadius: 8, color: "white", boxSizing: "border-box" }}
                    />
                  </div>

                  <div style={{ marginBottom: 12 }}>
                    <label style={{ display: "block", fontSize: 12, color: "#94a3b8", marginBottom: 6 }}>সাবটাইটেল (Subtitle)</label>
                    <input
                      type="text"
                      placeholder="e.g. Ultra-low latency voice pipeline"
                      value={form.subtitle}
                      onChange={(e) => setForm({ ...form, subtitle: e.target.value })}
                      style={{ width: "100%", padding: 10, background: "#090d1a", border: "1px solid rgba(148, 163, 184, 0.2)", borderRadius: 8, color: "white", boxSizing: "border-box" }}
                    />
                  </div>

                  <div style={{ marginBottom: 12 }}>
                    <label style={{ display: "block", fontSize: 12, color: "#94a3b8", marginBottom: 6 }}>বিস্তারিত বিবরণ (Body)</label>
                    <textarea
                      rows={3}
                      placeholder="ফিচারটির কাজ কী এবং কেন গুরুত্বপূর্ণ..."
                      value={form.body}
                      onChange={(e) => setForm({ ...form, body: e.target.value })}
                      style={{ width: "100%", padding: 10, background: "#090d1a", border: "1px solid rgba(148, 163, 184, 0.2)", borderRadius: 8, color: "white", boxSizing: "border-box" }}
                    />
                  </div>

                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 12 }}>
                    <div>
                      <label style={{ display: "block", fontSize: 12, color: "#94a3b8", marginBottom: 6 }}>ব্যাজ (Badge)</label>
                      <input
                        type="text"
                        placeholder="NEW, PRO, AGENT"
                        value={form.badge}
                        onChange={(e) => setForm({ ...form, badge: e.target.value })}
                        style={{ width: "100%", padding: 10, background: "#090d1a", border: "1px solid rgba(148, 163, 184, 0.2)", borderRadius: 8, color: "white", boxSizing: "border-box" }}
                      />
                    </div>
                    <div>
                      <label style={{ display: "block", fontSize: 12, color: "#94a3b8", marginBottom: 6 }}>রং (Accent Color)</label>
                      <input
                        type="color"
                        value={form.accent}
                        onChange={(e) => setForm({ ...form, accent: e.target.value })}
                        style={{ width: "100%", height: 42, padding: 4, background: "#090d1a", border: "1px solid rgba(148, 163, 184, 0.2)", borderRadius: 8, cursor: "pointer", boxSizing: "border-box" }}
                      />
                    </div>
                  </div>

                  <div style={{ marginBottom: 16 }}>
                    <label style={{ display: "block", fontSize: 12, color: "#94a3b8", marginBottom: 6 }}>লিংক URL (ঐচ্ছিক)</label>
                    <input
                      type="url"
                      placeholder="https://..."
                      value={form.link_url}
                      onChange={(e) => setForm({ ...form, link_url: e.target.value })}
                      style={{ width: "100%", padding: 10, background: "#090d1a", border: "1px solid rgba(148, 163, 184, 0.2)", borderRadius: 8, color: "white", boxSizing: "border-box" }}
                    />
                  </div>

                  {saveSuccess && <div style={{ color: "#4ade80", fontSize: 13, marginBottom: 12 }}>✔ ফিচার সফলভাবে সংরক্ষণ ও পাবলিশ করা হয়েছে!</div>}

                  <button
                    type="submit"
                    disabled={saving}
                    style={{ width: "100%", padding: "12px 0", background: "linear-gradient(90deg, #06b6d4, #a855f7)", border: "none", borderRadius: 8, color: "white", fontWeight: 700, cursor: "pointer" }}
                  >
                    {saving ? "সংরক্ষণ হচ্ছে..." : "ওয়েবসাইটে পাবলিশ করুন 🚀"}
                  </button>
                </form>
              </div>

              {/* Right Column: Published Features List */}
              <div style={{ background: "rgba(15, 23, 42, 0.6)", border: "1px solid rgba(148, 163, 184, 0.1)", borderRadius: 16, padding: 24 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
                  <h2 style={{ fontSize: 18, fontWeight: 700, margin: 0, color: "#f8fafc" }}>বর্তমানে সক্রিয় ফিচারসমূহ ({features.length})</h2>
                  <span style={{ fontSize: 12, color: "#94a3b8" }}>রিয়েল-টাইম সিঙ্ক সক্রিয়</span>
                </div>

                <div style={{ display: "flex", flexDirection: "column", gap: 14, maxHeight: 600, overflowY: "auto" }}>
                  {features.map((item) => (
                    <div
                      key={item.id}
                      style={{
                        padding: 16,
                        background: "rgba(2, 6, 23, 0.7)",
                        borderLeft: `4px solid ${item.accent || "#06b6d4"}`,
                        border: "1px solid rgba(148, 163, 184, 0.1)",
                        borderRadius: 10,
                        position: "relative",
                      }}
                    >
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                        <div>
                          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                            <span style={{ fontSize: 10, fontWeight: 800, padding: "2px 8px", borderRadius: 4, background: item.accent || "#06b6d4", color: "black" }}>{item.badge}</span>
                            <span style={{ fontSize: 16, fontWeight: 700, color: "#f1f5f9" }}>{item.title}</span>
                          </div>
                          {item.subtitle && <p style={{ fontSize: 13, color: "#38bdf8", margin: "0 0 6px" }}>{item.subtitle}</p>}
                          {item.body && <p style={{ fontSize: 13, color: "#94a3b8", margin: 0 }}>{item.body}</p>}
                        </div>

                        {/* Action buttons */}
                        <div style={{ display: "flex", gap: 8 }}>
                          <button
                            onClick={() => handleToggle(item.id)}
                            style={{
                              padding: "4px 8px",
                              fontSize: 11,
                              borderRadius: 6,
                              border: "none",
                              background: item.published ? "rgba(34, 197, 94, 0.2)" : "rgba(148, 163, 184, 0.2)",
                              color: item.published ? "#4ade80" : "#94a3b8",
                              cursor: "pointer",
                            }}
                          >
                            {item.published ? "Live" : "Draft"}
                          </button>
                          <button
                            onClick={() => handleDelete(item.id)}
                            style={{ padding: "4px 8px", fontSize: 11, borderRadius: 6, border: "none", background: "rgba(239, 68, 68, 0.2)", color: "#f87171", cursor: "pointer" }}
                          >
                            ✕
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ================================================================== */}
        {/* TAB 2: GITHUB AUTOMATIC DOCS BROWSER                               */}
        {/* ================================================================== */}
        {tab === "docs" && (
          <div style={{ display: "grid", gridTemplateColumns: "280px 1fr", gap: 24, height: "calc(100vh - 160px)" }}>
            {/* Docs File Tree */}
            <div style={{ background: "rgba(15, 23, 42, 0.6)", border: "1px solid rgba(148, 163, 184, 0.1)", borderRadius: 14, padding: 16, overflowY: "auto" }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: "#38bdf8", marginBottom: 12 }}>📁 {GITHUB_REPO}</div>
              <input
                type="text"
                placeholder="Search documents..."
                value={docSearch}
                onChange={(e) => setDocSearch(e.target.value)}
                style={{ width: "100%", padding: "8px 12px", background: "#090d1a", border: "1px solid rgba(148, 163, 184, 0.2)", borderRadius: 6, color: "white", fontSize: 12, marginBottom: 14, boxSizing: "border-box" }}
              />
              <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                {docsList
                  .filter((d) => d.name.toLowerCase().includes(docSearch.toLowerCase()))
                  .map((doc) => (
                    <button
                      key={doc.path}
                      onClick={() => loadDocFile(doc.path)}
                      style={{
                        textAlign: "left",
                        padding: "8px 12px",
                        borderRadius: 6,
                        border: "none",
                        background: selectedDoc === doc.path ? "rgba(6, 182, 212, 0.2)" : "transparent",
                        color: selectedDoc === doc.path ? "#38bdf8" : "#94a3b8",
                        fontSize: 13,
                        cursor: "pointer",
                      }}
                    >
                      📄 {doc.name}
                    </button>
                  ))}
              </div>
            </div>

            {/* Markdown Doc Viewer */}
            <div style={{ background: "rgba(15, 23, 42, 0.6)", border: "1px solid rgba(148, 163, 184, 0.1)", borderRadius: 14, padding: 24, overflowY: "auto" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid rgba(148, 163, 184, 0.1)", paddingBottom: 14, marginBottom: 18 }}>
                <span style={{ fontSize: 16, fontWeight: 700, color: "#f8fafc" }}>Viewing: {selectedDoc}</span>
                <a
                  href={`https://github.com/${GITHUB_REPO}/blob/main/${selectedDoc}`}
                  target="_blank"
                  style={{ fontSize: 12, color: "#38bdf8", textDecoration: "none" }}
                >
                  Edit on GitHub ↗
                </a>
              </div>
              {loadingDoc ? (
                <div style={{ color: "#94a3b8", fontSize: 14 }}>GitHub থেকে ডকুমেন্ট লোড হচ্ছে...</div>
              ) : (
                <pre style={{ whiteSpace: "pre-wrap", wordBreak: "break-word", fontFamily: "monospace", fontSize: 13, color: "#cbd5e1", lineHeight: 1.6 }}>
                  {docContent || "কোনো কনটেন্ট পাওয়া যায়নি।"}
                </pre>
              )}
            </div>
          </div>
        )}

        {/* ================================================================== */}
        {/* TAB 3: RELEASES CENTER                                             */}
        {/* ================================================================== */}
        {tab === "releases" && (
          <div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
              <h2 style={{ fontSize: 18, fontWeight: 700, margin: 0 }}>GitHub Releases ও বাইনারি রুট</h2>
              <a href={`https://github.com/${GITHUB_REPO}/releases/new`} target="_blank" style={{ padding: "8px 16px", background: "#06b6d4", color: "black", borderRadius: 8, fontWeight: 700, fontSize: 13, textDecoration: "none" }}>+ নতুন রিলিজ তৈরি করুন</a>
            </div>

            {loadingReleases ? (
              <div style={{ color: "#94a3b8" }}>রিলিজ তথ্য ফেচ করা হচ্ছে...</div>
            ) : releases.length === 0 ? (
              <div style={{ padding: 32, background: "rgba(15, 23, 42, 0.6)", borderRadius: 12, textAlign: "center", color: "#94a3b8" }}>
                কোনো পাবলিক রিলিজ পাওয়া যায়নি। সরাসরি GitHub Releases ট্যাবে গিয়ে v19.0.1 রিলিজ পাবলিশ করুন।
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                {releases.map((rel) => (
                  <div key={rel.id} style={{ background: "rgba(15, 23, 42, 0.6)", border: "1px solid rgba(148, 163, 184, 0.1)", borderRadius: 14, padding: 20 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                      <div>
                        <span style={{ fontSize: 18, fontWeight: 800, color: "#38bdf8" }}>{rel.name || rel.tag_name}</span>
                        <span style={{ fontSize: 12, color: "#94a3b8", marginLeft: 12 }}>{new Date(rel.published_at).toLocaleDateString()}</span>
                      </div>
                      <a href={rel.html_url} target="_blank" style={{ fontSize: 12, color: "#a855f7" }}>GitHub এ দেখুন ↗</a>
                    </div>
                    {/* Release Assets */}
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
                      {rel.assets?.map((asset: any) => (
                        <a
                          key={asset.id}
                          href={asset.browser_download_url}
                          style={{
                            padding: "8px 14px",
                            background: "rgba(2, 6, 23, 0.8)",
                            border: "1px solid rgba(6, 182, 212, 0.3)",
                            borderRadius: 8,
                            color: "#38bdf8",
                            fontSize: 12,
                            textDecoration: "none",
                            display: "flex",
                            alignItems: "center",
                            gap: 6,
                          }}
                        >
                          ⬇ {asset.name} ({(asset.size / (1024 * 1024)).toFixed(1)} MB)
                        </a>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ================================================================== */}
        {/* TAB 4: TELEMETRY & HEALTH                                          */}
        {/* ================================================================== */}
        {tab === "telemetry" && (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 20 }}>
            <div style={{ padding: 24, background: "rgba(15, 23, 42, 0.6)", borderRadius: 14, border: "1px solid rgba(148, 163, 184, 0.1)" }}>
              <div style={{ color: "#94a3b8", fontSize: 13, marginBottom: 8 }}>Edge Server Latency</div>
              <div style={{ fontSize: 32, fontWeight: 800, color: "#4ade80" }}>24 ms</div>
              <div style={{ fontSize: 12, color: "#64748b", marginTop: 6 }}>Cloudflare Global Edge Route</div>
            </div>
            <div style={{ padding: 24, background: "rgba(15, 23, 42, 0.6)", borderRadius: 14, border: "1px solid rgba(148, 163, 184, 0.1)" }}>
              <div style={{ color: "#94a3b8", fontSize: 13, marginBottom: 8 }}>Target GitHub Repo</div>
              <div style={{ fontSize: 18, fontWeight: 700, color: "#38bdf8" }}>{GITHUB_REPO}</div>
              <div style={{ fontSize: 12, color: "#64748b", marginTop: 6 }}>Direct API Synchronized</div>
            </div>
            <div style={{ padding: 24, background: "rgba(15, 23, 42, 0.6)", borderRadius: 14, border: "1px solid rgba(148, 163, 184, 0.1)" }}>
              <div style={{ color: "#94a3b8", fontSize: 13, marginBottom: 8 }}>Security Mode</div>
              <div style={{ fontSize: 24, fontWeight: 700, color: "#a855f7" }}>AUTHENTICATED</div>
              <div style={{ fontSize: 12, color: "#64748b", marginTop: 6 }}>Session Active</div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
