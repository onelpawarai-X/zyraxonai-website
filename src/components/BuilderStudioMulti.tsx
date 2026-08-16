import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import Editor from '@monaco-editor/react'

type Role = 'user' | 'assistant'
type Theme = 'dark' | 'light'
type Device = 'desktop' | 'tablet' | 'mobile'
type Mode = 'bolt' | 'plan'
type Source = { title: string; url: string; snippet?: string; kind?: string }
type Message = { id: string; role: Role; content: string; sources?: Source[] }
type FileState = Record<string, string>
type Activity = { id: string; label: string; detail?: string; state: 'running' | 'done' | 'error' }

type Model = { id: string; name: string; note: string }
const MODELS: Model[] = [
  { id: 'zyraxon-titan', name: 'ZYRAXON TITAN', note: 'Balanced builder' },
  { id: 'zyraxon-phantom', name: 'ZYRAXON PHANTOM', note: 'Deep reasoning' },
  { id: 'zyraxon-velocity', name: 'ZYRAXON VELOCITY', note: 'Ultra-fast building' },
]
const STARTER: FileState = {
  'index.html': '<!doctype html>\n<html>\n<head>\n  <meta charset="UTF-8">\n  <meta name="viewport" content="width=device-width,initial-scale=1">\n  <title>ZYRAXON</title>\n</head>\n<body>\n  <main><h1>Start with an idea.</h1><p>Describe the website you want ZYRAXON AI to build.</p></main>\n</body>\n</html>',
}
const uid = (p: string) => `${p}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`

const BOLT_SYSTEM = `You are ZYRAXON AI Bolt mode. Execute the user's requested build/change/fix as directly and efficiently as possible. Talk briefly while working and produce working files, not long explanations. Prefer the smallest reliable implementation that achieves a premium, fast, polished result. When code is needed, output EACH actual file exactly once in its own fenced code block and put a filename marker on the first line, e.g. <!-- file: src/index.html -->, /* file: src/styles.css */, or // file: src/app.js. Use the real filename and path. Never invent a fixed three-file project structure. Create as many files as the implementation genuinely needs. Never duplicate a file. Keep generated code out of prose. Preserve existing files unless the user asks to remove them.`
const PLAN_SYSTEM = `You are ZYRAXON AI Plan mode. Planning only. Do NOT create, modify, replace, publish, or execute files and do NOT claim that work was performed. Return a concise, actionable implementation plan describing what would be changed, file paths that would likely be involved, dependencies, UI behavior, and verification steps. Do not output implementation code unless a tiny illustrative snippet is absolutely necessary.`

function fileIcon(name: string) {
  const ext = name.split('.').pop()?.toLowerCase() || ''
  const common = 'width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"'
  if (ext === 'html' || ext === 'htm') return <svg {...({} as any)} {...({ dangerouslySetInnerHTML: { __html: `<svg ${common}><path d="M4 3h11l5 5v13H4z"/><path d="M15 3v6h5"/><path d="m8 13 2 2-2 2m5-4-2 2 2 2"/></svg>` } } as any)} />
  if (ext === 'css' || ext === 'scss' || ext === 'sass') return <svg {...({} as any)} dangerouslySetInnerHTML={{ __html: `<svg ${common}><path d="M4 3h16v18H4z"/><path d="m9 8-3 4 3 4m6-8 3 4-3 4"/></svg>` }} />
  if (ext === 'js' || ext === 'jsx' || ext === 'ts' || ext === 'tsx') return <svg {...({} as any)} dangerouslySetInnerHTML={{ __html: `<svg ${common}><path d="M4 3h16v18H4z"/><path d="M8 17v-5l3 5v-5m4 0v5m0-2h3"/></svg>` }} />
  if (ext === 'json') return <svg {...({} as any)} dangerouslySetInnerHTML={{ __html: `<svg ${common}><path d="M5 3h14v18H5z"/><path d="m9 8-2 4 2 4m6-8 2 4-2 4"/></svg>` }} />
  if (ext === 'md') return <svg {...({} as any)} dangerouslySetInnerHTML={{ __html: `<svg ${common}><path d="M4 5h16v14H4z"/><path d="M7 15V9l3 3 3-3v6m3-3h2"/></svg>` }} />
  return <svg {...({} as any)} dangerouslySetInnerHTML={{ __html: `<svg ${common}><path d="M5 3h9l5 5v13H5z"/><path d="M14 3v6h5"/></svg>` }} />
}

function parseFiles(text: string, previous: FileState): FileState {
  const next = { ...previous }
  const re = /```(?:[\w.+-]+)?\s*\n?([\s\S]*?)(?:```|$)/g
  let m: RegExpExecArray | null
  while ((m = re.exec(text))) {
    let body = m[1].trim()
    const marker = body.match(/^(?:<!--|\/\*|\/\/|#)\s*file:\s*([^\n]+?)(?:\s*-->|\s*\*\/)?\s*\n/i)
    if (!marker) continue
    const name = marker[1].trim().replace(/^['"]|['"]$/g, '')
    body = body.slice(marker[0].length).trim()
    if (name && body) next[name] = body
  }
  return next
}

function fileStateChanged(next: FileState, previous: FileState) {
  const nextKeys = Object.keys(next)
  const previousKeys = Object.keys(previous)
  if (nextKeys.length !== previousKeys.length) return true
  return nextKeys.some(key => next[key] !== previous[key])
}

function buildPreview(files: FileState) {
  let htmlKey = Object.keys(files).find(k => /(^|\/)index\.html?$/i.test(k)) || Object.keys(files).find(k => k.toLowerCase().endsWith('.html'))
  if (!htmlKey) htmlKey = 'index.html'
  let html = files[htmlKey] || ''
  const css = Object.entries(files).filter(([k]) => /\.(css|scss)$/i.test(k)).map(([,v]) => v).join('\n')
  const js = Object.entries(files).filter(([k]) => /\.(js|jsx|ts|tsx)$/i.test(k)).map(([,v]) => v).join('\n')
  if (css && !/<style[\s>]/i.test(html)) html = html.replace(/<\/head>/i, `<style>${css}</style></head>`)
  if (js && !/<script[\s>]/i.test(html)) html = html.replace(/<\/body>/i, `<script>${js}</script></body>`)
  const bridge = `<script>(function(){document.addEventListener('click',function(e){var a=e.target&&e.target.closest&&e.target.closest('a');if(!a)return;var h=a.getAttribute('href')||'';if(h&&(!/^[a-z][a-z0-9+.-]*:/i.test(h)||h.startsWith(location.origin))){e.preventDefault();e.stopPropagation();try{history.pushState({},'',h)}catch(_){}}},true);document.addEventListener('submit',function(e){e.preventDefault();e.stopPropagation()},true);window.addEventListener('error',function(e){try{parent.postMessage({source:'zyraxon-preview',type:'error',message:e.message||'Preview error'},'*')}catch(_){}});})();</script>`
  return /<\/body>/i.test(html) ? html.replace(/<\/body>/i, bridge + '</body>') : html + bridge
}

async function streamSse(response: Response, onDelta: (full: string) => void) {
  const reader = response.body?.getReader(); if (!reader) throw new Error('Streaming is unavailable from this provider.')
  const decoder = new TextDecoder(); let buffer = ''; let full = ''
  const consume = (line: string) => { const payload = line.trim().replace(/^data:\s?/, ''); if (!payload || payload === '[DONE]') return; try { const json = JSON.parse(payload); const delta = json?.choices?.[0]?.delta?.content ?? json?.choices?.[0]?.message?.content ?? ''; if (typeof delta === 'string' && delta) { full += delta; onDelta(full) } } catch {} }
  while (true) { const { done, value } = await reader.read(); if (done) break; buffer += decoder.decode(value, { stream: true }); const lines = buffer.split(/\r?\n/); buffer = lines.pop() || ''; lines.forEach(consume) }
  if (buffer.trim()) consume(buffer); return full
}

export default function BuilderStudioMulti() {
  const [theme, setTheme] = useState<Theme>('dark')
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [model, setModel] = useState(MODELS[0].id)
  const mode: Mode = 'bolt'
  const [files, setFiles] = useState<FileState>(STARTER)
  const [activeFile, setActiveFile] = useState('index.html')
  const [device, setDevice] = useState<Device>('desktop')
  const [view, setView] = useState<'preview' | 'code'>('preview')
  const [modelOpen, setModelOpen] = useState(false)
  const [publishOpen, setPublishOpen] = useState(false)
  const [githubToken, setGithubToken] = useState('')
  const [repo, setRepo] = useState('')
  const [publishState, setPublishState] = useState('')
  const [streaming, setStreaming] = useState(false)
  const [error, setError] = useState('')
  const [activities, setActivities] = useState<Activity[]>([])
  const [sources, setSources] = useState<Source[]>([])
  const [searching, setSearching] = useState(false)
  const [split, setSplit] = useState(44)
  const abortRef = useRef<AbortController | null>(null)
  const dragRef = useRef(false)
  const current = MODELS.find(x => x.id === model) || MODELS[0]
  const preview = useMemo(() => buildPreview(files), [files])
  const fileNames = Object.keys(files)
  const hasChat = messages.length > 0

  useEffect(() => { try { const t = sessionStorage.getItem('zyraxon.builder.theme'); if (t === 'dark' || t === 'light') setTheme(t); const f = sessionStorage.getItem('zyraxon.builder.files'); if (f) setFiles(JSON.parse(f)); const c = sessionStorage.getItem('zyraxon.builder.chat'); if (c) setMessages(JSON.parse(c)) } catch {} }, [])
  useEffect(() => {
    try {
      sessionStorage.setItem('zyraxon.builder.theme', theme)
      if (!streaming) {
        sessionStorage.setItem('zyraxon.builder.files', JSON.stringify(files))
        sessionStorage.setItem('zyraxon.builder.chat', JSON.stringify(messages.slice(-40)))
      }
    } catch {}
  }, [theme, files, messages, streaming])
  useEffect(() => { const move = (e: PointerEvent) => { if (dragRef.current) setSplit(Math.min(68, Math.max(32, (e.clientX / window.innerWidth) * 100))) }; const up = () => { dragRef.current = false }; window.addEventListener('pointermove', move); window.addEventListener('pointerup', up); return () => { window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', up) } }, [])

  const addActivity = (label: string, detail?: string) => { const item = { id: uid('a'), label, detail, state: 'running' as const }; setActivities(p => [...p, item]); return item.id }
  const finish = (id: string, state: Activity['state'] = 'done', detail?: string) => setActivities(p => p.map(a => a.id === id ? { ...a, state, detail } : a))

  const searchWeb = useCallback(async (query: string) => {
    if (!query.trim() || searching) return [] as Source[]
    setSearching(true); const id = addActivity('AI web research', query)
    try { const r = await fetch(`/api/public/builder/search?q=${encodeURIComponent(query)}`); const data = await r.json(); if (!r.ok) throw new Error(data?.error || 'Search failed'); const result = Array.isArray(data.results) ? data.results as Source[] : []; setSources(result); finish(id, 'done', `${result.length} sources found`); return result }
    catch (e: any) { finish(id, 'error', e?.message || 'Search failed'); return [] }
    finally { setSearching(false) }
  }, [searching])

  const send = useCallback(async () => {
    const text = input.trim(); if (!text || streaming) return
    setInput(''); setError(''); setModelOpen(false)
    const userId = uid('u'), assistantId = uid('ai')
    const context = messages.slice(-18).map(m => ({ role: m.role, content: m.content }))
    setMessages(p => [...p, { id: userId, role: 'user', content: text }, { id: assistantId, role: 'assistant', content: '' }])
    if (mode === 'plan') {
      setStreaming(true); const planId = addActivity('Planning only', 'No files will be changed')
      try {
        const r = await fetch('/api/public/builder/chat', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ model, messages: [{ role: 'system', content: PLAN_SYSTEM }, ...context, { role: 'user', content: text }] }) })
        if (!r.ok) { const d = await r.json().catch(() => null); throw new Error(d?.error || `Provider returned HTTP ${r.status}`) }
        await streamSse(r, v => setMessages(p => p.map(m => m.id === assistantId ? { ...m, content: v } : m)))
        finish(planId, 'done', 'Plan complete — no files changed')
      } catch (e: any) { const msg = e?.message || 'Planning failed'; setError(msg); finish(planId, 'error', msg) }
      finally { setStreaming(false) }
      return
    }
    setStreaming(true)
    const controller = new AbortController(); abortRef.current = controller
    const connect = addActivity('Connecting to model', current.name), stream = addActivity('Bolt implementation', 'Live file streaming'), previewId = addActivity('Live preview', 'Waiting for files')
    try {
      const wantsSearch = /\b(search|latest|current|today|news|research|source|reference|image|video|price|documentation|browse|find|website)\b/i.test(text)
      const web = wantsSearch ? await searchWeb(text) : []
      finish(connect, 'done')
      let prompt = text
      if (web.length) prompt += `\n\nUse these references when relevant:\n${web.map(s => `- ${s.title}: ${s.url}${s.snippet ? ` — ${s.snippet}` : ''}`).join('\n')}`
      const response = await fetch('/api/public/builder/chat', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ model, messages: [{ role: 'system', content: BOLT_SYSTEM }, ...context, { role: 'user', content: prompt }] }), signal: controller.signal })
      if (!response.ok) { const d = await response.json().catch(() => null); throw new Error(d?.error || `Provider returned HTTP ${response.status}`) }
      let latest = ''; let live = files
      await streamSse(response, value => { latest = value; const parsed = parseFiles(value, live); if (fileStateChanged(parsed, live)) { live = parsed; setFiles(parsed); const newest = Object.keys(parsed).filter(k => !(k in files) || parsed[k] !== files[k]); if (newest[0]) setActiveFile(newest[0]); finish(previewId, 'done', `${newest.slice(-3).join(', ')} updated`) } setMessages(p => p.map(m => m.id === assistantId ? { ...m, content: value, sources: web } : m)) })
      finish(stream, 'done', 'Stream complete'); if (!latest) throw new Error('The model returned an empty response.')
    } catch (e: any) { if (e?.name !== 'AbortError') { const msg = e?.message || 'Generation failed'; setError(msg); finish(connect, 'error', msg); finish(stream, 'error', msg); finish(previewId, 'error', 'No preview update') } }
    finally { setStreaming(false); abortRef.current = null }
  }, [input, streaming, mode, messages, model, current.name, files, searchWeb])

  const publish = async () => {
    if (!githubToken.trim() || !repo.trim()) { setPublishState('Enter your GitHub token and repository name.'); return }
    setPublishState('Publishing…')
    try { const name = repo.trim().replace(/\.git$/, '').split('/').filter(Boolean).at(-1) || repo.trim(); const r = await fetch('/api/public/builder/publish', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ token: githubToken.trim(), repo: name, html: preview }) }); const d = await r.json(); if (!r.ok || !d.ok) throw new Error(d?.error || 'GitHub publish failed'); setPublishState(d.pagesUrl || d.repoUrl || 'Published successfully.') } catch (e: any) { setPublishState(e?.message || 'GitHub publish failed') }
  }

  const reset = () => { abortRef.current?.abort(); setMessages([]); setFiles(STARTER); setActiveFile('index.html'); setSources([]); setActivities([]); setError(''); setView('preview') }

  return <div className={`zyraxon-builder ${theme}`}>
    <style>{CSS}</style>
    <header className="zb-topbar glass">
      <a className="zb-brand" href="/"><span className="zb-mark">Z</span><span className="brand-name">ZYRAXON</span><span className="brand-sub">AI BUILDER</span></a>
      <div className="top-title">Builder Studio</div>
      <div className="top-actions">
        <button className={`glass-btn ${view === 'preview' ? 'active' : ''}`} onClick={() => setView('preview')}>Preview</button>
        <button className={`glass-btn ${view === 'code' ? 'active' : ''}`} onClick={() => setView('code')}>Code</button>
        <button className="glass-btn publish-top" onClick={() => setPublishOpen(true)}>Publish</button>
      </div>
    </header>

    <main className={`zb-workspace ${hasChat ? 'has-chat' : 'empty'}`}>
      <aside className="zb-sidebar glass" aria-label="Builder navigation">
        <a className="sidebar-logo" href="/" aria-label="Zyraxon home"><span className="zb-mark">Z</span><span>ZYRAXON</span></a>
        <nav className="sidebar-nav">
          <button className="sidebar-item active" onClick={() => { setView('preview'); setMessages([]) }}><span className="sidebar-icon">⌂</span><span>New build</span></button>
          <button className="sidebar-item" onClick={() => setView('preview')}><span className="sidebar-icon">◫</span><span>Preview</span></button>
          <button className="sidebar-item" onClick={() => setView('code')}><span className="sidebar-icon">⌘</span><span>Code</span></button>
        </nav>
        <div className="sidebar-section"><span className="sidebar-label">Workspace</span><button className="sidebar-item" onClick={() => setPublishOpen(true)}><span className="sidebar-icon">↗</span><span>Publish</span></button><button className="sidebar-item" onClick={reset}><span className="sidebar-icon">↺</span><span>Reset build</span></button></div>
        <div className="sidebar-bottom"><span className="status-dot"/> <span>OpenCode connected</span></div>
      </aside>
      <section className="chat-pane">
        <div className="chat-scroll">
          {!hasChat ? <div className="welcome"><div className="hero-z">Z</div><h1>What will you build?</h1><p>Describe it. ZYRAXON builds it live, streams the work, and keeps the result inside a protected preview.</p><div className="suggestions"><button onClick={() => setInput('Build a premium AI SaaS landing page')}>AI SaaS</button><button onClick={() => setInput('Build a modern developer portfolio')}>Portfolio</button><button onClick={() => setInput('Build a luxury product website')}>Product</button></div></div> : <div className="messages">{messages.map(m => <article className={`message ${m.role}`} key={m.id}><div className="message-label">{m.role === 'assistant' ? 'ZYRAXON AI' : 'YOU'}</div>{m.role === 'assistant' && !m.content ? <div className="thinking"><i/>Working live…</div> : <div className="message-content">{m.role === 'assistant' ? <AssistantContent content={m.content} /> : <div>{m.content}</div>}</div>}{m.sources?.length ? <div className="source-row">{m.sources.slice(0, 4).map(s => <a key={s.url} href={s.url} target="_blank" rel="noreferrer">{s.title}</a>)}</div> : null}</article>)}{error && <div className="error-card"><b>Generation paused</b><span>{error}</span></div>}</div>}
        </div>
        <div className="composer glass">
          <textarea value={input} rows={1} placeholder={mode === 'plan' ? 'Describe what you want planned…' : 'Ask ZYRAXON to build, change, fix or research…'} onChange={e => setInput(e.target.value)} onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send() } }} />
          <div className="composer-row">
            <div className="composer-left">
              <div className="composer-tools" role="toolbar" aria-label="Build tools">
                <button className={`tool-btn ${searching ? 'active' : ''}`} type="button" onClick={() => setInput(v => v ? `${v} — search the web for current references` : 'Search the web for references before building')} aria-label="Web search"><span>◌</span><small>Web search</small></button>
                <button className="tool-btn" type="button" onClick={() => setInput(v => `${v} Include relevant image, video, and audio media where useful.`.trim())} aria-label="Add media"><span>▧</span><small>Media</small></button>
                <button className="tool-btn" type="button" onClick={() => { const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition; if (!SpeechRecognition) { setError('Voice input is not supported in this browser.'); return } const recognition = new SpeechRecognition(); recognition.lang = 'en-US'; recognition.onresult = (event: any) => setInput(event.results?.[0]?.[0]?.transcript || ''); recognition.start() }} aria-label="Voice input"><span>◉</span><small>Mic</small></button>
              </div>
              <div className="model-wrap"><button className="model-btn" aria-haspopup="listbox" aria-expanded={modelOpen} onClick={() => setModelOpen(x => !x)}>{current.name}<span aria-hidden="true">⌄</span></button>{modelOpen && <div className="popover model-pop" role="listbox">{MODELS.map(m => <button key={m.id} role="option" aria-selected={m.id === model} className={m.id === model ? 'selected' : ''} onClick={() => { setModel(m.id); setModelOpen(false) }}><b>{m.name}</b><small>{m.note}</small></button>)}</div>}</div>
            </div>
            <button className="send-btn" disabled={!input.trim() && !streaming} onClick={() => streaming ? abortRef.current?.abort() : send()}>{streaming ? '■' : '↑'}</button>
          </div>
        </div>
        <div className="composer-hint">Enter to send · Shift + Enter for a new line · web access is automatic</div>
      </section>

      {hasChat && <div className="splitter" onPointerDown={() => { dragRef.current = true }}/>} 
      <section className="studio-pane glass">
        <div className="studio-head">
          <div className="studio-tabs"><button className={view === 'preview' ? 'active' : ''} onClick={() => setView('preview')}>Preview</button><button className={view === 'code' ? 'active' : ''} onClick={() => setView('code')}>Code</button></div>
          <div className="device-tabs"><button className={device === 'desktop' ? 'active' : ''} onClick={() => setDevice('desktop')} aria-label="Desktop">▱</button><button className={device === 'tablet' ? 'active' : ''} onClick={() => setDevice('tablet')} aria-label="Tablet">▯</button><button className={device === 'mobile' ? 'active' : ''} onClick={() => setDevice('mobile')} aria-label="Mobile">▯</button></div>
        </div>
        {view === 'preview' ? <div className="preview-stage"><div className={`preview-frame ${device}`}><iframe title="ZYRAXON live preview" sandbox="allow-scripts allow-forms" srcDoc={preview} /></div></div> : <div className="code-workspace"><aside className="file-tree"><div className="tree-title">FILES <span>{fileNames.length}</span></div>{fileNames.map(name => <button className={activeFile === name ? 'active' : ''} key={name} onClick={() => setActiveFile(name)}><span className="real-icon">{fileIcon(name)}</span><span>{name}</span></button>)}</aside><div className="editor"><div className="editor-head"><span>{activeFile}</span><small>{files[activeFile]?.split('\n').length || 0} lines</small></div><Editor height="100%" theme={theme === 'dark' ? 'vs-dark' : 'light'} language={activeFile.endsWith('.css') ? 'css' : activeFile.endsWith('.json') ? 'json' : /\.(js|jsx|ts|tsx)$/.test(activeFile) ? 'typescript' : 'html'} value={files[activeFile] || ''} onChange={v => setFiles(p => ({ ...p, [activeFile]: v || '' }))} options={{ minimap: { enabled: false }, fontSize: 13, padding: { top: 16 }, wordWrap: 'on', automaticLayout: true, smoothScrolling: true, scrollBeyondLastLine: false }} /></div></div>}
      </section>
    </main>

    {publishOpen && <div className="modal-backdrop" onMouseDown={e => { if (e.target === e.currentTarget) setPublishOpen(false) }}><div className="publish-modal glass"><div className="modal-head"><b>Publish to GitHub</b><button onClick={() => setPublishOpen(false)}>×</button></div><input placeholder="GitHub token" value={githubToken} onChange={e => setGithubToken(e.target.value)} type="password"/><input placeholder="Repository name" value={repo} onChange={e => setRepo(e.target.value)}/><button className="publish-now" onClick={publish}>Publish</button>{publishState && <small>{publishState}</small>}</div></div>}
  </div>
}

function AssistantContent({ content }: { content: string }) {
  const blocks: React.ReactNode[] = []
  const re = /```([\w.+-]*)\s*\n?([\s\S]*?)(?:```|$)/g
  let last = 0; let i = 0; let m: RegExpExecArray | null
  while ((m = re.exec(content))) {
    const text = content.slice(last, m.index).trim(); if (text) blocks.push(<p key={`t${i}`}>{text}</p>)
    let body = m[2].trim(); const marker = body.match(/^(?:<!--|\/\*|\/\/|#)\s*file:\s*([^\n]+?)(?:\s*-->|\s*\*\/)?\s*\n/i); const name = marker?.[1]?.trim() || 'generated file'; if (marker) body = body.slice(marker[0].length).trim()
    blocks.push(<div className="inline-file" key={`c${i}`}><div><span>⌘</span><b>{name}</b><small>{body.split('\n').length} lines · click Code to inspect</small></div></div>); last = re.lastIndex; i++
  }
  const tail = content.slice(last).trim(); if (tail) blocks.push(<p key="tail">{tail}</p>)
  return <>{blocks.length ? blocks : <p>{content}</p>}</>
}

const CSS = `
:root{color-scheme:dark}
.zb-sidebar{grid-area:sidebar;display:flex;flex-direction:column;gap:24px;padding:18px 12px;border-radius:22px;min-width:190px}.sidebar-logo{display:flex;align-items:center;gap:9px;color:var(--text);text-decoration:none;font-weight:800;letter-spacing:.08em;padding:5px}.sidebar-logo .zb-mark{width:28px;height:28px}.sidebar-nav,.sidebar-section{display:flex;flex-direction:column;gap:5px}.sidebar-label{font-size:10px;text-transform:uppercase;letter-spacing:.18em;color:var(--soft);padding:0 10px 7px}.sidebar-item{display:flex;align-items:center;gap:10px;border:0;background:transparent;color:var(--muted);border-radius:11px;padding:10px;font-size:12px;text-align:left;cursor:pointer}.sidebar-item:hover,.sidebar-item.active{background:rgba(101,232,255,.1);color:var(--text)}.sidebar-icon{width:18px;text-align:center;color:#65e8ff;font-size:16px}.sidebar-bottom{margin-top:auto;border-top:1px solid var(--line);padding:14px 8px;color:var(--soft);font-size:10px;display:flex;align-items:center;gap:7px}.status-dot{width:7px;height:7px;border-radius:50%;background:#65e8ff;box-shadow:0 0 12px #65e8ff}.composer-tools{display:flex;align-items:center;gap:4px}.zb-workspace{display:grid!important;grid-template-columns:190px minmax(320px,480px) minmax(0,1fr);grid-template-areas:'sidebar chat studio';gap:12px!important}.chat-pane{grid-area:chat!important}.studio-pane{grid-area:studio!important}.zb-sidebar+.chat-pane{min-width:0}.composer-row{gap:8px}.composer-left{min-width:0;display:flex;align-items:center;gap:8px}.model-btn{max-width:190px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.zyraxon-builder button{cursor:pointer}.zyraxon-builder button:focus-visible{outline:2px solid #65e8ff;outline-offset:2px}
@media (max-width:1100px){.zb-workspace{grid-template-columns:64px minmax(300px,430px) minmax(0,1fr)}.zb-sidebar{min-width:64px;padding:14px 8px}.sidebar-logo span:not(.zb-mark),.sidebar-item span:last-child,.sidebar-label,.sidebar-bottom span:last-child{display:none}.sidebar-item{justify-content:center}.sidebar-bottom{justify-content:center}}
@media (max-width:760px){.zb-workspace{display:flex!important;flex-direction:column;overflow:auto}.zb-sidebar{order:0;min-width:0;flex-direction:row;align-items:center;padding:8px;gap:8px}.sidebar-nav,.sidebar-section{flex-direction:row}.sidebar-bottom{margin:0 0 0 auto;border:0;padding:8px}.chat-pane{min-height:520px}.studio-pane{min-height:520px}.tool-btn small{display:none}}
.composer-tools{display:flex;align-items:center;gap:4px}.tool-btn{display:flex;align-items:center;gap:5px;border:1px solid transparent;background:transparent;color:var(--soft);border-radius:9px;padding:6px 7px;cursor:pointer}.tool-btn:hover,.tool-btn.active{border-color:rgba(101,232,255,.25);background:rgba(101,232,255,.08);color:var(--text)}.tool-btn span{color:#65e8ff}.tool-btn small{font-size:10px}.zyraxon-builder button{cursor:pointer}.zyraxon-builder button:focus-visible{outline:2px solid #65e8ff;outline-offset:2px}
:root{color-scheme:dark}*{box-sizing:border-box}.zyraxon-builder{height:100vh;min-height:680px;overflow:hidden;font-family:Inter,ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;background:#050505;color:#f7f7f7;--bg:#050505;--panel:rgba(13,13,13,.76);--panel2:rgba(20,20,20,.62);--line:rgba(255,255,255,.105);--line2:rgba(255,255,255,.16);--text:#f7f7f7;--muted:#a3a3a3;--soft:#737373;--shadow:0 24px 80px rgba(0,0,0,.52);--glow:rgba(255,255,255,.075)}.zyraxon-builder.light{color-scheme:light;background:#e9e9e7;color:#151515;--bg:#e9e9e7;--panel:rgba(255,255,255,.72);--panel2:rgba(255,255,255,.58);--line:rgba(0,0,0,.1);--line2:rgba(0,0,0,.17);--text:#151515;--muted:#5f5f5f;--soft:#858585;--shadow:0 24px 80px rgba(0,0,0,.14);--glow:rgba(255,255,255,.7)}button,input,textarea{font:inherit}.glass{background:linear-gradient(135deg,rgba(255,255,255,.075),rgba(255,255,255,.025) 46%,rgba(0,0,0,.2));border:1px solid var(--line);box-shadow:inset 0 1px rgba(255,255,255,.08),0 20px 70px rgba(0,0,0,.28);backdrop-filter:blur(28px) saturate(130%);-webkit-backdrop-filter:blur(28px) saturate(130%)}.light .glass{background:linear-gradient(135deg,rgba(255,255,255,.86),rgba(255,255,255,.58));box-shadow:inset 0 1px rgba(255,255,255,.9),0 20px 70px rgba(0,0,0,.08)}.zb-topbar{height:68px;margin:12px 14px 0;border-radius:20px;display:flex;align-items:center;padding:0 18px;position:relative;z-index:20}.zb-brand{display:flex;align-items:center;gap:9px;color:inherit;text-decoration:none}.zb-mark{width:31px;height:31px;border:1px solid var(--line2);border-radius:10px;display:grid;place-items:center;font-weight:800;background:rgba(255,255,255,.055);box-shadow:0 0 24px rgba(255,255,255,.07)}.brand-name{font-weight:800;letter-spacing:.06em}.brand-sub{font-size:10px;color:var(--muted);letter-spacing:.18em}.top-title{position:absolute;left:50%;transform:translateX(-50%);font-size:12px;color:var(--muted);letter-spacing:.08em}.top-actions{margin-left:auto;display:flex;gap:7px}.glass-btn,.mode-btn,.model-btn{border:1px solid var(--line);background:rgba(255,255,255,.035);color:var(--text);border-radius:11px;padding:9px 12px;cursor:pointer;transition:.2s;box-shadow:inset 0 1px rgba(255,255,255,.05)}button:hover{border-color:var(--line2);transform:translateY(-1px);box-shadow:0 9px 30px rgba(0,0,0,.18),inset 0 1px rgba(255,255,255,.08)}.zb-workspace{height:calc(100vh - 92px);display:flex;gap:10px;padding:10px 14px 14px}.chat-pane{min-width:0;display:flex;flex-direction:column;flex:1}.has-chat .chat-pane{width:44%}.chat-scroll{min-height:0;flex:1;overflow-y:auto;padding:20px 10px 28px;scroll-behavior:smooth}.messages{max-width:850px;margin:0 auto;display:flex;flex-direction:column;gap:14px}.message{border:1px solid var(--line);border-radius:20px;padding:14px 16px;background:linear-gradient(135deg,rgba(255,255,255,.065),rgba(255,255,255,.018));box-shadow:inset 0 1px rgba(255,255,255,.055),0 16px 50px rgba(0,0,0,.2)}.message.user{margin-left:12%;background:linear-gradient(135deg,rgba(255,255,255,.105),rgba(255,255,255,.035))}.message-label{font-size:10px;letter-spacing:.16em;color:var(--soft);margin-bottom:9px}.message-content{color:var(--text);line-height:1.7;font-size:14px;overflow-wrap:anywhere}.message-content p{margin:0 0 10px}.thinking{display:flex;align-items:center;gap:10px;color:var(--muted)}.thinking i,.live-dot,.state.running{width:7px;height:7px;border-radius:50%;display:inline-block;background:#fff;box-shadow:0 0 15px rgba(255,255,255,.8);animation:pulse 1.2s infinite}.source-row{display:flex;flex-wrap:wrap;gap:6px;margin-top:10px}.source-row a{max-width:220px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;border:1px solid var(--line);border-radius:9px;padding:6px 9px;color:var(--muted);font-size:11px;text-decoration:none;background:rgba(255,255,255,.025)}.inline-file{margin:10px 0;border:1px solid var(--line);border-radius:13px;padding:11px 13px;background:rgba(255,255,255,.035)}.inline-file div{display:grid;grid-template-columns:25px 1fr;align-items:center}.inline-file span{grid-row:span 2}.inline-file b{font-size:12px}.inline-file small{grid-column:2;color:var(--soft);font-size:10px}.welcome{height:100%;min-height:440px;display:grid;place-items:center;align-content:center;text-align:center;max-width:760px;margin:auto;padding:40px}.hero-z{width:82px;height:82px;border-radius:26px;display:grid;place-items:center;font-size:34px;font-weight:900;margin:0 auto 24px;border:1px solid var(--line2);background:linear-gradient(145deg,rgba(255,255,255,.13),rgba(255,255,255,.025));box-shadow:inset 0 1px rgba(255,255,255,.16),0 25px 80px rgba(0,0,0,.45),0 0 55px rgba(255,255,255,.06)}.welcome h1{font-size:clamp(30px,4vw,52px);letter-spacing:-.045em;margin:0 0 12px}.welcome p{max-width:600px;color:var(--muted);line-height:1.7;margin:0 auto 24px}.suggestions{display:flex;gap:8px;flex-wrap:wrap;justify-content:center}.suggestions button{border:1px solid var(--line);background:rgba(255,255,255,.04);color:var(--muted);border-radius:12px;padding:9px 13px;cursor:pointer}.composer{margin:0 auto 6px;width:min(900px,96%);border-radius:20px;padding:11px 12px 9px}.composer textarea{width:100%;resize:none;min-height:42px;max-height:150px;border:0;outline:0;background:transparent;color:var(--text);font-size:14px;padding:5px 4px}.composer textarea::placeholder{color:var(--soft)}.composer-row{display:flex;align-items:center;justify-content:space-between;gap:8px}.composer-left{display:flex;align-items:center;gap:6px;min-width:0;flex-wrap:wrap}.mode-wrap,.model-wrap{position:relative}.mode-btn,.model-btn{font-size:11px;padding:7px 9px}.mode-btn{font-weight:700}.bolt{width:7px;height:7px;display:inline-block;border-radius:50%;background:#fff;box-shadow:0 0 13px rgba(255,255,255,.9);margin-right:7px}.plan{width:7px;height:7px;display:inline-block;border-radius:2px;border:1px solid currentColor;margin-right:7px}.auto-access{font-size:10px;color:var(--soft);white-space:nowrap}.send-btn{width:37px;height:37px;border:1px solid var(--line2);border-radius:12px;background:#fff;color:#050505;font-weight:900;cursor:pointer}.send-btn:disabled{opacity:.35;cursor:default}.composer-hint{text-align:center;color:var(--soft);font-size:9px;padding:4px}.popover{position:absolute;z-index:100;min-width:230px;padding:7px;border:1px solid var(--line2);border-radius:15px;background:rgba(12,12,12,.9);backdrop-filter:blur(30px);box-shadow:var(--shadow)}.light .popover{background:rgba(255,255,255,.94)}.mode-pop{left:0;bottom:48px}.model-pop{left:0;bottom:48px}.activity-pop{right:80px;top:60px;min-width:280px}.popover>button{width:100%;display:flex;gap:10px;align-items:center;text-align:left;border:0;background:transparent;color:var(--text);padding:10px;border-radius:10px;cursor:pointer}.popover>button.selected,.popover>button:hover{background:rgba(255,255,255,.07)}.popover small{display:block;color:var(--soft);font-size:10px;margin-top:3px}.activity-row{display:flex;gap:9px;padding:9px 3px;border-top:1px solid var(--line);margin-top:7px}.activity-row strong{font-size:11px;display:block}.activity-row small{font-size:9px}.state{width:7px;height:7px;border-radius:50%;margin-top:4px;background:#666;flex:none}.state.done{background:#fff}.state.error{background:#888}.splitter{width:3px;border-radius:4px;background:var(--line);cursor:col-resize;transition:.2s}.splitter:hover{background:var(--line2);box-shadow:0 0 18px rgba(255,255,255,.12)}.studio-pane{flex:1;min-width:0;border-radius:22px;overflow:hidden;display:flex;flex-direction:column}.studio-head{height:56px;display:flex;align-items:center;justify-content:space-between;padding:0 12px;border-bottom:1px solid var(--line);background:rgba(0,0,0,.1)}.studio-tabs,.device-tabs{display:flex;gap:5px}.studio-tabs button,.device-tabs button{border:1px solid transparent;background:transparent;color:var(--muted);padding:8px 12px;border-radius:10px;cursor:pointer}.studio-tabs button.active{color:var(--text);background:rgba(255,255,255,.07);border-color:var(--line)}.device-tabs button{width:36px;font-size:17px}.device-tabs button.active{color:var(--text);background:rgba(255,255,255,.07);border-color:var(--line)}.preview-stage{flex:1;min-height:0;padding:18px;display:grid;place-items:center;background:radial-gradient(circle at 50% 25%,rgba(255,255,255,.035),transparent 48%)}.preview-frame{width:100%;height:100%;max-width:1400px;border:1px solid var(--line2);border-radius:18px;overflow:hidden;background:#fff;box-shadow:0 25px 80px rgba(0,0,0,.45),inset 0 1px rgba(255,255,255,.8);transition:.25s}.preview-frame.desktop{width:100%}.preview-frame.tablet{width:min(820px,90%)}.preview-frame.mobile{width:min(430px,70%)}.preview-frame iframe{display:block;width:100%;height:100%;border:0;background:#fff}.code-workspace{flex:1;min-height:0;display:flex}.file-tree{width:225px;min-width:190px;border-right:1px solid var(--line);padding:12px;overflow:auto;background:rgba(0,0,0,.08)}.tree-title{font-size:9px;letter-spacing:.18em;color:var(--soft);padding:5px 8px 10px}.tree-title span{float:right;color:var(--muted)}.file-tree button{width:100%;display:flex;align-items:center;gap:9px;border:1px solid transparent;background:transparent;color:var(--muted);padding:9px 8px;border-radius:10px;text-align:left;cursor:pointer}.file-tree button:hover,.file-tree button.active{background:rgba(255,255,255,.06);border-color:var(--line);color:var(--text)}.real-icon{width:22px;height:22px;display:grid;place-items:center}.real-icon svg{width:20px;height:20px}.editor{flex:1;min-width:0;display:flex;flex-direction:column}.editor-head{height:39px;display:flex;align-items:center;justify-content:space-between;padding:0 14px;border-bottom:1px solid var(--line);font-size:11px;color:var(--muted)}.editor-head small{color:var(--soft)}.editor>section{flex:1}.modal-backdrop{position:fixed;inset:0;z-index:200;display:grid;place-items:center;background:rgba(0,0,0,.55);backdrop-filter:blur(10px)}.publish-modal{width:min(420px,90vw);padding:18px;border-radius:20px;display:grid;gap:10px}.modal-head{display:flex;justify-content:space-between;align-items:center}.modal-head button{border:0;background:transparent;color:var(--text);font-size:20px;cursor:pointer}.publish-modal input{border:1px solid var(--line);background:rgba(255,255,255,.04);color:var(--text);border-radius:11px;padding:11px;outline:0}.publish-now{border:1px solid var(--line2);background:#fff;color:#050505;border-radius:11px;padding:11px;font-weight:800;cursor:pointer}.publish-modal small{color:var(--muted)}.error-card{border:1px solid var(--line2);border-radius:13px;padding:12px;background:rgba(255,255,255,.04);display:grid;gap:4px}.error-card span{color:var(--muted);font-size:12px}@keyframes pulse{50%{opacity:.35;transform:scale(.7)}}@media(max-width:900px){.top-title{display:none}.zb-workspace{flex-direction:column;height:calc(100vh - 92px)}.chat-pane{height:48%}.has-chat .chat-pane{width:100%}.splitter{height:3px;width:100%;cursor:row-resize}.studio-pane{height:52%}.file-tree{width:180px}.auto-access{display:none}}@media(max-width:650px){.brand-sub,.top-actions .glass-btn:nth-child(2){display:none}.zb-topbar{margin:8px 8px 0}.zb-workspace{padding:8px}.preview-frame.tablet{width:94%}.preview-frame.mobile{width:72%}.file-tree{width:150px;min-width:150px}.message.user{margin-left:4%}}
`
