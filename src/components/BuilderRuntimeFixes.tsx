import { useEffect } from 'react';

const MODEL_NAMES: Record<string, string> = {
  'mimo-v2.5-free': 'ZYRAXON TITAN',
  'nemotron-3-super-free': 'ZYRAXON PHANTOM',
  'big-pickle': 'ZYRAXON VELOCITY',
};

export default function BuilderRuntimeFixes() {
  useEffect(() => {
    const style = document.createElement('style');
    style.dataset.zyraxonRuntimeFix = 'true';
    style.textContent = `
      .zyraxon-builder .zb-topbar,.zyraxon-builder .message,.zyraxon-builder .composer,.zyraxon-builder .studio-pane,.zyraxon-builder .popover,.zyraxon-builder .inline-file,.zyraxon-builder .file-tree,.zyraxon-builder .studio-head{border-color:rgba(255,255,255,.18)!important;box-shadow:inset 0 1px rgba(255,255,255,.12),0 18px 70px rgba(0,0,0,.22)!important}
      .zyraxon-builder .composer{background:linear-gradient(145deg,rgba(255,255,255,.13),rgba(255,255,255,.045)),var(--panel)!important}
      .zyraxon-builder [data-zyraxon-mic]{order:2!important}
      .zyraxon-builder .send-btn{order:3!important}
      .zyraxon-builder.github-connected .publish-modal input[type=password]{display:none!important}
      .zyraxon-builder.github-connected .publish-modal:before{content:'GitHub connected · publishing will use your secure server-side connection';display:block;color:var(--muted);font-size:10px;padding:8px 10px;border:1px solid var(--line);border-radius:10px;background:rgba(255,255,255,.035)}
    `;
    document.head.appendChild(style);

    const getAuthToken = () => {
      try {
        const raw = localStorage.getItem('zyraxon_ecosystem_auth');
        const auth = raw ? JSON.parse(raw) : null;
        return typeof auth?.token === 'string' ? auth.token : '';
      } catch { return ''; }
    };

    const setReactValue = (input: HTMLInputElement, value: string) => {
      const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
      if (setter) setter.call(input, value); else input.value = value;
      input.dispatchEvent(new Event('input', { bubbles: true }));
      input.dispatchEvent(new Event('change', { bubbles: true }));
    };

    const hydratePublishAuth = () => {
      const root = document.querySelector<HTMLElement>('.zyraxon-builder');
      const token = getAuthToken();
      if (root) root.classList.toggle('github-connected', !!token);
      if (!token) return;
      const input = document.querySelector<HTMLInputElement>('.publish-modal input[type=password]');
      if (input && input.value !== token) setReactValue(input, token);
    };

    const renameModels = () => {
      document.querySelectorAll<HTMLElement>('.model-pop button, .zb-models button').forEach((button) => {
        const label = button.querySelector('b');
        if (!label) return;
        const text = label.textContent || '';
        if (/MiMo V2\.5 Free/i.test(text)) label.textContent = MODEL_NAMES['mimo-v2.5-free'];
        else if (/Nemotron 3 Super Free/i.test(text)) label.textContent = MODEL_NAMES['nemotron-3-super-free'];
        else if (/Big Pickle/i.test(text)) label.textContent = MODEL_NAMES['big-pickle'];
        const note = button.querySelector('small, em');
        if (note) note.textContent = 'ZYRAXON Builder Engine';
      });
      document.querySelectorAll<HTMLElement>('.model-btn, .zb-actions button').forEach((button) => {
        const text = button.textContent || '';
        if (/MiMo V2\.5 Free/i.test(text)) button.textContent = `${MODEL_NAMES['mimo-v2.5-free']}⌄`;
        else if (/Nemotron 3 Super Free/i.test(text)) button.textContent = `${MODEL_NAMES['nemotron-3-super-free']}⌄`;
        else if (/Big Pickle/i.test(text)) button.textContent = `${MODEL_NAMES['big-pickle']}⌄`;
      });
    };

    const patchPreview = (iframe: HTMLIFrameElement) => {
      const inject = () => {
        try {
          const doc = iframe.contentDocument;
          const win = iframe.contentWindow;
          if (!doc || !win || doc.documentElement.dataset.zyraxonPatched === '1') return;
          doc.documentElement.dataset.zyraxonPatched = '1';
          const css = doc.createElement('style');
          css.textContent = `a,button,[role="button"]{cursor:pointer!important}body{min-height:100vh}`;
          doc.head?.appendChild(css);
          doc.addEventListener('click', (event) => {
            const target = event.target as Element | null;
            const anchor = target?.closest?.('a[href]') as HTMLAnchorElement | null;
            if (!anchor) return;
            const href = anchor.getAttribute('href') || '';
            const external = /^(?:[a-z][a-z0-9+.-]*:)?\\/\\//i.test(href) || /^[a-z][a-z0-9+.-]*:/i.test(href);
            if (!external && href && href !== '#') {
              event.preventDefault(); event.stopPropagation();
              const url = new URL(href, win.location.href);
              win.history.pushState({}, '', url.pathname + url.search + url.hash);
              win.dispatchEvent(new CustomEvent('zyraxon-preview-route', { detail: { path: url.pathname + url.search + url.hash } }));
            }
          }, true);
          const originalOpen = win.open;
          win.open = ((url?: string | URL, target?: string, features?: string) => {
            const raw = String(url ?? '');
            if (raw && !/^(?:[a-z][a-z0-9+.-]*:)?\\/\\//i.test(raw) && !/^[a-z][a-z0-9+.-]*:/i.test(raw)) { win.location.href = raw; return win; }
            return originalOpen.call(win, url, target, features);
          }) as typeof win.open;
        } catch {}
      };
      iframe.addEventListener('load', inject);
      inject();
      return () => iframe.removeEventListener('load', inject);
    };

    const iframeCleanups = new Map<HTMLIFrameElement, () => void>();
    const observe = () => {
      renameModels();
      hydratePublishAuth();
      document.querySelectorAll<HTMLIFrameElement>('.preview-frame iframe,.zb-preview iframe').forEach((iframe) => {
        if (!iframeCleanups.has(iframe)) iframeCleanups.set(iframe, patchPreview(iframe));
      });
      for (const [iframe, cleanup] of iframeCleanups) if (!document.contains(iframe)) { cleanup(); iframeCleanups.delete(iframe); }
    };

    const observer = new MutationObserver(observe);
    observer.observe(document.body, { childList: true, subtree: true, characterData: true });
    const interval = window.setInterval(observe, 350);
    observe();
    return () => { observer.disconnect(); window.clearInterval(interval); iframeCleanups.forEach(cleanup => cleanup()); style.remove(); };
  }, []);
  return null;
}
