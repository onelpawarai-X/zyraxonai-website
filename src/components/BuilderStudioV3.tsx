import { useEffect, useMemo, useRef, useState } from 'react'
import Editor from '@monaco-editor/react'
import { Link } from '@tanstack/react-router'

type Device = 'desktop' | 'tablet' | 'mobile'
type View = 'preview' | 'code'
type Mode = 'bolt' | 'plan'
type Message = { role: 'user' | 'assistant'; content: string }

const MODELS = [
  { id: 'mimo-v2.5-free', name: 'MiMo V2.5 Free' },
  { id: 'nemotron-3-super-free', name: 'Nemotron 3 Super Free' },
  { id: 'big-pickle', name: 'Big Pickle' },
]

const starter = `<!doctype html><html><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>ZYRAXON</title></head><body><main><h1>Start with an idea.</h1><p>Describe the website you want ZYRAXON AI to build.</p></main></body></html>`

function Icon({ name, size = 17 }: { name: string; size?: number }) {
  const p = { width: size, height: size, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 1.8, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const }
  const paths: Record<string, React.ReactNode> = {
    spark: <><path d="m12 2 2 7 7 3-7 2-2 8-2-8-7-2 7-3z" /><path d="m19 16 .7 2.3L22 19l-2.3.7L19 22l-.7-2.3L16 19l2.3-.7z" /></>,
    code: <><path d="m8 8-4 4 4 4M16 8l4 4-4 4M14 5l-4 14" /></>,
    eye: <><path d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6S2 12 2 12Z" /><circle cx="12" cy="12" r="2.5" /></>,
    desktop: <><rect x="3" y="4" width="18" height="13" rx="2" /><path d="M8 21h8M12 17v4" /></>,
    tablet: <><rect x="6" y="2.5" width="12" height="19" rx="2" /><path d="M11 18.5h2" /></>,
    mobile: <><rect x="8" y="2" width="8" height="20" rx="2" /><path d="M11 18.5h2" /></>,
    mic: <><rect x="9" y="3" width="6" height="11" rx="3" /><path d="M5 11a7 7 0 0 0 14 0M12 18v3M8 21h8" /></>,
    send: <><path d="m4 4 17 8-17 8 3-8zM7 12h14" /></>,
    folder: <><path d="M3 6a2 2 0 0 1 2-2h5l2 2h7a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" /></>,
    file: <><path d="M6 2h8l4 4v16H6zM14 2v5h5" /></>,
    terminal: <><path d="m4 6 6 6-6 6M12 18h8" /></>,
    check: <path d="m5 12 4 4L19 6" />,
  }
  return <svg {...p}>{paths[name] ?? paths.spark}</svg>
}

export default function BuilderStudioV3() {
  const [model, setModel] = useState(MODELS[0].id)
  const [mode, setMode] = useState<Mode>('bolt')
  const [device, setDevice] = useState<Device>('desktop')
  const [view, setView] = useState<View>('preview')
  const [input, setInput] = useState('')
  const [code, setCode] = useState(starter)
  const [messages, setMessages] = useState<Message[]>([])
  const [logs, setLogs] = useState<string[]>([])
  const [busy, setBusy] = useState(false)
  const [connected, setConnected] = useState(false)
  const [listening, setListening] = useState(false)
  const recognition = useRef<any>(null)
  const current = MODELS.find((item) => item.id === model) ?? MODELS[0]
  const previewUrl = useMemo(() => `data:text/html;charset=utf-8,${encodeURIComponent(code)}`, [code])

  useEffect(() => {
    let cancelled = false
    fetch('/api/public/builder/chat')
      .then((response) => { if (!response.ok) throw new Error('health'); return response.json().catch(() => ({})) })
      .then(() => { if (!cancelled) setConnected(true) })
      .catch(() => { if (!cancelled) setConnected(false) })
    return () => { cancelled = true }
  }, [])

  useEffect(() => {
    const Speech = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
    if (!Speech) return
    const instance = new Speech()
    instance.continuous = false
    instance.interimResults = true
    instance.lang = 'en-US'
    instance.onresult = (event: any) => {
      const text = Array.from(event.results).map((result: any) => result[0].transcript).join('')
      setInput(text)
    }
    instance.onend = () => setListening(false)
    instance.onerror = () => setListening(false)
    recognition.current = instance
    return () => { try { instance.stop() } catch {} }
  }, [])

  function toggleMic() {
    const instance = recognition.current
    if (!instance) return
    if (listening) instance.stop()
    else { setListening(true); instance.start() }
  }

  async function generate() {
    const text = input.trim()
    if (!text || busy) return
    const nextMessages: Message[] = [...messages, { role: 'user', content: text }]
    setMessages(nextMessages)
    setInput('')
    setBusy(true)
    setLogs((items) => [`${current.name} · ${mode === 'bolt' ? 'Building' : 'Planning'}…`, ...items].slice(0, 40))
    let assistant = ''
    try {
      const response = await fetch('/api/public/builder/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ model, messages: nextMessages }),
      })
      if (!response.ok || !response.body) throw new Error('connection')
      setConnected(true)
      const reader = response.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ''
      while (true) {
        const result = await reader.read()
        if (result.done) break
        buffer += decoder.decode(result.value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop() ?? ''
        for (const line of lines) {
          if (!line.startsWith('data:')) continue
          const raw = line.slice(5).trim()
          if (!raw || raw === '[DONE]') continue
          try {
            const parsed = JSON.parse(raw)
            const delta = parsed?.choices?.[0]?.delta?.content ?? parsed?.choices?.[0]?.message?.content ?? parsed?.content ?? ''
            if (delta) {
              assistant += delta
              setMessages((items) => [...items.filter((item) => item.role !== 'assistant'), { role: 'assistant', content: assistant }])
            }
          } catch {}
        }
      }
      const match = assistant.match(/```(?:html)?\s*([\s\S]*?)```/i)
      if (match?.[1]) setCode(match[1].trim())
      setLogs((items) => ['AI response complete', ...items].slice(0, 40))
    } catch {
      setConnected(false)
      setMessages((items) => [...items, { role: 'assistant', content: 'The AI connection could not be completed. Please try again.' }])
      setLogs((items) => ['Connection retry available', ...items].slice(0, 40))
    } finally {
      setBusy(false)
    }
  }

  return <div className="builder-v5">
    <header className="builder-nav">
      <Link to="/" className="brand"><span className="mark">Z</span><strong>ZYRAXON</strong><span className="badge">AI BLUDAR</span></Link>
      <nav><Link to="/">Home</Link><Link to="/builder" className="active">AI Bludar</Link><Link to="/ecosystem">Ecosystem</Link></nav>
      <div className="connection"><span className={connected ? 'dot on' : 'dot'} />{connected ? 'AI connected' : 'Connecting…'}</div>
    </header>
    <main className="builder-shell">
      <section className="chat-panel">
        <div className="chat-head"><div><small>AI PRODUCT STUDIO</small><h1>Build with ZYRAXON</h1></div><span className="model-pill"><Icon name="spark" size={14} />{current.name}</span></div>
        <div className="chat-scroll">
          {messages.length === 0 ? <div className="welcome"><div className="orb"><Icon name="spark" size={30} /></div><h2>What are we building?</h2><p>Describe your website, app, or feature and ZYRAXON will build it while the workspace updates live.</p><div className="prompts"><button onClick={() => setInput('Build a premium AI SaaS landing page')}><Icon name="spark" />SaaS</button><button onClick={() => setInput('Build a developer portfolio')}><Icon name="code" />Portfolio</button><button onClick={() => setInput('Build a modern product website')}><Icon name="eye" />Product</button></div></div> : messages.map((message, index) => <div className={`message ${message.role}`} key={`${message.role}-${index}`}><div className="message-role">{message.role === 'user' ? 'YOU' : 'ZYRAXON AI'}</div><div>{message.content}</div></div>)}
          {busy && <div className="streaming"><span>●</span><div><b>Live AI response</b><p>Generating with {current.name}…</p></div></div>}
        </div>
        <div className="composer"><textarea value={input} onChange={(event) => setInput(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter' && !event.shiftKey) { event.preventDefault(); void generate() } }} placeholder={mode === 'bolt' ? 'Tell ZYRAXON what to build…' : 'Describe the plan…'} rows={3} /><div className="composer-row"><div className="selectors"><label><Icon name="spark" /><select value={model} onChange={(event) => setModel(event.target.value)}>{MODELS.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label><label><select value={mode} onChange={(event) => setMode(event.target.value as Mode)}><option value="bolt">Bolt</option><option value="plan">Plan</option></select></label></div><div className="composer-buttons"><button className={listening ? 'mic listening' : 'mic'} onClick={toggleMic} title="Voice input"><Icon name="mic" /></button><button className="send" disabled={!input.trim() || busy} onClick={() => void generate()}><Icon name="send" /></button></div></div></div>
      </section>
      <section className="workspace"><div className="toolbar"><div className="tabs"><button className={view === 'preview' ? 'active' : ''} onClick={() => setView('preview')}><Icon name="eye" />Preview</button><button className={view === 'code' ? 'active' : ''} onClick={() => setView('code')}><Icon name="code" />Code</button></div><div className="devices"><button className={device === 'desktop' ? 'active' : ''} onClick={() => setDevice('desktop')}><Icon name="desktop" /></button><button className={device === 'tablet' ? 'active' : ''} onClick={() => setDevice('tablet')}><Icon name="tablet" /></button><button className={device === 'mobile' ? 'active' : ''} onClick={() => setDevice('mobile')}><Icon name="mobile" /></button></div></div>{view === 'preview' ? <div className="preview"><div className={`frame ${device}`}><iframe title="Live website preview" sandbox="allow-scripts allow-forms" src={previewUrl} /></div></div> : <div className="code-workspace"><aside className="files"><div><Icon name="folder" />FILES</div><button className="selected"><Icon name="file" />index.html</button><div className="sse"><Icon name="terminal" />SSE {connected ? 'LIVE' : 'READY'}</div></aside><div className="editor"><Editor height="100%" defaultLanguage="html" theme="vs-dark" value={code} onChange={(value) => setCode(value ?? '')} options={{ automaticLayout: true, minimap: { enabled: true }, fontSize: 13, wordWrap: 'on', smoothScrolling: true }} /></div><aside className="live"><div><Icon name="terminal" />AI LIVE RESPONSE</div>{logs.map((log, index) => <p key={index}>› {log}</p>)}</aside></div>}</section>
    </main>
    <style>{` .builder-v5{height:100vh;overflow:hidden;background:#07080c;color:#f4f5f7;font-family:Inter,system-ui}.builder-v5 *{box-sizing:border-box}.builder-v5 button,.builder-v5 select,.builder-v5 textarea{font:inherit}.builder-nav{height:62px;border-bottom:1px solid #1d2028;background:#0a0b10;display:flex;align-items:center;padding:0 18px;gap:28px}.brand{display:flex;align-items:center;gap:8px;color:#fff;text-decoration:none}.mark{width:30px;height:30px;display:grid;place-items:center;border-radius:9px;background:linear-gradient(135deg,#fff,#8c72ff);color:#09090b;font-weight:900}.badge{font-size:9px;color:#aa96ff;border:1px solid #40366c;border-radius:999px;padding:4px 7px}.builder-nav nav{display:flex;gap:5px}.builder-nav nav a{color:#8e929d;text-decoration:none;font-size:13px;padding:8px 11px;border-radius:8px}.builder-nav nav a.active,.builder-nav nav a:hover{color:#fff;background:#171922}.connection{margin-left:auto;color:#8e929d;font-size:11px}.dot{display:inline-block;width:7px;height:7px;border-radius:50%;background:#d39b55;margin-right:7px}.dot.on{background:#53d78b;box-shadow:0 0 10px #53d78b}.builder-shell{height:calc(100vh - 62px);display:grid;grid-template-columns:minmax(380px,.72fr) minmax(620px,1.28fr)}.chat-panel{border-right:1px solid #1d2028;display:flex;flex-direction:column;min-width:0}.chat-head{padding:20px 22px;border-bottom:1px solid #1d2028;display:flex;justify-content:space-between}.chat-head small{font-size:9px;letter-spacing:.16em;color:#9b7cff}.chat-head h1{font-size:19px;margin:5px 0}.model-pill{font-size:10px;color:#b7aaff}.chat-scroll{flex:1;overflow:auto;padding:24px}.welcome{text-align:center;max-width:500px;margin:7vh auto}.orb{width:68px;height:68px;margin:auto;display:grid;place-items:center;border-radius:21px;color:#b9a8ff;background:#151122;border:1px solid #40366c;animation:float 4s ease-in-out infinite}.welcome h2{font-size:30px;margin:19px 0 8px}.welcome p{color:#8d929e;line-height:1.6;font-size:13px}.prompts{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-top:24px}.prompts button,.tabs button,.devices button,.mic,.send{background:#101218;color:#d9dbe1;border:1px solid #242731;border-radius:9px;padding:9px;display:flex;gap:7px;align-items:center;justify-content:center;cursor:pointer}.prompts button:hover{border-color:#5d4c9d}.message{margin-bottom:15px;padding:13px 15px;border:1px solid #20232c;border-radius:14px;font-size:13px;line-height:1.55}.message.user{background:#11131a}.message-role{font-size:9px;color:#9b7cff;margin-bottom:6px}.streaming{display:flex;gap:10px;padding:12px;border:1px solid #30295a;border-radius:12px;color:#b9a8ff}.streaming p{margin:3px 0;color:#8d929e;font-size:11px}.composer{margin:0 20px 14px;border:1px solid #292c35;background:#0d0f14;border-radius:15px}.composer textarea{width:100%;resize:none;background:transparent;border:0;outline:0;color:#fff;padding:14px}.composer-row{display:flex;justify-content:space-between;padding:8px;border-top:1px solid #1e2129}.selectors,.composer-buttons,.tabs,.devices{display:flex;gap:6px}.selectors label{display:flex;align-items:center;gap:5px;background:#14161d;border:1px solid #262934;border-radius:8px;padding:5px 7px;color:#aaa}.selectors select{background:transparent;border:0;outline:0;color:#dfe1e6;font-size:10px}.mic,.send{width:34px;height:34px;padding:0}.mic.listening{color:#ff7893;border-color:#77384b}.send{background:#8b70ef;color:#fff;border-color:transparent}.send:disabled{opacity:.3}.workspace{display:flex;flex-direction:column;min-width:0;background:#08090d}.toolbar{height:54px;border-bottom:1px solid #1d2028;display:flex;align-items:center;padding:0 12px}.devices{margin-left:auto}.tabs button,.devices button{height:32px}.tabs button.active,.devices button.active{color:#fff;background:#1b1b27;border-color:#493d76}.preview{flex:1;min-height:0;display:grid;place-items:center;padding:24px}.frame{height:100%;width:100%;border:1px solid #2a2d37;background:#fff;border-radius:12px;overflow:hidden}.frame.tablet{width:min(768px,100%)}.frame.mobile{width:min(390px,100%)}.frame iframe{width:100%;height:100%;border:0}.code-workspace{flex:1;min-height:0;display:grid;grid-template-columns:180px minmax(0,1fr) 240px}.files,.live{background:#0a0b10;padding:12px;color:#8f95a1}.files{border-right:1px solid #1d2028}.live{border-left:1px solid #1d2028}.files>div:first-child,.live>div{font-size:9px;letter-spacing:.12em;color:#aaa1d2;margin-bottom:12px}.files button{width:100%;border:0;background:#181a22;color:#fff;text-align:left;padding:9px;border-radius:7px}.sse{margin-top:20px;font-size:10px}.editor{min-width:0}.live p{font:10px/1.5 ui-monospace,monospace;color:#7e8592;border-bottom:1px solid #171922;padding-bottom:5px}@keyframes float{50%{transform:translateY(-7px)}}@media(max-width:1050px){.builder-shell{grid-template-columns:1fr}.workspace{display:none}.builder-nav nav{display:none}.prompts{grid-template-columns:1fr}}`}</style>
  </div>
}
