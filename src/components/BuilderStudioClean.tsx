import { useEffect } from 'react';
import BuilderStudioMulti from './BuilderStudioMulti';

const MODEL_ALIASES: Record<string, string> = {
  'MiMo V2.5 Free': 'ZYRAXON TITAN',
  'Nemotron 3 Super Free': 'ZYRAXON PHANTOM',
  'Big Pickle': 'ZYRAXON VELOCITY',
};

function setNativeValue(el: HTMLTextAreaElement, value: string) {
  const setter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value')?.set;
  setter?.call(el, value);
  el.dispatchEvent(new Event('input', { bubbles: true }));
  el.dispatchEvent(new Event('change', { bubbles: true }));
}

function clearClientData() {
  try { localStorage.clear(); } catch {}
  try { sessionStorage.clear(); } catch {}
  try { document.cookie.split(';').forEach(c => { const name = c.split('=')[0]?.trim(); if (name) document.cookie = `${name}=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=/`; }); } catch {}
}

export default function BuilderStudioClean() {
  useEffect(() => {
    const style = document.createElement('style');
    style.dataset.zyraxonCleanBuilder = 'true';
    style.textContent = `
      .zyraxon-clean-builder{height:100%;min-height:100vh;background:#050505;color:#f5f5f5}
      .zyraxon-clean-builder .glass,.zyraxon-clean-builder .message,.zyraxon-clean-builder .composer,.zyraxon-clean-builder .studio-pane,.zyraxon-clean-builder .preview-frame,.zyraxon-clean-builder .code-pane{background:linear-gradient(145deg,rgba(255,255,255,.105),rgba(255,255,255,.045) 46%,rgba(0,0,0,.52))!important;border:1.5px solid rgba(255,255,255,.16)!important;backdrop-filter:blur(44px) saturate(160%)!important;-webkit-backdrop-filter:blur(44px) saturate(160%)!important;box-shadow:inset 0 1px rgba(255,255,255,.13),0 22px 70px rgba(0,0,0,.46)!important}
      .zyraxon-clean-builder button{transition:transform .16s ease,background .16s ease,border-color .16s ease,box-shadow .16s ease}
      .zyraxon-clean-builder button:hover{transform:translateY(-1px)}
      .zyraxon-clean-builder .top-actions{position:relative!important;display:flex!important;align-items:center!important;gap:8px!important;overflow:visible!important}
      .zyraxon-clean-builder .zyraxon-account-stack{position:relative!important;display:flex!important;flex-direction:column!important;align-items:center!important;gap:4px!important;margin:0!important;z-index:20!important}
      .zyraxon-clean-builder .github-account-btn{position:relative!important;width:34px!important;height:34px!important;padding:0!important;display:grid!important;place-items:center!important;border-radius:10px!important;border:1.5px solid rgba(255,255,255,.16)!important;background:rgba(255,255,255,.06)!important;color:#fff!important;box-shadow:inset 0 1px rgba(255,255,255,.1),0 8px 24px rgba(0,0,0,.25)!important}
      .zyraxon-clean-builder .github-account-btn img{width:24px!important;height:24px!important;border-radius:7px!important;object-fit:cover!important}
      .zyraxon-clean-builder .reset-local-btn{position:relative!important;width:25px!important;height:22px!important;padding:0!important;display:grid!important;place-items:center!important;border-radius:8px!important;border:1px solid rgba(255,255,255,.11)!important;background:rgba(255,255,255,.035)!important;color:#8f8f98!important}
      .zyraxon-clean-builder .composer-row{display:flex!important;align-items:center!important;justify-content:flex-end!important;gap:8px!important;width:100%!important}
      .zyraxon-clean-builder .zyraxon-clean-actions{display:inline-flex!important;align-items:center!important;justify-content:flex-end!important;gap:7px!important;flex:0 0 auto!important;margin-left:auto!important;padding:0!important;order:999!important}
      .zyraxon-clean-builder .composer-row .send-btn{order:2!important;flex:0 0 auto!important;margin:0!important}
      .zyraxon-clean-builder .zyraxon-clean-voice{order:1!important;width:38px!important;height:38px!important;flex:0 0 38px!important;display:grid!important;place-items:center!important;border-radius:11px!important;border:1.5px solid rgba(255,255,255,.16)!important;background:rgba(255,255,255,.06)!important;color:#f4f4f5!important;box-shadow:inset 0 1px rgba(255,255,255,.1),0 8px 24px rgba(0,0,0,.22)!important;cursor:pointer!important}
      .zyraxon-clean-builder .zyraxon-clean-voice svg{width:18px!important;height:18px!important}
      .zyraxon-clean-builder .zyraxon-clean-voice[data-listening="true"]{background:rgba(255,255,255,.15)!important;box-shadow:0 0 0 3px rgba(255,255,255,.05),0 0 28px rgba(255,255,255,.14)!important}
      .zyraxon-clean-builder .zyraxon-clean-mic-note{position:absolute;right:0;bottom:46px;z-index:30;padding:7px 10px;border-radius:10px;border:1px solid rgba(255,255,255,.12);background:rgba(8,8,10,.9);backdrop-filter:blur(22px);font-size:11px;color:#bdbdc6;white-space:nowrap}
      .zyraxon-clean-builder .publish-modal input[placeholder="GitHub token"]{display:none!important}
      .zyraxon-clean-builder .connected-publish-note{font-size:11px;color:#a7a7b0;padding:8px 10px;border:1px solid rgba(255,255,255,.1);border-radius:10px;background:rgba(255,255,255,.035)}
      .zyraxon-clean-builder .messages,.zyraxon-clean-builder .chat-scroll{scroll-padding-bottom:80px!important}
      .zyraxon-clean-builder .preview-frame iframe{position:relative!important;z-index:1!important;pointer-events:auto!important;display:block!important;width:100%!important;height:100%!important;border:0!important}
      .zyraxon-clean-builder .preview-frame{isolation:isolate!important;overflow:hidden!important}
      .zyraxon-clean-builder .studio-tabs button,.zyraxon-clean-builder .device-tabs button,.zyraxon-clean-builder .model-btn,.zyraxon-clean-builder .mode-btn,.zyraxon-clean-builder .send-btn{border:1.5px solid rgba(255,255,255,.15)!important;background:rgba(255,255,255,.055)!important;box-shadow:inset 0 1px rgba(255,255,255,.09),0 8px 26px rgba(0,0,0,.2)!important}
    `;
    document.head.appendChild(style);

    let mic: HTMLButtonElement | null = null;
    let actionGroup: HTMLSpanElement | null = null;
    let recognition: any = null;
    let listening = false;
    let committed = '';
    let retryIndex = 0;
    let observer: MutationObserver | null = null;

    const aliasModels = () => {
      document.querySelectorAll<HTMLElement>('.zyraxon-clean-builder .model-btn,.zyraxon-clean-builder .model-pop button,[data-model-id]').forEach(el => {
        const original = el.dataset.zyraxonOriginalModelText || el.textContent || '';
        el.dataset.zyraxonOriginalModelText = original;
        let next = original;
        for (const [from, to] of Object.entries(MODEL_ALIASES)) next = next.replaceAll(from, to);
        if (next && next !== el.textContent) el.textContent = next;
      });
    };

    const findComposer = () => document.querySelector<HTMLElement>('.zyraxon-clean-builder .composer') || document.querySelector<HTMLElement>('.zyraxon-clean-builder textarea')?.closest('form')?.parentElement || null;
    const findRow = () => findComposer()?.querySelector<HTMLElement>('.composer-row') || document.querySelector<HTMLElement>('.zyraxon-clean-builder .composer-row') || null;
    const findTextarea = () => document.querySelector<HTMLTextAreaElement>('.zyraxon-clean-builder .composer textarea') || document.querySelector<HTMLTextAreaElement>('.zyraxon-clean-builder textarea');
    const findSend = () => document.querySelector<HTMLButtonElement>('.zyraxon-clean-builder .composer .send-btn') || document.querySelector<HTMLButtonElement>('.zyraxon-clean-builder .send-btn');

    const stopVoice = () => {
      listening = false;
      try { recognition?.stop(); } catch {}
      if (mic) { mic.dataset.listening = 'false'; mic.title = 'Voice input'; }
    };

    const languageCandidates = () => {
      const langs = Array.from(navigator.languages || []).map(x => x.toLowerCase());
      const map: Record<string,string> = { bn:'bn-BD', hi:'hi-IN', ur:'ur-PK', ar:'ar-SA', ta:'ta-IN', te:'te-IN', ml:'ml-IN', es:'es-ES', fr:'fr-FR', de:'de-DE', pt:'pt-BR', id:'id-ID', tr:'tr-TR', it:'it-IT', ja:'ja-JP', ko:'ko-KR', zh:'zh-CN', ru:'ru-RU', en:'en-US' };
      const out: string[] = [];
      for (const lang of langs) { const key = lang.split('-')[0]; if (map[key] && !out.includes(map[key])) out.push(map[key]); }
      for (const value of Object.values(map)) if (!out.includes(value)) out.push(value);
      return out;
    };

    const startVoice = () => {
      const Ctor = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      if (!Ctor) { if (mic) mic.title = 'Speech recognition is not supported by this browser'; return; }
      if (listening) { stopVoice(); return; }
      const textarea = findTextarea();
      if (!textarea) { if (mic) mic.title = 'Chat input is not available'; return; }
      committed = textarea.value || '';
      listening = true;
      retryIndex = 0;
      const candidates = languageCandidates();

      const run = () => {
        if (!listening) return;
        recognition = new Ctor();
        recognition.continuous = false;
        recognition.interimResults = true;
        recognition.maxAlternatives = 5;
        recognition.lang = candidates[retryIndex % Math.max(1, candidates.length)] || 'en-US';
        recognition.onstart = () => { if (mic) { mic.dataset.listening = 'true'; mic.title = `Listening · ${recognition.lang}`; } };
        recognition.onresult = (event: any) => {
          let interim = '';
          let finalText = '';
          for (let i = event.resultIndex; i < event.results.length; i++) {
            const result = event.results[i];
            const text = result?.[0]?.transcript || '';
            if (result?.isFinal) finalText += text;
            else interim += text;
          }
          const value = finalText.trim() ? committed + (committed && !/\s$/.test(committed) ? ' ' : '') + finalText.trim() : committed + (interim ? (committed && !/\s$/.test(committed) ? ' ' : '') + interim : '');
          setNativeValue(textarea, value);
          textarea.focus();
          if (finalText.trim()) committed = value;
        };
        recognition.onerror = (event: any) => {
          const error = String(event?.error || '');
          if (error === 'not-allowed' || error === 'service-not-allowed') { stopVoice(); if (mic) mic.title = 'Microphone permission was denied'; return; }
          if (error === 'audio-capture') { stopVoice(); if (mic) mic.title = 'No microphone was detected'; return; }
          if (error === 'language-not-supported' || error === 'language-unavailable' || error === 'no-speech' || error === 'nomatch') retryIndex++;
        };
        recognition.onend = () => {
          if (!listening) return;
          // Try the next browser-supported language only when the current
          // recognition cycle produced no final transcript.
          if (committed === textarea.value || !textarea.value.trim()) retryIndex++;
          if (retryIndex < candidates.length) window.setTimeout(run, 120);
          else stopVoice();
        };
        try { recognition.start(); } catch { stopVoice(); }
      };
      run();
    };

    const setupMic = () => {
      const row = findRow();
      const send = findSend();
      if (!row || !send) return;
      document.querySelectorAll<HTMLElement>('.zyraxon-clean-builder .voice-btn').forEach(el => el.remove());
      if (!mic || !mic.isConnected) {
        mic = document.createElement('button');
        mic.type = 'button';
        mic.className = 'zyraxon-clean-voice';
        mic.setAttribute('aria-label', 'Voice input');
        mic.title = 'Voice input';
        mic.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5 11a7 7 0 0 0 14 0M12 18v3M8 21h8"/></svg>';
        mic.addEventListener('click', startVoice);
      }
      if (!actionGroup || !actionGroup.isConnected) {
        actionGroup = document.createElement('span');
        actionGroup.className = 'zyraxon-clean-actions';
      }
      actionGroup.appendChild(mic);
      actionGroup.appendChild(send);
      row.appendChild(actionGroup);
    };

    const setupAccount = () => {
      const host = document.querySelector<HTMLElement>('.zyraxon-clean-builder .top-actions');
      if (!host) return;
      document.querySelectorAll<HTMLElement>('.zyraxon-clean-builder .github-account-btn,.zyraxon-clean-builder .reset-local-btn').forEach(el => el.closest('.zyraxon-account-stack')?.remove());
      let stack = host.querySelector<HTMLElement>('.zyraxon-clean-account');
      if (!stack) {
        stack = document.createElement('div'); stack.className = 'zyraxon-account-stack zyraxon-clean-account';
        const login = document.createElement('button'); login.type='button'; login.className='github-account-btn'; login.title='Sign in with GitHub'; login.setAttribute('aria-label','Sign in with GitHub');
        login.addEventListener('click', () => window.location.assign('/api/public/auth/github/start'));
        const reset = document.createElement('button'); reset.type='button'; reset.className='reset-local-btn'; reset.title='Reset local session and data'; reset.setAttribute('aria-label','Reset local session and data');
        reset.innerHTML='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18M9 6V4h6v2m-9 0 1 15h10l1-15M10 11v6m4-6v6"/></svg>';
        reset.addEventListener('click', async () => { if (!window.confirm('Reset this ZYRAXON session and all local builder data?')) return; try { await fetch('/api/public/auth/github/logout',{method:'POST',credentials:'include'}); } catch {} clearClientData(); window.location.replace('/builder'); });
        stack.append(login, reset); host.appendChild(stack);
        fetch('/api/public/auth/github/me',{credentials:'include'}).then(r=>r.ok?r.json():null).then(body=>{ if(!body?.user)return; login.innerHTML=body.user.avatar_url?`<img src="${String(body.user.avatar_url).replace(/"/g,'&quot;')}" alt="">`:'<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 .5A11.5 11.5 0 0 0 8.36 23c.58.11.79-.25.79-.56v-2.02c-3.22.7-3.9-1.56-3.9-1.56-.53-1.37-1.29-1.73-1.29-1.73-1.05-.72.08-.71.08-.71 1.16.08 1.77 1.2 1.77 1.2 1.03 1.76 2.69 1.25 3.34.96.1-.75.4-1.25.73-1.54-2.57-.29-5.28-1.29-5.28-5.73 0-1.27.45-2.3 1.19-3.11.12-.29-.52-1.47.11-3.06 0 0 .97-.31 3.18 1.19a11 11 0 0 1 5.79 0c2.21-1.5 3.18-1.19 3.18-1.19.63 1.59.23 2.77.11 3.06.74.81.78 2.12.78 3.15 0 .31.21.68.78.56A11.5 11.5 0 0 0 12 .5Z"/></svg>'; login.title=`GitHub · @${body.user.login}`; }).catch(()=>{});
      }
    };

    const cleanupOAuthQuery = () => {
      const params = new URLSearchParams(window.location.search);
      if (params.has('github') || params.has('github_error')) {
        const path = window.location.pathname + window.location.hash;
        window.history.replaceState({}, document.title, path);
      }
    };

    const setup = () => { cleanupOAuthQuery(); aliasModels(); setupMic(); setupAccount(); };
    setup();
    observer = new MutationObserver(setup);
    observer.observe(document.body, { childList: true, subtree: true });

    return () => {
      observer?.disconnect();
      try { recognition?.abort(); } catch {}
      if (actionGroup?.parentElement) actionGroup.parentElement.appendChild(actionGroup.querySelector('.send-btn') || document.createElement('span'));
      style.remove();
    };
  }, []);

  return <div className="zyraxon-clean-builder"><BuilderStudioMulti /></div>;
}
