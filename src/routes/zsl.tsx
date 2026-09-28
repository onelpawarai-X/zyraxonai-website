import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";

export const Route = createFileRoute("/zsl")({
  head: () => ({
    meta: [
      { title: "ZSL — Zyraxon Sovereign License" },
      { name: "description", content: "The Zyraxon Sovereign License — an enterprise-grade open license for the AI era. Commercial freedom, patent protection, identity safety." },
      { property: "og:title", content: "ZSL — Zyraxon Sovereign License" },
      { property: "og:description", content: "The Zyraxon Sovereign License — an enterprise-grade open license for the AI era. Commercial freedom, patent protection, identity safety." },
      { property: "og:type", content: "website" },
      { property: "og:url", content: "https://zyraxonai.lovable.app/zsl" },
      { name: "twitter:card", content: "summary" },
      { name: "twitter:title", content: "ZSL — Zyraxon Sovereign License" },
      { name: "twitter:description", content: "The Zyraxon Sovereign License — an enterprise-grade open license for the AI era." },
    ],
  }),
  component: ZSLPage,
});

const COMPARISON = [
  { feature: "Commercial use", zsl: true, mit: true, apache: true, gpl: "Copyleft" },
  { feature: "Enterprise (50+ employees)", zsl: "Explicit", mit: "Implied", apache: "Implied", gpl: "Implied" },
  { feature: "Modification", zsl: true, mit: true, apache: true, gpl: true },
  { feature: "Redistribution", zsl: true, mit: true, apache: true, gpl: "Copyleft" },
  { feature: "Patent grant", zsl: true, mit: false, apache: true, gpl: true },
  { feature: "Attribution required", zsl: true, mit: true, apache: true, gpl: true },
  { feature: "Identity protection", zsl: true, mit: false, apache: false, gpl: false },
  { feature: "Auto-transition to next-gen", zsl: true, mit: false, apache: false, gpl: false },
  { feature: "Contributor protection", zsl: true, mit: false, apache: "Basic", gpl: "Basic" },
  { feature: "Security disclosure framework", zsl: true, mit: false, apache: false, gpl: false },
  { feature: "Cure period (30 days)", zsl: "MEKRA-X", mit: false, apache: false, gpl: false },
  { feature: "Patent retaliation clause", zsl: true, mit: false, apache: true, gpl: true },
];

const FAQ = [
  {
    q: "Can I use ZSL for my commercial product?",
    a: "Yes. ZSL-X grants full commercial rights. No royalties, no fees, no permission needed. Enterprise use is explicitly covered.",
  },
  {
    q: "Do I need to open-source my derivative?",
    a: "No. ZSL is not copyleft. You can keep your modifications private and proprietary.",
  },
  {
    q: "Can I use 'ZYRAXON' in my product name?",
    a: "You can use descriptive references like 'Based on ZYRAXON AI' but cannot use 'ZYRAXON' branding in a way that implies your product is the official release.",
  },
  {
    q: "What happens on January 1, 2028?",
    a: "All software under ZSL-X automatically transitions to MEKRA-X v1.0.0. No action needed. Software obtained before 2028 can stay under ZSL-X if you prefer.",
  },
  {
    q: "What if I breach the license?",
    a: "Under MEKRA-X, you get a 30-day cure period to fix the breach. Under ZSL-X, termination is automatic.",
  },
  {
    q: "Is there a patent risk?",
    a: "ZSL includes a patent grant from contributors. If you sue for patent infringement, your license terminates (patent retaliation clause).",
  },
  {
    q: "Can I contribute code?",
    a: "Yes. Contributors retain ownership but grant a royalty-free license for their submissions.",
  },
  {
    q: "How do I report a security vulnerability?",
    a: "Report privately. You'll get a 72-hour acknowledgment and 14-day remediation timeline. You can disclose publicly after 90 days or after a fix.",
  },
];

const PROJECTS_USING_ZSL = [
  { name: "ZYRAXON-AI", desc: "Main AI platform with 805 tools across 63 categories", repo: "onelpawarai-X/ZYRAXON-AI", color: "#2563eb" },
];

const TIMELINE = [
  { year: "2026", event: "ZSL-X v1.0.0 released", desc: "Active license for all ZYRAXON projects", active: true },
  { year: "2028", event: "MEKRA-X v1.0.0 auto-activates", desc: "Enhanced enterprise rights, 30-day cure period, security framework", active: false },
  { year: "2030+", event: "NEXUS-X transition available", desc: "Future-proof path with 180-day notice period", active: false },
];

function CheckIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" style={{ flexShrink: 0 }}>
      <rect width="16" height="16" rx="4" fill="#059669" />
      <path d="M5 8l2 2 4-4" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function XIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" style={{ flexShrink: 0 }}>
      <rect width="16" height="16" rx="4" fill="#e5e7eb" />
      <path d="M6 6l4 4M10 6l-4 4" stroke="#9ca3af" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

function PartialIcon({ label }: { label: string }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none" style={{ flexShrink: 0 }}>
        <rect width="16" height="16" rx="4" fill="#fef3c7" />
        <path d="M5 8h6" stroke="#b45309" strokeWidth="1.5" strokeLinecap="round" />
      </svg>
      <span style={{ fontSize: 11, color: "#b45309", fontWeight: 500 }}>{label}</span>
    </div>
  );
}

function ZSLPage() {
  const [openFaq, setOpenFaq] = useState<number | null>(null);
  const [activeTab, setActiveTab] = useState<"zsl-x" | "mekra-x">("zsl-x");

  return (
    <div style={{ minHeight: "100vh", background: "#f9fafb", fontFamily: "Inter, -apple-system, BlinkMacSystemFont, sans-serif", color: "#1f2937" }}>
      {/* Nav */}
      <nav style={{ position: "sticky", top: 0, zIndex: 50, display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 32px", background: "rgba(255,255,255,0.9)", backdropFilter: "blur(20px)", borderBottom: "1px solid #e5e7eb" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <a href="/" style={{ fontSize: 18, fontWeight: 800, color: "#111827", textDecoration: "none", letterSpacing: "-0.5px" }}>ZYRAXON</a>
          <span style={{ fontSize: 11, fontWeight: 600, color: "#7c3aed", background: "#f3f0ff", padding: "2px 8px", borderRadius: 4, letterSpacing: "0.5px" }}>ZSL</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 24, fontSize: 13 }}>
          <a href="#comparison" style={{ color: "#6b7280", textDecoration: "none" }}>Compare</a>
          <a href="#licenses" style={{ color: "#6b7280", textDecoration: "none" }}>Licenses</a>
          <a href="#faq" style={{ color: "#6b7280", textDecoration: "none" }}>FAQ</a>
          <a href="https://github.com/onelpawarai-X/ZSL" target="_blank" rel="noopener noreferrer"
            style={{ display: "flex", alignItems: "center", gap: 6, padding: "6px 14px", borderRadius: 8, border: "1px solid #e5e7eb", background: "white", color: "#374151", textDecoration: "none", fontWeight: 600 }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z" /></svg>
            GitHub
          </a>
        </div>
      </nav>

      {/* Hero */}
      <section style={{ padding: "80px 32px 60px", textAlign: "center", position: "relative", overflow: "hidden" }}>
        <div style={{ position: "absolute", top: -100, left: "50%", transform: "translateX(-50%)", width: 600, height: 600, background: "radial-gradient(circle, rgba(124,58,237,0.08) 0%, transparent 70%)", pointerEvents: "none" }} />
        <div style={{ position: "relative", zIndex: 1, maxWidth: 700, margin: "0 auto" }}>
          <div style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "6px 16px", borderRadius: 20, background: "#f3f0ff", border: "1px solid #e9e5ff", marginBottom: 24 }}>
            <span style={{ width: 8, height: 8, borderRadius: "50%", background: "#7c3aed", display: "inline-block", animation: "pulse 2s infinite" }} />
            <span style={{ fontSize: 12, fontWeight: 600, color: "#7c3aed" }}>ZSL-X v1.0.0 — Active 2026–2028</span>
          </div>
          <h1 style={{ fontSize: 48, fontWeight: 800, color: "#111827", margin: "0 0 16px", letterSpacing: "-1.5px", lineHeight: 1.1 }}>
            Zyraxon Sovereign<br />License
          </h1>
          <p style={{ fontSize: 18, color: "#6b7280", margin: "0 0 32px", lineHeight: 1.6, maxWidth: 520, marginLeft: "auto", marginRight: "auto" }}>
            An enterprise-grade open license for the AI era. Full commercial freedom, patent protection, identity safety, and future-proof transitions.
          </p>
          <div style={{ display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap" }}>
            <a href="#licenses" style={{ padding: "12px 28px", borderRadius: 10, background: "#7c3aed", color: "white", fontSize: 14, fontWeight: 600, textDecoration: "none", boxShadow: "0 4px 14px rgba(124,58,237,0.3)" }}>
              Read the License
            </a>
            <a href="https://github.com/onelpawarai-X/ZSL" target="_blank" rel="noopener noreferrer"
              style={{ padding: "12px 28px", borderRadius: 10, border: "1px solid #e5e7eb", background: "white", color: "#374151", fontSize: 14, fontWeight: 600, textDecoration: "none" }}>
              View on GitHub
            </a>
          </div>
        </div>
      </section>

      {/* Stats */}
      <section style={{ padding: "0 32px 60px", maxWidth: 900, margin: "0 auto" }}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 16 }}>
          {[
            { value: "100%", label: "Commercial Freedom", color: "#059669" },
            { value: "Patent", label: "Grant Included", color: "#2563eb" },
            { value: "30-Day", label: "Cure Period (MEKRA-X)", color: "#f59e0b" },
            { value: "2028", label: "Auto-Transition", color: "#7c3aed" },
          ].map((s) => (
            <div key={s.label} style={{ background: "white", border: "1px solid #e5e7eb", borderRadius: 12, padding: 20, textAlign: "center" }}>
              <p style={{ fontSize: 24, fontWeight: 800, color: s.color, margin: "0 0 4px" }}>{s.value}</p>
              <p style={{ fontSize: 12, color: "#6b7280", margin: 0 }}>{s.label}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Why ZSL */}
      <section style={{ padding: "60px 32px", maxWidth: 900, margin: "0 auto" }}>
        <h2 style={{ fontSize: 28, fontWeight: 800, color: "#111827", margin: "0 0 8px", textAlign: "center" }}>Why ZSL?</h2>
        <p style={{ fontSize: 15, color: "#6b7280", margin: "0 0 40px", textAlign: "center", maxWidth: 500, marginLeft: "auto", marginRight: "auto" }}>
          Built for the AI era. Combines the best of MIT, Apache, and GPL with protections no other license offers.
        </p>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 20 }}>
          {[
            { title: "Commercial Freedom", desc: "Use for any purpose: personal, commercial, enterprise, government, education. No royalties, no fees.", icon: "M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z", color: "#059669" },
            { title: "Patent Protection", desc: "Contributors grant patent license for their contributions. Patent retaliation clause protects everyone.", icon: "M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z", color: "#2563eb" },
            { title: "Identity Safety", desc: "Protects project identity. Others can fork and modify, but can't impersonate the official release.", icon: "M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z", color: "#7c3aed" },
          ].map((c) => (
            <div key={c.title} style={{ background: "white", border: "1px solid #e5e7eb", borderRadius: 14, padding: 28 }}>
              <div style={{ width: 44, height: 44, borderRadius: 10, background: `${c.color}12`, display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 16 }}>
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={c.color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d={c.icon} /></svg>
              </div>
              <h3 style={{ fontSize: 16, fontWeight: 700, color: "#111827", margin: "0 0 8px" }}>{c.title}</h3>
              <p style={{ fontSize: 13, color: "#6b7280", margin: 0, lineHeight: 1.6 }}>{c.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Comparison Table */}
      <section id="comparison" style={{ padding: "60px 32px", background: "white", borderTop: "1px solid #e5e7eb", borderBottom: "1px solid #e5e7eb" }}>
        <div style={{ maxWidth: 900, margin: "0 auto" }}>
          <h2 style={{ fontSize: 28, fontWeight: 800, color: "#111827", margin: "0 0 8px", textAlign: "center" }}>How ZSL Compares</h2>
          <p style={{ fontSize: 15, color: "#6b7280", margin: "0 0 32px", textAlign: "center" }}>
            ZSL = MIT Freedom + Apache Patent Protection + Identity Safety + Future-Proof Transition
          </p>
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
              <thead>
                <tr style={{ borderBottom: "2px solid #e5e7eb" }}>
                  <th style={{ textAlign: "left", padding: "12px 16px", fontWeight: 600, color: "#6b7280", fontSize: 12 }}>Feature</th>
                  <th style={{ textAlign: "center", padding: "12px 16px", fontWeight: 700, color: "#7c3aed", fontSize: 13 }}>ZSL-X</th>
                  <th style={{ textAlign: "center", padding: "12px 16px", fontWeight: 600, color: "#6b7280" }}>MIT</th>
                  <th style={{ textAlign: "center", padding: "12px 16px", fontWeight: 600, color: "#6b7280" }}>Apache 2.0</th>
                  <th style={{ textAlign: "center", padding: "12px 16px", fontWeight: 600, color: "#6b7280" }}>GPL-3.0</th>
                </tr>
              </thead>
              <tbody>
                {COMPARISON.map((row, i) => (
                  <tr key={row.feature} style={{ borderBottom: "1px solid #f3f4f6", background: i % 2 === 0 ? "#f9fafb" : "white" }}>
                    <td style={{ padding: "10px 16px", fontWeight: 500, color: "#374151" }}>{row.feature}</td>
                    <td style={{ padding: "10px 16px", textAlign: "center" }}>
                      {typeof row.zsl === "boolean" ? (row.zsl ? <div style={{ display: "flex", justifyContent: "center" }}><CheckIcon /></div> : <div style={{ display: "flex", justifyContent: "center" }}><XIcon /></div>) : <div style={{ display: "flex", justifyContent: "center" }}><PartialIcon label={row.zsl} /></div>}
                    </td>
                    <td style={{ padding: "10px 16px", textAlign: "center" }}>
                      {typeof row.mit === "boolean" ? (row.mit ? <div style={{ display: "flex", justifyContent: "center" }}><CheckIcon /></div> : <div style={{ display: "flex", justifyContent: "center" }}><XIcon /></div>) : <div style={{ display: "flex", justifyContent: "center" }}><PartialIcon label={row.mit} /></div>}
                    </td>
                    <td style={{ padding: "10px 16px", textAlign: "center" }}>
                      {typeof row.apache === "boolean" ? (row.apache ? <div style={{ display: "flex", justifyContent: "center" }}><CheckIcon /></div> : <div style={{ display: "flex", justifyContent: "center" }}><XIcon /></div>) : <div style={{ display: "flex", justifyContent: "center" }}><PartialIcon label={row.apache} /></div>}
                    </td>
                    <td style={{ padding: "10px 16px", textAlign: "center" }}>
                      {typeof row.gpl === "boolean" ? (row.gpl ? <div style={{ display: "flex", justifyContent: "center" }}><CheckIcon /></div> : <div style={{ display: "flex", justifyContent: "center" }}><XIcon /></div>) : <div style={{ display: "flex", justifyContent: "center" }}><PartialIcon label={row.gpl} /></div>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* Licenses */}
      <section id="licenses" style={{ padding: "60px 32px", maxWidth: 900, margin: "0 auto" }}>
        <h2 style={{ fontSize: 28, fontWeight: 800, color: "#111827", margin: "0 0 8px", textAlign: "center" }}>The Licenses</h2>
        <p style={{ fontSize: 15, color: "#6b7280", margin: "0 0 32px", textAlign: "center" }}>
          Two licenses. One vision. Future-proof.
        </p>

        {/* Tabs */}
        <div style={{ display: "flex", justifyContent: "center", gap: 8, marginBottom: 32 }}>
          <button onClick={() => setActiveTab("zsl-x")} style={{ padding: "10px 24px", borderRadius: 8, border: "1px solid #e5e7eb", background: activeTab === "zsl-x" ? "#7c3aed" : "white", color: activeTab === "zsl-x" ? "white" : "#374151", fontSize: 14, fontWeight: 600, cursor: "pointer" }}>
            ZSL-X v1.0.0
          </button>
          <button onClick={() => setActiveTab("mekra-x")} style={{ padding: "10px 24px", borderRadius: 8, border: "1px solid #e5e7eb", background: activeTab === "mekra-x" ? "#7c3aed" : "white", color: activeTab === "mekra-x" ? "white" : "#374151", fontSize: 14, fontWeight: 600, cursor: "pointer" }}>
            MEKRA-X v1.0.0
          </button>
        </div>

        {activeTab === "zsl-x" ? (
          <div style={{ background: "white", border: "1px solid #e5e7eb", borderRadius: 16, padding: 40, position: "relative", overflow: "hidden" }}>
            <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 4, background: "linear-gradient(90deg, #7c3aed, #a78bfa)" }} />
            <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 20 }}>
              <span style={{ padding: "4px 12px", borderRadius: 6, background: "#f3f0ff", color: "#7c3aed", fontSize: 12, fontWeight: 700 }}>ACTIVE</span>
              <span style={{ fontSize: 13, color: "#6b7280" }}>Valid 2026–2028</span>
            </div>
            <h3 style={{ fontSize: 22, fontWeight: 800, color: "#111827", margin: "0 0 16px" }}>ZSL-X v1.0.0</h3>
            <p style={{ fontSize: 14, color: "#6b7280", margin: "0 0 24px", lineHeight: 1.6 }}>
              The active license for all ZYRAXON projects. Grants full commercial, modification, and redistribution rights while protecting project identity and origin.
            </p>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 12, marginBottom: 24 }}>
              {[
                "Full commercial rights",
                "Modification and fork rights",
                "Redistribution with attribution",
                "Patent grant from contributors",
                "Project identity protection",
                "Auto-transitions to MEKRA-X in 2028",
              ].map((item) => (
                <div key={item} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <CheckIcon />
                  <span style={{ fontSize: 13, color: "#374151" }}>{item}</span>
                </div>
              ))}
            </div>
            <div style={{ display: "flex", gap: 12 }}>
              <a href="https://github.com/onelpawarai-X/ZSL/blob/main/ZSL-X-LICENSE.txt" target="_blank" rel="noopener noreferrer"
                style={{ padding: "10px 20px", borderRadius: 8, background: "#7c3aed", color: "white", fontSize: 13, fontWeight: 600, textDecoration: "none" }}>
                Read Full Text
              </a>
              <a href="https://github.com/onelpawarai-X/ZSL" target="_blank" rel="noopener noreferrer"
                style={{ padding: "10px 20px", borderRadius: 8, border: "1px solid #e5e7eb", background: "white", color: "#374151", fontSize: 13, fontWeight: 600, textDecoration: "none" }}>
                View on GitHub
              </a>
            </div>
          </div>
        ) : (
          <div style={{ background: "white", border: "1px solid #e5e7eb", borderRadius: 16, padding: 40, position: "relative", overflow: "hidden" }}>
            <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 4, background: "linear-gradient(90deg, #f59e0b, #f97316)" }} />
            <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 20 }}>
              <span style={{ padding: "4px 12px", borderRadius: 6, background: "#fef3c7", color: "#b45309", fontSize: 12, fontWeight: 700 }}>SUCCESSOR</span>
              <span style={{ fontSize: 13, color: "#6b7280" }}>Auto-activates January 1, 2028</span>
            </div>
            <h3 style={{ fontSize: 22, fontWeight: 800, color: "#111827", margin: "0 0 16px" }}>MEKRA-X v1.0.0</h3>
            <p style={{ fontSize: 14, color: "#6b7280", margin: "0 0 24px", lineHeight: 1.6 }}>
              The next-generation license with enhanced enterprise rights, contributor protections, and a structured security disclosure framework.
            </p>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 12, marginBottom: 24 }}>
              {[
                "Everything in ZSL-X, plus:",
                "Explicit enterprise use rights (50+ employees)",
                "30-day cure period for breaches",
                "Enhanced contributor protections",
                "72-hour security acknowledgment",
                "Future transition path to NEXUS-X",
              ].map((item) => (
                <div key={item} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <CheckIcon />
                  <span style={{ fontSize: 13, color: "#374151" }}>{item}</span>
                </div>
              ))}
            </div>
            <div style={{ display: "flex", gap: 12 }}>
              <a href="https://github.com/onelpawarai-X/ZSL/blob/main/MEKRA-X-LICENSE.txt" target="_blank" rel="noopener noreferrer"
                style={{ padding: "10px 20px", borderRadius: 8, background: "#f59e0b", color: "white", fontSize: 13, fontWeight: 600, textDecoration: "none" }}>
                Read Full Text
              </a>
              <a href="https://github.com/onelpawarai-X/ZSL" target="_blank" rel="noopener noreferrer"
                style={{ padding: "10px 20px", borderRadius: 8, border: "1px solid #e5e7eb", background: "white", color: "#374151", fontSize: 13, fontWeight: 600, textDecoration: "none" }}>
                View on GitHub
              </a>
            </div>
          </div>
        )}
      </section>

      {/* Timeline */}
      <section style={{ padding: "60px 32px", background: "white", borderTop: "1px solid #e5e7eb", borderBottom: "1px solid #e5e7eb" }}>
        <div style={{ maxWidth: 700, margin: "0 auto" }}>
          <h2 style={{ fontSize: 28, fontWeight: 800, color: "#111827", margin: "0 0 32px", textAlign: "center" }}>License Timeline</h2>
          <div style={{ position: "relative", paddingLeft: 32 }}>
            <div style={{ position: "absolute", left: 11, top: 8, bottom: 8, width: 2, background: "#e5e7eb" }} />
            {TIMELINE.map((t, i) => (
              <div key={t.year} style={{ position: "relative", marginBottom: i < TIMELINE.length - 1 ? 32 : 0 }}>
                <div style={{ position: "absolute", left: -32, top: 4, width: 24, height: 24, borderRadius: "50%", background: t.active ? "#7c3aed" : "white", border: `2px solid ${t.active ? "#7c3aed" : "#e5e7eb"}`, display: "flex", alignItems: "center", justifyContent: "center" }}>
                  {t.active && <div style={{ width: 8, height: 8, borderRadius: "50%", background: "white" }} />}
                </div>
                <div>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                    <span style={{ fontSize: 14, fontWeight: 700, color: t.active ? "#7c3aed" : "#111827" }}>{t.year}</span>
                    <span style={{ fontSize: 14, fontWeight: 600, color: "#111827" }}>{t.event}</span>
                  </div>
                  <p style={{ fontSize: 13, color: "#6b7280", margin: 0 }}>{t.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How to Use */}
      <section style={{ padding: "60px 32px", maxWidth: 900, margin: "0 auto" }}>
        <h2 style={{ fontSize: 28, fontWeight: 800, color: "#111827", margin: "0 0 8px", textAlign: "center" }}>How to Use ZSL</h2>
        <p style={{ fontSize: 15, color: "#6b7280", margin: "0 0 32px", textAlign: "center" }}>
          Three ways to adopt the Zyraxon Sovereign License.
        </p>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 20 }}>
          {[
            {
              title: "Reference in Your Project",
              desc: "Add a one-line reference to your LICENSE file or package.json.",
              code: 'Licensed under the Zyraxon Sovereign License\n— X Edition (ZSL-X v1.0.0)\nSee https://github.com/onelpawarai-X/ZSL',
            },
            {
              title: "Include Full License",
              desc: "Copy ZSL-X-LICENSE.txt into your project root as your LICENSE file.",
              code: "curl -o LICENSE https://raw.githubusercontent.com/\nonelpawarai-X/ZSL/main/\nZSL-X-LICENSE.txt",
            },
            {
              title: "npm / package.json",
              desc: "Reference the license file in your package manifest.",
              code: '{\n  "license": "SEE LICENSE IN LICENSE",\n  "licenseFile": "LICENSE"\n}',
            },
          ].map((w) => (
            <div key={w.title} style={{ background: "white", border: "1px solid #e5e7eb", borderRadius: 14, padding: 24 }}>
              <h3 style={{ fontSize: 15, fontWeight: 700, color: "#111827", margin: "0 0 8px" }}>{w.title}</h3>
              <p style={{ fontSize: 13, color: "#6b7280", margin: "0 0 16px", lineHeight: 1.5 }}>{w.desc}</p>
              <pre style={{ background: "#f9fafb", border: "1px solid #f3f4f6", borderRadius: 8, padding: 12, fontSize: 11, color: "#374151", margin: 0, overflow: "auto", lineHeight: 1.6, fontFamily: "JetBrains Mono, Fira Code, monospace" }}>
                {w.code}
              </pre>
            </div>
          ))}
        </div>
      </section>

      {/* Projects Using ZSL */}
      <section style={{ padding: "60px 32px", background: "white", borderTop: "1px solid #e5e7eb", borderBottom: "1px solid #e5e7eb" }}>
        <div style={{ maxWidth: 900, margin: "0 auto" }}>
          <h2 style={{ fontSize: 28, fontWeight: 800, color: "#111827", margin: "0 0 8px", textAlign: "center" }}>Projects Using ZSL</h2>
          <p style={{ fontSize: 15, color: "#6b7280", margin: "0 0 32px", textAlign: "center" }}>
            All official ZYRAXON projects are licensed under ZSL.
          </p>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 16 }}>
            {PROJECTS_USING_ZSL.map((p) => (
              <a key={p.name} href={`https://github.com/${p.repo}`} target="_blank" rel="noopener noreferrer"
                style={{ background: "white", border: "1px solid #e5e7eb", borderRadius: 12, padding: 20, textDecoration: "none", display: "block", transition: "all 0.15s" }}
                onMouseEnter={(e) => { e.currentTarget.style.borderColor = p.color; e.currentTarget.style.boxShadow = `0 4px 20px ${p.color}15`; }}
                onMouseLeave={(e) => { e.currentTarget.style.borderColor = "#e5e7eb"; e.currentTarget.style.boxShadow = "none"; }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                  <span style={{ width: 10, height: 10, borderRadius: 3, background: p.color, display: "inline-block" }} />
                  <span style={{ fontSize: 15, fontWeight: 700, color: "#111827" }}>{p.name}</span>
                </div>
                <p style={{ fontSize: 13, color: "#6b7280", margin: "0 0 12px" }}>{p.desc}</p>
                <span style={{ fontSize: 11, fontWeight: 600, color: p.color, background: `${p.color}10`, padding: "3px 10px", borderRadius: 4 }}>ZSL-X v1.0.0</span>
              </a>
            ))}
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section id="faq" style={{ padding: "60px 32px", maxWidth: 700, margin: "0 auto" }}>
        <h2 style={{ fontSize: 28, fontWeight: 800, color: "#111827", margin: "0 0 8px", textAlign: "center" }}>Frequently Asked Questions</h2>
        <p style={{ fontSize: 15, color: "#6b7280", margin: "0 0 32px", textAlign: "center" }}>
          Everything you need to know about ZSL.
        </p>
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {FAQ.map((f, i) => (
            <div key={i} style={{ background: "white", border: "1px solid #e5e7eb", borderRadius: 12, overflow: "hidden" }}>
              <button onClick={() => setOpenFaq(openFaq === i ? null : i)}
                style={{ width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between", padding: "16px 20px", background: "none", border: "none", cursor: "pointer", textAlign: "left" }}>
                <span style={{ fontSize: 14, fontWeight: 600, color: "#111827" }}>{f.q}</span>
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none" style={{ transform: openFaq === i ? "rotate(180deg)" : "rotate(0deg)", transition: "transform 0.2s", flexShrink: 0 }}>
                  <path d="M4 6l4 4 4-4" stroke="#6b7280" strokeWidth="1.5" strokeLinecap="round" />
                </svg>
              </button>
              {openFaq === i && (
                <div style={{ padding: "0 20px 16px", fontSize: 13, color: "#6b7280", lineHeight: 1.6 }}>
                  {f.a}
                </div>
              )}
            </div>
          ))}
        </div>
      </section>

      {/* Attribution Template */}
      <section style={{ padding: "60px 32px", background: "white", borderTop: "1px solid #e5e7eb", borderBottom: "1px solid #e5e7eb" }}>
        <div style={{ maxWidth: 700, margin: "0 auto" }}>
          <h2 style={{ fontSize: 28, fontWeight: 800, color: "#111827", margin: "0 0 8px", textAlign: "center" }}>Attribution Template</h2>
          <p style={{ fontSize: 15, color: "#6b7280", margin: "0 0 24px", textAlign: "center" }}>
            Any redistribution must include the following attribution.
          </p>
          <pre style={{ background: "#f9fafb", border: "1px solid #e5e7eb", borderRadius: 12, padding: 24, fontSize: 13, color: "#374151", lineHeight: 1.7, fontFamily: "JetBrains Mono, Fira Code, monospace", overflow: "auto" }}>
{`This software is based on [Project Name],
originally created by onelpawarai.
Modifications have been made.

Licensed under the Zyraxon Sovereign License
— X Edition (ZSL-X v1.0.0).`}
          </pre>
        </div>
      </section>

      {/* Footer */}
      <footer style={{ padding: "40px 32px", borderTop: "1px solid #e5e7eb" }}>
        <div style={{ maxWidth: 900, margin: "0 auto", display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 16 }}>
          <div>
            <p style={{ fontSize: 14, fontWeight: 700, color: "#111827", margin: "0 0 4px" }}>Zyraxon Sovereign License</p>
            <p style={{ fontSize: 12, color: "#9ca3af", margin: 0 }}>Build Without Limits. Respect the Origin.</p>
          </div>
          <div style={{ display: "flex", gap: 20, fontSize: 13 }}>
            <a href="/" style={{ color: "#6b7280", textDecoration: "none" }}>Home</a>
            <a href="/faq" style={{ color: "#6b7280", textDecoration: "none" }}>FAQ</a>
            <a href="https://github.com/onelpawarai-X/ZSL" target="_blank" rel="noopener noreferrer" style={{ color: "#6b7280", textDecoration: "none" }}>GitHub</a>
            <a href="https://github.com/onelpawarai-X/ZSL/blob/main/ZSL-X-LICENSE.txt" target="_blank" rel="noopener noreferrer" style={{ color: "#6b7280", textDecoration: "none" }}>ZSL-X</a>
            <a href="https://github.com/onelpawarai-X/ZSL/blob/main/MEKRA-X-LICENSE.txt" target="_blank" rel="noopener noreferrer" style={{ color: "#6b7280", textDecoration: "none" }}>MEKRA-X</a>
          </div>
        </div>
        <div style={{ maxWidth: 900, margin: "24px auto 0", paddingTop: 20, borderTop: "1px solid #f3f4f6", textAlign: "center" }}>
          <p style={{ fontSize: 12, color: "#9ca3af", margin: 0 }}>2026 onelpawarai — Zyraxon Sovereign License</p>
        </div>
      </footer>

      <style>{`@keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.5; } }`}</style>
    </div>
  );
}
