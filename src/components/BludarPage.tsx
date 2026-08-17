import { useEffect } from 'react'
import BuilderStudioClean from './BuilderStudioClean'

/** Route-only presentation shell. It deliberately leaves the existing homepage untouched. */
export default function BludarPage() {
  useEffect(() => {
    const style = document.createElement('style')
    style.dataset.zyraxonBludar = 'true'
    style.textContent = `
      /* Bludar only: remove the old GitHub account surface from the builder header. */
      .zyraxon-clean-builder .zyraxon-account-stack,
      .zyraxon-clean-builder .github-account-btn,
      .zyraxon-clean-builder .reset-local-btn { display:none !important; }

      /* Give the builder controls a consistent premium icon treatment without changing behavior. */
      .zyraxon-clean-builder .top-actions button,
      .zyraxon-clean-builder .studio-tabs button,
      .zyraxon-clean-builder .device-tabs button,
      .zyraxon-clean-builder .model-btn,
      .zyraxon-clean-builder .mode-btn,
      .zyraxon-clean-builder .send-btn {
        position:relative;
        display:inline-flex !important;
        align-items:center;
        justify-content:center;
        gap:7px;
        border-radius:11px !important;
      }
      .zyraxon-clean-builder .send-btn::before { content:'✦'; font-size:12px; }
      .zyraxon-clean-builder .model-btn::before { content:'◈'; font-size:12px; }
      .zyraxon-clean-builder .mode-btn::before { content:'⌘'; font-size:12px; }
      .zyraxon-clean-builder .studio-tabs button:first-child::before { content:'▣'; font-size:12px; }
      .zyraxon-clean-builder .studio-tabs button:last-child::before { content:'</>'; font-size:10px; font-weight:800; }
      .zyraxon-clean-builder .device-tabs button:first-child::before { content:'▣'; font-size:12px; }
      .zyraxon-clean-builder .device-tabs button:nth-child(2)::before { content:'▯'; font-size:13px; }
      .zyraxon-clean-builder .device-tabs button:nth-child(3)::before { content:'◫'; font-size:12px; }

      .zyraxon-bludar-shell { position:relative; min-height:100vh; background:#050507; }
      .zyraxon-bludar-shell::before {
        content:''; position:fixed; inset:0; pointer-events:none; z-index:0;
        background:radial-gradient(circle at 85% 0%, rgba(92,214,255,.08), transparent 30%), radial-gradient(circle at 10% 100%, rgba(143,92,255,.07), transparent 34%);
      }
      .zyraxon-bludar-shell > * { position:relative; z-index:1; }
    `
    document.head.appendChild(style)
    return () => style.remove()
  }, [])

  return (
    <div className="zyraxon-bludar-shell" aria-label="ZYRAXON AI Bludar">
      <BuilderStudioClean />
    </div>
  )
}
