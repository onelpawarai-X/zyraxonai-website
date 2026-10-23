import { useMemo, useRef, useState } from "react";
import { MAX_MEDIA_PARTS } from "@/lib/providers/media";
import {
  prepareAttachment,
  type PreparedAttachment,
} from "@/lib/providers/video-compress.client";

type Model = { id: string; name: string; note: string };
type Files = Record<string, string>;

const MODELS: Model[] = [
  { id: "mimo-v2.6-flash-free", name: "ZYRAXON TITAN", note: "Balanced builder" },
  { id: "nemotron-3-ultra-free", name: "ZYRAXON NEXUS", note: "Deep reasoning" },
  { id: "big-pickle", name: "ZYRAXON OMEGA", note: "Fast generation" },
];
const STARTER: Files = {
  "index.html":
    '<!doctype html>\n<html>\n<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>ZYRAXON</title></head>\n<body><main><h1>Start building.</h1><p>Tell ZYRAXON what you want to create.</p></main></body>\n</html>',
};
const uid = () => `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

function parseFiles(text: string, previous: Files) {
  const next = { ...previous };
  const re = /```(?:[\w.+-]+)?\s*\n?([\s\S]*?)(?:```|$)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text))) {
    const block = m[1].trim();
    const marker = block.match(
      /^(?:<!--|\/\*|\/\/|#)\s*file:\s*([^\n]+?)(?:\s*-->|\s*\*\/)?\s*\n/i,
    );
    if (!marker) continue;
    const name = marker[1].trim();
    const body = block.slice(marker[0].length).trim();
    if (name && body) next[name] = body;
  }
  return next;
}
function makePreview(files: Files) {
  let html = files["index.html"] || STARTER["index.html"];
  const css = Object.entries(files)
    .filter(([k]) => /\.(css|scss)$/i.test(k))
    .map(([, v]) => v)
    .join("\n");
  const js = Object.entries(files)
    .filter(([k]) => /\.(js|jsx|ts|tsx)$/i.test(k))
    .map(([, v]) => v)
    .join("\n");
  if (css && !/<style/i.test(html))
    html = html.replace(/<\/head>/i, `<style>${css}</style></head>`);
  if (js && !/<script/i.test(html))
    html = html.replace(/<\/body>/i, `<script>${js}</script></body>`);
  return html;
}
async function streamSse(response: Response, onText: (text: string) => void) {
  const reader = response.body?.getReader();
  if (!reader) throw new Error("Streaming unavailable");
  const decoder = new TextDecoder();
  let buffer = "";
  let full = "";
  const consume = (line: string) => {
    const p = line.trim().replace(/^data:\s?/, "");
    if (!p || p === "[DONE]") return;
    try {
      const j = JSON.parse(p);
      const d = j?.choices?.[0]?.delta?.content ?? j?.choices?.[0]?.message?.content ?? "";
      if (typeof d === "string" && d) {
        full += d;
        onText(full);
      }
    } catch {
      /* ignored */
    }
  };
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split(/\r?\n/);
    buffer = lines.pop() || "";
    lines.forEach(consume);
  }
  if (buffer.trim()) consume(buffer);
  return full;
}
const SYSTEM = `You are ZYRAXON AI Bludar. Build and modify websites efficiently. When files are needed, output every changed file exactly once in a fenced code block and put a filename marker on the first line, for example <!-- file: index.html --> or /* file: styles.css */. Keep explanations brief. Preserve existing files unless requested. Produce polished responsive UI.`;

export default function BludarPage() {
  const [model, setModel] = useState(MODELS[0].id),
    [mode, setMode] = useState<"bolt" | "plan">("bolt"),
    [input, setInput] = useState(""),
    [messages, setMessages] = useState<{ id: string; role: "user" | "assistant"; text: string }[]>(
      [],
    ),
    [files, setFiles] = useState<Files>(STARTER),
    [activeFile, setActiveFile] = useState("index.html"),
    [view, setView] = useState<"preview" | "code">("preview"),
    [device, setDevice] = useState<"desktop" | "tablet" | "mobile">("desktop"),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [theme, setTheme] = useState<"dark" | "light">("dark"),
    [attachments, setAttachments] = useState<PreparedAttachment[]>([]),
    [notes, setNotes] = useState<string[]>([]);
  const fileRef = useRef<HTMLInputElement>(null);
  const current = MODELS.find((m) => m.id === model) || MODELS[0];
  const preview = useMemo(() => makePreview(files), [files]);

  /** Prepare a picked file on the client. Video is compressed and, if still
   *  oversized, sliced; audio is transcoded and sliced; PDFs pass through. Doing
   *  this here means a one-hour recording becomes a handful of model-sized parts
   *  instead of a request the server must reject.
   *
   *  The retained set is bounded by MAX_MEDIA_PARTS — the same constant the
   *  server enforces — so the parts ffmpeg produced are the parts that get sent.
   *  A tighter local cap here is what silently dropped the tail of a long video. */
  const attach = async (picked: FileList | null) => {
    if (!picked?.length) return;
    setError("");
    setNotes([]);
    const prepared: PreparedAttachment[] = [];
    const said: string[] = [];
    for (const file of Array.from(picked).slice(0, 4)) {
      const out = await prepareAttachment(file, { onLog: () => {} });
      prepared.push(...out.attachments);
      said.push(...out.notes);
    }
    const kept = prepared.slice(0, MAX_MEDIA_PARTS);
    if (kept.length < prepared.length) {
      said.push(`Only the first ${kept.length} of ${prepared.length} parts were kept — that is the per-message limit.`);
    }
    setAttachments((a) => [...a, ...kept].slice(0, MAX_MEDIA_PARTS));
    setNotes(said);
  };
  const send = async () => {
    const text = input.trim();
    if (!text || busy) return;
    setInput("");
    const sent = attachments;
    setAttachments([]);
    setNotes([]);
    setError("");
    setBusy(true);
    const id = uid();
    setMessages((m) => [
      ...m,
      { id: uid(), role: "user", text },
      { id, role: "assistant", text: "" },
    ]);
    try {
      const context = messages.slice(-10).map((m) => ({ role: m.role, content: m.text }));
      const r = await fetch("/api/public/builder/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model,
          attachments: sent,
          messages: [
            {
              role: "system",
              content: mode === "plan" ? SYSTEM + " Planning only; do not change files." : SYSTEM,
            },
            ...context,
            { role: "user", content: text },
          ],
        }),
      });
      if (!r.ok) {
        const d = await r.json().catch(() => null);
        throw new Error(d?.error || `Provider returned HTTP ${r.status}`);
      }
      let live = files;
      await streamSse(r, (full) => {
        setMessages((m) => m.map((x) => (x.id === id ? { ...x, text: full } : x)));
        if (mode === "bolt") {
          const parsed = parseFiles(full, live);
          if (JSON.stringify(parsed) !== JSON.stringify(live)) {
            live = parsed;
            setFiles(parsed);
            setActiveFile(Object.keys(parsed).at(-1) || "index.html");
          }
        }
      });
    } catch (e: any) {
      const msg = e?.message || "Generation failed";
      setError(msg);
      setMessages((m) => m.map((x) => (x.id === id ? { ...x, text: msg } : x)));
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className={`bludar-v2 ${theme}`}>
      <style>{CSS}</style>
      <header className="b2-nav">
        <a href="/" className="b2-brand">
          <span className="b2-logo">Z</span>
          <span>
            <strong>ZYRAXON</strong>
            <small>AI BLUDAR</small>
          </span>
        </a>
        <div className="b2-title">
          <i /> Builder Studio <b>LIVE</b>
        </div>
        <div className="b2-actions">
          <button onClick={() => setTheme((t) => (t === "dark" ? "light" : "dark"))}>
            {theme === "dark" ? "☼" : "☾"}
          </button>
          <a href="/ecosystem">◈ Ecosystem</a>
        </div>
      </header>
      <main className="b2-grid">
        <section className="b2-chat">
          <div className="chat-head">
            <div>
              <small>AI PRODUCT</small>
              <h1>Build without limits.</h1>
            </div>
            <span>
              <i /> Ready
            </span>
          </div>
          <div className="messages">
            {!messages.length && (
              <div className="hero">
                <div className="orb">✦</div>
                <h2>What are you building?</h2>
                <p>
                  Describe a website, dashboard, landing page or app. ZYRAXON builds it live in the
                  studio.
                </p>
                <div className="quick">
                  <button onClick={() => setInput("Build a premium AI SaaS landing page")}>
                    ✦ AI SaaS
                  </button>
                  <button onClick={() => setInput("Build a developer portfolio")}>
                    ⌁ Portfolio
                  </button>
                  <button onClick={() => setInput("Build a luxury product website")}>
                    ◇ Product
                  </button>
                </div>
              </div>
            )}
            {messages.map((m) => (
              <article key={m.id}>
                <span className="avatar">{m.role === "assistant" ? "Z" : "YOU"}</span>
                <div>
                  <small>{m.role === "assistant" ? "ZYRAXON AI" : "YOU"}</small>
                  <p>{m.text || "Thinking…"}</p>
                </div>
              </article>
            ))}
            {error && <div className="error">⚠ {error}</div>}
          </div>
          <div className="composer">
            {(attachments.length > 0 || notes.length > 0) && (
              <div className="chips">
                {attachments.map((a, i) => (
                  <span key={`${a.name}-${i}`} className="chip" title={a.mime}>
                    {a.mime.startsWith("video/") ? "🎬" : a.mime.startsWith("audio/") ? "🎵" : "🖼"}{" "}
                    {a.name}
                  </span>
                ))}
                {notes.map((n, i) => (
                  <span key={`n-${i}`} className="chip note">
                    {n}
                  </span>
                ))}
              </div>
            )}
            <textarea
              value={input}
              placeholder={
                mode === "plan"
                  ? "Describe what you want planned…"
                  : "Ask ZYRAXON to build, change or fix…"
              }
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  send();
                }
              }}
            />
            <div className="composer-row">
              <input
                ref={fileRef}
                type="file"
                accept="image/*,audio/*,video/*,application/pdf"
                multiple
                hidden
                onChange={(e) => {
                  void attach(e.target.files);
                  e.target.value = "";
                }}
              />
              <button
                className="mode"
                onClick={() => fileRef.current?.click()}
                title="Attach image, audio, video or PDF"
              >
                📎
              </button>
              <span className="line" />
              <button
                className={`mode ${mode}`}
                onClick={() => setMode((m) => (m === "bolt" ? "plan" : "bolt"))}
              >
                {mode === "bolt" ? "⚡ Bolt" : "◫ Plan"}
              </button>
              <span className="line" />
              <label className="model">
                <span>✦</span>
                <select
                  value={model}
                  onChange={(e) => setModel(e.target.value)}
                  aria-label="AI model"
                >
                  {MODELS.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.name} · {m.note}
                    </option>
                  ))}
                </select>
                <b>⌄</b>
              </label>
              <button className="send" disabled={busy || !input.trim()} onClick={send}>
                {busy ? <i /> : "↑"}
              </button>
            </div>
            <small className="hint">
              Enter to send · Shift + Enter for a new line · model switching is instant
            </small>
          </div>
        </section>
        <section className="b2-studio">
          <div className="toolbar">
            <div>
              <button
                className={view === "preview" ? "active" : ""}
                onClick={() => setView("preview")}
              >
                ◉ Preview
              </button>
              <button className={view === "code" ? "active" : ""} onClick={() => setView("code")}>
                &lt;/&gt; Code
              </button>
            </div>
            <div>
              <button
                className={device === "desktop" ? "active" : ""}
                onClick={() => setDevice("desktop")}
              >
                ▱
              </button>
              <button
                className={device === "tablet" ? "active" : ""}
                onClick={() => setDevice("tablet")}
              >
                ▯
              </button>
              <button
                className={device === "mobile" ? "active" : ""}
                onClick={() => setDevice("mobile")}
              >
                ▯
              </button>
            </div>
          </div>
          {view === "preview" ? (
            <div className="preview-area">
              <div className={`preview ${device}`}>
                <div className="preview-top">
                  <span />
                  <span />
                  <span />
                  <small>Live Preview · {current.name}</small>
                </div>
                <iframe title="Live preview" sandbox="allow-scripts allow-forms" srcDoc={preview} />
              </div>
            </div>
          ) : (
            <div className="code">
              <aside>
                <small>
                  FILES <b>{Object.keys(files).length}</b>
                </small>
                {Object.keys(files).map((n) => (
                  <button
                    key={n}
                    className={activeFile === n ? "active" : ""}
                    onClick={() => setActiveFile(n)}
                  >
                    <span>
                      {n.endsWith(".html")
                        ? "◇"
                        : n.endsWith(".css")
                          ? "#"
                          : n.endsWith(".js")
                            ? "JS"
                            : "•"}
                    </span>
                    {n}
                  </button>
                ))}
              </aside>
              <div className="editor">
                <header>
                  {activeFile}
                  <small>{(files[activeFile] || "").split("\n").length} lines</small>
                </header>
                <textarea
                  value={files[activeFile] || ""}
                  onChange={(e) => setFiles((f) => ({ ...f, [activeFile]: e.target.value }))}
                  spellCheck={false}
                />
              </div>
            </div>
          )}
        </section>
      </main>
    </div>
  );
}

const CSS = `*{box-sizing:border-box}.bludar-v2{min-height:100vh;height:100vh;overflow:hidden;font-family:Inter,ui-sans-serif,system-ui,sans-serif;background:#06070b;color:#f7f7fb;--panel:rgba(12,14,20,.9);--line:rgba(255,255,255,.1);--muted:#8c91a3;--accent:#8b6cff}.bludar-v2.light{background:#f3f5f9;color:#14161d;--panel:rgba(255,255,255,.92);--line:rgba(0,0,0,.1);--muted:#687080}.b2-nav{height:66px;display:flex;align-items:center;justify-content:space-between;padding:0 22px;border-bottom:1px solid var(--line);background:var(--panel);backdrop-filter:blur(22px);position:relative;z-index:10}.b2-brand{display:flex;align-items:center;gap:10px;color:inherit;text-decoration:none}.b2-brand strong{display:block;font-size:12px;letter-spacing:.16em}.b2-brand small{display:block;color:var(--muted);font-size:8px;letter-spacing:.22em}.b2-logo{width:35px;height:35px;border-radius:11px;display:grid;place-items:center;background:linear-gradient(145deg,#a286ff,#5030bd);box-shadow:0 0 30px rgba(139,108,255,.35);font-weight:900}.b2-title{font-size:11px;color:var(--muted)}.b2-title i,.chat-head>span i{display:inline-block;width:7px;height:7px;border-radius:50%;background:#62e6a0;box-shadow:0 0 12px #62e6a0;margin-right:7px;animation:pulse 2s infinite}.b2-title b{font-size:8px;color:#65e7a0;margin-left:7px}.b2-actions{display:flex;gap:7px}.b2-actions button,.b2-actions a{border:1px solid var(--line);background:rgba(255,255,255,.04);color:inherit;border-radius:9px;padding:8px 11px;text-decoration:none;cursor:pointer}.b2-grid{height:calc(100vh - 66px);display:grid;grid-template-columns:minmax(380px,43%) 1fr;gap:10px;padding:10px}.b2-chat,.b2-studio{min-height:0;border:1px solid var(--line);background:var(--panel);border-radius:17px;overflow:hidden;box-shadow:0 24px 80px rgba(0,0,0,.28);backdrop-filter:blur(20px)}.b2-chat{display:flex;flex-direction:column}.chat-head{padding:22px 23px 14px;display:flex;justify-content:space-between}.chat-head>div>small{font-size:8px;letter-spacing:.2em;color:#a795ff}.chat-head h1{margin:5px 0 0;font-size:23px;letter-spacing:-.04em}.chat-head>span{font-size:10px;color:var(--muted)}.messages{flex:1;overflow:auto;padding:5px 22px 15px}.hero{text-align:center;padding:8vh 7% 25px;animation:rise .5s ease}.orb{width:70px;height:70px;margin:0 auto 20px;border-radius:22px;display:grid;place-items:center;font-size:28px;background:radial-gradient(circle at 35% 25%,#bbaaff,#5d3bd1);box-shadow:0 0 60px rgba(139,108,255,.28);animation:float 4s ease-in-out infinite}.hero h2{font-size:26px;margin:0 0 9px;letter-spacing:-.05em}.hero p{max-width:410px;margin:auto;color:var(--muted);font-size:12px;line-height:1.7}.quick{display:flex;gap:7px;justify-content:center;flex-wrap:wrap;margin-top:22px}.quick button{border:1px solid var(--line);background:rgba(255,255,255,.035);color:inherit;border-radius:10px;padding:9px 11px;cursor:pointer;transition:.18s}.quick button:hover{transform:translateY(-2px);border-color:rgba(139,108,255,.45);background:rgba(139,108,255,.08)}article{display:flex;gap:9px;padding:13px 0;border-bottom:1px solid rgba(255,255,255,.055);animation:rise .25s ease}.avatar{flex:0 0 28px;height:28px;border-radius:9px;display:grid;place-items:center;background:rgba(139,108,255,.13);color:#b8aaff;font-size:8px;font-weight:800}article small{color:var(--muted);font-size:8px;letter-spacing:.12em}article p{white-space:pre-wrap;margin:5px 0 0;font-size:12px;line-height:1.6}.error{margin:10px 0;padding:10px;border:1px solid rgba(255,90,90,.25);border-radius:9px;color:#ffaaa8;font-size:11px}.composer{margin:0 15px 14px;border:1px solid var(--line);border-radius:14px;padding:11px;background:rgba(255,255,255,.035)}.composer textarea{width:100%;min-height:65px;resize:none;border:0;outline:0;background:transparent;color:inherit;font:12px/1.55 inherit}.composer-row{display:flex;align-items:center;gap:7px}.mode,.model{height:34px;border:1px solid var(--line);border-radius:9px;background:rgba(255,255,255,.045);color:inherit;display:flex;align-items:center;padding:0 9px;font-size:10px}.mode{cursor:pointer}.line{width:1px;height:17px;background:var(--line)}.model{min-width:0;flex:1;max-width:290px}.model select{appearance:none;border:0;outline:0;background:transparent;color:inherit;min-width:0;flex:1;font-size:10px;cursor:pointer}.model select option{background:#12141c;color:#fff}.model b{font-size:10px}.send{margin-left:auto;width:35px;height:35px;border:0;border-radius:9px;background:linear-gradient(135deg,#9c7cff,#5b38d4);color:#fff;cursor:pointer;font-size:16px;box-shadow:0 8px 24px rgba(95,58,210,.25)}.send:disabled{opacity:.3}.send i{display:block;width:12px;height:12px;margin:auto;border:2px solid rgba(255,255,255,.35);border-top-color:#fff;border-radius:50%;animation:spin .7s linear infinite}.chips{display:flex;gap:6px;flex-wrap:wrap;margin-bottom:9px}.chip{display:inline-flex;align-items:center;gap:5px;max-width:220px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;border:1px solid rgba(139,108,255,.28);background:rgba(139,108,255,.1);color:#c9bfff;border-radius:8px;padding:4px 8px;font-size:9px}.chip.note{border-color:var(--line);background:rgba(255,255,255,.04);color:var(--muted);max-width:none;white-space:normal}.hint{display:block;color:var(--muted);font-size:8px;margin-top:7px}.b2-studio{display:flex;flex-direction:column}.toolbar{height:53px;display:flex;justify-content:space-between;align-items:center;padding:0 11px;border-bottom:1px solid var(--line)}.toolbar>div{display:flex;gap:3px}.toolbar button{border:1px solid transparent;background:transparent;color:var(--muted);border-radius:8px;padding:8px 10px;cursor:pointer;transition:.18s}.toolbar button.active{background:rgba(139,108,255,.12);border-color:rgba(139,108,255,.25);color:#c9bfff}.preview-area{flex:1;min-height:0;padding:18px;display:grid;place-items:center;background:radial-gradient(circle at 50% 15%,rgba(139,108,255,.07),transparent 45%)}.preview{width:100%;height:100%;border:1px solid var(--line);border-radius:13px;overflow:hidden;background:#fff;transition:width .25s ease}.preview.tablet{width:72%}.preview.mobile{width:390px;max-width:80%}.preview-top{height:29px;background:#11131a;display:flex;align-items:center;padding:0 9px;gap:5px}.preview-top span{width:6px;height:6px;border-radius:50%;background:#555}.preview-top small{color:#777;font-size:8px;margin-left:7px}.preview iframe{width:100%;height:calc(100% - 29px);border:0;display:block}.code{flex:1;min-height:0;display:grid;grid-template-columns:205px 1fr}.code aside{border-right:1px solid var(--line);padding:11px}.code aside>small{display:block;padding:7px;color:var(--muted);font-size:8px;letter-spacing:.15em}.code aside>small b{float:right}.code aside button{width:100%;text-align:left;border:0;background:transparent;color:var(--muted);padding:9px;border-radius:8px;cursor:pointer;font-size:10px}.code aside button.active,.code aside button:hover{background:rgba(139,108,255,.1);color:#c9bfff}.code aside button span{display:inline-block;width:27px;color:#a692ff}.editor{display:flex;flex-direction:column;min-width:0}.editor header{height:38px;border-bottom:1px solid var(--line);padding:0 12px;display:flex;align-items:center;justify-content:space-between;font-size:10px}.editor header small{color:var(--muted)}.editor textarea{flex:1;resize:none;border:0;outline:0;background:#090a0e;color:#d9dded;padding:17px;font:12px/1.65 ui-monospace,SFMono-Regular,Consolas,monospace}.light .editor textarea{background:#fafafa;color:#20242c}@keyframes pulse{50%{opacity:.35}}@keyframes spin{to{transform:rotate(360deg)}}@keyframes rise{from{opacity:0;transform:translateY(7px)}to{opacity:1;transform:none}}@keyframes float{50%{transform:translateY(-5px)}}@media(max-width:980px){.bludar-v2{height:auto;min-height:100vh;overflow:auto}.b2-grid{height:auto;min-height:calc(100vh - 66px);grid-template-columns:1fr}.b2-chat{min-height:620px}.b2-studio{min-height:620px}.b2-title{display:none}}@media(max-width:600px){.b2-nav{padding:0 12px}.b2-actions a{display:none}.b2-grid{padding:6px}.hero{padding-top:45px}.model{max-width:220px}.code{grid-template-columns:145px 1fr}}
`;
