import { useEffect } from 'react'

type FileEntry = { path: string; content: string }

function normalize(path: string) {
  return path.replace(/^\.\//, '').replace(/^\//, '')
}

function assemble(files: FileEntry[]) {
  const byPath = new Map(files.map((file) => [normalize(file.path), file.content]))
  const index = byPath.get('index.html') ?? files.find((file) => /\.html?$/i.test(file.path))?.content ?? '<!doctype html><html><body></body></html>'
  const css = files.filter((file) => /\.(css|scss|less)$/i.test(file.path)).map((file) => file.content).join('\n\n')
  const js = files.filter((file) => /\.(js|mjs|cjs|ts|tsx|jsx)$/i.test(file.path)).map((file) => file.content).join('\n\n')
  let html = index
  html = html.replace(/<link([^>]+?)href=["']([^"']+\.(?:css|scss|less))["']([^>]*)>/gi, (match, _before, href) => {
    const content = byPath.get(normalize(href))
    return content ? `<style data-builder-file="${normalize(href)}">${content}</style>` : match
  })
  html = html.replace(/<script([^>]+?)src=["']([^"']+\.(?:js|mjs|cjs|ts|tsx|jsx))["']([^>]*)><\/script>/gi, (match, _before, src) => {
    const content = byPath.get(normalize(src))
    return content ? `<script data-builder-file="${normalize(src)}">${content}<\/script>` : match
  })
  if (css && !/<style[^>]*data-builder-bundle/i.test(html)) html = html.replace(/<\/head>/i, `<style data-builder-bundle>${css}</style></head>`)
  if (js && !/<script[^>]*data-builder-bundle/i.test(html)) html = html.replace(/<\/body>/i, `<script data-builder-bundle>${js}<\/script></body>`)
  return html
}

export default function BuilderPreviewEnhancer() {
  useEffect(() => {
    let last = ''
    let objectUrl = ''
    const update = () => {
      const iframe = document.querySelector<HTMLIFrameElement>('iframe[title="Generated website preview"]')
      if (!iframe) return
      try {
        const raw = sessionStorage.getItem('zyraxon.builder.files')
        if (!raw) return
        const files = JSON.parse(raw) as FileEntry[]
        const key = JSON.stringify(files)
        if (key === last) return
        last = key
        const html = assemble(files)
        if (objectUrl) URL.revokeObjectURL(objectUrl)
        objectUrl = URL.createObjectURL(new Blob([html], { type: 'text/html' }))
        iframe.src = objectUrl
      } catch {
        // Keep the Builder's native preview if session data is unavailable or malformed.
      }
    }
    update()
    const timer = window.setInterval(update, 350)
    return () => {
      window.clearInterval(timer)
      if (objectUrl) URL.revokeObjectURL(objectUrl)
    }
  }, [])
  return null
}
