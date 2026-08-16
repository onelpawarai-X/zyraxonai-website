import { createFileRoute } from '@tanstack/react-router'
import BuilderStudio from '@/components/BuilderStudioToken'

export const Route = createFileRoute('/builder')({
  head: () => ({
    meta: [
      { title: 'ZYRAXON AI Builder' },
      { name: 'description', content: 'Build, research, preview and publish projects with ZYRAXON AI.' },
      { property: 'og:title', content: 'ZYRAXON AI Builder' },
      { property: 'og:description', content: 'A conversational AI builder with live preview and secure GitHub token publishing.' },
      { property: 'og:type', content: 'website' },
      { name: 'twitter:card', content: 'summary_large_image' },
    ],
  }),
  component: BuilderStudio,
})