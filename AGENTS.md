<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

## Project notes

Stack: TanStack Start + React 19, Vite/rolldown, Cloudflare module preset.
Package manager is bun but bun is NOT installed here — use `npx` / `npm`.
Build: `npx vite build` (outputs `.output/`, server entry `.output/server/index.mjs`).
Typecheck: `npx tsc --noEmit`. Lint: `npx eslint <files>` (prettier rules are on).

Routes live in `src/routes/*.tsx` and use `createFileRoute`. After adding or
removing a route file, the generated `src/routeTree.gen.ts` must be regenerated
(the vite dev/build run does this) or `tsc` fails on the route types.

Never rewrite published history (see the Lovable note above). Work on a feature
branch, open a PR, merge it. `Run Datadog Synthetic tests` fails on every branch
including `main` (no Datadog credentials) — it is not a signal about your change.

`npx vite preview` is broken for this preset: it looks for `dist/server/server.js`
while the Cloudflare build writes `.output/server/index.mjs`, so every route
answers 500 with `ERR_MODULE_NOT_FOUND`. That failure exists on `main` too. To
serve a real production build, use
`npx wrangler dev --config .output/server/wrangler.json --port <port>`.

### Testing UI changes

There is no test runner in this repo. To check real browser behaviour, drive
headless Chromium over the DevTools protocol — `chromium` is installed and
`ws` is already in `node_modules` (run node with
`NODE_PATH=$PWD/node_modules`). Launch with
`--autoplay-policy=no-user-gesture-required` so media autoplay is allowed, and
dispatch real `Input.dispatchMouseEvent` clicks so user-activation applies.
Assert on `elementFromPoint` to prove a control is actually reachable — this is
what caught a lightbox whose buttons were covered by the sticky header.

### The ZYRAXON provider

Ten branded models (`src/lib/providers/zyraxon-brands.ts`) served over one
OpenAI-compatible endpoint at `/api/public/zyraxon/v1`. Upstream is the
OpenCode Zen free pool, discovered LIVE from models.dev — nothing upstream is
hardcoded except legacy UI aliases.

Layers, bottom-up:

- `src/lib/builder/zen.server.ts` — the transport. `streamRaw` (SSE) and
  `completeRaw` (one JSON `chat.completion`). The upstream always speaks SSE, so
  `stream: false` is *implemented* here by draining the stream; it is not
  forwarded. Do not "fix" it by passing `stream: false` upstream.
- `src/lib/providers/media.ts` — pure content-part normalisation
  (`image_url`/`video_url`/`input_audio`/`file`), modality detection, and the
  size budget for large media. No imports, so it runs in Node and the browser.
- `src/lib/providers/video-compress.client.ts` — browser ffmpeg.wasm compressor
  and slicer, loaded lazily from a CDN only when a file is actually too large.
- `src/lib/providers/lane-pool.server.ts` — admission control. `run` for
  non-streaming work; `stream` holds the lane until the SSE body is *drained*.
  Using `run` for a streaming turn would bound only stream setup, not the number
  of open streams — that is the bug `stream` exists to prevent.
- `src/lib/providers/zyraxon-brand.server.ts` — the rooted provider. Normalises
  messages, orders the chain by the modalities a turn needs, rotates upstreams
  inside one lane, and always labels the response with the ZYRAXON name.

Capacity is per-process and operator-tunable: `ZYRAXON_MAX_LANES`,
`ZYRAXON_MAX_QUEUED`, `ZYRAXON_QUEUE_TIMEOUT_MS`, `ZYRAXON_MAX_WORK_MS`. A lane
past its queue deadline or its work deadline is shed with a 503 rather than
queued forever, so a flood cannot take the process down.

Tests: `npm run test:provider`. Most scripts run under plain `tsx`, but the ones
that import `system-prompt.txt` need
`--import ./scripts/raw-import-loader.mjs` (a bare `tsx` run dies with
`ERR_UNKNOWN_FILE_EXTENSION`).

### Two gotchas that caused real bugs

- Do not pass `muted` to `<video>` as a JSX prop. React re-applies it on every
  render, so the audio dies as soon as any state changes. Set `video.muted`
  imperatively via a ref, and call `play()` inside the click handler that
  unmutes so the gesture unlocks sound.
- The site header is `sticky z-50`. Any full-screen overlay must render above
  it (`z-[100]`) and be portalled to `document.body`, otherwise the header
  covers the overlay's top controls and eats the clicks. Portal in an effect
  (`if (!mounted) return null`) because there is no `document` during SSR.

