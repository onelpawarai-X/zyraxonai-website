import { createFileRoute } from '@tanstack/react-router'
import BuilderStudioV3 from '@/components/BuilderStudioV3'

export const Route = createFileRoute('/builder')({
  head: () => ({
    meta: [
      { title: 'ZYRAXON AI Builder — Build Without Limits' },
      { name: 'description', content: 'Build, preview and refine websites with ZYRAXON AI.' },
      { property: 'og:title', content: 'ZYRAXON AI Builder' },
      { property: 'og:description', content: 'A focused, responsive AI website builder with a live preview and code studio.' },
      { property: 'og:type', content: 'website' },
    ],
  }),
  component: BuilderStudioV3,
})
