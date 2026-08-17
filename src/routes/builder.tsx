import { createFileRoute } from '@tanstack/react-router'
import BuilderStudioV4 from '@/components/BuilderStudioV4'

export const Route = createFileRoute('/builder')({
  head: () => ({
    meta: [
      { title: 'ZYRAXON AI Bludar — Build Without Limits' },
      { name: 'description', content: 'Build, preview, edit and refine websites with ZYRAXON AI.' },
      { property: 'og:title', content: 'ZYRAXON AI Bludar' },
      { property: 'og:description', content: 'AI builder with live preview, generated files, Monaco editing and streaming AI responses.' },
      { property: 'og:type', content: 'website' },
    ],
  }),
  component: BuilderStudioV4,
})
