import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

type Role = 'user' | 'assistant'
type Msg = { id: string; role: Role; content: string; sources?: Source[] }
type Source = { title: string; url: string; snippet?: string }
type FileItem = { name: string; kind: 'html' | 'css' | 'js'; content: string }
type Model = { id: string; label: string; blurb: string }
type Device = 'desktop' | 'tablet' | 'mobile'
type Activity = { id: string; label: string; detail?: string; state: 'running' | 'done' | 'error' }

const MODELS: Model[] = [
  { id: 'mimo-v2.5-free', label: 'MiMo V2.5 Free', blurb: 'Balanced reasoning · Free' },
  { id: 'nemotron-3-super-free', label: 'Nemotron 3 Super Free', blurb: 'Deep reasoning · Free' },
  { id: 'big-pickle', label: 'Big Pickle', blurb: 'Fast builder · Free' },
]

const STARTER = `<!doctype html>\n<html lang="en">\n<head>\n  <meta charset="UTF-8" />\n  <meta name="viewport" content="width=device-width, initial-scale=1.0" />\n  <title>ZYRAXON Site</title>\n  <style>\n    :root { color-scheme: dark; font-family: Inter, system-ui, sans-serif; }\n    body { margin: 0; min-height: 100vh; display: grid; place-items: center; background: #08090d; color: #fff; }\n    main { max-width: 720px; padding: 64px 32px; text-align: center; }\n    h1 { font-size: clamp(42px, 8vw, 84px); margin: 0 0 18px; letter-spacing: -.06em; }\n    p { color: #9b9da7; font-size: 18px; line-height: 1.7; }\n  </style>\n</head>\n<body><main><h1>Start with an idea.</h1><p>Describe the website you want ZYRAXON AI to build.</p></main></body>\n</html>`

function uid(prefix = 'm') { return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}` }

function extractHtml(text: string) {
  const blocks = [...text.matchAll(/```(?:html)?\s*\n([\s\S]*?)(?:```|$)/gi)]
  const candidate = blocks.at(-1)?.[1]?.trim()
  return candidate && candidate.includes('<html') ? candidate : null
}

function splitFiles(html: string): FileItem[] {
  return [
    { name: 'index.html', kind: 'html', content: html },
    { name: 'styles.css', kind: 'css', content: html.match(/<style[^>]*>([\s\S]*?)<\/style>/i)?.[1]?.trim() || '/* CSS generated inside index.html */' },
    { name: 'script.js', kind: 'js', content: html.match(/<script[^>]*>([\s\S]*?)<\/script>/i)?.[1]?.trim() || '// No JavaScript yet' },
  ]
}

function escapeHtml(value: string) {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

function highlight(value: string, kind: FileItem['kind']) {
  let out = escapeHtml(value)
  if (kind === 'html') {
    out = out.replace(/(&lt;\/?)([\w-]+)/g, '$1<span class="code-tag">$2</span>')
    out = out.replace(/([\w-]+)(=)(&quot;.*?&quot;)/g, '<span class="code-attr">$1</span>$2<span class="code-string">$3</span>')
  }
  if (kind === 'css') {
    out = out.replace(/([\w-]+)(\s*:)/g, '<span class="code-prop">$1</span>$2')
    out = out.replace(/(#[0-9a-fA-F]{3,8})/g, '<span class="code-number">$1</span>')
  }
  if (kind === 'js') out = out.replace(/\b(const|let|var|function|return|if|else|async|await|new|true|false)\b/g, '<span class="code-key">$1</span>')
  return out
}

async function readSse(response: Response, onText: (value: string) => void) {
  const reader = response.body?.getReader()
  if (!reader) throw new Error('The AI stream is unavailable.')
  const decoder = new TextDecoder()
  let buffer = ''
  let full = ''
  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    buffer += decoder.decode(value, { stream: true })
    const lines = buffer.split(/\r?\n/)
    buffer = lines.pop() || ''
    for (const raw of lines) {
      const payload = raw.trim().replace(/^data:\s?/, '')
      if (!payload || payload === '[DONE]') continue
      try {
        const json = JSON.parse(payload)
        const delta = json?.choices?.[0]?.delta?.content ?? json?.choices?.[0]?.message?.content ?? ''
        if (typeof delta === 'string' && delta) { full += delta; onText(full) }
      } catch { /* incomplete SSE frame */ }
    }
  }
  if (buffer.trim()) {
    const payload = buffer.trim().replace(/^data:\s?/, '')
    if (payload && payload !== '[DONE]') {
      try {
        const json = JSON.parse(payload)
        const delta = json?.choices?.[0]?.delta?.content ?? json?.choices?.[0]?.message?.content ?? ''
        if (typeof delta === 'string' && delta) { full += delta; onText(full) }
      } catch { /* provider ended with an incomplete frame */ }
    }
  }
  return full
}

const activityLabels = ['Preparing your request', 'Connecting to the model', 'Streaming response', 'Updating live preview']

export default function BuilderStudio() {
  const [messages, setMessages] = useState<Msg[]>([])
  const [input, setInput] = useState('')
  const [model, setModel] = useState(MODELS[0].id)
  const [html, setHtml] = useState(STARTER)
  const [device, setDevice] = useState<Device>('desktop')
  const [activeFile, setActiveFile] = useState('index.html')
  const [mode, setMode] = useState<'chat' | 'code'>('chat')
  const [showModels, setShowModels] = useState(false)
  const [showSearch, setShowSearch] = useState(false)
  const [showActivity, setShowActivity] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [searching, setSearching] = useState(false)
  const [sources, setSources] = useState<Source[]>([])
  const [streaming, setStreaming] = useState(false)
  const [error, setError] = useState('')
  const [split, setSplit] = useState(42)
  const [showPublish, setShowPublish] = useState(false)
  const [githubToken, setGithubToken] = useState('')
  const [repo, setRepo] = useState('')
  const [publishing, setPublishing] = useState(false)
  const [publishResult, setPublishResult] = useState('')
  const [activity, setActivity] = useState<Activity[]>([])
  const dragRef = useRef(false)
  const abortRef = useRef<AbortController | null>(null)
  const current = MODELS.find((item) => item.id === model) || MODELS[0]
  const files = useMemo(() => splitFiles(html), [html])
  const file = files.find((item) => item.name === activeFile) || files[0]

  useEffect(() => {
    try {
      const saved = sessionStorage.getItem('zyraxon.builder.html')
      const chat = sessionStorage.getItem('zyraxon.builder.chat')
      if (saved) setHtml(saved)
      if (chat) setMessages(JSON.parse(chat))
    } catch { /* storage is optional */ }
  }, [])

  useEffect(() => {
    try {
      sessionStorage.setItem('zyraxon.builder.html', html)
      sessionStorage.setItem('zyraxon.builder.chat', JSON.stringify(messages.slice(-30)))
    } catch { /* storage is optional */ }
  }, [html, messages])

  const setActivityState = useCallback((id: string, state: Activity['state'], detail?: string) => {
    setActivity((prev) => prev.map((item) => item.id === id ? { ...item, state, detail } : item))
  }, [])

  const onMove = useCallback((event: PointerEvent) => {
    if (!dragRef.current) return
    const width = window.innerWidth
    setSplit(Math.min(68, Math.max(28, (event.clientX / width) * 100)))
  }, [])

  useEffect(() => {
    const up = () => { dragRef.current = false }
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', up)
    return () => { window.removeEventListener('pointermove', onMove); window.removeEventListener('pointerup', up) }
  }, [onMove])

  const searchWeb = useCallback(async (query = searchQuery) => {
    const q = query.trim()
    if (!q || searching) return [] as Source[]
    setSearching(true); setError('')
    const id = uid('search')
    setActivity((prev) => [...prev, { id, label: 'Searching the web', detail: q, state: 'running' }])
    try {
      const response = await fetch(`/api/public/builder/search?q=${encodeURIComponent(q)}`)
      const data = await response.json()
      if (!response.ok) throw new Error(data?.error || 'Web search failed.')
      const result = (data.results || []) as Source[]
      setSources(result)
      setShowSearch(true)
      setActivityState(id, 'done', `${result.length} sources found`)
      return result
    } catch (e: any) {
      setActivityState(id, 'error', e?.message || 'Search failed')
      throw e
    } finally { setSearching(false) }
  }, [searchQuery, searching, setActivityState])

  const send = useCallback(async () => {
    const text = input.trim()
    if (!text || streaming) return
    setInput(''); setError(''); setMode('chat')
    const context = messages.slice(-18)
    const userId = uid('user')
    const assistantId = uid('assistant')
    setMessages((prev) => [...prev, { id: userId, role: 'user', content: text }, { id: assistantId, role: 'assistant', content: '' }])
    setStreaming(true)
    const controller = new AbortController(); abortRef.current = controller
    const runId = uid('run')
    const runActivity: Activity[] = activityLabels.map((label, index) => ({ id: `${runId}-${index}`, label, state: index === 0 ? 'running' : 'done' }))
    runActivity.forEach((item, index) => { if (index > 0) item.state = 'done' })
    setActivity(runActivity)
    try {
      let webSources = sources
      const shouldSearch = showSearch || /\b(search|latest|current|today|news|research|reference|source|image|video|price|documentation)\b/i.test(text)
      if (shouldSearch && !webSources.length) {
        setActivityState(runActivity[0].id, 'done')
        try { webSources = await searchWeb(text) } catch { webSources = [] }
      } else setActivityState(runActivity[0].id, 'done')
      setActivityState(runActivity[1].id, 'running')
      let prompt = text
      if (webSources.length) prompt += `\n\nUse these web references when useful. Do not invent facts not supported by them:\n${webSources.map((s) => `- ${s.title}: ${s.url}${s.snippet ? ` — ${s.snippet}` : ''}`).join('\n')}`
      const response = await fetch('/api/public/builder/chat', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ model, messages: [...context, { role: 'user', content: prompt }] }), signal: controller.signal })
      if (!response.ok) { const data = await response.json().catch(() => null); throw new Error(data?.error || `Provider returned HTTP ${response.status}`) }
      setActivityState(runActivity[1].id, 'done')
      setActivityState(runActivity[2].id, 'running')
      let latest = ''
      await readSse(response, (value) => {
        latest = value
        setMessages((prev) => prev.map((message) => message.id === assistantId ? { ...message, content: value, sources: webSources } : message))
        const generated = extractHtml(value)
        if (generated) {
          setHtml(generated)
          setActivityState(runActivity[3].id, 'done', 'Preview refreshed')
        }
      })
      setActivityState(runActivity[2].id, 'done')
      if (!latest) throw new Error('The selected model returned an empty response. Try another available model.')
    } catch (e: any) {
      if (e?.name !== 'AbortError') {
        setError(e?.message || 'Generation failed.')
        setActivity((prev) => prev.map((item) => item.state === 'running' ? { ...item, state: 'error', detail: e?.message || 'Generation failed' } : item))
        setMessages((prev) => prev.filter((message) => message.id !== assistantId || message.content))
      }
    } finally { setStreaming(false); abortRef.current = null }
  }, [input, streaming, messages, model, showSearch, sources, searchWeb, setActivityState])

  const publish = useCallback(async () => {
    if (!githubToken.trim() || !repo.trim()) { setPublishResult('Add your GitHub token and repository name or URL.'); return }
    setPublishing(true); setPublishResult('')
    try {
      const name = repo.trim().replace(/\.git$/, '').split('/').filter(Boolean).at(-1) || repo.trim()
      const response = await fetch('/api/public/builder/publish', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ token: githubToken.trim(), repo: name, html }) })
      const data = await response.json()
      if (!response.ok || !data.ok) throw new Error(data?.error || 'GitHub publish failed.')
      setPublishResult(data.pagesUrl || data.repoUrl || 'Published successfully.')
    } catch (e: any) { setPublishResult(e?.message || 'GitHub publish failed.') } finally { setPublishing(false) }
  }, [githubToken, repo, html])

  const reset = () => { abortRef.current?.abort(); setMessages([]); setHtml(STARTER); setError(''); setSources([]); setActivity([]); try { sessionStorage.removeItem('zyraxon.builder.html'); sessionStorage.removeItem('zyraxon.builder.chat') } catch {} }

  return (
    <div className="studio">
      <style>{CSS}</style>
      <header className="studio-bar">
        <a href="/" className="studio-brand"><span className="brand-mark"><svg viewBox="0 0 32 32" aria-hidden="true"><defs><linearGradient id="zgrad" x1="0" x2="1"><stop offset="0" stopColor="#bca8ff"/><stop offset="1" stopColor="#5ee7d7"/></linearGradient></defs><path d="M7 9.5 16 5l9 4.5v13L16 27l-9-4.5z" fill="none" stroke="url(#zgrad)" strokeWidth="1.5"/><path d="m11 16 3.2 3.2L21.5 12" fill="none" stroke="url(#zgrad)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/><circle cx="16" cy="16" r="12" fill="none" stroke="url(#zgrad)" strokeOpacity=".18" strokeWidth="1" className="logo-spin"/></svg></span><span>ZYRAXON</span><small>AI BUILDER</small></a>
        <div className="top-center"><button className={mode === 'chat' ? 'top-tab active' : 'top-tab'} onClick={() => setMode('chat')}>Build</button><button className={mode === 'code' ? 'top-tab active' : 'top-tab'} onClick={() => setMode('code')}>Code</button></div>
        <div className="top-actions"><button className="activity-toggle" onClick={() => setShowActivity(!showActivity)}><span className={streaming ? 'pulse-dot' : 'quiet-dot'} />Activity</button><button className="model-select" onClick={() => setShowModels(!showModels)}><span className="live-dot" />{current.label}<span>⌄</span></button><button className="publish" onClick={() => setShowPublish(true)}>Publish</button></div>
        {showModels && <div className="model-menu"><div className="eyebrow">OPENCODE ZEN · AVAILABLE MODELS</div>{MODELS.map((m) => <button key={m.id} onClick={() => { setModel(m.id); setShowModels(false) }} className={m.id === model ? 'model-row selected' : 'model-row'}><span>✦</span><div><b>{m.label}</b><small>{m.blurb}</small></div>{m.id === model && <i>✓</i>}</button>)}<a href="https://opencode.ai/docs/zen" target="_blank" rel="noreferrer">OpenCode documentation ↗</a></div>}
      </header>

      <main className="workspace" style={{ '--chat-width': `${messages.length ? split : 100}%` } as React.CSSProperties}>
        <section className={messages.length ? 'chat-pane has-chat' : 'chat-pane centered'}>
          <div className="chat-inner">
            {messages.length === 0 ? <div className="welcome"><div className="welcome-orb"><svg viewBox="0 0 48 48" aria-hidden="true"><path d="M24 6v36M6 24h36M11.3 11.3l25.4 25.4M36.7 11.3 11.3 36.7" stroke="url(#wgrad)" strokeWidth="1.4" strokeLinecap="round"/><defs><linearGradient id="wgrad"><stop stopColor="#bba8ff"/><stop offset="1" stopColor="#5ee7d7"/></linearGradient></defs></svg></div><h1>What will you build?</h1><p>Describe a website or app. ZYRAXON AI can research the web, generate the code and update a live preview while it works.</p><div className="starter-row"><button onClick={() => setInput('Build a premium AI SaaS landing page with pricing, testimonials and FAQ.')}>AI SaaS landing page</button><button onClick={() => setInput('Build a dark developer portfolio with projects, skills and contact form.')}>Developer portfolio</button><button onClick={() => setInput('Build a modern product page with gallery, reviews and a strong CTA.')}>Product page</button></div></div> : <div className="messages">{messages.map((m) => <article key={m.id} className={m.role === 'user' ? 'bubble user' : 'bubble assistant'}><span className="bubble-label">{m.role === 'user' ? 'YOU' : 'ZYRAXON AI'}</span><div>{m.role === 'assistant' && !m.content ? <span className="inline-stream"><i />Generating</span> : m.content.replace(/```[\s\S]*?```/g, '✓ Live website code updated')}</div>{m.role === 'assistant' && m.sources?.length ? <div className="source-chips">{m.sources.slice(0, 4).map((s) => <a key={s.url} href={s.url} target="_blank" rel="noreferrer">{s.title}</a>)}</div> : null}</article>)}{streaming && <div className="stream-status"><span className="pulse-dot" />Streaming live · preview updates as code arrives</div>}{error && <div className="error"><b>Generation paused</b><span>{error}</span><button onClick={send}>Try again</button></div>}</div>}
            <div className="composer-wrap"><div className="composer"><div className="composer-glow" /><textarea value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send() } }} placeholder="Ask ZYRAXON to build, change, research or fix something…" rows={1} /><div className="composer-bottom"><button className={showSearch ? 'tool active' : 'tool'} onClick={() => setShowSearch(!showSearch)}>⌕ Web</button><span className="model-caption">{current.label}</span><button className="send" onClick={() => streaming ? abortRef.current?.abort() : send()}>{streaming ? '■' : '↑'}</button></div></div><div className="composer-hint">Enter to build · Shift + Enter for a new line</div></div>
          </div>
        </section>

        {messages.length > 0 && <div className="splitter" onPointerDown={() => { dragRef.current = true }} onDoubleClick={() => setSplit(split < 50 ? 50 : 42)}><span>⋮</span></div>}

        {messages.length > 0 && <section className="preview-pane"><div className="preview-head"><div className="preview-title"><span className="green-dot" />Live preview</div><div className="device-tabs"><button className={device === 'desktop' ? 'active' : ''} onClick={() => setDevice('desktop')}>Desktop</button><button className={device === 'tablet' ? 'active' : ''} onClick={() => setDevice('tablet')}>Tablet</button><button className={device === 'mobile' ? 'active' : ''} onClick={() => setDevice('mobile')}>Mobile</button></div></div>{mode === 'code' ? <div className="code-workspace"><div className="file-tree"><div className="tree-title">EXPLORER</div>{files.map((f) => <button key={f.name} className={f.name === activeFile ? 'file active' : 'file'} onClick={() => setActiveFile(f.name)}><span>{f.kind === 'html' ? '◇' : f.kind === 'css' ? '#' : 'JS'}</span>{f.name}</button>)}<div className="tree-spacer" /><button className="reset-code" onClick={reset}>Reset project</button></div><div className="editor"><div className="editor-top"><span>{file.name}</span><span>GENERATED CODE</span></div><pre><code dangerouslySetInnerHTML={{ __html: file.content.split('\n').map((line, i) => `<span class="line"><i>${String(i + 1).padStart(3, ' ')}</i><b>${highlight(line, file.kind) || ' '}</b></span>`).join('') }} /></code></pre></div></div> : <div className="preview-stage"><div className={`device-frame ${device}`}><iframe title="ZYRAXON live website preview" srcDoc={html} sandbox="allow-scripts allow-forms allow-modals" /></div></div>}</section>}
      </main>

      {showActivity && <aside className="activity-drawer"><div className="drawer-head"><div><b>Live activity</b><small>Tool and generation events</small></div><button onClick={() => setShowActivity(false)}>×</button></div>{activity.length ? activity.map((item) => <div className="activity-item" key={item.id}><span className={`activity-icon ${item.state}`}>{item.state === 'done' ? '✓' : item.state === 'error' ? '!' : '•'}</span><div><b>{item.label}</b><small>{item.detail || (item.state === 'running' ? 'Working now…' : 'Complete')}</small></div></div>) : <p className="drawer-note">When ZYRAXON searches, generates or refreshes the preview, the live operation appears here.</p>}</aside>}

      {showSearch && <aside className="search-drawer"><div className="drawer-head"><div><b>Web research</b><small>Sources used by the builder</small></div><button onClick={() => setShowSearch(false)}>×</button></div><div className="search-box"><input value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && searchWeb()} placeholder="Search the web…"/><button onClick={() => searchWeb()}>{searching ? '…' : '⌕'}</button></div>{sources.length ? sources.map((s) => <a className="source" key={s.url} href={s.url} target="_blank" rel="noreferrer"><b>{s.title}</b><small>{s.url}</small><span>{s.snippet}</span></a>) : <p className="drawer-note">Web search can provide references for current facts, documentation and inspiration. Results are shown here before being passed to the model.</p>}</aside>}

      {showPublish && <div className="modal-backdrop" onMouseDown={() => setShowPublish(false)}><div className="publish-modal" onMouseDown={(e) => e.stopPropagation()}><div className="modal-icon"><svg viewBox="0 0 24 24"><path d="M12 4v12m0-12-4 4m4-4 4 4M5 14v4a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-4" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg></div><h2>Publish to GitHub</h2><p>Create or update the repository from the website you just built.</p><label>GitHub token<input type="password" value={githubToken} onChange={(e) => setGithubToken(e.target.value)} placeholder="ghp_…" /></label><label>Repository name or URL<input value={repo} onChange={(e) => setRepo(e.target.value)} placeholder="username/my-site or GitHub URL" /></label><button className="publish wide" disabled={publishing} onClick={publish}>{publishing ? 'Publishing…' : 'Create & publish'}</button>{publishResult && <div className="publish-result">{publishResult}</div>}<button className="modal-close" onClick={() => setShowPublish(false)}>Cancel</button></div></div>}
    </div>
  )
}

const CSS = `
:root{color-scheme:dark}.studio{--bg:#07080d;--panel:rgba(14,16,23,.72);--line:rgba(255,255,255,.085);--muted:#7f8491;--text:#f5f7fb;--accent:#ad98ff;min-height:100vh;background:radial-gradient(900px 500px at 50% -15%,rgba(131,92,255,.18),transparent 68%),radial-gradient(600px 400px at 85% 90%,rgba(56,189,248,.07),transparent 70%),#07080d;color:var(--text);font-family:Inter,ui-sans-serif,system-ui,sans-serif;letter-spacing:-.01em;overflow:hidden}.studio *{box-sizing:border-box}.studio button,.studio input,.studio textarea{font:inherit}.studio button{border:0;color:inherit;cursor:pointer}.studio-bar{height:64px;border-bottom:1px solid var(--line);background:rgba(8,9,13,.66);backdrop-filter:blur(30px) saturate(150%);display:flex;align-items:center;justify-content:space-between;padding:0 20px;position:relative;z-index:20}.studio-brand{display:flex;align-items:center;gap:9px;color:#fff;text-decoration:none;font-weight:800;letter-spacing:.08em;font-size:12px}.studio-brand small{color:#646a76;font-size:9px;letter-spacing:.12em;border-left:1px solid var(--line);padding-left:9px}.brand-mark{width:30px;height:30px;display:grid;place-items:center;border:1px solid rgba(173,152,255,.28);border-radius:10px;background:linear-gradient(145deg,rgba(173,152,255,.13),rgba(94,231,215,.06));box-shadow:inset 0 1px rgba(255,255,255,.08),0 0 28px rgba(142,110,255,.08)}.brand-mark svg{width:24px;height:24px}.logo-spin{transform-origin:center;animation:spin 14s linear infinite}@keyframes spin{to{transform:rotate(360deg)}}.top-center{position:absolute;left:50%;transform:translateX(-50%);display:flex;background:rgba(16,18,25,.68);border:1px solid var(--line);padding:3px;border-radius:12px;backdrop-filter:blur(18px)}.top-tab{padding:7px 16px;border-radius:8px;background:transparent;color:#777d89;font-size:11px}.top-tab.active{background:rgba(255,255,255,.07);color:#fff;box-shadow:inset 0 0 0 1px rgba(255,255,255,.06)}.top-actions{display:flex;gap:7px;align-items:center}.activity-toggle,.model-select,.publish{height:34px;border-radius:10px;padding:0 10px;background:rgba(16,18,25,.72);border:1px solid var(--line);font-size:10px;display:flex;align-items:center;gap:7px;backdrop-filter:blur(18px)}.publish{background:linear-gradient(135deg,rgba(183,162,255,.95),rgba(107,231,214,.86));color:#090a0e;font-weight:850;border:0;padding:0 14px}.live-dot,.green-dot,.pulse-dot,.quiet-dot{width:7px;height:7px;border-radius:50%;display:inline-block}.live-dot,.green-dot{background:#5ee7b1;box-shadow:0 0 10px rgba(94,231,177,.65)}.pulse-dot{background:#b59cff;box-shadow:0 0 14px rgba(181,156,255,.85);animation:blink 1s infinite}.quiet-dot{background:#5b606c}@keyframes blink{50%{opacity:.25;transform:scale(.7)}}.model-menu{position:absolute;right:105px;top:56px;width:310px;background:rgba(15,17,24,.94);border:1px solid var(--line);border-radius:16px;padding:10px;box-shadow:0 30px 100px rgba(0,0,0,.58);backdrop-filter:blur(30px);z-index:30}.eyebrow,.tree-title{font-size:9px;color:#626875;letter-spacing:.13em;padding:8px}.model-row{width:100%;display:flex;align-items:center;gap:10px;padding:10px;border-radius:10px;background:transparent;text-align:left}.model-row:hover,.model-row.selected{background:rgba(255,255,255,.055)}.model-row>span{color:#b8a6ff}.model-row div{flex:1}.model-row b,.model-row small{display:block}.model-row b{font-size:11px}.model-row small{font-size:9px;color:#737986;margin-top:3px}.model-row i{font-style:normal;color:#83e5af}.model-menu>a{display:block;color:#8b909c;font-size:9px;padding:9px;text-decoration:none}.workspace{height:calc(100vh - 64px);display:flex;position:relative}.chat-pane{width:var(--chat-width);min-width:300px;display:flex;justify-content:center;transition:width .24s ease}.chat-pane.centered{width:100%}.chat-inner{width:min(790px,calc(100% - 44px));display:flex;flex-direction:column;height:100%;position:relative}.has-chat .chat-inner{width:calc(100% - 30px)}.welcome{margin:auto 0 48px;text-align:center}.welcome-orb{width:62px;height:62px;margin:0 auto 23px;display:grid;place-items:center;border:1px solid rgba(173,152,255,.3);border-radius:20px;background:linear-gradient(145deg,rgba(173,152,255,.14),rgba(94,231,215,.06));box-shadow:0 0 80px rgba(139,92,246,.12),inset 0 1px rgba(255,255,255,.08)}.welcome-orb svg{width:32px;height:32px}.welcome h1{font-size:clamp(34px,5vw,58px);margin:0;letter-spacing:-.065em}.welcome p{max-width:610px;margin:14px auto 28px;color:#7d828e;line-height:1.75;font-size:13px}.starter-row{display:flex;gap:7px;justify-content:center;flex-wrap:wrap}.starter-row button{background:rgba(16,18,25,.55);border:1px solid var(--line);padding:10px 12px;border-radius:11px;color:#959aa6;font-size:10px;backdrop-filter:blur(18px)}.starter-row button:hover{border-color:rgba(173,152,255,.32);color:#fff;transform:translateY(-1px)}.messages{overflow:auto;flex:1;padding:42px 4px 175px;scrollbar-width:thin}.bubble{max-width:92%;margin:0 0 20px;padding:14px 16px;border-radius:16px;border:1px solid var(--line);font-size:13px;line-height:1.75;white-space:pre-wrap;box-shadow:0 10px 40px rgba(0,0,0,.12)}.bubble.user{margin-left:auto;background:linear-gradient(145deg,rgba(37,31,54,.68),rgba(20,22,30,.76));border-color:rgba(173,152,255,.15)}.bubble.assistant{background:rgba(10,12,17,.56);backdrop-filter:blur(18px)}.bubble-label{display:block;color:#686e7b;font-size:8px;letter-spacing:.13em;margin-bottom:5px}.inline-stream{color:#9298a5;display:inline-flex;align-items:center;gap:8px}.inline-stream i{width:6px;height:6px;border-radius:50%;background:#ad98ff;box-shadow:0 0 10px #ad98ff;animation:blink 1s infinite}.source-chips{display:flex;gap:5px;flex-wrap:wrap;margin-top:10px}.source-chips a{font-size:8px;color:#9fa6b5;text-decoration:none;border:1px solid var(--line);padding:5px 7px;border-radius:7px;background:rgba(255,255,255,.025)}.stream-status{color:#858b98;font-size:10px;display:flex;align-items:center;gap:7px;margin:5px 0 14px}.error{border:1px solid rgba(248,113,113,.22);background:rgba(127,29,29,.1);border-radius:12px;padding:11px;margin:10px 0;display:flex;gap:9px;align-items:center;font-size:10px}.error span{color:#a6aab5;flex:1}.error button{background:rgba(255,255,255,.09);border:1px solid var(--line);padding:6px 9px;border-radius:7px;font-size:9px}.composer-wrap{position:absolute;left:0;right:0;bottom:28px}.composer{position:relative;background:linear-gradient(145deg,rgba(21,23,32,.78),rgba(10,12,17,.72));border:1px solid rgba(255,255,255,.13);border-radius:20px;box-shadow:0 30px 100px rgba(0,0,0,.48),inset 0 1px rgba(255,255,255,.08);padding:13px 14px;backdrop-filter:blur(32px) saturate(150%);overflow:hidden}.composer-glow{position:absolute;inset:auto 10% -35px 10%;height:80px;background:radial-gradient(ellipse,rgba(157,123,255,.17),transparent 68%);pointer-events:none}.composer textarea{position:relative;width:100%;resize:none;border:0;outline:0;background:transparent;color:#fff;font-size:14px;line-height:1.55;min-height:28px;max-height:120px}.composer textarea::placeholder{color:#676d79}.composer-bottom{position:relative;display:flex;align-items:center;gap:7px;margin-top:9px;color:#666b77;font-size:9px}.tool{background:rgba(255,255,255,.025);border:1px solid transparent!important;color:#7c828e;font-size:9px;padding:6px 8px;border-radius:8px}.tool.active{background:rgba(173,152,255,.1);border-color:rgba(173,152,255,.18)!important;color:#c6b8ff}.model-caption{margin-left:auto;color:#686e7a;font-size:9px}.send{width:32px;height:32px;border-radius:10px;background:linear-gradient(135deg,#c1afff,#72e7d9);color:#090a0d;font-weight:900;box-shadow:0 7px 24px rgba(157,123,255,.16)}.composer-hint{text-align:center;color:#4e535e;font-size:8px;margin-top:8px}.splitter{width:9px;cursor:col-resize;display:grid;place-items:center;background:#08090e;border-left:1px solid var(--line);border-right:1px solid var(--line);z-index:8}.splitter span{color:#4f5561;font-size:12px}.preview-pane{flex:1;min-width:360px;background:#090a0f;display:flex;flex-direction:column}.preview-head{height:48px;border-bottom:1px solid var(--line);display:flex;align-items:center;justify-content:space-between;padding:0 14px}.preview-title{font-size:10px;display:flex;align-items:center;gap:8px}.device-tabs{display:flex;gap:4px}.device-tabs button{background:rgba(255,255,255,.035);border:1px solid var(--line);color:#747a87;border-radius:8px;padding:5px 8px;font-size:8px}.device-tabs button.active{color:#fff;background:rgba(173,152,255,.1);border-color:rgba(173,152,255,.18)}.preview-stage{flex:1;display:grid;place-items:center;padding:28px;background:radial-gradient(500px 300px at 50% 30%,rgba(108,92,231,.08),transparent 70%)}.device-frame{height:calc(100vh - 165px);width:100%;max-width:100%;border:1px solid rgba(255,255,255,.1);border-radius:14px;overflow:hidden;background:#fff;box-shadow:0 30px 100px rgba(0,0,0,.45);transition:.25s}.device-frame.tablet{width:760px;max-width:82%}.device-frame.mobile{width:390px;max-width:65%}.device-frame iframe{width:100%;height:100%;border:0;background:#fff}.code-workspace{flex:1;display:flex;min-height:0}.file-tree{width:175px;border-right:1px solid var(--line);padding:10px;display:flex;flex-direction:column}.file{background:transparent;color:#777c87;text-align:left;padding:8px 9px;border-radius:7px;font-size:10px}.file span{display:inline-block;width:24px;color:#a391ff;font-size:8px}.file.active,.file:hover{background:rgba(255,255,255,.045);color:#fff}.tree-spacer{flex:1}.reset-code{font-size:8px;color:#666b75;background:transparent;text-align:left;padding:8px}.editor{flex:1;min-width:0;background:#0a0b10;overflow:auto}.editor-top{height:38px;border-bottom:1px solid var(--line);display:flex;justify-content:space-between;align-items:center;padding:0 14px;color:#777c87;font-size:8px}.editor pre{margin:0;padding:14px 0;font:12px/1.7 ui-monospace,SFMono-Regular,Consolas,monospace}.line{display:flex;min-width:max-content}.line>i{width:50px;text-align:right;padding-right:15px;color:#343844;font-style:normal;user-select:none}.line>b{font-weight:400;color:#aeb1bb}.code-tag,.code-key{color:#c4a7ff}.code-attr,.code-prop{color:#75d7ff}.code-string{color:#a5e6a1}.code-number{color:#ff9fc1}.activity-drawer,.search-drawer{position:fixed;right:18px;top:76px;width:350px;max-height:calc(100vh - 94px);overflow:auto;background:rgba(14,16,23,.93);border:1px solid var(--line);border-radius:17px;padding:12px;z-index:40;box-shadow:0 30px 110px rgba(0,0,0,.58);backdrop-filter:blur(32px) saturate(150%)}.drawer-head{display:flex;justify-content:space-between;align-items:center;font-size:11px;padding:4px}.drawer-head>div b,.drawer-head>div small{display:block}.drawer-head>div small{font-size:8px;color:#666c78;margin-top:3px}.drawer-head button{background:transparent;color:#777;font-size:18px}.activity-item{display:flex;gap:10px;align-items:flex-start;padding:10px 7px;border-bottom:1px solid rgba(255,255,255,.045)}.activity-icon{width:20px;height:20px;border-radius:7px;display:grid;place-items:center;background:rgba(255,255,255,.04);color:#777;font-size:9px}.activity-icon.running{color:#b7a2ff;box-shadow:0 0 16px rgba(173,152,255,.12)}.activity-icon.done{color:#73e3ae}.activity-icon.error{color:#ff8e8e}.activity-item b,.activity-item small{display:block}.activity-item b{font-size:9px}.activity-item small{font-size:8px;color:#676d79;margin-top:3px}.search-box{display:flex;gap:6px;margin:12px 0}.search-box input{flex:1;background:#090a0f;border:1px solid var(--line);border-radius:9px;padding:9px;color:#fff;outline:0;font-size:10px}.search-box button{width:36px;border-radius:9px;background:linear-gradient(135deg,#c1afff,#72e7d9);color:#08090d}.source{display:block;padding:10px;border:1px solid var(--line);border-radius:10px;margin:7px 0;text-decoration:none;color:#fff;background:rgba(255,255,255,.018)}.source b,.source small,.source span{display:block}.source b{font-size:10px}.source small{color:#666c77;font-size:8px;margin:4px 0}.source span{color:#8d929e;font-size:8px;line-height:1.5}.drawer-note{color:#707681;font-size:9px;line-height:1.7;padding:5px}.modal-backdrop{position:fixed;inset:0;background:#0009;backdrop-filter:blur(10px);z-index:50;display:grid;place-items:center}.publish-modal{width:min(430px,calc(100% - 32px));background:rgba(16,18,25,.94);border:1px solid var(--line);border-radius:20px;padding:24px;box-shadow:0 40px 140px #000b;backdrop-filter:blur(28px)}.modal-icon{width:42px;height:42px;display:grid;place-items:center;border-radius:12px;background:linear-gradient(135deg,#c1afff,#72e7d9);color:#0a0b0f}.modal-icon svg{width:20px}.publish-modal h2{margin:18px 0 7px;font-size:21px}.publish-modal p{color:#777c88;font-size:10px;line-height:1.6;margin:0 0 18px}.publish-modal label{display:block;color:#777c88;font-size:8px;margin:10px 0}.publish-modal input{display:block;width:100%;margin-top:6px;background:#090a0f;border:1px solid var(--line);border-radius:9px;padding:10px;color:#fff;outline:0;font-size:10px}.wide{width:100%;justify-content:center;margin-top:12px}.publish-result{margin-top:10px;padding:10px;border-radius:9px;background:#0b0d12;color:#8ee6ae;font-size:9px;word-break:break-word}.modal-close{width:100%;margin-top:7px;background:transparent;color:#666b75;font-size:9px;padding:8px}@media(max-width:900px){.top-center{display:none}.chat-pane{width:100%!important}.preview-pane,.splitter{display:none}.chat-inner{width:min(790px,calc(100% - 24px))}.model-menu{right:10px}.welcome{margin-bottom:120px}.starter-row{display:grid}.device-frame{height:calc(100vh - 150px)}}
`
