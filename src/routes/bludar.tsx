import { createFileRoute } from '@tanstack/react-router'
import BuilderStudio from '@/components/BuilderStudioClean'

export const Route = createFileRoute('/bludar')({
  head: () => ({
    meta: [
      { title: 'ZYRAXON AI Bludar — Build Without Limits' },
      { name: 'description', content: 'A premium AI website builder for building, previewing and refining projects in real time.' },
      { property: 'og:title', content: 'ZYRAXON AI Bludar' },
      { property: 'og:description', content: 'Build, preview and refine websites with ZYRAXON AI.' },
      { property: 'og:type', content: 'website' },
    ],
  }),
  component: BuilderStudio,
})
