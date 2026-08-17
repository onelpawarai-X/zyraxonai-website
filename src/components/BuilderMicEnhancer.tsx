import { useEffect } from 'react';

/**
 * One-click/toggle voice input for the Builder composer.
 * The existing Builder mic button is reused; no popup or second Start button.
 * Click 1: start recording. Click 2: stop -> STT -> append full transcript.
 */
export default function BuilderMicEnhancer() {
  useEffect(() => {
    let disposed = false;
    let timer: number | undefined;
    let cleanup: (() => void) | undefined;

    const setReactValue = (el: HTMLTextAreaElement, value: string) => {
      const setter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value')?.set;
      setter?.call(el, value);
      el.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertText', data: null }));
      el.dispatchEvent(new Event('change', { bubbles: true }));
    };

    const findMic = () => {
      const candidates = Array.from(document.querySelectorAll<HTMLButtonElement>('button')).filter((button) => {
        const svg = button.querySelector('svg.lucide-mic');
        return !!svg;
      });
      if (!candidates.length) return null;
      // The first Mic button is the Builder/model-area control. Remove any
      // duplicate legacy Send-area microphone so only one remains.
      const keep = candidates[0]!;
      candidates.slice(1).forEach((button) => {
        if (button !== keep) {
          button.dataset.zyraxonLegacyMic = 'true';
          button.style.display = 'none';
        }
      });
      return keep;
    };

    const attach = () => {
      if (disposed) return;
      const mic = findMic();
      const textarea = document.querySelector<HTMLTextAreaElement>('.zb-composer textarea, .composer textarea, textarea');
      if (!mic || !textarea || mic.dataset.zyraxonVoiceBound === 'true') return;

      mic.dataset.zyraxonVoiceBound = 'true';
      mic.type = 'button';
      mic.setAttribute('aria-label', 'Start voice recording');
      mic.title = 'Click to start recording';

      let recorder: MediaRecorder | null = null;
      let stream: MediaStream | null = null;
      let chunks: Blob[] = [];
      let recording = false;
      let baseText = textarea.value || '';

      const visual = (on: boolean) => {
        mic.classList.toggle('active', on);
        mic.setAttribute('aria-label', on ? 'Stop voice recording' : 'Start voice recording');
        mic.title = on ? 'Recording… click again to stop and insert text' : 'Click to start recording';
        mic.style.background = on ? 'rgba(0,245,255,.14)' : '';
        mic.style.boxShadow = on ? '0 0 0 4px rgba(0,245,255,.08),0 0 28px rgba(0,245,255,.22)' : '';
      };

      const reset = () => {
        recording = false;
        visual(false);
        if (stream) stream.getTracks().forEach((track) => track.stop());
        stream = null;
        recorder = null;
      };

      const stop = () => {
        if (!recording) return;
        recording = false;
        visual(false);
        try { recorder?.stop(); } catch { reset(); }
      };

      const start = async () => {
        if (recording) { stop(); return; }
        if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') {
          mic.title = 'Voice recording is not supported by this browser';
          return;
        }
        try {
          baseText = textarea.value || '';
          chunks = [];
          stream = await navigator.mediaDevices.getUserMedia({ audio: true });
          if (disposed) { stream.getTracks().forEach((track) => track.stop()); return; }
          const preferred = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4'].find((type) => MediaRecorder.isTypeSupported(type));
          recorder = new MediaRecorder(stream, preferred ? { mimeType: preferred } : undefined);
          recorder.ondataavailable = (event) => { if (event.data?.size) chunks.push(event.data); };
          recorder.onerror = () => { reset(); mic.title = 'Recording failed. Click to try again'; };
          recorder.onstop = async () => {
            const activeRecorder = recorder;
            const blob = new Blob(chunks, { type: activeRecorder?.mimeType || 'audio/webm' });
            reset();
            if (!blob.size) return;
            mic.title = 'Transcribing…';
            try {
              const form = new FormData();
              form.append('file', blob, 'zyraxon-voice.webm');
              form.append('language', 'bn');
              const response = await fetch('/api/public/stt', { method: 'POST', body: form });
              const data = await response.json().catch(() => ({}));
              if (!response.ok || !data?.success || !data?.text) throw new Error(data?.error || 'Transcription failed');
              const transcript = String(data.text).trim();
              if (transcript) setReactValue(textarea, `${baseText}${baseText ? ' ' : ''}${transcript}`);
              textarea.focus();
            } catch (error) {
              mic.title = error instanceof Error ? error.message : 'Voice transcription failed';
            } finally {
              if (!disposed) {
                visual(false);
                if (!recording) mic.title = 'Click to start recording';
              }
            }
          };
          recorder.start(200);
          recording = true;
          visual(true);
          textarea.focus();
        } catch {
          reset();
          mic.title = 'Microphone permission was denied or unavailable';
        }
      };

      // Capture phase prevents the old popup/device-picker handler from firing.
      const onClick = (event: Event) => {
        event.preventDefault();
        event.stopPropagation();
        void start();
      };
      mic.addEventListener('click', onClick, true);

      cleanup = () => {
        mic.removeEventListener('click', onClick, true);
        try { recorder?.stop(); } catch {}
        stream?.getTracks().forEach((track) => track.stop());
        mic.removeAttribute('data-zyraxon-voice-bound');
        mic.style.background = '';
        mic.style.boxShadow = '';
        mic.disabled = false;
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
    }, 400);

    return () => {
      disposed = true;
      if (timer) window.clearInterval(timer);
      cleanup?.();
    };
  }, []);

  return null;
}
