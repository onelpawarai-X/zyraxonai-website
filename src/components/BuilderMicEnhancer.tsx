import { useEffect } from 'react';

/** One-click background recording: click once to start, click again to stop and transcribe. */
export default function BuilderMicEnhancer() {
  useEffect(() => {
    let disposed = false;
    let timer: number | undefined;
    let cleanup: (() => void) | undefined;

    const setReactValue = (el: HTMLTextAreaElement, value: string) => {
      const setter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value')?.set;
      if (setter) setter.call(el, value); else el.value = value;
      el.dispatchEvent(new Event('input', { bubbles: true }));
      el.dispatchEvent(new Event('change', { bubbles: true }));
    };

    const attach = () => {
      if (disposed) return;
      const composer = document.querySelector<HTMLElement>('.composer');
      const textarea = composer?.querySelector<HTMLTextAreaElement>('textarea');
      const mic = composer ? Array.from(composer.querySelectorAll<HTMLButtonElement>('button.circle-btn')).find(button => {
        const label = `${button.title} ${button.getAttribute('aria-label')}`.toLowerCase();
        return label.includes('microphone') || label.includes('voice');
      }) : undefined;
      if (!composer || !textarea || !mic || mic.dataset.zyraxonVoiceBound === 'true') return;

      mic.dataset.zyraxonVoiceBound = 'true';
      let recorder: MediaRecorder | null = null;
      let stream: MediaStream | null = null;
      let chunks: Blob[] = [];
      let active = false;
      let starting = false;
      let stopRequested = false;
      let stopTimer: number | undefined;

      const visual = (recording: boolean, pending = false) => {
        mic.classList.toggle('active', recording || pending);
        mic.setAttribute('aria-label', recording ? 'Stop voice recording' : 'Start voice recording');
        mic.title = recording ? 'Recording… click to stop and insert transcript' : pending ? 'Starting microphone…' : 'Click to start recording';
        mic.style.background = recording || pending ? 'rgba(0,245,255,.14)' : '';
        mic.style.boxShadow = recording || pending ? '0 0 0 4px rgba(0,245,255,.08),0 0 28px rgba(0,245,255,.22)' : '';
      };

      const release = () => {
        if (stopTimer) window.clearTimeout(stopTimer);
        stopTimer = undefined;
        stream?.getTracks().forEach(track => track.stop());
        stream = null;
        recorder = null;
        active = false;
        starting = false;
        stopRequested = false;
        visual(false);
      };

      const stop = () => {
        stopRequested = true;
        if (recorder && recorder.state !== 'inactive') {
          try { recorder.stop(); } catch { release(); }
        } else if (!starting) release();
      };

      const start = async () => {
        if (active || starting) { stop(); return; }
        if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') {
          mic.title = 'Voice recording is not supported by this browser';
          return;
        }
        starting = true;
        stopRequested = false;
        visual(false, true);
        try {
          stream = await navigator.mediaDevices.getUserMedia({ audio: true });
          if (disposed) { release(); return; }
          const mime = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4', 'audio/ogg'].find(type => MediaRecorder.isTypeSupported(type));
          recorder = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined);
          chunks = [];
          recorder.ondataavailable = event => { if (event.data?.size) chunks.push(event.data); };
          recorder.onerror = () => { mic.title = 'Voice recording failed'; release(); };
          recorder.onstop = async () => {
            const mimeType = recorder?.mimeType || 'audio/webm';
            const blob = new Blob(chunks, { type: mimeType });
            stream?.getTracks().forEach(track => track.stop());
            stream = null;
            recorder = null;
            active = false;
            starting = false;
            visual(false);
            if (!blob.size || disposed) return;
            try {
              const form = new FormData();
              form.append('file', blob, mimeType.includes('mp4') ? 'zyraxon-voice.mp4' : 'zyraxon-voice.webm');
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
          recorder.start(100);
          starting = false;
          active = true;
          visual(true);
          if (stopRequested) stop();
          stopTimer = window.setTimeout(() => { if (active) stop(); }, 120000);
        } catch (error) {
          release();
          mic.title = error instanceof DOMException && error.name === 'NotAllowedError' ? 'Microphone permission is blocked' : 'Could not start microphone recording';
        }
      };

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
        starting = false;
        mic.removeEventListener('click', onClick, true);
        mic.removeAttribute('data-zyraxon-voice-bound');
        mic.style.background = '';
        mic.style.boxShadow = '';
      };
    };

    attach();
    timer = window.setInterval(() => {
      if (disposed) return;
      if (!document.querySelector('button[data-zyraxon-voice-bound="true"]')) {
        cleanup?.(); cleanup = undefined; attach();
      }
    }, 250);
    return () => { disposed = true; if (timer) window.clearInterval(timer); cleanup?.(); };
  }, []);
  return null;
}
