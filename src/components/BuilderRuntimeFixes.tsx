import { useEffect } from 'react';

const MODEL_NAMES: Record<string, string> = {
  'mimo-v2.5-free': 'ZYRAXON TITAN',
  'nemotron-3-super-free': 'ZYRAXON PHANTOM',
  'big-pickle': 'ZYRAXON VELOCITY',
};

/** Runtime hardening for the Builder shell. It deliberately leaves the
 * existing OpenCode model IDs and generation pipeline untouched while fixing
 * presentation, preview navigation isolation, and the composer layout. */
export default function BuilderRuntimeFixes() {
  useEffect(() => {
    const style = document.createElement('style');
    style.dataset.zyraxonRuntimeFix = 'true';
    style.textContent = `
      .zyraxon-builder .zb-topbar,
      .zyraxon-builder .message-card,
      .zyraxon-builder .composer-inner,
      .zyraxon-builder .zb-preview,
      .zyraxon-builder .zb-models,
      .zyraxon-builder .zb-drawer,
      .zyraxon-builder .zb-modal,
      .zyraxon-builder .code-card,
      .zyraxon-builder .code-view aside,
      .zyraxon-builder .preview-bar,
      .zyraxon-builder .suggestions button,
      .zyraxon-builder .zb-actions button,
      .zyraxon-builder .zb-center {
        border-color: rgba(255,255,255,.18) !important;
        box-shadow: inset 0 1px rgba(255,255,255,.12), 0 18px 70px rgba(0,0,0,.18) !important;
      }
      .zyraxon-builder .composer-inner { background: linear-gradient(145deg,rgba(255,255,255,.13),rgba(255,255,255,.045)),var(--strong) !important; }
      .zyraxon-builder .zb-chat-inner { min-height: 0; }
      .zyraxon-builder .zb-messages { scroll-behavior:smooth; }
      .zyraxon-builder .composer-tools { justify-content:flex-end; }
      .zyraxon-builder .composer-tools .auto-web { margin-left:auto; }
      .zyraxon-builder [data-zyraxon-mic] { order:2 !important; }
      .zyraxon-builder button.send { order:3 !important; }
    `;
    document.head.appendChild(style);

    const renameModels = () => {
      document.querySelectorAll<HTMLElement>('.zb-models button').forEach((button) => {
        const text = button.textContent || '';
        for (const [upstream, branded] of Object.entries(MODEL_NAMES)) {
          if (text.includes(upstream) || text.includes(branded)) continue;
          if (text.includes('MiMo V2.5 Free')) button.querySelector('b')?.replaceChildren(document.createTextNode(branded));
          if (text.includes('Nemotron 3 Super Free')) button.querySelector('b')?.replaceChildren(document.createTextNode(branded));
          if (text.includes('Big Pickle')) button.querySelector('b')?.replaceChildren(document.createTextNode(branded));
        }
        const note = button.querySelector('em');
        if (note) note.textContent = note.textContent?.replace(/Balanced builder|Deep reasoning|Fast generation/i, 'ZYRAXON Builder Engine') || 'ZYRAXON Builder Engine';
      });
      const actions = document.querySelectorAll<HTMLElement>('.zb-actions button');
      actions.forEach((button) => {
        for (const [upstream, branded] of Object.entries(MODEL_NAMES)) {
          if (button.textContent?.includes(upstream) || button.textContent?.includes('MiMo V2.5 Free') || button.textContent?.includes('Nemotron 3 Super Free') || button.textContent?.includes('Big Pickle')) {
            button.textContent = branded + '⌄';
          }
        }
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
          css.textContent = `a,button,[role="button"]{cursor:pointer!important} body{min-height:100vh}`;
          doc.head?.appendChild(css);
          doc.addEventListener('click', (event) => {
            const target = event.target as Element | null;
            const anchor = target?.closest?.('a[href]') as HTMLAnchorElement | null;
            if (!anchor) return;
            const href = anchor.getAttribute('href') || '';
            const external = /^(?:[a-z][a-z0-9+.-]*:)?\\/\\//i.test(href) || /^[a-z][a-z0-9+.-]*:/i.test(href);
            if (!external && href && href !== '#') {
              event.preventDefault();
              event.stopPropagation();
              const url = new URL(href, win.location.href);
              win.history.pushState({}, '', url.pathname + url.search + url.hash);
              win.dispatchEvent(new CustomEvent('zyraxon-preview-route', { detail: { path: url.pathname + url.search + url.hash } }));
            }
          }, true);
          const originalOpen = win.open;
          win.open = ((url?: string | URL, target?: string, features?: string) => {
            const raw = String(url ?? '');
            if (raw && !/^(?:[a-z][a-z0-9+.-]*:)?\\/\\//i.test(raw) && !/^[a-z][a-z0-9+.-]*:/i.test(raw)) {
              win.location.href = raw;
              return win;
            }
            return originalOpen.call(win, url, target, features);
          }) as typeof win.open;
        } catch {
          // Cross-origin or sandbox restrictions: the iframe remains isolated.
        }
      };
      iframe.addEventListener('load', inject);
      inject();
      return () => iframe.removeEventListener('load', inject);
    };

    const iframeCleanups = new Map<HTMLIFrameElement, () => void>();
    const observe = () => {
      renameModels();
      document.querySelectorAll<HTMLIFrameElement>('.zb-preview iframe').forEach((iframe) => {
        if (!iframeCleanups.has(iframe)) iframeCleanups.set(iframe, patchPreview(iframe));
      });
      for (const [iframe, cleanup] of iframeCleanups) {
        if (!document.contains(iframe)) { cleanup(); iframeCleanups.delete(iframe); }
      }
    };

    const observer = new MutationObserver(observe);
    observer.observe(document.body, { childList: true, subtree: true, characterData: true });
    const interval = window.setInterval(observe, 350);
    observe();

    return () => {
      observer.disconnect();
      window.clearInterval(interval);
      iframeCleanups.forEach((cleanup) => cleanup());
      style.remove();
    };
  }, []);

  return null;
}
