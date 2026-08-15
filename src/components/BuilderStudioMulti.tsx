import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import Editor from '@monaco-editor/react'

type Role = 'user' | 'assistant'
type Theme = 'dark' | 'light'
type Device = 'desktop' | 'tablet' | 'mobile'
type FileKey = 'index.html' | 'styles.css' | 'script.js'
type Source = { title: string; url: string; snippet?: string; kind?: 'web' | 'image' | 'video' }
type Message = { id: string; role: Role; content: string; sources?: Source[] }
type FileState = Record<FileKey, string>
type Activity = { id: string; label: string; detail?: string; state: 'running' | 'done' | 'error' }

const MODELS = [
  { id: 'mimo-v2.5-free', name: 'MiMo V2.5 Free', note: 'Balanced builder' },
  { id: 'nemotron-3-super-free', name: 'Nemotron 3 Super Free', note: 'Deep reasoning' },
  { id: 'big-pickle', name: 'Big Pickle', note: 'Fast generation' },
]
const FILES: FileKey[] = ['index.html', 'styles.css', 'script.js']
const LANG: Record<FileKey, 'html' | 'css' | 'javascript'> = { 'index.html': 'html', 'styles.css': 'css', 'script.js': 'javascript' }
const STARTER: FileState = {
  'index.html': '<!doctype html>\n<html>\n<head>\n  <meta charset="UTF-8">\n  <meta name="viewport" content="width=device-width,initial-scale=1">\n  <title>ZYRAXON</title>\n</head>\n<body>\n  <main><h1>Start with an idea.</h1><p>Describe the website you want ZYRAXON AI to build.</p></main>\n</body>\n</html>',
  'styles.css': 'body { margin: 0; font-family: Inter, system-ui, sans-serif; background: #090b12; color: white; }\nmain { min-height: 100vh; display: grid; place-items: center; text-align: center; }',
  'script.js': '// Interactive JavaScript will appear here.\n',
}
const uid = (p: string) => `${p}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`

function parseFiles(text: string, previous: FileState): FileState {
  const next = { ...previous }
  const re = /```(html|css|javascript|js|tsx|jsx)?\s*\n?([\s\S]*?)(?:```|$)/gi
  let match: RegExpExecArray | null
  while ((match = re.exec(text))) {
    const lang = (match[1] || '').toLowerCase()
    let body = match[2].trim()
    const marker = body.match(/^(?:<!--|\/\*|\/\/|#)\s*file:\s*([^\n]+?)(?:\s*-->|\s*\*\/)?\s*\n/i)
    const markerName = marker?.[1]?.trim().toLowerCase()
    if (marker) body = body.slice(marker[0].length).trimStart()
    let key: FileKey | undefined = markerName && FILES.includes(markerName as FileKey) ? markerName as FileKey : undefined
    if (!key && lang === 'html') key = 'index.html'
    if (!key && lang === 'css') key = 'styles.css'
    if (!key && (lang === 'javascript' || lang === 'js')) key = 'script.js'
    if (key && body) next[key] = body
  }
  return next
}

function extractCardFiles(text: string) {
  const result: Array<{ key: FileKey; code: string; lang: string }> = []
  const re = /```(html|css|javascript|js|tsx|jsx)?\s*\n?([\s\S]*?)(?:```|$)/gi
  let match: RegExpExecArray | null
  while ((match = re.exec(text))) {
    const lang = (match[1] || 'code').toLowerCase()
    let code = match[2].trim()
    const marker = code.match(/^(?:<!--|\/\*|\/\/|#)\s*file:\s*([^\n]+?)(?:\s*-->|\s*\*\/)?\s*\n/i)
    const name = marker?.[1]?.trim().toLowerCase()
    if (marker) code = code.slice(marker[0].length).trimStart()
    const key = FILES.includes(name as FileKey) ? name as FileKey : lang === 'html' ? 'index.html' : lang === 'css' ? 'styles.css' : 'script.js'
    if (code) result.push({ key, code, lang })
  }
  return result
}

function buildPreview(files: FileState) {
  let html = files['index.html']
  if (!/<style[\s>]/i.test(html) && files['styles.css'].trim()) html = html.replace(/<\/head>/i, `<style>\n${files['styles.css']}\n</style>\n</head>`)
  if (!/<script[\s>]/i.test(html) && files['script.js'].trim()) html = html.replace(/<\/body>/i, `<script>\n${files['script.js']}\n</script>\n</body>`)
  return html
}

async function streamSse(response: Response, onDelta: (full: string) => void) {
  const reader = response.body?.getReader()
  if (!reader) throw new Error('Streaming is unavailable from this provider.')
  const decoder = new TextDecoder(); let buffer = ''; let full = ''
  const consume = (line: string) => {
    const payload = line.trim().replace(/^data:\s?/, '')
    if (!payload || payload === '[DONE]') return
    try {
      const json = JSON.parse(payload)
      const delta = json?.choices?.[0]?.delta?.content ?? json?.choices?.[0]?.message?.content ?? ''
      if (typeof delta === 'string' && delta) { full += delta; onDelta(full) }
    } catch {}
  }
  while (true) {
    const { done, value } = await reader.read(); if (done) break
    buffer += decoder.decode(value, { stream: true })
    const lines = buffer.split(/\r?\n/); buffer = lines.pop() || ''; lines.forEach(consume)
  }
  if (buffer.trim()) consume(buffer)
  return full
}

function AssistantCards({ content, files, streaming, onOpen }: { content: string; files: FileState; streaming: boolean; onOpen: (key: FileKey) => void }) {
  const cards = extractCardFiles(content)
  const seen = new Set<string>(); const unique = cards.filter(c => !seen.has(c.key) && seen.add(c.key))
  const hasCode = unique.length > 0
  const text = content.replace(/```[\s\S]*?(?:```|$)/g, '').trim()
  return <div className="assistant-body">
    {text && <div className="assistant-text">{text}</div>}
    {hasCode && <div className="file-cards">{unique.map(card => <button className="file-card" key={card.key} onClick={() => onOpen(card.key)}>
      <span className="file-icon">{card.key === 'index.html' ? '</>' : card.key === 'styles.css' ? '◇' : 'JS'}</span>
      <span className="file-meta"><b>{card.key}</b><small>{streaming ? 'Generating · live' : 'Updated · click to inspect'}</small></span>
      <span className="file-lines">{card.code.split('\n').length} lines</span><span className="file-arrow">›</span>
    </button>)}</div>}
    {streaming && <div className="stream-status"><span className="stream-dot"/>Building files live<span className="stream-shimmer"/></div>}
  </div>
}

export default function BuilderStudioMulti() {
  const [theme, setTheme] = useState<Theme>('dark')
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [model, setModel] = useState(MODELS[0].id)
  const [files, setFiles] = useState<FileState>(STARTER)
  const [activeFile, setActiveFile] = useState<FileKey>('index.html')
  const [device, setDevice] = useState<Device>('desktop')
  const [codeOpen, setCodeOpen] = useState(false)
  const [activityOpen, setActivityOpen] = useState(false)
  const [modelOpen, setModelOpen] = useState(false)
  const [webOpen, setWebOpen] = useState(false)
  const [sources, setSources] = useState<Source[]>([])
  const [searching, setSearching] = useState(false)
  const [streaming, setStreaming] = useState(false)
  const [error, setError] = useState('')
  const [split, setSplit] = useState(44)
  const [activities, setActivities] = useState<Activity[]>([])
  const [publishOpen, setPublishOpen] = useState(false)
  const [githubToken, setGithubToken] = useState('')
  const [repo, setRepo] = useState('')
  const [publishState, setPublishState] = useState('')
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({})
  const abortRef = useRef<AbortController | null>(null)
  const dragRef = useRef(false)
  const current = MODELS.find(m => m.id === model) || MODELS[0]
  const preview = useMemo(() => buildPreview(files), [files])
  const hasChat = messages.length > 0

  useEffect(() => { try { const t = sessionStorage.getItem('zyraxon.builder.theme'); if (t === 'dark' || t === 'light') setTheme(t); const f = sessionStorage.getItem('zyraxon.builder.files'); if (f) setFiles(JSON.parse(f)); const c = sessionStorage.getItem('zyraxon.builder.chat'); if (c) setMessages(JSON.parse(c)) } catch {} }, [])
  useEffect(() => { try { sessionStorage.setItem('zyraxon.builder.theme', theme); sessionStorage.setItem('zyraxon.builder.files', JSON.stringify(files)); sessionStorage.setItem('zyraxon.builder.chat', JSON.stringify(messages.slice(-30))) } catch {} }, [theme, files, messages])
  useEffect(() => { const move = (e: PointerEvent) => { if (dragRef.current) setSplit(Math.min(70, Math.max(30, (e.clientX / window.innerWidth) * 100))) }; const up = () => { dragRef.current = false }; window.addEventListener('pointermove', move); window.addEventListener('pointerup', up); return () => { window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', up) } }, [])

  const addActivity = (label: string, detail?: string) => { const item = { id: uid('activity'), label, detail, state: 'running' as const }; setActivities(p => [...p, item]); return item.id }
  const finish = (id: string, state: Activity['state'] = 'done', detail?: string) => setActivities(p => p.map(a => a.id === id ? { ...a, state, detail } : a))

  const searchWeb = useCallback(async (query: string) => {
    if (!query.trim() || searching) return [] as Source[]
    setSearching(true); const id = addActivity('Web research', query)
    try { const r = await fetch(`/api/public/builder/search?q=${encodeURIComponent(query)}`); const data = await r.json(); if (!r.ok) throw new Error(data?.error || 'Search failed'); const result = Array.isArray(data.results) ? data.results as Source[] : []; setSources(result); setWebOpen(true); finish(id, 'done', `${result.length} sources found`); return result }
    catch (e: any) { finish(id, 'error', e?.message || 'Search failed'); return [] }
    finally { setSearching(false) }
  }, [searching])

  const send = useCallback(async () => {
    const text = input.trim(); if (!text || streaming) return
    setInput(''); setError(''); setModelOpen(false)
    const userId = uid('user'), assistantId = uid('assistant')
    const context = messages.slice(-16).map(m => ({ role: m.role, content: m.content }))
    setMessages(p => [...p, { id: userId, role: 'user', content: text }, { id: assistantId, role: 'assistant', content: '' }])
    setStreaming(true)
    const controller = new AbortController(); abortRef.current = controller
    const connect = addActivity('Connecting to model', current.name)
    const stream = addActivity('Streaming implementation', 'Live file updates')
    const previewId = addActivity('Live preview', 'Waiting for generated files')
    try {
      const wantsSearch = /\b(search|latest|current|today|news|research|source|reference|image|video|price|documentation)\b/i.test(text)
      const web = wantsSearch ? await searchWeb(text) : sources
      finish(connect, 'done')
      let prompt = text
      if (web.length) prompt += `\n\nUse these web references when relevant:\n${web.map(s => `- ${s.kind || 'web'} | ${s.title}: ${s.url}${s.snippet ? ` — ${s.snippet}` : ''}`).join('\n')}`
      prompt += '\n\nIMPORTANT OUTPUT FORMAT: When generating code, put EACH file in exactly ONE fenced code block and prefix it with a file marker, for example <!-- file: index.html -->, /* file: styles.css */, or // file: script.js. Never duplicate the same file in multiple code blocks. Keep normal explanation outside code blocks.'
      const response = await fetch('/api/public/builder/chat', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ model, messages: [...context, { role: 'user', content: prompt }] }), signal: controller.signal })
      if (!response.ok) { const data = await response.json().catch(() => null); throw new Error(data?.error || `Provider returned HTTP ${response.status}`) }
      let latest = ''; let liveFiles = files
      await streamSse(response, value => {
        latest = value
        const parsed = parseFiles(value, liveFiles)
        const changed = FILES.filter(k => parsed[k] !== liveFiles[k])
        if (changed.length) { liveFiles = parsed; setFiles(parsed); finish(previewId, 'done', `${changed.join(', ')} updated`) }
        setMessages(p => p.map(m => m.id === assistantId ? { ...m, content: value, sources: web } : m))
      })
      finish(stream, 'done', 'Stream complete')
      if (!latest) throw new Error('The model returned an empty response. Try another model.')
    } catch (e: any) {
      if (e?.name !== 'AbortError') { const msg = e?.message || 'Generation failed'; setError(msg); finish(connect, 'error', msg); finish(stream, 'error', msg); finish(previewId, 'error', 'No preview update') }
    } finally { setStreaming(false); abortRef.current = null }
  }, [input, streaming, messages, model, current.name, sources, searchWeb, files])

  const publish = async () => {
    if (!githubToken.trim() || !repo.trim()) { setPublishState('Enter your GitHub token and repository name.'); return }
    setPublishState('Publishing…')
    try { const name = repo.trim().replace(/\.git$/, '').split('/').filter(Boolean).at(-1) || repo.trim(); const r = await fetch('/api/public/builder/publish', { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({ token: githubToken.trim(), repo: name, html: preview }) }); const data = await r.json(); if (!r.ok || !data.ok) throw new Error(data?.error || 'GitHub publish failed'); setPublishState(data.pagesUrl || data.repoUrl || 'Published successfully.') }
    catch (e: any) { setPublishState(e?.message || 'GitHub publish failed') }
  }
  const reset = () => { abortRef.current?.abort(); setMessages([]); setFiles(STARTER); setSources([]); setActivities([]); setError('') }

  return <div className={`zyraxon-builder ${theme}`}>
    <style>{CSS}</style>
    <header className="zb-topbar">
      <a className="zb-brand" href="/"><span className="zb-logo">✦</span><span className="brand-name">ZYRAXON</span><span className="brand-sub">AI BUILDER</span></a>
      <div className="zb-center"><button className={!codeOpen ? 'active' : ''} onClick={() => setCodeOpen(false)}>Build</button><button className={codeOpen ? 'active' : ''} onClick={() => setCodeOpen(true)}>Code</button></div>
      <div className="zb-actions"><button className="icon-btn" onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')} aria-label="Toggle theme">{theme === 'dark' ? '☼' : '☾'}</button><button onClick={() => setActivityOpen(v => !v)}><i className={streaming ? 'pulse' : ''}/>Activity</button><button onClick={() => setModelOpen(v => !v)}>{current.name}<span className="chev">⌄</span></button><button className="publish" onClick={() => setPublishOpen(true)}>Publish</button></div>
      {modelOpen && <div className="zb-models"><small>OPENCODE ZEN</small>{MODELS.map(m => <button key={m.id} className={m.id === model ? 'selected' : ''} onClick={() => { setModel(m.id); setModelOpen(false) }}><span>✦</span><b>{m.name}</b><em>{m.note}</em>{m.id === model && <strong>✓</strong>}</button>)}</div>}
      {activityOpen && <aside className="activity-pop"><div className="pop-head"><b>Activity</b><button onClick={() => setActivities([])}>Clear</button></div>{activities.length ? activities.slice().reverse().map(a => <div className="activity-row" key={a.id}><span className={`state ${a.state}`}>{a.state === 'running' ? '◌' : a.state === 'done' ? '✓' : '!'}</span><div><b>{a.label}</b><small>{a.detail}</small></div></div>) : <div className="empty-pop">Nothing running yet.</div>}</aside>}
    </header>

    <main className="zb-workspace">
      <section className={`zb-chat ${hasChat ? 'with-chat' : ''}`} style={{ width: hasChat ? `${split}%` : '100%' }}>
        <div className="zb-chat-inner">
          {!hasChat && <div className="zb-welcome"><div className="hero-logo"><span>✦</span></div><div className="eyebrow">ZYRAXON AI BUILDER</div><h1>What will you build?</h1><p>Describe an idea and watch ZYRAXON generate the files, stream progress and refresh the live preview in real time.</p><div className="suggestions"><button onClick={() => setInput('Build a premium AI SaaS landing page')}>AI SaaS</button><button onClick={() => setInput('Build a modern developer portfolio')}>Portfolio</button><button onClick={() => setInput('Build a cinematic product website')}>Product site</button></div></div>}
          {hasChat && <div className="zb-messages">{messages.map(m => <article key={m.id} className={`zb-message ${m.role}`}>{m.role === 'assistant' && <span className="avatar">Z</span>}<div className="message-shell"><small>{m.role === 'assistant' ? 'ZYRAXON AI' : 'YOU'}</small>{m.role === 'assistant' ? <AssistantCards content={m.content} files={files} streaming={streaming && m.id === messages[messages.length - 1]?.id} onOpen={key => { setActiveFile(key); setCodeOpen(true) }} /> : <div className="user-copy">{m.content}</div>}{m.sources?.length ? <div className="chips">{m.sources.slice(0, 5).map(s => <a key={s.url} href={s.url} target="_blank" rel="noreferrer">{s.kind === 'image' ? '▧ ' : s.kind === 'video' ? '▶ ' : ''}{s.title}</a>)}</div> : null}</div></article>)}{error && <div className="zb-error"><b>Generation paused</b><span>{error}</span><button onClick={send}>Try again</button></div>}</div>}
          <div className="zb-composer"><div className="composer-inner"><textarea value={input} onChange={e => setInput(e.target.value)} onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send() } }} placeholder="Ask ZYRAXON to build, research, change or fix…" rows={1}/><div className="composer-tools"><button className={webOpen ? 'tool-active' : ''} onClick={() => setWebOpen(v => !v)}>⌕ Web</button><span>{current.name}</span><button className="send" onClick={() => streaming ? abortRef.current?.abort() : send()}>{streaming ? '■' : '↑'}</button></div></div><small>Enter to build · Shift + Enter for a new line</small></div>
        </div>
      </section>

      {hasChat && <div className="zb-split" onPointerDown={() => { dragRef.current = true }} onDoubleClick={() => setSplit(44)}><span>⋮</span></div>}
      {hasChat && <section className={`zb-right ${codeOpen ? 'code-mode' : ''}`}>
        {!codeOpen ? <div className="preview-pane"><div className="preview-bar"><b><i className="live-dot"/>Live preview</b><div className="preview-tools"><button className={device === 'desktop' ? 'active' : ''} onClick={() => setDevice('desktop')}>▱</button><button className={device === 'tablet' ? 'active' : ''} onClick={() => setDevice('tablet')}>▯</button><button className={device === 'mobile' ? 'active' : ''} onClick={() => setDevice('mobile')}>▯</button><button onClick={() => window.open('about:blank', '_blank')}>↗</button></div></div><div className="preview-stage"><div className={`device-frame ${device}`}><iframe title="ZYRAXON live preview" srcDoc={preview} sandbox="allow-scripts allow-forms allow-modals"/></div></div></div> : <div className="code-pane"><div className="code-tabs">{FILES.map(f => <button key={f} className={activeFile === f ? 'active' : ''} onClick={() => setActiveFile(f)}><span className="tiny-dot"/>{f}</button>)}<button className="code-close" onClick={() => setCodeOpen(false)}>×</button></div><div className="editor-wrap"><Editor height="100%" language={LANG[activeFile]} theme={theme === 'dark' ? 'vs-dark' : 'light'} value={files[activeFile]} onChange={v => setFiles(p => ({ ...p, [activeFile]: v || '' }))} options={{ minimap: { enabled: false }, fontSize: 13, lineHeight: 20, padding: { top: 18 }, smoothScrolling: true, scrollBeyondLastLine: false, wordWrap: 'on', automaticLayout: true, tabSize: 2 }} /></div></div>}
      </section>}
    </main>

    {webOpen && <div className="web-drawer"><div className="drawer-head"><div><b>Web research</b><small>Sources for your build</small></div><button onClick={() => setWebOpen(false)}>×</button></div><div className="search-row"><input placeholder="Search the web…" onKeyDown={e => { if (e.key === 'Enter') searchWeb(e.currentTarget.value) }}/><button onClick={e => { const input = e.currentTarget.previousElementSibling as HTMLInputElement; searchWeb(input?.value || '') }}>Search</button></div>{sources.length ? sources.map(s => <a className="source" key={s.url} href={s.url} target="_blank" rel="noreferrer"><span>{s.kind === 'image' ? '▧' : s.kind === 'video' ? '▶' : '⌕'}</span><div><b>{s.title}</b><small>{s.snippet || s.url}</small></div></a>) : <div className="empty-pop">Search results will appear here.</div>}</div>}

    {publishOpen && <div className="modal-backdrop" onClick={() => setPublishOpen(false)}><div className="publish-modal" onClick={e => e.stopPropagation()}><div className="modal-icon">↑</div><h2>Publish to GitHub</h2><p>Send the current live build to a repository using the existing publish endpoint.</p><label>Repository<input value={repo} onChange={e => setRepo(e.target.value)} placeholder="owner/repository or repository name"/></label><label>GitHub token<input type="password" value={githubToken} onChange={e => setGithubToken(e.target.value)} placeholder="ghp_…"/></label><div className="modal-actions"><button onClick={() => setPublishOpen(false)}>Cancel</button><button className="publish" onClick={publish}>Publish</button></div>{publishState && <div className="publish-state">{publishState}</div>}</div></div>}

    <button className="reset-fab" onClick={reset} title="Reset builder">↺</button>
  </div>
}

const CSS = `
.zyraxon-builder{--bg:#f7f8fc;--panel:#ffffff;--panel2:#f1f3f8;--text:#171923;--muted:#697084;--line:#dfe3ec;--accent:#6c5ce7;--accent2:#20c9b3;--shadow:0 20px 60px rgba(20,24,40,.10);min-height:100vh;background:var(--bg);color:var(--text);font-family:Inter,ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;display:flex;flex-direction:column;overflow:hidden}.zyraxon-builder.dark{--bg:#07090f;--panel:#0d111a;--panel2:#121824;--text:#f5f7fb;--muted:#8993a7;--line:#202938;--shadow:0 24px 80px rgba(0,0,0,.35)}*{box-sizing:border-box}.zyraxon-builder button,.zyraxon-builder input,.zyraxon-builder textarea{font:inherit}.zyraxon-builder button{border:0;background:none;color:inherit;cursor:pointer}.zb-topbar{height:64px;min-height:64px;border-bottom:1px solid var(--line);background:color-mix(in srgb,var(--panel) 90%,transparent);display:grid;grid-template-columns:1fr auto 1fr;align-items:center;padding:0 18px;position:relative;z-index:20;backdrop-filter:blur(20px)}.zb-brand{display:flex;align-items:center;gap:9px;text-decoration:none;color:var(--text);font-size:14px}.zb-logo{width:31px;height:31px;border-radius:10px;display:grid;place-items:center;background:linear-gradient(135deg,#8b6dff,#39d9c0);color:white;box-shadow:0 6px 24px rgba(108,92,231,.28)}.brand-name{font-weight:800;letter-spacing:.04em}.brand-sub{font-size:10px;color:var(--muted);letter-spacing:.12em;border-left:1px solid var(--line);padding-left:10px}.zb-center{display:flex;background:var(--panel2);padding:3px;border-radius:10px;border:1px solid var(--line)}.zb-center button{padding:7px 16px;border-radius:7px;color:var(--muted);font-size:12px;font-weight:700}.zb-center button.active{background:var(--panel);color:var(--text);box-shadow:0 2px 8px rgba(0,0,0,.08)}.zb-actions{justify-self:end;display:flex;align-items:center;gap:6px}.zb-actions button{padding:8px 10px;border-radius:9px;color:var(--muted);font-size:12px;display:flex;align-items:center;gap:7px}.zb-actions button:hover{background:var(--panel2);color:var(--text)}.zb-actions .icon-btn{font-size:17px}.zb-actions .publish,.modal-actions .publish{background:var(--text);color:var(--bg);font-weight:800;padding:9px 14px}.dark .zb-actions .publish,.dark .modal-actions .publish{background:#fff;color:#080a0f}.pulse{width:7px;height:7px;border-radius:50%;background:#35d0bb;box-shadow:0 0 0 5px rgba(53,208,187,.12);animation:pulse 1.2s infinite}.chev{opacity:.55}.zb-models,.activity-pop{position:absolute;right:150px;top:58px;width:285px;background:var(--panel);border:1px solid var(--line);border-radius:14px;box-shadow:var(--shadow);padding:9px}.zb-models small{display:block;color:var(--muted);font-size:9px;letter-spacing:.12em;padding:7px 10px}.zb-models button{width:100%;display:grid;grid-template-columns:22px 1fr 18px;grid-template-rows:auto auto;text-align:left;padding:10px;border-radius:10px}.zb-models button:hover,.zb-models button.selected{background:var(--panel2)}.zb-models button span{grid-row:1/3}.zb-models b{font-size:12px}.zb-models em{font-size:10px;color:var(--muted);font-style:normal;margin-top:3px}.zb-models strong{grid-column:3;grid-row:1/3;align-self:center;color:#25c7ae}.activity-pop{right:220px;width:310px}.pop-head,.drawer-head{display:flex;justify-content:space-between;align-items:center;padding:7px 6px 10px}.pop-head button{color:var(--muted);font-size:11px}.activity-row{display:flex;gap:10px;padding:10px;border-top:1px solid var(--line)}.activity-row .state{width:22px;height:22px;border-radius:50%;display:grid;place-items:center;background:var(--panel2);font-size:11px}.state.running{color:#2bcab4}.state.done{color:#63c89d}.state.error{color:#f06d7b}.activity-row div{min-width:0}.activity-row b,.activity-row small{display:block}.activity-row b{font-size:11px}.activity-row small{font-size:10px;color:var(--muted);margin-top:3px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.empty-pop{padding:28px 12px;text-align:center;color:var(--muted);font-size:12px}.zb-workspace{flex:1;min-height:0;display:flex;overflow:hidden}.zb-chat{min-width:0;height:calc(100vh - 64px);transition:width .18s ease}.zb-chat-inner{height:100%;display:flex;flex-direction:column;max-width:980px;margin:0 auto}.zb-welcome{flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;padding:40px 26px}.hero-logo{width:74px;height:74px;border-radius:23px;display:grid;place-items:center;background:radial-gradient(circle at 30% 20%,rgba(139,109,255,.34),transparent 55%),var(--panel2);border:1px solid var(--line);box-shadow:var(--shadow);margin-bottom:22px}.hero-logo span{font-size:30px;background:linear-gradient(135deg,#a992ff,#48ddc7);color:transparent;background-clip:text}.eyebrow{font-size:10px;letter-spacing:.18em;color:#7c6df1;font-weight:800;margin-bottom:8px}.zb-welcome h1{font-size:clamp(32px,4vw,54px);line-height:1.02;letter-spacing:-.05em;margin:0 0 13px}.zb-welcome p{max-width:650px;color:var(--muted);line-height:1.7;margin:0}.suggestions{display:flex;gap:8px;margin-top:24px;flex-wrap:wrap;justify-content:center}.suggestions button{border:1px solid var(--line);background:var(--panel);padding:9px 13px;border-radius:10px;font-size:11px;color:var(--muted)}.suggestions button:hover{border-color:#8b7bf0;color:var(--text)}.zb-messages{flex:1;overflow:auto;padding:32px 26px 180px}.zb-message{display:flex;gap:11px;max-width:900px;margin:0 auto 26px;animation:rise .22s ease}.zb-message.user{justify-content:flex-end}.message-shell{min-width:0;max-width:100%}.zb-message small{display:block;color:var(--muted);font-size:9px;letter-spacing:.12em;font-weight:800;margin:0 0 7px}.user-copy{background:var(--panel2);border:1px solid var(--line);padding:12px 14px;border-radius:14px 14px 4px 14px;font-size:13px;line-height:1.6;max-width:680px}.avatar{flex:0 0 30px;width:30px;height:30px;border-radius:10px;background:linear-gradient(135deg,#8b6dff,#39d9c0);display:grid;place-items:center;font-size:12px;font-weight:900;color:#fff}.assistant-body{min-width:0}.assistant-text{font-size:13px;line-height:1.7;color:var(--text);white-space:pre-wrap;margin-bottom:11px}.file-cards{display:flex;flex-direction:column;gap:7px;max-width:720px}.file-card{width:100%;display:grid;grid-template-columns:34px 1fr auto 18px;align-items:center;gap:10px;text-align:left;padding:10px 11px;border:1px solid var(--line);background:var(--panel);border-radius:12px;transition:.16s;box-shadow:0 4px 16px rgba(0,0,0,.04)}.file-card:hover{border-color:#8b7bf0;transform:translateY(-1px);box-shadow:0 9px 24px rgba(0,0,0,.08)}.file-icon{width:30px;height:30px;border-radius:8px;display:grid;place-items:center;background:var(--panel2);font-size:10px;font-weight:900;color:#8b7bf0}.file-meta b,.file-meta small{display:block}.file-meta b{font-size:11px}.file-meta small{font-size:9px;color:var(--muted);margin-top:2px}.file-lines{font-size:9px;color:var(--muted)}.file-arrow{font-size:18px;color:var(--muted)}.stream-status{display:flex;align-items:center;gap:7px;margin-top:10px;color:var(--muted);font-size:10px}.stream-dot{width:6px;height:6px;background:#38d0bb;border-radius:50%;animation:pulse 1s infinite}.stream-shimmer{height:6px;width:90px;border-radius:99px;background:linear-gradient(90deg,var(--panel2),var(--line),var(--panel2));background-size:200% 100%;animation:shimmer 1.4s infinite}.chips{display:flex;gap:6px;flex-wrap:wrap;margin-top:10px}.chips a{border:1px solid var(--line);border-radius:8px;padding:5px 8px;color:var(--muted);font-size:9px;text-decoration:none;background:var(--panel)}.zb-error{max-width:720px;margin:15px auto;padding:12px;border:1px solid rgba(240,109,123,.35);background:rgba(240,109,123,.06);border-radius:11px;display:flex;gap:10px;align-items:center;font-size:11px}.zb-error span{color:var(--muted);flex:1}.zb-error button{border:1px solid var(--line);padding:6px 9px;border-radius:8px}.zb-composer{position:fixed;left:0;bottom:0;width:44%;min-width:0;padding:14px 22px 18px;background:linear-gradient(transparent,var(--bg) 24%);z-index:10}.composer-inner{max-width:900px;margin:auto;border:1px solid var(--line);background:var(--panel);border-radius:17px;box-shadow:var(--shadow);padding:10px 11px 8px}.composer-inner:focus-within{border-color:#8374eb;box-shadow:0 0 0 3px rgba(108,92,231,.10),var(--shadow)}.composer-inner textarea{width:100%;resize:none;border:0;outline:0;background:transparent;color:var(--text);padding:3px 5px 8px;font-size:13px;line-height:1.5;max-height:120px}.composer-tools{display:flex;align-items:center;gap:7px}.composer-tools button{padding:6px 8px;border-radius:8px;color:var(--muted);font-size:10px}.composer-tools .tool-active{background:var(--panel2);color:var(--text)}.composer-tools>span{margin-left:auto;color:var(--muted);font-size:9px}.composer-tools .send{width:30px;height:30px;border-radius:9px;background:var(--text);color:var(--bg);font-weight:900;font-size:14px}.zb-composer>small{display:block;text-align:center;color:var(--muted);font-size:8px;margin-top:7px}.zb-split{width:7px;cursor:col-resize;background:var(--bg);border-left:1px solid var(--line);border-right:1px solid var(--line);display:grid;place-items:center;color:var(--muted);z-index:5}.zb-split:hover{background:var(--panel2);color:var(--text)}.zb-right{flex:1;min-width:0;height:calc(100vh - 64px);background:var(--panel2);overflow:hidden}.preview-pane,.code-pane{height:100%;display:flex;flex-direction:column}.preview-bar{height:48px;min-height:48px;border-bottom:1px solid var(--line);background:var(--panel);display:flex;align-items:center;justify-content:space-between;padding:0 13px}.preview-bar b{font-size:11px;display:flex;align-items:center;gap:7px}.live-dot{width:7px;height:7px;border-radius:50%;background:#30c9b3;box-shadow:0 0 0 4px rgba(48,201,179,.12)}.preview-tools{display:flex;gap:4px}.preview-tools button{padding:6px 8px;border-radius:7px;color:var(--muted);font-size:11px}.preview-tools button.active,.preview-tools button:hover{background:var(--panel2);color:var(--text)}.preview-stage{flex:1;display:grid;place-items:center;padding:22px;overflow:auto;background:radial-gradient(circle at 50% 20%,rgba(108,92,231,.08),transparent 42%),var(--panel2)}.device-frame{height:100%;width:100%;max-width:1100px;border:1px solid var(--line);border-radius:14px;overflow:hidden;background:#fff;box-shadow:0 20px 70px rgba(0,0,0,.14)}.device-frame.tablet{max-width:760px}.device-frame.mobile{max-width:410px}.device-frame iframe{width:100%;height:100%;border:0;background:#fff}.code-tabs{height:48px;min-height:48px;background:var(--panel);border-bottom:1px solid var(--line);display:flex;align-items:center;gap:2px;padding:0 8px}.code-tabs button{height:34px;padding:0 11px;border-radius:8px;color:var(--muted);font-size:10px}.code-tabs button.active{background:var(--panel2);color:var(--text)}.tiny-dot{display:inline-block;width:6px;height:6px;border-radius:50%;background:#8b7bf0;margin-right:6px}.code-close{margin-left:auto!important;font-size:18px!important}.editor-wrap{flex:1;min-height:0}.web-drawer{position:fixed;right:18px;bottom:18px;width:360px;max-height:70vh;overflow:auto;background:var(--panel);border:1px solid var(--line);border-radius:15px;box-shadow:var(--shadow);z-index:30;padding:10px}.drawer-head small{display:block;color:var(--muted);font-size:9px;margin-top:2px}.drawer-head>button{font-size:20px;color:var(--muted)}.search-row{display:flex;gap:6px;padding:6px 0 10px}.search-row input{flex:1;border:1px solid var(--line);background:var(--panel2);color:var(--text);border-radius:8px;padding:8px;font-size:10px;outline:0}.search-row button{background:var(--text);color:var(--bg);border-radius:8px;padding:0 10px;font-size:10px;font-weight:800}.source{display:flex;gap:9px;text-decoration:none;color:var(--text);padding:10px;border-top:1px solid var(--line)}.source>span{color:#8374eb}.source b,.source small{display:block}.source b{font-size:10px}.source small{font-size:9px;color:var(--muted);line-height:1.4;margin-top:3px;overflow:hidden;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical}.modal-backdrop{position:fixed;inset:0;background:rgba(3,5,10,.55);backdrop-filter:blur(10px);display:grid;place-items:center;z-index:50}.publish-modal{width:min(440px,calc(100vw - 30px));background:var(--panel);border:1px solid var(--line);border-radius:18px;padding:24px;box-shadow:var(--shadow)}.modal-icon{width:42px;height:42px;border-radius:12px;background:var(--panel2);display:grid;place-items:center;font-weight:900;margin-bottom:13px}.publish-modal h2{margin:0;font-size:21px;letter-spacing:-.03em}.publish-modal p{color:var(--muted);font-size:11px;line-height:1.6}.publish-modal label{display:block;color:var(--muted);font-size:10px;margin-top:12px}.publish-modal input{display:block;width:100%;margin-top:6px;border:1px solid var(--line);background:var(--panel2);color:var(--text);border-radius:9px;padding:10px;outline:0;font-size:11px}.modal-actions{display:flex;justify-content:flex-end;gap:7px;margin-top:18px}.modal-actions button{padding:9px 13px;border-radius:9px;border:1px solid var(--line);font-size:10px}.publish-state{margin-top:12px;padding:9px;background:var(--panel2);border-radius:8px;color:var(--muted);font-size:9px;word-break:break-word}.reset-fab{position:fixed;right:15px;bottom:15px;width:30px;height:30px;border:1px solid var(--line)!important;background:var(--panel)!important;border-radius:9px!important;color:var(--muted)!important;z-index:12}.reset-fab:hover{color:var(--text)!important}.dark .device-frame{box-shadow:0 20px 70px rgba(0,0,0,.35)}@keyframes pulse{0%,100%{opacity:1;transform:scale(1)}50%{opacity:.45;transform:scale(.8)}}@keyframes shimmer{to{background-position:-200% 0}}@keyframes rise{from{opacity:0;transform:translateY(4px)}to{opacity:1;transform:none}}@media(max-width:900px){.zb-topbar{grid-template-columns:auto 1fr auto}.zb-center{display:none}.brand-sub{display:none}.zb-chat.with-chat{width:100%!important}.zb-right,.zb-split{display:none}.zb-composer{width:100%}.zb-actions button:not(.icon-btn):not(.publish){display:none}.web-drawer{right:10px;bottom:10px;width:min(360px,calc(100vw - 20px))}}
`
