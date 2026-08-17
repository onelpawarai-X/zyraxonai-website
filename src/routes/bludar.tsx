import { createFileRoute } from '@tanstack/react-router'
import BuilderStudioV3 from '@/components/BuilderStudioV3'

export const Route = createFileRoute('/bludar')({
  head: () => ({
    meta: [
      { title: 'ZYRAXON AI Bludar — Build Without Limits' },
      { name: 'description', content: 'Build, preview and refine websites with ZYRAXON AI.' },
      { property: 'og:title', content: 'ZYRAXON AI Bludar' },
      { property: 'og:description', content: 'Build, preview and refine websites with ZYRAXON AI.' },
      { property: 'og:type', content: 'website' },
    ],
  }),
  component: BuilderStudioV3,
})
