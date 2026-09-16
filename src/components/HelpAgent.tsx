import { useState, useRef, useEffect, useCallback } from "react";

interface Message {
  role: "user" | "assistant";
  content: string;
  image?: string;
  timestamp: number;
}

const SYSTEM_PROMPT = `You are ZYRAXON Help Agent — a friendly, multilingual AI assistant on the ZYRAXON AI website. Guide users, answer questions, help navigate.

IDENTITY: You are AI, speak user's language, be warm & concise (2-4 sentences).

PRODUCTS:
1. ZYRAXON Agent — Desktop AI (Win/Mac/Linux), 552+ tools, 9 modes. Download: /download/zyraxon-agent | GitHub: github.com/onelpawarai-X/ZYRAXON-AI
2. Myra Agent — Android voice AI, 6 personalities, Bengali/English. Download: /download/myra-agent | GitHub: github.com/onelpawarai-X/Myra-Agent
3. Zyraxon Code — AI code editor (VS Code fork). Download: /download/zyraxon-code | GitHub: github.com/onelpawarai-X/Zyraxon-Code

LICENSE: ZSL (Zyraxon Sovereign License) — ZSL-X v1.0.0 (2026-2028), MEKRA-X (2028+). Enterprise-grade. Page: /zsl | GitHub: github.com/onelpawarai-X/ZSL

PAGES:
- / — Landing (features, modes, models, comparison, download)
- /ecosystem — Marketplace (published apps, extensions, releases, publish)
- /publish — Publish your project to ZYRAXON Hub
- /releases — All GitHub releases from 3 repos
- /docs — Documentation (18+ pages)
- /nebula — NEBULA AI chat (password: ZYRAXON)
- /bludar — AI Bludar builder
- /zsl — ZSL License page

COMMUNITY: Discord (discord.gg/h8mHvf45g), YouTube (@ZYRAXONAI), Google Group
FOUNDER: OneL Pawar — onelpawarai.lovable.app
LICENSE PORTAL: zyraxonai-license.lovable.app
GITHUB ORG: github.com/onelpawarai-X

RULES: Respond in user's language. Be concise. If screenshot shared, analyze it. If location shared, acknowledge. Never make up URLs. You can also have casual conversations.`;

function getFallback(msg: string): string {
  const l = msg.toLowerCase();
  if (l.includes("download") || l.includes("install")) return "Download our products:\n- ZYRAXON Agent: /download/zyraxon-agent\n- Myra Agent: /download/myra-agent\n- Zyraxon Code: /download/zyraxon-code\n\nOr visit /releases.";
  if (l.includes("license") || l.includes("zsl")) return "We use ZSL (Zyraxon Sovereign License) — enterprise-grade. Visit /zsl or GitHub: github.com/onelpawarai-X/ZSL";
  if (l.includes("ecosystem") || l.includes("marketplace")) return "Ecosystem Marketplace: /ecosystem. Publish: /publish.";
  if (l.includes("docs") || l.includes("documentation")) return "Documentation: /docs (18+ pages).";
  if (l.includes("hello") || l.includes("hi") || l.includes("হ্যালো") || l.includes("নমস্কার")) return "Hello! How can I help you today? Ask about our products, downloads, or anything about ZYRAXON.";
  if (l.includes("কেমন আছো") || l.includes("কি খবর")) return "আমি ভালো আছি! আপনাকে কিভাবে সাহায্য করতে পারি? ZYRAXON এর প্রোডাক্ট, ডাউনলোড, বা যেকোনো বিষয়ে জিজ্ঞেস করুন।";
  return "I'm here to help! Ask about our products (ZYRAXON Agent, Myra Agent, Zyraxon Code), downloads, ZSL License, Ecosystem, or Documentation. You can also just chat with me!";
}

export default function HelpAgent() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([
    { role: "assistant", content: "Hi! I'm the ZYRAXON Help Agent. Ask me about our products, downloads, or anything. You can also just chat!", timestamp: Date.now() },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [streaming, setStreaming] = useState("");
  const [location, setLocation] = useState<string | null>(null);
  const messagesEnd = useRef<HTMLDivElement>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  const scrollToBottom = useCallback(() => {
    messagesEnd.current?.scrollIntoView({ behavior: "smooth" });
  }, []);

  useEffect(() => { scrollToBottom(); }, [messages, streaming, scrollToBottom]);

  useEffect(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => setLocation(`${pos.coords.latitude.toFixed(2)}, ${pos.coords.longitude.toFixed(2)}`),
        () => setLocation(null),
      );
    }
  }, []);

  const sendMessage = async (text: string, image?: string) => {
    if (!text.trim() && !image) return;
    const userMsg: Message = { role: "user", content: text, image, timestamp: Date.now() };
    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setLoading(true);
    setStreaming("");

    try {
      const locationContext = location ? `\n[User location: ${location}]` : "";
      const imageContext = image ? "\n[User shared a screenshot]" : "";
      const history = [...messages, userMsg].slice(-10).map((m) => `${m.role}: ${m.content}`).join("\n");

      const res = await fetch("/api/help-agent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: text + locationContext + imageContext,
          history,
          system: SYSTEM_PROMPT,
          hasImage: !!image,
        }),
      });

      if (!res.ok) throw new Error("Failed");
      const contentType = res.headers.get("content-type") || "";

      if (contentType.includes("text/event-stream")) {
        const reader = res.body?.getReader();
        if (!reader) throw new Error("No reader");
        const decoder = new TextDecoder();
        let buffer = "";
        let fullText = "";

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop() || "";
          for (const line of lines) {
            if (line.startsWith("data: ")) {
              const data = line.slice(6).trim();
              if (data === "[DONE]") break;
              try {
                const parsed = JSON.parse(data);
                if (parsed.token) { fullText += parsed.token; setStreaming(fullText); }
              } catch {}
            }
          }
        }

        setMessages((prev) => [...prev, { role: "assistant", content: fullText, timestamp: Date.now() }]);
        setStreaming("");
      } else {
        const data = await res.json();
        setMessages((prev) => [...prev, { role: "assistant", content: data.reply, timestamp: Date.now() }]);
      }
    } catch {
      setMessages((prev) => [...prev, { role: "assistant", content: getFallback(text), timestamp: Date.now() }]);
    } finally {
      setLoading(false);
      setStreaming("");
    }
  };

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => sendMessage("I shared a screenshot. Can you help me with what I'm looking at?", reader.result as string);
    reader.readAsDataURL(file);
    e.target.value = "";
  };

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        style={{
          position: "fixed", bottom: 24, left: 24, zIndex: 9999,
          width: 56, height: 56, borderRadius: "50%",
          background: "linear-gradient(135deg, #7c3aed, #6d28d9)",
          border: "none", cursor: "pointer",
          boxShadow: "0 4px 20px rgba(124,58,237,0.4)",
          display: "flex", alignItems: "center", justifyContent: "center",
          transition: "transform 0.2s",
        }}
        onMouseEnter={(e) => (e.currentTarget.style.transform = "scale(1.1)")}
        onMouseLeave={(e) => (e.currentTarget.style.transform = "scale(1)")}
      >
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" />
        </svg>
      </button>
    );
  }

  return (
    <div style={{
      position: "fixed", bottom: 24, left: 24, zIndex: 9999,
      width: 380, maxWidth: "calc(100vw - 48px)", height: 520, maxHeight: "calc(100vh - 48px)",
      background: "white", borderRadius: 16,
      boxShadow: "0 12px 48px rgba(0,0,0,0.15)",
      display: "flex", flexDirection: "column", overflow: "hidden",
      fontFamily: "Inter, -apple-system, BlinkMacSystemFont, sans-serif",
    }}>
      <div style={{
        padding: "14px 16px", background: "linear-gradient(135deg, #7c3aed, #6d28d9)",
        color: "white", display: "flex", alignItems: "center", justifyContent: "space-between",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ width: 32, height: 32, borderRadius: "50%", background: "rgba(255,255,255,0.2)", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2"><path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" /></svg>
          </div>
          <div>
            <p style={{ fontSize: 14, fontWeight: 700, margin: 0 }}>ZYRAXON Help</p>
            <p style={{ fontSize: 11, opacity: 0.8, margin: 0 }}>AI Assistant</p>
          </div>
        </div>
        <button onClick={() => setOpen(false)} style={{ background: "none", border: "none", color: "white", cursor: "pointer", padding: 4 }}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6L6 18M6 6l12 12" /></svg>
        </button>
      </div>

      <div style={{ flex: 1, overflowY: "auto", padding: 16, display: "flex", flexDirection: "column", gap: 12 }}>
        {messages.map((msg, i) => (
          <div key={i} style={{ display: "flex", justifyContent: msg.role === "user" ? "flex-end" : "flex-start" }}>
            <div style={{
              maxWidth: "85%", padding: "10px 14px", borderRadius: 12,
              background: msg.role === "user" ? "#7c3aed" : "#f3f4f6",
              color: msg.role === "user" ? "white" : "#1f2937",
              fontSize: 13, lineHeight: 1.5, wordBreak: "break-word",
            }}>
              {msg.image && <img src={msg.image} alt="Screenshot" style={{ maxWidth: "100%", borderRadius: 8, marginBottom: 8, display: "block" }} />}
              {msg.content.split("\n").map((line, j) => <span key={j}>{line}{j < msg.content.split("\n").length - 1 && <br />}</span>)}
            </div>
          </div>
        ))}
        {streaming && (
          <div style={{ display: "flex", justifyContent: "flex-start" }}>
            <div style={{ maxWidth: "85%", padding: "10px 14px", borderRadius: 12, background: "#f3f4f6", color: "#1f2937", fontSize: 13, lineHeight: 1.5, wordBreak: "break-word" }}>
              {streaming.split("\n").map((line, j) => <span key={j}>{line}{j < streaming.split("\n").length - 1 && <br />}</span>)}
              <span style={{ display: "inline-block", width: 2, height: 14, background: "#7c3aed", marginLeft: 2, animation: "helpCursor 1s infinite" }} />
            </div>
          </div>
        )}
        {loading && !streaming && (
          <div style={{ display: "flex", justifyContent: "flex-start" }}>
            <div style={{ padding: "10px 14px", borderRadius: 12, background: "#f3f4f6", display: "flex", gap: 4 }}>
              {[0, 0.2, 0.4].map((d) => <span key={d} style={{ width: 6, height: 6, borderRadius: "50%", background: "#9ca3af", animation: `helpBounce 1.4s infinite ease-in-out ${d}s` }} />)}
            </div>
          </div>
        )}
        <div ref={messagesEnd} />
      </div>

      <div style={{ padding: "12px 16px", borderTop: "1px solid #e5e7eb", display: "flex", gap: 8, alignItems: "center" }}>
        <input ref={fileInput} type="file" accept="image/*" onChange={handleFile} style={{ display: "none" }} />
        <button onClick={() => fileInput.current?.click()} title="Upload screenshot"
          style={{ width: 36, height: 36, borderRadius: 8, border: "1px solid #e5e7eb", background: "white", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#6b7280" strokeWidth="2"><rect x="3" y="3" width="18" height="18" rx="2" /><circle cx="8.5" cy="8.5" r="1.5" /><path d="M21 15l-5-5L5 21" /></svg>
        </button>
        <input value={input} onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(input); } }}
          placeholder="Ask anything..."
          style={{ flex: 1, padding: "8px 12px", borderRadius: 8, border: "1px solid #e5e7eb", fontSize: 13, outline: "none", fontFamily: "inherit" }} />
        <button onClick={() => sendMessage(input)} disabled={!input.trim() || loading}
          style={{ width: 36, height: 36, borderRadius: 8, background: input.trim() ? "#7c3aed" : "#e5e7eb", border: "none", cursor: input.trim() ? "pointer" : "default", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={input.trim() ? "white" : "#9ca3af"} strokeWidth="2"><path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z" /></svg>
        </button>
      </div>

      <style>{`@keyframes helpBounce{0%,80%,100%{transform:scale(0);opacity:0.5}40%{transform:scale(1);opacity:1}}@keyframes helpCursor{0%,100%{opacity:1}50%{opacity:0}}`}</style>
    </div>
  );
}
