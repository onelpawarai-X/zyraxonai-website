import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

type Role = 'user' | 'assistant'
type Source = { title: string; url: string; snippet?: string }
type Message = { id: string; role: Role; content: string; sources?: Source[] }
type Activity = { id: string; label: string; detail?: string; state: 'running' | 'done' | 'error' }
type Theme = 'dark' | 'light'
type Device = 'desktop' | 'tablet' | 'mobile'

const MODELS = [
  { id: 'mimo-v2.5-free', name: 'MiMo V2.5 Free', note: 'Balanced builder' },
  { id: 'nemotron-3-super-free', name: 'Nemotron 3 Super Free', note: 'Deep reasoning' },
  { id: 'big-pickle', name: 'Big Pickle', note: 'Fast generation' },
]

const STARTER = `<!doctype html><html><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>ZYRAXON</title><style>body{margin:0;font-family:Inter,system-ui;background:#090b12;color:white;display:grid;place-items:center;min-height:100vh}main{text-align:center;max-width:760px;padding:40px}h1{font-size:clamp(42px,7vw,82px);letter-spacing:-.06em;margin:0 0 18px}p{color:#9aa1b2;font-size:18px;line-height:1.7}</style></head><body><main><h1>Start with an idea.</h1><p>Describe the website you want ZYRAXON AI to build.</p></main></body></html>`

const uid = (p: string) => `${p}-${Date.now()}-${Math.random().toString(36).slice(2,7)}`

function extractHtml(text: string) {
  const match = text.match(/```(?:html)?\s*([\s\S]*?)```/i)
  const html = match?.[1]?.trim() || (text.includes('<html') ? text.trim() : '')
  return html.includes('<html') ? html : ''
}

async function streamSse(response: Response, onDelta: (full: string) => void) {
  const reader = response.body?.getReader()
  if (!reader) throw new Error('Streaming is unavailable from this provider.')
  const decoder = new TextDecoder()
  let buffer = ''
  let full = ''
  const consume = (line: string) => {
    const payload = line.trim().replace(/^data:\s?/, '')
    if (!payload || payload === '[DONE]') return
    try {
      const json = JSON.parse(payload)
      const delta = json?.choices?.[0]?.delta?.content ?? json?.choices?.[0]?.message?.content ?? ''
      if (typeof delta === 'string' && delta) { full += delta; onDelta(full) }
    } catch { /* wait for the next complete SSE frame */ }
  }
  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    buffer += decoder.decode(value, { stream: true })
    const lines = buffer.split(/\r?\n/)
    buffer = lines.pop() || ''
    lines.forEach(consume)
  }
  if (buffer.trim()) consume(buffer)
  return full
}

export default function BuilderStudio() {
  const [theme, setTheme] = useState<Theme>('dark')
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [model, setModel] = useState(MODELS[0].id)
  const [html, setHtml] = useState(STARTER)
  const [device, setDevice] = useState<Device>('desktop')
  const [codeOpen, setCodeOpen] = useState(false)
  const [activityOpen, setActivityOpen] = useState(false)
  const [modelOpen, setModelOpen] = useState(false)
  const [webOpen, setWebOpen] = useState(false)
  const [sources, setSources] = useState<Source[]>([])
  const [search, setSearch] = useState('')
  const [searching, setSearching] = useState(false)
  const [streaming, setStreaming] = useState(false)
  const [error, setError] = useState('')
  const [split, setSplit] = useState(42)
  const [activities, setActivities] = useState<Activity[]>([])
  const [githubToken, setGithubToken] = useState('')
  const [repo, setRepo] = useState('')
  const [publishOpen, setPublishOpen] = useState(false)
  const [publishState, setPublishState] = useState('')
  const [activeFile, setActiveFile] = useState<'index.html'|'styles.css'|'script.js'>('index.html')
  const abortRef = useRef<AbortController | null>(null)
  const dragRef = useRef(false)
  const current = MODELS.find(m => m.id === model) || MODELS[0]
  const hasChat = messages.length > 0

  const files = useMemo(() => ({
    'index.html': html,
    'styles.css': html.match(/<style[^>]*>([\s\S]*?)<\/style>/i)?.[1]?.trim() || '/* styles are embedded in index.html */',
    'script.js': html.match(/<script[^>]*>([\s\S]*?)<\/script>/i)?.[1]?.trim() || '// no JavaScript yet',
  }), [html])

  useEffect(() => {
    try { const saved = sessionStorage.getItem('zyraxon.builder.theme'); if (saved === 'light' || saved === 'dark') setTheme(saved) } catch {}
  }, [])
  useEffect(() => { try { sessionStorage.setItem('zyraxon.builder.theme', theme) } catch {} }, [theme])

  const addActivity = (label: string, detail?: string) => {
    const item = { id: uid('activity'), label, detail, state: 'running' as const }
    setActivities(prev => [...prev, item])
    return item.id
  }
  const finishActivity = (id: string, state: Activity['state'] = 'done', detail?: string) => {
    setActivities(prev => prev.map(a => a.id === id ? { ...a, state, detail } : a))
  }

  const searchWeb = useCallback(async (query: string) => {
    if (!query.trim() || searching) return []
    setSearching(true)
    const id = addActivity('Web research', query)
    try {
      const r = await fetch(`/api/public/builder/search?q=${encodeURIComponent(query)}`)
      const data = await r.json()
      if (!r.ok) throw new Error(data?.error || `Search failed (${r.status})`)
      const result = Array.isArray(data.results) ? data.results as Source[] : []
      setSources(result)
      setWebOpen(true)
      finishActivity(id, 'done', `${result.length} sources found`)
      return result
    } catch (e: any) {
      finishActivity(id, 'error', e?.message || 'Search failed')
      return []
    } finally { setSearching(false) }
  }, [searching])

  const send = useCallback(async () => {
    const text = input.trim()
    if (!text || streaming) return
    setInput(''); setError(''); setModelOpen(false)
    const userId = uid('user'), assistantId = uid('assistant')
    const context = messages.slice(-16).map(m => ({ role: m.role, content: m.content }))
    setMessages(prev => [...prev, { id: userId, role: 'user', content: text }, { id: assistantId, role: 'assistant', content: '' }])
    setStreaming(true)
    const controller = new AbortController(); abortRef.current = controller
    const connectId = addActivity('Connecting to model', current.name)
    const streamId = addActivity('Streaming response', 'Live SSE')
    const previewId = addActivity('Live preview', 'Waiting for generated code')
    try {
      const wantsSearch = /\b(search|latest|current|today|news|research|source|reference|image|video|price|documentation)\b/i.test(text)
      const web = wantsSearch ? await searchWeb(text) : sources
      finishActivity(connectId, 'done')
      let prompt = text
      if (web.length) prompt += `\n\nUse these web sources when relevant:\n${web.map(s => `- ${s.title}: ${s.url}${s.snippet ? ` — ${s.snippet}` : ''}`).join('\n')}`
      const response = await fetch('/api/public/builder/chat', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ model, messages: [...context, { role: 'user', content: prompt }] }), signal: controller.signal })
      if (!response.ok) { const data = await response.json().catch(() => null); throw new Error(data?.error || `Provider returned HTTP ${response.status}`) }
      let latest = ''
      await streamSse(response, value => {
        latest = value
        setMessages(prev => prev.map(m => m.id === assistantId ? { ...m, content: value, sources: web } : m))
        const generated = extractHtml(value)
        if (generated) { setHtml(generated); finishActivity(previewId, 'done', 'Preview refreshed') }
      })
      finishActivity(streamId, 'done', 'Stream complete')
      if (!latest) throw new Error('The model returned an empty response. Try another model.')
    } catch (e: any) {
      if (e?.name !== 'AbortError') {
        const message = e?.message || 'Generation failed.'
        setError(message)
        finishActivity(connectId, 'error', message); finishActivity(streamId, 'error', message); finishActivity(previewId, 'error', 'No preview update')
        setMessages(prev => prev.filter(m => m.id !== assistantId || m.content))
      }
    } finally { setStreaming(false); abortRef.current = null }
  }, [input, streaming, messages, model, current.name, sources, searchWeb])

  const publish = async () => {
    if (!githubToken.trim() || !repo.trim()) { setPublishState('Enter your GitHub token and repository name.'); return }
    setPublishState('Publishing…')
    try {
      const name = repo.trim().replace(/\.git$/, '').split('/').filter(Boolean).at(-1) || repo.trim()
      const r = await fetch('/api/public/builder/publish', { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({ token: githubToken.trim(), repo: name, html }) })
      const data = await r.json()
      if (!r.ok || !data.ok) throw new Error(data?.error || 'GitHub publish failed')
      setPublishState(data.pagesUrl || data.repoUrl || 'Published successfully.')
    } catch (e: any) { setPublishState(e?.message || 'GitHub publish failed') }
  }

  const reset = () => { abortRef.current?.abort(); setMessages([]); setHtml(STARTER); setSources([]); setActivities([]); setError('') }
  const code = files[activeFile]

  return <div className={`zyraxon-builder ${theme}`}>
    <style>{CSS}</style>
    <header className="zb-topbar">
      <a className="zb-brand" href="/"><span className="zb-logo"><svg viewBox="0 0 40 40"><defs><linearGradient id="zg" x1="0" x2="1"><stop stopColor="#b99cff"/><stop offset="1" stopColor="#65ead8"/></linearGradient></defs><path d="M9 12 20 7l11 5v16l-11 5-11-5z" fill="none" stroke="url(#zg)" strokeWidth="1.5"/><path d="m14 20 4 4 8-9" fill="none" stroke="url(#zg)" strokeWidth="2" strokeLinecap="round"/><circle cx="20" cy="20" r="16" fill="none" stroke="url(#zg)" strokeOpacity=".2" className="spin"/></svg></span><b>ZYRAXON</b><span>AI BUILDER</span></a>
      <div className="zb-center"><button className={!codeOpen?'active':''} onClick={()=>setCodeOpen(false)}>Build</button><button className={codeOpen?'active':''} onClick={()=>setCodeOpen(true)}>Code</button></div>
      <div className="zb-actions"><button onClick={()=>setTheme(theme==='dark'?'light':'dark')} title="Toggle theme">{theme==='dark'?'☼':'☾'}</button><button onClick={()=>setActivityOpen(!activityOpen)}><i className={streaming?'pulse':''}/>Activity</button><button onClick={()=>setModelOpen(!modelOpen)}>{current.name}⌄</button><button className="publish" onClick={()=>setPublishOpen(true)}>Publish</button></div>
      {modelOpen && <div className="zb-models"><small>OPENCODE ZEN</small>{MODELS.map(m=><button key={m.id} className={m.id===model?'selected':''} onClick={()=>{setModel(m.id);setModelOpen(false)}}><span>✦</span><b>{m.name}</b><em>{m.note}</em>{m.id===model&&<strong>✓</strong>}</button>)}<a href="https://opencode.ai/docs/zen" target="_blank" rel="noreferrer">OpenCode documentation ↗</a></div>}
    </header>

    <main className="zb-workspace">
      <section className={`zb-chat ${hasChat?'with-chat':''}`} style={{width:hasChat?`${split}%`:'100%'}}>
        <div className="zb-chat-inner">
          {!hasChat && <div className="zb-welcome"><div className="hero-logo"><svg viewBox="0 0 80 80"><circle cx="40" cy="40" r="32" fill="none" stroke="url(#zg2)" strokeWidth="1"/><path d="M25 40h30M40 25v30" stroke="url(#zg2)" strokeWidth="1.5"/><defs><linearGradient id="zg2"><stop stopColor="#b99cff"/><stop offset="1" stopColor="#65ead8"/></linearGradient></defs></svg></div><h1>What will you build?</h1><p>Describe an idea. ZYRAXON can generate the site, research the web and update the live preview while it works.</p><div className="suggestions"><button onClick={()=>setInput('Build a premium AI SaaS landing page')}>AI SaaS</button><button onClick={()=>setInput('Build a modern developer portfolio')}>Portfolio</button><button onClick={()=>setInput('Build a luxury product website')}>Product site</button></div></div>}
          {hasChat && <div className="zb-messages">{messages.map(m=><article key={m.id} className={`zb-message ${m.role}`}>{m.role==='assistant'&&<span className="avatar">Z</span>}<div><small>{m.role==='assistant'?'ZYRAXON AI':'YOU'}</small><div className="message-content">{m.content || <span className="thinking"><i/>Thinking · streaming live…</span>}</div>{m.sources?.length ? <div className="chips">{m.sources.slice(0,5).map(s=><a key={s.url} href={s.url} target="_blank" rel="noreferrer">{s.title}</a>)}</div>:null}</div></article>)}{error&&<div className="zb-error"><b>Generation paused</b><span>{error}</span><button onClick={send}>Try again</button></div>}</div>}
          <div className="zb-composer"><div className="composer-inner"><textarea value={input} onChange={e=>setInput(e.target.value)} onKeyDown={e=>{if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();send()}}} placeholder="Ask ZYRAXON to build, research, change or fix…" rows={1}/><div className="composer-tools"><button className={webOpen?'tool-active':''} onClick={()=>setWebOpen(!webOpen)}>⌕ Web</button><span>{current.name}</span><button className="send" onClick={()=>streaming?abortRef.current?.abort():send()}>{streaming?'■':'↑'}</button></div></div><small>Enter to build · Shift + Enter for a new line</small></div>
        </div>
      </section>

      {hasChat && <div className="zb-split" onPointerDown={()=>{dragRef.current=true}} onDoubleClick={()=>setSplit(42)}><span>⋮</span></div>}
      {hasChat && <section className="zb-preview"><div className="preview-bar"><b><i/>Live preview</b><div><button className={device==='desktop'?'active':''} onClick={()=>setDevice('desktop')}>Desktop</button><button className={device==='tablet'?'active':''} onClick={()=>setDevice('tablet')}>Tablet</button><button className={device==='mobile'?'active':''} onClick={()=>setDevice('mobile')}>Mobile</button></div></div>{codeOpen?<div className="code-view"><aside><small>EXPLORER</small>{(['index.html','styles.css','script.js'] as const).map(name=><button key={name} className={activeFile===name?'active':''} onClick={()=>setActiveFile(name)}><span>{name.endsWith('html')?'◇':name.endsWith('css')?'#':'JS'}</span>{name}</button>)}<button className="reset" onClick={reset}>Reset project</button></aside><div className="editor"><div className="editor-head"><b>{activeFile}</b><span>GENERATED CODE</span></div><pre>{code.split('\n').map((line,i)=><code key={i}><i>{String(i+1).padStart(3,' ')}</i>{line}\n</code>)}</pre></div></div>:<div className="preview-stage"><div className={`device ${device}`}><iframe title="ZYRAXON live preview" srcDoc={html} sandbox="allow-scripts allow-forms allow-modals"/></div></div>}</section>}
    </main>

    {activityOpen&&<aside className="zb-drawer activity"><header><b>Live activity</b><button onClick={()=>setActivityOpen(false)}>×</button></header>{activities.length?activities.map(a=><div className="activity-row" key={a.id}><span className={a.state}>{a.state==='done'?'✓':a.state==='error'?'!':'•'}</span><div><b>{a.label}</b><small>{a.detail||'Working…'}</small></div></div>):<p>Model, web-search and preview operations will appear here in real time.</p>}</aside>}
    {webOpen&&<aside className="zb-drawer web"><header><b>Web research</b><button onClick={()=>setWebOpen(false)}>×</button></header><div className="search"><input value={search} onChange={e=>setSearch(e.target.value)} onKeyDown={e=>e.key==='Enter'&&searchWeb(search)} placeholder="Search the web…"/><button onClick={()=>searchWeb(search)}>{searching?'…':'⌕'}</button></div>{sources.map(s=><a className="source" key={s.url} href={s.url} target="_blank" rel="noreferrer"><b>{s.title}</b><small>{s.url}</small><span>{s.snippet}</span></a>)}</aside>}
    {publishOpen&&<div className="zb-modal-bg"><div className="zb-modal"><button className="close" onClick={()=>setPublishOpen(false)}>×</button><div className="modal-logo">↗</div><h2>Publish your website</h2><p>Connect a GitHub token and ZYRAXON will create/update the repository through the secure publish endpoint.</p><label>GitHub token<input type="password" value={githubToken} onChange={e=>setGithubToken(e.target.value)} placeholder="ghp_…"/></label><label>Repository name or URL<input value={repo} onChange={e=>setRepo(e.target.value)} placeholder="username/my-site"/></label><button className="publish-wide" onClick={publish}>{publishState.startsWith('Publishing')?'Publishing…':'Create & publish'}</button>{publishState&&<div className="publish-state">{publishState}</div>}</div></div>}
  </div>
}

const CSS = `
.zyraxon-builder{--bg:#06070b;--panel:rgba(14,16,24,.72);--panel2:rgba(22,24,34,.7);--text:#f6f7fb;--muted:#89909e;--line:rgba(255,255,255,.1);--glow:rgba(174,145,255,.2);min-height:100vh;background:radial-gradient(800px 500px at 45% -10%,rgba(141,92,255,.18),transparent 65%),radial-gradient(700px 500px at 95% 90%,rgba(72,225,205,.08),transparent 65%),var(--bg);color:var(--text);font-family:Inter,ui-sans-serif,system-ui,sans-serif;overflow:hidden}.zyraxon-builder.light{--bg:#eef1f7;--panel:rgba(255,255,255,.7);--panel2:rgba(255,255,255,.86);--text:#11131a;--muted:#687080;--line:rgba(20,25,40,.1);--glow:rgba(117,82,220,.16);background:radial-gradient(800px 500px at 45% -10%,rgba(148,115,255,.2),transparent 65%),linear-gradient(135deg,#f8f9fc,#e9edf5)}.zyraxon-builder *{box-sizing:border-box}.zyraxon-builder button,.zyraxon-builder input,.zyraxon-builder textarea{font:inherit}.zb-topbar{height:66px;border-bottom:1px solid var(--line);display:flex;align-items:center;justify-content:space-between;padding:0 18px;background:var(--panel);backdrop-filter:blur(30px) saturate(150%);position:relative;z-index:50}.zb-brand{display:flex;align-items:center;gap:9px;color:var(--text);text-decoration:none;font-size:12px;letter-spacing:.08em}.zb-brand span:last-child{font-size:9px;color:var(--muted);letter-spacing:.12em}.zb-logo{width:34px;height:34px;border:1px solid var(--line);border-radius:11px;background:linear-gradient(145deg,rgba(185,156,255,.15),rgba(101,234,216,.06));display:grid;place-items:center;box-shadow:0 0 40px var(--glow)}.zb-logo svg{width:29px;height:29px}.spin{transform-origin:center;animation:spin 15s linear infinite}@keyframes spin{to{transform:rotate(360deg)}}.zb-center{position:absolute;left:50%;transform:translateX(-50%);padding:3px;border:1px solid var(--line);border-radius:12px;background:var(--panel2);display:flex}.zb-center button,.zb-actions button{border:0;background:transparent;color:var(--muted);padding:8px 12px;border-radius:9px;cursor:pointer}.zb-center button.active{background:rgba(255,255,255,.09);color:var(--text)}.zb-actions{display:flex;gap:5px;align-items:center}.zb-actions button{font-size:10px;border:1px solid var(--line);background:var(--panel);backdrop-filter:blur(18px)}.zb-actions .publish,.publish-wide{background:linear-gradient(135deg,#b99cff,#65ead8);color:#090a0e;font-weight:850;border:0}.zb-actions .publish{padding:9px 15px}.zb-actions i{width:6px;height:6px;border-radius:50%;background:#64e6ae;display:inline-block;margin-right:6px}.zb-actions i.pulse{box-shadow:0 0 12px #b99cff;animation:pulse 1s infinite}@keyframes pulse{50%{opacity:.3}}.zb-models{position:absolute;right:115px;top:58px;width:300px;background:var(--panel2);border:1px solid var(--line);border-radius:16px;padding:9px;backdrop-filter:blur(35px);box-shadow:0 30px 90px rgba(0,0,0,.35)}.zb-models>small{display:block;color:var(--muted);padding:9px;font-size:8px;letter-spacing:.14em}.zb-models button{width:100%;display:grid;grid-template-columns:22px 1fr 20px;grid-template-rows:1fr 1fr;text-align:left;padding:10px;border:0;border-radius:10px;background:transparent;color:var(--text);cursor:pointer}.zb-models button:hover,.zb-models button.selected{background:rgba(255,255,255,.06)}.zb-models button span{grid-row:1/3;color:#b99cff}.zb-models b{font-size:11px}.zb-models em{font-size:9px;color:var(--muted);font-style:normal}.zb-models strong{grid-column:3;grid-row:1/3;align-self:center;color:#64e6ae}.zb-models a{display:block;color:var(--muted);font-size:9px;padding:10px;text-decoration:none}.zb-workspace{height:calc(100vh - 66px);display:flex}.zb-chat{display:flex;justify-content:center;min-width:300px}.zb-chat-inner{width:min(850px,calc(100% - 34px));height:100%;display:flex;flex-direction:column}.zb-chat.with-chat .zb-chat-inner{width:calc(100% - 20px)}.zb-welcome{margin:auto 0 50px;text-align:center}.hero-logo{width:76px;height:76px;margin:0 auto 24px;border:1px solid var(--line);border-radius:24px;background:var(--panel);backdrop-filter:blur(30px);box-shadow:0 0 80px var(--glow);display:grid;place-items:center}.hero-logo svg{width:58px}.zb-welcome h1{font-size:clamp(42px,6vw,76px);letter-spacing:-.07em;margin:0 0 14px}.zb-welcome p{max-width:650px;margin:0 auto;color:var(--muted);line-height:1.7;font-size:16px}.suggestions{display:flex;justify-content:center;gap:8px;margin-top:25px}.suggestions button{background:var(--panel);border:1px solid var(--line);color:var(--muted);padding:9px 13px;border-radius:12px;cursor:pointer;backdrop-filter:blur(20px)}.suggestions button:hover{color:var(--text);border-color:rgba(185,156,255,.35)}.zb-messages{flex:1;overflow:auto;padding:30px 5px 20px}.zb-message{display:flex;gap:10px;margin:0 auto 24px;max-width:780px}.zb-message.user{justify-content:flex-end}.zb-message.user>div{max-width:78%;padding:11px 14px;border:1px solid var(--line);border-radius:18px 18px 5px 18px;background:var(--panel);backdrop-filter:blur(25px)}.zb-message.assistant>div{max-width:92%}.zb-message small{display:block;font-size:8px;letter-spacing:.13em;color:var(--muted);margin-bottom:7px}.avatar{width:25px;height:25px;flex:0 0 25px;border-radius:8px;background:linear-gradient(135deg,#b99cff,#65ead8);color:#08090d;display:grid;place-items:center;font-size:11px;font-weight:900}.message-content{white-space:pre-wrap;line-height:1.7;font-size:14px}.thinking{display:inline-flex;align-items:center;gap:8px;color:var(--muted)}.thinking i{width:7px;height:7px;border-radius:50%;background:#b99cff;box-shadow:0 0 14px #b99cff;animation:pulse 1s infinite}.chips{display:flex;flex-wrap:wrap;gap:5px;margin-top:10px}.chips a{color:#a995f5;border:1px solid var(--line);border-radius:999px;padding:4px 8px;font-size:8px;text-decoration:none;background:var(--panel)}.zb-error{margin:10px auto;padding:13px 15px;border:1px solid rgba(255,100,120,.22);border-radius:14px;background:rgba(255,80,100,.06);display:flex;gap:12px;align-items:center;max-width:780px}.zb-error span{flex:1;color:var(--muted);font-size:11px}.zb-error button{background:var(--panel);border:1px solid var(--line);padding:6px 9px;border-radius:8px;color:var(--text)}.zb-composer{padding:15px 0 20px}.composer-inner{position:relative;border:1px solid rgba(255,255,255,.13);border-radius:22px;background:linear-gradient(145deg,rgba(255,255,255,.085),rgba(255,255,255,.035));box-shadow:inset 0 1px rgba(255,255,255,.08),0 25px 80px rgba(0,0,0,.25),0 0 70px var(--glow);backdrop-filter:blur(38px) saturate(160%);padding:14px}.light .composer-inner{border-color:rgba(30,35,50,.12);box-shadow:inset 0 1px rgba(255,255,255,.9),0 25px 70px rgba(70,80,110,.12)}.composer-inner textarea{width:100%;min-height:54px;resize:none;background:transparent;border:0;outline:0;color:var(--text);line-height:1.6}.composer-tools{display:flex;align-items:center;gap:8px}.composer-tools button{background:rgba(255,255,255,.055);border:1px solid var(--line);border-radius:9px;color:var(--muted);padding:6px 9px;cursor:pointer;font-size:9px}.composer-tools .tool-active{color:#b99cff;border-color:rgba(185,156,255,.3)}.composer-tools span{flex:1;color:var(--muted);font-size:9px}.composer-tools .send{width:31px;height:31px;border-radius:10px;background:linear-gradient(135deg,#b99cff,#65ead8);color:#08090d;font-weight:900}.zb-composer>small{display:block;text-align:center;color:var(--muted);font-size:8px;margin-top:8px}.zb-split{width:7px;cursor:col-resize;background:transparent;display:grid;place-items:center}.zb-split span{color:var(--muted);font-size:16px;opacity:.5}.zb-preview{flex:1;min-width:300px;margin:12px 12px 12px 0;border:1px solid var(--line);border-radius:20px;background:var(--panel);overflow:hidden;backdrop-filter:blur(25px);box-shadow:0 25px 80px rgba(0,0,0,.18)}.preview-bar{height:48px;border-bottom:1px solid var(--line);display:flex;align-items:center;justify-content:space-between;padding:0 12px}.preview-bar b{font-size:10px}.preview-bar b i{width:6px;height:6px;border-radius:50%;display:inline-block;background:#65eab1;box-shadow:0 0 9px #65eab1;margin-right:7px}.preview-bar button{border:0;background:transparent;color:var(--muted);padding:6px 8px;font-size:8px;border-radius:7px}.preview-bar button.active{background:rgba(255,255,255,.08);color:var(--text)}.preview-stage{height:calc(100% - 48px);display:grid;place-items:center;padding:22px}.device{height:100%;width:100%;border:1px solid var(--line);border-radius:13px;overflow:hidden;background:#fff;box-shadow:0 30px 70px rgba(0,0,0,.3)}.device.tablet{width:min(760px,85%)}.device.mobile{width:min(390px,62%)}.device iframe{width:100%;height:100%;border:0;background:#fff}.code-view{height:calc(100% - 48px);display:flex}.code-view aside{width:155px;border-right:1px solid var(--line);padding:10px;background:rgba(0,0,0,.08)}.code-view aside small{display:block;color:var(--muted);font-size:8px;letter-spacing:.12em;padding:8px}.code-view aside button{display:block;width:100%;text-align:left;border:0;background:transparent;color:var(--muted);padding:8px;border-radius:7px;font-size:10px}.code-view aside button.active{background:rgba(255,255,255,.07);color:var(--text)}.code-view aside button span{display:inline-block;width:25px;color:#b99cff}.code-view .reset{margin-top:auto}.editor{flex:1;min-width:0;display:flex;flex-direction:column;background:rgba(0,0,0,.14)}.editor-head{height:38px;border-bottom:1px solid var(--line);display:flex;align-items:center;justify-content:space-between;padding:0 12px;font-size:9px}.editor-head span{color:var(--muted);letter-spacing:.1em}.editor pre{margin:0;padding:14px;overflow:auto;flex:1;font:11px/1.7 ui-monospace,SFMono-Regular,Menlo,monospace;color:#cdd2dd}.editor code{display:block}.editor code i{display:inline-block;width:34px;color:#4e5562;font-style:normal;user-select:none}.zb-drawer{position:fixed;top:78px;right:20px;width:330px;max-height:calc(100vh - 98px);overflow:auto;z-index:80;border:1px solid var(--line);border-radius:18px;background:var(--panel2);backdrop-filter:blur(35px);box-shadow:0 30px 100px rgba(0,0,0,.4);padding:12px}.zb-drawer header{display:flex;align-items:center;justify-content:space-between;margin-bottom:12px}.zb-drawer header b{font-size:11px}.zb-drawer header button{background:transparent;border:0;color:var(--muted);font-size:18px}.activity-row{display:flex;gap:10px;padding:10px;border-bottom:1px solid var(--line)}.activity-row>span{width:20px;height:20px;border-radius:7px;display:grid;place-items:center;background:rgba(255,255,255,.05);font-size:10px}.activity-row>span.done{color:#65eab1}.activity-row>span.error{color:#ff7f94}.activity-row>span.running{color:#b99cff;animation:pulse 1s infinite}.activity-row b,.activity-row small{display:block}.activity-row b{font-size:10px}.activity-row small{font-size:9px;color:var(--muted);margin-top:3px}.zb-drawer p{color:var(--muted);font-size:10px;line-height:1.6}.search{display:flex;gap:5px;margin-bottom:10px}.search input{flex:1;min-width:0;background:rgba(255,255,255,.05);border:1px solid var(--line);border-radius:9px;color:var(--text);padding:8px;outline:0;font-size:10px}.search button{border:1px solid var(--line);border-radius:9px;background:var(--panel);color:var(--text)}.source{display:block;text-decoration:none;color:var(--text);padding:10px;border:1px solid var(--line);border-radius:11px;margin:6px 0;background:rgba(255,255,255,.025)}.source b,.source small,.source span{display:block}.source b{font-size:10px}.source small{font-size:8px;color:#a995f5;margin-top:3px}.source span{font-size:9px;color:var(--muted);line-height:1.5;margin-top:5px}.zb-modal-bg{position:fixed;inset:0;background:rgba(0,0,0,.55);backdrop-filter:blur(12px);display:grid;place-items:center;z-index:100}.zb-modal{width:min(440px,calc(100% - 30px));padding:25px;border:1px solid var(--line);border-radius:22px;background:var(--panel2);box-shadow:0 40px 120px rgba(0,0,0,.5);position:relative}.zb-modal .close{position:absolute;right:14px;top:12px;border:0;background:transparent;color:var(--muted);font-size:20px}.modal-logo{width:45px;height:45px;border-radius:14px;background:linear-gradient(135deg,#b99cff,#65ead8);color:#08090d;display:grid;place-items:center;font-weight:900}.zb-modal h2{margin:16px 0 7px;font-size:22px}.zb-modal p{color:var(--muted);font-size:10px;line-height:1.6}.zb-modal label{display:block;font-size:9px;color:var(--muted);margin-top:12px}.zb-modal input{width:100%;margin-top:6px;background:rgba(255,255,255,.05);border:1px solid var(--line);border-radius:10px;color:var(--text);padding:10px;outline:0}.publish-wide{width:100%;margin-top:15px;padding:11px;border-radius:10px;cursor:pointer}.publish-state{margin-top:10px;color:#65eab1;font-size:9px;word-break:break-word}
@media(max-width:900px){.zb-center{display:none}.zb-chat.with-chat{width:100%!important}.zb-preview,.zb-split{display:none}.zb-actions button:not(.publish){padding:7px}.zb-brand>span:last-child{display:none}.suggestions{flex-wrap:wrap}}
`