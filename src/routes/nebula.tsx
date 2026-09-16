import { createFileRoute } from "@tanstack/react-router";
import { useState, useEffect, useRef, useCallback } from "react";

export const Route = createFileRoute("/nebula")({
  head: () => ({ meta: [{ title: "ZYRAXON Nebula — AI Model Hub" }] }),
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
    <div className="min-h-screen flex items-center justify-center bg-gray-50 relative overflow-hidden">
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-purple-200/30 rounded-full blur-3xl" />
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-cyan-200/30 rounded-full blur-3xl" />
      </div>
      <div className="relative z-10 w-full max-w-md border border-gray-200 bg-white rounded-2xl shadow-xl p-8">
        <div className="text-center mb-6">
          <div className="mx-auto w-16 h-16 rounded-2xl bg-gradient-to-br from-purple-500 to-cyan-500 flex items-center justify-center mb-4">
            <svg className="w-8 h-8 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
          </div>
          <h1 className="text-2xl font-bold bg-gradient-to-r from-purple-600 to-cyan-600 bg-clip-text text-transparent">
            ZYRAXON Nebula
          </h1>
          <p className="text-sm text-gray-500 mt-1">AI Model Hub — Admin Access</p>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="relative">
            <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg>
            <input
              type={showPw ? "text" : "password"}
              placeholder="Password..."
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full pl-10 pr-10 rounded-lg border border-gray-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-purple-500 focus:ring-2 focus:ring-purple-100"
              autoFocus
            />
            <button type="button" onClick={() => setShowPw(!showPw)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
              {showPw ? (
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" /></svg>
              ) : (
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
              )}
            </button>
          </div>
          {error && (
            <p className="text-red-500 text-sm flex items-center gap-2">
              <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
              {error}
            </p>
          )}
          <button
            type="submit"
            disabled={loading || !password}
            className="w-full rounded-lg bg-gradient-to-r from-purple-600 to-cyan-600 hover:from-purple-500 hover:to-cyan-500 text-white font-semibold py-2.5 text-sm disabled:opacity-50 transition-all"
          >
            {loading ? "Verifying..." : "Enter"}
          </button>
        </form>
        <div className="mt-6 text-center">
          <a href="/" className="text-xs text-gray-400 hover:text-gray-600">Back to home</a>
        </div>
      </div>
    </div>
  );
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + " " + sizes[i];
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

  if (loading) return <div className="flex justify-center py-12"><div className="w-6 h-6 border-4 border-purple-200 border-t-purple-600 rounded-full animate-spin" /></div>;

  const stats = [
    { label: "CPU", value: `${info?.cpus ?? "?"} cores`, sub: info?.cpuModel || "" },
    { label: "RAM", value: `${info?.totalMemoryGB ?? "?"} GB`, sub: `${info?.freeMemoryGB ?? "?"} GB free` },
    { label: "Platform", value: info?.platform ?? "?", sub: info?.arch ?? "" },
    { label: "Uptime", value: `${Math.floor((info?.uptime ?? 0) / 3600)}h`, sub: `Node ${info?.nodeVersion ?? ""}` },
  ];

  return (
    <div className="grid grid-cols-2 gap-3">
      {stats.map((s) => (
        <div key={s.label} className="border border-gray-200 bg-white rounded-xl p-4">
          <p className="text-xs text-gray-400">{s.label}</p>
          <p className="text-lg font-bold text-gray-900">{s.value}</p>
          {s.sub && <p className="text-xs text-gray-500">{s.sub}</p>}
        </div>
      ))}
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
        const query = text.replace(/(search|find|করো|বের)/gi, "").trim();
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
    <div className="flex flex-col h-[500px]">
      <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-3">
        {messages.map((msg, i) => (
          <div key={i} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
            <div className={`max-w-[80%] rounded-xl px-4 py-2.5 text-sm whitespace-pre-wrap ${
              msg.role === "user"
                ? "bg-gradient-to-r from-purple-600 to-cyan-600 text-white"
                : "bg-gray-100 text-gray-800"
            }`}>{msg.content}</div>
          </div>
        ))}
        {loading && <div className="flex justify-start"><div className="bg-gray-100 rounded-xl px-4 py-3"><div className="flex gap-1"><span className="w-2 h-2 bg-purple-400 rounded-full animate-bounce" /><span className="w-2 h-2 bg-purple-400 rounded-full animate-bounce" style={{ animationDelay: "150ms" }} /><span className="w-2 h-2 bg-purple-400 rounded-full animate-bounce" style={{ animationDelay: "300ms" }} /></div></div></div>}
      </div>
      <div className="border-t border-gray-200 p-3 bg-white">
        <div className="flex items-center gap-2">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSend()}
            placeholder="Search models, generate content..."
            disabled={loading}
            className="flex-1 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm outline-none focus:border-purple-500 focus:ring-2 focus:ring-purple-100"
          />
          <button onClick={handleSend} disabled={loading || !input.trim()} className="rounded-lg bg-gradient-to-r from-purple-600 to-cyan-600 text-white px-4 py-2 text-sm font-medium disabled:opacity-50">
            Send
          </button>
        </div>
      </div>
    </div>
  );
}

function NebulaPanel() {
  const [tab, setTab] = useState<"chat" | "system">("chat");

  return (
    <div className="min-h-screen bg-gray-50 text-gray-900">
      <header className="border-b border-gray-200 bg-white/80 backdrop-blur-xl sticky top-0 z-50">
        <div className="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-purple-500 to-cyan-500 flex items-center justify-center">
              <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
            </div>
            <div>
              <h1 className="text-lg font-bold bg-gradient-to-r from-purple-600 to-cyan-600 bg-clip-text text-transparent">ZYRAXON Nebula</h1>
              <p className="text-xs text-gray-500">AI Model Hub — HuggingFace Powered</p>
            </div>
          </div>
          <div className="flex items-center gap-2 rounded-full border border-green-300 bg-green-50 px-3 py-1">
            <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
            <span className="text-xs font-medium text-green-700">Live</span>
          </div>
        </div>
      </header>
      <main className="max-w-5xl mx-auto px-4 py-6">
        <div className="flex gap-2 mb-6">
          {[["chat", "Chat"], ["system", "System"]].map(([key, label]) => (
            <button key={key} onClick={() => setTab(key as any)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${tab === key ? "bg-purple-100 text-purple-700" : "text-gray-500 hover:bg-gray-100"}`}>
              {label}
            </button>
          ))}
        </div>
        {tab === "chat" && (
          <div className="border border-gray-200 bg-white rounded-xl overflow-hidden">
            <ChatTab />
          </div>
        )}
        {tab === "system" && <SystemTab />}
      </main>
    </div>
  );
}

export default function NebulaPage() {
  const [unlocked, setUnlocked] = useState(false);

  useEffect(() => {
    try {
      const token = localStorage.getItem("nebula_auth");
      if (token) setUnlocked(true);
    } catch {}
  }, []);

  if (!unlocked) return <PasswordGate onUnlock={() => setUnlocked(true)} />;
  return <NebulaPanel />;
}
