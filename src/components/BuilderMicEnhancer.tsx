import { useEffect } from 'react';

/**
 * Owns the single microphone button already rendered beside the model selector.
 * It intentionally does not create another mic beside Send.
 *
 * UX: click once -> recording starts immediately; click again -> recording
 * stops and the complete transcript is placed into the composer. Clicking it
 * again starts a fresh recording. No popup and no separate Start Recording
 * button are used.
 */
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

    const attach = () => {
      if (disposed) return;
      const composer = document.querySelector<HTMLElement>('.zb-composer, .composer');
      const textarea = composer?.querySelector<HTMLTextAreaElement>('textarea');
      if (!composer || !textarea) return;

      // Remove any legacy enhancer mic that may still exist after a hot reload.
      composer.querySelectorAll('[data-zyraxon-mic]').forEach((node) => node.remove());

      const mic = Array.from(composer.querySelectorAll<HTMLButtonElement>('button.circle-btn')).find((button) => {
        const svg = button.querySelector('svg');
        return !!svg && /Microphone/i.test(button.title || '') || !!svg?.querySelector('path[d*="M12 14.5"]');
      });
      if (!mic || mic.dataset.zyraxonVoiceBound === 'true') return;
      mic.dataset.zyraxonVoiceBound = 'true';
      mic.setAttribute('aria-label', 'Start voice input');
      mic.title = 'Click to start voice input';

      const SpeechCtor = Speech();
      if (!SpeechCtor) {
        mic.disabled = true;
        mic.style.opacity = '.45';
        mic.title = 'Voice input is not supported by this browser';
        cleanup = () => { mic.disabled = false; mic.style.opacity = ''; };
        return;
      }

      let recognition: any = null;
      let active = false;
      let committed = textarea.value || '';
      let interim = '';

      const render = () => {
        const suffix = interim.trim();
        const value = committed + (suffix ? (committed && !/\s$/.test(committed) ? ' ' : '') + suffix : '');
        setReactValue(textarea, value);
      };

      const setVisual = (listening: boolean) => {
        mic.classList.toggle('active', listening);
        mic.setAttribute('aria-label', listening ? 'Stop voice input' : 'Start voice input');
        mic.title = listening ? 'Recording… click to stop and insert transcript' : 'Click to start voice input';
        mic.style.background = listening ? 'rgba(0,245,255,.14)' : '';
        mic.style.boxShadow = listening ? '0 0 0 4px rgba(0,245,255,.08),0 0 28px rgba(0,245,255,.22)' : '';
      };

      const stop = () => {
        active = false;
        interim = '';
        try { recognition?.stop(); } catch {}
        recognition = null;
        setVisual(false);
        render();
        textarea.focus();
      };

      const start = () => {
        if (active) { stop(); return; }
        committed = textarea.value || '';
        interim = '';
        recognition = new SpeechCtor();
        recognition.lang = navigator.language || 'bn-BD';
        recognition.continuous = true;
        recognition.interimResults = true;
        recognition.maxAlternatives = 1;
        active = true;
        setVisual(true);
        textarea.focus();

        recognition.onresult = (event: any) => {
          let live = '';
          for (let i = event.resultIndex; i < event.results.length; i += 1) {
            const result = event.results[i];
            const transcript = String(result?.[0]?.transcript || '');
            if (result?.isFinal) {
              const clean = transcript.trim();
              if (clean) committed += (committed && !/\s$/.test(committed) ? ' ' : '') + clean;
            } else {
              live += transcript;
            }
          }
          interim = live;
          render();
          textarea.focus();
        };

        recognition.onerror = (event: any) => {
          const error = String(event?.error || '');
          if (error === 'not-allowed' || error === 'service-not-allowed') {
            active = false;
            setVisual(false);
            mic.title = 'Microphone permission is blocked';
            return;
          }
          if (error === 'audio-capture') {
            active = false;
            setVisual(false);
            mic.title = 'No microphone was detected';
          }
        };

        recognition.onend = () => {
          if (!active || disposed) return;
          // Some browsers end recognition automatically. Restart it while the
          // user is still in the same recording session so one click remains
          // one continuous recording action.
          window.setTimeout(() => {
            if (!active || disposed) return;
            try { recognition = new SpeechCtor(); startRecognitionHandlers(); recognition.start(); } catch { active = false; setVisual(false); }
          }, 80);
        };

        const startRecognitionHandlers = () => {
          if (!recognition) return;
          recognition.lang = navigator.language || 'bn-BD';
          recognition.continuous = true;
          recognition.interimResults = true;
          recognition.maxAlternatives = 1;
          recognition.onresult = (event: any) => {
            let live = '';
            for (let i = event.resultIndex; i < event.results.length; i += 1) {
              const result = event.results[i];
              const transcript = String(result?.[0]?.transcript || '');
              if (result?.isFinal) {
                const clean = transcript.trim();
                if (clean) committed += (committed && !/\s$/.test(committed) ? ' ' : '') + clean;
              } else live += transcript;
            }
            interim = live;
            render();
          };
          recognition.onerror = (event: any) => {
            const error = String(event?.error || '');
            if (error === 'not-allowed' || error === 'service-not-allowed' || error === 'audio-capture') {
              active = false;
              setVisual(false);
            }
          };
          recognition.onend = () => {
            if (!active || disposed) return;
            window.setTimeout(() => {
              if (!active || disposed) return;
              try { recognition = new SpeechCtor(); startRecognitionHandlers(); recognition.start(); } catch { active = false; setVisual(false); }
            }, 80);
          };
        };

        startRecognitionHandlers();
        try { recognition.start(); } catch { active = false; setVisual(false); }
      };

      // Capture phase prevents BuilderStudioV8's old modal-opening onClick from
      // firing. The same physical button now performs the complete voice flow.
      mic.addEventListener('click', (event) => {
        event.preventDefault();
        event.stopPropagation();
        start();
      }, true);

      cleanup = () => {
        active = false;
        try { recognition?.abort(); } catch {}
        recognition = null;
        mic.removeAttribute('data-zyraxon-voice-bound');
        mic.disabled = false;
        mic.style.background = '';
        mic.style.boxShadow = '';
      };
    };

    attach();
    timer = window.setInterval(() => {
      if (disposed) return;
      if (!document.querySelector('button[data-zyraxon-voice-bound="true"]')) {
        cleanup?.();
        cleanup = undefined;
        attach();
      }
    }, 500);

    return () => {
      disposed = true;
      if (timer) window.clearInterval(timer);
      cleanup?.();
    };
  }, []);

  return null;
}
