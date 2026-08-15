import { createFileRoute } from '@tanstack/react-router'

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'content-type',
  'Access-Control-Allow-Methods': 'GET,OPTIONS',
}

type Result = { title: string; url: string; snippet?: string }

export const Route = createFileRoute('/api/public/builder/search')({
  server: {
    handlers: {
      OPTIONS: async () => new Response(null, { status: 204, headers: CORS }),
      GET: async ({ request }) => {
        const query = new URL(request.url).searchParams.get('q')?.trim()
        if (!query) return Response.json({ error: 'q is required' }, { status: 400, headers: CORS })

        try {
          const [duck, wiki] = await Promise.allSettled([
            fetch(`https://api.duckduckgo.com/?q=${encodeURIComponent(query)}&format=json&no_html=1&skip_disambig=1`, { headers: { Accept: 'application/json' } }),
            fetch(`https://commons.wikimedia.org/w/api.php?action=query&generator=search&gsrsearch=${encodeURIComponent(query)}&gsrnamespace=6&gsrlimit=8&prop=imageinfo&iiprop=url|extmetadata&iiurlwidth=900&format=json&origin=*`, { headers: { Accept: 'application/json' } }),
          ])

          const results: Result[] = []
          if (duck.status === 'fulfilled' && duck.value.ok) {
            const data = await duck.value.json()
            if (data.AbstractURL) results.push({ title: data.Heading || query, url: data.AbstractURL, snippet: data.AbstractText })
            for (const item of data.RelatedTopics || []) {
              const topic = item.Topics ? item.Topics[0] : item
              if (topic?.FirstURL) results.push({ title: topic.Text || topic.FirstURL, url: topic.FirstURL, snippet: topic.Text })
              if (results.length >= 6) break
            }
          }
          if (wiki.status === 'fulfilled' && wiki.value.ok) {
            const data = await wiki.value.json()
            for (const page of Object.values<any>(data?.query?.pages || {})) {
              const info = page?.imageinfo?.[0]
              if (!info?.url) continue
              results.push({ title: page.title?.replace(/^File:/, '') || 'Wikimedia image', url: info.descriptionurl || info.url, snippet: info.extmetadata?.ImageDescription?.value?.replace(/<[^>]+>/g, '').slice(0, 240) })
              if (results.length >= 12) break
            }
          }
          return Response.json({ query, results }, { headers: CORS })
        } catch (error) {
          return Response.json({ error: error instanceof Error ? error.message : 'Web search failed' }, { status: 502, headers: CORS })
        }
      },
    },
  },
})
