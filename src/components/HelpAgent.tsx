import { useState, useRef, useEffect, useCallback } from "react";

interface Message {
  role: "user" | "assistant";
  content: string;
  image?: string;
  timestamp: number;
}

const QUICK_PROMPTS = [
  "ZYRAXON AI কীভাবে ডাউনলোড করব?",
  "ZYRAXON AI এর কয়টি টুল আছে?",
  "GitHub Repository লিংক দিন",
  "Windows এ কি এটা ফ্রি?",
];

export default function HelpAgent() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([
    {
      role: "assistant",
      content: "স্বাগতম! আমি ZYRAXON AI অ্যাসিস্ট্যান্ট। যেকোনো প্রশ্ন করুন — ডাউনলোড, ফিচার, বা সেটআপ সংক্রান্ত যেকোনো বিষয়ে সাহায্য করতে পারি।",
      timestamp: Date.now(),
    },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [streaming, setStreaming] = useState("");
  const messagesEnd = useRef<HTMLDivElement>(null);

  const scrollToBottom = useCallback(() => {
    messagesEnd.current?.scrollIntoView({ behavior: "smooth" });
  }, []);

  useEffect(() => {
    if (open) scrollToBottom();
  }, [messages, streaming, open, scrollToBottom]);

  const sendMessage = async (text: string) => {
    if (!text.trim() || loading) return;
    const userMsg: Message = { role: "user", content: text, timestamp: Date.now() };
    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setLoading(true);
    setStreaming("");

    try {
      const historyText = messages
        .slice(-6)
        .map((m) => `${m.role === "user" ? "User" : "Assistant"}: ${m.content}`)
        .join("\n");

      const res = await fetch("/api/help-agent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: text, history: historyText }),
      });

      if (!res.ok) throw new Error(`HTTP ${res.status}`);

      const reader = res.body?.getReader();
      if (!reader) throw new Error("No response stream");

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
          const trimmed = line.trim();
          if (trimmed.startsWith("data: ")) {
            const dataStr = trimmed.slice(6);
            if (dataStr === "[DONE]") break;
            try {
              const parsed = JSON.parse(dataStr);
              const delta = parsed.choices?.[0]?.delta?.content || "";
              if (delta) {
                fullText += delta;
                setStreaming(fullText);
              }
            } catch {}
          }
        }
      }

      if (fullText) {
        setMessages((prev) => [
          ...prev,
          { role: "assistant", content: fullText, timestamp: Date.now() },
        ]);
      }
    } catch {
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: "দুঃখিত, সংযোগে সাময়িক সমস্যা হয়েছে। সরাসরি https://github.com/onelpawarai-X/ZYRAXON-AI দেখতে পারেন।",
          timestamp: Date.now(),
        },
      ]);
    } finally {
      setLoading(false);
      setStreaming("");
    }
  };

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        aria-label="Open ZYRAXON AI Help"
        style={{
          position: "fixed",
          bottom: 24,
          left: 24,
          zIndex: 9999,
          display: "flex",
          alignItems: "center",
          gap: 10,
          padding: "10px 18px",
          borderRadius: 9999,
          background: "linear-gradient(135deg, rgba(6,182,212,0.9), rgba(168,85,247,0.9))",
          backdropFilter: "blur(16px)",
          border: "1px solid rgba(255,255,255,0.25)",
          color: "#03060f",
          fontWeight: 700,
          fontSize: 13,
          cursor: "pointer",
          boxShadow: "0 8px 32px rgba(6,182,212,0.35)",
          transition: "transform 0.2s, box-shadow 0.2s",
        }}
        onMouseEnter={(e) => (e.currentTarget.style.transform = "scale(1.05)")}
        onMouseLeave={(e) => (e.currentTarget.style.transform = "scale(1)")}
      >
        <span
          style={{
            width: 8,
            height: 8,
            borderRadius: "50%",
            background: "#10b981",
            boxShadow: "0 0 10px #10b981",
          }}
        />
        <span>AI Help Agent</span>
      </button>
    );
  }

  return (
    <div
      style={{
        position: "fixed",
        bottom: 24,
        left: 24,
        zIndex: 9999,
        width: 380,
        maxWidth: "calc(100vw - 32px)",
        height: 540,
        maxHeight: "calc(100vh - 48px)",
        background: "rgba(10, 14, 26, 0.95)",
        backdropFilter: "blur(24px)",
        border: "1px solid rgba(6,182,212,0.3)",
        borderRadius: 20,
        boxShadow: "0 20px 60px rgba(0,0,0,0.6), 0 0 40px rgba(6,182,212,0.15)",
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
        color: "#e2e8f0",
      }}
    >
      {/* Header */}
      <div
        style={{
          padding: "14px 18px",
          borderBottom: "1px solid rgba(255,255,255,0.08)",
          background: "linear-gradient(90deg, rgba(6,182,212,0.15), rgba(168,85,247,0.15))",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div
            style={{
              width: 32,
              height: 32,
              borderRadius: 10,
              background: "linear-gradient(135deg, #06b6d4, #a855f7)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "#03060f",
              fontWeight: 800,
              fontSize: 16,
            }}
          >
            ⚡
          </div>
          <div>
            <div style={{ fontSize: 13, fontWeight: 700, color: "#f8fafc" }}>ZYRAXON Assistant</div>
            <div style={{ fontSize: 11, color: "#22d3ee", display: "flex", alignItems: "center", gap: 6 }}>
              <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#22c55e" }} />
              Live Connected
            </div>
          </div>
        </div>
        <button
          onClick={() => setOpen(false)}
          aria-label="Close ZYRAXON AI Help"
          style={{
            background: "none",
            border: "none",
            color: "#94a3b8",
            cursor: "pointer",
            fontSize: 18,
            padding: "4px 8px",
          }}
        >
          ✕
        </button>
      </div>

      {/* Messages */}
      <div style={{ flex: 1, overflowY: "auto", padding: 14, display: "flex", flexDirection: "column", gap: 10 }}>
        {messages.map((m, i) => (
          <div
            key={i}
            style={{
              alignSelf: m.role === "user" ? "flex-end" : "flex-start",
              maxWidth: "85%",
              padding: "10px 14px",
              borderRadius: 14,
              fontSize: 12.5,
              lineHeight: 1.5,
              background:
                m.role === "user"
                  ? "linear-gradient(135deg, #0284c7, #2563eb)"
                  : "rgba(255,255,255,0.06)",
              border: m.role === "user" ? "none" : "1px solid rgba(255,255,255,0.08)",
              color: "#f8fafc",
              wordBreak: "break-word",
              whiteSpace: "pre-wrap",
            }}
          >
            {m.content}
          </div>
        ))}
        {streaming && (
          <div
            style={{
              alignSelf: "flex-start",
              maxWidth: "85%",
              padding: "10px 14px",
              borderRadius: 14,
              fontSize: 12.5,
              lineHeight: 1.5,
              background: "rgba(255,255,255,0.06)",
              border: "1px solid rgba(6,182,212,0.3)",
              color: "#f8fafc",
              whiteSpace: "pre-wrap",
            }}
          >
            {streaming}
          </div>
        )}
        {loading && !streaming && (
          <div style={{ color: "#22d3ee", fontSize: 11, paddingLeft: 6 }}>AI ভাবছে...</div>
        )}
        <div ref={messagesEnd} />
      </div>

      {/* Quick Prompts */}
      <div
        style={{
          display: "flex",
          gap: 6,
          overflowX: "auto",
          padding: "6px 12px",
          borderTop: "1px solid rgba(255,255,255,0.05)",
          background: "rgba(0,0,0,0.2)",
        }}
      >
        {QUICK_PROMPTS.map((q) => (
          <button
            key={q}
            onClick={() => sendMessage(q)}
            aria-label={`Send quick prompt: ${q}`}
            style={{
              whiteSpace: "nowrap",
              fontSize: 11,
              padding: "4px 10px",
              borderRadius: 999,
              background: "rgba(6,182,212,0.1)",
              border: "1px solid rgba(6,182,212,0.25)",
              color: "#67e8f9",
              cursor: "pointer",
            }}
          >
            {q}
          </button>
        ))}
      </div>

      {/* Input */}
      <div
        style={{
          padding: 10,
          borderTop: "1px solid rgba(255,255,255,0.08)",
          display: "flex",
          gap: 8,
          alignItems: "center",
        }}
      >
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && sendMessage(input)}
          placeholder="প্রশ্ন লিখুন..."
          style={{
            flex: 1,
            padding: "9px 12px",
            borderRadius: 10,
            background: "rgba(0,0,0,0.4)",
            border: "1px solid rgba(255,255,255,0.12)",
            color: "white",
            fontSize: 12.5,
            outline: "none",
          }}
        />
        <button
          onClick={() => sendMessage(input)}
          disabled={loading || !input.trim()}
          aria-label="Send message to ZYRAXON AI Help"
          style={{
            padding: "9px 16px",
            borderRadius: 10,
            background: "linear-gradient(135deg, #06b6d4, #a855f7)",
            color: "#03060f",
            fontWeight: 700,
            fontSize: 12,
            border: "none",
            cursor: "pointer",
            opacity: loading || !input.trim() ? 0.5 : 1,
          }}
        >
          পাঠান
        </button>
      </div>
    </div>
  );
}
