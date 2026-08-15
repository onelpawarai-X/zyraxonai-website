import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

type Msg = { role: 'user' | 'assistant'; content: string; sources?: Source[] }
type Source = { title: string; url: string; snippet?: string }
type FileItem = { name: string; kind: 'html' | 'css' | 'js'; content: string }
type Model = { id: string; label: string; blurb: string }
type Device = 'desktop' | 'tablet' | 'mobile'

const MODELS: Model[] = [
  { id: 'mimo-v2.5-free', label: 'MiMo V2.5 Free', blurb: 'Balanced reasoning · Free' },
  { id: 'nemotron-3-super-free', label: 'Nemotron 3 Super Free', blurb: 'Deep reasoning · Free' },
  { id: 'big-pickle', label: 'Big Pickle', blurb: 'Fast builder · Free' },
]

const STARTER = `<!doctype html>\n<html lang="en">\n<head>\n  <meta charset="UTF-8" />\n  <meta name="viewport" content="width=device-width, initial-scale=1.0" />\n  <title>ZYRAXON Site</title>\n  <style>\n    :root { color-scheme: dark; font-family: Inter, system-ui, sans-serif; }\n    body { margin: 0; min-height: 100vh; display: grid; place-items: center; background: #08090d; color: #fff; }\n    main { max-width: 720px; padding: 64px 32px; text-align: center; }\n    h1 { font-size: clamp(42px, 8vw, 84px); margin: 0 0 18px; letter-spacing: -.06em; }\n    p { color: #9b9da7; font-size: 18px; line-height: 1.7; }\n  </style>\n</head>\n<body><main><h1>Start with an idea.</h1><p>Describe the website you want ZYRAXON AI to build.</p></main></body>\n</html>`

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
    for (const line of lines) {
      const payload = line.trim().replace(/^data:\s?/, '')
      if (!payload || payload === '[DONE]') continue
      try {
        const json = JSON.parse(payload)
        const delta = json?.choices?.[0]?.delta?.content ?? json?.choices?.[0]?.message?.content ?? ''
        if (typeof delta === 'string' && delta) { full += delta; onText(full) }
      } catch { /* wait for the next complete frame */ }
    }
  }
  return full
}

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
  const [searchQuery, setSearchQuery] = useState('')
  const [searching, setSearching] = useState(false)
  const [sources, setSources] = useState<Source[]>([])
  const [streaming, setStreaming] = useState(false)
  const [error, setError] = useState('')
  const [split, setSplit] = useState(42)
  const [showPreview, setShowPreview] = useState(false)
  const [showPublish, setShowPublish] = useState(false)
  const [githubToken, setGithubToken] = useState('')
  const [repo, setRepo] = useState('')
  const [publishing, setPublishing] = useState(false)
  const [publishResult, setPublishResult] = useState('')
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

  const onMove = useCallback((event: PointerEvent) => {
    if (!dragRef.current) return
    const width = window.innerWidth
    setSplit(Math.min(62, Math.max(30, (event.clientX / width) * 100)))
  }, [])

  useEffect(() => {
    const up = () => { dragRef.current = false }
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', up)
    return () => { window.removeEventListener('pointermove', onMove); window.removeEventListener('pointerup', up) }
  }, [onMove])

  const searchWeb = useCallback(async () => {
    const q = searchQuery.trim()
    if (!q || searching) return
    setSearching(true); setError('')
    try {
      const response = await fetch(`/api/public/builder/search?q=${encodeURIComponent(q)}`)
      const data = await response.json()
      if (!response.ok) throw new Error(data?.error || 'Web search failed.')
      setSources(data.results || [])
      setShowSearch(true)
    } catch (e: any) { setError(e?.message || 'Web search failed.') } finally { setSearching(false) }
  }, [searchQuery, searching])

  const send = useCallback(async () => {
    const text = input.trim()
    if (!text || streaming) return
    setInput(''); setError(''); setSources([])
    const context = messages.slice(-18)
    const next = [...context, { role: 'user' as const, content: text }]
    setMessages((prev) => [...prev, { role: 'user', content: text }])
    setStreaming(true); setMode('chat')
    const controller = new AbortController(); abortRef.current = controller
    try {
      let prompt = text
      if (showSearch && sources.length) prompt += `\n\nUse these web sources when useful:\n${sources.map((s) => `- ${s.title}: ${s.url}`).join('\n')}`
      const response = await fetch('/api/public/builder/chat', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ model, messages: [...context, { role: 'user', content: prompt }] }), signal: controller.signal })
      if (!response.ok) { const data = await response.json().catch(() => null); throw new Error(data?.error || `Provider returned HTTP ${response.status}`) }
      let latest = ''
      await readSse(response, (value) => { latest = value; setMessages((prev) => [...prev.filter((m) => m.role !== 'assistant' || m.content !== latest), { role: 'assistant', content: value, sources }]); const generated = extractHtml(value); if (generated) { setHtml(generated); setShowPreview(true) } })
      if (!latest) throw new Error('The selected model returned an empty response. Try another free model.')
    } catch (e: any) { if (e?.name !== 'AbortError') setError(e?.message || 'Generation failed.') } finally { setStreaming(false); abortRef.current = null }
  }, [input, streaming, messages, model, showSearch, sources])

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

  const reset = () => { abortRef.current?.abort(); setMessages([]); setHtml(STARTER); setError(''); setSources([]); try { sessionStorage.clear() } catch {} }

  return (
    <div className="studio">
      <style>{CSS}</style>
      <header className="studio-bar">
        <a href="/" className="studio-brand"><span className="brand-mark">✦</span><span>ZYRAXON</span><small>AI BUILDER</small></a>
        <div className="top-center"><button className={mode === 'chat' ? 'top-tab active' : 'top-tab'} onClick={() => setMode('chat')}>✦ Build</button><button className={mode === 'code' ? 'top-tab active' : 'top-tab'} onClick={() => setMode('code')}>⌘ Code</button></div>
        <div className="top-actions">
          <button className="model-select" onClick={() => setShowModels(!showModels)}><span className="live-dot" />{current.label}<span>⌄</span></button>
          <button className="publish" onClick={() => setShowPublish(true)}>Publish</button>
        </div>
        {showModels && <div className="model-menu"><div className="eyebrow">OPENCODE ZEN · FREE MODELS</div>{MODELS.map((m) => <button key={m.id} onClick={() => { setModel(m.id); setShowModels(false) }} className={m.id === model ? 'model-row selected' : 'model-row'}><span>✦</span><div><b>{m.label}</b><small>{m.blurb}</small></div>{m.id === model && <i>✓</i>}</button>)}<a href="https://opencode.ai/docs/zen" target="_blank" rel="noreferrer">OpenCode documentation ↗</a></div>}
      </header>

      <main className="workspace" style={{ '--chat-width': `${messages.length ? split : 100}%` } as React.CSSProperties}>
        <section className={messages.length ? 'chat-pane has-chat' : 'chat-pane centered'}>
          <div className="chat-inner">
            {messages.length === 0 ? <div className="welcome"><div className="welcome-orb">✦</div><h1>What will you build?</h1><p>Describe a website or app. ZYRAXON AI will design it, write the code and render the result live.</p><div className="starter-row"><button onClick={() => setInput('Build a premium AI SaaS landing page with pricing, testimonials and FAQ.')}>AI SaaS landing page</button><button onClick={() => setInput('Build a dark developer portfolio with projects, skills and contact form.')}>Developer portfolio</button><button onClick={() => setInput('Build a modern product page with gallery, reviews and a strong CTA.')}>Product page</button></div></div> : <div className="messages">{messages.map((m, i) => <article key={i} className={m.role === 'user' ? 'bubble user' : 'bubble assistant'}><span className="bubble-label">{m.role === 'user' ? 'YOU' : 'ZYRAXON AI'}</span><div>{m.role === 'assistant' ? m.content.replace(/```[\s\S]*?```/g, '✓ Live website updated') : m.content}</div></article>)}{streaming && <div className="typing"><span /><span /><span /> Building your site…</div>}{error && <div className="error"><b>Generation paused</b><span>{error}</span><button onClick={send}>Try again</button></div>}</div>}
            <div className="composer-wrap"><div className="composer"><textarea value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send() } }} placeholder="Describe what you want to build…" rows={1} /><div className="composer-bottom"><button className={showSearch ? 'tool active' : 'tool'} onClick={() => setShowSearch(!showSearch)}>⌕ Web</button><span>{current.label}</span><button className="send" onClick={() => streaming ? abortRef.current?.abort() : send()}>{streaming ? '■' : '↑'}</button></div></div><div className="composer-hint">Enter to build · Shift + Enter for a new line</div></div>
          </div>
        </section>

        {messages.length > 0 && <div className="splitter" onPointerDown={() => { dragRef.current = true }} onDoubleClick={() => setSplit(split < 50 ? 50 : 42)}><span>⋮</span></div>}

        {messages.length > 0 && <section className="preview-pane">
          <div className="preview-head"><div className="preview-title"><span className="green-dot" />Live preview</div><div className="device-tabs"><button className={device === 'desktop' ? 'active' : ''} onClick={() => setDevice('desktop')}>▱</button><button className={device === 'tablet' ? 'active' : ''} onClick={() => setDevice('tablet')}>▯</button><button className={device === 'mobile' ? 'active' : ''} onClick={() => setDevice('mobile')}>▯</button><button onClick={() => setShowPreview(!showPreview)}>{showPreview ? 'Preview' : 'Show'}</button></div></div>
          {mode === 'code' ? <div className="code-workspace"><div className="file-tree"><div className="tree-title">EXPLORER</div>{files.map((f) => <button key={f.name} className={f.name === activeFile ? 'file active' : 'file'} onClick={() => setActiveFile(f.name)}><span>{f.kind === 'html' ? '◇' : f.kind === 'css' ? '#' : 'JS'}</span>{f.name}</button>)}<div className="tree-spacer" /><button className="reset-code" onClick={reset}>Reset project</button></div><div className="editor"><div className="editor-top"><span>{file.name}</span><span>READ / GENERATED</span></div><pre><code dangerouslySetInnerHTML={{ __html: file.content.split('\n').map((line, i) => `<span class="line"><i>${String(i + 1).padStart(3, ' ')}</i><b>${highlight(line, file.kind) || ' '}</b></span>`).join('') }} /></pre></div></div> : <div className="preview-stage"><div className={`device-frame ${device}`}><iframe title="ZYRAXON live website preview" srcDoc={html} sandbox="allow-scripts allow-forms allow-modals" /></div></div>}
        </section>}
      </main>

      {showSearch && <aside className="search-drawer"><div className="drawer-head"><b>Web research</b><button onClick={() => setShowSearch(false)}>×</button></div><div className="search-box"><input value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && searchWeb()} placeholder="Search the web…"/><button onClick={searchWeb}>{searching ? '…' : '⌕'}</button></div>{sources.length ? sources.map((s) => <a className="source" key={s.url} href={s.url} target="_blank" rel="noreferrer"><b>{s.title}</b><small>{s.url}</small><span>{s.snippet}</span></a>) : <p className="drawer-note">Search for references, images, facts or inspiration. Results can be supplied to the AI when you build.</p>}</aside>}

      {showPublish && <div className="modal-backdrop" onMouseDown={() => setShowPublish(false)}><div className="publish-modal" onMouseDown={(e) => e.stopPropagation()}><div className="modal-icon">↗</div><h2>Publish to GitHub</h2><p>Create or update the repository from the website you just built.</p><label>GitHub token<input type="password" value={githubToken} onChange={(e) => setGithubToken(e.target.value)} placeholder="ghp_…" /></label><label>Repository name or URL<input value={repo} onChange={(e) => setRepo(e.target.value)} placeholder="username/my-site or GitHub URL" /></label><button className="publish wide" disabled={publishing} onClick={publish}>{publishing ? 'Publishing…' : 'Create & publish'}</button>{publishResult && <div className="publish-result">{publishResult}</div>}<button className="modal-close" onClick={() => setShowPublish(false)}>Cancel</button></div></div>}
    </div>
  )
}

const CSS = `
:root{color-scheme:dark}.studio{--bg:#07080c;--panel:#0d0f14;--line:rgba(255,255,255,.09);--muted:#858894;--text:#f5f6f8;--accent:#a78bfa;min-height:100vh;background:radial-gradient(900px 500px at 50% -10%,rgba(126,87,255,.16),transparent 65%),#07080c;color:var(--text);font-family:Inter,ui-sans-serif,system-ui,sans-serif;letter-spacing:-.01em;overflow:hidden}.studio *{box-sizing:border-box}.studio button,.studio input,.studio textarea{font:inherit}.studio button{border:0;color:inherit;cursor:pointer}.studio-bar{height:64px;border-bottom:1px solid var(--line);background:rgba(8,9,13,.78);backdrop-filter:blur(24px);display:flex;align-items:center;justify-content:space-between;padding:0 20px;position:relative;z-index:20}.studio-brand{display:flex;align-items:center;gap:9px;color:#fff;text-decoration:none;font-weight:800;letter-spacing:.08em;font-size:12px}.studio-brand small{color:#666b78;font-size:9px;letter-spacing:.12em;border-left:1px solid var(--line);padding-left:9px}.brand-mark,.welcome-orb{display:grid;place-items:center}.brand-mark{width:28px;height:28px;border:1px solid rgba(167,139,250,.45);border-radius:9px;background:linear-gradient(135deg,rgba(167,139,250,.24),rgba(34,211,238,.12));color:#c4b5fd}.top-center{position:absolute;left:50%;transform:translateX(-50%);display:flex;background:#101116;border:1px solid var(--line);padding:3px;border-radius:10px}.top-tab{padding:7px 15px;border-radius:7px;background:transparent;color:#858894;font-size:12px}.top-tab.active{background:#1b1d25;color:#fff;box-shadow:inset 0 0 0 1px rgba(255,255,255,.06)}.top-actions{display:flex;gap:8px;align-items:center}.model-select,.publish{height:34px;border-radius:9px;padding:0 11px;background:#11131a;border:1px solid var(--line);font-size:11px;display:flex;align-items:center;gap:8px}.live-dot,.green-dot{width:7px;height:7px;border-radius:50%;background:#58d68d;box-shadow:0 0 10px rgba(88,214,141,.7)}.publish{background:#fff;color:#08090d;font-weight:800;padding:0 14px}.model-menu{position:absolute;right:100px;top:54px;width:300px;background:rgba(16,17,23,.96);border:1px solid var(--line);border-radius:15px;padding:10px;box-shadow:0 30px 90px rgba(0,0,0,.55);backdrop-filter:blur(30px)}.eyebrow,.tree-title{font-size:9px;color:#656a77;letter-spacing:.12em;padding:8px}.model-row{width:100%;display:flex;align-items:center;gap:10px;padding:10px;border-radius:10px;background:transparent;text-align:left}.model-row:hover,.model-row.selected{background:rgba(255,255,255,.055)}.model-row>span{color:#b8a7ff}.model-row div{flex:1}.model-row b,.model-row small{display:block}.model-row b{font-size:12px}.model-row small{font-size:10px;color:#747985;margin-top:3px}.model-row i{font-style:normal;color:#8ee6ae}.model-menu>a{display:block;color:#999; font-size:10px;padding:9px;text-decoration:none}.workspace{height:calc(100vh - 64px);display:flex;position:relative}.chat-pane{width:var(--chat-width);min-width:300px;display:flex;justify-content:center;transition:width .28s ease}.chat-pane.centered{width:100%}.chat-inner{width:min(760px,calc(100% - 44px));display:flex;flex-direction:column;height:100%;position:relative}.has-chat .chat-inner{width:calc(100% - 32px)}.welcome{margin:auto 0 46px;text-align:center}.welcome-orb{width:58px;height:58px;margin:0 auto 24px;border:1px solid rgba(167,139,250,.38);border-radius:18px;background:linear-gradient(145deg,rgba(167,139,250,.16),rgba(34,211,238,.06));box-shadow:0 0 60px rgba(139,92,246,.12);color:#c4b5fd;font-size:22px}.welcome h1{font-size:clamp(34px,5vw,58px);margin:0;letter-spacing:-.06em}.welcome p{max-width:600px;margin:14px auto 28px;color:#80848f;line-height:1.7;font-size:14px}.starter-row{display:flex;gap:8px;justify-content:center;flex-wrap:wrap}.starter-row button{background:#0e1016;border:1px solid var(--line);padding:10px 12px;border-radius:10px;color:#a1a5b0;font-size:10px}.starter-row button:hover{border-color:rgba(167,139,250,.35);color:#fff}.messages{overflow:auto;flex:1;padding:42px 4px 170px;scrollbar-width:thin}.bubble{max-width:92%;margin:0 0 22px;padding:15px 17px;border-radius:15px;border:1px solid var(--line);font-size:13px;line-height:1.75;white-space:pre-wrap}.bubble.user{margin-left:auto;background:#161821}.bubble.assistant{background:rgba(12,14,19,.72)}.bubble-label{display:block;color:#666b77;font-size:8px;letter-spacing:.12em;margin-bottom:5px}.typing{color:#858894;font-size:11px;display:flex;gap:4px;align-items:center}.typing span{width:5px;height:5px;background:#9b8af2;border-radius:50%;animation:pulse 1s infinite}.typing span:nth-child(2){animation-delay:.15s}.typing span:nth-child(3){animation-delay:.3s}@keyframes pulse{50%{opacity:.25;transform:translateY(-2px)}}.error{border:1px solid rgba(248,113,113,.22);background:rgba(127,29,29,.1);border-radius:12px;padding:12px;margin:10px 0;display:flex;gap:10px;align-items:center;font-size:11px}.error span{color:#a6a8b0;flex:1}.error button{background:#fff;color:#111;padding:6px 9px;border-radius:7px;font-size:10px}.composer-wrap{position:absolute;left:0;right:0;bottom:28px}.composer{background:rgba(16,18,24,.9);border:1px solid rgba(255,255,255,.12);border-radius:16px;box-shadow:0 20px 70px rgba(0,0,0,.4),inset 0 1px 0 rgba(255,255,255,.04);padding:11px 12px;backdrop-filter:blur(25px)}.composer textarea{width:100%;resize:none;border:0;outline:0;background:transparent;color:#fff;font-size:14px;line-height:1.5;min-height:28px;max-height:120px}.composer textarea::placeholder{color:#686c77}.composer-bottom{display:flex;align-items:center;gap:8px;margin-top:8px;color:#656a75;font-size:9px}.composer-bottom>span{margin-left:auto}.tool{background:transparent;color:#777b87;font-size:10px;padding:5px 7px;border-radius:6px}.tool.active{background:#1a1d27;color:#c7bbff}.send{width:31px;height:31px;border-radius:9px;background:#fff;color:#08090c;font-weight:900}.composer-hint{text-align:center;color:#4f535e;font-size:9px;margin-top:8px}.splitter{width:8px;cursor:col-resize;display:grid;place-items:center;background:#08090d;border-left:1px solid var(--line);border-right:1px solid var(--line);z-index:8}.splitter span{color:#50545e;font-size:12px}.preview-pane{flex:1;min-width:360px;background:#090a0f;display:flex;flex-direction:column}.preview-head{height:48px;border-bottom:1px solid var(--line);display:flex;align-items:center;justify-content:space-between;padding:0 14px}.preview-title{font-size:11px;display:flex;align-items:center;gap:8px}.device-tabs{display:flex;gap:4px}.device-tabs button{background:#11131a;border:1px solid var(--line);color:#767b86;border-radius:7px;padding:5px 8px;font-size:10px}.device-tabs button.active{color:#fff;background:#1b1e27}.preview-stage{flex:1;display:grid;place-items:center;padding:28px;background:radial-gradient(500px 300px at 50% 30%,rgba(108,92,231,.08),transparent 70%)}.device-frame{height:calc(100vh - 165px);width:100%;max-width:100%;border:1px solid rgba(255,255,255,.1);border-radius:12px;overflow:hidden;background:#fff;box-shadow:0 30px 100px rgba(0,0,0,.45);transition:.25s}.device-frame.tablet{width:760px;max-width:82%}.device-frame.mobile{width:390px;max-width:65%}.device-frame iframe{width:100%;height:100%;border:0;background:#fff}.code-workspace{flex:1;display:flex;min-height:0}.file-tree{width:175px;border-right:1px solid var(--line);padding:10px;display:flex;flex-direction:column}.file{background:transparent;color:#777b86;text-align:left;padding:8px 9px;border-radius:7px;font-size:11px}.file span{display:inline-block;width:24px;color:#9e8cff;font-size:9px}.file.active,.file:hover{background:#14161e;color:#fff}.tree-spacer{flex:1}.reset-code{font-size:9px;color:#666b75;background:transparent;text-align:left;padding:8px}.editor{flex:1;min-width:0;background:#0a0b10;overflow:auto}.editor-top{height:38px;border-bottom:1px solid var(--line);display:flex;justify-content:space-between;align-items:center;padding:0 14px;color:#777b86;font-size:9px}.editor pre{margin:0;padding:14px 0;font:12px/1.7 ui-monospace,SFMono-Regular,Consolas,monospace}.line{display:flex;min-width:max-content}.line>i{width:50px;text-align:right;padding-right:15px;color:#343844;font-style:normal;user-select:none}.line>b{font-weight:400;color:#aeb1bb}.code-tag,.code-key{color:#c4a7ff}.code-attr,.code-prop{color:#75d7ff}.code-string{color:#a5e6a1}.code-number{color:#ff9fc1}.search-drawer{position:fixed;right:18px;top:76px;width:340px;max-height:calc(100vh - 94px);overflow:auto;background:rgba(15,17,23,.97);border:1px solid var(--line);border-radius:16px;padding:12px;z-index:40;box-shadow:0 30px 100px #0008;backdrop-filter:blur(25px)}.drawer-head{display:flex;justify-content:space-between;align-items:center;font-size:12px;padding:4px}.drawer-head button{background:transparent;color:#777;font-size:18px}.search-box{display:flex;gap:6px;margin:12px 0}.search-box input{flex:1;background:#090a0f;border:1px solid var(--line);border-radius:9px;padding:9px;color:#fff;outline:0;font-size:11px}.search-box button{width:36px;border-radius:9px;background:#fff;color:#08090d}.source{display:block;padding:10px;border:1px solid var(--line);border-radius:10px;margin:7px 0;text-decoration:none;color:#fff;background:#0b0d12}.source b,.source small,.source span{display:block}.source b{font-size:11px}.source small{color:#666b75;font-size:8px;margin:4px 0}.source span{color:#8d919d;font-size:9px;line-height:1.5}.drawer-note{color:#70747f;font-size:10px;line-height:1.7}.modal-backdrop{position:fixed;inset:0;background:#0009;backdrop-filter:blur(10px);z-index:50;display:grid;place-items:center}.publish-modal{width:min(430px,calc(100% - 32px));background:#11131a;border:1px solid var(--line);border-radius:20px;padding:24px;box-shadow:0 40px 140px #000b}.modal-icon{width:42px;height:42px;display:grid;place-items:center;border-radius:12px;background:#fff;color:#111}.publish-modal h2{margin:18px 0 7px;font-size:22px}.publish-modal p{color:#777b86;font-size:11px;line-height:1.6;margin:0 0 18px}.publish-modal label{display:block;color:#777b86;font-size:9px;margin:10px 0}.publish-modal input{display:block;width:100%;margin-top:6px;background:#090a0f;border:1px solid var(--line);border-radius:9px;padding:10px;color:#fff;outline:0;font-size:11px}.wide{width:100%;justify-content:center;margin-top:12px}.publish-result{margin-top:10px;padding:10px;border-radius:9px;background:#0b0d12;color:#8ee6ae;font-size:10px;word-break:break-word}.modal-close{width:100%;margin-top:7px;background:transparent;color:#666b75;font-size:10px;padding:8px}@media(max-width:900px){.top-center{display:none}.chat-pane{width:100%!important}.preview-pane,.splitter{display:none}.chat-inner{width:min(760px,calc(100% - 24px))}.model-menu{right:10px}.welcome{margin-bottom:120px}.starter-row{display:grid}.device-frame{height:calc(100vh - 150px)}}
`
