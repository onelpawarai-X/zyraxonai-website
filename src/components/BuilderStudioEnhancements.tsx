import { useEffect } from 'react'
import BuilderStudioMulti from './BuilderStudioMulti'

const NATURAL_SYSTEM_APPEND = `

CONVERSATION AND UX RULES — IMPORTANT:
- Speak like a polished human AI product assistant, not like a tutorial, installer, or documentation generator.
- If the user casually asks what you are doing, answer naturally and briefly. Do not answer with numbered setup steps unless explicitly asked.
- When you have completed a build/change, report it naturally in 1–4 short sentences. Never tell the user to manually save/copy generated files or deploy work that ZYRAXON just performed.
- Never claim the user gave you three files. Never prescribe index.html + style.css + script.js as a default structure. The project structure is determined by what the implementation genuinely needs.
- Do not dump source code into conversational prose. Render generated files as compact file cards and emit each real file once with its real path.
- Do not repeat the same generated file or create duplicate cards for the same file.
- During streaming, keep progress messages concise and human.
- After a successful build, prefer a concise completion message such as "হয়ে গেছে—প্রিভিউতে দেখে নিতে পারেন।"
- Treat the Builder as an interactive workspace; users should not have to manage generated files manually unless explicitly asked.
`

const ENHANCEMENT_CSS = `
.zyraxon-builder .zb-workspace{position:relative;min-width:0}
.zyraxon-builder .zb-workspace.empty .studio-pane{display:none!important}
.zyraxon-builder .zb-workspace.empty .chat-pane{flex:1 1 auto!important;width:100%!important;max-width:none}
.zyraxon-builder .zb-workspace.has-chat .chat-pane{flex:0 0 44%!important;width:44%!important;min-width:320px;max-width:none}
.zyraxon-builder .zb-workspace.has-chat .studio-pane{flex:1 1 0!important;width:auto!important;min-width:0;position:relative;z-index:1}
.zyraxon-builder .chat-pane{position:relative;min-height:0}
.zyraxon-builder .chat-scroll{overscroll-behavior:contain;scrollbar-gutter:stable;scroll-padding-bottom:24px}
.zyraxon-builder .messages{padding-bottom:18px}
.zyraxon-builder .composer{position:relative;z-index:8;box-shadow:inset 0 1px rgba(255,255,255,.13),0 30px 90px rgba(0,0,0,.42),0 0 55px rgba(255,255,255,.035)}
.zyraxon-builder .composer textarea{line-height:1.55}
.zyraxon-builder .glass,.zyraxon-builder .message,.zyraxon-builder .composer,.zyraxon-builder .studio-pane,.zyraxon-builder .preview-frame,.zyraxon-builder .file-tree,.zyraxon-builder .inline-file{backdrop-filter:blur(34px) saturate(145%);-webkit-backdrop-filter:blur(34px) saturate(145%)}
.zyraxon-builder:not(.light) .glass,.zyraxon-builder:not(.light) .message,.zyraxon-builder:not(.light) .composer,.zyraxon-builder:not(.light) .studio-pane{background:linear-gradient(145deg,rgba(255,255,255,.075),rgba(255,255,255,.025) 42%,rgba(0,0,0,.34))}
.zyraxon-builder .studio-pane{position:relative}
.zyraxon-builder .studio-head,.zyraxon-builder .composer-row,.zyraxon-builder .top-actions{position:relative;z-index:2}
.zyraxon-builder .studio-tabs button,.zyraxon-builder .device-tabs button,.zyraxon-builder .glass-btn,.zyraxon-builder .mode-btn,.zyraxon-builder .model-btn,.zyraxon-builder .send-btn,.zyraxon-builder .voice-btn,.zyraxon-builder .reset-local-btn{transition:transform .18s ease,box-shadow .18s ease,border-color .18s ease,background .18s ease}
.zyraxon-builder .voice-btn{width:37px;height:37px;display:grid;place-items:center;border:1px solid var(--line2);border-radius:12px;background:rgba(255,255,255,.045);color:var(--text);cursor:pointer;flex:none}
.zyraxon-builder .voice-btn:hover,.zyraxon-builder .reset-local-btn:hover{transform:translateY(-1px);box-shadow:0 10px 30px rgba(0,0,0,.22),inset 0 1px rgba(255,255,255,.1)}
.zyraxon-builder .voice-btn.is-listening{background:rgba(255,255,255,.13);box-shadow:0 0 0 1px rgba(255,255,255,.1),0 0 32px rgba(255,255,255,.12)}
.zyraxon-builder .voice-btn svg{width:17px;height:17px}
.zyraxon-builder .voice-status{position:absolute;right:0;bottom:47px;padding:7px 10px;border:1px solid var(--line2);border-radius:10px;background:rgba(10,10,10,.9);color:var(--muted);font-size:10px;white-space:nowrap;box-shadow:var(--shadow);backdrop-filter:blur(24px);-webkit-backdrop-filter:blur(24px);z-index:30}
.zyraxon-builder.light .voice-status{background:rgba(255,255,255,.94)}
.zyraxon-builder .reset-local-btn{width:34px;height:34px;display:grid;place-items:center;padding:0;border:1px solid var(--line2);border-radius:11px;background:rgba(255,255,255,.045);color:var(--muted);cursor:pointer}
.zyraxon-builder .reset-local-btn:hover{color:var(--text);border-color:rgba(255,255,255,.22);background:rgba(255,255,255,.09)}
.zyraxon-builder .reset-local-btn svg{width:15px;height:15px}
@media(max-width:900px){.zyraxon-builder .zb-workspace.has-chat .chat-pane{flex-basis:100%!important;width:100%!important;min-width:0}.zyraxon-builder .zb-workspace.has-chat .studio-pane{min-height:48vh}.zyraxon-builder .splitter{display:none}}
`

function setReactTextareaValue(el: HTMLTextAreaElement, value: string) {
  const setter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value')?.set
  setter?.call(el, value)
  el.dispatchEvent(new Event('input', { bubbles: true }))
}

async function clearAllLocalData() {
  try { window.localStorage.clear() } catch {}
  try { window.sessionStorage.clear() } catch {}
  try {
    if (indexedDB.databases) {
      const databases = await indexedDB.databases()
      await Promise.all((databases || []).map(db => db.name ? new Promise<void>(resolve => { const req = indexedDB.deleteDatabase(db.name!); req.onsuccess = req.onerror = req.onblocked = () => resolve() }) : Promise.resolve()))
    }
  } catch {}
  try { if ('caches' in window) { const names = await caches.keys(); await Promise.all(names.map(name => caches.delete(name))) } } catch {}
  try {
    document.cookie.split(';').forEach(cookie => {
      const name = cookie.split('=')[0]?.trim()
      if (name) document.cookie = `${name}=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=/`
    })
  } catch {}
}

export default function BuilderStudioEnhancements() {
  useEffect(() => {
    const style = document.createElement('style')
    style.setAttribute('data-zyraxon-builder-v4', 'true')
    style.textContent = ENHANCEMENT_CSS
    document.head.appendChild(style)

    const originalFetch = window.fetch.bind(window)
    const patchedFetch: typeof window.fetch = async (input, init) => {
      const url = typeof input === 'string' ? input : input instanceof Request ? input.url : ''
      if (url.includes('/api/public/builder/chat') && init?.body && typeof init.body === 'string') {
        try {
          const payload = JSON.parse(init.body)
          if (Array.isArray(payload.messages) && payload.messages[0]?.role === 'system') {
            payload.messages[0] = { ...payload.messages[0], content: `${payload.messages[0].content || ''}${NATURAL_SYSTEM_APPEND}` }
            return originalFetch(input, { ...init, body: JSON.stringify(payload) })
          }
        } catch {}
      }
      return originalFetch(input, init)
    }
    window.fetch = patchedFetch

    let recognition: any = null
    let listening = false
    let baseText = ''
    let voiceButton: HTMLButtonElement | null = null
    let observer: MutationObserver | null = null
    let resetButton: HTMLButtonElement | null = null
    let languageIndex = 0
    const languages = ['bn-BD', 'hi-IN', 'en-US', 'en-IN']

    const setupReset = () => {
      if (resetButton?.isConnected) return
      const host = document.querySelector<HTMLElement>('.zyraxon-builder .top-actions') || document.querySelector<HTMLElement>('.zyraxon-builder .composer-row')
      if (!host || host.querySelector('.reset-local-btn')) return
      const button = document.createElement('button')
      button.type = 'button'
      button.className = 'reset-local-btn'
      button.setAttribute('aria-label', 'Reset local data')
      button.title = 'Reset local data — clear chat, generated files, session and local account state'
      button.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18M9 6V4h6v2m-9 0 1 15h10l1-15M10 11v6m4-6v6"/></svg>'
      button.addEventListener('click', async () => {
        const ok = window.confirm('Reset all local ZYRAXON data? This will clear chat history, generated files, local settings and saved GitHub/profile state on this browser.')
        if (!ok) return
        button.disabled = true
        button.title = 'Resetting local data…'
        await clearAllLocalData()
        window.location.replace('/builder')
      })
      host.appendChild(button)
      resetButton = button
    }

    const setupVoice = () => {
      const composer = document.querySelector<HTMLElement>('.zyraxon-builder .composer')
      const row = composer?.querySelector<HTMLElement>('.composer-row')
      const send = row?.querySelector<HTMLButtonElement>('.send-btn')
      if (!row || !send || row.querySelector('.voice-btn')) return
      const wrap = document.createElement('div')
      wrap.style.position = 'relative'; wrap.style.display = 'flex'; wrap.style.alignItems = 'center'
      const button = document.createElement('button')
      button.type = 'button'; button.className = 'voice-btn'; button.setAttribute('aria-label', 'Voice input'); button.title = 'Voice input'
      button.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5 11a7 7 0 0 0 14 0M12 18v3M8 21h8"/></svg>'
      const status = document.createElement('span'); status.className = 'voice-status'; status.hidden = true; status.textContent = 'শুনছি…'
      wrap.append(button, status)
      row.insertBefore(wrap, send)
      voiceButton = button
      const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
      if (!SpeechRecognition) {
        button.title = 'Voice input is not supported in this browser'
        button.addEventListener('click', () => { status.textContent = 'এই ব্রাউজারে Voice Input সাপোর্ট নেই।'; status.hidden = false; setTimeout(() => { status.hidden = true }, 2200) })
        return
      }
      const createRecognition = () => {
        const r = new SpeechRecognition()
        r.continuous = true; r.interimResults = true; r.maxAlternatives = 3
        const preferred = (navigator.language || '').toLowerCase()
        r.lang = preferred.startsWith('bn') ? 'bn-BD' : preferred.startsWith('hi') ? 'hi-IN' : preferred.startsWith('en') ? navigator.language : languages[languageIndex]
        return r
      }
      const attach = (r: any) => {
        r.onstart = () => { listening = true; baseText = document.querySelector<HTMLTextAreaElement>('.zyraxon-builder .composer textarea')?.value || ''; button.classList.add('is-listening'); status.textContent = `শুনছি… ${r.lang}`; status.hidden = false }
        r.onresult = (event: any) => {
          let interim = ''; let finalText = ''
          for (let i = event.resultIndex; i < event.results.length; i++) { const transcript = event.results[i][0]?.transcript || ''; if (event.results[i].isFinal) finalText += transcript; else interim += transcript }
          const textarea = document.querySelector<HTMLTextAreaElement>('.zyraxon-builder .composer textarea')
          if (textarea) setReactTextareaValue(textarea, `${baseText}${finalText}${interim}`)
        }
        r.onerror = (event: any) => {
          const err = event?.error || ''
          if (err === 'not-allowed' || err === 'service-not-allowed') status.textContent = 'মাইক্রোফোনের অনুমতি দিন'
          else if (err === 'language-not-supported' || err === 'no-speech') { languageIndex = (languageIndex + 1) % languages.length; status.textContent = `আবার চেষ্টা করছি (${languages[languageIndex]})` }
          else status.textContent = 'Voice input বন্ধ হয়েছে'
          status.hidden = false; setTimeout(() => { if (!listening) status.hidden = true }, 2200)
        }
        r.onend = () => {
          if (!listening) { button.classList.remove('is-listening'); status.hidden = true; return }
          window.setTimeout(() => { if (!listening) return; try { recognition = createRecognition(); attach(recognition); recognition.start() } catch {} }, 120)
        }
      }
      recognition = createRecognition(); attach(recognition)
      button.addEventListener('click', () => {
        if (listening) { listening = false; try { recognition.stop() } catch {} }
        else { listening = true; baseText = document.querySelector<HTMLTextAreaElement>('.zyraxon-builder .composer textarea')?.value || ''; try { recognition.start() } catch { listening = false } }
      })
    }

    const setup = () => { setupReset(); setupVoice() }
    observer = new MutationObserver(setup)
    observer.observe(document.body, { childList: true, subtree: true })
    setup()

    return () => {
      listening = false
      try { recognition?.stop() } catch {}
      observer?.disconnect()
      if (voiceButton?.parentElement) voiceButton.parentElement.remove()
      if (resetButton?.isConnected) resetButton.remove()
      style.remove(); window.fetch = originalFetch
    }
  }, [])

  return <BuilderStudioMulti />
}
