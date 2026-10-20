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

### Public provider contract: media, tools, capacity

- The public route normalises inbound content parts to the canonical
  `{ type: "media", kind, url }` shape *before* the provider sees them. Anything
  that inspects parts downstream (`partMediaKind`, `urlOfPart`, `needsWire`) must
  read that canonical shape as well as the raw OpenAI spellings
  (`image_url`/`input_audio`/`video_url`). Reading only the raw spellings makes
  every audio/video turn invisible to the router, and it silently degrades to a
  text answer with no error.
- Caller-defined `tools` are supported and must reach the upstream. The SDK path
  advertises only the single upstream gate tool (`FREE_TIER_GATE_TOOLS`), so a
  turn carrying caller tools is routed to the raw wire path instead; the gate
  tool stays first and caller tools are deduplicated against it. Removing the
  gate tool makes the upstream refuse the turn.
- Responses always name the ZYRAXON brand, never the upstream id. This applies to
  the non-streaming wire path too, which builds its own `chat.completion` object.
- Capacity is `ceiling = shards * (primary lanes + spill lanes)`
  (`fleetStatus()` in `fleet.server.ts`). `ZYRAXON_FLEET_SHARDS` defaults to 1 on
  purpose: with one process deployed, reporting a fleet would misreport capacity.
  Excess load spills to the OpenCode Zen free pool rather than being shed, and
  every response carries `X-ZYRAXON-Capacity: primary|spill`.
- `GET /api/public/zyraxon/v1/models` publishes `provider.since` (the launch
  date) and a stable `created` epoch. Do not use `Date.now()` for `created`.
- A tool-calling client sends the assistant's `tool_calls` block *and* the
  `role: "tool"` result back on the next turn. Both are carried through
  `brandChatStream` and forced onto the raw wire path (the SDK message schema
  has no `tool_call_id`). Dropping either one — e.g. filtering messages to
  `system|user|assistant` — leaves the result unmatched, and the upstream then
  asks for the same tool again on every turn instead of answering. `verify-e2e.ts`
  E2E-6 asserts the upstream receives both.

### Integration surface

The provider is meant to be usable from any client, and the catalogue that
describes how is `src/lib/providers/integrations.ts` — one module read by the
`/providers` page, the provider docs (`provider-integration-docs.ts`) and
`GET /api/public/zyraxon/v1/integrations`. Add a platform there and it appears in
all three; do not hand-write a snippet into a page.

`public/integrations/termux-setup.sh`, `public/integrations/zyraxon-chat.sh` and
`public/integrations/kali-ask.sh` are real, runnable clients, not illustrations.
All three are exercised during development (the chat client is driven over a pty).
Two bugs they caught that are easy to reintroduce:

- A `... | while read` loop runs in a subshell, so any variable it updates is
  discarded. The agent loop accumulates the message history inside the loop, so
  it uses process substitution (`done < <(...)`) instead. With a pipe the model
  is handed the same history every turn and repeats its tool call.
- Only a JSON object can carry an error. A streaming response is SSE (`data: `
  frames), and feeding that to `jq` exits non-zero, which under `set -e` kills
  the script. Guard with a `case "$raw" in \{*)` before parsing.

`termux-setup.sh` downloads `zyraxon-chat.sh` rather than inlining it, so the
installed client and the served file cannot drift apart.

### The model id is deliberately tolerant

Clients differ on how they spell a model. LiteLLM requires a `provider/model`
string and refuses a bare id with `BadRequestError: LLM Provider NOT provided`;
other clients send the bare id. `canonicalBrandId()` in `zyraxon-brands.ts`
resolves both — `zyraxon-codex`, `openai/zyraxon-codex`, `zyraxon/zyraxon-codex`
and `zyraxon/codex` all reach the same brand. `isBrand` and `getBrand` go through
it, so accepting a new wrapper is a one-line change in one place. Do not narrow
this back to an exact match: it reintroduces the most common connection failure.
`verify-integrations.ts` asserts every spelling still resolves.

### Two OpenHands/LiteLLM failures, and where each is fixed

A host that routes the model through LiteLLM (OpenHands does) fails in two
distinct ways, and they need different fixes. Both were reproduced against the
live endpoint with LiteLLM installed:

| Sent | Result |
| --- | --- |
| `zyraxon-codex` + base URL | `BadRequestError: LLM Provider NOT provided` |
| `openai/zyraxon-codex` + base URL | answers |
| `openai/zyraxon-codex`, **no base URL** | `401 Incorrect API key provided` (OpenAI's own error) |

- `LLM Provider NOT provided` is LiteLLM reading the text before the first `/`.
  The fix is the `openai/` prefix, which is why the OpenHands card's Custom Model
  field carries `LITELLM_MODEL` rather than `DEFAULT_MODEL`.
- `401 Incorrect API key provided` names platform.openai.com, so the request went
  to OpenAI, not to us: the host ignored the base URL. In OpenHands that happens
  when **Advanced** mode is off — the Base URL field only exists (and only takes
  effect) in Advanced mode.

Keep this distinction in the docs: our own auth failure returns
`type: "authentication_error"` in the body and does not mention platform.openai.com.

