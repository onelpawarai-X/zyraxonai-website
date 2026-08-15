import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

type Msg = { role: 'user' | 'assistant'; content: string }
type Model = { id: string; label: string; blurb: string }
type Device = 'desktop' | 'tablet' | 'mobile'

type PublishResult = {
  ok: boolean
  error?: string
  repoUrl?: string
  pagesUrl?: string
  note?: string
}

const MODELS: Model[] = [
  { id: 'big-pickle', label: 'Big Pickle', blurb: 'Stealth builder · Free' },
  { id: 'deepseek-v4-flash-free', label: 'DeepSeek V4 Flash Free', blurb: 'Fast coding · Free' },
  { id: 'mimo-v2.5-free', label: 'MiMo V2.5 Free', blurb: 'Balanced reasoning · Free' },
  { id: 'laguna-s-2.1-free', label: 'Laguna S 2.1 Free', blurb: 'General builder · Free' },
  { id: 'ling-3.0-flash-free', label: 'Ling 3.0 Flash Free', blurb: 'Fast generation · Free' },
  { id: 'north-mini-code-free', label: 'North Mini Code Free', blurb: 'Code focused · Free' },
  { id: 'nemotron-3-ultra-free', label: 'Nemotron 3 Ultra Free', blurb: 'Deep reasoning · Free' },
]

const STARTER = `<!doctype html>\n<html>\n<head>\n  <meta charset="utf-8" />\n  <meta name="viewport" content="width=device-width, initial-scale=1" />\n  <title>ZYRAXON Blueprint</title>\n  <style>\n    body { margin: 0; min-height: 100vh; display: grid; place-items: center; background: #070812; color: white; font-family: Inter, system-ui, sans-serif; }\n    main { max-width: 680px; padding: 48px; text-align: center; }\n  </style>\n</head>\n<body>\n  <main><h1>Describe your website</h1><p>Your AI-built website will appear here.</p></main>\n</body>\n</html>`

function extractHtml(text: string) {
  const matches = [...text.matchAll(/```(?:html)?\s*\n([\s\S]*?)(?:```|$)/gi)]
  const html = matches.at(-1)?.[1]?.trim()
  return html && html.length > 40 ? html : null
}

function stripCode(text: string) {
  return text
    .replace(/```(?:html)?\s*\n[\s\S]*?(?:```|$)/gi, '\n✓ Live preview updated')
    .replace(/<\/?think(?:ing)?>/gi, '')
    .trim()
}

function parseRepo(value: string) {
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
        // Ignore incomplete SSE frames; the next frame will complete them.
      }
    }
  }
  return full
}

function splitVirtualFiles(html: string) {
  const style = html.match(/<style[^>]*>([\s\S]*?)<\/style>/i)?.[1]?.trim() || '/* No style block yet */'
  const script = html.match(/<script[^>]*>([\s\S]*?)<\/script>/i)?.[1]?.trim() || '// No script block yet'
  return [
    { name: 'index.html', kind: 'html', content: html },
    { name: 'styles.css', kind: 'css', content: style },
    { name: 'script.js', kind: 'js', content: script },
  ]
}

function escapeHtml(value: string) {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

function highlightCode(value: string, kind: string) {
  let out = escapeHtml(value)
  out = out.replace(/(&lt;\/?)([a-zA-Z0-9-]+)/g, '$1<span class="tok-tag">$2</span>')
  out = out.replace(/([a-zA-Z-]+)(=)(&quot;[^&]*?&quot;)/g, '<span class="tok-attr">$1</span>$2<span class="tok-str">$3</span>')
  out = out.replace(/(#[0-9a-fA-F]{3,8})/g, '<span class="tok-num">$1</span>')
  if (kind === 'css') out = out.replace(/([a-z-]+)(\s*:)/g, '<span class="tok-prop">$1</span>$2')
  if (kind === 'js') out = out.replace(/\b(const|let|var|function|return|if|else|async|await|new)\b/g, '<span class="tok-key">$1</span>')
  return out
}

export default function BlueprintStudioPro() {
  const [messages, setMessages] = useState<Msg[]>([])
  const [input, setInput] = useState('')
  const [model, setModel] = useState(MODELS[0].id)
  const [apiKey, setApiKey] = useState('')
  const [html, setHtml] = useState(STARTER)
  const [streaming, setStreaming] = useState(false)
  const [error, setError] = useState('')
  const [showModels, setShowModels] = useState(false)
  const [showDeploy, setShowDeploy] = useState(false)
  const [showSettings, setShowSettings] = useState(false)
  const [mode, setMode] = useState<'build' | 'code'>('build')
  const [device, setDevice] = useState<Device>('desktop')
  const [selectedFile, setSelectedFile] = useState('index.html')
  const [token, setToken] = useState('')
  const [repo, setRepo] = useState('')
  const [domain, setDomain] = useState('')
  const [privateRepo, setPrivateRepo] = useState(false)
  const [publishing, setPublishing] = useState(false)
  const [result, setResult] = useState<PublishResult | null>(null)
  const [showKey, setShowKey] = useState(false)
  const abortRef = useRef<AbortController | null>(null)
  const chatRef = useRef<HTMLDivElement>(null)

  const current = MODELS.find((item) => item.id === model) || MODELS[0]
  const files = useMemo(() => splitVirtualFiles(html), [html])
  const selected = files.find((file) => file.name === selectedFile) || files[0]

  useEffect(() => {
    try {
      const savedHtml = sessionStorage.getItem('zyraxon.blueprint.html')
      const savedChat = sessionStorage.getItem('zyraxon.blueprint.chat')
      const savedModel = sessionStorage.getItem('zyraxon.blueprint.model')
      if (savedHtml) setHtml(savedHtml)
      if (savedChat) setMessages(JSON.parse(savedChat))
      if (savedModel && MODELS.some((item) => item.id === savedModel)) setModel(savedModel)
    } catch { /* optional storage */ }
  }, [])

  useEffect(() => {
    try {
      sessionStorage.setItem('zyraxon.blueprint.html', html)
      sessionStorage.setItem('zyraxon.blueprint.chat', JSON.stringify(messages.slice(-40)))
      sessionStorage.setItem('zyraxon.blueprint.model', model)
    } catch { /* optional storage */ }
    if (chatRef.current) chatRef.current.scrollTop = chatRef.current.scrollHeight
  }, [html, messages, model])

  const send = useCallback(async (prompt?: string) => {
    const text = (prompt ?? input).trim()
    if (!text || streaming) return
    if (!apiKey.trim()) {
      setError('OpenCode Zen requires authentication. Add your OpenCode Zen API key in Settings, then try again.')
      setShowSettings(true)
      return
    }
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
        body: JSON.stringify({ model, apiKey: apiKey.trim(), messages: next }),
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
  }, [apiKey, input, messages, model, streaming])

  const publish = useCallback(async () => {
    const repoName = parseRepo(repo)
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

  const suggestions = [
    'Build a premium SaaS landing page for an AI developer tool with pricing, testimonials and FAQ.',
    'Create a modern portfolio for a software engineer with projects, skills, experience and contact form.',
    'Build an e-commerce product page with glass cards, product gallery, reviews and a responsive checkout CTA.',
  ]

  return (
    <div className="bp-pro">
      <div className="bp-pro-aurora aurora-one" /><div className="bp-pro-aurora aurora-two" /><div className="bp-pro-grid" />
      <header className="bp-pro-top glass-pro">
        <a href="/" className="bp-pro-brand"><span className="bp-pro-logo">✦</span><span>ZYRAXON <b>BLUEPRINT</b></span></a>
        <div className="mode-switch glass-inset-pro">
          <button className={mode === 'build' ? 'active' : ''} onClick={() => setMode('build')}>✦ Build</button>
          <button className={mode === 'code' ? 'active' : ''} onClick={() => setMode('code')}>⌘ Code</button>
        </div>
        <div className="bp-pro-actions">
          <button className="model-button" onClick={() => setShowModels((value) => !value)}><span className="status-dot" />{current.label}<span>⌄</span></button>
          <button className="round-button" onClick={() => setShowSettings((value) => !value)}>⚙</button>
          <button className="publish-button" onClick={() => setShowDeploy(true)}>Publish ↗</button>
        </div>
        {showModels && <div className="model-pop glass-pro"><div className="pop-title">OPENCODE ZEN · FREE TIER</div><p className="pop-note">Free models are currently time-limited. OpenCode Zen authentication is required.</p>{MODELS.map((item) => <button key={item.id} className={item.id === model ? 'model-item active' : 'model-item'} onClick={() => { setModel(item.id); setShowModels(false) }}><span className="model-icon">✦</span><span><b>{item.label}</b><small>{item.blurb}</small></span>{item.id === model && <i>✓</i>}</button>)}<a href="https://opencode.ai/docs/zen" target="_blank" rel="noreferrer">OpenCode Zen docs ↗</a></div>}
      </header>

      {mode === 'build' ? <main className="builder-grid">
        <aside className="chat-panel glass-pro">
          <div className="panel-title"><div><span>AI WEBSITE ENGINE</span><h1>Build anything.</h1></div><span className="online-badge">● ONLINE</span></div>
          <div className="chat-scroll" ref={chatRef}>
            {messages.length === 0 ? <div className="empty-chat"><div className="hero-logo">✦</div><h2>What are we building?</h2><p>Describe the product, page, style or interaction. The selected OpenCode model will generate the full site and render it live.</p><div className="suggestions">{suggestions.map((item) => <button key={item} onClick={() => send(item)}>{item}<span>→</span></button>)}</div></div> : messages.map((item, index) => <div key={index} className={item.role === 'user' ? 'chat-message user-message' : 'chat-message ai-message'}><label>{item.role === 'user' ? 'YOU' : 'ZYRAXON AI'}</label><div>{item.role === 'assistant' ? (stripCode(item.content) || 'Generating…') : item.content}</div></div>)}
            {error && <div className="error-box"><b>Generation paused</b><span>{error}</span><button onClick={() => send(messages.filter((item) => item.role === 'user').at(-1)?.content)}>Try again</button></div>}
          </div>
          <div className="composer-area"><div className="composer glass-inset-pro"><textarea value={input} placeholder="Describe your website…" rows={1} onChange={(event) => setInput(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter' && !event.shiftKey) { event.preventDefault(); send() } }} /><button className={streaming ? 'send-button stop' : 'send-button'} onClick={() => streaming ? abortRef.current?.abort() : send()}>{streaming ? '■' : '↑'}</button></div><div className="composer-meta"><span>{current.label} · {apiKey ? 'authenticated' : 'key required'}</span><button onClick={reset}>Clear</button></div></div>
        </aside>

        <section className="preview-panel glass-pro">
          <div className="preview-toolbar"><div className="toolbar-group"><span className="live-label"><i /> LIVE</span><button className={device === 'desktop' ? 'tool-active' : ''} onClick={() => setDevice('desktop')}>▣ Desktop</button><button className={device === 'tablet' ? 'tool-active' : ''} onClick={() => setDevice('tablet')}>▥ Tablet</button><button className={device === 'mobile' ? 'tool-active' : ''} onClick={() => setDevice('mobile')}>▯ Mobile</button></div><div className="toolbar-group right"><button onClick={() => { const link = document.createElement('a'); link.href = URL.createObjectURL(new Blob([html], { type: 'text/html' })); link.download = 'index.html'; link.click() }}>↓ Export</button><button className="accent-tool" onClick={() => setMode('code')}>⌘ Open Code</button><button className="accent-tool" onClick={() => setShowDeploy(true)}>Publish</button></div></div>
          <div className="preview-canvas"><div className={`device-shell ${device}`}><div className="browser-bar"><span /><span /><span /><em>localhost · ZYRAXON Live Preview</em></div><iframe title="Live generated website" srcDoc={html} sandbox="allow-scripts allow-forms allow-popups allow-modals" /></div></div>
        </section>
      </main> : <main className="code-workspace glass-pro">
        <aside className="file-sidebar"><div className="file-head"><span>EXPLORER</span><small>3 files</small></div>{files.map((file) => <button key={file.name} className={file.name === selected.name ? 'file-row active' : 'file-row'} onClick={() => setSelectedFile(file.name)}><span className={`file-dot ${file.kind}`}>{file.kind === 'html' ? '◇' : file.kind === 'css' ? '#' : 'JS'}</span>{file.name}</button>)}<div className="tree-note">Generated as a single deployable site. Virtual files are extracted from the generated HTML for inspection.</div></aside>
        <section className="editor-area"><div className="editor-top"><div className="editor-tab"><span className={`file-dot ${selected.kind}`}>{selected.kind === 'html' ? '◇' : selected.kind === 'css' ? '#' : 'JS'}</span>{selected.name}</div><span className="read-only">AI OUTPUT · READ ONLY</span></div><div className="editor-body"><div className="line-numbers">{selected.content.split('\n').map((_, index) => <span key={index}>{index + 1}</span>)}</div><pre className="code-highlight" dangerouslySetInnerHTML={{ __html: highlightCode(selected.content, selected.kind) }} /><textarea className="code-ghost" value={selected.content} readOnly aria-label={`${selected.name} source`} /></div></section>
      </main>}

      {showSettings && <div className="overlay" onClick={() => setShowSettings(false)}><div className="settings-card glass-pro" onClick={(event) => event.stopPropagation()}><div className="modal-head"><div><span>AI PROVIDER</span><h2>OpenCode Zen</h2><p>The current free Zen models are free for a limited time, but OpenCode requires Zen authentication.</p></div><button className="round-button" onClick={() => setShowSettings(false)}>×</button></div><label>OpenCode Zen API key<div className="secret-input"><input type={showKey ? 'text' : 'password'} value={apiKey} onChange={(event) => setApiKey(event.target.value)} placeholder="Paste your OpenCode Zen key" autoComplete="off" /><button onClick={() => setShowKey((value) => !value)}>{showKey ? 'Hide' : 'Show'}</button></div></label><div className="security-note">Your key is kept only in this browser session and sent to the builder request. It is never inserted into generated websites or prompts.</div><div className="modal-actions"><a href="https://opencode.ai/auth" target="_blank" rel="noreferrer">Get / manage Zen key ↗</a><button className="publish-button" onClick={() => setShowSettings(false)}>Save in session</button></div></div></div>}

      {showDeploy && <div className="overlay" onClick={() => setShowDeploy(false)}><div className="deploy-modal glass-pro" onClick={(event) => event.stopPropagation()}><div className="modal-head"><div><span>GITHUB DELIVERY</span><h2>Publish your finished site</h2><p>ZYRAXON creates or updates the repository using your token, writes the generated site, and enables GitHub Pages.</p></div><button className="round-button" onClick={() => setShowDeploy(false)}>×</button></div><label>GitHub Personal Access Token<input type="password" value={token} onChange={(event) => setToken(event.target.value)} placeholder="ghp_…" autoComplete="off" /></label><label>Repository name or GitHub URL<input value={repo} onChange={(event) => setRepo(event.target.value)} placeholder="my-site or https://github.com/you/my-site" /></label><div className="two-col"><label>Custom domain <small>optional</small><input value={domain} onChange={(event) => setDomain(event.target.value)} placeholder="www.example.com" /></label><label className="check-label"><input type="checkbox" checked={privateRepo} onChange={(event) => setPrivateRepo(event.target.checked)} /> Private repository</label></div><div className="security-note">🔒 GitHub token is used only for this publish request. It is not sent to the AI model and is not embedded in your website.</div><div className="modal-actions"><a href="https://github.com/settings/personal-tokens" target="_blank" rel="noreferrer">GitHub token settings ↗</a><button className="publish-button" disabled={publishing} onClick={publish}>{publishing ? 'Publishing…' : 'Create & Publish →'}</button></div>{result && <div className={result.ok ? 'result success' : 'result failure'}>{result.ok ? <><b>✓ Published successfully</b><a href={result.pagesUrl} target="_blank" rel="noreferrer">Open live site ↗</a><a href={result.repoUrl} target="_blank" rel="noreferrer">Open repository ↗</a><small>{result.note}</small></> : <><b>Publish failed</b><span>{result.error}</span></>}</div>}</div></div>}

      <style>{`
        *{box-sizing:border-box}body{margin:0}.bp-pro{height:100vh;min-height:680px;overflow:hidden;background:#05060b;color:#f5f7ff;font-family:Inter,ui-sans-serif,system-ui,-apple-system,sans-serif;position:relative}.glass-pro{background:linear-gradient(145deg,rgba(255,255,255,.085),rgba(255,255,255,.025));border:1px solid rgba(255,255,255,.1);box-shadow:0 24px 90px rgba(0,0,0,.38),inset 0 1px 0 rgba(255,255,255,.07);backdrop-filter:blur(30px) saturate(160%);-webkit-backdrop-filter:blur(30px) saturate(160%)}.glass-inset-pro{background:rgba(7,8,17,.72);border:1px solid rgba(255,255,255,.09);box-shadow:inset 0 1px 0 rgba(255,255,255,.04);backdrop-filter:blur(22px)}.bp-pro-aurora{position:fixed;width:48vw;height:48vw;border-radius:50%;filter:blur(110px);opacity:.15;pointer-events:none}.aurora-one{background:#7c3aed;left:-18%;top:-24%}.aurora-two{background:#06b6d4;right:-16%;bottom:-25%}.bp-pro-grid{position:fixed;inset:0;opacity:.18;pointer-events:none;background-image:linear-gradient(rgba(255,255,255,.04) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,.04) 1px,transparent 1px);background-size:52px 52px;mask-image:linear-gradient(#000,transparent 90%)}.bp-pro-top{height:64px;margin:10px 12px 0;border-radius:18px;padding:0 14px 0 18px;display:flex;align-items:center;position:relative;z-index:20}.bp-pro-brand{display:flex;align-items:center;gap:10px;text-decoration:none;color:#f3f4f8;font-size:13px}.bp-pro-brand b{color:#b8a6ff}.bp-pro-logo{width:31px;height:31px;border-radius:10px;display:grid;place-items:center;background:linear-gradient(135deg,#06d5ff,#7c3aed 65%,#ec4899);box-shadow:0 0 32px rgba(124,58,237,.45)}.mode-switch{margin-left:28px;padding:3px;border-radius:11px;display:flex;gap:2px}.mode-switch button{border:0;background:transparent;color:#77798e;border-radius:8px;padding:7px 13px;cursor:pointer}.mode-switch button.active{color:#fff;background:rgba(255,255,255,.09);box-shadow:0 5px 18px rgba(0,0,0,.2)}.bp-pro-actions{margin-left:auto;display:flex;gap:7px;align-items:center}.model-button,.round-button,.publish-button{font:inherit;color:#e2e3eb;border:1px solid rgba(255,255,255,.09);background:rgba(255,255,255,.045);border-radius:11px;padding:9px 12px;cursor:pointer}.model-button{display:flex;align-items:center;gap:8px}.round-button{width:38px;height:38px;padding:0}.publish-button{background:linear-gradient(135deg,#06b6d4,#7c3aed 68%,#ec4899);border:0;color:#fff;font-weight:800;box-shadow:0 10px 30px rgba(124,58,237,.25)}.publish-button:disabled{opacity:.55;cursor:wait}.status-dot,.online-badge i{width:7px;height:7px;border-radius:50%;display:inline-block;background:#4ade80;box-shadow:0 0 12px #4ade80}.model-pop{position:absolute;right:150px;top:58px;width:360px;border-radius:18px;padding:10px;z-index:30}.pop-title,.file-head span,.panel-title>div>span,.modal-head>div>span{font-size:9px;letter-spacing:.16em;color:#7f8197;font-weight:800}.pop-note{margin:4px 10px 8px;color:#777a90;font-size:10px;line-height:1.5}.model-item{width:100%;display:flex;align-items:center;gap:10px;border:0;background:transparent;color:#eee;text-align:left;padding:10px;border-radius:11px;cursor:pointer}.model-item:hover,.model-item.active{background:rgba(124,58,237,.12)}.model-item>span:nth-child(2){flex:1}.model-item small{display:block;color:#77798d;margin-top:2px}.model-item i{color:#4ade80;font-style:normal}.model-icon{width:29px;height:29px;border-radius:9px;display:grid;place-items:center;color:#67e8f9;background:rgba(6,182,212,.1)}.model-pop>a{display:block;color:#a7a0ff;text-decoration:none;font-size:10px;padding:10px}.builder-grid{height:calc(100vh - 86px);padding:12px;display:grid;grid-template-columns:410px 1fr;gap:12px;position:relative;z-index:2}.chat-panel,.preview-panel,.code-workspace{border-radius:22px;overflow:hidden}.chat-panel{display:flex;flex-direction:column;min-width:0}.panel-title{display:flex;justify-content:space-between;align-items:flex-start;padding:19px 18px 13px;border-bottom:1px solid rgba(255,255,255,.06)}.panel-title h1{font-size:20px;letter-spacing:-.04em;margin:4px 0 0}.online-badge{font-size:8px;letter-spacing:.12em;color:#7ce6a4;padding-top:5px}.chat-scroll{flex:1;overflow:auto;padding:16px}.empty-chat{height:100%;display:flex;flex-direction:column;justify-content:center}.hero-logo{width:62px;height:62px;border-radius:20px;display:grid;place-items:center;font-size:28px;color:#d2c6ff;background:linear-gradient(145deg,rgba(6,182,212,.16),rgba(124,58,237,.2));border:1px solid rgba(255,255,255,.1);box-shadow:0 0 65px rgba(124,58,237,.2);margin-bottom:17px}.empty-chat h2{font-size:23px;letter-spacing:-.04em;margin:0 0 7px}.empty-chat p{font-size:12.5px;line-height:1.7;color:#85879c;margin:0 0 18px}.suggestions{display:grid;gap:8px}.suggestions button{border:1px solid rgba(255,255,255,.07);background:rgba(255,255,255,.025);color:#aaaabd;text-align:left;padding:11px 12px;border-radius:12px;cursor:pointer;line-height:1.5}.suggestions button:hover{background:rgba(124,58,237,.08);border-color:rgba(124,58,237,.32);color:#eee}.suggestions span{float:right;color:#a78bfa}.chat-message{margin-bottom:12px;max-width:95%;padding:11px 13px;border-radius:14px;font-size:12.5px;line-height:1.65;white-space:pre-wrap;word-break:break-word}.chat-message label{display:block;font-size:8px;letter-spacing:.13em;color:#777a90;margin-bottom:4px;font-weight:800}.user-message{margin-left:auto;background:linear-gradient(135deg,rgba(124,58,237,.2),rgba(6,182,212,.07));border:1px solid rgba(124,58,237,.2)}.ai-message{background:rgba(255,255,255,.035);border:1px solid rgba(255,255,255,.06)}.error-box{display:grid;gap:6px;padding:12px;border-radius:12px;background:rgba(239,68,68,.07);border:1px solid rgba(239,68,68,.2);font-size:11px}.error-box span{color:#fca5a5}.error-box button{justify-self:start;border:0;border-radius:8px;background:rgba(255,255,255,.08);color:#fff;padding:6px 9px;cursor:pointer}.composer-area{padding:11px;border-top:1px solid rgba(255,255,255,.06)}.composer{display:flex;gap:8px;align-items:flex-end;padding:9px;border-radius:14px}.composer textarea{flex:1;min-height:42px;max-height:140px;resize:none;background:transparent;border:0;outline:0;color:#eee;font:inherit;font-size:13px;line-height:1.5}.composer textarea::placeholder{color:#64677c}.send-button{width:38px;height:38px;border:0;border-radius:11px;background:linear-gradient(135deg,#06b6d4,#7c3aed);color:#fff;cursor:pointer}.send-button.stop{background:#ef4444}.composer-meta{display:flex;justify-content:space-between;padding:7px 2px 0;color:#67697e;font-size:10px}.composer-meta button{border:0;background:transparent;color:#73758a;cursor:pointer}.preview-panel{display:flex;flex-direction:column;min-width:0}.preview-toolbar{height:55px;display:flex;align-items:center;padding:0 11px;border-bottom:1px solid rgba(255,255,255,.06)}.toolbar-group{display:flex;align-items:center;gap:3px}.toolbar-group.right{margin-left:auto}.toolbar-group button{border:0;background:transparent;color:#777a90;border-radius:8px;padding:7px 9px;font:inherit;font-size:10px;cursor:pointer}.toolbar-group button.tool-active{color:#fff;background:rgba(255,255,255,.07)}.live-label{font-size:9px;letter-spacing:.12em;color:#78e5a2;padding:0 9px}.live-label i{width:6px;height:6px;display:inline-block;border-radius:50%;background:#4ade80;box-shadow:0 0 10px #4ade80;margin-right:5px}.toolbar-group .accent-tool{color:#c7b9ff;background:rgba(124,58,237,.12)}.preview-canvas{flex:1;display:grid;place-items:center;overflow:auto;padding:13px;background:radial-gradient(circle at 50% 10%,rgba(124,58,237,.08),transparent 45%),#07080e}.device-shell{width:100%;height:100%;border-radius:15px;overflow:hidden;background:#fff;box-shadow:0 30px 100px rgba(0,0,0,.45);display:flex;flex-direction:column}.device-shell.tablet{width:min(834px,100%);height:calc(100% - 8px)}.device-shell.mobile{width:min(390px,100%);height:calc(100% - 8px)}.browser-bar{height:28px;flex:0 0 28px;background:#15161d;display:flex;align-items:center;gap:5px;padding:0 9px}.browser-bar span{width:6px;height:6px;border-radius:50%;background:#555}.browser-bar em{font-style:normal;color:#777b8c;font-size:8px;margin-left:8px}.device-shell iframe{width:100%;height:100%;border:0;background:#fff}.code-workspace{height:calc(100vh - 86px);margin:12px;position:relative;z-index:2;display:grid;grid-template-columns:220px 1fr}.file-sidebar{border-right:1px solid rgba(255,255,255,.07);padding:14px}.file-head{display:flex;justify-content:space-between;align-items:center;padding:7px 8px 12px}.file-head small{color:#5f6275;font-size:9px}.file-row{width:100%;border:0;background:transparent;color:#8e90a4;text-align:left;padding:9px 8px;border-radius:8px;display:flex;align-items:center;gap:8px;cursor:pointer;font:inherit;font-size:11px}.file-row.active,.file-row:hover{background:rgba(124,58,237,.11);color:#fff}.file-dot{width:23px;height:23px;border-radius:7px;display:grid;place-items:center;font-size:8px;font-weight:800}.file-dot.html{background:rgba(249,115,22,.12);color:#fb923c}.file-dot.css{background:rgba(59,130,246,.12);color:#60a5fa}.file-dot.js{background:rgba(250,204,21,.12);color:#facc15}.tree-note{margin:18px 8px;color:#5f6275;font-size:9px;line-height:1.6}.editor-area{min-width:0;display:flex;flex-direction:column;background:#08090f}.editor-top{height:48px;display:flex;align-items:center;justify-content:space-between;padding:0 14px;border-bottom:1px solid rgba(255,255,255,.06)}.editor-tab{display:flex;align-items:center;gap:8px;font-size:11px;color:#e6e7ed}.read-only{font-size:8px;letter-spacing:.12em;color:#65687b}.editor-body{position:relative;display:flex;flex:1;min-height:0;overflow:auto;background:#08090f}.line-numbers{width:48px;flex:0 0 48px;padding:18px 10px 18px 0;text-align:right;color:#3f4351;font:11px/1.75 ui-monospace,SFMono-Regular,Consolas,monospace;user-select:none}.line-numbers span{display:block}.code-highlight{margin:0;padding:18px 24px 18px 0;min-width:max-content;color:#d5d8e2;font:11px/1.75 ui-monospace,SFMono-Regular,Consolas,monospace;white-space:pre;pointer-events:none}.code-ghost{position:absolute;inset:0;left:48px;width:calc(100% - 48px);height:100%;resize:none;border:0;outline:0;background:transparent;color:transparent;caret-color:#fff;font:11px/1.75 ui-monospace,SFMono-Regular,Consolas,monospace;white-space:pre;overflow:auto;padding:18px 24px 18px 0;z-index:2}.code-ghost::selection{background:rgba(124,58,237,.3)}.tok-tag{color:#f472b6}.tok-attr{color:#60a5fa}.tok-str{color:#86efac}.tok-num{color:#c4b5fd}.tok-prop{color:#67e8f9}.tok-key{color:#fbbf24}.overlay{position:fixed;inset:0;z-index:100;background:rgba(0,0,0,.74);backdrop-filter:blur(16px);display:grid;place-items:center;padding:18px}.settings-card,.deploy-modal{width:min(650px,100%);border-radius:24px;padding:24px}.modal-head{display:flex;justify-content:space-between;gap:18px;margin-bottom:20px}.modal-head h2{font-size:25px;letter-spacing:-.04em;margin:5px 0}.modal-head p{color:#808398;font-size:11px;line-height:1.6;margin:0;max-width:510px}.settings-card label,.deploy-modal label{display:block;color:#a7a9b8;font-size:11px;margin-bottom:14px}.settings-card input,.deploy-modal input{width:100%;margin-top:6px;padding:12px;border-radius:11px;border:1px solid rgba(255,255,255,.09);background:rgba(0,0,0,.25);color:#eee;outline:0;font:inherit}.secret-input{display:flex;gap:7px}.secret-input input{margin-top:0}.secret-input button{margin-top:0;border:1px solid rgba(255,255,255,.09);background:rgba(255,255,255,.05);color:#aaaabd;border-radius:10px;padding:0 12px;cursor:pointer}.security-note{padding:11px;border-radius:11px;background:rgba(34,197,94,.06);border:1px solid rgba(34,197,94,.12);color:#7fb89a;font-size:10px;line-height:1.55;margin:4px 0 17px}.modal-actions{display:flex;align-items:center;justify-content:space-between;gap:12px}.modal-actions a{font-size:10px;color:#a99cff}.two-col{display:grid;grid-template-columns:1fr 190px;gap:12px}.check-label{display:flex!important;align-items:center;gap:8px;padding-top:22px}.check-label input{width:auto!important;margin:0!important}.result{margin-top:16px;padding:13px;border-radius:12px;display:grid;gap:6px;font-size:11px}.result.success{background:rgba(34,197,94,.06);border:1px solid rgba(34,197,94,.2);color:#86efac}.result.failure{background:rgba(239,68,68,.06);border:1px solid rgba(239,68,68,.2);color:#fca5a5}.result a{color:#c4b5fd}.result small{color:#7f8195}@media(max-width:1000px){.builder-grid{grid-template-columns:360px 1fr}.mode-switch{margin-left:12px}}@media(max-width:760px){.bp-pro-top{margin:7px}.bp-pro-brand span:last-child{display:none}.mode-switch{margin-left:8px}.model-button{max-width:150px;overflow:hidden;white-space:nowrap}.builder-grid{height:calc(100vh - 78px);padding:8px;display:flex;flex-direction:column}.chat-panel{height:48%;min-height:300px}.preview-panel{height:52%;min-height:360px}.code-workspace{height:calc(100vh - 78px);margin:8px;grid-template-columns:160px 1fr}.file-sidebar{padding:8px}.two-col{grid-template-columns:1fr}.modal-actions{align-items:stretch;flex-direction:column}.modal-actions .publish-button{width:100%}}
      `}</style>
    </div>
  )
}
