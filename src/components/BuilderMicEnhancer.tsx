import { useEffect } from 'react';

/**
 * One-click voice input for the Builder composer.
 * Click once: record immediately in the background.
 * Click again: stop recording, transcribe the complete clip, and insert it
 * into the chat composer. No microphone modal or second Start Recording button.
 */
export default function BuilderMicEnhancer() {
  useEffect(() => {
    let disposed = false;
    let timer: number | undefined;
    let cleanup: (() => void) | undefined;

    const setReactValue = (el: HTMLTextAreaElement, value: string) => {
      const setter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value')?.set;
      if (setter) setter.call(el, value);
      else el.value = value;
      el.dispatchEvent(new Event('input', { bubbles: true }));
      el.dispatchEvent(new Event('change', { bubbles: true }));
    };

    const findMic = (composer: HTMLElement) => Array.from(composer.querySelectorAll<HTMLButtonElement>('button.circle-btn')).find((button) => {
      const title = (button.title || button.getAttribute('aria-label') || '').toLowerCase();
      return title.includes('microphone') || title.includes('voice');
    });

    const attach = () => {
      if (disposed) return;
      const composer = document.querySelector<HTMLElement>('.composer');
      const textarea = composer?.querySelector<HTMLTextAreaElement>('textarea');
      const mic = composer ? findMic(composer) : undefined;
      if (!composer || !textarea || !mic || mic.dataset.zyraxonVoiceBound === 'true') return;

      mic.dataset.zyraxonVoiceBound = 'true';
      mic.setAttribute('aria-label', 'Start voice recording');
      mic.title = 'Click to start recording';

      let recorder: MediaRecorder | null = null;
      let stream: MediaStream | null = null;
      let chunks: Blob[] = [];
      let active = false;
      let stopTimer: number | undefined;

      const setVisual = (recording: boolean) => {
        mic.classList.toggle('active', recording);
        mic.setAttribute('aria-label', recording ? 'Stop voice recording' : 'Start voice recording');
        mic.title = recording ? 'Recording… click to stop and insert transcript' : 'Click to start recording';
        mic.style.background = recording ? 'rgba(0,245,255,.14)' : '';
        mic.style.boxShadow = recording ? '0 0 0 4px rgba(0,245,255,.08),0 0 28px rgba(0,245,255,.22)' : '';
      };

      const reset = () => {
        active = false;
        recorder = null;
        if (stopTimer) window.clearTimeout(stopTimer);
        stopTimer = undefined;
        stream?.getTracks().forEach(track => track.stop());
        stream = null;
        setVisual(false);
      };

      const stop = () => {
        if (!recorder || recorder.state === 'inactive') {
          reset();
          return;
        }
        try { recorder.stop(); } catch { reset(); }
      };

      const start = async () => {
        if (active) {
          stop();
          return;
        }
        if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') {
          mic.title = 'Voice recording is not supported by this browser';
          return;
        }
        try {
          stream = await navigator.mediaDevices.getUserMedia({ audio: true });
          if (disposed) {
            stream.getTracks().forEach(track => track.stop());
            return;
          }
          const preferred = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4'].find(type => MediaRecorder.isTypeSupported(type));
          recorder = new MediaRecorder(stream, preferred ? { mimeType: preferred } : undefined);
          chunks = [];
          active = true;
          setVisual(true);

          recorder.ondataavailable = event => {
            if (event.data?.size) chunks.push(event.data);
          };
          recorder.onerror = () => {
            mic.title = 'Voice recording failed';
            reset();
          };
          recorder.onstop = async () => {
            const currentRecorder = recorder;
            const blob = new Blob(chunks, { type: currentRecorder?.mimeType || 'audio/webm' });
            stream?.getTracks().forEach(track => track.stop());
            stream = null;
            recorder = null;
            active = false;
            setVisual(false);
            if (!blob.size || disposed) return;

            try {
              const form = new FormData();
              form.append('file', blob, 'zyraxon-voice.webm');
              form.append('language', 'bn');
              const response = await fetch('/api/public/stt', { method: 'POST', body: form });
              const data = await response.json().catch(() => null);
              if (!response.ok || !data?.success || !String(data.text || '').trim()) {
                mic.title = data?.error || 'Voice transcription failed';
                return;
              }
              const transcript = String(data.text).trim();
              const existing = textarea.value.trimEnd();
              setReactValue(textarea, existing ? `${existing} ${transcript}` : transcript);
              textarea.focus();
            } catch {
              mic.title = 'Voice transcription is unavailable right now';
            }
          };

          recorder.start(250);
          // Safety cap only; normal operation is ended by the second click.
          stopTimer = window.setTimeout(() => {
            if (active) stop();
          }, 120000);
        } catch (error) {
          reset();
          mic.title = error instanceof DOMException && error.name === 'NotAllowedError'
            ? 'Microphone permission is blocked'
            : 'Could not start microphone recording';
        }
      };

      // Capture before React's old modal-opening handler. This turns the
      // existing composer mic into the complete one-click/two-click flow.
      const onClick = (event: Event) => {
        event.preventDefault();
        event.stopPropagation();
        void start();
      };
      mic.addEventListener('click', onClick, true);

      cleanup = () => {
        if (stopTimer) window.clearTimeout(stopTimer);
        try { recorder?.stop(); } catch {}
        stream?.getTracks().forEach(track => track.stop());
        recorder = null;
        stream = null;
        active = false;
        mic.removeEventListener('click', onClick, true);
        mic.removeAttribute('data-zyraxon-voice-bound');
        mic.style.background = '';
        mic.style.boxShadow = '';
      };
    };

    attach();
    timer = window.setInterval(() => {
      if (disposed) return;
      const bound = document.querySelector('button[data-zyraxon-voice-bound="true"]');
      if (!bound) {
        cleanup?.();
        cleanup = undefined;
        attach();
      }
    }, 400);

    return () => {
      disposed = true;
      if (timer) window.clearInterval(timer);
      cleanup?.();
    };
  }, []);

  return null;
}
