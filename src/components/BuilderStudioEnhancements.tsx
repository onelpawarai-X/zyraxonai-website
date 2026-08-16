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
.zyraxon-builder:not(.light) .glass:before,.zyraxon-builder:not(.light) .message:before,.zyraxon-builder:not(.light) .composer:before,.zyraxon-builder:not(.light) .studio-pane:before{content:"";position:absolute;inset:0;pointer-events:none;border-radius:inherit;background:linear-gradient(120deg,rgba(255,255,255,.07),transparent 32%,transparent 68%,rgba(255,255,255,.025));mask-image:linear-gradient(#000,#000)}
.zyraxon-builder .studio-pane{position:relative}
.zyraxon-builder .studio-head,.zyraxon-builder .composer-row,.zyraxon-builder .top-actions{position:relative;z-index:2}
.zyraxon-builder .studio-tabs button,.zyraxon-builder .device-tabs button,.zyraxon-builder .glass-btn,.zyraxon-builder .mode-btn,.zyraxon-builder .model-btn,.zyraxon-builder .send-btn,.zyraxon-builder .voice-btn{transition:transform .18s ease,box-shadow .18s ease,border-color .18s ease,background .18s ease}
.zyraxon-builder .voice-btn{width:37px;height:37px;display:grid;place-items:center;border:1px solid var(--line2);border-radius:12px;background:rgba(255,255,255,.045);color:var(--text);cursor:pointer;flex:none}
.zyraxon-builder .voice-btn:hover{transform:translateY(-1px);box-shadow:0 10px 30px rgba(0,0,0,.22),inset 0 1px rgba(255,255,255,.1)}
.zyraxon-builder .voice-btn.is-listening{background:rgba(255,255,255,.13);box-shadow:0 0 0 1px rgba(255,255,255,.1),0 0 32px rgba(255,255,255,.12)}
.zyraxon-builder .voice-btn svg{width:17px;height:17px}
.zyraxon-builder .voice-status{position:absolute;right:0;bottom:47px;padding:7px 10px;border:1px solid var(--line2);border-radius:10px;background:rgba(10,10,10,.9);color:var(--muted);font-size:10px;white-space:nowrap;box-shadow:var(--shadow);backdrop-filter:blur(24px);-webkit-backdrop-filter:blur(24px)}
.zyraxon-builder.light .voice-status{background:rgba(255,255,255,.94)}
@media(max-width:900px){.zyraxon-builder .zb-workspace.has-chat .chat-pane{flex-basis:100%!important;width:100%!important;min-width:0}.zyraxon-builder .zb-workspace.has-chat .studio-pane{min-height:48vh}.zyraxon-builder .splitter{display:none}}
`

function setReactTextareaValue(el: HTMLTextAreaElement, value: string) {
  const setter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value')?.set
  setter?.call(el, value)
  el.dispatchEvent(new Event('input', { bubbles: true }))
}

export default function BuilderStudioEnhancements() {
  useEffect(() => {
    const style = document.createElement('style')
    style.setAttribute('data-zyraxon-builder-v3', 'true')
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
    let languageIndex = 0
    const languages = ['bn-BD', 'hi-IN', 'en-US', 'en-IN']

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
      // Keep Send at the far right; Voice sits immediately beside it.
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
      recognition = createRecognition()
      recognition.onstart = () => { listening = true; baseText = document.querySelector<HTMLTextAreaElement>('.zyraxon-builder .composer textarea')?.value || ''; button.classList.add('is-listening'); status.textContent = `শুনছি… ${recognition.lang}`; status.hidden = false }
      recognition.onresult = (event: any) => {
        let interim = ''; let finalText = ''
        for (let i = event.resultIndex; i < event.results.length; i++) { const transcript = event.results[i][0]?.transcript || ''; if (event.results[i].isFinal) finalText += transcript; else interim += transcript }
        const textarea = document.querySelector<HTMLTextAreaElement>('.zyraxon-builder .composer textarea')
        if (textarea) setReactTextareaValue(textarea, `${baseText}${finalText}${interim}`)
      }
      recognition.onerror = (event: any) => {
        const err = event?.error || ''
        if (err === 'not-allowed' || err === 'service-not-allowed') { status.textContent = 'মাইক্রোফোনের অনুমতি দিন'; status.hidden = false }
        else if (err === 'language-not-supported' || err === 'no-speech') { languageIndex = (languageIndex + 1) % languages.length; status.textContent = `আবার চেষ্টা করছি (${languages[languageIndex]})`; status.hidden = false }
        else { status.textContent = 'Voice input বন্ধ হয়েছে'; status.hidden = false }
        setTimeout(() => { if (!listening) status.hidden = true }, 2200)
      }
      recognition.onend = () => {
        if (!listening) { button.classList.remove('is-listening'); status.hidden = true; return }
        window.setTimeout(() => { if (!listening) return; try { recognition = createRecognition(); attachRecognitionHandlers(recognition); recognition.start() } catch {} }, 120)
      }
      const attachRecognitionHandlers = (r: any) => {
        r.onstart = recognition.onstart; r.onresult = recognition.onresult; r.onerror = recognition.onerror; r.onend = recognition.onend
      }
      button.addEventListener('click', () => {
        if (listening) { listening = false; try { recognition.stop() } catch {} }
        else { listening = true; baseText = document.querySelector<HTMLTextAreaElement>('.zyraxon-builder .composer textarea')?.value || ''; try { recognition.start() } catch { listening = false } }
      })
    }

    observer = new MutationObserver(setupVoice)
    observer.observe(document.body, { childList: true, subtree: true })
    setupVoice()

    return () => {
      listening = false
      try { recognition?.stop() } catch {}
      observer?.disconnect()
      if (voiceButton?.parentElement) voiceButton.parentElement.remove()
      style.remove(); window.fetch = originalFetch
    }
  }, [])

  return <BuilderStudioMulti />
}
