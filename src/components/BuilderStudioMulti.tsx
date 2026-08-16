import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import Editor from '@monaco-editor/react'

type Role = 'user' | 'assistant'
type Theme = 'dark' | 'light'
type Device = 'desktop' | 'tablet' | 'mobile'
type Mode = 'bolt' | 'plan'
type Source = { title: string; url: string; snippet?: string; kind?: string }
type Message = { id: string; role: Role; content: string; sources?: Source[] }
type FileState = Record<string, string>
type Activity = { id: string; label: string; detail?: string; state: 'running' | 'done' | 'error' }
type GitHubUser = { login: string; name?: string | null; avatar_url?: string | null }

type Model = { id: string; name: string; note: string }
const MODELS: Model[] = [
  { id: 'mimo-v2.5-free', name: 'ZYRAXON TITAN', note: 'MiMo V2.5 Free · balanced builder' },
  { id: 'nemotron-3-super-free', name: 'ZYRAXON NEXUS', note: 'Nemotron 3 Super Free · deep reasoning' },
  { id: 'big-pickle', name: 'ZYRAXON OMEGA', note: 'Big Pickle · fast generation' },
]

const STARTER: FileState = {
  'index.html': '<!doctype html>\n<html>\n<head>\n  <meta charset="UTF-8">\n  <meta name="viewport" content="width=device-width,initial-scale=1">\n  <title>ZYRAXON</title>\n</head>\n<body>\n  <main><h1>Start with an idea.</h1><p>Describe the website you want ZYRAXON AI to build.</p></main>\n</body>\n</html>',
}

const STORAGE_KEY = 'zyraxon.builder.state.v2'
const uid = (p: string) => `${p}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`

const BOLT_SYSTEM = `You are ZYRAXON AI Bolt mode. Execute the user's requested build/change/fix directly. Produce working files, not long explanations. When code is needed, output each actual file exactly once in its own fenced code block and put a filename marker on the first line, for example <!-- file: index.html -->, /* file: src/styles.css */, or // file: src/app.js. Use real filenames and paths. Create as many files as genuinely needed. Never duplicate a file. Preserve existing files unless the user asks to remove them.`
const PLAN_SYSTEM = `You are ZYRAXON AI Plan mode. Planning only. Do not create, modify, replace, publish, or execute files and do not claim work was performed. Return a concise actionable plan with likely file paths, dependencies, UI behavior, and verification steps.`

function fileIcon(name: string) {
  const ext = name.split('.').pop()?.toLowerCase() || ''
  const common = 'width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"'
  const svg = (body: string) => <svg {...({ dangerouslySetInnerHTML: { __html: `<svg ${common}>${body}</svg>` } } as any)} />
  if (ext === 'html' || ext === 'htm') return svg('<path d="M4 3h11l5 5v13H4z"/><path d="M15 3v6h5"/><path d="m8 13 2 2-2 2m5-4-2 2 2 2"/>')
  if (ext === 'css' || ext === 'scss' || ext === 'sass') return svg('<path d="M4 3h16v18H4z"/><path d="m9 8-3 4 3 4m6-8 3 4-3 4"/>')
  if (ext === 'js' || ext === 'jsx' || ext === 'ts' || ext === 'tsx') return svg('<path d="M4 3h16v18H4z"/><path d="M8 17v-5l3 5v-5m4 0v5m0-2h3"/>')
  if (ext === 'json') return svg('<path d="M5 3h14v18H5z"/><path d="m9 8-2 4 2 4m6-8 2 4-2 4"/>')
  if (ext === 'md') return svg('<path d="M4 5h16v14H4z"/><path d="M7 15V9l3 3 3-3v6m3-3h2"/>')
  return svg('<path d="M5 3h9l5 5v13H5z"/><path d="M14 3v6h5"/>')
}

function parseFiles(text: string, previous: FileState): FileState {
  const next = { ...previous }
  const re = /```(?:[\w.+-]+)?\s*\n?([\s\S]*?)(?:```|$)/g
  let match: RegExpExecArray | null
  while ((match = re.exec(text))) {
    let body = match[1].trim()
    const marker = body.match(/^(?:<!--|\/\*|\/\/|#)\s*file:\s*([^\n]+?)(?:\s*-->|\s*\*\/)?\s*\n/i)
    if (!marker) continue
    const name = marker[1].trim().replace(/^['"]|['"]$/g, '')
    body = body.slice(marker[0].length).trim()
    if (name && body) next[name] = body
  }
  return next
}

function buildPreview(files: FileState) {
  let htmlKey = Object.keys(files).find(k => /(^|\/)index\.html?$/i.test(k)) || Object.keys(files).find(k => k.toLowerCase().endsWith('.html'))
  if (!htmlKey) htmlKey = 'index.html'
  let html = files[htmlKey] || ''
  const css = Object.entries(files).filter(([k]) => /\.(css|scss)$/i.test(k)).map(([, v]) => v).join('\n')
  const js = Object.entries(files).filter(([k]) => /\.(js|jsx|ts|tsx)$/i.test(k)).map(([, v]) => v).join('\n')
  if (css && !/<style[\s>]/i.test(html)) html = html.replace(/<\/head>/i, `<style>${css}</style></head>`)
  if (js && !/<script[\s>]/i.test(html)) html = html.replace(/<\/body>/i, `<script>${js}</script></body>`)
  const bridge = `<script>(function(){document.addEventListener('click',function(e){var a=e.target&&e.target.closest&&e.target.closest('a');if(!a)return;var h=a.getAttribute('href')||'';if(h&&(!/^[a-z][a-z0-9+.-]*:/i.test(h)||h.startsWith(location.origin))){e.preventDefault();try{history.pushState({},'',h)}catch(_){}}},true);window.addEventListener('error',function(e){try{parent.postMessage({source:'zyraxon-preview',type:'error',message:e.message||'Preview error'},'*')}catch(_){}});})();</script>`
  return /<\/body>/i.test(html) ? html.replace(/<\/body>/i, bridge + '</body>') : html + bridge
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
    } catch {}
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

function languageCandidates() {
  const map: Record<string, string> = {
    bn: 'bn-BD', hi: 'hi-IN', ur: 'ur-PK', ar: 'ar-SA', ta: 'ta-IN', te: 'te-IN', ml: 'ml-IN',
    es: 'es-ES', fr: 'fr-FR', de: 'de-DE', pt: 'pt-BR', id: 'id-ID', tr: 'tr-TR', it: 'it-IT',
    ja: 'ja-JP', ko: 'ko-KR', zh: 'zh-CN', ru: 'ru-RU', en: 'en-US',
  }
  const out: string[] = []
  for (const lang of Array.from(navigator.languages || [])) {
    const key = lang.toLowerCase().split('-')[0]
    if (map[key] && !out.includes(map[key])) out.push(map[key])
  }
  for (const value of ['bn-BD', 'en-US', 'hi-IN', 'ur-PK', 'ar-SA', 'ta-IN', 'te-IN', 'ml-IN', 'es-ES', 'fr-FR', 'de-DE', 'pt-BR', 'id-ID', 'tr-TR', 'it-IT', 'ja-JP', 'ko-KR', 'zh-CN', 'ru-RU']) if (!out.includes(value)) out.push(value)
  return out
}

export default function BuilderStudioMulti() {
  const [theme, setTheme] = useState<Theme>('dark')
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [model, setModel] = useState(MODELS[0].id)
  const [files, setFiles] = useState<FileState>(STARTER)
  const [activeFile, setActiveFile] = useState('index.html')
  const [device, setDevice] = useState<Device>('desktop')
  const [view, setView] = useState<'preview' | 'code'>('preview')
  const [mode, setMode] = useState<Mode>('bolt')
  const [modeOpen, setModeOpen] = useState(false)
  const [modelOpen, setModelOpen] = useState(false)
  const [activityOpen, setActivityOpen] = useState(false)
  const [publishOpen, setPublishOpen] = useState(false)
  const [repo, setRepo] = useState('')
  const [publishState, setPublishState] = useState('')
  const [streaming, setStreaming] = useState(false)
  const [error, setError] = useState('')
  const [activities, setActivities] = useState<Activity[]>([])
  const [sources, setSources] = useState<Source[]>([])
  const [searching, setSearching] = useState(false)
  const [githubUser, setGithubUser] = useState<GitHubUser | null>(null)
  const [accountOpen, setAccountOpen] = useState(false)
  const [voiceListening, setVoiceListening] = useState(false)
  const [voiceError, setVoiceError] = useState('')
  const [split, setSplit] = useState(44)
  const textareaRef = useRef<HTMLTextAreaElement | null>(null)
  const abortRef = useRef<AbortController | null>(null)
  const recognitionRef = useRef<any>(null)
  const voiceCommittedRef = useRef('')
  const voiceRetryRef = useRef(0)
  const dragRef = useRef(false)
  const current = MODELS.find(x => x.id === model) || MODELS[0]
  const preview = useMemo(() => buildPreview(files), [files])
  const fileNames = Object.keys(files)
  const hasChat = messages.length > 0

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY)
      if (raw) {
        const saved = JSON.parse(raw)
        if (saved.theme === 'dark' || saved.theme === 'light') setTheme(saved.theme)
        if (saved.files && typeof saved.files === 'object') setFiles(saved.files)
        if (Array.isArray(saved.messages)) setMessages(saved.messages.slice(-80))
        if (typeof saved.model === 'string' && MODELS.some(m => m.id === saved.model)) setModel(saved.model)
      }
    } catch {}
  }, [])

  useEffect(() => {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify({ theme, files, messages: messages.slice(-80), model })) } catch {}
  }, [theme, files, messages, model])

  useEffect(() => {
    const move = (e: PointerEvent) => { if (dragRef.current) setSplit(Math.min(68, Math.max(32, (e.clientX / window.innerWidth) * 100))) }
    const up = () => { dragRef.current = false }
    window.addEventListener('pointermove', move); window.addEventListener('pointerup', up)
    return () => { window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', up) }
  }, [])

  const loadGitHub = useCallback(async () => {
    try {
      const r = await fetch('/api/public/auth/github/me', { credentials: 'include', cache: 'no-store' })
      if (!r.ok) { setGithubUser(null); return }
      const body = await r.json()
      setGithubUser(body?.user ? { login: body.user.login, name: body.user.name, avatar_url: body.user.avatar_url } : null)
    } catch { setGithubUser(null) }
  }, [])

  useEffect(() => {
    loadGitHub()
    const params = new URLSearchParams(window.location.search)
    const githubError = params.get('github_error')
    if (params.get('github') === 'connected') loadGitHub()
    if (githubError) setError(`GitHub sign-in failed: ${githubError}`)
    if (params.has('github') || params.has('github_error')) window.history.replaceState({}, document.title, window.location.pathname + window.location.hash)
  }, [loadGitHub])

  const addActivity = (label: string, detail?: string) => { const item = { id: uid('a'), label, detail, state: 'running' as const }; setActivities(p => [...p, item]); return item.id }
  const finish = (id: string, state: Activity['state'] = 'done', detail?: string) => setActivities(p => p.map(a => a.id === id ? { ...a, state, detail } : a))

  const startGitHubLogin = () => window.location.assign('/api/public/auth/github/start')

  const logoutGitHub = async () => {
    try { await fetch('/api/public/auth/github/logout', { method: 'POST', credentials: 'include' }) } catch {}
    setGithubUser(null); setAccountOpen(false)
  }

  const resetAll = async () => {
    if (!window.confirm('Reset ZYRAXON local data, chat history and GitHub session?')) return
    abortRef.current?.abort()
    try { recognitionRef.current?.stop() } catch {}
    try { await fetch('/api/public/auth/github/logout', { method: 'POST', credentials: 'include' }) } catch {}
    try { localStorage.clear() } catch {}
    try { sessionStorage.clear() } catch {}
    setMessages([]); setFiles(STARTER); setActiveFile('index.html'); setSources([]); setActivities([]); setError(''); setRepo(''); setPublishState(''); setGithubUser(null); setAccountOpen(false); setVoiceListening(false); setVoiceError('')
    window.history.replaceState({}, document.title, '/builder')
  }

  const searchWeb = useCallback(async (query: string) => {
    if (!query.trim() || searching) return [] as Source[]
    setSearching(true)
    const id = addActivity('AI web research', query)
    try {
      const r = await fetch(`/api/public/builder/search?q=${encodeURIComponent(query)}`)
      const data = await r.json()
      if (!r.ok) throw new Error(data?.error || 'Search failed')
      const result = Array.isArray(data.results) ? data.results as Source[] : []
      setSources(result); finish(id, 'done', `${result.length} sources found`); return result
    } catch (e: any) { finish(id, 'error', e?.message || 'Search failed'); return [] }
    finally { setSearching(false) }
  }, [searching])

  const send = useCallback(async () => {
    const text = input.trim(); if (!text || streaming) return
    setInput(''); setError(''); setModeOpen(false); setModelOpen(false)
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
    const connect = addActivity('Connecting to model', current.name)
    const stream = addActivity('Bolt implementation', 'Live file streaming')
    const previewId = addActivity('Live preview', 'Waiting for files')
    try {
      const wantsSearch = /\b(search|latest|current|today|news|research|source|reference|image|video|price|documentation|browse|find|website)\b/i.test(text)
      const web = wantsSearch ? await searchWeb(text) : []
      finish(connect, 'done')
      let prompt = text
      if (web.length) prompt += `\n\nUse these references when relevant:\n${web.map(s => `- ${s.title}: ${s.url}${s.snippet ? ` — ${s.snippet}` : ''}`).join('\n')}`
      const response = await fetch('/api/public/builder/chat', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ model, messages: [{ role: 'system', content: BOLT_SYSTEM }, ...context, { role: 'user', content: prompt }] }), signal: controller.signal })
      if (!response.ok) { const d = await response.json().catch(() => null); throw new Error(d?.error || `Provider returned HTTP ${response.status}`) }
      let latest = ''
      let live = files
      await streamSse(response, value => {
        latest = value
        const parsed = parseFiles(value, live)
        if (JSON.stringify(parsed) !== JSON.stringify(live)) {
          live = parsed; setFiles(parsed)
          const newest = Object.keys(parsed).filter(k => !(k in files) || parsed[k] !== files[k])
          if (newest[0]) setActiveFile(newest[0])
          finish(previewId, 'done', `${newest.slice(-3).join(', ')} updated`)
        }
        setMessages(p => p.map(m => m.id === assistantId ? { ...m, content: value, sources: web } : m))
      })
      finish(stream, 'done', 'Stream complete')
      if (!latest) throw new Error('The model returned an empty response.')
    } catch (e: any) {
      if (e?.name !== 'AbortError') { const msg = e?.message || 'Generation failed'; setError(msg); finish(connect, 'error', msg); finish(stream, 'error', msg); finish(previewId, 'error', 'No preview update') }
    } finally { setStreaming(false); abortRef.current = null }
  }, [input, streaming, mode, messages, model, current.name, files, searchWeb])

  const publish = async () => {
    if (!githubUser) { setPublishState('Sign in with GitHub first. No token is required after sign-in.'); return }
    const name = repo.trim().replace(/\.git$/, '').split('/').filter(Boolean).at(-1) || ''
    if (!name) { setPublishState('Enter a repository name.'); return }
    setPublishState('Publishing…')
    try {
      const r = await fetch('/api/public/builder/publish', { method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ repo: name, files, description: 'Built with ZYRAXON AI' }) })
      const d = await r.json().catch(() => ({}))
      if (!r.ok || !d.ok) throw new Error(d?.error || 'GitHub publish failed')
      setPublishState(d.pagesUrl || d.repoUrl || 'Published successfully.')
    } catch (e: any) { setPublishState(e?.message || 'GitHub publish failed') }
  }

  const stopVoice = () => {
    try { recognitionRef.current?.stop() } catch {}
    recognitionRef.current = null
    setVoiceListening(false)
  }

  const startVoice = () => {
    setVoiceError('')
    const Ctor = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
    if (!Ctor) { setVoiceError('Speech recognition is not supported by this browser.'); return }
    if (voiceListening) { stopVoice(); return }
    const textarea = textareaRef.current
    if (!textarea) return
    const candidates = languageCandidates()
    voiceCommittedRef.current = input
    voiceRetryRef.current = 0
    setVoiceListening(true)

    const run = () => {
      if (!voiceListening && voiceRetryRef.current > 0) return
      const recognition = new Ctor()
      recognition.continuous = true
      recognition.interimResults = true
      recognition.maxAlternatives = 3
      recognition.lang = candidates[voiceRetryRef.current % candidates.length] || 'en-US'
      recognition.onresult = (event: any) => {
        let interim = ''
        for (let i = event.resultIndex; i < event.results.length; i++) {
          const result = event.results[i]
          const text = result?.[0]?.transcript || ''
          if (result?.isFinal && text.trim()) voiceCommittedRef.current += (voiceCommittedRef.current && !/\s$/.test(voiceCommittedRef.current) ? ' ' : '') + text.trim()
          else interim += text
        }
        setInput(voiceCommittedRef.current + (interim ? (voiceCommittedRef.current && !/\s$/.test(voiceCommittedRef.current) ? ' ' : '') + interim : ''))
      }
      recognition.onerror = (event: any) => {
        const code = String(event?.error || '')
        if (code === 'not-allowed' || code === 'service-not-allowed' || code === 'audio-capture') { setVoiceError(code === 'not-allowed' ? 'Microphone permission was denied.' : `Microphone error: ${code}`); stopVoice(); return }
        if (code === 'language-not-supported' || code === 'language-unavailable' || code === 'no-speech' || code === 'nomatch') voiceRetryRef.current += 1
      }
      recognition.onend = () => { if (voiceListening) window.setTimeout(run, 120) }
      recognitionRef.current = recognition
      try { recognition.start() } catch { stopVoice() }
    }
    run()
  }

  return <div className={`zyraxon-builder ${theme}`}>
    <style>{CSS}</style>
    <header className="zb-topbar glass">
      <a className="zb-brand" href="/"><span className="zb-mark">Z</span><span className="brand-name">ZYRAXON</span><span className="brand-sub">AI BUILDER</span></a>
      <div className="top-title">Builder Studio</div>
      <div className="top-actions">
        <button className="glass-btn" onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')} aria-label="Toggle theme">{theme === 'dark' ? '☼' : '☾'}</button>
        <button className="glass-btn" onClick={() => setActivityOpen(x => !x)}><span className={streaming ? 'live-dot' : ''}/>Activity</button>
        <button className="glass-btn" onClick={() => { setPublishState(''); setPublishOpen(true) }}>Publish</button>
        <div className="account-stack">
          <button className="account-btn" onClick={() => githubUser ? setAccountOpen(v => !v) : startGitHubLogin()} aria-label={githubUser ? 'GitHub profile' : 'Sign in with GitHub'} title={githubUser ? `GitHub · @${githubUser.login}` : 'Sign in with GitHub'}>
            {githubUser?.avatar_url ? <img src={githubUser.avatar_url} alt="" /> : <span className="github-mark">◉</span>}
          </button>
          <button className="reset-btn" onClick={resetAll} title="Reset local data and session" aria-label="Reset local data and session">↻</button>
          {accountOpen && githubUser && <div className="account-pop glass"><b>{githubUser.name || githubUser.login}</b><small>@{githubUser.login}</small><button onClick={logoutGitHub}>Sign out</button></div>}
        </div>
      </div>
      {activityOpen && <div className="popover activity-pop"><b>Live activity</b>{activities.length ? activities.slice(-10).reverse().map(a => <div className="activity-row" key={a.id}><span className={`state ${a.state}`}/><div><strong>{a.label}</strong><small>{a.detail}</small></div></div>) : <small>No activity yet.</small>}</div>}
    </header>

    <main className={`zb-workspace ${hasChat ? 'has-chat' : 'empty'}`} style={{ '--chat-split': `${split}%` } as any}>
      <section className="chat-pane">
        <div className="chat-scroll">
          {!hasChat ? <div className="welcome"><div className="hero-z">Z</div><h1>What will you build?</h1><p>Describe it. ZYRAXON builds it live, streams the work, and keeps the result inside a protected preview.</p><div className="suggestions"><button onClick={() => setInput('Build a premium AI SaaS landing page')}>AI SaaS</button><button onClick={() => setInput('Build a modern developer portfolio')}>Portfolio</button><button onClick={() => setInput('Build a luxury product website')}>Product</button></div></div> : <div className="messages">{messages.map(m => <article className={`message ${m.role}`} key={m.id}><div className="message-label">{m.role === 'assistant' ? 'ZYRAXON AI' : 'YOU'}</div>{m.role === 'assistant' && !m.content ? <div className="thinking"><i/>Working live…</div> : <div className="message-content">{m.role === 'assistant' ? <AssistantContent content={m.content} /> : <div>{m.content}</div>}</div>}{m.sources?.length ? <div className="source-row">{m.sources.slice(0, 4).map(s => <a key={s.url} href={s.url} target="_blank" rel="noreferrer">{s.title}</a>)}</div> : null}</article>)}{error && <div className="error-card"><b>Generation paused</b><span>{error}</span></div>}</div>}
        </div>
        <div className="composer glass">
          <textarea ref={textareaRef} value={input} rows={1} placeholder={mode === 'plan' ? 'Describe what you want planned…' : 'Ask ZYRAXON to build, change, fix or research…'} onChange={e => setInput(e.target.value)} onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send() } }} />
          <div className="composer-row">
            <div className="composer-left">
              <div className="mode-wrap"><button className="mode-btn" onClick={() => setModeOpen(x => !x)}><span className={mode === 'bolt' ? 'bolt' : 'plan'}/>{mode === 'bolt' ? 'Bolt' : 'Plan'}⌄</button>{modeOpen && <div className="popover mode-pop"><button className={mode === 'bolt' ? 'selected' : ''} onClick={() => { setMode('bolt'); setModeOpen(false) }}><span className="bolt"/><div><b>Bolt</b><small>Talk + build + modify</small></div></button><button className={mode === 'plan' ? 'selected' : ''} onClick={() => { setMode('plan'); setModeOpen(false) }}><span className="plan"/><div><b>Plan</b><small>Plan only — no changes</small></div></button></div>}</div>
              <div className="model-wrap"><button className="model-btn" onClick={() => setModelOpen(x => !x)}>{current.name}⌄</button>{modelOpen && <div className="popover model-pop">{MODELS.map(m => <button key={m.id} className={m.id === model ? 'selected' : ''} onClick={() => { setModel(m.id); setModelOpen(false) }}><b>{m.name}</b><small>{m.note}</small></button>)}</div>}</div>
              <span className="auto-access">AI web access · automatic</span>
            </div>
            <div className="send-group">
              <button className={`voice-btn ${voiceListening ? 'listening' : ''}`} onClick={startVoice} aria-label="Voice input" title={voiceListening ? 'Stop voice input' : 'Voice input'}>{voiceListening ? '■' : '♩'}</button>
              <button className="send-btn" disabled={!input.trim() && !streaming} onClick={() => streaming ? abortRef.current?.abort() : send()}>{streaming ? '■' : '↑'}</button>
            </div>
          </div>
          {voiceError && <div className="voice-error">{voiceError}</div>}
        </div>
        <div className="composer-hint">Enter to send · Shift + Enter for a new line · voice follows browser language preferences with multilingual fallback</div>
      </section>

      {hasChat && <div className="splitter" onPointerDown={() => { dragRef.current = true }}/>} 
      <section className="studio-pane glass">
        <div className="studio-head"><div className="studio-tabs"><button className={view === 'preview' ? 'active' : ''} onClick={() => setView('preview')}>Preview</button><button className={view === 'code' ? 'active' : ''} onClick={() => setView('code')}>Code</button></div><div className="device-tabs"><button className={device === 'desktop' ? 'active' : ''} onClick={() => setDevice('desktop')} aria-label="Desktop">▱</button><button className={device === 'tablet' ? 'active' : ''} onClick={() => setDevice('tablet')} aria-label="Tablet">▯</button><button className={device === 'mobile' ? 'active' : ''} onClick={() => setDevice('mobile')} aria-label="Mobile">▯</button></div></div>
        {view === 'preview' ? <div className="preview-stage"><div className={`preview-frame ${device}`}><iframe title="ZYRAXON live preview" sandbox="allow-scripts allow-forms" srcDoc={preview} /></div></div> : <div className="code-workspace"><aside className="file-tree"><div className="tree-title">FILES <span>{fileNames.length}</span></div>{fileNames.map(name => <button className={activeFile === name ? 'active' : ''} key={name} onClick={() => setActiveFile(name)}><span className="real-icon">{fileIcon(name)}</span><span>{name}</span></button>)}</aside><div className="editor"><div className="editor-head"><span>{activeFile}</span><small>{files[activeFile]?.split('\n').length || 0} lines</small></div><Editor height="100%" theme={theme === 'dark' ? 'vs-dark' : 'light'} language={activeFile.endsWith('.css') ? 'css' : activeFile.endsWith('.json') ? 'json' : /\.(js|jsx|ts|tsx)$/.test(activeFile) ? 'typescript' : 'html'} value={files[activeFile] || ''} onChange={v => setFiles(p => ({ ...p, [activeFile]: v || '' }))} options={{ minimap: { enabled: false }, fontSize: 13, padding: { top: 16 }, wordWrap: 'on', automaticLayout: true, smoothScrolling: true, scrollBeyondLastLine: false }} /></div></div>}
      </section>
    </main>

    {publishOpen && <div className="modal-backdrop" onMouseDown={e => { if (e.target === e.currentTarget) setPublishOpen(false) }}><div className="publish-modal glass"><div className="modal-head"><b>Publish to GitHub</b><button onClick={() => setPublishOpen(false)}>×</button></div>{githubUser ? <div className="connected-note">Connected as <b>@{githubUser.login}</b>. GitHub token is handled securely by the server.</div> : <div className="connected-note">Not connected. <button className="inline-link" onClick={startGitHubLogin}>Sign in with GitHub</button></div>}<input placeholder="Repository name" value={repo} onChange={e => setRepo(e.target.value)} disabled={!githubUser} /><button className="publish-now" onClick={publish} disabled={!githubUser}>Publish</button>{publishState && <small>{publishState}</small>}</div></div>}
  </div>
}

function AssistantContent({ content }: { content: string }) {
  const blocks: ReactNode[] = []
  const re = /```([\w.+-]*)\s*\n?([\s\S]*?)(?:```|$)/g
  let last = 0, i = 0, match: RegExpExecArray | null
  while ((match = re.exec(content))) {
    const text = content.slice(last, match.index).trim(); if (text) blocks.push(<p key={`t${i}`}>{text}</p>)
    let body = match[2].trim()
    const marker = body.match(/^(?:<!--|\/\*|\/\/|#)\s*file:\s*([^\n]+?)(?:\s*-->|\s*\*\/)?\s*\n/i)
    const name = marker?.[1]?.trim() || 'generated file'
    if (marker) body = body.slice(marker[0].length).trim()
    blocks.push(<div className="inline-file" key={`c${i}`}><div><span>⌘</span><b>{name}</b><small>{body.split('\n').length} lines · open Code to inspect</small></div></div>)
    last = re.lastIndex; i++
  }
  const tail = content.slice(last).trim(); if (tail) blocks.push(<p key="tail">{tail}</p>)
  return <>{blocks.length ? blocks : <p>{content}</p>}</>
}

const CSS = `
:root{color-scheme:dark}*{box-sizing:border-box}.zyraxon-builder{height:100vh;min-height:680px;overflow:hidden;font-family:Inter,ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;background:#050505;color:#f7f7f7;--line:rgba(255,255,255,.14);--line2:rgba(255,255,255,.2);--text:#f7f7f7;--muted:#a3a3a3;--soft:#737373;--shadow:0 24px 80px rgba(0,0,0,.52)}.zyraxon-builder.light{color-scheme:light;background:#e9e9e7;color:#151515;--line:rgba(0,0,0,.12);--line2:rgba(0,0,0,.2);--text:#151515;--muted:#5f5f5f;--soft:#858585}button,input,textarea{font:inherit}.glass{background:linear-gradient(145deg,rgba(255,255,255,.105),rgba(255,255,255,.045) 46%,rgba(0,0,0,.52));border:1.5px solid var(--line2);box-shadow:inset 0 1px rgba(255,255,255,.13),0 22px 70px rgba(0,0,0,.46);backdrop-filter:blur(38px) saturate(160%);-webkit-backdrop-filter:blur(38px) saturate(160%)}.light .glass{background:linear-gradient(145deg,rgba(255,255,255,.9),rgba(255,255,255,.62));box-shadow:inset 0 1px rgba(255,255,255,.9),0 20px 70px rgba(0,0,0,.08)}.zb-topbar{height:68px;margin:12px 14px 0;border-radius:20px;display:flex;align-items:center;padding:0 18px;position:relative;z-index:20}.zb-brand{display:flex;align-items:center;gap:9px;color:inherit;text-decoration:none}.zb-mark{width:31px;height:31px;border:1.5px solid var(--line2);border-radius:10px;display:grid;place-items:center;font-weight:800;background:rgba(255,255,255,.07)}.brand-name{font-weight:800;letter-spacing:.06em}.brand-sub{font-size:10px;color:var(--muted);letter-spacing:.18em}.top-title{position:absolute;left:50%;transform:translateX(-50%);font-size:12px;color:var(--muted);letter-spacing:.08em}.top-actions{margin-left:auto;display:flex;gap:7px;align-items:center}.glass-btn,.mode-btn,.model-btn{border:1.5px solid var(--line2);background:rgba(255,255,255,.055);color:var(--text);border-radius:11px;padding:9px 12px;cursor:pointer;box-shadow:inset 0 1px rgba(255,255,255,.09),0 8px 26px rgba(0,0,0,.2)}button:hover{border-color:var(--line2);transform:translateY(-1px)}.account-stack{position:relative;display:flex;flex-direction:column;align-items:center;gap:3px}.account-btn{width:34px;height:34px;padding:0;display:grid;place-items:center;border:1.5px solid var(--line2);border-radius:10px;background:rgba(255,255,255,.07);color:var(--text);cursor:pointer}.account-btn img{width:25px;height:25px;border-radius:7px;object-fit:cover}.github-mark{font-size:18px}.reset-btn{width:24px;height:21px;padding:0;border:1px solid var(--line);border-radius:7px;background:rgba(255,255,255,.035);color:var(--muted);cursor:pointer}.account-pop{position:absolute;right:0;top:62px;width:220px;padding:13px;border-radius:14px;display:grid;gap:4px;z-index:90}.account-pop small{color:var(--muted);font-size:11px}.account-pop button{margin-top:8px;border:1px solid rgba(255,90,90,.18);background:rgba(255,70,70,.07);color:#ffb4b4;border-radius:9px;padding:8px;cursor:pointer}.zb-workspace{height:calc(100vh - 92px);display:flex;gap:10px;padding:10px 14px 14px}.chat-pane{min-width:0;display:flex;flex-direction:column;flex:1}.has-chat .chat-pane{width:var(--chat-split,44%)}.chat-scroll{min-height:0;flex:1;overflow-y:auto;padding:20px 10px 28px;scroll-behavior:smooth}.messages{max-width:850px;margin:0 auto;display:flex;flex-direction:column;gap:14px}.message{border:1.5px solid var(--line);border-radius:20px;padding:14px 16px;background:linear-gradient(135deg,rgba(255,255,255,.065),rgba(255,255,255,.018));box-shadow:inset 0 1px rgba(255,255,255,.055),0 16px 50px rgba(0,0,0,.2)}.message.user{margin-left:12%;background:linear-gradient(135deg,rgba(255,255,255,.105),rgba(255,255,255,.035))}.message-label{font-size:10px;letter-spacing:.16em;color:var(--soft);margin-bottom:9px}.message-content{color:var(--text);line-height:1.7;font-size:14px;overflow-wrap:anywhere}.message-content p{margin:0 0 10px}.thinking{display:flex;align-items:center;gap:10px;color:var(--muted)}.thinking i,.live-dot,.state.running{width:7px;height:7px;border-radius:50%;display:inline-block;background:#fff;box-shadow:0 0 15px rgba(255,255,255,.8);animation:pulse 1.2s infinite}.source-row{display:flex;flex-wrap:wrap;gap:6px;margin-top:10px}.source-row a{max-width:220px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;border:1px solid var(--line);border-radius:9px;padding:6px 9px;color:var(--muted);font-size:11px;text-decoration:none;background:rgba(255,255,255,.025)}.inline-file{margin:10px 0;border:1px solid var(--line);border-radius:13px;padding:11px 13px;background:rgba(255,255,255,.035)}.inline-file div{display:grid;grid-template-columns:25px 1fr;align-items:center}.inline-file span{grid-row:span 2}.inline-file b{font-size:12px}.inline-file small{grid-column:2;color:var(--soft);font-size:10px}.welcome{height:100%;min-height:440px;display:grid;place-items:center;align-content:center;text-align:center;max-width:760px;margin:auto;padding:40px}.hero-z{width:82px;height:82px;border-radius:26px;display:grid;place-items:center;font-size:34px;font-weight:900;margin:0 auto 24px;border:1.5px solid var(--line2);background:linear-gradient(145deg,rgba(255,255,255,.13),rgba(255,255,255,.025));box-shadow:inset 0 1px rgba(255,255,255,.16),0 25px 80px rgba(0,0,0,.45)}.welcome h1{font-size:clamp(30px,4vw,52px);letter-spacing:-.045em;margin:0 0 12px}.welcome p{max-width:600px;color:var(--muted);line-height:1.7;margin:0 auto 24px}.suggestions{display:flex;gap:8px;flex-wrap:wrap;justify-content:center}.suggestions button{border:1.5px solid var(--line);background:rgba(255,255,255,.04);color:var(--muted);border-radius:12px;padding:9px 13px;cursor:pointer}.composer{margin:0 auto 6px;width:min(900px,96%);border-radius:20px;padding:11px 12px 9px}.composer textarea{width:100%;resize:none;min-height:42px;max-height:150px;border:0;outline:0;background:transparent;color:var(--text);font-size:14px;padding:5px 4px}.composer textarea::placeholder{color:var(--soft)}.composer-row{display:flex;align-items:center;justify-content:space-between;gap:8px}.composer-left{display:flex;align-items:center;gap:6px;min-width:0;flex-wrap:wrap}.mode-wrap,.model-wrap{position:relative}.mode-btn,.model-btn{font-size:11px;padding:7px 9px}.bolt{width:7px;height:7px;display:inline-block;border-radius:50%;background:#fff;box-shadow:0 0 13px rgba(255,255,255,.9);margin-right:7px}.plan{width:7px;height:7px;display:inline-block;border-radius:2px;border:1px solid currentColor;margin-right:7px}.auto-access{font-size:10px;color:var(--soft);white-space:nowrap}.send-group{display:flex;align-items:center;gap:7px;flex:0 0 auto}.voice-btn,.send-btn{width:37px;height:37px;border:1.5px solid var(--line2);border-radius:12px;cursor:pointer;display:grid;place-items:center}.voice-btn{background:rgba(255,255,255,.055);color:var(--text);font-weight:800}.voice-btn.listening{background:rgba(255,255,255,.15);box-shadow:0 0 0 3px rgba(255,255,255,.05),0 0 28px rgba(255,255,255,.14)}.send-btn{background:#fff;color:#050505;font-weight:900}.send-btn:disabled{opacity:.35;cursor:default}.voice-error{font-size:10px;color:#ffb4b4;padding:4px 3px}.composer-hint{text-align:center;color:var(--soft);font-size:9px;padding:4px}.popover{position:absolute;z-index:100;min-width:230px;padding:7px;border:1.5px solid var(--line2);border-radius:15px;background:rgba(12,12,12,.94);backdrop-filter:blur(30px);box-shadow:var(--shadow)}.light .popover{background:rgba(255,255,255,.96)}.mode-pop,.model-pop{left:0;bottom:48px}.activity-pop{right:80px;top:60px;min-width:280px}.popover>button{width:100%;display:flex;gap:10px;align-items:center;text-align:left;border:0;background:transparent;color:var(--text);padding:10px;border-radius:10px;cursor:pointer}.popover>button.selected,.popover>button:hover{background:rgba(255,255,255,.07)}.popover small{display:block;color:var(--soft);font-size:10px;margin-top:3px}.activity-row{display:flex;gap:9px;padding:9px 3px;border-top:1px solid var(--line);margin-top:7px}.activity-row strong{font-size:11px;display:block}.activity-row small{font-size:9px}.state{width:7px;height:7px;border-radius:50%;margin-top:4px;background:#666;flex:none}.state.done{background:#fff}.state.error{background:#888}.splitter{width:3px;border-radius:4px;background:var(--line);cursor:col-resize}.studio-pane{flex:1;min-width:0;border-radius:22px;overflow:hidden;display:flex;flex-direction:column}.studio-head{height:56px;display:flex;align-items:center;justify-content:space-between;padding:0 12px;border-bottom:1px solid var(--line);background:rgba(0,0,0,.1)}.studio-tabs,.device-tabs{display:flex;gap:5px}.studio-tabs button,.device-tabs button{border:1.5px solid transparent;background:transparent;color:var(--muted);padding:8px 12px;border-radius:10px;cursor:pointer}.studio-tabs button.active,.device-tabs button.active{color:var(--text);background:rgba(255,255,255,.07);border-color:var(--line)}.device-tabs button{width:36px;font-size:17px}.preview-stage{flex:1;min-height:0;padding:18px;display:grid;place-items:center;background:radial-gradient(circle at 50% 25%,rgba(255,255,255,.035),transparent 48%)}.preview-frame{width:100%;height:100%;max-width:1400px;border:1.5px solid var(--line2);border-radius:18px;overflow:hidden;background:#fff;box-shadow:0 25px 80px rgba(0,0,0,.45)}.preview-frame.desktop{width:100%}.preview-frame.tablet{width:min(820px,90%)}.preview-frame.mobile{width:min(430px,70%)}.preview-frame iframe{display:block;width:100%;height:100%;border:0;background:#fff}.code-workspace{flex:1;min-height:0;display:flex}.file-tree{width:225px;min-width:190px;border-right:1px solid var(--line);padding:12px;overflow:auto;background:rgba(0,0,0,.08)}.tree-title{font-size:9px;letter-spacing:.18em;color:var(--soft);padding:5px 8px 10px}.tree-title span{float:right;color:var(--muted)}.file-tree button{width:100%;display:flex;align-items:center;gap:9px;border:1px solid transparent;background:transparent;color:var(--muted);padding:9px 8px;border-radius:10px;text-align:left;cursor:pointer}.file-tree button:hover,.file-tree button.active{background:rgba(255,255,255,.06);border-color:var(--line);color:var(--text)}.real-icon{width:22px;height:22px;display:grid;place-items:center}.real-icon svg{width:20px;height:20px}.editor{flex:1;min-width:0;display:flex;flex-direction:column}.editor-head{height:39px;display:flex;align-items:center;justify-content:space-between;padding:0 14px;border-bottom:1px solid var(--line);font-size:11px;color:var(--muted)}.editor-head small{color:var(--soft)}.modal-backdrop{position:fixed;inset:0;z-index:200;display:grid;place-items:center;background:rgba(0,0,0,.55);backdrop-filter:blur(10px)}.publish-modal{width:min(420px,90vw);padding:18px;border-radius:20px;display:grid;gap:10px}.modal-head{display:flex;justify-content:space-between;align-items:center}.modal-head button{border:0;background:transparent;color:var(--text);font-size:20px;cursor:pointer}.publish-modal input{border:1.5px solid var(--line);background:rgba(255,255,255,.04);color:var(--text);border-radius:11px;padding:11px;outline:0}.publish-modal input:disabled{opacity:.45}.connected-note{font-size:11px;color:var(--muted);padding:9px 10px;border:1px solid var(--line);border-radius:10px;background:rgba(255,255,255,.035)}.inline-link{border:0;background:transparent;color:var(--text);text-decoration:underline;cursor:pointer}.publish-now{border:1.5px solid var(--line2);background:#fff;color:#050505;border-radius:11px;padding:11px;font-weight:800;cursor:pointer}.publish-now:disabled{opacity:.45;cursor:default}.publish-modal small{color:var(--muted);overflow-wrap:anywhere}.error-card{border:1px solid var(--line2);border-radius:13px;padding:12px;background:rgba(255,255,255,.04);display:grid;gap:4px}.error-card span{color:var(--muted);font-size:12px}@keyframes pulse{50%{opacity:.35;transform:scale(.7)}}@media(max-width:900px){.top-title{display:none}.zb-workspace{flex-direction:column;height:calc(100vh - 92px)}.chat-pane{height:48%}.has-chat .chat-pane{width:100%}.splitter{height:3px;width:100%;cursor:row-resize}.studio-pane{height:52%}.file-tree{width:180px}.auto-access{display:none}}@media(max-width:650px){.brand-sub,.top-actions .glass-btn:nth-child(2){display:none}.zb-topbar{margin:8px 8px 0}.zb-workspace{padding:8px}.preview-frame.tablet{width:94%}.preview-frame.mobile{width:72%}.file-tree{width:150px;min-width:150px}.message.user{margin-left:4%}.account-pop{right:-30px}}
`
