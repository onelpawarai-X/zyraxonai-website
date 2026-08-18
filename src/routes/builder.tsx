import { useEffect, useState } from 'react'
import { createFileRoute } from '@tanstack/react-router'
import BuilderStudioV8 from '@/components/BuilderStudioV8'
import BuilderMicEnhancer from '@/components/BuilderMicEnhancer'
import BuilderControlsGuard from '@/components/BuilderControlsGuard'
import '../styles/builder-controls.css'

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

function BuilderRoute() {
  const [ready, setReady] = useState(false)
  useEffect(() => setReady(true), [])
  if (!ready) return null
  return <><BuilderStudioV8 /><BuilderMicEnhancer /><BuilderControlsGuard /></>
}
