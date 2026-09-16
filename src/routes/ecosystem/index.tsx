import { createFileRoute } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { Sidebar } from "../../components/ecosystem/Sidebar";
import { PublishedApps } from "../../components/ecosystem/PublishedApps";
import { ZyraxonMarketplace } from "../../components/ecosystem/ZyraxonMarketplace";
import GitHubReleases from "../../components/ecosystem/GitHubReleases";
import { PublishModal } from "../../components/ecosystem/PublishModal";

export const Route = createFileRoute("/ecosystem/")({
  head: () => ({
    meta: [
      { title: "ZYRAXON Ecosystem — AI Marketplace" },
      { name: "description", content: "Explore plugins, AI bots, templates, and tools for the ZYRAXON ecosystem." },
    ],
  }),
  component: EcosystemPage,
});

const ENDPOINT = "https://agent-ecosystem-hub.lovable.app/api/public/v1";

type Tab = "home" | "published" | "extensions" | "releases" | "publish";

export default function EcosystemPage() {
  const [tab, setTab] = useState<Tab>("home");
  const [showPublish, setShowPublish] = useState(false);
  const [appCount, setAppCount] = useState(0);

  useEffect(() => {
    fetch(`${ENDPOINT}/apps`)
      .then((r) => r.json())
      .then((d) => { if (Array.isArray(d)) setAppCount(d.length); else if (d?.apps) setAppCount(d.apps.length); })
      .catch(() => {});
  }, []);

  return (
    <div style={{ display: "flex", minHeight: "100vh", background: "#f9fafb", fontFamily: "Inter, -apple-system, BlinkMacSystemFont, sans-serif", color: "#1f2937" }}>
      <Sidebar currentView={tab} onViewChange={(v) => {
        if (v === "publish") { setShowPublish(true); return; }
        setTab(v as Tab);
      }} />

      <main style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0 }}>
        {/* Header */}
        <header style={{ position: "sticky", top: 0, zIndex: 50, display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 24px", background: "rgba(255,255,255,0.85)", backdropFilter: "blur(20px)", borderBottom: "1px solid #e5e7eb" }}>
          <div>
            <h1 style={{ fontSize: 18, fontWeight: 700, color: "#111827", margin: 0 }}>
              {tab === "home" && "Ecosystem"}
              {tab === "published" && "Published Apps"}
              {tab === "extensions" && "Extensions"}
              {tab === "releases" && "GitHub Releases"}
            </h1>
            <p style={{ fontSize: 12, color: "#6b7280", margin: 0 }}>
              {tab === "home" && `${appCount} apps published via ZYRAXON Hub`}
              {tab === "published" && "Projects published to the marketplace"}
              {tab === "extensions" && "ZYRAXON AI extension marketplace"}
              {tab === "releases" && "All GitHub releases across repos"}
            </p>
          </div>
          <button onClick={() => setShowPublish(true)}
            style={{ padding: "8px 18px", borderRadius: 8, background: "linear-gradient(135deg, #059669, #10b981)", border: "none", color: "white", fontSize: 13, fontWeight: 600, cursor: "pointer", display: "flex", alignItems: "center", gap: 6, boxShadow: "0 2px 8px rgba(16,185,129,0.3)" }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M12 5v14M5 12h14" /></svg>
            Publish
          </button>
        </header>

        {/* Content */}
        <div style={{ flex: 1, padding: 24, overflowY: "auto" }}>
          {tab === "home" && <HomeView onNavigate={setTab} onPublish={() => setShowPublish(true)} appCount={appCount} />}
          {tab === "published" && <div><PublishedApps /></div>}
          {tab === "extensions" && <div><ZyraxonMarketplace /></div>}
          {tab === "releases" && <div><GitHubReleases /></div>}
        </div>
      </main>

      <PublishModal isOpen={showPublish} onClose={() => setShowPublish(false)} onPublished={() => { setAppCount((c) => c + 1); }} />
    </div>
  );
}

function HomeView({ onNavigate, onPublish, appCount }: { onNavigate: (t: Tab) => void; onPublish: () => void; appCount: number }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 32 }}>
      {/* Hero */}
      <div style={{ background: "linear-gradient(135deg, #059669, #10b981)", borderRadius: 16, padding: 40, color: "white", position: "relative", overflow: "hidden" }}>
        <div style={{ position: "absolute", top: -40, right: -40, width: 200, height: 200, background: "rgba(255,255,255,0.1)", borderRadius: "50%" }} />
        <div style={{ position: "absolute", bottom: -60, left: "40%", width: 160, height: 160, background: "rgba(255,255,255,0.08)", borderRadius: "50%" }} />
        <div style={{ position: "relative", zIndex: 1 }}>
          <h2 style={{ fontSize: 28, fontWeight: 800, margin: "0 0 8px" }}>ZYRAXON Ecosystem</h2>
          <p style={{ fontSize: 15, opacity: 0.9, margin: "0 0 20px", maxWidth: 500 }}>
            Publish your projects, discover extensions, and explore everything built by the community.
          </p>
          <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
            <button onClick={onPublish} style={{ padding: "10px 20px", borderRadius: 8, background: "white", color: "#059669", border: "none", fontSize: 14, fontWeight: 600, cursor: "pointer" }}>
              Publish Your Project
            </button>
            <button onClick={() => onNavigate("extensions")} style={{ padding: "10px 20px", borderRadius: 8, background: "rgba(255,255,255,0.15)", color: "white", border: "1px solid rgba(255,255,255,0.3)", fontSize: 14, fontWeight: 600, cursor: "pointer" }}>
              Browse Extensions
            </button>
          </div>
        </div>
      </div>

      {/* Stats */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 16 }}>
        {[
          { label: "Published Apps", value: appCount, color: "#059669", icon: "M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" },
          { label: "Extensions", value: "100+", color: "#7c3aed", icon: "M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" },
          { label: "GitHub Releases", value: "3 repos", color: "#f59e0b", icon: "M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z" },
          { label: "Source Agent", value: "4 types", color: "#2563eb", icon: "M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" },
        ].map((s) => (
          <div key={s.label} style={{ background: "white", border: "1px solid #e5e7eb", borderRadius: 12, padding: 20, display: "flex", alignItems: "center", gap: 16 }}>
            <div style={{ width: 44, height: 44, borderRadius: 10, background: `${s.color}12`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={s.color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d={s.icon} /></svg>
            </div>
            <div>
              <p style={{ fontSize: 22, fontWeight: 700, color: "#111827", margin: 0 }}>{s.value}</p>
              <p style={{ fontSize: 12, color: "#6b7280", margin: 0 }}>{s.label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Published Apps */}
      <section>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
          <h2 style={{ fontSize: 18, fontWeight: 700, color: "#111827", margin: 0, display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ width: 8, height: 8, borderRadius: 3, background: "#059669", display: "inline-block" }} />
            Published Apps
          </h2>
          {appCount > 6 && (
            <button onClick={() => onNavigate("published")} style={{ padding: "6px 14px", borderRadius: 8, border: "1px solid #e5e7eb", background: "white", color: "#059669", cursor: "pointer", fontSize: 13 }}>
              View all
            </button>
          )}
        </div>
        <PublishedApps compact />
      </section>

      {/* Extensions */}
      <section>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
          <h2 style={{ fontSize: 18, fontWeight: 700, color: "#111827", margin: 0, display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ width: 8, height: 8, borderRadius: 3, background: "#7c3aed", display: "inline-block" }} />
            ZYRAXON Extensions
          </h2>
          <button onClick={() => onNavigate("extensions")} style={{ padding: "6px 14px", borderRadius: 8, border: "1px solid #e5e7eb", background: "white", color: "#7c3aed", cursor: "pointer", fontSize: 13 }}>
            Browse all
          </button>
        </div>
        <ZyraxonMarketplace />
      </section>

      {/* GitHub Releases */}
      <section>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
          <h2 style={{ fontSize: 18, fontWeight: 700, color: "#111827", margin: 0, display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ width: 8, height: 8, borderRadius: 3, background: "#f59e0b", display: "inline-block" }} />
            GitHub Releases
          </h2>
          <button onClick={() => onNavigate("releases")} style={{ padding: "6px 14px", borderRadius: 8, border: "1px solid #e5e7eb", background: "white", color: "#f59e0b", cursor: "pointer", fontSize: 13 }}>
            Browse all
          </button>
        </div>
        <GitHubReleases compact />
      </section>
    </div>
  );
}
