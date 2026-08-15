import { useEffect } from 'react';

/** Adds a real Web Speech API microphone to the existing builder composer without moving the send button. */
export default function BuilderMicEnhancer() {
  useEffect(() => {
    let disposed = false;
    let timer = 0;
    let recognition: any = null;
    let active = false;
    let languageIndex = 0;
    const languages = ['bn-BD', 'hi-IN', 'en-US', 'en-IN'];

    const setReactValue = (el: HTMLTextAreaElement, value: string) => {
      const setter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value')?.set;
      setter?.call(el, value);
      el.dispatchEvent(new Event('input', { bubbles: true }));
    };

    const attach = () => {
      if (disposed) return;
      const composer = document.querySelector<HTMLElement>('.zb-composer');
      const textarea = composer?.querySelector<HTMLTextAreaElement>('textarea');
      const send = composer?.querySelector<HTMLButtonElement>('button.send');
      if (!composer || !textarea || !send || composer.querySelector('[data-zyraxon-mic]')) return;

      const Speech = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      const mic = document.createElement('button');
      mic.type = 'button';
      mic.dataset.zyraxonMic = 'true';
      mic.setAttribute('aria-label', 'Voice input');
      mic.title = 'Voice input';
      mic.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 14.5a3.5 3.5 0 0 0 3.5-3.5V6a3.5 3.5 0 0 0-7 0v5a3.5 3.5 0 0 0 3.5 3.5Zm-6-3.5a6 6 0 0 0 12 0M12 17v4m-3 0h6" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>';
      mic.style.cssText = 'width:38px;height:38px;border-radius:12px;border:1px solid rgba(255,255,255,.12);background:rgba(255,255,255,.045);color:#f5f5f7;display:inline-flex;align-items:center;justify-content:center;cursor:pointer;transition:.2s;flex:0 0 auto;';
      mic.querySelector('svg')!.setAttribute('style', 'width:19px;height:19px');
      send.parentElement?.insertBefore(mic, send);

      const setStatus = (text: string) => {
        mic.title = text;
        mic.setAttribute('aria-label', text);
      };

      if (!Speech) {
        mic.disabled = true;
        mic.style.opacity = '.45';
        setStatus('Voice input is not supported by this browser');
        return;
      }

      const stop = () => {
        active = false;
        try { recognition?.stop(); } catch {}
        mic.style.background = 'rgba(255,255,255,.045)';
        mic.style.boxShadow = 'none';
        setStatus('Voice input');
      };

      const start = () => {
        if (active) return stop();
        recognition = new Speech();
        const preferred = navigator.language?.toLowerCase();
        const preferredLang = preferred?.startsWith('bn') ? 'bn-BD' : preferred?.startsWith('hi') ? 'hi-IN' : preferred?.startsWith('en') ? preferred : languages[languageIndex] || 'bn-BD';
        recognition.lang = preferredLang;
        recognition.continuous = true;
        recognition.interimResults = true;
        recognition.maxAlternatives = 3;
        let committed = textarea.value;

        recognition.onstart = () => {
          active = true;
          mic.style.background = 'rgba(255,255,255,.12)';
          mic.style.boxShadow = '0 0 0 4px rgba(255,255,255,.055), 0 0 26px rgba(185,156,255,.25)';
          setStatus(`Listening (${recognition.lang}) — click to stop`);
        };
        recognition.onresult = (event: any) => {
          let interim = '';
          for (let i = event.resultIndex; i < event.results.length; i++) {
            const text = event.results[i]?.[0]?.transcript || '';
            if (event.results[i].isFinal) committed += (committed && !/\s$/.test(committed) ? ' ' : '') + text.trim();
            else interim += text;
          }
          setReactValue(textarea, `${committed}${interim ? (committed && !/\s$/.test(committed) ? ' ' : '') + interim : ''}`);
          textarea.focus();
        };
        recognition.onerror = (event: any) => {
          const err = event?.error || '';
          if (err === 'not-allowed' || err === 'service-not-allowed') {
            active = false;
            setStatus('Microphone permission is blocked — allow microphone access and try again');
            return;
          }
          if (err === 'language-not-supported' || err === 'no-speech' || err === 'network') languageIndex = (languageIndex + 1) % languages.length;
        };
        recognition.onend = () => {
          if (!active || disposed) return;
          window.setTimeout(() => { if (active && !disposed) { try { recognition.start(); } catch {} } }, 120);
        };
        try { recognition.start(); } catch { stop(); }
      };

      mic.addEventListener('click', start);
      return () => {
        active = false;
        try { recognition?.abort(); } catch {}
        mic.removeEventListener('click', start);
        mic.remove();
      };
    };

    timer = window.setInterval(() => attach(), 700);
    attach();
    return () => {
      disposed = true;
      window.clearInterval(timer);
      try { recognition?.abort(); } catch {}
    };
  }, []);

  return null;
}
