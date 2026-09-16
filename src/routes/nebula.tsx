import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/nebula")({
  head: () => ({ meta: [{ title: "ZYRAXON Nebula — AI Model Hub" }] }),
  component: NebulaPage,
});

function NebulaPage() {
  return (
    <div style={{ minHeight: "100vh", background: "#f9fafb", fontFamily: "Inter, sans-serif" }}>
      <div style={{ padding: "40px 20px", maxWidth: 600, margin: "0 auto", textAlign: "center" }}>
        <div style={{ width: 64, height: 64, borderRadius: 16, background: "linear-gradient(135deg, #a855f7, #06b6d4)", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 16px" }}>
          <svg style={{ width: 32, height: 32, color: "white" }} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
        </div>
        <h1 style={{ fontSize: 28, fontWeight: 800, background: "linear-gradient(90deg, #9333ea, #0891b2)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", marginBottom: 8 }}>ZYRAXON Nebula</h1>
        <p style={{ fontSize: 14, color: "#6b7280", marginBottom: 24 }}>AI Model Hub — Coming Soon</p>
        <div style={{ background: "white", border: "1px solid #e5e7eb", borderRadius: 12, padding: 24 }}>
          <p style={{ fontSize: 14, color: "#374151" }}>Nebula is currently being rebuilt. Check back soon!</p>
          <a href="/" style={{ display: "inline-block", marginTop: 16, padding: "8px 16px", background: "#2563eb", color: "white", borderRadius: 8, fontSize: 13, fontWeight: 600, textDecoration: "none" }}>Back to Home</a>
        </div>
      </div>
    </div>
  );
}
