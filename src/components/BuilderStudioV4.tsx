import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import Editor from '@monaco-editor/react'
import { Link } from '@tanstack/react-router'

type Device = 'desktop' | 'tablet' | 'mobile'
type View = 'preview' | 'code'
type Mode = 'bolt' | 'plan'
type Message = { role: 'user' | 'assistant'; content: string }
type ProjectFile = { path: string; language: string; content: string }

const MODELS = [
  { id: 'mimo-v2.5-free', name: 'MiMo V2.5 Free' },
  { id: 'nemotron-3-super-free', name: 'Nemotron 3 Super Free' },
  { id: 'big-pickle', name: 'Big Pickle' },
]
const starterFiles: ProjectFile[] = [{ path: 'index.html', language: 'html', content: '<!doctype html>\n<html>\n<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>\n<body><main><h1>Start with an idea.</h1><p>Describe what you want ZYRAXON AI to build.</p></main></body>\n</html>' }]

function Icon({ name, size = 16 }: { name: string; size?: number }) {
  const p: Record<string, ReactNode> = {
    spark: <><path d="m12 2 1.7 6.3L20 10l-6.3 1.7L12 18l-1.7-6.3L4 10l6.3-1.7Z"/><path d="m19 16 .7 2.3L22 19l-2.3.7L19 22l-.7-2.3L16 19l2.3-.7Z"/></>,
    code: <><path d="m8 8-4 4 4 4M16 8l4 4-4 4M14 5l-4 14"/></>,
    eye: <><path d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6S2 12 2 12Z"/><circle cx="12" cy="12" r="2.5"/></>,
    desktop: <><rect x="3" y="4" width="18" height="13" rx="2"/><path d="M8 21h8M12 17v4"/></>,
    tablet: <><rect x="6" y="2.5" width="12" height="19" rx="2"/><circle cx="12" cy="18.5" r=".5" fill="currentColor" stroke="none"/></>,
    mobile: <><rect x="8" y="2" width="8" height="20" rx="2"/><circle cx="12" cy="18.5" r=".5" fill="currentColor" stroke="none"/></>,
    mic: <><rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5 11a7 7 0 0 0 14 0M12 18v3M8 21h8"/></>,
    send: <><path d="m4 4 17 8-17 8 3-8zM7 12h14"/></>,
    folder: <><path d="M3 6a2 2 0 0 1 2-2h5l2 2h7a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/></>,
    file: <><path d="M6 2h8l4 4v16H6zM14 2v5h5"/></>,
    terminal: <><path d="m4 6 6 6-6 6M13 18h7"/></>,
    save: <><path d="M5 3h12l3 3v15H4V3zM8 3v6h8V3M8 21v-7h8v7"/></>,
    arrow: <><path d="M5 12h14M13 6l6 6-6 6"/></>,
  }
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{p[name] ?? p.spark}</svg>
}

function languageFor(path: string) {
  const ext = path.split('.').pop()?.toLowerCase()
  if (ext === 'css') return 'css'
  if (ext === 'js' || ext === 'jsx') return 'javascript'
  if (ext === 'ts' || ext === 'tsx') return 'typescript'
  if (ext === 'json') return 'json'
  if (ext === 'md') return 'markdown'
  return 'html'
}

function extractFiles(text: string): ProjectFile[] {
  const found: ProjectFile[] = []
  const labelled = /(?:^|\n)(?:#{1,4}\s*|\*\*|`)?([\w./-]+\.(?:html?|css|js|jsx|ts|tsx|json|md))(?:`|\*\*)?\s*\n?```(?:\w+)?\s*\n([\s\S]*?)```/gi
  let m: RegExpExecArray | null
  while ((m = labelled.exec(text))) found.push({ path: m[1], language: languageFor(m[1]), content: m[2].trim() })
  if (!found.length) {
    const blocks = [...text.matchAll(/```(?:html|css|javascript|js|typescript|ts|jsx|tsx)?\s*\n([\s\S]*?)```/gi)]
    if (blocks.length) found.push({ path: 'index.html', language: 'html', content: blocks[0][1].trim() })
  }
  return found
}

function stripCode(text: string) {
  return text.replace(/(?:^|\n)(?:#{1,4}\s*|\*\*)?[\w./-]+\.(?:html?|css|js|jsx|ts|tsx|json|md)(?:`|\*\*)?\s*\n?```[\s\S]*?```/gi, '').trim()
}

export default function BuilderStudioV4() {
  const [model, setModel] = useState(MODELS[0].id)
  const [mode, setMode] = useState<Mode>('bolt')
  const [device, setDevice] = useState<Device>('desktop')
  const [view, setView] = useState<View>('preview')
  const [input, setInput] = useState('')
  const [files, setFiles] = useState<ProjectFile[]>(starterFiles)
  const [activeFile, setActiveFile] = useState('index.html')
  const [messages, setMessages] = useState<Message[]>([])
  const [liveText, setLiveText] = useState('')
  const [logs, setLogs] = useState<string[]>([])
  const [busy, setBusy] = useState(false)
  const [connected, setConnected] = useState(false)
  const [listening, setListening] = useState(false)
  const recognition = useRef<any>(null)
  const current = MODELS.find((item) => item.id === model) ?? MODELS[0]
  const active = files.find((file) => file.path === activeFile) ?? files[0]
  const previewSource = useMemo(() => {
    const html = files.find((file) => file.path.endsWith('.html'))?.content ?? ''
    const css = files.find((file) => file.path.endsWith('.css'))?.content
    return css && html ? (html.includes('</head>') ? html.replace('</head>', `<style>${css}</style></head>`) : `<style>${css}</style>${html}`) : html
  }, [files])
  const previewUrl = useMemo(() => `data:text/html;charset=utf-8,${encodeURIComponent(previewSource)}`, [previewSource])

  useEffect(() => {
    const controller = new AbortController()
    fetch('/api/public/builder/chat', { signal: controller.signal }).then((r) => { if (!r.ok) throw new Error(); setConnected(true) }).catch(() => setConnected(false))
    return () => controller.abort()
  }, [])

  useEffect(() => {
    const Speech = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
    if (!Speech) return
    const instance = new Speech()
    instance.continuous = false
    instance.interimResults = true
    instance.lang = 'en-US'
    instance.onresult = (event: any) => setInput(Array.from(event.results).map((result: any) => result[0].transcript).join(''))
    instance.onend = () => setListening(false)
    instance.onerror = () => setListening(false)
    recognition.current = instance
    return () => { try { instance.stop() } catch {} }
  }, [])

  const toggleMic = () => { const instance = recognition.current; if (!instance) return; if (listening) instance.stop(); else { setListening(true); instance.start() } }
  const updateActiveFile = (value: string) => setFiles((items) => items.map((file) => file.path === activeFile ? { ...file, content: value } : file))

  async function generate() {
    const text = input.trim()
    if (!text || busy) return
    const next = [...messages, { role: 'user' as const, content: text }]
    setMessages(next); setInput(''); setBusy(true); setLiveText('')
    setLogs((items) => [`${current.name} · ${mode === 'bolt' ? 'Building' : 'Planning'}`, ...items].slice(0, 30))
    let assistant = ''
    try {
      const response = await fetch('/api/public/builder/chat', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ model, messages: next }) })
      if (!response.ok || !response.body) throw new Error()
      setConnected(true)
      const reader = response.body.getReader(); const decoder = new TextDecoder(); let buffer = ''
      while (true) {
        const result = await reader.read(); if (result.done) break
        buffer += decoder.decode(result.value, { stream: true }); const lines = buffer.split('\n'); buffer = lines.pop() ?? ''
        for (const line of lines) {
          if (!line.startsWith('data:')) continue
          const raw = line.slice(5).trim(); if (!raw || raw === '[DONE]') continue
          try { const parsed = JSON.parse(raw); const delta = parsed?.choices?.[0]?.delta?.content ?? parsed?.choices?.[0]?.message?.content ?? parsed?.content ?? ''; if (delta) { assistant += delta; setLiveText(assistant) } } catch {}
        }
      }
      const generated = extractFiles(assistant)
      if (generated.length) {
        setFiles((old) => { const map = new Map(old.map((file) => [file.path, file])); generated.forEach((file) => map.set(file.path, file)); return [...map.values()] })
        setActiveFile(generated[0].path); setView('code')
      }
      setMessages((items) => [...items, { role: 'assistant', content: stripCode(assistant) || 'Build complete. Generated files are now available in Code.' }])
      setLiveText(''); setLogs((items) => ['Generation complete', ...items].slice(0, 30))
    } catch {
      setConnected(false); setMessages((items) => [...items, { role: 'assistant', content: 'The AI connection could not be completed. Please try again.' }]); setLogs((items) => ['Connection failed · retry available', ...items].slice(0, 30))
    } finally { setBusy(false) }
  }

  return <div className="builder-v4">
    <header className="topbar"><Link to="/" className="brand"><span className="brand-mark">Z</span><span className="brand-name">ZYRAXON</span><span className="brand-tag">AI BLUDAR</span></Link><nav><Link to="/">Home</Link><Link to="/builder" className="active">AI Bludar</Link><Link to="/ecosystem">Ecosystem</Link></nav><div className="status"><i className={connected ? 'online' : ''}/>{connected ? 'AI connected' : 'Connecting'}</div></header>
    <main className="studio">
      <section className="conversation"><div className="conversation-head"><div><span className="eyebrow">AI PRODUCT STUDIO</span><h1>What are we building?</h1></div><div className="model-select"><Icon name="spark"/><select value={model} onChange={(e) => setModel(e.target.value)}>{MODELS.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></div></div>
        <div className="conversation-body">{!messages.length && !busy ? <div className="welcome"><div className="ai-core"><Icon name="spark" size={30}/></div><h2>Describe your idea.</h2><p>Tell ZYRAXON what to build. AI streams here, then generated files appear automatically in Code.</p><div className="suggestions"><button onClick={() => setInput('Build a premium black glassmorphism AI SaaS landing page')}><Icon name="spark"/>AI SaaS</button><button onClick={() => setInput('Build a developer portfolio with projects and contact section')}><Icon name="code"/>Portfolio</button><button onClick={() => setInput('Build a modern product website with pricing')}><Icon name="eye"/>Product</button></div></div> : <>{messages.map((message, i) => <article className={`chat-message ${message.role}`} key={`${message.role}-${i}`}><span className="role">{message.role === 'user' ? 'YOU' : 'ZYRAXON AI'}</span><div className="message-card">{message.content}</div></article>)}{busy && <article className="stream-card"><span className="pulse"/><div><b>AI is building your project</b><p>Streaming live from {current.name}…</p><pre>{liveText.slice(-1800)}</pre></div></article>}</>}</div>
        <div className="composer"><textarea value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); void generate() } }} placeholder={mode === 'bolt' ? 'Describe what you want to build…' : 'Describe the plan you want…'} rows={3}/><div className="composer-bottom"><div className="mode-switch"><button className={mode === 'bolt' ? 'active' : ''} onClick={() => setMode('bolt')}><Icon name="spark"/>Bolt</button><button className={mode === 'plan' ? 'active' : ''} onClick={() => setMode('plan')}><Icon name="code"/>Plan</button></div><div className="composer-actions"><button className={listening ? 'round listening' : 'round'} onClick={toggleMic} title="Voice input"><Icon name="mic"/></button><button className="send" disabled={!input.trim() || busy} onClick={() => void generate()}><Icon name="arrow"/></button></div></div></div></section>
      <section className="workspace"><div className="workspace-top"><div className="view-switch"><button className={view === 'preview' ? 'active' : ''} onClick={() => setView('preview')}><Icon name="eye"/>Preview</button><button className={view === 'code' ? 'active' : ''} onClick={() => setView('code')}><Icon name="code"/>Code <span>{files.length}</span></button></div><div className="devices"><button className={device === 'desktop' ? 'active' : ''} onClick={() => setDevice('desktop')}><Icon name="desktop"/></button><button className={device === 'tablet' ? 'active' : ''} onClick={() => setDevice('tablet')}><Icon name="tablet"/></button><button className={device === 'mobile' ? 'active' : ''} onClick={() => setDevice('mobile')}><Icon name="mobile"/></button></div></div>
        {view === 'preview' ? <div className="preview-stage"><div className={`browser-frame ${device}`}><div className="browser-bar"><span/><span/><span/><small>Live preview</small></div><iframe title="Live generated website" sandbox="allow-scripts allow-forms" src={previewUrl}/></div></div> : <div className="code-stage"><aside className="file-tree"><div className="tree-head"><span><Icon name="folder"/>PROJECT FILES</span><em>{files.length}</em></div>{files.map((file) => <button key={file.path} className={file.path === activeFile ? 'selected' : ''} onClick={() => setActiveFile(file.path)}><Icon name="file"/>{file.path}</button>)}<div className="stream-status"><span className={connected ? 'live-dot' : ''}/><div><b>AI STREAM</b><small>{connected ? 'LIVE' : 'READY'}</small></div></div></aside><div className="monaco"><div className="editor-head"><span>{activeFile}</span><button onClick={() => setLogs((items) => ['Saved locally · ' + activeFile, ...items].slice(0, 30))}><Icon name="save"/>Save</button></div><Editor height="100%" language={active?.language ?? 'html'} theme="vs-dark" value={active?.content ?? ''} onChange={(value) => updateActiveFile(value ?? '')} options={{ automaticLayout: true, minimap: { enabled: false }, fontSize: 13, lineHeight: 21, padding: { top: 14 }, wordWrap: 'on', smoothScrolling: true, scrollBeyondLastLine: false }}/></div><aside className="ai-live"><div className="live-head"><span><Icon name="spark"/>AI LIVE</span><i>{busy ? 'STREAMING' : 'READY'}</i></div>{busy && <pre className="live-stream">{liveText.slice(-6000)}</pre>}{!busy && logs.map((log, i) => <p key={i}><span>›</span>{log}</p>)}<div className="live-foot"><Icon name="terminal"/>Generated files appear here automatically</div></aside></div>}
      </section>
    </main>
    <style>{`.builder-v4{height:100vh;overflow:hidden;background:#070708;color:#f4f4f5;font-family:Inter,ui-sans-serif,system-ui}.builder-v4 *{box-sizing:border-box}.builder-v4 button,.builder-v4 select,.builder-v4 textarea{font:inherit}.topbar{height:62px;display:flex;align-items:center;gap:28px;padding:0 18px;border-bottom:1px solid #202024;background:#080809}.brand{display:flex;align-items:center;gap:9px;color:#fff;text-decoration:none}.brand-mark{width:30px;height:30px;border:1px solid #38383d;border-radius:9px;display:grid;place-items:center;background:#111113;font-weight:900}.brand-name{font-size:13px;font-weight:800;letter-spacing:.08em}.brand-tag{font-size:8px;letter-spacing:.14em;color:#aaaab2;border:1px solid #303035;padding:4px 7px;border-radius:999px}.topbar nav{display:flex;gap:3px}.topbar nav a{color:#85858d;text-decoration:none;font-size:12px;padding:8px 11px;border-radius:8px}.topbar nav a:hover,.topbar nav a.active{background:#151517;color:#fff}.status{margin-left:auto;color:#85858d;font-size:10px;display:flex;align-items:center;gap:7px}.status i,.live-dot{width:6px;height:6px;border-radius:50%;background:#68686f;display:inline-block}.status i.online,.live-dot{background:#65e29a;box-shadow:0 0 10px #65e29a}.studio{height:calc(100vh - 62px);display:grid;grid-template-columns:minmax(390px,34%) 1fr}.conversation{min-width:0;display:flex;flex-direction:column;border-right:1px solid #202024;background:linear-gradient(180deg,#0b0b0d,#080809)}.conversation-head{height:82px;padding:18px 20px;border-bottom:1px solid #202024;display:flex;align-items:center;justify-content:space-between;gap:15px}.eyebrow{font-size:8px;letter-spacing:.18em;color:#777780}.conversation-head h1{font-size:17px;margin:5px 0 0}.model-select{display:flex;align-items:center;gap:7px;border:1px solid #29292e;background:#111114;border-radius:9px;padding:7px 9px;color:#d7d7dc}.model-select select{background:transparent;border:0;color:#d7d7dc;outline:0;font-size:10px;max-width:135px}.model-select option{background:#111114}.conversation-body{flex:1;overflow:auto;padding:22px}.welcome{max-width:430px;margin:8vh auto;text-align:center}.ai-core{width:64px;height:64px;margin:auto;display:grid;place-items:center;border:1px solid #343438;border-radius:19px;background:radial-gradient(circle at 50% 35%,#29292d,#111114 70%);animation:float 4s ease-in-out infinite}.welcome h2{font-size:28px;letter-spacing:-.04em;margin:17px 0 7px}.welcome p{font-size:12px;line-height:1.65;color:#83838c;margin:0 auto 18px}.suggestions{display:flex;justify-content:center;gap:7px;flex-wrap:wrap}.suggestions button,.mode-switch button{display:flex;align-items:center;gap:7px;border:1px solid #29292e;background:#111114;color:#a8a8b0;border-radius:9px;padding:8px 10px;font-size:10px;cursor:pointer}.suggestions button:hover,.mode-switch button:hover{border-color:#4a4a51;color:#fff}.chat-message{margin-bottom:17px}.role{display:block;font-size:8px;letter-spacing:.15em;color:#696970;margin:0 0 7px}.message-card{border:1px solid #242428;background:#0e0e10;border-radius:12px;padding:12px 14px;color:#cfcfd4;font-size:12px;line-height:1.65;white-space:pre-wrap}.chat-message.user .message-card{background:#151518;color:#f4f4f5}.stream-card{display:flex;gap:10px;padding:13px;border:1px solid #29292e;background:#101012;border-radius:12px;color:#bcbcc4;font-size:11px}.stream-card p{color:#707078;margin:4px 0}.stream-card pre{max-height:180px;overflow:auto;white-space:pre-wrap;color:#9b9ba4;font-size:10px;line-height:1.5;margin:8px 0 0}.pulse{width:7px;height:7px;flex:none;margin-top:4px;border-radius:50%;background:#fff;box-shadow:0 0 14px #fff;animation:pulse 1.2s infinite}.composer{margin:0 18px 18px;border:1px solid #29292e;background:#0e0e10;border-radius:14px}.composer textarea{width:100%;resize:none;border:0;outline:0;background:transparent;color:#eee;padding:14px;font-size:12px;line-height:1.5}.composer textarea::placeholder{color:#5e5e66}.composer-bottom{display:flex;justify-content:space-between;align-items:center;padding:8px;border-top:1px solid #202024}.mode-switch{display:flex;gap:4px}.mode-switch button.active{background:#242428;color:#fff;border-color:#3a3a40}.composer-actions{display:flex;gap:5px}.round,.send{width:32px;height:32px;border:1px solid #29292e;border-radius:9px;background:#151517;color:#aaaab1;display:grid;place-items:center;cursor:pointer}.round.listening{color:#fff;box-shadow:0 0 0 3px #fff1}.send{background:#eee;color:#09090a;border-color:#eee}.send:disabled{opacity:.25}.workspace{min-width:0;background:#09090b;display:flex;flex-direction:column}.workspace-top{height:54px;border-bottom:1px solid #202024;display:flex;align-items:center;justify-content:space-between;padding:0 12px;background:#0b0b0d}.view-switch,.devices{display:flex;gap:3px}.view-switch button,.devices button{display:flex;align-items:center;gap:7px;border:1px solid transparent;background:transparent;color:#73737b;border-radius:8px;padding:8px 10px;font-size:10px;cursor:pointer}.view-switch button.active,.view-switch button:hover,.devices button.active,.devices button:hover{background:#18181b;border-color:#29292e;color:#fff}.view-switch span{font-size:8px;color:#6d6d75}.preview-stage{flex:1;min-height:0;display:grid;place-items:center;padding:24px;background:radial-gradient(circle at 50% 35%,#161619 0,#09090b 48%)}.browser-frame{height:100%;width:100%;max-width:1180px;border:1px solid #2b2b30;border-radius:12px;overflow:hidden;background:#fff;box-shadow:0 24px 80px #000b;transition:width .25s}.browser-frame.tablet{width:min(760px,100%)}.browser-frame.mobile{width:min(390px,100%)}.browser-bar{height:30px;background:#111114;display:flex;align-items:center;gap:5px;padding:0 10px}.browser-bar>span{width:6px;height:6px;border-radius:50%;background:#414147}.browser-bar small{margin-left:8px;color:#67676f;font-size:8px}.browser-frame iframe{width:100%;height:calc(100% - 30px);border:0;background:#fff}.code-stage{flex:1;min-height:0;display:grid;grid-template-columns:190px minmax(300px,1fr) 260px}.file-tree,.ai-live{background:#0c0c0e;border-right:1px solid #202024;min-width:0;overflow:auto}.ai-live{border-right:0;border-left:1px solid #202024}.tree-head,.live-head{height:43px;display:flex;align-items:center;justify-content:space-between;padding:0 12px;border-bottom:1px solid #202024;color:#777780;font-size:8px;letter-spacing:.12em}.tree-head span,.live-head span{display:flex;align-items:center;gap:6px}.tree-head em{font-style:normal;color:#55555d}.file-tree button{width:100%;display:flex;align-items:center;gap:8px;border:0;background:transparent;color:#7f7f87;text-align:left;padding:9px 12px;font-size:10px;cursor:pointer}.file-tree button:hover,.file-tree button.selected{background:#171719;color:#fff}.stream-status{margin:16px 10px;padding:10px;border:1px solid #222227;border-radius:9px;display:flex;gap:8px;align-items:center;color:#777780}.stream-status b,.stream-status small{display:block;font-size:8px}.stream-status small{margin-top:2px;color:#55555c}.monaco{min-width:0;min-height:0}.editor-head{height:34px;border-bottom:1px solid #202024;display:flex;align-items:center;justify-content:space-between;padding:0 10px;color:#888890;font-size:9px}.editor-head button{display:flex;align-items:center;gap:5px;border:0;background:transparent;color:#8d8d95;font-size:9px;cursor:pointer}.editor-head button:hover{color:#fff}.live-head i{font-style:normal;font-size:7px;color:#606068}.live-stream{margin:0;padding:12px;color:#9b9ba3;font-size:9px;line-height:1.55;white-space:pre-wrap;word-break:break-word}.ai-live p{margin:0;padding:8px 12px;color:#66666f;font-size:9px;border-bottom:1px solid #151518}.ai-live p span{color:#aaa;margin-right:5px}.live-foot{padding:10px;border-top:1px solid #202024;background:#0c0c0e;color:#55555d;font-size:8px;display:flex;align-items:center;gap:6px}@keyframes float{0%,100%{transform:translateY(0)}50%{transform:translateY(-5px)}}@keyframes pulse{50%{transform:scale(1.6);opacity:.45}}@media(max-width:900px){.studio{grid-template-columns:1fr}.workspace{display:none}.topbar nav{display:none}.brand-tag{display:none}}`}</style>
  </div>
}
