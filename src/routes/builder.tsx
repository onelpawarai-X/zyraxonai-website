import { createFileRoute } from '@tanstack/react-router'
import BuilderStudioV3 from '@/components/BuilderStudioV3'

export const Route = createFileRoute('/builder')({
  head: () => ({
    meta: [
      { title: 'ZYRAXON AI Bludar — Build Without Limits' },
      { name: 'description', content: 'Build, preview, manually edit and refine websites with ZYRAXON AI.' },
      { property: 'og:title', content: 'ZYRAXON AI Bludar' },
      { property: 'og:description', content: 'AI builder with live preview, Monaco code editing and streaming AI responses.' },
      { property: 'og:type', content: 'website' },
    ],
  }),
  component: BuilderStudioV3,
})
