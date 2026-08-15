import { createFileRoute } from '@tanstack/react-router'
import BlueprintStudioPro from '@/components/BlueprintStudioPro'

export const Route = createFileRoute('/builder')({
  head: () => ({
    meta: [
      { title: 'ZYRAXON Blueprint — AI Website Builder' },
      { name: 'description', content: 'Build, preview, inspect and publish responsive websites with ZYRAXON Blueprint.' },
      { property: 'og:title', content: 'ZYRAXON Blueprint — AI Website Builder' },
      { property: 'og:description', content: 'A premium glass AI website builder with live preview, code workspace and GitHub publishing.' },
      { property: 'og:type', content: 'website' },
      { name: 'twitter:card', content: 'summary_large_image' },
    ],
  }),
  component: BlueprintStudioPro,
})
