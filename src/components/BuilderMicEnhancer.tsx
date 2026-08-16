import { useEffect } from 'react';

/** Keeps voice input physically attached to Send and feeds live speech into
 * the controlled builder textarea. Uses browser language preferences first,
 * then a multilingual fallback ladder when the recognition service reports
 * no speech / unavailable language. */
export default function BuilderMicEnhancer() {
  useEffect(() => {
    let disposed = false;
    let timer: number | undefined;
    let cleanup: (() => void) | undefined;

    const Speech = () => (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    const setReactValue = (el: HTMLTextAreaElement, value: string) => {
      const setter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value')?.set;
      if (setter) setter.call(el, value); else el.value = value;
      el.dispatchEvent(new Event('input', { bubbles: true }));
      el.dispatchEvent(new Event('change', { bubbles: true }));
    };

    const buildLanguageLadder = () => {
      const preferred = Array.isArray(navigator.languages) ? navigator.languages : [navigator.language];
      const normalize = (value: string) => {
        const v = String(value || '').trim();
        if (!v) return '';
        if (/^[a-z]{2}$/i.test(v)) return v.toLowerCase();
        return v;
      };
      const candidates = [
        ...preferred.map(normalize),
        'bn-BD', 'hi-IN', 'ur-PK', 'ar-SA', 'ta-IN', 'te-IN', 'ml-IN',
        'en-US', 'en-IN', 'es-ES', 'fr-FR', 'de-DE', 'pt-BR', 'id-ID',
        'tr-TR', 'it-IT', 'ja-JP', 'ko-KR', 'zh-CN', 'ru-RU'
      ].filter(Boolean);
      return [...new Set(candidates)];
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
      mic.title = 'Voice input · automatic language fallback';
      mic.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 14.5a3.5 3.5 0 0 0 3.5-3.5V6a3.5 3.5 0 0 0-7 0v5a3.5 3.5 0 0 0 3.5 3.5Zm-6-3.5a6 6 0 0 0 12 0M12 17v4m-3 0h6" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>';
      mic.style.cssText = [
        'width:37px','height:37px','min-width:37px','padding:0','margin:0','border-radius:12px',
        'border:1px solid rgba(255,255,255,.16)','background:rgba(255,255,255,.045)','color:inherit',
        'display:inline-flex','align-items:center','justify-content:center','cursor:pointer','flex:0 0 auto',
        'order:1','transition:transform .18s ease,background .18s ease,box-shadow .18s ease,opacity .18s ease'
      ].join(';');
      mic.querySelector('svg')?.setAttribute('style', 'width:18px;height:18px;display:block');

      // Put Mic and Send in the same physical action group. This prevents the
      // mic from drifting to the left when the composer layout changes.
      const sendParent = send.parentElement;
      if (!sendParent) return;
      const actionGroup = document.createElement('span');
      actionGroup.dataset.zyraxonVoiceActions = 'true';
      actionGroup.style.cssText = 'display:inline-flex;align-items:center;justify-content:flex-end;gap:7px;flex:0 0 auto;margin:0;padding:0;order:999;';
      sendParent.insertBefore(actionGroup, send);
      actionGroup.appendChild(mic);
      actionGroup.appendChild(send);
      send.style.order = '2';
      send.style.margin = '0';

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
        cleanup = () => { sendParent.insertBefore(send, actionGroup); actionGroup.remove(); };
        return;
      }

      const languages = buildLanguageLadder();
      let languageIndex = 0;
      let recognition: any = null;
      let active = false;
      let reconnectTimer: number | undefined;
      let committed = textarea.value || '';
      let lastResultAt = 0;

      const stop = () => {
        active = false;
        if (reconnectTimer) window.clearTimeout(reconnectTimer);
        reconnectTimer = undefined;
        try { recognition?.stop(); } catch {}
        setStatus('Voice input · click to speak');
      };

      const advanceLanguage = () => {
        if (languages.length < 2) return;
        languageIndex = (languageIndex + 1) % languages.length;
      };

      const startRecognition = () => {
        if (!active || disposed) return;
        const Ctor = Speech();
        if (!Ctor) return;
        recognition = new Ctor();
        recognition.lang = languages[languageIndex] || 'en-US';
        recognition.continuous = true;
        recognition.interimResults = true;
        recognition.maxAlternatives = 3;
        try { recognition.processLocally = false; } catch {}

        recognition.onstart = () => {
          active = true;
          setStatus(`Listening · ${recognition.lang} · automatic language fallback`, true);
          textarea.focus();
        };

        recognition.onresult = (event: any) => {
          let interim = '';
          let gotFinal = false;
          for (let i = event.resultIndex; i < event.results.length; i += 1) {
            const result = event.results[i];
            const transcript = result?.[0]?.transcript || '';
            if (result?.isFinal) {
              const clean = transcript.trim();
              if (clean) {
                committed += (committed && !/\s$/.test(committed) ? ' ' : '') + clean;
                gotFinal = true;
              }
            } else interim += transcript;
          }
          if (gotFinal) lastResultAt = Date.now();
          setReactValue(textarea, committed + (interim ? (committed && !/\s$/.test(committed) ? ' ' : '') + interim : ''));
          textarea.focus();
        };

        recognition.onerror = (event: any) => {
          const err = String(event?.error || '');
          if (err === 'not-allowed' || err === 'service-not-allowed') {
            active = false;
            setStatus('Microphone permission is blocked — allow microphone access and try again');
            return;
          }
          if (err === 'audio-capture') {
            active = false;
            setStatus('No microphone was detected');
            return;
          }
          // Browser speech recognition has a single `lang` per recognition
          // instance. When the service cannot recognize the current locale,
          // automatically move to the next common language without requiring
          // the user to open a language menu.
          if (err === 'language-not-supported' || err === 'language-unavailable' || err === 'no-speech' || err === 'nomatch') {
            advanceLanguage();
          }
        };

        recognition.onend = () => {
          if (!active || disposed) return;
          reconnectTimer = window.setTimeout(() => {
            if (!active || disposed) return;
            // If the service produced nothing for a short cycle, try another
            // language automatically. Once it produces a result, keep that
            // language for the rest of the current voice session.
            if (Date.now() - lastResultAt > 1800) advanceLanguage();
            try { startRecognition(); } catch { active = false; setStatus('Voice input · click to speak'); }
          }, 140);
        };

        try { recognition.start(); } catch { active = false; setStatus('Voice input · click to speak'); }
      };

      const start = () => {
        if (active) { stop(); return; }
        committed = textarea.value || '';
        lastResultAt = 0;
        // Start with the user's browser preference, then silently fall back
        // through the multilingual ladder if recognition cannot understand it.
        languageIndex = 0;
        active = true;
        startRecognition();
      };

      mic.addEventListener('click', start);
      cleanup = () => {
        active = false;
        if (reconnectTimer) window.clearTimeout(reconnectTimer);
        try { recognition?.abort(); } catch {}
        mic.removeEventListener('click', start);
        sendParent.insertBefore(send, actionGroup);
        actionGroup.remove();
      };
    };

    attach();
    timer = window.setInterval(() => {
      if (!document.querySelector('[data-zyraxon-mic]')) { cleanup?.(); cleanup = undefined; attach(); }
    }, 400);
    return () => { disposed = true; if (timer) window.clearInterval(timer); cleanup?.(); };
  }, []);
  return null;
}
