import { useCallback, useEffect, useMemo, useRef, useState } from "react";

type Role = "user" | "assistant";
type Theme = "dark" | "light";
type Device = "desktop" | "tablet" | "mobile";
type FileName = "index.html" | "styles.css" | "script.js";
type Source = { title: string; url: string; snippet?: string };
type Activity = { id: string; label: string; detail?: string; state: "running" | "done" | "error" };
type Message = { id: string; role: Role; content: string; sources?: Source[] };

const MODELS = [
  { id: "mimo-v2.5-free", name: "MiMo V2.5 Free", note: "Balanced builder" },
  { id: "nemotron-3-super-free", name: "Nemotron 3 Super Free", note: "Deep reasoning" },
  { id: "big-pickle", name: "Big Pickle", note: "Fast generation" },
];
const STARTER = `<!doctype html><html><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>ZYRAXON</title><style>body{margin:0;font-family:Inter,system-ui;background:#090b12;color:white;display:grid;place-items:center;min-height:100vh}main{text-align:center;max-width:760px;padding:40px}h1{font-size:clamp(42px,7vw,82px);letter-spacing:-.06em;margin:0 0 18px}p{color:#9aa1b2;font-size:18px;line-height:1.7}</style></head><body><main><h1>Start with an idea.</h1><p>Describe the website you want ZYRAXON AI to build.</p></main></body></html>`;
const uid = (p: string) => `${p}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

function extractHtml(text: string) {
  const m = text.match(/```(?:html)?\s*([\s\S]*?)```/i);
  const h = m?.[1]?.trim() || (text.includes("<html") ? text.trim() : "");
  return h.includes("<html") ? h : "";
}
function parts(text: string) {
  const out: { code: boolean; lang?: string; value: string }[] = [];
  const re = /```([\w-]+)?\s*([\s\S]*?)```/g;
  let last = 0,
    m: RegExpExecArray | null;
  while ((m = re.exec(text))) {
    if (m.index > last) out.push({ code: false, value: text.slice(last, m.index).trim() });
    out.push({ code: true, lang: m[1] || "text", value: m[2].trimEnd() });
    last = re.lastIndex;
  }
  if (last < text.length) out.push({ code: false, value: text.slice(last).trim() });
  return out.filter((x) => x.value);
}
function previewDoc(html: string) {
  const bridge = `<script>(function(){function internal(h){h=String(h||'').trim();return h&&!/^([a-z][a-z0-9+.-]*:)?\\/\\//i.test(h)&&!/^[a-z][a-z0-9+.-]*:/i.test(h)}document.addEventListener('click',function(e){var a=e.target&&e.target.closest?e.target.closest('a[href]'):null;if(!a)return;var h=a.getAttribute('href')||'';if(internal(h)){e.preventDefault();var u=new URL(h,'https://preview.local/');history.pushState({},'', '#preview-route='+encodeURIComponent(u.pathname+u.search+u.hash));window.dispatchEvent(new CustomEvent('zyraxon-preview-route',{detail:{path:u.pathname+u.search+u.hash}}));}},true);document.addEventListener('submit',function(e){var f=e.target;if(!f||!f.action)return;var a=String(f.action);if(!/^([a-z][a-z0-9+.-]*:)?\\/\\//i.test(a)){e.preventDefault();window.dispatchEvent(new CustomEvent('zyraxon-preview-form',{detail:{action:a,method:(f.method||'get').toUpperCase()}}));}},true);window.addEventListener('error',function(e){try{parent.postMessage({source:'zyraxon-preview',type:'error',message:e.message},'*')}catch(_){ /* ignored */} });})();</script>`;
  return /<\/body>/i.test(html) ? html.replace(/<\/body>/i, bridge + "</body>") : html + bridge;
}
async function streamSse(r: Response, onDelta: (s: string) => void) {
  const reader = r.body?.getReader();
  if (!reader) throw Error("Streaming is unavailable from this provider.");
  const d = new TextDecoder();
  let b = "",
    full = "";
  const consume = (line: string) => {
    const p = line.trim().replace(/^data:\s?/, "");
    if (!p || p === "[DONE]") return;
    try {
      const j = JSON.parse(p);
      const x = j?.choices?.[0]?.delta?.content ?? j?.choices?.[0]?.message?.content ?? "";
      if (typeof x === "string" && x) {
        full += x;
        onDelta(full);
      }
    } catch {
      /* ignored */
    }
  };
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    b += d.decode(value, { stream: true });
    const ls = b.split(/\r?\n/);
    b = ls.pop() || "";
    ls.forEach(consume);
  }
  if (b.trim()) consume(b);
  return full;
}

export default function BuilderStudio() {
  const [theme, setTheme] = useState<Theme>("dark"),
    [messages, setMessages] = useState<Message[]>([]),
    [input, setInput] = useState(""),
    [model, setModel] = useState(MODELS[0].id),
    [html, setHtml] = useState(STARTER),
    [device, setDevice] = useState<Device>("desktop"),
    [codeOpen, setCodeOpen] = useState(false),
    [activityOpen, setActivityOpen] = useState(false),
    [modelOpen, setModelOpen] = useState(false),
    [searching, setSearching] = useState(false),
    [streaming, setStreaming] = useState(false),
    [error, setError] = useState(""),
    [split, setSplit] = useState(42),
    [activities, setActivities] = useState<Activity[]>([]),
    [githubToken, setGithubToken] = useState(""),
    [repo, setRepo] = useState(""),
    [publishOpen, setPublishOpen] = useState(false),
    [publishState, setPublishState] = useState(""),
    [activeFile, setActiveFile] = useState<FileName>("index.html"),
    [expanded, setExpanded] = useState(""),
    [previewNotice, setPreviewNotice] = useState("");
  const abortRef = useRef<AbortController | null>(null),
    dragRef = useRef(false),
    current = MODELS.find((m) => m.id === model) || MODELS[0],
    hasChat = messages.length > 0;
  const files = useMemo<Record<FileName, string>>(
    () => ({
      "index.html": html,
      "styles.css":
        html.match(/<style[^>]*>([\s\S]*?)<\/style>/i)?.[1]?.trim() ||
        "/* styles are embedded in index.html */",
      "script.js":
        html.match(/<script[^>]*>([\s\S]*?)<\/script>/i)?.[1]?.trim() || "// no JavaScript yet",
    }),
    [html],
  );
  useEffect(() => {
    try {
      const s = sessionStorage.getItem("zyraxon.builder.theme");
      if (s === "light" || s === "dark") setTheme(s);
    } catch {
      /* ignored */
    }
  }, []);
  useEffect(() => {
    try {
      sessionStorage.setItem("zyraxon.builder.theme", theme);
    } catch {
      /* ignored */
    }
  }, [theme]);
  useEffect(() => {
    const f = (e: MessageEvent) => {
      if (e.data?.source === "zyraxon-preview" && e.data.type === "error")
        setPreviewNotice(`Preview error: ${e.data.message}`);
    };
    window.addEventListener("message", f);
    return () => window.removeEventListener("message", f);
  }, []);
  const addActivity = (label: string, detail?: string) => {
    const a = { id: uid("activity"), label, detail, state: "running" as const };
    setActivities((x) => [...x, a]);
    return a.id;
  };
  const finish = (id: string, state: Activity["state"] = "done", detail?: string) =>
    setActivities((x) => x.map((a) => (a.id === id ? { ...a, state, detail } : a)));
  const searchWeb = useCallback(
    async (q: string) => {
      if (!q.trim() || searching) return [];
      setSearching(true);
      const id = addActivity("AI web research", q);
      try {
        const r = await fetch(`/api/public/builder/search?q=${encodeURIComponent(q)}`),
          d = await r.json();
        if (!r.ok) throw Error(d?.error || `Search failed (${r.status})`);
        const result = Array.isArray(d.results) ? (d.results as Source[]) : [];
        finish(id, "done", `${result.length} sources found`);
        return result;
      } catch (e: unknown) {
        finish(id, "error", e?.message || "Search failed");
        return [];
      } finally {
        setSearching(false);
      }
    },
    [searching],
  );
  const send = useCallback(async () => {
    const text = input.trim();
    if (!text || streaming) return;
    setInput("");
    setError("");
    setModelOpen(false);
    const userId = uid("user"),
      assistantId = uid("assistant"),
      context = messages.slice(-16).map((m) => ({ role: m.role, content: m.content }));
    setMessages((x) => [
      ...x,
      { id: userId, role: "user", content: text },
      { id: assistantId, role: "assistant", content: "" },
    ]);
    setStreaming(true);
    const c = new AbortController();
    abortRef.current = c;
    const a = addActivity("Connecting to model", current.name),
      s = addActivity("Streaming response", "Live SSE"),
      p = addActivity("Live preview", "Waiting for generated code");
    try {
      const wants =
          /\b(search|latest|current|today|news|research|source|reference|image|video|price|documentation|website|browse|find)\b/i.test(
            text,
          ),
        web = wants ? await searchWeb(text) : [];
      finish(a);
      let prompt = text;
      if (web.length)
        prompt += `\n\nUse these web sources when relevant:\n${web.map((x) => `- ${x.title}: ${x.url}${x.snippet ? ` — ${x.snippet}` : ""}`).join("\n")}`;
      const r = await fetch("/api/public/builder/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ model, messages: [...context, { role: "user", content: prompt }] }),
        signal: c.signal,
      });
      if (!r.ok) {
        const d = await r.json().catch(() => null);
        throw Error(d?.error || `Provider returned HTTP ${r.status}`);
      }
      let latest = "";
      await streamSse(r, (v) => {
        latest = v;
        setMessages((x) =>
          x.map((m) => (m.id === assistantId ? { ...m, content: v, sources: web } : m)),
        );
        const g = extractHtml(v);
        if (g) {
          setHtml(g);
          finish(p, "done", "Preview refreshed");
        }
      });
      finish(s, "done", "Stream complete");
      if (!latest) throw Error("The model returned an empty response. Try another model.");
    } catch (e: unknown) {
      if (e?.name !== "AbortError") {
        const msg = e?.message || "Generation failed.";
        setError(msg);
        finish(a, "error", msg);
        finish(s, "error", msg);
        finish(p, "error", "No preview update");
        setMessages((x) => x.filter((m) => m.id !== assistantId || m.content));
      }
    } finally {
      setStreaming(false);
      abortRef.current = null;
    }
  }, [input, streaming, messages, model, current.name, searchWeb]);
  const publish = async () => {
    if (!githubToken.trim() || !repo.trim()) {
      setPublishState("Enter your GitHub token and repository name.");
      return;
    }
    setPublishState("Publishing…");
    try {
      const name =
          repo
            .trim()
            .replace(/\.git$/, "")
            .split("/")
            .filter(Boolean)
            .at(-1) || repo.trim(),
        r = await fetch("/api/public/builder/publish", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ token: githubToken.trim(), repo: name, html }),
        }),
        d = await r.json();
      if (!r.ok || !d.ok) throw Error(d?.error || "GitHub publish failed");
      setPublishState(d.pagesUrl || d.repoUrl || "Published successfully.");
    } catch (e: unknown) {
      setPublishState(e?.message || "GitHub publish failed");
    }
  };
  const reset = () => {
    abortRef.current?.abort();
    setMessages([]);
    setHtml(STARTER);
    setActivities([]);
    setError("");
    setPreviewNotice("");
  };
  return (
    <div className={`zyraxon-builder ${theme}`}>
      <style>{CSS}</style>
      <header className="zb-topbar">
        <a className="zb-brand" href="/">
          <span className="zb-logo">
            <svg viewBox="0 0 40 40">
              <defs>
                <linearGradient id="zg">
                  <stop stopColor="#b99cff" />
                  <stop offset="1" stopColor="#65ead8" />
                </linearGradient>
              </defs>
              <path d="M9 12 20 7l11 5v16l-11 5-11-5z" fill="none" stroke="url(#zg)" />
              <path
                d="m14 20 4 4 8-9"
                fill="none"
                stroke="url(#zg)"
                strokeWidth="2"
                strokeLinecap="round"
              />
            </svg>
          </span>
          <b>ZYRAXON</b>
          <span>AI BUILDER</span>
        </a>
        <div className="zb-center">
          <button className={!codeOpen ? "active" : ""} onClick={() => setCodeOpen(false)}>
            Build
          </button>
          <button className={codeOpen ? "active" : ""} onClick={() => setCodeOpen(true)}>
            Code
          </button>
        </div>
        <div className="zb-actions">
          <button onClick={() => setTheme(theme === "dark" ? "light" : "dark")}>
            {theme === "dark" ? "☼" : "☾"}
          </button>
          <button onClick={() => setActivityOpen(!activityOpen)}>
            <i className={streaming ? "pulse" : ""} />
            Activity
          </button>
          <button onClick={() => setModelOpen(!modelOpen)}>{current.name}⌄</button>
          <button className="publish" onClick={() => setPublishOpen(true)}>
            Publish
          </button>
        </div>
        {modelOpen && (
          <div className="zb-models">
            <small>OPENCODE ZEN</small>
            {MODELS.map((m) => (
              <button
                key={m.id}
                className={m.id === model ? "selected" : ""}
                onClick={() => {
                  setModel(m.id);
                  setModelOpen(false);
                }}
              >
                <span>✦</span>
                <b>{m.name}</b>
                <em>{m.note}</em>
                {m.id === model && <strong>✓</strong>}
              </button>
            ))}
          </div>
        )}
      </header>
      <main className="zb-workspace">
        <section
          className={`zb-chat ${hasChat ? "with-chat" : ""}`}
          style={{ width: hasChat ? `${split}%` : "100%" }}
        >
          <div className="zb-chat-inner">
            {!hasChat && (
              <div className="zb-welcome">
                <div className="hero-logo">
                  <svg viewBox="0 0 80 80">
                    <circle cx="40" cy="40" r="32" fill="none" stroke="url(#zg2)" />
                    <path d="M25 40h30M40 25v30" stroke="url(#zg2)" />
                    <defs>
                      <linearGradient id="zg2">
                        <stop stopColor="#b99cff" />
                        <stop offset="1" stopColor="#65ead8" />
                      </linearGradient>
                    </defs>
                  </svg>
                </div>
                <h1>What will you build?</h1>
                <p>
                  Describe an idea. ZYRAXON builds, researches when needed, streams its work and
                  keeps the generated site inside a protected live preview.
                </p>
                <div className="suggestions">
                  <button onClick={() => setInput("Build a premium AI SaaS landing page")}>
                    AI SaaS
                  </button>
                  <button onClick={() => setInput("Build a modern developer portfolio")}>
                    Portfolio
                  </button>
                  <button onClick={() => setInput("Build a luxury product website")}>
                    Product site
                  </button>
                </div>
              </div>
            )}
            {hasChat && (
              <div className="zb-messages">
                {messages.map((m) => {
                  const ps = parts(m.content);
                  return (
                    <article className={`zb-message ${m.role}`} key={m.id}>
                      <div className="message-shell">
                        {m.role === "assistant" && <span className="avatar">Z</span>}
                        <div className="message-card">
                          <small>{m.role === "assistant" ? "ZYRAXON AI" : "YOU"}</small>
                          {!m.content && m.role === "assistant" ? (
                            <div className="thinking">
                              <i />
                              Working live…
                            </div>
                          ) : ps.length ? (
                            ps.map((x, i) =>
                              x.code ? (
                                <div className="code-card" key={i}>
                                  <button
                                    className="code-card-head"
                                    onClick={() =>
                                      setExpanded(expanded === `${m.id}-${i}` ? "" : `${m.id}-${i}`)
                                    }
                                  >
                                    <span>
                                      <b>{(x.lang || "CODE").toUpperCase()}</b>
                                      <strong>
                                        {x.lang === "html"
                                          ? "index.html"
                                          : x.lang === "css"
                                            ? "styles.css"
                                            : x.lang === "javascript"
                                              ? "script.js"
                                              : "generated code"}
                                      </strong>
                                    </span>
                                    <em>
                                      {expanded === `${m.id}-${i}` ? "Collapse" : "Open code"} ↗
                                    </em>
                                  </button>
                                  {expanded === `${m.id}-${i}` && <pre>{x.value}</pre>}
                                </div>
                              ) : (
                                <div className="message-text" key={i}>
                                  {x.value}
                                </div>
                              ),
                            )
                          ) : (
                            <div className="message-text">{m.content}</div>
                          )}
                          {m.sources?.length && (
                            <div className="chips">
                              {m.sources.slice(0, 5).map((s) => (
                                <a key={s.url} href={s.url} target="_blank" rel="noreferrer">
                                  {s.title}
                                </a>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    </article>
                  );
                })}
                {error && (
                  <div className="zb-error">
                    <b>Generation paused</b>
                    <span>{error}</span>
                    <button onClick={send}>Try again</button>
                  </div>
                )}
              </div>
            )}
            <div className="zb-composer">
              <div className="composer-inner">
                <textarea
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      send();
                    }
                  }}
                  placeholder="Ask ZYRAXON to build, research, change or fix…"
                  rows={1}
                />
                <div className="composer-tools">
                  <span>{current.name}</span>
                  <span className="auto-web">AI web access · automatic</span>
                  <button
                    className="send"
                    onClick={() => (streaming ? abortRef.current?.abort() : send())}
                  >
                    {streaming ? "■" : "↑"}
                  </button>
                </div>
              </div>
              <small>
                Enter to build · Shift + Enter for a new line · web research is selected
                automatically by AI
              </small>
            </div>
          </div>
        </section>
        {hasChat && (
          <div
            className="zb-split"
            onPointerDown={() => {
              dragRef.current = true;
            }}
            onDoubleClick={() => setSplit(42)}
          >
            ⋮
          </div>
        )}
        {hasChat && (
          <section className="zb-preview">
            <div className="preview-bar">
              <b>
                <i />
                Live preview
              </b>
              <div>
                <button
                  className={device === "desktop" ? "active" : ""}
                  onClick={() => setDevice("desktop")}
                >
                  Desktop
                </button>
                <button
                  className={device === "tablet" ? "active" : ""}
                  onClick={() => setDevice("tablet")}
                >
                  Tablet
                </button>
                <button
                  className={device === "mobile" ? "active" : ""}
                  onClick={() => setDevice("mobile")}
                >
                  Mobile
                </button>
              </div>
            </div>
            {codeOpen ? (
              <div className="code-view">
                <aside>
                  <small>PROJECT FILES</small>
                  {(["index.html", "styles.css", "script.js"] as const).map((n) => (
                    <button
                      key={n}
                      className={activeFile === n ? "active" : ""}
                      onClick={() => setActiveFile(n)}
                    >
                      <span>{n === "index.html" ? "HTML" : n === "styles.css" ? "CSS" : "JS"}</span>
                      {n}
                    </button>
                  ))}
                  <button className="reset" onClick={reset}>
                    Reset project
                  </button>
                </aside>
                <div className="editor">
                  <div className="editor-head">
                    <b>{activeFile}</b>
                    <span>LIVE GENERATED FILE</span>
                  </div>
                  <pre>
                    {files[activeFile].split("\n").map((line, i) => (
                      <code key={i}>
                        <i>{String(i + 1).padStart(3, " ")}</i>
                        {line}
                      </code>
                    ))}
                  </pre>
                </div>
              </div>
            ) : (
              <div className="preview-stage">
                <div className={`device ${device}`}>
                  {previewNotice && (
                    <div className="preview-notice" onClick={() => setPreviewNotice("")}>
                      {previewNotice}
                    </div>
                  )}
                  <iframe
                    title="ZYRAXON protected live preview"
                    srcDoc={previewDoc(html)}
                    sandbox="allow-scripts allow-forms allow-modals allow-popups"
                  />
                </div>
              </div>
            )}
          </section>
        )}
      </main>
      {activityOpen && (
        <aside className="zb-drawer">
          <header>
            <b>Live activity</b>
            <button onClick={() => setActivityOpen(false)}>×</button>
          </header>
          {activities.length ? (
            activities.map((a) => (
              <div className="activity-row" key={a.id}>
                <span className={a.state}>
                  {a.state === "done" ? "✓" : a.state === "error" ? "!" : "•"}
                </span>
                <div>
                  <b>{a.label}</b>
                  <small>{a.detail || "Working…"}</small>
                </div>
              </div>
            ))
          ) : (
            <p>Model, automatic web research and preview operations appear here in real time.</p>
          )}
        </aside>
      )}
      {publishOpen && (
        <div className="zb-modal-bg">
          <div className="zb-modal">
            <button className="close" onClick={() => setPublishOpen(false)}>
              ×
            </button>
            <div className="modal-logo">↗</div>
            <h2>Publish your website</h2>
            <p>Connect a GitHub token and ZYRAXON will publish through the secure endpoint.</p>
            <label>
              GitHub token
              <input
                type="password"
                value={githubToken}
                onChange={(e) => setGithubToken(e.target.value)}
                placeholder="ghp_…"
              />
            </label>
            <label>
              Repository name or URL
              <input
                value={repo}
                onChange={(e) => setRepo(e.target.value)}
                placeholder="username/my-site"
              />
            </label>
            <button className="publish-wide" onClick={publish}>
              {publishState.startsWith("Publishing") ? "Publishing…" : "Create & publish"}
            </button>
            {publishState && <div className="publish-state">{publishState}</div>}
          </div>
        </div>
      )}
    </div>
  );
}

const CSS = `
.zyraxon-builder{--bg:#05070d;--bg2:#0b1020;--panel:rgba(16,20,34,.58);--strong:rgba(20,25,42,.78);--glass:rgba(255,255,255,.06);--glass2:rgba(255,255,255,.1);--text:#f8f9ff;--muted:#8f98ad;--line:rgba(255,255,255,.13);--purple:#b99cff;--mint:#65ead8;min-height:100vh;color:var(--text);font-family:Inter,ui-sans-serif,system-ui,sans-serif;overflow:hidden;background:radial-gradient(900px 600px at 12% -10%,rgba(148,91,255,.25),transparent 60%),radial-gradient(800px 620px at 92% 110%,rgba(65,230,210,.16),transparent 58%),radial-gradient(700px 500px at 55% 40%,rgba(74,91,190,.09),transparent 70%),linear-gradient(135deg,var(--bg),var(--bg2));position:relative}.zyraxon-builder:before,.zyraxon-builder:after{content:"";position:fixed;pointer-events:none;border-radius:50%;filter:blur(75px);opacity:.35}.zyraxon-builder:before{width:420px;height:420px;left:-180px;top:28%;background:rgba(185,156,255,.2)}.zyraxon-builder:after{width:360px;height:360px;right:-140px;top:18%;background:rgba(101,234,216,.13)}.zyraxon-builder.light{--bg:#eef2fa;--bg2:#dfe6f4;--panel:rgba(255,255,255,.58);--strong:rgba(255,255,255,.82);--glass:rgba(255,255,255,.62);--glass2:rgba(255,255,255,.8);--text:#111827;--muted:#596579;--line:rgba(27,39,64,.14);background:radial-gradient(900px 600px at 12% -10%,rgba(139,104,255,.22),transparent 60%),radial-gradient(800px 620px at 92% 110%,rgba(48,190,175,.16),transparent 58%),linear-gradient(135deg,#f9fbff,#e5ebf5)}.zyraxon-builder *{box-sizing:border-box}.zyraxon-builder button,.zyraxon-builder input,.zyraxon-builder textarea{font:inherit}.zb-topbar{height:70px;border-bottom:1px solid var(--line);display:flex;align-items:center;justify-content:space-between;padding:0 20px;background:linear-gradient(180deg,rgba(255,255,255,.08),rgba(255,255,255,.025)),var(--panel);backdrop-filter:blur(36px) saturate(170%);position:relative;z-index:50;box-shadow:0 1px 0 rgba(255,255,255,.06)}.zb-brand{display:flex;align-items:center;gap:9px;color:var(--text);text-decoration:none;font-size:12px;letter-spacing:.08em}.zb-brand span:last-child{font-size:9px;color:var(--muted);letter-spacing:.13em}.zb-logo{width:38px;height:38px;border:1px solid var(--line);border-radius:13px;background:linear-gradient(145deg,rgba(185,156,255,.18),rgba(101,234,216,.08));display:grid;place-items:center;box-shadow:0 0 45px rgba(185,156,255,.2),inset 0 1px rgba(255,255,255,.17)}.zb-logo svg{width:31px;height:31px}.zb-center{position:absolute;left:50%;transform:translateX(-50%);padding:4px;border:1px solid var(--line);border-radius:14px;background:var(--glass);backdrop-filter:blur(22px);display:flex}.zb-center button,.zb-actions button{border:0;background:transparent;color:var(--muted);padding:8px 12px;border-radius:10px;cursor:pointer}.zb-center button.active{background:var(--glass2);color:var(--text);box-shadow:inset 0 1px rgba(255,255,255,.1)}.zb-actions{display:flex;gap:6px;align-items:center}.zb-actions button{font-size:10px;border:1px solid var(--line);background:var(--glass);backdrop-filter:blur(20px)}.zb-actions button:hover,.zb-center button:hover{color:var(--text);border-color:rgba(185,156,255,.3)}.zb-actions .publish,.publish-wide{background:linear-gradient(135deg,#c3a9ff,#65ead8);color:#081016;font-weight:900;border:0;box-shadow:0 12px 30px rgba(101,234,216,.15)}.zb-actions .publish{padding:9px 15px}.zb-actions i{width:6px;height:6px;border-radius:50%;background:#64e6ae;display:inline-block;margin-right:6px}.pulse{animation:pulse 1s infinite}@keyframes pulse{50%{opacity:.3}}.zb-models{position:absolute;right:115px;top:60px;width:315px;background:var(--strong);border:1px solid var(--line);border-radius:18px;padding:10px;backdrop-filter:blur(42px);box-shadow:0 30px 110px rgba(0,0,0,.4);z-index:70}.zb-models>small{display:block;color:var(--muted);padding:9px;font-size:8px;letter-spacing:.14em}.zb-models button{width:100%;display:grid;grid-template-columns:24px 1fr 20px;grid-template-rows:1fr 1fr;text-align:left;padding:11px;border:0;border-radius:11px;background:transparent;color:var(--text);cursor:pointer}.zb-models button:hover,.zb-models button.selected{background:var(--glass2)}.zb-models button span{grid-row:1/3;color:var(--purple)}.zb-models b{font-size:11px}.zb-models em{font-size:9px;color:var(--muted);font-style:normal}.zb-models strong{grid-column:3;grid-row:1/3;align-self:center;color:#64e6ae}.zb-workspace{height:calc(100vh - 70px);display:flex;position:relative;z-index:1}.zb-chat{display:flex;justify-content:center;min-width:300px}.zb-chat-inner{width:min(880px,calc(100% - 38px));height:100%;display:flex;flex-direction:column}.zb-chat.with-chat .zb-chat-inner{width:calc(100% - 22px)}.zb-welcome{margin:auto 0 55px;text-align:center}.hero-logo{width:82px;height:82px;margin:0 auto 26px;border:1px solid var(--line);border-radius:26px;background:var(--glass);backdrop-filter:blur(35px);box-shadow:0 0 100px rgba(185,156,255,.2),inset 0 1px rgba(255,255,255,.15);display:grid;place-items:center}.hero-logo svg{width:62px}.zb-welcome h1{font-size:clamp(42px,6vw,76px);letter-spacing:-.075em;margin:0 0 15px}.zb-welcome p{max-width:680px;margin:0 auto;color:var(--muted);line-height:1.75;font-size:15px}.suggestions{display:flex;justify-content:center;gap:8px;margin-top:26px}.suggestions button{background:var(--glass);border:1px solid var(--line);color:var(--muted);padding:9px 13px;border-radius:12px;cursor:pointer;backdrop-filter:blur(22px)}.suggestions button:hover{color:var(--text);border-color:rgba(185,156,255,.35);transform:translateY(-1px)}.zb-messages{flex:1;overflow:auto;padding:30px 4px 22px;scrollbar-width:thin}.zb-message{display:flex;margin:0 auto 22px;max-width:820px}.message-shell{width:100%;display:flex;gap:10px}.zb-message.user .message-shell{justify-content:flex-end}.message-card{max-width:88%;border:1px solid var(--line);border-radius:20px;background:linear-gradient(145deg,rgba(255,255,255,.075),rgba(255,255,255,.025)),var(--panel);backdrop-filter:blur(36px) saturate(155%);box-shadow:inset 0 1px rgba(255,255,255,.1),0 20px 70px rgba(0,0,0,.12);padding:14px 16px}.light .message-card{background:linear-gradient(145deg,rgba(255,255,255,.8),rgba(255,255,255,.48)),var(--panel);box-shadow:inset 0 1px rgba(255,255,255,.9),0 18px 60px rgba(55,68,98,.1)}.zb-message.user .message-card{max-width:78%;border-radius:20px 20px 7px 20px;background:linear-gradient(145deg,rgba(185,156,255,.15),rgba(255,255,255,.045)),var(--panel)}.zb-message small{display:block;font-size:8px;letter-spacing:.13em;color:var(--muted);margin-bottom:8px}.avatar{width:27px;height:27px;flex:0 0 27px;border-radius:9px;background:linear-gradient(135deg,#b99cff,#65ead8);color:#08090d;display:grid;place-items:center;font-size:11px;font-weight:950;box-shadow:0 0 25px rgba(185,156,255,.2)}.message-text{white-space:pre-wrap;line-height:1.72;font-size:13px}.thinking{display:inline-flex;align-items:center;gap:9px;color:var(--muted);font-size:13px}.thinking i{width:7px;height:7px;border-radius:50%;background:var(--purple);box-shadow:0 0 14px var(--purple);animation:pulse 1s infinite}.code-card{margin-top:11px;border:1px solid var(--line);border-radius:14px;overflow:hidden;background:rgba(0,0,0,.16);box-shadow:inset 0 1px rgba(255,255,255,.05)}.light .code-card{background:rgba(235,240,249,.58)}.code-card-head{width:100%;display:flex;align-items:center;justify-content:space-between;border:0;border-bottom:1px solid var(--line);background:linear-gradient(180deg,rgba(255,255,255,.07),rgba(255,255,255,.02));color:var(--text);padding:10px 12px;cursor:pointer;text-align:left}.code-card-head span{display:flex;align-items:center;gap:10px}.code-card-head b{font-size:8px;color:var(--purple);letter-spacing:.1em}.code-card-head strong{font-size:10px}.code-card-head em{font-size:8px;color:var(--muted);font-style:normal}.code-card pre{margin:0;padding:12px;max-height:340px;overflow:auto;font:10px/1.7 ui-monospace,SFMono-Regular,Menlo,monospace;color:var(--text);white-space:pre}.chips{display:flex;flex-wrap:wrap;gap:5px;margin-top:10px}.chips a{color:#a995f5;border:1px solid var(--line);border-radius:999px;padding:5px 8px;font-size:8px;text-decoration:none;background:var(--glass)}.zb-error{margin:10px auto;padding:13px 15px;border:1px solid rgba(255,100,120,.24);border-radius:15px;background:rgba(255,80,100,.06);display:flex;gap:12px;align-items:center;max-width:820px;backdrop-filter:blur(20px)}.zb-error span{flex:1;color:var(--muted);font-size:11px}.zb-error button{background:var(--glass);border:1px solid var(--line);padding:6px 9px;border-radius:8px;color:var(--text);cursor:pointer}.zb-composer{padding:15px 0 20px}.composer-inner{border:1px solid rgba(255,255,255,.17);border-radius:24px;background:linear-gradient(145deg,rgba(255,255,255,.11),rgba(255,255,255,.035)),var(--panel);box-shadow:inset 0 1px rgba(255,255,255,.14),0 30px 90px rgba(0,0,0,.24),0 0 90px rgba(185,156,255,.1);backdrop-filter:blur(44px) saturate(175%);padding:15px}.light .composer-inner{border-color:rgba(30,35,50,.13);box-shadow:inset 0 1px rgba(255,255,255,.95),0 25px 70px rgba(70,80,110,.12)}.composer-inner textarea{width:100%;min-height:54px;resize:none;background:transparent;border:0;outline:0;color:var(--text);line-height:1.65}.composer-tools{display:flex;align-items:center;gap:9px}.composer-tools span{color:var(--muted);font-size:9px}.composer-tools .auto-web{margin-left:auto;color:#8fded2}.composer-tools .send{width:34px;height:34px;border:0;border-radius:11px;background:linear-gradient(135deg,#c3a9ff,#65ead8);color:#081016;font-weight:950;cursor:pointer}.zb-composer>small{display:block;text-align:center;color:var(--muted);font-size:8px;margin-top:8px}.zb-split{width:8px;cursor:col-resize;display:grid;place-items:center;color:var(--muted);opacity:.5}.zb-preview{flex:1;min-width:300px;margin:12px 12px 12px 0;border:1px solid var(--line);border-radius:22px;background:linear-gradient(145deg,rgba(255,255,255,.07),rgba(255,255,255,.025)),var(--panel);overflow:hidden;backdrop-filter:blur(30px);box-shadow:0 30px 110px rgba(0,0,0,.25),inset 0 1px rgba(255,255,255,.08)}.preview-bar{height:50px;border-bottom:1px solid var(--line);display:flex;align-items:center;justify-content:space-between;padding:0 12px;background:rgba(255,255,255,.025)}.preview-bar b{font-size:10px}.preview-bar b i{width:6px;height:6px;border-radius:50%;display:inline-block;background:#65eab1;box-shadow:0 0 9px #65eab1;margin-right:7px}.preview-bar button{border:0;background:transparent;color:var(--muted);padding:6px 8px;font-size:8px;border-radius:8px;cursor:pointer}.preview-bar button.active{background:var(--glass2);color:var(--text)}.preview-stage{height:calc(100% - 50px);display:grid;place-items:center;padding:22px;background:radial-gradient(600px 400px at 50% 50%,rgba(185,156,255,.07),transparent 70%)}.device{height:100%;width:100%;border:1px solid rgba(255,255,255,.16);border-radius:16px;overflow:hidden;background:#fff;box-shadow:0 30px 90px rgba(0,0,0,.35),inset 0 1px rgba(255,255,255,.4);position:relative}.device.tablet{width:min(760px,85%)}.device.mobile{width:min(390px,62%)}.device iframe{position:relative;z-index:2;width:100%;height:100%;border:0;background:#fff}.preview-notice{position:absolute;z-index:5;left:16px;right:16px;top:16px;padding:9px 11px;border:1px solid var(--line);border-radius:10px;background:rgba(10,12,18,.84);color:#fff;font-size:9px;backdrop-filter:blur(18px);cursor:pointer}.code-view{height:calc(100% - 50px);display:flex}.code-view aside{width:170px;border-right:1px solid var(--line);padding:11px;background:rgba(0,0,0,.09)}.code-view aside small{display:block;color:var(--muted);font-size:8px;letter-spacing:.12em;padding:8px}.code-view aside button{display:flex;align-items:center;gap:9px;width:100%;text-align:left;border:0;background:transparent;color:var(--muted);padding:9px;border-radius:8px;font-size:10px;cursor:pointer}.code-view aside button.active{background:var(--glass2);color:var(--text)}.code-view aside button span{width:25px;color:var(--purple);font-size:8px;font-weight:900}.code-view .reset{margin-top:auto}.editor{flex:1;min-width:0;display:flex;flex-direction:column;background:rgba(0,0,0,.14)}.editor-head{height:40px;border-bottom:1px solid var(--line);display:flex;align-items:center;justify-content:space-between;padding:0 12px;font-size:9px}.editor-head span{color:var(--muted);letter-spacing:.1em}.editor pre{margin:0;padding:14px;overflow:auto;flex:1;font:10px/1.75 ui-monospace,SFMono-Regular,Menlo,monospace;color:var(--text)}.editor code{display:block;white-space:pre}.editor code i{display:inline-block;width:34px;color:var(--muted);font-style:normal;opacity:.55}.zb-drawer{position:fixed;top:82px;right:20px;width:340px;max-height:calc(100vh - 102px);overflow:auto;z-index:80;border:1px solid var(--line);border-radius:20px;background:var(--strong);backdrop-filter:blur(42px);box-shadow:0 30px 110px rgba(0,0,0,.4);padding:13px}.zb-drawer header{display:flex;align-items:center;justify-content:space-between;margin-bottom:12px}.zb-drawer header b{font-size:11px}.zb-drawer header button,.zb-modal .close{background:var(--glass);border:1px solid var(--line);border-radius:8px;color:var(--muted);font-size:16px;cursor:pointer}.activity-row{display:flex;gap:10px;padding:11px;border-bottom:1px solid var(--line)}.activity-row>span{width:21px;height:21px;border-radius:7px;display:grid;place-items:center;background:var(--glass);font-size:10px}.activity-row>span.done{color:#65eab1}.activity-row>span.error{color:#ff718b}.activity-row>span.running{color:var(--purple);animation:pulse 1s infinite}.activity-row b,.activity-row small{display:block}.activity-row b{font-size:10px}.activity-row small{font-size:9px;color:var(--muted);margin-top:3px}.zb-drawer p{color:var(--muted);font-size:10px;line-height:1.6}.zb-modal-bg{position:fixed;inset:0;background:rgba(0,0,0,.58);backdrop-filter:blur(14px);display:grid;place-items:center;z-index:100}.zb-modal{width:min(440px,calc(100% - 30px));padding:25px;border:1px solid var(--line);border-radius:24px;background:var(--strong);box-shadow:0 40px 120px rgba(0,0,0,.5);position:relative;backdrop-filter:blur(42px)}.zb-modal .close{position:absolute;right:14px;top:12px}.modal-logo{width:45px;height:45px;border-radius:14px;background:linear-gradient(135deg,#c3a9ff,#65ead8);color:#08090d;display:grid;place-items:center;font-weight:900}.zb-modal h2{margin:16px 0 7px;font-size:22px}.zb-modal p{color:var(--muted);font-size:10px;line-height:1.6}.zb-modal label{display:block;font-size:9px;color:var(--muted);margin-top:12px}.zb-modal input{width:100%;margin-top:6px;background:var(--glass);border:1px solid var(--line);border-radius:10px;color:var(--text);padding:10px;outline:0}.publish-wide{width:100%;margin-top:15px;padding:11px;border-radius:10px;cursor:pointer}.publish-state{margin-top:10px;color:#65eab1;font-size:9px;word-break:break-word}@media(max-width:900px){.zb-center{display:none}.zb-chat.with-chat{width:100%!important}.zb-preview,.zb-split{display:none}.zb-actions button:not(.publish){padding:7px}.zb-brand>span:last-child{display:none}.suggestions{flex-wrap:wrap}.message-card,.zb-message.user .message-card{max-width:92%}}
`;
