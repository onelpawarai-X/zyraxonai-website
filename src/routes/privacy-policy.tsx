import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";

export const Route = createFileRoute("/privacy-policy")({
  head: () => ({
    meta: [
      { title: "Privacy Policy — ZYRAXON AI" },
      { name: "description", content: "How ZYRAXON AI handles your data. Local-first, transparent, zero hidden tracking." },
      { property: "og:title", content: "Privacy Policy — ZYRAXON AI" },
      { property: "og:description", content: "How ZYRAXON AI handles your data. Local-first, transparent, zero hidden tracking." },
      { property: "og:type", content: "website" },
      { property: "og:url", content: "https://zyraxonai.lovable.app/privacy-policy" },
      { name: "twitter:card", content: "summary" },
      { name: "twitter:title", content: "Privacy Policy — ZYRAXON AI" },
      { name: "twitter:description", content: "How ZYRAXON AI handles your data. Local-first, transparent, zero hidden tracking." },
    ],
  }),
  component: PrivacyPolicyPage,
});

const SECTIONS = [
  {
    id: "introduction",
    num: "01",
    title: "Introduction",
    body: "ZYRAXON AI ('we', 'our', 'us') builds a desktop AI agent that runs locally on your machine. This Privacy Policy explains what information is collected, what is processed on your device, and how your privacy is protected when you use the ZYRAXON Agent, this website, and related services. By using ZYRAXON AI you agree to the practices described here.",
  },
  {
    id: "local-first",
    num: "02",
    title: "Local-First by Design",
    body: "The ZYRAXON Agent is built to be local-first. Files, code, terminal activity, screen vision frames, voice input, and conversation history are processed on your own machine by default. No cloud account is required, and no data is uploaded to us simply by running the agent. If you choose to connect an external LLM provider, you bring your own API keys and control exactly what is sent to that provider.",
  },
  {
    id: "data-collected",
    num: "03",
    title: "Information We Collect",
    body: "This website may collect basic, non-identifying analytics such as page views, device type, browser, and referring pages to understand how visitors use the site. When you download the agent, we may record which platform (Windows or Linux) and version you downloaded. If you contact us, we keep the details you share so we can respond. We do not sell personal information, and we do not sell any data that the agent processes on your machine.",
  },
  {
    id: "agent-storage",
    num: "04",
    title: "How the Agent Stores Data",
    body: "The desktop agent stores its session data, memories, and settings locally on your computer in a SQLite database and related local files. Your conversation history, tool usage, and memory entries stay on your device. You can clear or delete this local data at any time by removing the agent's data directory from your machine.",
  },
  {
    id: "api-providers",
    num: "05",
    title: "External API Providers",
    body: "The agent can route requests to LLM providers you configure (such as OpenAI, Anthropic, Google, or others). When you use such a provider, the text you send is processed by that provider under its own terms and privacy policy. We recommend reviewing each provider's privacy policy before connecting it. We cannot see or control data that is sent directly from your machine to a third-party provider.",
  },
  {
    id: "links-and-telemetry",
    num: "06",
    title: "Links, Analytics & Telemetry",
    body: "Our website and marketplaces may include links to third-party sites which have their own privacy policies. Anonymous product-usage statistics, if any, are aggregated and cannot identify you personally. You are never required to enable telemetry to use the core agent, and most functionality works entirely offline.",
  },
  {
    id: "security",
    num: "07",
    title: "Security",
    body: "We apply reasonable technical safeguards to protect this website and the agent distribution. Since the agent is local-first, the security of data stored on your device depends on the security of your own computer. If you discover a security vulnerability, please report it privately before public disclosure.",
  },
  {
    id: "children",
    num: "08",
    title: "Children's Privacy",
    body: "ZYRAXON AI is a developer tool and is not directed at children under 13. We do not knowingly collect personal information from children. If you believe a child has provided us personal information, contact us and we will delete it.",
  },
  {
    id: "your-rights",
    num: "09",
    title: "Your Rights",
    body: "Depending on your jurisdiction, you may have the right to access, correct, export, or delete personal information relating to you. Because our agent stores its data locally on your machine, you already have direct access to everything it knows about you. For website-related data, contact us and we will help you exercise your rights within a reasonable time.",
  },
  {
    id: "changes",
    num: "10",
    title: "Changes to This Policy",
    body: "We may update this Privacy Policy from time to time. The latest version will always be published on this page with an updated effective date. Significant changes will be highlighted on this page and, where appropriate, in release notes.",
  },
  {
    id: "contact",
    num: "11",
    title: "Contact",
    body: "If you have questions about this Privacy Policy or about how your data is handled, you can reach us through the ZYRAXON AI GitHub repository (github.com/onelpawarai-X/ZYRAXON-AI) or the community channels listed on this website.",
  },
];

const DOWNLOAD_TABLE = [
  {
    row: "Website analytics",
    description:
      "Anonymous page views, device type, browser. Used only to understand site usage and improve the site.",
    stored: "On our hosting (aggregated, non-identifying)",
  },
  {
    row: "Download events",
    description:
      "Platform and version you download. Used to keep release pages accurate.",
    stored: "On our hosting (aggregated)",
  },
  {
    row: "Messages to us",
    description:
      "Anything you share when contacting support or reporting bugs.",
    stored: "Kept only as long as needed to resolve your issue",
  },
];

function PrivacyPolicyPage() {
  const [activeId, setActiveId] = useState<string | null>(null);

  return (
    <div style={{ minHeight: "100vh", background: "#f9fafb", fontFamily: "Inter, -apple-system, BlinkMacSystemFont, sans-serif", color: "#1f2937" }}>
      {/* Nav */}
      <nav style={{ position: "sticky", top: 0, zIndex: 50, display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 32px", background: "rgba(255,255,255,0.9)", backdropFilter: "blur(20px)", borderBottom: "1px solid #e5e7eb" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <a href="/" style={{ fontSize: 18, fontWeight: 800, color: "#111827", textDecoration: "none", letterSpacing: "-0.5px" }}>ZYRAXON</a>
          <span style={{ fontSize: 11, fontWeight: 600, color: "#7c3aed", background: "#f3f0ff", padding: "2px 8px", borderRadius: 4, letterSpacing: "0.5px" }}>PRIVACY</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 24, fontSize: 13 }}>
          <a href="#overview" style={{ color: "#6b7280", textDecoration: "none" }}>Overview</a>
          <a href="#details" style={{ color: "#6b7280", textDecoration: "none" }}>Policy</a>
          <a href="/zsl" style={{ color: "#6b7280", textDecoration: "none" }}>License</a>
          <a href="/" style={{ padding: "6px 14px", borderRadius: 8, background: "#7c3aed", color: "white", fontSize: 13, fontWeight: 600, textDecoration: "none" }}>
            Home
          </a>
        </div>
      </nav>

      {/* Hero */}
      <section style={{ padding: "80px 32px 56px", textAlign: "center", position: "relative", overflow: "hidden" }}>
        <div style={{ position: "absolute", top: -100, left: "50%", transform: "translateX(-50%)", width: 600, height: 600, background: "radial-gradient(circle, rgba(124,58,237,0.08) 0%, transparent 70%)", pointerEvents: "none" }} />
        <div style={{ position: "relative", zIndex: 1, maxWidth: 720, margin: "0 auto" }}>
          <div style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "6px 16px", borderRadius: 20, background: "#f3f0ff", border: "1px solid #e9e5ff", marginBottom: 24 }}>
            <span style={{ width: 8, height: 8, borderRadius: "50%", background: "#059669", display: "inline-block" }} />
            <span style={{ fontSize: 12, fontWeight: 600, color: "#059669" }}>Effective: September 29, 2026</span>
          </div>
          <h1 style={{ fontSize: 44, fontWeight: 800, color: "#111827", margin: "0 0 16px", letterSpacing: "-1.5px", lineHeight: 1.1 }}>
            Privacy Policy
          </h1>
          <p style={{ fontSize: 17, color: "#6b7280", margin: "0 0 8px", lineHeight: 1.6 }}>
            Your data stays on your machine. Our agent is local-first — what you do with ZYRAXON is yours.
          </p>
        </div>
      </section>

      {/* Overview */}
      <section id="overview" style={{ padding: "0 32px 56px", maxWidth: 900, margin: "0 auto" }}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 16 }}>
          {[
            { value: "Local", label: "Processing by default — no cloud account required", color: "#059669" },
            { value: "No Selling", label: "We never sell personal information or agent data", color: "#2563eb" },
            { value: "Your Keys", label: "External providers only when you connect them", color: "#7c3aed" },
          ].map((s) => (
            <div key={s.label} style={{ background: "white", border: "1px solid #e5e7eb", borderRadius: 12, padding: 20, textAlign: "center" }}>
              <p style={{ fontSize: 18, fontWeight: 800, color: s.color, margin: "0 0 6px" }}>{s.value}</p>
              <p style={{ fontSize: 12, color: "#6b7280", margin: 0, lineHeight: 1.5 }}>{s.label}</p>
            </div>
          ))}
        </div>
        <div style={{ marginTop: 32, background: "white", border: "1px solid #e5e7eb", borderRadius: 14, padding: 28 }}>
          <h3 style={{ fontSize: 16, fontWeight: 700, color: "#111827", margin: "0 0 12px" }}>What this policy covers</h3>
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
              <thead>
                <tr style={{ borderBottom: "2px solid #e5e7eb" }}>
                  <th style={{ textAlign: "left", padding: "10px 12px", fontWeight: 700, color: "#111827" }}>Information</th>
                  <th style={{ textAlign: "left", padding: "10px 12px", fontWeight: 700, color: "#111827" }}>How it's used</th>
                  <th style={{ textAlign: "left", padding: "10px 12px", fontWeight: 700, color: "#111827" }}>Where it's stored</th>
                </tr>
              </thead>
              <tbody>
                {DOWNLOAD_TABLE.map((r) => (
                  <tr key={r.row} style={{ borderBottom: "1px solid #f3f4f6", verticalAlign: "top" }}>
                    <td style={{ padding: "10px 12px", fontWeight: 600, color: "#374151" }}>{r.row}</td>
                    <td style={{ padding: "10px 12px", color: "#6b7280", lineHeight: 1.5 }}>{r.description}</td>
                    <td style={{ padding: "10px 12px", color: "#6b7280", lineHeight: 1.5 }}>{r.stored}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* Policy details */}
      <section id="details" style={{ padding: "56px 32px", background: "white", borderTop: "1px solid #e5e7eb", borderBottom: "1px solid #e5e7eb" }}>
        <div style={{ maxWidth: 720, margin: "0 auto" }}>
          <h2 style={{ fontSize: 28, fontWeight: 800, color: "#111827", margin: "0 0 8px", textAlign: "center" }}>The Full Policy</h2>
          <p style={{ fontSize: 15, color: "#6b7280", margin: "0 0 32px", textAlign: "center" }}>
            Read each section, or tap a heading to expand it.
          </p>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {SECTIONS.map((s) => (
              <div key={s.id} style={{ background: "#f9fafb", border: "1px solid #e5e7eb", borderRadius: 12, overflow: "hidden" }}>
                <button
                  onClick={() => setActiveId(activeId === s.id ? null : s.id)}
                  style={{ width: "100%", display: "flex", alignItems: "center", gap: 16, padding: "16px 20px", background: "none", border: "none", cursor: "pointer", textAlign: "left" }}
                >
                  <span style={{ fontSize: 12, fontWeight: 700, color: "#7c3aed", flexShrink: 0 }}>{s.num}</span>
                  <span style={{ flex: 1, fontSize: 14, fontWeight: 700, color: "#111827" }}>{s.title}</span>
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" style={{ transform: activeId === s.id ? "rotate(180deg)" : "rotate(0deg)", transition: "transform 0.2s", flexShrink: 0 }}>
                    <path d="M4 6l4 4 4-4" stroke="#6b7280" strokeWidth="1.5" strokeLinecap="round" />
                  </svg>
                </button>
                {activeId === s.id && (
                  <div style={{ padding: "0 20px 16px", fontSize: 13, color: "#6b7280", lineHeight: 1.7 }}>
                    {s.body}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Disclaimer */}
      <section style={{ padding: "40px 32px", maxWidth: 720, margin: "0 auto" }}>
        <p style={{ fontSize: 12, color: "#9ca3af", lineHeight: 1.7, margin: 0 }}>
          This Privacy Policy applies to the ZYRAXON AI website and the ZYRAXON desktop agent. Third-party services or AI providers you connect are governed by their own policies and are outside our control. This document is provided for transparency and does not create contractual obligations beyond what is stated in the Zyraxon Sovereign License (ZSL-X).
        </p>
      </section>

      {/* Footer */}
      <footer style={{ padding: "40px 32px", borderTop: "1px solid #e5e7eb" }}>
        <div style={{ maxWidth: 900, margin: "0 auto", display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 16 }}>
          <div>
            <p style={{ fontSize: 14, fontWeight: 700, color: "#111827", margin: "0 0 4px" }}>ZYRAXON AI</p>
            <p style={{ fontSize: 12, color: "#9ca3af", margin: 0 }}>Local-first. Transparent. Yours.</p>
          </div>
          <div style={{ display: "flex", gap: 20, fontSize: 13 }}>
            <a href="/" style={{ color: "#6b7280", textDecoration: "none" }}>Home</a>
            <a href="/faq" style={{ color: "#6b7280", textDecoration: "none" }}>FAQ</a>
            <a href="/zsl" style={{ color: "#6b7280", textDecoration: "none" }}>ZSL License</a>
            <a href="/privacy-policy" style={{ color: "#6b7280", textDecoration: "none" }}>Privacy Policy</a>
          </div>
        </div>
        <div style={{ maxWidth: 900, margin: "24px auto 0", paddingTop: 20, borderTop: "1px solid #f3f4f6", textAlign: "center" }}>
          <p style={{ fontSize: 12, color: "#9ca3af", margin: 0 }}>2026 onelpawarai — ZYRAXON AI</p>
        </div>
      </footer>
    </div>
  );
}