import { useEffect } from 'react'
import BuilderStudioMulti from './BuilderStudioMulti'

/** Dedicated AI Bludar presentation. The homepage is intentionally untouched. */
export default function BludarPage() {
  useEffect(() => {
    const style = document.createElement('style')
    style.dataset.zyraxonBludar = 'true'
    style.textContent = `
      .zyraxon-bludar-page{min-height:100vh;background:#050507;color:#f7f7fa;isolation:isolate}
      .zyraxon-bludar-page .zb-topbar{border:1px solid rgba(255,255,255,.09)!important;background:rgba(10,10,14,.78)!important;backdrop-filter:blur(24px)!important;-webkit-backdrop-filter:blur(24px)!important;box-shadow:0 12px 40px rgba(0,0,0,.28)!important}
      .zyraxon-bludar-page .glass-btn,.zyraxon-bludar-page .mode-btn,.zyraxon-bludar-page .model-btn,.zyraxon-bludar-page .send-btn,.zyraxon-bludar-page .studio-tabs button,.zyraxon-bludar-page .device-tabs button{border:1px solid rgba(255,255,255,.1)!important;background:rgba(255,255,255,.045)!important;transition:transform .18s ease,background .18s ease,border-color .18s ease,box-shadow .18s ease!important}
      .zyraxon-bludar-page .glass-btn:hover,.zyraxon-bludar-page .mode-btn:hover,.zyraxon-bludar-page .model-btn:hover,.zyraxon-bludar-page .studio-tabs button:hover,.zyraxon-bludar-page .device-tabs button:hover{transform:translateY(-1px)!important;background:rgba(255,255,255,.085)!important;border-color:rgba(255,255,255,.18)!important}
      .zyraxon-bludar-page .send-btn{box-shadow:0 8px 28px rgba(100,75,255,.22)!important}
      .zyraxon-bludar-page .composer,.zyraxon-bludar-page .studio-pane{border:1px solid rgba(255,255,255,.09)!important;background:rgba(9,9,13,.72)!important;backdrop-filter:blur(24px)!important;-webkit-backdrop-filter:blur(24px)!important;box-shadow:0 24px 80px rgba(0,0,0,.28)!important}
      .zyraxon-bludar-page .welcome .hero-z{animation:bludarPulse 3.8s ease-in-out infinite!important}
      .zyraxon-bludar-page .suggestions button{border:1px solid rgba(255,255,255,.09)!important;background:rgba(255,255,255,.035)!important;transition:transform .18s ease,border-color .18s ease,background .18s ease!important}
      .zyraxon-bludar-page .suggestions button:hover{transform:translateY(-2px)!important;background:rgba(255,255,255,.075)!important;border-color:rgba(140,115,255,.38)!important}
      .zyraxon-bludar-page .model-pop,.zyraxon-bludar-page .mode-pop,.zyraxon-bludar-page .activity-pop{z-index:100!important;background:rgba(11,11,16,.97)!important;border:1px solid rgba(255,255,255,.12)!important;box-shadow:0 24px 70px rgba(0,0,0,.5)!important;backdrop-filter:blur(18px)!important;-webkit-backdrop-filter:blur(18px)!important}
      .zyraxon-bludar-page .model-pop button,.zyraxon-bludar-page .mode-pop button{transition:background .15s ease,border-color .15s ease!important}
      .zyraxon-bludar-page .model-pop button:hover,.zyraxon-bludar-page .mode-pop button:hover{background:rgba(255,255,255,.08)!important}
      .zyraxon-bludar-page .model-pop button::before{content:'✦';display:inline-grid;place-items:center;width:28px;height:28px;margin-right:9px;border-radius:8px;background:rgba(132,101,255,.12);color:#b8a7ff}
      .zyraxon-bludar-page .model-btn::before{content:'◈';margin-right:7px;color:#b8a7ff}
      .zyraxon-bludar-page .mode-btn::before{content:'⚡';margin-right:6px;color:#b8a7ff}
      .zyraxon-bludar-page .studio-tabs button:first-child::before{content:'◉';margin-right:6px}.zyraxon-bludar-page .studio-tabs button:last-child::before{content:'</>';margin-right:6px}
      .zyraxon-bludar-page .device-tabs button:first-child::before{content:'▱'}.zyraxon-bludar-page .device-tabs button:nth-child(2)::before{content:'▯'}.zyraxon-bludar-page .device-tabs button:nth-child(3)::before{content:'▯'}
      .zyraxon-bludar-page .auto-access{opacity:.72}
      @keyframes bludarPulse{0%,100%{transform:translateY(0);box-shadow:0 0 0 rgba(130,100,255,0)}50%{transform:translateY(-3px);box-shadow:0 0 42px rgba(130,100,255,.18)}}
      @media(max-width:900px){.zyraxon-bludar-page .top-title{display:none}.zyraxon-bludar-page .zb-workspace{grid-template-columns:1fr!important}.zyraxon-bludar-page .studio-pane{min-height:520px}.zyraxon-bludar-page .composer-left{flex-wrap:wrap}.zyraxon-bludar-page .auto-access{display:none}}
    `
    document.head.appendChild(style)
    return () => style.remove()
  }, [])

  return <div className="zyraxon-bludar-page"><BuilderStudioMulti /></div>
}
