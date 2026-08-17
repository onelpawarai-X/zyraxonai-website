import { useEffect, useMemo, useRef, useState } from 'react'
import Editor from '@monaco-editor/react'
import { Link } from '@tanstack/react-router'
import { Activity, Bot, Code2, Eye, FileCode2, FileJson2, FileText, FolderOpen, Github, Globe2, Laptop, Lightbulb, Loader2, Mic, Moon, Play, Save, Send, Settings2, Smartphone, Sparkles, Tablet, TerminalSquare, Upload, X, Zap } from 'lucide-react'

type Device = 'desktop' | 'tablet' | 'mobile'
type View = 'preview' | 'code'
type Mode = 'bolt' | 'plan'
type ChatMessage = { role: 'user' | 'assistant'; content: string }
type GeneratedFile = { path: string; content: string }

const MODELS = [
  { id: 'mimo-v2.5-free', name: 'MiMo V2.5 Free' },
  { id: 'nemotron-3-super-free', name: 'Nemotron 3 Super Free' },
  { id: 'big-pickle', name: 'Big Pickle' },
]

const STARTER: GeneratedFile = {
  path: 'index.html',
  content: '<!doctype html>\n<html>\n<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>\n<body><main><h1>Start with an idea.</h1><p>Tell ZYRAXON what to build.</p></main></body>\n</html>',
}

const DEVICON: Record<string, string> = {
  html: 'html5', htm: 'html5', css: 'css3', scss: 'sass', sass: 'sass', less: 'less', js: 'javascript', jsx: 'react', ts: 'typescript', tsx: 'react', mjs: 'nodejs', cjs: 'nodejs', json: 'json', jsonc: 'json', md: 'markdown', mdx: 'markdown', py: 'python', rb: 'ruby', php: 'php', java: 'java', kt: 'kotlin', kts: 'kotlin', go: 'go', rs: 'rust', c: 'c', h: 'c', cpp: 'cplusplus', hpp: 'cplusplus', cs: 'csharp', swift: 'swift', dart: 'dart', lua: 'lua', r: 'r', scala: 'scala', sh: 'bash', bash: 'bash', zsh: 'bash', fish: 'bash', sql: 'azuresqldatabase', graphql: 'graphql', vue: 'vuejs', svelte: 'svelte', astro: 'astro', xml: 'xml', yaml: 'yaml', yml: 'yaml', toml: 'toml', dockerfile: 'docker', prisma: 'prisma', env: 'dotenv', gitignore: 'git', lock: 'npm', csv: 'filetype-csv', pdf: 'filetype-pdf', txt: 'filetype-text', wasm: 'webassembly', zig: 'zig', ex: 'elixir', exs: 'elixir', erl: 'erlang', fs: 'fsharp', fsx: 'fsharp', clj: 'clojure', groovy: 'groovy', vim: 'vim', proto: 'protobuf', tf: 'terraform', sol: 'solidity', ipynb: 'jupyter', cmake: 'cmake', make: 'gnu', gradle: 'gradle', vuex: 'vuejs', 'config.js': 'javascript', 'config.ts': 'typescript',
}

function fileExtension(path: string) {
  const name = path.split('/').pop()?.toLowerCase() ?? ''
  if (DEVICON[name]) return name
  const ext = name.includes('.') ? name.split('.').pop() ?? '' : name
  return ext
}

function FileIcon({ path, size = 16 }: { path: string; size?: number }) {
  const key = fileExtension(path)
  const slug = DEVICON[key]
  if (slug && !slug.startsWith('filetype-')) {
    return <img src={`https://cdn.jsdelivr.net/gh/devicons/devicon@latest/icons/${slug}/${slug}-original.svg`} width={size} height={size} alt="" className="file-devicon" onError={(event) => { event.currentTarget.style.display = 'none' }} />
  }
  if (key === 'json') return <FileJson2 size={size} />
  if (key === 'html' || key === 'htm') return <FileCode2 size={size} />
  return <FileText size={size} />
}

function parseGeneratedFiles(text: string): GeneratedFile[] {
  const files: GeneratedFile[] = []
  const fenced = /```(?:[\w+#.-]+)?\s*(?:file|filename|path)?\s*[=:]?\s*[`']?([^\n`']+\.[a-zA-Z0-9._-]+)[`']?\s*\n([\s\S]*?)```/g
  let match: RegExpExecArray | null
  while ((match = fenced.exec(text))) files.push({ path: match[1].trim().replace(/^\//, ''), content: match[2].trim() })
  const tagged = /<file\s+path=["']([^"']+)["'][^>]*>([\s\S]*?)<\/file>/gi
  while ((match = tagged.exec(text))) files.push({ path: match[1].trim().replace(/^\//, ''), content: match[2].trim() })
  return files.filter((file, index, list) => list.findIndex((item) => item.path === file.path) === index)
}

export default function BuilderStudioV3() {
  const [model, setModel] = useState(MODELS[0].id)
  const [mode, setMode] = useState<Mode>('bolt')
  const [device, setDevice] = useState<Device>('desktop')
  const [view, setView] = useState<View>('preview')
  const [input, setInput] = useState('')
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [files, setFiles] = useState<GeneratedFile[]>([STARTER])
  const [activeFile, setActiveFile] = useState('index.html')
  const [busy, setBusy] = useState(false)
  const [connected, setConnected] = useState(false)
  const [listening, setListening] = useState(false)
  const [dark, setDark] = useState(true)
  const [activityOpen, setActivityOpen] = useState(false)
  const [saved, setSaved] = useState(false)
  const [stream, setStream] = useState('')
  const recognition = useRef<any>(null)
  const current = MODELS.find((item) => item.id === model) ?? MODELS[0]
  const active = files.find((file) => file.path === activeFile) ?? files[0]
  const html = files.find((file) => file.path.toLowerCase() === 'index.html')?.content ?? active.content
  const previewUrl = useMemo(() => `data:text/html;charset=utf-8,${encodeURIComponent(html)}`, [html])

  useEffect(() => {
    let cancelled = false
    fetch('/api/public/builder/chat', { method: 'GET' }).then((response) => { if (!cancelled) setConnected(response.ok) }).catch(() => { if (!cancelled) setConnected(false) })
    return () => { cancelled = true }
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

  function toggleMic() {
    const instance = recognition.current
    if (!instance) return
    if (listening) instance.stop()
    else { setListening(true); instance.start() }
  }

  function updateActiveCode(value: string) {
    setFiles((items) => items.map((file) => file.path === activeFile ? { ...file, content: value } : file))
    setSaved(false)
  }

  async function generate() {
    const text = input.trim()
    if (!text || busy) return
    const next = [...messages, { role: 'user' as const, content: text }]
    setMessages(next)
    setInput('')
    setBusy(true)
    setView('code')
    setStream('')
    let assistant = ''
    try {
      const response = await fetch('/api/public/builder/chat', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ model, messages: next }) })
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
            if (!delta) continue
            assistant += delta
            setStream(assistant.slice(-12000))
            const generated = parseGeneratedFiles(assistant)
            if (generated.length) {
              setFiles((existing) => {
                const merged = [...existing]
                for (const generatedFile of generated) {
                  const index = merged.findIndex((file) => file.path === generatedFile.path)
                  if (index >= 0) merged[index] = generatedFile
                  else merged.push(generatedFile)
                }
                return merged
              })
              const latest = generated[generated.length - 1]
              setActiveFile(latest.path)
            }
          } catch {}
        }
      }
      setMessages((items) => [...items, { role: 'assistant', content: assistant.replace(/```[\s\S]*?```/g, '').trim() || 'Build complete.' }])
      setStream('')
    } catch {
      setConnected(false)
      setMessages((items) => [...items, { role: 'assistant', content: 'The AI connection could not be completed. Please try again.' }])
    } finally {
      setBusy(false)
    }
  }

  return <div className={dark ? 'builder-root dark' : 'builder-root light'}>
    <header className="topbar">
      <Link to="/" className="brand"><span className="brand-mark">Z</span><strong>ZYRAXON</strong><span className="brand-product">AI BLUDAR</span></Link>
      <div className="top-actions"><Link to="/" className="nav-link">Home</Link><Link to="/builder" className="nav-link active">AI Bludar</Link><Link to="/ecosystem" className="nav-link">Ecosystem</Link><button className="top-btn"><Upload size={15} /> Publish</button><button className="top-btn" onClick={() => setActivityOpen((value) => !value)}><Activity size={15} /> Activity</button><button className="icon-btn" title="Theme" onClick={() => setDark((value) => !value)}>{dark ? <Lightbulb size={16} /> : <Moon size={16} />}</button></div>
    </header>
    {activityOpen && <aside className="activity"><div><b>Activity</b><button onClick={() => setActivityOpen(false)}><X size={15} /></button></div><p>{busy ? 'AI is generating your project…' : 'No active operations.'}</p></aside>}
    <main className="app-grid">
      <section className="chat-column">
        <div className="chat-heading"><div><span className="eyebrow"><Sparkles size={12} /> AI PRODUCT STUDIO</span><h1>Build something extraordinary.</h1></div></div>
        <div className="chat-scroll">
          {messages.length === 0 ? <div className="welcome"><div className="welcome-orb"><Bot size={28} /></div><h2>What are we building?</h2><p>Describe your website, app, or feature. ZYRAXON will build it and stream every generated file into the workspace.</p><div className="suggestions"><button onClick={() => setInput('Build a premium dark AI SaaS landing page')}><Sparkles size={15} /> AI SaaS</button><button onClick={() => setInput('Build a developer portfolio')}><Code2 size={15} /> Portfolio</button><button onClick={() => setInput('Build a modern product website')}><Globe2 size={15} /> Product</button></div></div> : messages.map((message, index) => <article className={`message ${message.role}`} key={`${message.role}-${index}`}><small>{message.role === 'user' ? 'YOU' : 'ZYRAXON AI'}</small><div>{message.content}</div></article>)}
        </div>
        <div className="composer"><textarea value={input} onChange={(event) => setInput(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter' && !event.shiftKey) { event.preventDefault(); void generate() } }} placeholder={mode === 'bolt' ? 'Describe what you want to build…' : 'Describe the plan…'} /><div className="composer-footer"><div className="composer-controls"><label className="model-select"><Sparkles size={14} /><select value={model} onChange={(event) => setModel(event.target.value)}>{MODELS.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label><label className="mode-select"><Zap size={14} /><select value={mode} onChange={(event) => setMode(event.target.value as Mode)}><option value="bolt">Bolt</option><option value="plan">Plan</option></select></label></div><div className="send-controls"><button className={listening ? 'round-btn listening' : 'round-btn'} onClick={toggleMic} title="Voice input"><Mic size={17} /></button><button className="send-btn" disabled={!input.trim() || busy} onClick={() => void generate()}>{busy ? <Loader2 size={17} className="spin" /> : <Send size={17} />}</button></div></div></div>
      </section>
      <section className="workspace-column">
        <div className="workspace-toolbar"><div className="view-tabs"><button className={view === 'preview' ? 'selected' : ''} onClick={() => setView('preview')}><Eye size={15} /> Preview</button><button className={view === 'code' ? 'selected' : ''} onClick={() => setView('code')}><Code2 size={15} /> Code</button></div><div className="device-tabs"><button className={device === 'desktop' ? 'selected' : ''} onClick={() => setDevice('desktop')}><Laptop size={15} /></button><button className={device === 'tablet' ? 'selected' : ''} onClick={() => setDevice('tablet')}><Tablet size={15} /></button><button className={device === 'mobile' ? 'selected' : ''} onClick={() => setDevice('mobile')}><Smartphone size={15} /></button></div><span className={connected ? 'status connected' : 'status'}><span />{connected ? 'AI Connected' : 'Connecting'}</span></div>
        {view === 'preview' ? <div className="preview-area"><div className={`preview-frame ${device}`}><iframe title="Generated website preview" sandbox="allow-scripts allow-forms" src={previewUrl} /></div></div> : <div className="code-area"><aside className="file-tree"><div className="panel-title"><span><FolderOpen size={15} /> Generated files</span><span>{files.length}</span></div><div className="file-list">{files.map((file) => <button key={file.path} className={activeFile === file.path ? 'file active' : 'file'} onClick={() => setActiveFile(file.path)}><FileIcon path={file.path} /><span>{file.path}</span></button>)}</div><div className="file-footer"><span><TerminalSquare size={14} /> AI stream</span><span className={busy ? 'live' : ''}>{busy ? 'LIVE' : 'IDLE'}</span></div></aside><div className="monaco-panel"><div className="editor-header"><div><FileIcon path={active.path} /> <span>{active.path}</span></div><button onClick={() => { setSaved(true); window.setTimeout(() => setSaved(false), 1400) }}><Save size={14} /> {saved ? 'Saved' : 'Save'}</button></div><div className="editor-body"><Editor height="100%" language={languageFor(active.path)} theme="vs-dark" value={active.content} onChange={(value) => updateActiveCode(value ?? '')} options={{ automaticLayout: true, minimap: { enabled: true }, fontSize: 13, lineNumbers: 'on', wordWrap: 'on', smoothScrolling: true, padding: { top: 12 } }} /></div></div><aside className="stream-panel"><div className="stream-header"><span><Bot size={15} /> AI Live Code Stream</span><span className={busy ? 'live' : ''}>{busy ? 'LIVE' : 'READY'}</span></div><div className="stream-body">{stream ? <pre>{stream}</pre> : <div className="stream-empty"><Sparkles size={18} /><p>When AI writes a file, its stream appears here in real time.</p></div>}</div></aside></div>}
      </section>
    </main>
    <style>{styles}</style>
  </div>
}

function languageFor(path: string) {
  const ext = path.toLowerCase().split('.').pop()
  const map: Record<string, string> = { html: 'html', htm: 'html', css: 'css', scss: 'scss', less: 'less', js: 'javascript', jsx: 'javascript', ts: 'typescript', tsx: 'typescript', json: 'json', md: 'markdown', mdx: 'markdown', py: 'python', rb: 'ruby', php: 'php', java: 'java', kt: 'kotlin', go: 'go', rs: 'rust', c: 'c', cpp: 'cpp', cs: 'csharp', swift: 'swift', dart: 'dart', sql: 'sql', graphql: 'graphql', xml: 'xml', yaml: 'yaml', yml: 'yaml', sh: 'shell', bash: 'shell', vue: 'html', svelte: 'html', astro: 'html', lua: 'lua', r: 'r' }
  return map[ext ?? ''] ?? 'plaintext'
}

const styles = `
.builder-root{height:100vh;overflow:hidden;background:#07080b;color:#ececf1;font-family:Inter,ui-sans-serif,system-ui,sans-serif}.builder-root.light{background:#f5f5f7;color:#18181b}.builder-root *{box-sizing:border-box}.topbar{height:60px;border-bottom:1px solid #20232b;background:rgba(9,10,14,.94);display:flex;align-items:center;padding:0 18px;gap:24px}.light .topbar{background:#fff;border-color:#ddd}.brand{display:flex;align-items:center;gap:8px;color:#fff;text-decoration:none}.light .brand{color:#18181b}.brand-mark{width:29px;height:29px;display:grid;place-items:center;border-radius:8px;background:linear-gradient(135deg,#fff,#947dff);color:#09090b;font-weight:900}.brand-product{font-size:9px;color:#9f8aff;border:1px solid #40366c;padding:4px 7px;border-radius:999px}.top-actions{margin-left:auto;display:flex;align-items:center;gap:5px}.nav-link,.top-btn,.icon-btn{border:0;background:transparent;color:#858994;text-decoration:none;padding:8px 10px;border-radius:8px;font-size:12px;display:flex;align-items:center;gap:6px;cursor:pointer}.nav-link:hover,.nav-link.active,.top-btn:hover,.icon-btn:hover{color:#fff;background:#171921}.light .nav-link:hover,.light .nav-link.active,.light .top-btn:hover,.light .icon-btn:hover{color:#111;background:#eee}.top-btn{border:1px solid #292c35;color:#c8cad1}.app-grid{height:calc(100vh - 60px);display:grid;grid-template-columns:minmax(390px,.68fr) minmax(650px,1.32fr)}.chat-column{min-width:0;border-right:1px solid #20232b;display:flex;flex-direction:column;background:radial-gradient(circle at 50% 35%,rgba(91,69,160,.10),transparent 35%)}.chat-heading{padding:20px 24px 14px}.eyebrow{font-size:9px;letter-spacing:.16em;color:#9d87ff;display:flex;align-items:center;gap:6px}.chat-heading h1{font-size:19px;margin:7px 0 0}.chat-scroll{flex:1;min-height:0;overflow-y:auto;padding:10px 24px 24px}.welcome{max-width:520px;margin:8vh auto 0;text-align:center}.welcome-orb{width:70px;height:70px;margin:auto;display:grid;place-items:center;border:1px solid #3d3263;border-radius:22px;background:linear-gradient(145deg,#161221,#0e0f14);color:#b7a5ff;box-shadow:0 0 45px rgba(125,95,220,.15);animation:float 4s ease-in-out infinite}.welcome h2{font-size:28px;margin:18px 0 8px}.welcome p{color:#858a96;font-size:13px;line-height:1.65}.suggestions{display:flex;justify-content:center;gap:7px;margin-top:24px;flex-wrap:wrap}.suggestions button{display:flex;align-items:center;gap:7px;background:#101116;border:1px solid #272a32;color:#aeb1ba;padding:9px 12px;border-radius:10px;cursor:pointer}.suggestions button:hover{border-color:#5a4c91;color:#fff;transform:translateY(-1px)}.message{max-width:92%;padding:12px 14px;margin:10px 0;border:1px solid #252832;border-radius:12px;background:#0e1015;font-size:13px;line-height:1.55}.message.user{margin-left:auto;background:#15131e;border-color:#393151}.message small{font-size:9px;color:#817c90;letter-spacing:.1em}.message div{margin-top:5px;white-space:pre-wrap}.composer{margin:0 18px 18px;border:1px solid #292c35;background:rgba(12,13,18,.96);border-radius:15px;box-shadow:0 18px 60px rgba(0,0,0,.28)}.composer textarea{width:100%;resize:none;border:0;outline:0;background:transparent;color:#f2f2f5;padding:14px 15px 5px;min-height:78px}.composer textarea::placeholder{color:#656a76}.composer-footer{display:flex;justify-content:space-between;align-items:center;padding:7px 9px 9px}.composer-controls,.send-controls{display:flex;gap:5px}.model-select,.mode-select{display:flex;align-items:center;gap:5px;border:1px solid #252832;border-radius:8px;padding:6px 8px;color:#a7aab3}.model-select select,.mode-select select{border:0;outline:0;background:transparent;color:#b9bbc3;font-size:11px;max-width:145px}.model-select option,.mode-select option{background:#111219;color:#fff}.round-btn,.send-btn{width:34px;height:34px;border-radius:9px;border:1px solid #292c35;background:#14161c;color:#a8abb5;display:grid;place-items:center;cursor:pointer}.round-btn.listening{color:#ff7676;border-color:#6a3434;animation:pulse 1.2s infinite}.send-btn{background:#f0eff6;color:#111;border-color:#fff}.send-btn:disabled{opacity:.35;cursor:not-allowed}.workspace-column{min-width:0;display:flex;flex-direction:column;background:#0a0b0f}.workspace-toolbar{height:49px;border-bottom:1px solid #20232b;display:flex;align-items:center;padding:0 10px;gap:10px}.view-tabs,.device-tabs{display:flex;gap:3px}.view-tabs button,.device-tabs button{border:0;background:transparent;color:#777c88;padding:7px 9px;border-radius:7px;display:flex;align-items:center;gap:6px;cursor:pointer;font-size:11px}.view-tabs button.selected,.device-tabs button.selected,.view-tabs button:hover,.device-tabs button:hover{background:#191b22;color:#f4f4f6}.device-tabs{margin-left:auto}.status{font-size:9px;color:#777c88;display:flex;align-items:center;gap:5px;margin-left:7px}.status span{width:6px;height:6px;border-radius:50%;background:#b88743}.status.connected span{background:#4ad48a;box-shadow:0 0 8px #4ad48a}.preview-area{flex:1;min-height:0;padding:20px;display:grid;place-items:center;background:#08090c}.preview-frame{height:100%;width:100%;max-width:1280px;border:1px solid #242731;border-radius:10px;overflow:hidden;background:#fff;box-shadow:0 25px 70px rgba(0,0,0,.3)}.preview-frame.tablet{max-width:820px}.preview-frame.mobile{max-width:390px}.preview-frame iframe{width:100%;height:100%;border:0;background:#fff}.code-area{flex:1;min-height:0;display:grid;grid-template-columns:190px minmax(0,1fr) 285px;background:#0b0c10}.file-tree,.stream-panel{min-width:0;background:#0e1015;border-right:1px solid #22252e}.stream-panel{border-right:0;border-left:1px solid #22252e;display:flex;flex-direction:column}.panel-title,.stream-header,.editor-header,.file-footer{height:42px;border-bottom:1px solid #22252e;display:flex;align-items:center;justify-content:space-between;padding:0 11px;color:#878c98;font-size:10px}.panel-title span:first-child,.stream-header span:first-child{display:flex;align-items:center;gap:6px}.file-list{padding:7px;overflow:auto;max-height:calc(100% - 82px)}.file{width:100%;display:flex;align-items:center;gap:8px;border:0;background:transparent;color:#858a96;padding:8px 9px;border-radius:7px;text-align:left;font-size:11px;cursor:pointer}.file:hover,.file.active{background:#1a1c24;color:#eee}.file-devicon{object-fit:contain}.file-footer{border-top:1px solid #22252e;border-bottom:0}.file-footer span:first-child{display:flex;align-items:center;gap:6px}.live{color:#53d894!important}.monaco-panel{min-width:0;display:flex;flex-direction:column}.editor-header{color:#b7bac4}.editor-header>div{display:flex;align-items:center;gap:7px}.editor-header button{display:flex;align-items:center;gap:5px;border:1px solid #2b2e37;background:#15171d;color:#bfc1c9;border-radius:7px;padding:5px 8px;font-size:10px;cursor:pointer}.editor-body{flex:1;min-height:0}.stream-body{flex:1;min-height:0;overflow:auto;padding:12px}.stream-body pre{white-space:pre-wrap;word-break:break-word;color:#b9c0cc;font:11px/1.55 ui-monospace,SFMono-Regular,Menlo,monospace}.stream-empty{height:100%;display:grid;place-items:center;text-align:center;color:#626875;font-size:11px;padding:30px}.stream-empty p{max-width:180px;line-height:1.6}.activity{position:fixed;z-index:20;right:12px;top:68px;width:260px;background:#111319;border:1px solid #2b2e38;border-radius:12px;box-shadow:0 20px 70px rgba(0,0,0,.45);padding:12px}.activity>div{display:flex;justify-content:space-between}.activity button{border:0;background:none;color:#888;cursor:pointer}.activity p{color:#858a96;font-size:11px}.spin{animation:spin .8s linear infinite}@keyframes spin{to{transform:rotate(360deg)}}@keyframes float{50%{transform:translateY(-5px)}}@keyframes pulse{50%{box-shadow:0 0 0 5px rgba(255,100,100,.08)}}@media(max-width:1050px){.app-grid{grid-template-columns:1fr}.workspace-column{display:none}.chat-column{border-right:0}.top-actions .nav-link{display:none}}
`