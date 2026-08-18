import { useEffect } from 'react';

/** One-click voice input: immediate visual start, second click commits the full transcript. */
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

      const SpeechCtor = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      let recognition: any = null;
      let recorder: MediaRecorder | null = null;
      let stream: MediaStream | null = null;
      let chunks: Blob[] = [];
      let active = false;
      let starting = false;
      let committed = '';
      let interim = '';
      let recognitionSupported = !!SpeechCtor;
      let stopTimer: number | undefined;

      const visual = (recording: boolean, pending = false) => {
        mic.classList.toggle('active', recording || pending);
        mic.setAttribute('aria-label', recording ? 'Stop voice recording' : 'Start voice recording');
        mic.title = recording ? 'Recording… click to stop and insert transcript' : pending ? 'Starting microphone…' : 'Click to start recording';
        mic.style.background = recording || pending ? 'rgba(0,245,255,.14)' : '';
        mic.style.boxShadow = recording || pending ? '0 0 0 4px rgba(0,245,255,.08),0 0 28px rgba(0,245,255,.22)' : '';
      };
      const render = () => {
        const value = committed + (interim ? `${committed && !/\s$/.test(committed) ? ' ' : ''}${interim}` : '');
        setReactValue(textarea, value);
      };
      const release = () => {
        if (stopTimer) window.clearTimeout(stopTimer);
        stopTimer = undefined;
        try { recognition?.abort(); } catch {}
        recognition = null;
        try { recorder?.stop(); } catch {}
        recorder = null;
        stream?.getTracks().forEach(track => track.stop());
        stream = null;
        chunks = [];
        active = false;
        starting = false;
        interim = '';
        visual(false);
      };

      const appendFinal = (text: string) => {
        const clean = text.trim();
        if (!clean) return;
        committed += (committed && !/\s$/.test(committed) ? ' ' : '') + clean;
        interim = '';
        render();
      };

      const startSpeech = () => {
        if (!recognitionSupported || !SpeechCtor) return false;
        try {
          recognition = new SpeechCtor();
          recognition.lang = navigator.language || 'bn-BD';
          recognition.continuous = true;
          recognition.interimResults = true;
          recognition.maxAlternatives = 1;
          recognition.onresult = (event: any) => {
            let live = '';
            for (let i = event.resultIndex; i < event.results.length; i += 1) {
              const result = event.results[i];
              const text = String(result?.[0]?.transcript || '');
              if (result?.isFinal) appendFinal(text); else live += text;
            }
            interim = live;
            render();
          };
          recognition.onerror = (event: any) => {
            if (event?.error === 'not-allowed' || event?.error === 'service-not-allowed') {
              recognitionSupported = false;
              mic.title = 'Microphone permission is blocked';
            }
          };
          recognition.onend = () => {
            if (!active || disposed || !recognitionSupported) return;
            try { recognition = new SpeechCtor(); startSpeech(); recognition.start(); } catch {}
          };
          recognition.start();
          return true;
        } catch {
          recognition = null;
          return false;
        }
      };

      const startRecorderFallback = async () => {
        if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') throw new Error('Voice recording is not supported by this browser');
        stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        if (!active || disposed) return;
        const mime = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4', 'audio/ogg'].find(type => MediaRecorder.isTypeSupported(type));
        recorder = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined);
        chunks = [];
        recorder.ondataavailable = (event) => { if (event.data?.size) chunks.push(event.data); };
        recorder.start(100);
      };

      const transcribeFallback = async () => {
        if (!chunks.length) return;
        const mimeType = recorder?.mimeType || 'audio/webm';
        const blob = new Blob(chunks, { type: mimeType });
        if (!blob.size) return;
        const form = new FormData();
        form.append('file', blob, mimeType.includes('mp4') ? 'zyraxon-voice.mp4' : 'zyraxon-voice.webm');
        form.append('language', 'bn');
        const response = await fetch('/api/public/stt', { method: 'POST', body: form });
        const data = await response.json().catch(() => null);
        if (response.ok && data?.success && String(data.text || '').trim()) appendFinal(String(data.text));
        else throw new Error(data?.error || 'Voice transcription failed');
      };

      const stop = async () => {
        if (!active) return;
        active = false;
        if (stopTimer) window.clearTimeout(stopTimer);
        stopTimer = undefined;
        try { recognition?.stop(); } catch {}
        recognition = null;
        interim = '';
        render();
        if (recorder && recorder.state !== 'inactive') {
          await new Promise<void>((resolve) => {
            const r = recorder!;
            const finish = () => { r.removeEventListener('stop', finish); resolve(); };
            r.addEventListener('stop', finish);
            try { r.stop(); } catch { resolve(); }
          });
        }
        stream?.getTracks().forEach(track => track.stop());
        stream = null;
        recorder = null;
        if (!committed.trim() && chunks.length) {
          try { await transcribeFallback(); } catch { mic.title = 'Voice transcription failed'; }
        }
        chunks = [];
        starting = false;
        visual(false);
        textarea.focus();
      };

      const start = async () => {
        if (active || starting) { void stop(); return; }
        starting = true;
        committed = textarea.value || '';
        interim = '';
        active = true;
        // Immediate UI feedback happens before any permission/device await.
        visual(true);
        textarea.focus();
        try {
          const speechStarted = startSpeech();
          if (!speechStarted) await startRecorderFallback();
          starting = false;
          stopTimer = window.setTimeout(() => { void stop(); }, 120000);
        } catch (error) {
          release();
          mic.title = error instanceof DOMException && error.name === 'NotAllowedError' ? 'Microphone permission is blocked' : (error instanceof Error ? error.message : 'Could not start microphone');
        }
      };

      const onClick = (event: Event) => { event.preventDefault(); event.stopPropagation(); void start(); };
      mic.addEventListener('click', onClick, true);
      cleanup = () => {
        if (stopTimer) window.clearTimeout(stopTimer);
        try { recognition?.abort(); } catch {}
        try { recorder?.stop(); } catch {}
        stream?.getTracks().forEach(track => track.stop());
        mic.removeEventListener('click', onClick, true);
        mic.removeAttribute('data-zyraxon-voice-bound');
        mic.style.background = '';
        mic.style.boxShadow = '';
      };
    };

    attach();
    timer = window.setInterval(() => {
      if (disposed) return;
      if (!document.querySelector('button[data-zyraxon-voice-bound="true"]')) { cleanup?.(); cleanup = undefined; attach(); }
    }, 250);
    return () => { disposed = true; if (timer) window.clearInterval(timer); cleanup?.(); };
  }, []);
  return null;
}
