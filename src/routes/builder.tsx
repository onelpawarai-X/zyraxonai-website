import { createFileRoute } from '@tanstack/react-router'
import BuilderStudioV6 from '@/components/BuilderStudioV6'
import '../styles/builder-studio-v5.css'

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
  component: BuilderRoute,
})

function BuilderRoute() { return <BuilderStudioV6 /> }
