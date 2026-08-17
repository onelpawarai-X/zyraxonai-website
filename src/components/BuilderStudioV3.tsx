import { useMemo, useState } from 'react'

type Device = 'desktop' | 'tablet' | 'mobile'
type View = 'preview' | 'code'
type Mode = 'bolt' | 'plan'

const MODELS = [
  { id: 'mimo-v2.5-free', name: 'MiMo V2.5 Free', note: 'Balanced builder' },
  { id: 'nemotron-3-super-free', name: 'Nemotron 3 Super Free', note: 'Deep reasoning' },
  { id: 'big-pickle', name: 'Big Pickle', note: 'Fast generation' },
]

const starter = `<!doctype html>\n<html>\n<head>\n<meta charset="UTF-8">\n<meta name="viewport" content="width=device-width,initial-scale=1">\n<title>ZYRAXON</title>\n<style>body{margin:0;font-family:Inter,system-ui;background:#08080b;color:#fff;display:grid;place-items:center;min-height:100vh}main{text-align:center}h1{font-size:48px;margin:0 0 12px}p{color:#999}</style>\n</head>\n<body><main><h1>Start with an idea.</h1><p>Describe the website you want ZYRAXON AI to build.</p></main></body>\n</html>`

const Icon = ({ name, size = 17 }: { name: string; size?: number }) => {
  const p = { width: size, height: size, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 1.8, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const }
  const paths: Record<string, React.ReactNode> = {
    bolt: <><path d="M13 2 4 14h7l-1 8 9-12h-7z"/></>,
    spark: <><path d="m12 2 1.7 6.3L20 10l-6.3 1.7L12 18l-1.7-6.3L4 10l6.3-1.7z"/><path d="m19 16 .7 2.3L22 19l-2.3.7L19 22l-.7-2.3L16 19l2.3-.7z"/></>,
    eye: <><path d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6S2 12 2 12Z"/><circle cx="12" cy="12" r="2.5"/></>,
    code: <><path d="m8 8-4 4 4 4M16 8l4 4-4 4M14 5l-4 14"/></>,
    desktop: <><rect x="3" y="4" width="18" height="13" rx="2"/><path d="M8 21h8M12 17v4"/></>,
    tablet: <><rect x="6" y="2.5" width="12" height="19" rx="2"/><path d="M11 18.5h2"/></>,
    mobile: <><rect x="8" y="2" width="8" height="20" rx="2"/><path d="M11 18.5h2"/></>,
    send: <><path d="m4 4 17 8-17 8 3-8z"/><path d="M7 12h14"/></>,
    activity: <><path d="M3 12h4l2-7 4 14 2-7h6"/></>,
    publish: <><path d="M12 16V3M7 8l5-5 5 5"/><path d="M5 13v6h14v-6"/></>,
    moon: <path d="M20 15.5A8 8 0 0 1 8.5 4 8 8 0 1 0 20 15.5Z"/>,
    sun: <><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/></>,
    folder: <><path d="M3 6a2 2 0 0 1 2-2h5l2 2h7a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/></>,
  }
  return <svg {...p}>{paths[name] || paths.spark}</svg>
}

export default function BuilderStudioV3() {
  const [model, setModel] = useState(MODELS[0].id)
  const [mode, setMode] = useState<Mode>('bolt')
  const [device, setDevice] = useState<Device>('desktop')
  const [view, setView] = useState<View>('preview')
  const [input, setInput] = useState('')
  const [code, setCode] = useState(starter)
  const [busy, setBusy] = useState(false)
  const [theme, setTheme] = useState<'dark' | 'light'>('dark')
  const [activity, setActivity] = useState<string[]>([])
  const [sent, setSent] = useState<string[]>([])
  const current = MODELS.find(m => m.id === model) || MODELS[0]
  const previewUrl = useMemo(() => `data:text/html;charset=utf-8,${encodeURIComponent(code)}`, [code])

  async function generate() {
    const text = input.trim()
    if (!text || busy) return
    setBusy(true); setSent(v => [...v, text]); setInput(''); setActivity(v => [`${current.name} · ${mode === 'bolt' ? 'Building' : 'Planning'}…`, ...v].slice(0, 8))
    try {
      const response = await fetch('/api/public/builder/chat', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ model, messages: [{ role: 'user', content: text }] }) })
      if (response.ok) {
        const data = await response.json().catch(() => null)
        const content = data?.choices?.[0]?.message?.content || ''
        const match = content.match(/```(?:html)?\s*([\s\S]*?)```/i)
        if (match?.[1]) setCode(match[1].trim())
      }
    } catch { /* UI remains usable if the provider is unavailable */ }
    finally { setBusy(false); setActivity(v => ['Ready', ...v].slice(0, 8)) }
  }

  return <div className={`builder-v3 ${theme}`}>
    <header className="v3-topbar">
      <a href="/" className="v3-brand"><span className="brand-mark">Z</span><span>ZYRAXON</span><em>AI BUILDER</em></a>
      <div className="v3-title">Builder Studio <span>•</span> Live</div>
      <div className="v3-actions">
        <button className="icon-btn" title="Theme" onClick={() => setTheme(t => t === 'dark' ? 'light' : 'dark')}><Icon name={theme === 'dark' ? 'sun' : 'moon'}/></button>
        <button className="action-btn" onClick={() => setActivity(v => v.length ? [] : ['Session ready'])}><Icon name="activity"/> Activity</button>
        <button className="publish-btn"><Icon name="publish"/> Publish</button>
      </div>
    </header>

    <div className="v3-body">
      <section className="v3-chat">
        <div className="chat-content">
          {!sent.length ? <div className="hero">
            <div className="hero-orb"><Icon name="spark" size={30}/></div>
            <div className="eyebrow">AI PRODUCT STUDIO</div>
            <h1>What will you build?</h1>
            <p>Describe an idea and let ZYRAXON turn it into a polished web experience.</p>
            <div className="quick-grid"><button onClick={() => setInput('Build a premium AI SaaS landing page')}><Icon name="spark"/>AI SaaS</button><button onClick={() => setInput('Build a developer portfolio')}><Icon name="code"/>Portfolio</button><button onClick={() => setInput('Build a modern product website')}><Icon name="eye"/>Product</button></div>
          </div> : <div className="conversation">{sent.map((m, i) => <div className="bubble" key={`${m}-${i}`}><span>You</span><p>{m}</p></div>)}{busy && <div className="thinking"><i/><i/><i/> ZYRAXON is building…</div>}</div>}
        </div>

        <div className="composer-shell">
          <textarea value={input} onChange={e => setInput(e.target.value)} onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); generate() } }} placeholder={mode === 'bolt' ? 'Describe what you want to build…' : 'Describe what you want planned…'} rows={2}/>
          <div className="composer-tools">
            <div className="tool-group">
              <div className="select-wrap"><Icon name="bolt" size={15}/><select value={mode} onChange={e => setMode(e.target.value as Mode)}><option value="bolt">Bolt</option><option value="plan">Plan</option></select></div>
              <div className="select-wrap model-select"><Icon name="spark" size={15}/><select value={model} onChange={e => setModel(e.target.value)}>{MODELS.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}</select></div>
              <span className="model-note">{current.note}</span>
            </div>
            <button className="send" disabled={!input.trim() || busy} onClick={generate} title="Generate"><Icon name="send" size={18}/></button>
          </div>
        </div>
        <div className="hint">Enter to send · Shift + Enter for a new line</div>
      </section>

      <section className="v3-studio">
        <div className="studio-toolbar">
          <div className="segmented"><button className={view === 'preview' ? 'active' : ''} onClick={() => setView('preview')}><Icon name="eye"/> Preview</button><button className={view === 'code' ? 'active' : ''} onClick={() => setView('code')}><Icon name="code"/> Code</button></div>
          <div className="device-group"><button className={device === 'desktop' ? 'active' : ''} onClick={() => setDevice('desktop')} title="Desktop"><Icon name="desktop"/></button><button className={device === 'tablet' ? 'active' : ''} onClick={() => setDevice('tablet')} title="Tablet"><Icon name="tablet"/></button><button className={device === 'mobile' ? 'active' : ''} onClick={() => setDevice('mobile')} title="Mobile"><Icon name="mobile"/></button></div>
        </div>
        <div className="studio-stage">
          {view === 'preview' ? <div className={`device-frame ${device}`}><iframe title="Live website preview" sandbox="allow-scripts allow-forms" src={previewUrl}/></div> : <div className="code-view"><div className="file-head"><Icon name="folder"/> index.html <span>HTML</span></div><textarea spellCheck={false} value={code} onChange={e => setCode(e.target.value)}/></div>}
        </div>
        {activity.length > 0 && <aside className="activity-panel"><div><b>Activity</b><button onClick={() => setActivity([])}>×</button></div>{activity.map((a, i) => <p key={`${a}-${i}`}><i/>{a}</p>)}</aside>}
      </section>
    </div>
  </div>
}

const style = document.createElement('style')
style.textContent = `
.builder-v3{height:100vh;min-height:680px;overflow:hidden;background:#06070a;color:#f7f7fa;font-family:Inter,ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;--line:rgba(255,255,255,.1);--panel:rgba(14,15,19,.82);--muted:#8d909a;--accent:#9b7cff}.builder-v3.light{background:#eef0f4;color:#17181c;--line:rgba(0,0,0,.1);--panel:rgba(255,255,255,.84);--muted:#626773}.builder-v3 *{box-sizing:border-box}.builder-v3 button,.builder-v3 select,.builder-v3 textarea{font:inherit}.v3-topbar{height:66px;border-bottom:1px solid var(--line);display:flex;align-items:center;padding:0 22px;background:rgba(7,8,11,.78);backdrop-filter:blur(22px);position:relative;z-index:5}.light .v3-topbar{background:rgba(255,255,255,.78)}.v3-brand{display:flex;align-items:center;gap:9px;color:inherit;text-decoration:none;font-weight:800;letter-spacing:.02em}.brand-mark{width:31px;height:31px;border-radius:10px;display:grid;place-items:center;background:linear-gradient(135deg,#fff,#8170ff);color:#08080a;box-shadow:0 0 28px rgba(140,110,255,.32)}.v3-brand em{font-style:normal;color:var(--accent);font-size:10px;letter-spacing:.12em;border:1px solid rgba(155,124,255,.3);padding:4px 7px;border-radius:999px}.v3-title{margin:auto;color:var(--muted);font-size:13px}.v3-title span{color:#9b7cff;margin:0 6px}.v3-actions{display:flex;gap:8px}.icon-btn,.action-btn,.publish-btn,.segmented button,.device-group button{border:1px solid var(--line);background:rgba(255,255,255,.045);color:inherit;border-radius:10px;cursor:pointer;transition:transform .16s ease,background .16s ease,border-color .16s ease,box-shadow .16s ease}.icon-btn:hover,.action-btn:hover,.segmented button:hover,.device-group button:hover{transform:translateY(-1px);background:rgba(255,255,255,.09);border-color:rgba(155,124,255,.35)}.icon-btn{width:38px;height:38px;display:grid;place-items:center}.action-btn,.publish-btn{height:38px;padding:0 13px;display:flex;align-items:center;gap:7px}.publish-btn{background:linear-gradient(135deg,#8e72ff,#6b55d9);border-color:transparent;color:#fff;font-weight:700;box-shadow:0 8px 28px rgba(120,90,255,.25)}.v3-body{height:calc(100vh - 66px);display:grid;grid-template-columns:minmax(360px,.88fr) minmax(520px,1.12fr);gap:1px;background:var(--line)}.v3-chat,.v3-studio{min-width:0;min-height:0;background:#07080b;position:relative}.light .v3-chat,.light .v3-studio{background:#f4f5f7}.v3-chat{display:flex;flex-direction:column}.chat-content{flex:1;min-height:0;overflow:auto;padding:30px}.hero{height:100%;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;max-width:600px;margin:auto}.hero-orb{width:76px;height:76px;border-radius:24px;display:grid;place-items:center;color:#b9aaff;background:radial-gradient(circle at 30% 25%,#302657,#14131d);border:1px solid rgba(155,124,255,.3);box-shadow:0 0 70px rgba(130,100,255,.18);animation:float 4s ease-in-out infinite}.eyebrow{margin-top:25px;font-size:10px;letter-spacing:.2em;color:#9b7cff;font-weight:800}.hero h1{font-size:clamp(32px,4vw,52px);line-height:1;margin:12px 0}.hero p{color:var(--muted);max-width:490px;line-height:1.65;margin:0}.quick-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:9px;margin-top:26px;width:100%}.quick-grid button{border:1px solid var(--line);background:rgba(255,255,255,.035);color:inherit;border-radius:14px;padding:13px;display:flex;align-items:center;justify-content:center;gap:7px;cursor:pointer;transition:.18s}.quick-grid button:hover{transform:translateY(-2px);background:rgba(155,124,255,.09);border-color:rgba(155,124,255,.35)}.conversation{max-width:720px;margin:auto;width:100%;display:flex;flex-direction:column;gap:12px}.bubble{align-self:flex-end;max-width:82%;padding:13px 15px;border:1px solid rgba(155,124,255,.22);background:rgba(125,95,255,.08);border-radius:17px}.bubble span{font-size:10px;color:#9b7cff;font-weight:800}.bubble p{margin:5px 0 0;line-height:1.5}.thinking{display:flex;align-items:center;gap:5px;color:var(--muted);padding:15px}.thinking i{width:5px;height:5px;border-radius:50%;background:#9b7cff;animation:pulse 1s infinite}.thinking i:nth-child(2){animation-delay:.15s}.thinking i:nth-child(3){animation-delay:.3s}.composer-shell{margin:0 22px 8px;border:1px solid var(--line);border-radius:18px;background:rgba(15,16,20,.9);box-shadow:0 20px 60px rgba(0,0,0,.3);overflow:hidden}.light .composer-shell{background:rgba(255,255,255,.86)}.composer-shell textarea{width:100%;resize:none;border:0;outline:0;background:transparent;color:inherit;padding:17px 17px 7px;line-height:1.5}.composer-shell textarea::placeholder{color:#70737c}.composer-tools{display:flex;align-items:center;justify-content:space-between;padding:8px}.tool-group{display:flex;align-items:center;gap:7px;min-width:0}.select-wrap{height:34px;display:flex;align-items:center;gap:6px;padding:0 9px;border:1px solid var(--line);border-radius:9px;background:rgba(255,255,255,.045);color:#aaa;transition:.16s}.select-wrap:hover{border-color:rgba(155,124,255,.4);background:rgba(155,124,255,.07)}.select-wrap select{appearance:none;border:0;outline:0;background:transparent;color:inherit;cursor:pointer;font-size:12px;max-width:180px}.select-wrap option{background:#15151a;color:#fff}.model-select select{max-width:155px}.model-note{font-size:10px;color:#666b76;white-space:nowrap}.send{width:36px;height:36px;border:0;border-radius:11px;display:grid;place-items:center;background:linear-gradient(135deg,#9b7cff,#674ed5);color:#fff;cursor:pointer;box-shadow:0 8px 25px rgba(120,90,255,.28);transition:.18s}.send:hover:not(:disabled){transform:translateY(-2px) scale(1.03)}.send:disabled{opacity:.35;cursor:not-allowed;box-shadow:none}.hint{text-align:center;color:#5e626c;font-size:10px;padding:0 0 12px}.v3-studio{display:flex;flex-direction:column}.studio-toolbar{height:58px;display:flex;align-items:center;justify-content:space-between;padding:0 14px;border-bottom:1px solid var(--line);background:rgba(12,13,17,.72);backdrop-filter:blur(18px)}.light .studio-toolbar{background:rgba(255,255,255,.7)}.segmented,.device-group{display:flex;gap:4px}.segmented button{height:34px;padding:0 12px;display:flex;align-items:center;gap:6px;color:var(--muted)}.segmented button.active,.device-group button.active{background:rgba(155,124,255,.13);border-color:rgba(155,124,255,.38);color:#c2b4ff;box-shadow:0 0 22px rgba(130,100,255,.08)}.device-group button{width:36px;height:34px;display:grid;place-items:center;color:var(--muted)}.studio-stage{flex:1;min-height:0;display:grid;place-items:center;padding:28px;overflow:hidden;background:radial-gradient(circle at 50% 35%,rgba(125,95,255,.07),transparent 45%)}.device-frame{height:100%;max-height:calc(100vh - 180px);background:#fff;border:7px solid #17181d;border-radius:18px;overflow:hidden;box-shadow:0 35px 90px rgba(0,0,0,.55);transition:width .3s ease,transform .3s ease}.device-frame.desktop{width:100%}.device-frame.tablet{width:min(768px,100%)}.device-frame.mobile{width:min(390px,100%);border-radius:28px}.device-frame iframe{width:100%;height:100%;border:0;background:#fff}.code-view{width:100%;height:100%;border:1px solid var(--line);border-radius:15px;overflow:hidden;background:#0c0d11}.file-head{height:42px;border-bottom:1px solid var(--line);display:flex;align-items:center;gap:8px;padding:0 13px;font-size:12px}.file-head span{margin-left:auto;color:#666;font-size:10px}.code-view textarea{width:100%;height:calc(100% - 42px);resize:none;border:0;outline:0;background:#0b0c10;color:#d8d9df;padding:18px;font:13px/1.65 ui-monospace,SFMono-Regular,Menlo,monospace}.activity-panel{position:absolute;right:16px;top:70px;width:270px;border:1px solid var(--line);background:rgba(13,14,18,.96);backdrop-filter:blur(20px);border-radius:14px;padding:13px;z-index:10;box-shadow:0 25px 70px rgba(0,0,0,.5);animation:pop .16s ease}.activity-panel>div{display:flex;justify-content:space-between}.activity-panel button{border:0;background:none;color:#888;cursor:pointer}.activity-panel p{font-size:11px;color:#aaa;display:flex;gap:7px;align-items:center}.activity-panel i{width:6px;height:6px;border-radius:50%;background:#9b7cff;box-shadow:0 0 10px #9b7cff}@keyframes float{50%{transform:translateY(-5px)}}@keyframes pulse{50%{opacity:.25;transform:translateY(2px)}}@keyframes pop{from{opacity:0;transform:translateY(-5px)}to{opacity:1;transform:none}}@media(max-width:980px){.v3-body{grid-template-columns:1fr}.v3-studio{min-height:50vh}.v3-chat{min-height:50vh}.v3-title{display:none}}@media(max-width:620px){.v3-brand em,.action-btn{display:none}.v3-topbar{padding:0 12px}.v3-actions{margin-left:auto}.chat-content{padding:18px}.quick-grid{grid-template-columns:1fr}.model-note{display:none}.composer-shell{margin:0 10px 8px}.tool-group{overflow:auto}.select-wrap select{max-width:130px}.studio-stage{padding:12px}}
`
document.head.appendChild(style)
