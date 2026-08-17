import { createFileRoute } from '@tanstack/react-router'
import BuilderStudioMulti from '@/components/BuilderStudioMulti'

export const Route = createFileRoute('/ai-bludar')({
  head: () => ({
    meta: [
      { title: 'ZYRAXON AI Bludar — Builder Studio' },
      { name: 'description', content: 'Premium AI website builder studio with live preview, code editor and AI build modes.' },
    ],
  }),
  component: AIBludar,
})

function AIBludar() {
  return (
    <div className="ai-bludar-page">
      <style>{`
        .ai-bludar-page{min-height:100vh;background:#050507;color:#f7f7fa;isolation:isolate}
        .ai-bludar-page .zyraxon-builder{min-height:100vh!important;background:radial-gradient(circle at 80% -10%,rgba(103,80,255,.13),transparent 35%),radial-gradient(circle at 5% 80%,rgba(0,220,255,.07),transparent 32%),#050507!important}
        .ai-bludar-page .zb-topbar{border:1px solid rgba(255,255,255,.09)!important;background:rgba(10,10,14,.78)!important;backdrop-filter:blur(24px)!important;-webkit-backdrop-filter:blur(24px)!important;box-shadow:0 12px 40px rgba(0,0,0,.28)!important}
        .ai-bludar-page .zb-mark{box-shadow:0 0 26px rgba(132,94,255,.28)!important}
        .ai-bludar-page .glass-btn,.ai-bludar-page .mode-btn,.ai-bludar-page .model-btn,.ai-bludar-page .send-btn,.ai-bludar-page .studio-tabs button,.ai-bludar-page .device-tabs button{border:1px solid rgba(255,255,255,.1)!important;background:rgba(255,255,255,.045)!important;transition:transform .18s ease,background .18s ease,border-color .18s ease,box-shadow .18s ease!important}
        .ai-bludar-page .glass-btn:hover,.ai-bludar-page .mode-btn:hover,.ai-bludar-page .model-btn:hover,.ai-bludar-page .studio-tabs button:hover,.ai-bludar-page .device-tabs button:hover{transform:translateY(-1px)!important;background:rgba(255,255,255,.085)!important;border-color:rgba(255,255,255,.18)!important}
        .ai-bludar-page .send-btn{box-shadow:0 8px 28px rgba(100,75,255,.22)!important}
        .ai-bludar-page .composer,.ai-bludar-page .studio-pane{border:1px solid rgba(255,255,255,.09)!important;background:rgba(9,9,13,.72)!important;backdrop-filter:blur(24px)!important;-webkit-backdrop-filter:blur(24px)!important;box-shadow:0 24px 80px rgba(0,0,0,.28)!important}
        .ai-bludar-page .welcome .hero-z{animation:bludarPulse 3.8s ease-in-out infinite!important}
        .ai-bludar-page .suggestions button{border:1px solid rgba(255,255,255,.09)!important;background:rgba(255,255,255,.035)!important;transition:transform .18s ease,border-color .18s ease,background .18s ease!important}
        .ai-bludar-page .suggestions button:hover{transform:translateY(-2px)!important;background:rgba(255,255,255,.075)!important;border-color:rgba(140,115,255,.38)!important}
        .ai-bludar-page .model-pop,.ai-bludar-page .mode-pop,.ai-bludar-page .activity-pop,.ai-bludar-page .popover{z-index:100!important;background:rgba(11,11,16,.97)!important;border:1px solid rgba(255,255,255,.12)!important;box-shadow:0 24px 70px rgba(0,0,0,.5)!important;backdrop-filter:blur(18px)!important;-webkit-backdrop-filter:blur(18px)!important}
        .ai-bludar-page .model-pop button,.ai-bludar-page .mode-pop button{transition:background .15s ease,border-color .15s ease!important}
        .ai-bludar-page .model-pop button:hover,.ai-bludar-page .mode-pop button:hover{background:rgba(255,255,255,.08)!important}
        .ai-bludar-page .model-pop button::before{content:'✦';display:inline-grid;place-items:center;width:28px;height:28px;margin-right:9px;border-radius:8px;background:rgba(132,101,255,.12);color:#b8a7ff}
        .ai-bludar-page .model-btn::before{content:'◈';margin-right:7px;color:#b8a7ff}
        .ai-bludar-page .mode-btn::before{content:'⚡';margin-right:6px;color:#b8a7ff}
        .ai-bludar-page .studio-tabs button:first-child::before{content:'◉';margin-right:6px}.ai-bludar-page .studio-tabs button:last-child::before{content:'</>';margin-right:6px}
        .ai-bludar-page .device-tabs button:first-child::before{content:'▱'}.ai-bludar-page .device-tabs button:nth-child(2)::before{content:'▯'}.ai-bludar-page .device-tabs button:nth-child(3)::before{content:'▯'}
        .ai-bludar-page .auto-access{opacity:.72}
        @keyframes bludarPulse{0%,100%{transform:translateY(0);box-shadow:0 0 0 rgba(130,100,255,0)}50%{transform:translateY(-3px);box-shadow:0 0 42px rgba(130,100,255,.18)}}
        @media(max-width:900px){.ai-bludar-page .top-title{display:none}.ai-bludar-page .zb-workspace{grid-template-columns:1fr!important}.ai-bludar-page .studio-pane{min-height:520px}.ai-bludar-page .composer-left{flex-wrap:wrap}.ai-bludar-page .auto-access{display:none}}
      `}</style>
      <BuilderStudioMulti />
    </div>
  )
}
