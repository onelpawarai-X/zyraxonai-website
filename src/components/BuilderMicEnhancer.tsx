import { useEffect } from 'react';

/** Places the microphone immediately before Send and feeds live Web Speech
 * transcripts into the controlled builder textarea. */
export default function BuilderMicEnhancer() {
  useEffect(() => {
    let disposed = false;
    let timer: number | undefined;
    let cleanup: (() => void) | undefined;
    let recognition: any = null;
    let active = false;
    let reconnectTimer: number | undefined;

    const Speech = () => (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    const languages = ['bn-BD', 'hi-IN', 'en-US', 'en-IN'];

    const setReactValue = (el: HTMLTextAreaElement, value: string) => {
      const setter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value')?.set;
      if (setter) setter.call(el, value); else el.value = value;
      el.dispatchEvent(new Event('input', { bubbles: true }));
      el.dispatchEvent(new Event('change', { bubbles: true }));
    };

    const attach = () => {
      if (disposed) return;
      const composer = document.querySelector<HTMLElement>('.zb-composer, .composer');
      const textarea = composer?.querySelector<HTMLTextAreaElement>('textarea');
      const send = composer?.querySelector<HTMLButtonElement>('button.send, button.send-btn');
      if (!composer || !textarea || !send) return;
      if (composer.querySelector('[data-zyraxon-mic]')) return;

      const SpeechCtor = Speech();
      const mic = document.createElement('button');
      mic.type = 'button';
      mic.dataset.zyraxonMic = 'true';
      mic.setAttribute('aria-label', 'Start voice input');
      mic.title = 'Voice input';
      mic.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 14.5a3.5 3.5 0 0 0 3.5-3.5V6a3.5 3.5 0 0 0-7 0v5a3.5 3.5 0 0 0 3.5 3.5Zm-6-3.5a6 6 0 0 0 12 0M12 17v4m-3 0h6" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>';
      mic.style.cssText = [
        'width:37px','height:37px','min-width:37px','padding:0','margin:0','border-radius:12px',
        'border:1px solid rgba(255,255,255,.16)','background:rgba(255,255,255,.045)','color:inherit',
        'display:inline-flex','align-items:center','justify-content:center','cursor:pointer','flex:0 0 auto',
        'order:2','transition:transform .18s ease,background .18s ease,box-shadow .18s ease,opacity .18s ease'
      ].join(';');
      mic.querySelector('svg')?.setAttribute('style', 'width:18px;height:18px;display:block');
      send.style.order = '3';
      send.parentElement?.insertBefore(mic, send);

      const setStatus = (text: string, listening = false) => {
        mic.title = text;
        mic.setAttribute('aria-label', text);
        mic.style.background = listening ? 'rgba(255,255,255,.13)' : 'rgba(255,255,255,.045)';
        mic.style.boxShadow = listening ? '0 0 0 4px rgba(255,255,255,.055),0 0 28px rgba(255,255,255,.18)' : 'none';
        mic.style.transform = listening ? 'translateY(-1px)' : 'translateY(0)';
      };

      if (!SpeechCtor) {
        mic.disabled = true;
        mic.style.opacity = '.45';
        setStatus('Voice input is not supported by this browser');
        cleanup = () => mic.remove();
        return;
      }

      let languageIndex = 0;
      const browserLanguage = (navigator.language || '').toLowerCase();
      if (browserLanguage.startsWith('bn')) languageIndex = 0;
      else if (browserLanguage.startsWith('hi')) languageIndex = 1;
      else if (browserLanguage.startsWith('en-in')) languageIndex = 3;
      else if (browserLanguage.startsWith('en')) languageIndex = 2;

      const stop = () => {
        active = false;
        if (reconnectTimer) window.clearTimeout(reconnectTimer);
        reconnectTimer = undefined;
        try { recognition?.stop(); } catch {}
        setStatus('Voice input');
      };

      const start = () => {
        if (active) { stop(); return; }
        const Ctor = Speech();
        if (!Ctor) return;
        recognition = new Ctor();
        recognition.lang = languages[languageIndex] || 'bn-BD';
        recognition.continuous = true;
        recognition.interimResults = true;
        recognition.maxAlternatives = 3;
        let committed = textarea.value || '';

        recognition.onstart = () => { active = true; setStatus(`Listening · ${recognition.lang} · click to stop`, true); textarea.focus(); };
        recognition.onresult = (event: any) => {
          let interim = '';
          for (let i = event.resultIndex; i < event.results.length; i += 1) {
            const result = event.results[i];
            const transcript = result?.[0]?.transcript || '';
            if (result?.isFinal) {
              const clean = transcript.trim();
              if (clean) committed += (committed && !/\s$/.test(committed) ? ' ' : '') + clean;
            } else interim += transcript;
          }
          setReactValue(textarea, committed + (interim ? (committed && !/\s$/.test(committed) ? ' ' : '') + interim : ''));
          textarea.focus();
        };
        recognition.onerror = (event: any) => {
          const err = String(event?.error || '');
          if (err === 'not-allowed' || err === 'service-not-allowed') { active = false; setStatus('Microphone permission blocked — allow microphone access and try again'); return; }
          if (err === 'audio-capture') { active = false; setStatus('No microphone was detected'); return; }
          if (err === 'language-not-supported' || err === 'network' || err === 'no-speech') languageIndex = (languageIndex + 1) % languages.length;
        };
        recognition.onend = () => {
          if (!active || disposed) return;
          reconnectTimer = window.setTimeout(() => { if (!active || disposed) return; try { recognition.start(); } catch { active = false; setStatus('Voice input — click again to start'); } }, 120);
        };
        try { recognition.start(); } catch { active = false; setStatus('Voice input — click again to start'); }
      };

      mic.addEventListener('click', start);
      mic.addEventListener('contextmenu', (event) => { event.preventDefault(); languageIndex = (languageIndex + 1) % languages.length; setStatus(`Voice language: ${languages[languageIndex]} · click to start`); });
      cleanup = () => { active = false; if (reconnectTimer) window.clearTimeout(reconnectTimer); try { recognition?.abort(); } catch {} mic.removeEventListener('click', start); mic.remove(); };
    };

    attach();
    timer = window.setInterval(() => {
      if (!document.querySelector('[data-zyraxon-mic]')) { cleanup?.(); cleanup = undefined; attach(); }
    }, 400);
    return () => { disposed = true; if (timer) window.clearInterval(timer); cleanup?.(); try { recognition?.abort(); } catch {} };
  }, []);
  return null;
}
