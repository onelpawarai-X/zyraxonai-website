import { useCallback, useEffect, useRef, useState } from "react";
import Markdown from "@/components/site/Markdown";
import SpeakButton from "@/components/site/SpeakButton";

/** One line of the helper's stream. The route sends newline-delimited JSON so
 *  the browser can show "thinking" and tool use before the answer starts. */
type HelperEvent =
  | { type: "thinking"; model: string; round: number }
  | { type: "tool"; name: string }
  | { type: "rotating"; model: string }
  | { type: "delta"; text: string }
  | { type: "answer"; text: string; model?: string }
  | { type: "done" };

type Msg = { role: "user" | "assistant"; content: string; timestamp: number };

const QUICK_PROMPTS = [
  "How do I download ZYRAXON?",
  "How do I use the provider from my app?",
  "What tools does the agent have?",
  "Is it free? What is the licence?",
];

const TOOL_LABEL: Record<string, string> = {
  search_web: "Searching the web",
  fetch_page: "Reading a page",
};

export default function HelpAgent() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [live, setLive] = useState("");
  const endRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const scrollToBottom = useCallback(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, []);

  useEffect(() => {
    if (open) scrollToBottom();
  }, [messages, status, live, open, scrollToBottom]);

  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

  const send = useCallback(
    async (text: string) => {
      const question = text.trim();
      if (!question || busy) return;

      const history = messages.slice(-8).map((m) => ({ role: m.role, content: m.content }));
      setMessages((prev) => [...prev, { role: "user", content: question, timestamp: Date.now() }]);
      setInput("");
      setBusy(true);
      setStatus("Thinking");
      setLive("");

      try {
        const res = await fetch("/api/public/zyraxon/helper", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ message: question, history }),
        });
        if (!res.ok || !res.body) throw new Error(`HTTP ${res.status}`);

        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";
        let answer = "";

        // The route streams newline-delimited JSON. A blank line is a keepalive.
        for (;;) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop() ?? "";
          for (const raw of lines) {
            const line = raw.trim();
            if (!line) continue;
            let event: HelperEvent;
            try {
              event = JSON.parse(line);
            } catch {
              continue;
            }
            if (event.type === "thinking") {
              setStatus(event.round > 0 ? "Looking into it" : "Thinking");
            } else if (event.type === "tool") {
              setStatus(TOOL_LABEL[event.name] ?? "Working");
            } else if (event.type === "rotating") {
              setStatus("Switching model");
            } else if (event.type === "delta") {
              setStatus(null);
              setLive((prev) => prev + event.text);
            } else if (event.type === "answer") {
              answer = event.text;
              setStatus(null);
            }
          }
        }

        setMessages((prev) => [
          ...prev,
          {
            role: "assistant",
            content: answer || "I could not reach a model just now. Please try again.",
            timestamp: Date.now(),
          },
        ]);
        setLive("");
      } catch {
        setMessages((prev) => [
          ...prev,
          {
            role: "assistant",
            content:
              "That did not go through. Please try again — or read the docs at /docs, and the source is at github.com/onelpawarai-X/ZYRAXON-AI.",
            timestamp: Date.now(),
          },
        ]);
      } finally {
        setBusy(false);
        setStatus(null);
        setLive("");
      }
    },
    [busy, messages],
  );

  return (
    <>
      {/* Launcher */}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label={open ? "Close the ZYRAXON helper" : "Open the ZYRAXON helper"}
        aria-expanded={open}
        className="zx-chip zx-sheen fixed bottom-5 left-5 z-[9999] flex h-12 items-center gap-2.5 rounded-full px-4 text-[13px] font-semibold text-foreground shadow-lg sm:bottom-6 sm:left-6"
      >
        <span className="relative flex h-2.5 w-2.5">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-70" />
          <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-emerald-500" />
        </span>
        {open ? "Close" : "Ask ZYRAXON"}
      </button>

      {open && (
        <div
          role="dialog"
          aria-label="ZYRAXON helper"
          className="fixed bottom-20 left-5 z-[9999] flex w-[min(420px,calc(100vw-2.5rem))] flex-col overflow-hidden rounded-2xl border border-border/60 bg-background/95 shadow-2xl backdrop-blur-xl sm:bottom-24 sm:left-6"
          style={{ height: "min(620px, calc(100vh - 8rem))" }}
        >
          {/* Header */}
          <div className="flex items-center gap-3 border-b border-border/60 bg-gradient-to-r from-primary/12 to-transparent px-4 py-3">
            <span className="grid h-8 w-8 place-items-center rounded-lg bg-primary/15 text-primary">
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <path d="M12 3l1.9 5.6L19.5 10l-5.6 1.9L12 17.5l-1.9-5.6L4.5 10l5.6-1.4z" />
              </svg>
            </span>
            <div className="min-w-0">
              <p className="text-[13px] font-bold tracking-tight text-foreground">ZYRAXON Helper</p>
              <p className="truncate text-[11px] text-muted-foreground">
                Knows every page here · can search the web
              </p>
            </div>
            <button
              type="button"
              onClick={() => setMessages([])}
              className="ml-auto rounded-md px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-muted-foreground transition-colors hover:bg-foreground/5 hover:text-foreground"
            >
              Clear
            </button>
          </div>

          {/* Body */}
          <div className="flex-1 space-y-3 overflow-y-auto px-4 py-4">
            {messages.length === 0 && (
              <div>
                <p className="text-[13px] leading-relaxed text-muted-foreground">
                  Ask about ZYRAXON — what it does, how to install it, how to connect the provider
                  from your own app, or anything on this site.
                </p>
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {QUICK_PROMPTS.map((q) => (
                    <button
                      key={q}
                      type="button"
                      onClick={() => send(q)}
                      className="rounded-full border border-border/60 px-3 py-1.5 text-[12px] font-medium text-foreground transition-colors hover:bg-foreground/5"
                    >
                      {q}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {messages.map((m) => (
              <div
                key={m.timestamp}
                className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}
              >
                {m.role === "user" ? (
                  <div className="max-w-[88%] whitespace-pre-wrap rounded-2xl bg-primary px-3.5 py-2.5 text-[13px] leading-relaxed text-primary-foreground">
                    {m.content}
                  </div>
                ) : (
                  <div className="max-w-[92%] rounded-2xl bg-foreground/5 px-3.5 py-2.5 text-[13px] leading-relaxed text-foreground">
                    <Markdown text={m.content} />
                    <div className="mt-1.5 border-t border-border/40 pt-1.5">
                      <SpeakButton text={m.content} />
                    </div>
                  </div>
                )}
              </div>
            ))}

            {status && (
              <div className="flex items-center gap-2 text-[12px] text-muted-foreground">
                <span className="flex gap-1">
                  <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-primary [animation-delay:-0.2s]" />
                  <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-primary [animation-delay:-0.1s]" />
                  <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-primary" />
                </span>
                {status}…
              </div>
            )}

            {live && (
              <div className="flex justify-start">
                <div className="max-w-[92%] rounded-2xl bg-foreground/5 px-3.5 py-2.5 text-[13px] leading-relaxed text-foreground">
                  <Markdown text={live} />
                </div>
              </div>
            )}

            <div ref={endRef} />
          </div>

          {/* Composer */}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              send(input);
            }}
            className="flex items-end gap-2 border-t border-border/60 px-3 py-3"
          >
            <textarea
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  send(input);
                }
              }}
              rows={1}
              placeholder="Ask anything about ZYRAXON…"
              className="max-h-28 min-h-[42px] flex-1 resize-none rounded-xl border border-border/60 bg-transparent px-3 py-2.5 text-[13px] text-foreground outline-none placeholder:text-muted-foreground focus:border-primary/60"
            />
            <button
              type="submit"
              disabled={busy || !input.trim()}
              className="grid h-[42px] w-[42px] shrink-0 place-items-center rounded-xl bg-primary text-primary-foreground transition-opacity disabled:opacity-40"
              aria-label="Send"
            >
              <svg
                width="17"
                height="17"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.2"
              >
                <path d="M5 12h14M13 6l6 6-6 6" />
              </svg>
            </button>
          </form>
        </div>
      )}
    </>
  );
}
