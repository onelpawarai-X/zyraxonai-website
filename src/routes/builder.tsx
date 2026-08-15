import { createFileRoute } from '@tanstack/react-router'
import BuilderStudio from '@/components/BuilderStudio'

export const Route = createFileRoute('/builder')({
  head: () => ({
    meta: [
      { title: 'ZYRAXON AI Builder' },
      { name: 'description', content: 'Build, research, preview, inspect and publish websites with ZYRAXON AI.' },
      { property: 'og:title', content: 'ZYRAXON AI Builder' },
      { property: 'og:description', content: 'A focused conversational AI website builder with live preview, web research, code view and GitHub publishing.' },
      { property: 'og:type', content: 'website' },
      { name: 'twitter:card', content: 'summary_large_image' },
    ],
  }),
  component: BuilderStudio,
})
