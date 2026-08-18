import { useEffect } from 'react';

/** Keeps already-rendered Builder header actions visible after route/CSS changes. */
export default function BuilderControlsGuard() {
  useEffect(() => {
    let disposed = false;
    const restore = () => {
      if (disposed) return;
      document.querySelectorAll<HTMLElement>('.builder-actions > button, .builder-actions > a').forEach((el) => {
        el.hidden = false;
        el.removeAttribute('hidden');
        el.style.removeProperty('display');
        el.style.removeProperty('visibility');
        el.style.removeProperty('opacity');
        el.style.removeProperty('pointer-events');
      });
    };
    restore();
    const observer = new MutationObserver(restore);
    observer.observe(document.body, { subtree: true, attributes: true, attributeFilter: ['class', 'style', 'hidden'] });
    return () => { disposed = true; observer.disconnect(); };
  }, []);
  return null;
}
