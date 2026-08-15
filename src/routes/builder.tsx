import { createFileRoute } from '@tanstack/react-router'
import BlueprintStudio from '@/components/BlueprintStudio'

export const Route = createFileRoute('/builder')({
  head: () => ({
    meta: [
      { title: 'ZYRAXON Blueprint — AI Website Builder' },
      { name: 'description', content: 'Build responsive websites with free OpenCode models, live preview and GitHub Pages publishing.' },
      { property: 'og:title', content: 'ZYRAXON Blueprint — AI Website Builder' },
      { property: 'og:description', content: 'Build, preview and publish a website with ZYRAXON Blueprint.' },
      { property: 'og:type', content: 'website' },
      { name: 'twitter:card', content: 'summary_large_image' },
    ],
  }),
  component: BlueprintStudio,
})
