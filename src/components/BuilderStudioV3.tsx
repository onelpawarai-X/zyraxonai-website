import { useEffect, useMemo, useRef, useState } from 'react'
import Editor from '@monaco-editor/react'
import { Link } from '@tanstack/react-router'
import { Activity, Bot, Code2, Eye, FolderOpen, Github, Laptop, Lightbulb, Loader2, Mic, Moon, Save, Send, Smartphone, Sparkles, Tablet, Upload, X, Zap } from 'lucide-react'
import '../styles/builder-studio.css'

type Device = 'desktop' | 'tablet' | 'mobile'
type View = 'preview' | 'code'
type Mode = 'bolt' | 'plan'
type ChatMessage = { role: 'user' | 'assistant'; content: string }
type GeneratedFile = { path: string; content: string }
type GithubRepo = { name: string; full_name: string; default_branch: string; private: boolean; html_url: string }

const MODELS = [
  { id: 'mimo-v2.5-free', name: 'MiMo V2.5 Free' },
  { id: 'nemotron-3-super-free', name: 'Nemotron 3 Super Free' },
  { id: 'big-pickle', name: 'Big Pickle' },
]

const STARTER: GeneratedFile = { path: 'index.html', content: '<!doctype html>\n<html>\n<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>\n<body><main><h1>Start with an idea.</h1><p>Tell ZYRAXON what to build.</p></main></body>\n</html>' }

const DEVICON: Record<string, string> = {
  html:'html5',htm:'html5',css:'css3',scss:'sass',sass:'sass',less:'less',js:'javascript',jsx:'react',ts:'typescript',tsx:'react',mjs:'nodejs',cjs:'nodejs',json:'json',jsonc:'json',md:'markdown',mdx:'markdown',py:'python',rb:'ruby',php:'php',java:'java',kt:'kotlin',kts:'kotlin',go:'go',rs:'rust',c:'c',h:'c',cpp:'cplusplus',hpp:'cplusplus',cs:'csharp',swift:'swift',dart:'dart',lua:'lua',r:'r',scala:'scala',sh:'bash',bash:'bash',zsh:'bash',fish:'bash',sql:'azuresqldatabase',graphql:'graphql',vue:'vuejs',svelte:'svelte',astro:'astro',xml:'xml',yaml:'yaml',yml:'yaml',toml:'toml',dockerfile:'docker',prisma:'prisma',env:'dotenv',gitignore:'git',lock:'npm',wasm:'webassembly',zig:'zig',ex:'elixir',exs:'elixir',erl:'erlang',fs:'fsharp',fsx:'fsharp',clj:'clojure',groovy:'groovy',vim:'vim',proto:'protobuf',tf:'terraform',sol:'solidity',ipynb:'jupyter',cmake:'cmake',make:'gnu',gradle:'gradle'
}

function extension(path: string) {
  const name = path.split('/').pop()?.toLowerCase() ?? ''
  if (DEVICON[name]) return name
  return name.includes('.') ? name.split('.').pop() ?? '' : name
}

function FileIcon({ path, size = 16 }: { path: string; size?: number }) {
  const key = extension(path)
  const slug = DEVICON[key]
  if (slug) return <img className="file-icon" src={`https://cdn.jsdelivr.net/gh/devicons/devicon@latest/icons/${slug}/${slug}-original.svg`} width={size} height={size} alt="" onError={(event) => { event.currentTarget.style.display = 'none' }} />
  return <span className="generic-file-icon" style={{ width: size, height: size }}>{key.slice(0, 2).toUpperCase() || '•'}</span>
}

function languageFor(path: string) {
  const ext = extension(path)
  const map: Record<string, string> = { html:'html',htm:'html',css:'css',scss:'scss',less:'less',js:'javascript',jsx:'javascript',ts:'typescript',tsx:'typescript',json:'json',jsonc:'json',md:'markdown',mdx:'markdown',py:'python',rb:'ruby',php:'php',java:'java',kt:'kotlin',go:'go',rs:'rust',c:'c',h:'c',cpp:'cpp',hpp:'cpp',cs:'csharp',swift:'swift',dart:'dart',lua:'lua',sql:'sql',graphql:'graphql',vue:'vue',svelte:'html',xml:'xml',yaml:'yaml',yml:'yaml',toml:'ini',sh:'shell',bash:'shell',dockerfile:'dockerfile',sol:'solidity',proto:'proto',tf:'hcl',r:'r',scala:'scala',groovy:'groovy',vim:'vim',ex:'elixir',exs:'elixir',erl:'erlang',fs:'fsharp',fsx:'fsharp',clj:'clojure',cmake:'cmake' }
  return map[ext] ?? 'plaintext'
}

function extractCompleteFiles(text: string): GeneratedFile[] {
  const files: GeneratedFile[] = []
  const pattern = /```(?:[\w+#.-]+)?\s*(?:file|filename|path)?\s*[=:]?\s*[`']?([^\n`']+\.[a-zA-Z0-9._-]+)[`']?\s*\n([\s\S]*?)```/g
  let match: RegExpExecArray | null
  while ((match = pattern.exec(text))) files.push({ path: match[1].trim().replace(/^\//, ''), content: match[2] })
  const tagged = /<file\s+path=["']([^"']+)["'][^>]*>([\s\S]*?)<\/file>/gi
  while ((match = tagged.exec(text))) files.push({ path: match[1].trim().replace(/^\//, ''), content: match[2] })
  return files.filter((file, index, list) => list.findIndex((item) => item.path === file.path) === index)
}

function extractStreamingFile(text: string) {
  const match = /```(?:[\w+#.-]+)?\s*(?:file|filename|path)?\s*[=:]?\s*[`']?([^\n`']+\.[a-zA-Z0-9._-]+)[`']?\s*\n([\s\S]*)$/m.exec(text)
  if (!match) return null
  return { path: match[1].trim().replace(/^\//, ''), content: match[2].replace(/```$/, '') }
}

function encodeBase64(value: string) {
  const bytes = new TextEncoder().encode(value)
  let binary = ''
  for (const byte of bytes) binary += String.fromCharCode(byte)
  return btoa(binary)
}

function decodeBase64(value: string) {
  const binary = atob(value.replace(/\s/g, ''))
  const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0))
  return new TextDecoder().decode(bytes)
}

function isTextPath(path: string) {
  const ext = extension(path)
  return Boolean(DEVICON[ext]) || ['txt','csv','ini','conf','config','log','map','webmanifest'].includes(ext) || !path.includes('.')
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
  const [workspaceOpen, setWorkspaceOpen] = useState(false)
  const [publishOpen, setPublishOpen] = useState(false)
  const [githubOpen, setGithubOpen] = useState(false)
  const [githubToken, setGithubToken] = useState('')
  const [githubRepos, setGithubRepos] = useState<GithubRepo[]>([])
  const [githubRepo, setGithubRepo] = useState<GithubRepo | null>(null)
  const [githubLoading, setGithubLoading] = useState(false)
  const [githubStatus, setGithubStatus] = useState('')
  const [publishToken, setPublishToken] = useState('')
  const [publishRepo, setPublishRepo] = useState('')
  const [publishStatus, setPublishStatus] = useState('')
  const [publishedUrl, setPublishedUrl] = useState('')
  const [liveFile, setLiveFile] = useState<GeneratedFile | null>(null)
  const recognition = useRef<any>(null)
  const active = files.find((file) => file.path === activeFile) ?? files[0]
  const html = files.find((file) => file.path.toLowerCase() === 'index.html')?.content ?? active.content
  const previewUrl = useMemo(() => `data:text/html;charset=utf-8,${encodeURIComponent(html)}`, [html])

  useEffect(() => {
    const stored = window.localStorage.getItem('zyraxonai.github.token')
    if (stored) setGithubToken(stored)
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

  function updateCode(value: string) {
    setFiles((items) => items.map((file) => file.path === activeFile ? { ...file, content: value } : file))
    setSaved(false)
  }

  function mergeFiles(incoming: GeneratedFile[]) {
    if (!incoming.length) return
    setFiles((existing) => {
      const merged = [...existing]
      for (const file of incoming) {
        const index = merged.findIndex((item) => item.path === file.path)
        if (index >= 0) merged[index] = file
        else merged.push(file)
      }
      return merged
    })
    setActiveFile(incoming[incoming.length - 1].path)
  }

  async function generate() {
    const text = input.trim()
    if (!text || busy) return
    const next = [...messages, { role: 'user' as const, content: text }]
    setMessages(next); setInput(''); setBusy(true); setWorkspaceOpen(true); setView('code'); setLiveFile(null)
    let assistant = ''
    try {
      const response = await fetch('/api/public/builder/chat', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ model, messages: next }) })
      if (!response.ok || !response.body) throw new Error('connection')
      setConnected(true)
      const reader = response.body.getReader(); const decoder = new TextDecoder(); let buffer = ''
      while (true) {
        const result = await reader.read(); if (result.done) break
        buffer += decoder.decode(result.value, { stream: true })
        const lines = buffer.split('\n'); buffer = lines.pop() ?? ''
        for (const line of lines) {
          if (!line.startsWith('data:')) continue
          const raw = line.slice(5).trim(); if (!raw || raw === '[DONE]') continue
          try {
            const parsed = JSON.parse(raw)
            const delta = parsed?.choices?.[0]?.delta?.content ?? parsed?.choices?.[0]?.message?.content ?? parsed?.content ?? ''
            if (!delta) continue
            assistant += delta
            const streaming = extractStreamingFile(assistant)
            if (streaming) {
              setLiveFile(streaming); setActiveFile(streaming.path)
              setFiles((existing) => { const index = existing.findIndex((file) => file.path === streaming.path); if (index < 0) return [...existing, streaming]; const nextFiles = [...existing]; nextFiles[index] = streaming; return nextFiles })
            }
            mergeFiles(extractCompleteFiles(assistant))
          } catch {}
        }
      }
      mergeFiles(extractCompleteFiles(assistant))
      setMessages((items) => [...items, { role: 'assistant', content: assistant.replace(/```[\s\S]*?```/g, '').replace(/<file[\s\S]*?<\/file>/gi, '').trim() || 'Build complete.' }])
    } catch {
      setConnected(false); setMessages((items) => [...items, { role: 'assistant', content: 'The AI connection could not be completed. Please try again.' }])
    } finally { setLiveFile(null); setBusy(false) }
  }

  function githubHeaders(token: string) {
    return { Authorization: `Bearer ${token}`, Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': '2026-03-10' }
  }

  async function connectGitHub() {
    const token = githubToken.trim()
    if (!token) { setGithubStatus('Enter a GitHub access token.'); return }
    setGithubLoading(true); setGithubStatus('Authenticating and loading repositories…'); setGithubRepos([]); setGithubRepo(null)
    try {
      const response = await fetch('https://api.github.com/user/repos?per_page=100&sort=updated&direction=desc', { headers: githubHeaders(token) })
      if (!response.ok) throw new Error('GitHub token was rejected or does not have repository access.')
      const repos = await response.json() as GithubRepo[]
      window.localStorage.setItem('zyraxonai.github.token', token)
      setGithubRepos(repos); setGithubStatus(`${repos.length} repositories loaded. Click a repository to load the entire project.`)
    } catch (error) { setGithubStatus(error instanceof Error ? error.message : 'GitHub connection failed.') }
    finally { setGithubLoading(false) }
  }

  async function loadWholeRepository(repo: GithubRepo) {
    const token = githubToken.trim()
    if (!token) return
    setGithubLoading(true); setGithubRepo(repo); setGithubStatus(`Loading the complete ${repo.name} project…`)
    try {
      const treeResponse = await fetch(`https://api.github.com/repos/${repo.full_name}/git/trees/${encodeURIComponent(repo.default_branch)}?recursive=1`, { headers: githubHeaders(token) })
      if (!treeResponse.ok) throw new Error('Could not read the repository tree.')
      const tree = await treeResponse.json()
      const blobs = (tree.tree ?? []).filter((item: any) => item.type === 'blob').slice(0, 750)
      const loaded: GeneratedFile[] = []
      for (let index = 0; index < blobs.length; index += 10) {
        const batch = blobs.slice(index, index + 10)
        const results = await Promise.all(batch.map(async (item: any) => {
          if (item.size > 2_000_000 || !isTextPath(item.path)) return { path: item.path, content: `/* Binary or large asset: ${item.path} is present in the connected project but is not editable as text. */` }
          const blobResponse = await fetch(`https://api.github.com/repos/${repo.full_name}/git/blobs/${item.sha}`, { headers: githubHeaders(token) })
          if (!blobResponse.ok) return null
          const blob = await blobResponse.json()
          return { path: item.path, content: blob.encoding === 'base64' ? decodeBase64(blob.content) : String(blob.content ?? '') }
        }))
        loaded.push(...results.filter(Boolean) as GeneratedFile[])
        setGithubStatus(`Loaded ${Math.min(index + batch.length, blobs.length)} of ${blobs.length} project files…`)
      }
      if (!loaded.length) throw new Error('The repository has no readable files.')
      setFiles(loaded); setActiveFile(loaded.find((file) => file.path === 'index.html')?.path ?? loaded[0].path); setWorkspaceOpen(true); setView('code')
      setGithubStatus(`Complete project loaded: ${loaded.length} files.`)
    } catch (error) { setGithubStatus(error instanceof Error ? error.message : 'Project loading failed.') }
    finally { setGithubLoading(false) }
  }

  async function publishToGitHub(targetRepo?: string) {
    const token = (targetRepo ? githubToken : publishToken).trim()
    const repoName = (targetRepo ?? publishRepo).trim().replace(/\.git$/, '')
    if (!token || !repoName) { setPublishStatus('Enter a GitHub token and repository name.'); return }
    setPublishStatus('Publishing project…'); setPublishedUrl('')
    const headers = { ...githubHeaders(token), 'Content-Type': 'application/json' }
    try {
      const me = await fetch('https://api.github.com/user', { headers }); if (!me.ok) throw new Error('GitHub token was rejected.')
      const user = await me.json(); const owner = user.login as string
      let repo = await fetch(`https://api.github.com/repos/${owner}/${repoName}`, { headers })
      if (repo.status === 404) repo = await fetch('https://api.github.com/user/repos', { method:'POST', headers, body:JSON.stringify({ name:repoName, private:false, auto_init:true }) })
      if (!repo.ok) throw new Error('Could not create or open the repository.')
      const repoData = await repo.json()
      for (const file of files) {
        const path = file.path.replace(/^\//, '')
        const existing = await fetch(`https://api.github.com/repos/${owner}/${repoName}/contents/${path}?ref=main`, { headers })
        const body: Record<string, unknown> = { message:`feat: update ${path} from ZYRAXON AI Bludar`, content:encodeBase64(file.content), branch:'main' }
        if (existing.ok) body.sha = (await existing.json()).sha
        const saved = await fetch(`https://api.github.com/repos/${owner}/${repoName}/contents/${path}`, { method:'PUT', headers, body:JSON.stringify(body) })
        if (!saved.ok) throw new Error(`Failed to publish ${path}.`)
      }
      const pages = await fetch(`https://api.github.com/repos/${owner}/${repoName}/pages`, { method:'POST', headers, body:JSON.stringify({ source:{ branch:'main', path:'/' }, build_type:'legacy', https_enforced:true }) })
      if (!pages.ok && pages.status !== 409) throw new Error('Files published, but GitHub Pages could not be configured. Check Pages permissions.')
      await fetch(`https://api.github.com/repos/${owner}/${repoName}/pages/builds`, { method:'POST', headers }).catch(() => undefined)
      setPublishedUrl(`https://${owner}.github.io/${repoName}/`); setPublishStatus(`Published ${files.length} files to ${repoData.full_name}.`); setPublishToken('')
    } catch (error) { setPublishStatus(error instanceof Error ? error.message : 'GitHub publish failed.') }
  }

  return <div className={`builder-root ${dark ? 'is-dark' : 'is-light'}`}>
    <header className="builder-topbar">
      <Link to="/" className="builder-brand"><span className="brand-glyph">Z</span><span>ZYRAXON</span><em>AI BLUDAR</em></Link>
      <div className="builder-actions">
        <button className="glass-action" onClick={() => setGithubOpen(true)}><Github size={15}/> GitHub</button>
        <button className="glass-action" onClick={() => setPublishOpen(true)}><Upload size={15}/> Publish</button>
        <button className="glass-action" onClick={() => setActivityOpen((value) => !value)}><Activity size={15}/> Activity</button>
        <button className="glass-icon" title="Toggle theme" onClick={() => setDark((value) => !value)}>{dark ? <Lightbulb size={16}/> : <Moon size={16}/>}</button>
      </div>
    </header>

    {activityOpen && <div className="activity-pop glass-card"><div><b>Activity</b><button className="close-btn" onClick={() => setActivityOpen(false)}><X size={15}/></button></div><p>{busy ? 'AI is writing code in the active file…' : githubRepo ? `Connected project: ${githubRepo.full_name}` : 'No active operations.'}</p></div>}

    <main className={workspaceOpen ? 'builder-main with-workspace' : 'builder-main chat-only'}>
      <section className="chat-pane glass-card">
        <div className="chat-title"><span className="eyebrow"><Sparkles size={12}/> AI PRODUCT STUDIO</span><h1>Build something extraordinary.</h1></div>
        <div className="chat-history">
          {messages.length === 0 ? <div className="welcome-state"><div className="ai-orb"><Bot size={26}/></div><h2>What are we building?</h2><p>Describe your website or app. The workspace appears when ZYRAXON starts building.</p><div className="suggestions"><button onClick={() => setInput('Build a premium dark AI SaaS landing page')}><Sparkles size={14}/> AI SaaS</button><button onClick={() => setInput('Build a developer portfolio')}><Code2 size={14}/> Portfolio</button><button onClick={() => setInput('Build a product website')}><Eye size={14}/> Product</button></div></div> : messages.map((message,index) => <article className={`chat-message ${message.role}`} key={`${message.role}-${index}`}><span>{message.role === 'user' ? 'YOU' : 'ZYRAXON AI'}</span><p>{message.content}</p></article>)}
          {liveFile && <div className="inline-live glass-card"><div className="live-head"><span className="live-dot"/> LIVE · {liveFile.path}</div><div className="live-lines"><span>Writing {liveFile.path}</span><span>{liveFile.content.split('\n').length} lines</span></div></div>}
        </div>
        <div className="composer glass-card"><textarea value={input} onChange={(event) => setInput(event.target.value)} onKeyDown={(event) => { if(event.key==='Enter'&&!event.shiftKey){event.preventDefault();void generate()} }} placeholder={mode==='bolt'?'Describe what you want to build…':'Describe the plan…'}/><div className="composer-row"><div className="composer-left"><label className="select-pill"><Sparkles size={14}/><select value={model} onChange={(event)=>setModel(event.target.value)}>{MODELS.map((item)=><option key={item.id} value={item.id}>{item.name}</option>)}</select></label><label className="select-pill"><Zap size={14}/><select value={mode} onChange={(event)=>setMode(event.target.value as Mode)}><option value="bolt">Bolt</option><option value="plan">Plan</option></select></label></div><div className="composer-right"><button className={listening?'circle-btn active':'circle-btn'} onClick={toggleMic} title="Voice input"><Mic size={17}/></button><button className="send-btn" disabled={!input.trim()||busy} onClick={()=>void generate()}>{busy?<Loader2 size={17} className="spin"/>:<Send size={17}/>}</button></div></div></div>
      </section>

      {workspaceOpen && <section className="workspace-pane glass-card">
        <div className="workspace-bar"><div className="view-switch"><button className={view==='preview'?'selected':''} onClick={()=>setView('preview')}><Eye size={15}/> Preview</button><button className={view==='code'?'selected':''} onClick={()=>setView('code')}><Code2 size={15}/> Code</button></div><div className="device-switch"><button className={device==='desktop'?'selected':''} onClick={()=>setDevice('desktop')}><Laptop size={15}/></button><button className={device==='tablet'?'selected':''} onClick={()=>setDevice('tablet')}><Tablet size={15}/></button><button className={device==='mobile'?'selected':''} onClick={()=>setDevice('mobile')}><Smartphone size={15}/></button></div><span className={connected?'connection live':'connection'}><i/>{connected?'AI Connected':'Connecting'}</span></div>
        {view==='preview'?<div className="preview-stage"><div className={`preview-device ${device}`}><iframe title="Generated website preview" sandbox="allow-scripts allow-forms" src={previewUrl}/></div></div>:<div className="ide-shell"><aside className="file-pane"><div className="pane-title"><span><FolderOpen size={14}/> Project files</span><b>{files.length}</b></div><div className="file-list">{files.map((file)=><button key={file.path} className={file.path===activeFile?'file-row selected':'file-row'} onClick={()=>setActiveFile(file.path)}><FileIcon path={file.path}/><span title={file.path}>{file.path}</span></button>)}</div></aside><div className="editor-pane"><div className="editor-top"><span><FileIcon path={active.path}/>{active.path}</span><button onClick={()=>{setSaved(true);window.setTimeout(()=>setSaved(false),1000)}}><Save size={14}/>{saved?'Saved':'Save'}</button></div><Editor theme="vs-dark" language={languageFor(active.path)} value={liveFile?.path===active.path?liveFile.content:active.content} onChange={(value)=>updateCode(value??'')} options={{automaticLayout:true,minimap:{enabled:false},fontSize:13,padding:{top:14},smoothScrolling:true,scrollBeyondLastLine:false,wordWrap:'on',cursorBlinking:'smooth'}}/></div></div>}
      </section>}
    </main>

    {githubOpen && <div className="modal-backdrop"><div className="publish-modal glass-card" style={{width:'min(720px,100%)',maxHeight:'82vh',overflow:'auto'}}><button className="modal-close" onClick={()=>setGithubOpen(false)}><X size={17}/></button><div className="modal-icon"><Github size={22}/></div><h2>Connect GitHub Project</h2><p>Enter your GitHub access token once. It is stored locally in this browser. After the repositories load, click a repository and the entire project is imported into the Code workspace—no individual file selection.</p><label>GitHub access token<input type="password" value={githubToken} onChange={(event)=>setGithubToken(event.target.value)} placeholder="github_pat_…" autoComplete="off"/></label><button className="publish-submit" onClick={()=>void connectGitHub()} disabled={githubLoading||!githubToken.trim()}>{githubLoading?<Loader2 size={16} className="spin"/>:<Github size={16}/>} {githubLoading?'Loading…':'Load my repositories'}</button>{githubStatus&&<div className="publish-status">{githubStatus}</div>}<div style={{display:'grid',gap:7,marginTop:14}}>{githubRepos.map((repo)=><button key={repo.full_name} onClick={()=>void loadWholeRepository(repo)} disabled={githubLoading} style={{display:'flex',alignItems:'center',gap:10,textAlign:'left',padding:'11px 12px',borderRadius:10,border:'1px solid rgba(255,255,255,.08)',background:githubRepo?.full_name===repo.full_name?'rgba(255,255,255,.1)':'rgba(255,255,255,.03)',color:'#ddd',cursor:'pointer'}}><Github size={15}/><span style={{minWidth:0,flex:1}}><strong style={{display:'block',fontSize:11}}>{repo.full_name}</strong><small style={{color:'#666'}}>{repo.private?'Private':'Public'} · {repo.default_branch}</small></span><span style={{fontSize:9,color:'#777'}}>Load entire project →</span></button>)}</div>{githubRepo&&<button className="publish-submit" style={{marginTop:14}} onClick={()=>void publishToGitHub(githubRepo.full_name)} disabled={githubLoading||!githubToken}><Upload size={16}/> Sync AI-edited project to {githubRepo.name}</button>}</div></div>}

    {publishOpen && <div className="modal-backdrop"><div className="publish-modal glass-card"><button className="modal-close" onClick={()=>setPublishOpen(false)}><X size={17}/></button><div className="modal-icon"><Upload size={22}/></div><h2>Publish Website</h2><p>This is the separate website publishing flow. GitHub above is for connecting an existing project; Publish is for publishing the current Builder project.</p><label>GitHub token<input type="password" value={publishToken} onChange={(event)=>setPublishToken(event.target.value)} placeholder="github_pat_…" autoComplete="off"/></label><label>Repository name<input value={publishRepo} onChange={(event)=>setPublishRepo(event.target.value)} placeholder="my-ai-website"/></label><button className="publish-submit" onClick={()=>void publishToGitHub()} disabled={!publishToken||!publishRepo}><Upload size={16}/> Publish website</button>{publishStatus&&<div className="publish-status">{publishStatus}</div>}{publishedUrl&&<a className="published-url" href={publishedUrl} target="_blank" rel="noreferrer">Open published website →</a>}</div></div>}
  </div>
}
