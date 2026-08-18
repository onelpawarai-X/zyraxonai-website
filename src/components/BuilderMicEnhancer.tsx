import { useEffect } from 'react';

/**
 * One physical mic, one interaction model:
 * click once -> MediaRecorder starts immediately; click again -> recorder stops,
 * the existing STT endpoint transcribes the complete clip, and the transcript
 * is committed to the composer. No popup and no separate Start Recording UI.
 */
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
      const mic = composer ? Array.from(composer.querySelectorAll<HTMLButtonElement>('button.circle-btn')).find((button) => {
        const label = `${button.title} ${button.getAttribute('aria-label')}`.toLowerCase();
        return label.includes('microphone') || label.includes('voice');
      }) : undefined;
      if (!composer || !textarea || !mic || mic.dataset.zyraxonVoiceBound === 'true') return;
      mic.dataset.zyraxonVoiceBound = 'true';

      let recorder: MediaRecorder | null = null;
      let stream: MediaStream | null = null;
      let chunks: Blob[] = [];
      let active = false;
      let stopping = false;
      let baseText = '';

      const visual = (recording: boolean, processing = false) => {
        mic.classList.toggle('active', recording || processing);
        mic.setAttribute('aria-label', recording ? 'Stop voice recording' : processing ? 'Transcribing voice…' : 'Start voice recording');
        mic.title = recording ? 'Recording… click to stop and insert transcript' : processing ? 'Transcribing…' : 'Click to start recording';
        mic.style.background = recording || processing ? 'rgba(0,245,255,.14)' : '';
        mic.style.boxShadow = recording || processing ? '0 0 0 4px rgba(0,245,255,.08),0 0 28px rgba(0,245,255,.22)' : '';
      };

      const restore = () => {
        mic.style.background = '';
        mic.style.boxShadow = '';
        mic.classList.remove('active');
        mic.setAttribute('aria-label', 'Start voice recording');
        mic.title = 'Click to start recording';
      };

      const release = () => {
        try { if (recorder && recorder.state !== 'inactive') recorder.stop(); } catch {}
        stream?.getTracks().forEach(track => track.stop());
        stream = null;
        recorder = null;
        chunks = [];
        active = false;
        stopping = false;
        restore();
      };

      const transcribe = async (blob: Blob) => {
        const form = new FormData();
        const extension = blob.type.includes('mp4') ? 'mp4' : blob.type.includes('ogg') ? 'ogg' : 'webm';
        form.append('file', blob, `zyraxon-voice.${extension}`);
        form.append('language', 'bn');
        const response = await fetch('/api/public/stt', { method: 'POST', body: form });
        const data = await response.json().catch(() => null);
        if (!response.ok || !data?.success || !String(data.text || '').trim()) throw new Error(data?.error || 'Voice transcription failed');
        const transcript = String(data.text).trim();
        const value = `${baseText}${baseText && !/\s$/.test(baseText) ? ' ' : ''}${transcript}`;
        setReactValue(textarea, value);
        textarea.focus();
      };

      const start = async () => {
        if (active || stopping) return;
        baseText = textarea.value || '';
        active = true;
        // The button changes state before awaiting getUserMedia so there is no
        // perceptible delay between the click and the recording indicator.
        visual(true);
        textarea.focus();
        try {
          if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') throw new Error('Microphone recording is not supported by this browser');
          stream = await navigator.mediaDevices.getUserMedia({ audio: true });
          if (!active || disposed) return release();
          const mime = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4', 'audio/ogg'].find(type => MediaRecorder.isTypeSupported(type));
          recorder = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined);
          chunks = [];
          recorder.ondataavailable = event => { if (event.data?.size) chunks.push(event.data); };
          recorder.start(100);
        } catch (error) {
          release();
          mic.title = error instanceof DOMException && error.name === 'NotAllowedError' ? 'Microphone permission is blocked' : (error instanceof Error ? error.message : 'Could not start microphone');
        }
      };

      const stop = async () => {
        if (!active || stopping) return;
        stopping = true;
        active = false;
        visual(false, true);
        const r = recorder;
        const localStream = stream;
        if (!r) {
          localStream?.getTracks().forEach(track => track.stop());
          stream = null;
          stopping = false;
          restore();
          return;
        }
        await new Promise<void>(resolve => {
          const finish = () => { r.removeEventListener('stop', finish); resolve(); };
          r.addEventListener('stop', finish, { once: true });
          try { r.stop(); } catch { resolve(); }
        });
        localStream?.getTracks().forEach(track => track.stop());
        stream = null;
        recorder = null;
        const blob = new Blob(chunks, { type: r.mimeType || 'audio/webm' });
        chunks = [];
        try {
          if (blob.size) await transcribe(blob);
        } catch (error) {
          mic.title = error instanceof Error ? error.message : 'Voice transcription failed';
        } finally {
          stopping = false;
          restore();
          textarea.focus();
        }
      };

      const onClick = (event: Event) => {
        event.preventDefault();
        event.stopPropagation();
        if (active) void stop(); else void start();
      };
      mic.addEventListener('click', onClick, true);

      cleanup = () => {
        try { if (recorder && recorder.state !== 'inactive') recorder.stop(); } catch {}
        stream?.getTracks().forEach(track => track.stop());
        mic.removeEventListener('click', onClick, true);
        mic.removeAttribute('data-zyraxon-voice-bound');
        mic.style.background = '';
        mic.style.boxShadow = '';
        mic.classList.remove('active');
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
    }, 250);

    return () => {
      disposed = true;
      if (timer) window.clearInterval(timer);
      cleanup?.();
    };
  }, []);

  return null;
}
