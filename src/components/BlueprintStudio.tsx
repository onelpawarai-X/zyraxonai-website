import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

type Msg = { role: 'user' | 'assistant'; content: string }
type Model = { id: string; label: string; blurb: string }

const MODELS: Model[] = [
  { id: 'deepseek-v4-flash-free', label: 'DeepSeek V4 Flash Free', blurb: 'Fast coding' },
  { id: 'mimo-v2.5-free', label: 'MiMo V2.5 Free', blurb: 'Balanced reasoning' },
  { id: 'laguna-s-2.1-free', label: 'Laguna S 2.1 Free', blurb: 'Lightweight' },
  { id: 'ling-3.0-flash-free', label: 'Ling 3.0 Flash Free', blurb: 'Fast generation' },
  { id: 'ling-3.0-tiny-free', label: 'Ling 3.0 Tiny Free', blurb: 'Ultra light' },
  { id: 'north-mini-code-free', label: 'North Mini Code Free', blurb: 'Code focused' },
  { id: 'nemotron-3-ultra-free', label: 'Nemotron 3 Ultra Free', blurb: 'Deep reasoning' },
  { id: 'longcat-2.0-free', label: 'LongCat 2.0 Free', blurb: 'Long context' },
]

const STARTER = `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>ZYRAXON Blueprint</title></head><body style="margin:0;display:grid;place-items:center;min-height:100vh;background:#070712;color:#fff;font-family:Inter,system-ui,sans-serif"><main style="max-width:560px;padding:40px;text-align:center"><div style="font-size:52px">✦</div><h1>Describe your website</h1><p style="color:#9292a8;line-height:1.7">Tell ZYRAXON what you want to build. Your live site will appear here.</p></main></body></html>`

const extractHtml = (text: string) => {
  const matches = [...text.matchAll(/```(?:html)?\s*\n([\s\S]*?)(?:```|$)/gi)]
  const last = matches.at(-1)?.[1]?.trim()
  return last && last.length > 40 ? last : null
}

const cleanAssistantText = (text: string) => text
  .replace(/```(?:html)?\s*\n[\s\S]*?(?:```|$)/gi, '\n✓ Live preview updated')
  .replace(/<\/?think(?:ing)?>/gi, '')
  .trim()

function parseGitHubRepo(value: string) {
  const input = value.trim().replace(/\.git$/, '')
  const match = input.match(/github\.com\/([^/]+)\/([^/?#]+)/i)
  return match ? match[2] : input.replace(/^\//, '').split('/').at(-1) || ''
}

async function readSse(response: Response, onText: (text: string) => void) {
  const reader = response.body?.getReader()
  if (!reader) throw new Error('The AI stream was unavailable.')
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
      const trimmed = line.trim()
      if (!trimmed || trimmed === 'data: [DONE]') continue
      const payload = trimmed.startsWith('data:') ? trimmed.slice(5).trim() : trimmed
      try {
        const json = JSON.parse(payload)
        const delta = json?.choices?.[0]?.delta?.content ?? json?.choices?.[0]?.message?.content ?? ''
        if (typeof delta === 'string' && delta) {
          full += delta
          onText(full)
        }
      } catch {
        if (!trimmed.startsWith('data:') && trimmed.length > 0) {
          full += payload
          onText(full)
        }
      }
    }
  }
  return full
}

export default function BlueprintStudio() {
  const [messages, setMessages] = useState<Msg[]>([])
  const [input, setInput] = useState('')
  const [model, setModel] = useState(MODELS[0].id)
  const [html, setHtml] = useState(STARTER)
  const [streaming, setStreaming] = useState(false)
  const [error, setError] = useState('')
  const [showModels, setShowModels] = useState(false)
  const [showDeploy, setShowDeploy] = useState(false)
  const [showSettings, setShowSettings] = useState(false)
  const [token, setToken] = useState('')
  const [repo, setRepo] = useState('')
  const [domain, setDomain] = useState('')
  const [privateRepo, setPrivateRepo] = useState(false)
  const [publishing, setPublishing] = useState(false)
  const [result, setResult] = useState<any>(null)
  const [device, setDevice] = useState<'desktop' | 'tablet' | 'mobile'>('desktop')
  const [tab, setTab] = useState<'preview' | 'code'>('preview')
  const [openChat, setOpenChat] = useState(true)
  const abortRef = useRef<AbortController | null>(null)
  const chatRef = useRef<HTMLDivElement>(null)

  const current = MODELS.find((m) => m.id === model) || MODELS[0]

  useEffect(() => {
    try {
      const savedHtml = sessionStorage.getItem('zyraxon.blueprint.html')
      const savedChat = sessionStorage.getItem('zyraxon.blueprint.chat')
      const savedModel = sessionStorage.getItem('zyraxon.blueprint.model')
      if (savedHtml) setHtml(savedHtml)
      if (savedChat) setMessages(JSON.parse(savedChat))
      if (savedModel && MODELS.some((m) => m.id === savedModel)) setModel(savedModel)
    } catch { /* storage is optional */ }
  }, [])

  useEffect(() => {
    try {
      sessionStorage.setItem('zyraxon.blueprint.html', html)
      sessionStorage.setItem('zyraxon.blueprint.chat', JSON.stringify(messages.slice(-40)))
      sessionStorage.setItem('zyraxon.blueprint.model', model)
    } catch { /* storage is optional */ }
    if (chatRef.current) chatRef.current.scrollTop = chatRef.current.scrollHeight
  }, [html, messages, model])

  const send = useCallback(async (prompt?: string) => {
    const text = (prompt ?? input).trim()
    if (!text || streaming) return
    setInput('')
    setError('')
    const next = [...messages, { role: 'user' as const, content: text }]
    setMessages(next)
    setStreaming(true)
    const controller = new AbortController()
    abortRef.current = controller
    try {
      const response = await fetch('/api/public/builder/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ model, messages: next }),
        signal: controller.signal,
      })
      if (!response.ok) {
        const data = await response.json().catch(() => null)
        throw new Error(data?.error || `AI gateway returned HTTP ${response.status}`)
      }
      let latest = ''
      await readSse(response, (text) => {
        latest = text
        setMessages([...next, { role: 'assistant', content: text }])
        const generated = extractHtml(text)
        if (generated) setHtml(generated)
      })
      if (!latest) throw new Error('The selected model returned an empty response. Try another free model.')
    } catch (e: any) {
      if (e?.name !== 'AbortError') setError(e?.message || 'Generation failed.')
    } finally {
      setStreaming(false)
      abortRef.current = null
    }
  }, [input, messages, model, streaming])

  const publish = useCallback(async () => {
    const repoName = parseGitHubRepo(repo)
    if (!token.trim() || !repoName) {
      setResult({ ok: false, error: 'Add a GitHub token and repository name or GitHub repository URL.' })
      return
    }
    setPublishing(true)
    setResult(null)
    try {
      const response = await fetch('/api/public/builder/publish', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: token.trim(), repo: repoName, html, customDomain: domain.trim() || undefined, privateRepo }),
      })
      const data = await response.json()
      setResult(data)
    } catch (e: any) {
      setResult({ ok: false, error: e?.message || 'GitHub deployment failed.' })
    } finally {
      setPublishing(false)
    }
  }, [token, repo, html, domain, privateRepo])

  const reset = () => {
    abortRef.current?.abort()
    setMessages([])
    setHtml(STARTER)
    setError('')
    setStreaming(false)
    try { sessionStorage.removeItem('zyraxon.blueprint.chat'); sessionStorage.removeItem('zyraxon.blueprint.html') } catch { /* ignore */ }
  }

  const suggestions = useMemo(() => [
    'Build a premium SaaS landing page for an AI developer tool with pricing, testimonials and FAQ.',
    'Create a modern portfolio for a software engineer with projects, skills, experience and contact form.',
    'Build an e-commerce product page with glass cards, product gallery, reviews and a responsive checkout CTA.',
  ], [])

  return (
    <div className="bp-shell">
      <div className="bp-aurora bp-a1" /><div className="bp-aurora bp-a2" /><div className="bp-grid" />

      <header className="bp-topbar glass">
        <a href="/" className="bp-brand"><span className="bp-mark">✦</span><span>ZYRAXON <b>BLUEPRINT</b></span></a>
        <div className="bp-top-actions">
          <button className="bp-pill" onClick={() => setShowModels((v) => !v)}><span className="live-dot" /> {current.label}<span>⌄</span></button>
          <button className="bp-icon-btn" onClick={() => setShowSettings((v) => !v)} title="Builder settings">⚙</button>
          <button className="bp-deploy" onClick={() => setShowDeploy(true)}>↗ Deploy</button>
        </div>
        {showModels && <div className="bp-model-menu glass">
          <div className="menu-title">FREE OPEN CODE MODELS <span>NO API KEY</span></div>
          {MODELS.map((m) => <button key={m.id} className={m.id === model ? 'model-row active' : 'model-row'} onClick={() => { setModel(m.id); setShowModels(false) }}><span className="model-orb">✦</span><span><b>{m.label}</b><small>{m.blurb}</small></span>{m.id === model && <i>✓</i>}</button>)}
          <a className="models-source" href="https://opencode.ai/docs/zen" target="_blank" rel="noreferrer">OpenCode Zen model list ↗</a>
        </div>}
      </header>

      <main className="bp-workspace">
        <section className={openChat ? 'bp-chat glass' : 'bp-chat glass collapsed'}>
          <div className="bp-panel-head"><div><span className="eyebrow">AI WEBSITE ENGINE</span><h1>Build anything.</h1></div><button className="bp-icon-btn" onClick={() => setOpenChat(!openChat)}>‹</button></div>
          {openChat && <>
            <div className="bp-chat-scroll" ref={chatRef}>
              {messages.length === 0 ? <div className="bp-empty">
                <div className="hero-orb">✦</div><h2>What are we building?</h2><p>Describe the site in plain language. ZYRAXON turns the idea into a polished responsive website and renders it live.</p>
                <div className="suggestions">{suggestions.map((s) => <button key={s} onClick={() => send(s)}>{s}<span>→</span></button>)}</div>
              </div> : messages.map((m, i) => <div key={i} className={m.role === 'user' ? 'msg user' : 'msg ai'}><div className="msg-label">{m.role === 'user' ? 'YOU' : 'ZYRAXON AI'}</div><div>{m.role === 'assistant' ? (cleanAssistantText(m.content) || 'Generating…') : m.content}</div></div>)}
              {error && <div className="bp-error"><b>Generation paused</b><span>{error}</span><button onClick={() => send(messages.filter((m) => m.role === 'user').at(-1)?.content)}>Try again</button></div>}
            </div>
            <div className="bp-composer-wrap">
              <div className="bp-composer glass-inset"><textarea value={input} rows={1} placeholder="Describe your website…" onChange={(e) => setInput(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send() } }} /><button className={streaming ? 'send stop' : 'send'} onClick={() => streaming ? abortRef.current?.abort() : send()}>{streaming ? '■' : '↑'}</button></div>
              <div className="composer-meta"><span>{current.label} · free</span><button onClick={reset}>Clear session</button></div>
            </div>
          </>}
        </section>

        <section className="bp-preview glass">
          <div className="preview-head"><div className="view-tabs"><button className={tab === 'preview' ? 'selected' : ''} onClick={() => setTab('preview')}>◉ Preview</button><button className={tab === 'code' ? 'selected' : ''} onClick={() => setTab('code')}>⌘ Code</button></div><div className="device-tabs">{(['desktop','tablet','mobile'] as const).map((d) => <button key={d} className={device === d ? 'selected' : ''} onClick={() => setDevice(d)}>{d === 'desktop' ? '▣' : d === 'tablet' ? '▥' : '▯'}</button>)}</div><div className="preview-actions"><button onClick={() => { const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([html], { type: 'text/html' })); a.download = 'index.html'; a.click() }}>↓ Export</button><button onClick={() => setShowDeploy(true)} className="accent-action">Publish</button></div></div>
          <div className="preview-stage">
            {tab === 'preview' ? <div className={`device-frame ${device}`}><iframe title="ZYRAXON live website preview" srcDoc={html} sandbox="allow-scripts allow-forms allow-popups allow-modals" /></div> : <pre>{html}</pre>}
          </div>
        </section>
      </main>

      {showSettings && <div className="bp-popover glass settings-pop"><div className="menu-title">BUILDER SETTINGS</div><p>Free OpenCode models are selected by default. Your GitHub token is only used when you explicitly publish.</p><button onClick={() => { setShowSettings(false); setShowDeploy(true) }}>Open GitHub publishing</button></div>}

      {showDeploy && <div className="bp-overlay" onClick={() => setShowDeploy(false)}><div className="deploy-card glass" onClick={(e) => e.stopPropagation()}><div className="deploy-head"><div><span className="eyebrow">GITHUB DELIVERY</span><h2>Publish your website</h2><p>Generate → preview → create/update a repository → publish to GitHub Pages.</p></div><button className="bp-icon-btn" onClick={() => setShowDeploy(false)}>×</button></div>
        <label>GitHub Personal Access Token<input type="password" value={token} onChange={(e) => setToken(e.target.value)} placeholder="ghp_…" autoComplete="off" /></label>
        <label>Repository name or GitHub URL<input value={repo} onChange={(e) => setRepo(e.target.value)} placeholder="my-site or https://github.com/you/my-site" /></label>
        <div className="deploy-grid"><label>Custom domain <small>optional</small><input value={domain} onChange={(e) => setDomain(e.target.value)} placeholder="www.example.com" /></label><label>Visibility<select value={privateRepo ? 'private' : 'public'} onChange={(e) => setPrivateRepo(e.target.value === 'private')}><option value="public">Public</option><option value="private">Private</option></select></label></div>
        <div className="token-note">🔒 Token is kept in this browser session and sent only to the deployment endpoint. It is not included in AI prompts.</div>
        <div className="deploy-actions"><a href="https://github.com/settings/personal-access-tokens" target="_blank" rel="noreferrer">GitHub token settings ↗</a><button className="bp-deploy large" disabled={publishing} onClick={publish}>{publishing ? 'Publishing…' : 'Create & Publish →'}</button></div>
        {result && <div className={result.ok ? 'deploy-result ok' : 'deploy-result bad'}>{result.ok ? <><b>✓ Published successfully</b><a href={result.pagesUrl} target="_blank" rel="noreferrer">Open live site ↗</a><a href={result.repoUrl} target="_blank" rel="noreferrer">Open repository ↗</a>{result.note && <small>{result.note}</small>}</> : <><b>Publish failed</b><span>{result.error}</span></>}</div>}
      </div></div>}

      <style>{`
        *{box-sizing:border-box}body{margin:0}.bp-shell{height:100vh;min-height:680px;overflow:hidden;background:#05050b;color:#f5f5f7;font-family:Inter,ui-sans-serif,system-ui,-apple-system,sans-serif;position:relative}.glass{background:linear-gradient(145deg,rgba(255,255,255,.075),rgba(255,255,255,.025));border:1px solid rgba(255,255,255,.1);box-shadow:0 24px 80px rgba(0,0,0,.32),inset 0 1px 0 rgba(255,255,255,.06);backdrop-filter:blur(28px) saturate(150%);-webkit-backdrop-filter:blur(28px) saturate(150%)}.glass-inset{background:rgba(7,7,15,.72);border:1px solid rgba(255,255,255,.1);box-shadow:inset 0 1px 0 rgba(255,255,255,.04),0 12px 40px rgba(0,0,0,.2);backdrop-filter:blur(24px)}.bp-aurora{position:fixed;width:45vw;height:45vw;border-radius:50%;filter:blur(100px);opacity:.16;pointer-events:none}.bp-a1{background:#7c3aed;top:-28%;left:-14%}.bp-a2{background:#06b6d4;right:-15%;bottom:-25%}.bp-grid{position:fixed;inset:0;pointer-events:none;opacity:.24;background-image:linear-gradient(rgba(255,255,255,.035) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,.035) 1px,transparent 1px);background-size:52px 52px;mask-image:linear-gradient(to bottom,#000,transparent 85%)}.bp-topbar{height:62px;margin:12px 12px 0;border-radius:18px;display:flex;align-items:center;padding:0 14px 0 18px;position:relative;z-index:10}.bp-brand{display:flex;align-items:center;gap:10px;color:#eee;text-decoration:none;font-size:13px;letter-spacing:.02em}.bp-brand b{color:#9d8cff}.bp-mark{width:30px;height:30px;border-radius:10px;display:grid;place-items:center;background:linear-gradient(135deg,#06d5ff,#7c3aed 65%,#ec4899);box-shadow:0 0 28px rgba(124,58,237,.4)}.bp-top-actions{margin-left:auto;display:flex;align-items:center;gap:8px}.bp-pill,.bp-icon-btn,.bp-deploy{font:inherit;color:#d8d8e2;border:1px solid rgba(255,255,255,.09);background:rgba(255,255,255,.045);border-radius:11px;padding:9px 12px;cursor:pointer}.bp-pill{display:flex;gap:8px;align-items:center}.bp-pill:hover,.bp-icon-btn:hover{background:rgba(255,255,255,.08)}.bp-icon-btn{width:38px;height:38px;padding:0}.bp-deploy{background:linear-gradient(135deg,#06b6d4,#7c3aed 70%,#ec4899);border:0;color:#fff;font-weight:800;box-shadow:0 10px 30px rgba(124,58,237,.3)}.bp-deploy.large{padding:13px 18px}.live-dot{width:7px;height:7px;border-radius:50%;background:#4ade80;box-shadow:0 0 12px #4ade80}.bp-model-menu,.bp-popover{position:absolute;right:130px;top:58px;width:330px;border-radius:18px;padding:10px;z-index:20}.menu-title{font-size:10px;letter-spacing:.12em;color:#7f8098;padding:9px 10px}.menu-title span{color:#4ade80;float:right}.model-row{width:100%;display:flex;align-items:center;gap:10px;text-align:left;background:transparent;border:0;border-radius:12px;padding:10px;cursor:pointer;color:#eee}.model-row:hover,.model-row.active{background:rgba(124,58,237,.11)}.model-row>span:nth-child(2){flex:1}.model-row small{display:block;color:#77798e;margin-top:2px}.model-row i{color:#4ade80;font-style:normal}.model-orb{width:28px;height:28px;border-radius:9px;display:grid;place-items:center;background:rgba(6,182,212,.1);color:#67e8f9}.models-source{display:block;padding:10px;color:#8f8fa6;font-size:11px;text-decoration:none}.bp-workspace{height:calc(100vh - 86px);padding:12px;display:flex;gap:12px;position:relative;z-index:2}.bp-chat{width:410px;min-width:330px;border-radius:22px;display:flex;flex-direction:column;overflow:hidden}.bp-chat.collapsed{width:58px;min-width:58px}.bp-panel-head{display:flex;align-items:center;justify-content:space-between;padding:20px 18px 12px;border-bottom:1px solid rgba(255,255,255,.06)}.eyebrow{font-size:9px;letter-spacing:.16em;color:#8b8ba3;font-weight:800}.bp-panel-head h1{margin:4px 0 0;font-size:20px;letter-spacing:-.04em}.bp-chat-scroll{flex:1;overflow:auto;padding:16px}.bp-empty{height:100%;display:flex;flex-direction:column;justify-content:center}.hero-orb{width:62px;height:62px;border-radius:20px;display:grid;place-items:center;background:linear-gradient(145deg,rgba(6,182,212,.18),rgba(124,58,237,.2));border:1px solid rgba(255,255,255,.1);font-size:28px;color:#c4b5fd;box-shadow:0 0 60px rgba(124,58,237,.18);margin-bottom:18px}.bp-empty h2{font-size:23px;margin:0 0 8px;letter-spacing:-.04em}.bp-empty p{font-size:13px;line-height:1.7;color:#85869c;margin:0 0 20px}.suggestions{display:grid;gap:8px}.suggestions button{color:#a9a9ba;text-align:left;padding:12px;border-radius:13px;border:1px solid rgba(255,255,255,.07);background:rgba(255,255,255,.025);cursor:pointer;line-height:1.5}.suggestions button:hover{border-color:rgba(124,58,237,.35);background:rgba(124,58,237,.08);color:#ddd}.suggestions span{float:right;color:#8b5cf6}.msg{margin-bottom:12px;max-width:94%;padding:11px 13px;border-radius:15px;font-size:12.5px;line-height:1.65;white-space:pre-wrap;word-break:break-word}.msg.user{margin-left:auto;background:linear-gradient(135deg,rgba(124,58,237,.2),rgba(6,182,212,.08));border:1px solid rgba(124,58,237,.2)}.msg.ai{background:rgba(255,255,255,.035);border:1px solid rgba(255,255,255,.06)}.msg-label{font-size:8px;letter-spacing:.12em;color:#7e8098;margin-bottom:5px;font-weight:800}.bp-error{padding:12px;border-radius:13px;background:rgba(239,68,68,.08);border:1px solid rgba(239,68,68,.2);display:grid;gap:5px;font-size:12px}.bp-error span{color:#fca5a5}.bp-error button{justify-self:start;border:0;border-radius:8px;padding:6px 9px;background:rgba(255,255,255,.08);color:#fff;cursor:pointer}.bp-composer-wrap{padding:12px;border-top:1px solid rgba(255,255,255,.06)}.bp-composer{display:flex;gap:8px;align-items:flex-end;border-radius:15px;padding:9px}.bp-composer textarea{flex:1;min-height:42px;max-height:150px;resize:none;background:transparent;border:0;outline:0;color:#eee;font:inherit;font-size:13px;line-height:1.5}.bp-composer textarea::placeholder{color:#64657a}.send{width:38px;height:38px;border:0;border-radius:11px;background:linear-gradient(135deg,#06b6d4,#7c3aed);color:#fff;font-size:17px;cursor:pointer}.send.stop{background:#ef4444}.composer-meta{display:flex;justify-content:space-between;padding:7px 2px 0;color:#626379;font-size:10px}.composer-meta button{background:transparent;border:0;color:#696a80;cursor:pointer}.bp-preview{flex:1;min-width:0;border-radius:22px;display:flex;flex-direction:column;overflow:hidden}.preview-head{height:54px;display:flex;align-items:center;gap:10px;padding:0 12px;border-bottom:1px solid rgba(255,255,255,.06)}.view-tabs,.device-tabs{display:flex;gap:3px;padding:3px;border-radius:10px;background:rgba(255,255,255,.035)}.view-tabs button,.device-tabs button,.preview-actions button{border:0;background:transparent;color:#77788d;border-radius:8px;padding:7px 10px;cursor:pointer;font:inherit;font-size:11px}.view-tabs button.selected,.device-tabs button.selected{background:rgba(124,58,237,.16);color:#ddd}.preview-actions{margin-left:auto;display:flex;gap:6px}.preview-actions .accent-action{background:rgba(124,58,237,.16);color:#c4b5fd}.preview-stage{flex:1;overflow:auto;display:grid;place-items:center;padding:12px;background:radial-gradient(circle at 50% 10%,rgba(124,58,237,.07),transparent 45%),#07070d}.device-frame{width:100%;height:100%;overflow:hidden;border-radius:14px;box-shadow:0 30px 80px rgba(0,0,0,.4);background:#fff}.device-frame.tablet{width:min(834px,100%);height:calc(100% - 10px);border:1px solid rgba(255,255,255,.1)}.device-frame.mobile{width:min(390px,100%);height:calc(100% - 10px);border:1px solid rgba(255,255,255,.1)}.device-frame iframe{width:100%;height:100%;border:0;background:#fff}.preview-stage pre{margin:0;width:100%;height:100%;overflow:auto;padding:24px;color:#b8b8c8;font:12px/1.7 ui-monospace,SFMono-Regular,Consolas,monospace;white-space:pre-wrap}.bp-popover{right:70px;width:290px;padding:16px;color:#9b9caf;font-size:12px;line-height:1.6}.bp-popover p{margin:5px 0 14px}.bp-popover button{width:100%;border:0;border-radius:10px;padding:9px;background:linear-gradient(135deg,#06b6d4,#7c3aed);color:#fff;font-weight:700;cursor:pointer}.bp-overlay{position:fixed;inset:0;z-index:100;background:rgba(0,0,0,.72);backdrop-filter:blur(14px);display:grid;place-items:center;padding:18px}.deploy-card{width:min(640px,100%);border-radius:24px;padding:24px}.deploy-head{display:flex;justify-content:space-between;gap:20px;margin-bottom:20px}.deploy-head h2{margin:5px 0 4px;font-size:24px;letter-spacing:-.04em}.deploy-head p{margin:0;color:#7f8097;font-size:12px;line-height:1.6}.deploy-card label{display:block;color:#a3a4b7;font-size:11px;margin:0 0 14px}.deploy-card label small{color:#66687b}.deploy-card input,.deploy-card select{width:100%;margin-top:6px;padding:12px;border-radius:11px;border:1px solid rgba(255,255,255,.09);background:rgba(0,0,0,.22);color:#eee;outline:0;font:inherit}.deploy-card input:focus,.deploy-card select:focus{border-color:rgba(124,58,237,.6)}.deploy-grid{display:grid;grid-template-columns:1fr 150px;gap:12px}.token-note{padding:11px;border-radius:12px;background:rgba(34,197,94,.06);border:1px solid rgba(34,197,94,.13);color:#7fb99b;font-size:11px;line-height:1.5;margin:3px 0 18px}.deploy-actions{display:flex;align-items:center;justify-content:space-between;gap:12px}.deploy-actions a{color:#8b8ca3;font-size:11px}.deploy-result{margin-top:16px;padding:14px;border-radius:13px;display:grid;gap:6px;font-size:12px}.deploy-result.ok{background:rgba(34,197,94,.06);border:1px solid rgba(34,197,94,.2);color:#86efac}.deploy-result.bad{background:rgba(239,68,68,.06);border:1px solid rgba(239,68,68,.2);color:#fca5a5}.deploy-result a{color:#c4b5fd}.deploy-result small{color:#7f8097}@media(max-width:900px){.bp-workspace{padding:8px}.bp-chat{width:360px}.bp-topbar{margin:8px 8px 0}.bp-workspace{height:calc(100vh - 78px)}}@media(max-width:720px){.bp-workspace{display:block;overflow:auto}.bp-chat,.bp-preview{width:100%;min-width:0;height:calc(100vh - 94px)}.bp-chat{display:none}.bp-preview{height:calc(100vh - 94px)}.bp-top-actions .bp-icon-btn{display:none}.bp-brand span:last-child{display:none}.device-frame{min-height:600px}.deploy-grid{grid-template-columns:1fr}.preview-head{flex-wrap:wrap;height:auto;padding:8px}.device-tabs{display:none}.preview-actions{margin-left:auto}.bp-model-menu{right:10px}}
      `}</style>
    </div>
  )
}
