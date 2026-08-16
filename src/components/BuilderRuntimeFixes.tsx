import { useEffect } from 'react';

const MODEL_NAMES: Record<string, string> = {
  'mimo-v2.5-free': 'ZYRAXON TITAN',
  'nemotron-3-super-free': 'ZYRAXON NEXUS',
  'big-pickle': 'ZYRAXON OMEGA',
};

export default function BuilderRuntimeFixes() {
  useEffect(() => {
    const style = document.createElement('style');
    style.dataset.zyraxonRuntimeFix = 'true';
    style.textContent = `
      .zyraxon-builder .zb-topbar,.zyraxon-builder .message,.zyraxon-builder .composer,.zyraxon-builder .studio-pane,.zyraxon-builder .popover,.zyraxon-builder .inline-file,.zyraxon-builder .file-tree,.zyraxon-builder .studio-head{border-color:rgba(255,255,255,.18)!important;box-shadow:inset 0 1px rgba(255,255,255,.12),0 18px 70px rgba(0,0,0,.22)!important}
      .zyraxon-builder .composer{background:linear-gradient(145deg,rgba(255,255,255,.13),rgba(255,255,255,.045)),var(--panel)!important}
      .zyraxon-builder.github-connected .publish-modal input[type=password]{display:none!important}
      .zyraxon-builder.github-connected .publish-modal:before{content:'GitHub connected · no token required';display:block;color:var(--muted);font-size:10px;padding:8px 10px;border:1px solid var(--line);border-radius:10px;background:rgba(255,255,255,.035)}
    `;
    document.head.appendChild(style);

    const renameModels = () => {
      document.querySelectorAll<HTMLElement>('.model-pop button, .zb-models button').forEach(button => {
        const label = button.querySelector('b'); if (!label) return; const text = label.textContent || '';
        if (/MiMo V2\.5 Free/i.test(text)) label.textContent = MODEL_NAMES['mimo-v2.5-free'];
        else if (/Nemotron 3 Super Free/i.test(text)) label.textContent = MODEL_NAMES['nemotron-3-super-free'];
        else if (/Big Pickle/i.test(text)) label.textContent = MODEL_NAMES['big-pickle'];
        const note = button.querySelector('small, em'); if (note) note.textContent = 'ZYRAXON Builder Engine';
      });
      document.querySelectorAll<HTMLElement>('.model-btn').forEach(button => {
        const text = button.textContent || '';
        if (/MiMo V2\.5 Free/i.test(text)) button.textContent = `${MODEL_NAMES['mimo-v2.5-free']}⌄`;
        else if (/Nemotron 3 Super Free/i.test(text)) button.textContent = `${MODEL_NAMES['nemotron-3-super-free']}⌄`;
        else if (/Big Pickle/i.test(text)) button.textContent = `${MODEL_NAMES['big-pickle']}⌄`;
      });
    };

    const updateGitHubState = async () => {
      const root = document.querySelector<HTMLElement>('.zyraxon-builder');
      if (!root) return;
      try {
        const response = await fetch('/api/public/auth/github/me', { credentials: 'include', cache: 'no-store' });
        const data = response.ok ? await response.json() : null;
        root.classList.toggle('github-connected', !!data?.user);
      } catch { root.classList.remove('github-connected'); }
    };

    const publishConnected = async (event: MouseEvent) => {
      const target = event.target as HTMLElement | null;
      const button = target?.closest('.publish-now') as HTMLButtonElement | null;
      if (!button) return;
      const root = document.querySelector<HTMLElement>('.zyraxon-builder');
      if (!root?.classList.contains('github-connected')) return;
      event.preventDefault(); event.stopPropagation(); event.stopImmediatePropagation();
      const modal = button.closest('.publish-modal');
      const repoInput = modal?.querySelector<HTMLInputElement>('input:not([type=password])');
      const repo = repoInput?.value.trim() || '';
      if (!repo) { const status = modal?.querySelector('small'); if (status) status.textContent = 'Enter a repository name.'; return; }
      const iframe = document.querySelector<HTMLIFrameElement>('.preview-frame iframe');
      const html = iframe?.getAttribute('srcdoc') || '';
      if (!html) { const status = modal?.querySelector('small'); if (status) status.textContent = 'Generate a website before publishing.'; return; }
      button.disabled = true; button.textContent = 'Publishing…';
      try {
        // Authentication is carried by the secure HttpOnly session cookie.
        // No GitHub token is read from or stored in localStorage.
        const response = await fetch('/api/public/builder/publish', { method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ repo, files: { 'index.html': html }, html }) });
        const data = await response.json().catch(() => ({}));
        const status = modal?.querySelector('small'); if (status) status.textContent = response.ok && data.ok ? (data.pagesUrl || data.repoUrl || 'Published successfully.') : (data.error || 'Publish failed.');
      } catch { const status = modal?.querySelector('small'); if (status) status.textContent = 'Publish failed. Check your connection.'; }
      finally { button.disabled = false; button.textContent = 'Publish'; }
    };

    const patchPreview = (iframe: HTMLIFrameElement) => {
      const inject = () => { try {
        const doc = iframe.contentDocument; const win = iframe.contentWindow; if (!doc || !win || doc.documentElement.dataset.zyraxonPatched === '1') return;
        doc.documentElement.dataset.zyraxonPatched = '1'; const css = doc.createElement('style'); css.textContent = `a,button,[role="button"]{cursor:pointer!important}body{min-height:100vh}`; doc.head?.appendChild(css);
        doc.addEventListener('click', event => { const target = event.target as Element | null; const anchor = target?.closest?.('a[href]') as HTMLAnchorElement | null; if (!anchor) return; const href = anchor.getAttribute('href') || ''; const external = /^(?:[a-z][a-z0-9+.-]*:)?\/\//i.test(href) || /^[a-z][a-z0-9+.-]*:/i.test(href); if (!external && href && href !== '#') { event.preventDefault(); event.stopPropagation(); try { const url = new URL(href, win.location.href); win.history.pushState({}, '', url.pathname + url.search + url.hash); } catch {} } }, true);
      } catch {} };
      iframe.addEventListener('load', inject); inject(); return () => iframe.removeEventListener('load', inject);
    };

    const iframeCleanups = new Map<HTMLIFrameElement, () => void>();
    const observe = () => { renameModels(); void updateGitHubState(); document.querySelectorAll<HTMLIFrameElement>('.preview-frame iframe,.zb-preview iframe').forEach(iframe => { if (!iframeCleanups.has(iframe)) iframeCleanups.set(iframe, patchPreview(iframe)); }); for (const [iframe, cleanup] of iframeCleanups) if (!document.contains(iframe)) { cleanup(); iframeCleanups.delete(iframe); } };
    document.addEventListener('click', publishConnected, true);
    const observer = new MutationObserver(observe); observer.observe(document.body, { childList: true, subtree: true, characterData: true });
    const interval = window.setInterval(observe, 1200); observe();
    return () => { document.removeEventListener('click', publishConnected, true); observer.disconnect(); window.clearInterval(interval); iframeCleanups.forEach(cleanup => cleanup()); style.remove(); };
  }, []);
  return null;
}
