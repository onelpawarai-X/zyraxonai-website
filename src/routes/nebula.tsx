import { createFileRoute } from "@tanstack/react-router";
import { useState, useEffect, useRef } from "react";

export const Route = createFileRoute("/nebula")({
  head: () => ({ meta: [{ title: "ZYRAXON Nebula — AI Model Hub" }] }),
  component: NebulaPage,
});

function PasswordGate({ onUnlock }: { onUnlock: () => void }) {
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`/api/public/nebula?action=verify&password=${encodeURIComponent(password)}`);
      const text = await res.text();
      let data: any;
      try { data = JSON.parse(text); } catch { data = { success: false }; }
      if (data.success) {
        localStorage.setItem("nebula_auth", data.token || "ok");
        onUnlock();
      } else {
        setError("Wrong password!");
      }
    } catch {
      setError("Connection failed.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#f9fafb", fontFamily: "Inter, sans-serif", position: "relative", overflow: "hidden" }}>
      <div style={{ position: "absolute", inset: 0, pointerEvents: "none" }}>
        <div style={{ position: "absolute", top: "25%", left: "25%", width: 384, height: 384, background: "rgba(192,132,252,0.3)", borderRadius: "50%", filter: "blur(80px)" }} />
        <div style={{ position: "absolute", bottom: "25%", right: "25%", width: 384, height: 384, background: "rgba(34,211,238,0.3)", borderRadius: "50%", filter: "blur(80px)" }} />
      </div>
      <div style={{ position: "relative", zIndex: 10, width: "100%", maxWidth: 420, border: "1px solid #e5e7eb", background: "white", borderRadius: 16, boxShadow: "0 20px 60px rgba(0,0,0,0.1)", padding: 32, margin: "0 16px" }}>
        <div style={{ textAlign: "center", marginBottom: 24 }}>
          <div style={{ width: 64, height: 64, borderRadius: 16, background: "linear-gradient(135deg, #a855f7, #06b6d4)", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 16px" }}>
            <svg style={{ width: 32, height: 32, color: "white" }} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
          </div>
          <h1 style={{ fontSize: 28, fontWeight: 800, background: "linear-gradient(90deg, #9333ea, #0891b2)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", margin: 0 }}>ZYRAXON Nebula</h1>
          <p style={{ fontSize: 14, color: "#6b7280", marginTop: 4 }}>AI Model Hub — Admin Access</p>
        </div>
        <form onSubmit={handleSubmit}>
          <div style={{ position: "relative", marginBottom: 16 }}>
            <svg style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", width: 16, height: 16, color: "#9ca3af" }} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg>
            <input type={showPw ? "text" : "password"} placeholder="Password..." value={password} onChange={(e) => setPassword(e.target.value)} autoFocus
              style={{ width: "100%", paddingLeft: 40, paddingRight: 40, paddingTop: 10, paddingBottom: 10, border: "1px solid #e5e7eb", borderRadius: 8, fontSize: 14, outline: "none", boxSizing: "border-box" }} />
            <button type="button" onClick={() => setShowPw(!showPw)} style={{ position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", color: "#9ca3af", padding: 0 }}>
              {showPw ? "Hide" : "Show"}
            </button>
          </div>
          {error && <p style={{ color: "#ef4444", fontSize: 13, marginBottom: 12 }}>{error}</p>}
          <button type="submit" disabled={loading || !password}
            style={{ width: "100%", padding: "10px 0", background: "linear-gradient(90deg, #9333ea, #0891b2)", color: "white", border: "none", borderRadius: 8, fontSize: 14, fontWeight: 600, cursor: "pointer", opacity: loading || !password ? 0.5 : 1 }}>
            {loading ? "Verifying..." : "Enter"}
          </button>
        </form>
        <div style={{ textAlign: "center", marginTop: 20 }}>
          <a href="/" style={{ fontSize: 12, color: "#9ca3af", textDecoration: "none" }}>Back to home</a>
        </div>
      </div>
    </div>
  );
}

function ChatTab() {
  const [messages, setMessages] = useState<{ role: string; content: string }[]>([
    { role: "assistant", content: "Welcome to ZYRAXON Nebula!\n\nSearch models, download them, or generate content.\n\nTry: \"search sdxl\" or \"generate a cat image\"" },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages]);

  const addMsg = (role: string, content: string) => setMessages((p) => [...p, { role, content }]);

  const handleSend = async () => {
    const text = input.trim();
    if (!text || loading) return;
    setInput("");
    addMsg("user", text);
    setLoading(true);
    try {
      const lower = text.toLowerCase();
      if (lower.includes("search") || lower.includes("find")) {
        const query = text.replace(/(search|find)/gi, "").trim();
        if (query) {
          const res = await fetch(`/api/public/nebula/search?q=${encodeURIComponent(query)}&limit=5`);
          const data = await res.json();
          if (data.success && data.models?.length) {
            const list = data.models.map((m: any) => `- ${m.modelId} (${m.pipeline_tag}) — ${m.downloads} downloads`).join("\n");
            addMsg("assistant", `Found ${data.models.length} models:\n${list}`);
          } else {
            addMsg("assistant", "No models found.");
          }
        }
      } else {
        const res = await fetch("/api/public/nebula/generate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ model: "microsoft/DialoGPT-medium", prompt: text, type: "text" }),
        });
        const data = await res.json();
        if (data.success) {
          const result = data.result;
          addMsg("assistant", typeof result === "string" ? result : result?.generated_text || JSON.stringify(result));
        } else {
          addMsg("assistant", `Error: ${data.error}`);
        }
      }
    } catch (e: any) {
      addMsg("assistant", `Error: ${e?.message}`);
    } finally { setLoading(false); }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", height: 500 }}>
      <div ref={scrollRef} style={{ flex: 1, overflowY: "auto", padding: 16 }}>
        {messages.map((msg, i) => (
          <div key={i} style={{ display: "flex", justifyContent: msg.role === "user" ? "flex-end" : "flex-start", marginBottom: 12 }}>
            <div style={{ maxWidth: "80%", padding: "10px 16px", borderRadius: 12, fontSize: 14, whiteSpace: "pre-wrap", lineHeight: 1.5,
              background: msg.role === "user" ? "linear-gradient(90deg, #9333ea, #0891b2)" : "#f3f4f6",
              color: msg.role === "user" ? "white" : "#1f2937" }}>
              {msg.content}
            </div>
          </div>
        ))}
        {loading && <div style={{ display: "flex", justifyContent: "flex-start" }}><div style={{ background: "#f3f4f6", borderRadius: 12, padding: "10px 16px" }}><span style={{ display: "inline-block", width: 8, height: 8, borderRadius: "50%", background: "#a855f7", animation: "pulse 1s infinite" }} /></div></div>}
      </div>
      <div style={{ borderTop: "1px solid #e5e7eb", padding: 12, display: "flex", gap: 8 }}>
        <input value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={(e) => e.key === "Enter" && handleSend()} placeholder="Search models, generate content..." disabled={loading}
          style={{ flex: 1, padding: "8px 12px", border: "1px solid #e5e7eb", borderRadius: 8, fontSize: 14, outline: "none" }} />
        <button onClick={handleSend} disabled={loading || !input.trim()}
          style={{ padding: "8px 16px", background: "linear-gradient(90deg, #9333ea, #0891b2)", color: "white", border: "none", borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: "pointer", opacity: loading || !input.trim() ? 0.5 : 1 }}>
          Send
        </button>
      </div>
    </div>
  );
}

function SystemTab() {
  const [info, setInfo] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const res = await fetch("/api/public/nebula?action=system");
        const data = await res.json();
        if (active && data.success) setInfo(data.system);
      } catch {} finally { if (active) setLoading(false); }
    })();
    return () => { active = false; };
  }, []);

  if (loading) return <div style={{ textAlign: "center", padding: 48, color: "#9ca3af" }}>Loading...</div>;

  const stats = [
    { label: "CPU", value: `${info?.cpus ?? "?"} cores`, sub: info?.cpuModel || "" },
    { label: "RAM", value: `${info?.totalMemoryGB ?? "?"} GB`, sub: `${info?.freeMemoryGB ?? "?"} GB free` },
    { label: "Platform", value: info?.platform ?? "?", sub: info?.arch ?? "" },
    { label: "Uptime", value: `${Math.floor((info?.uptime ?? 0) / 3600)}h`, sub: `Node ${info?.nodeVersion ?? ""}` },
  ];

  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
      {stats.map((s) => (
        <div key={s.label} style={{ border: "1px solid #e5e7eb", background: "white", borderRadius: 12, padding: 16 }}>
          <p style={{ fontSize: 12, color: "#9ca3af", margin: 0 }}>{s.label}</p>
          <p style={{ fontSize: 20, fontWeight: 700, color: "#111827", margin: "4px 0" }}>{s.value}</p>
          {s.sub && <p style={{ fontSize: 12, color: "#6b7280", margin: 0 }}>{s.sub}</p>}
        </div>
      ))}
    </div>
  );
}

function NebulaPanel() {
  const [tab, setTab] = useState<"chat" | "system">("chat");

  return (
    <div style={{ minHeight: "100vh", background: "#f9fafb", fontFamily: "Inter, sans-serif" }}>
      <header style={{ borderBottom: "1px solid #e5e7eb", background: "rgba(255,255,255,0.9)", backdropFilter: "blur(12px)", position: "sticky", top: 0, zIndex: 50 }}>
        <div style={{ maxWidth: 800, margin: "0 auto", padding: "12px 16px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div style={{ width: 36, height: 36, borderRadius: 12, background: "linear-gradient(135deg, #a855f7, #06b6d4)", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <svg style={{ width: 20, height: 20, color: "white" }} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
            </div>
            <div>
              <h1 style={{ fontSize: 18, fontWeight: 700, background: "linear-gradient(90deg, #9333ea, #0891b2)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", margin: 0 }}>ZYRAXON Nebula</h1>
              <p style={{ fontSize: 12, color: "#6b7280", margin: 0 }}>AI Model Hub — HuggingFace Powered</p>
            </div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 6, border: "1px solid #86efac", background: "#f0fdf4", borderRadius: 999, padding: "4px 12px" }}>
            <span style={{ width: 8, height: 8, borderRadius: "50%", background: "#4ade80" }} />
            <span style={{ fontSize: 12, fontWeight: 600, color: "#15803d" }}>Live</span>
          </div>
        </div>
      </header>
      <main style={{ maxWidth: 800, margin: "0 auto", padding: "24px 16px" }}>
        <div style={{ display: "flex", gap: 8, marginBottom: 24 }}>
          {(["chat", "system"] as const).map((key) => (
            <button key={key} onClick={() => setTab(key)}
              style={{ padding: "8px 16px", borderRadius: 8, fontSize: 13, fontWeight: 600, border: "none", cursor: "pointer",
                background: tab === key ? "#f3e8ff" : "transparent", color: tab === key ? "#7c3aed" : "#6b7280" }}>
              {key === "chat" ? "Chat" : "System"}
            </button>
          ))}
        </div>
        {tab === "chat" && <div style={{ border: "1px solid #e5e7eb", background: "white", borderRadius: 12, overflow: "hidden" }}><ChatTab /></div>}
        {tab === "system" && <SystemTab />}
      </main>
    </div>
  );
}

function NebulaPage() {
  const [unlocked, setUnlocked] = useState(false);

  useEffect(() => {
    try { if (localStorage.getItem("nebula_auth")) setUnlocked(true); } catch {}
  }, []);

  if (!unlocked) return <PasswordGate onUnlock={() => setUnlocked(true)} />;
  return <NebulaPanel />;
}
