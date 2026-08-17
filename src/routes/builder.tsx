import { createFileRoute } from '@tanstack/react-router'
import BuilderStudioV5 from '@/components/BuilderStudioV5'
import BuilderPreviewEnhancer from '@/components/BuilderPreviewEnhancer'

export const Route = createFileRoute('/builder')({
  head: () => ({
    meta: [
      { title: 'ZYRAXON AI Bludar — Build Without Limits' },
      { name: 'description', content: 'Build, preview, edit, export and sync websites with ZYRAXON AI.' },
      { property: 'og:title', content: 'ZYRAXON AI Bludar' },
      { property: 'og:description', content: 'Fast AI builder with live Monaco editing, PDF/project exports and GitHub workspace.' },
      { property: 'og:type', content: 'website' },
    ],
  }),
  component: () => (
    <>
      <BuilderStudioV5 />
      <BuilderPreviewEnhancer />
    </>
  ),
})
