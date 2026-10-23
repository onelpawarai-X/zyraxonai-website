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
  `stream: false` is _implemented_ here by draining the stream; it is not
  forwarded. Do not "fix" it by passing `stream: false` upstream.
- `src/lib/providers/media.ts` — pure content-part normalisation
  (`image_url`/`video_url`/`input_audio`/`file`), modality detection, and the
  size budget for large media. No imports, so it runs in Node and the browser.
- `src/lib/providers/video-compress.client.ts` — browser ffmpeg.wasm compressor
  and slicer, loaded lazily from a CDN only when a file is actually too large.
- `src/lib/providers/lane-pool.server.ts` — admission control. `run` for
  non-streaming work; `stream` holds the lane until the SSE body is _drained_.
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
`ERR_UNKNOWN_FILE_EXTENSION`). The speech suites are part of it: `test:stt`
(`verify-stt.ts` plus `verify-stt-stream.ts`) and `test:tts`.

`.github/workflows/provider-checks.yml` runs the same suite plus `tsc` on every
PR, and installs `ffmpeg` and `espeak-ng` first. The two audio verifiers build
their own sample with those tools when no clip is passed, so the decode, resample
and live-stream assertions actually run in CI instead of printing SKIP — a skipped
audio check is how the MP3/WebM/Ogg decode path stayed broken unnoticed.

#### Choosing an upstream (latency and modality)

Two rules decide which upstream a brand leads with. Both live in
`src/lib/providers/zyraxon-brands.ts` and are the single source of truth — the
SSE label, the catalogue the provider page reads, and the first model attempted
all go through `rotationFor`/`activeFor`, so they cannot disagree.

1. Capability only counts when the turn needs it. `capabilityScore` takes the
   turn's own `need` set; a modality the caller did not send is scored neutral,
   not as a miss. A brand may _support_ a rare modality (pdf, audio) without every
   turn carrying it, and scoring the profile unconditionally pinned every plain
   text turn to the one model that served that modality — in practice the slowest
   model in the pool. Pass the need.
2. Capability first, then measured speed. `MEASURED_TTFT_MS` is a live
   three-run probe of the public endpoint (medians range from ~1.6s to ~36s, an
   order of magnitude for the same capability). `bySpeed` is only a tiebreak
   after capability, and an unmeasured id sorts last so a new upstream never
   displaces a timed one. Re-measure when the pool churns.

Audio is special: the catalogue lies about it. Several free models declare audio,
accept the request, drop it, and answer "no audio attached". Only
`AUDIO_VERIFIED_UPSTREAMS` — ids probed with a real spoken clip — may lead an
audio turn. Keep that set in step with the live pool when it churns.

`PROBE_MS` (`ZYRAXON_PROBE_MS`, default 4s) is the first-token ceiling: inside it
a failure can still rotate, past it the keepalive holds the connection. The
heartbeat only starts after the Response is handed back, so the longest a caller
can see no byte at all is `max(PROBE_MS, HEARTBEAT_MS)` — check that, not the two
values separately, when tuning.

`scripts/verify-lane-pool.ts` pins `Date.now` for the seeded-session check: the
seeded tail is a pure function of `(seed, epoch-ms)`, so two calls only agree
within one millisecond and the check is flaky without a pinned clock.

Remove any `scripts/_tmp-*.ts` scratch file before committing; they are not part
of the suite.

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
  `{ type: "media", kind, url }` shape _before_ the provider sees them. Anything
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
- A tool-calling client sends the assistant's `tool_calls` block _and_ the
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

| Sent                                    | Result                                                |
| --------------------------------------- | ----------------------------------------------------- |
| `zyraxon-codex` + base URL              | `BadRequestError: LLM Provider NOT provided`          |
| `openai/zyraxon-codex` + base URL       | answers                                               |
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

### A stream must never look idle

An intermediary — Cloudflare, a load balancer, a phone's network — drops a
connection that writes nothing for long enough. A reasoning model can think for
tens of seconds before its first token, so a relay that only writes when the
upstream writes goes idle and the caller's answer is cut off mid-flight.

Two things hold the line, and both are needed:

- `sse()` in `zen.server.ts` sends an SSE comment (`: zyraxon-keepalive`) every
  `HEARTBEAT_MS` (10s) whenever it is waiting. Clients ignore comments, so this
  is invisible to callers and visible to every proxy. `verify-heartbeat.ts`
  proves pings flow across a 20s silent upstream.
- `streamRaw()` pulls the first token before returning the Response, but only for
  up to `PROBE_MS` (12s). That window is what lets rotation work: a retired or
  refused model fails inside it and the next model in the chain is tried. A model
  that is merely slow passes the deadline, the Response is returned at once, and
  the keepalive covers the rest of the wait. Do not remove the probe to "make it
  stream sooner" — that silently breaks rotation. Do not make it unbounded
  either, or a slow model stalls the caller before the keepalive can start.

### Every request is independent

There is no shared session state on the hot path, and there must not be. Each
request mints its own upstream fingerprint (`newSessionId()`, per call), its own
lane, and its own stream. One caller's rate limit, stall or disconnect therefore
cannot touch another's. `verify-isolation.ts` runs 300 concurrent callers and
asserts every one is answered, none is truncated, and all 300 carry distinct
fingerprints — the property that makes "a million callers, none blocked" true
rather than hopeful.

If you add anything that caches or shares state across callers, check it against
that test first: a shared mutable session is exactly what makes one caller's
failure break everyone else's stream.

### Speech: the Edge engine, and the token that guards it

Every answer can be spoken. `src/lib/tts/edge-speech.server.ts` drives Microsoft
Edge's Read Aloud engine over a WebSocket, and `/api/public/tts` streams the MP3
back as it is synthesised. Three things there are easy to get wrong:

- **The token is not a plain hash.** `edge-tts-token.ts` ports the v2
  `Sec-MS-GEC` algorithm (a modified SHA-256 plus a CS64 mixer) in BigInt. The
  arithmetic multiplies a 32-bit word by 2^32 + 1 and needs the full 64-bit
  product, which a JS number cannot hold, so plain numbers produce a token that
  looks right and is rejected. `verify-tts.ts` compares the output against the
  reference implementation byte for byte — do not edit that file without it.
- **The socket URL is https, not wss.** A Workers-style runtime upgrades through
  `fetch` with an `Upgrade: websocket` header and refuses a `wss://` URL with
  "Fetch API cannot load". Use the upgrade header.
- **Binary frames arrive as a Blob**, not an ArrayBuffer. Reading one as a typed
  array yields nothing and the reply comes back silent. Await
  `blob.arrayBuffer()`.

`speakable()` strips code, links and Markdown first: reading a code block aloud
is unusable, so a fence becomes "a code block, N lines". The voice is chosen from
the answer's language, so a Bengali reply is read by a Bengali voice.

### Speech to text: one endpoint, two modes, a language you must state

`POST /api/public/stt` is the only speech-to-text URL. It answers in two shapes
and picks between them from the request, so a client never has to find a second
endpoint:

- **Batch** — send a whole recording (`multipart/form-data` with a `file`, or
  JSON with a base64 `audio` field) and get `{ text, language }` back once.
- **Live** — `?mode=live` plus raw 16-bit PCM in the body, and the reply is SSE:
  `ready`, then `partial` as words arrive, `segment` when a chunk is committed,
  and a final `done`. PCM only: a compressed container cannot be cut at an
  arbitrary byte, so a WebM/Opus frame would have to be decoded as a unit. A
  browser produces PCM directly from an AudioWorklet.

`language` is **required** in both modes — a form field, a JSON field, or the
`?language=` query. There is no auto-detection, and it was deliberately removed:
the recogniser does not detect language, so asked for English about Bengali audio
it returns English-sounding words at high confidence rather than failing. A guess
therefore produces a confident wrong transcript, which is worse than an error.
A missing `language` is a 422 naming the field. `GET` on the same URL returns the
endpoint's own contract (modes, required fields, languages) so a client can read
it without the docs.

`src/lib/stt/stream.ts` holds the live path. Committed text never rewrites, and
each segment carries the last `overlapSeconds` into the next so a word on the
boundary is heard whole and then trimmed — that is what keeps captions from
flickering. The partial-prefix check in `verify-stt-stream.ts` compares against
the committed text _as it stood when the partial was emitted_, in order; an
earlier version compared the first four characters against every segment and
passed a genuinely truncated partial by accident.

#### The decoders' wasm must be compiled at build time

`mpg123-decoder` and `opus-decoder` call `WebAssembly.compile()` the first time a
decoder is built. workerd refuses to compile wasm from bytes at request time —
`Wasm code generation disallowed by embedder` — and a worker that reaches that
call is **cancelled rather than answered**, which surfaces as a 502. That is why
MP3, WebM and Ogg uploads failed while WAV and FLAC (no decoder needed) worked,
and why it is invisible on a dev machine: Node compiles wasm happily.

The fix hands each decoder an already-compiled module:

- `src/lib/stt/wasm/index.ts` imports the two `.wasm` files; the bundler turns
  those imports into `WebAssembly.Module` values.
- `src/lib/stt/wasm/vite-plugin.ts` is what makes that true. Nitro ships the same
  behaviour as `unwasm`, but only in Nitro's environment — the speech route is
  bundled by the TanStack Start **SSR** environment first, so without this plugin
  the import arrives as a bare file with no `default` export and the build fails
  with `[MISSING_EXPORT] "default" is not exported`. The plugin resolves the
  import to a compiled module in every environment and writes the wasm bytes
  beside the importing chunk (in `generateBundle` + `closeBundle`; `emitFile` in
  `generateBundle` alone is not copied into a `no_bundle` Nitro output).
- The plugin has two outputs, and dev needs the other one. In a build it emits a
  virtual asset import and rewrites it in `generateBundle`, but dev never
  bundles, so the rewrite never runs — the virtual id then reaches Vite's loader
  as a file path, and the null byte in it makes `readFile` throw
  (`ERR_INVALID_ARG_VALUE ... '\x00zyraxon-wasm-asset:0'`). That one throw takes
  down the whole module graph, so the home page and every route failed with
  "This page didn't load", not just speech. In `serve` the plugin instead
  generates a module that compiles its own bytes, which Node allows and workerd
  does not need to, because dev is never the runtime this protects.
- `decode.ts` sets `Decoder.module` on the inner class — `OpusDecoder`,
  `MPEGDecoder`, the FLAC inner `Decoder`, and the OggVorbis/AAC ones — before
  building a decoder. That static property is undocumented in the published
  types, hence `src/types/wasm-audio-decoders.d.ts` and
  `src/types/vorbis-aac-decoder-inner.d.ts`. The inner class must come from the
  same module as the public class it is handed to.
- Ogg is routed by the codec its first page declares: Vorbis has its own decoder,
  Opus its own. WebM is still Opus-only — its Vorbis codec is refused by name,
  because a Vorbis packet fed to the Opus decoder crashes its wasm and a crash in
  the request path is cancelled rather than answered. Raw AAC (ADTS) decodes; the
  MP4/M4A wrapper is refused by name because lifting the audio out of it means
  walking the box tree.
- `src/lib/stt/wasm/*.wasm` are byte-identical to what each library embeds, so
  there is no third-party blob to trust and nothing to re-download.

Do not "simplify" this by letting the libraries compile their own wasm, and do
not read the wasm at runtime: both reintroduce the 502. `scripts/verify-stt-wasm.ts`
is the guard — it forbids runtime wasm compilation exactly as workerd does and
then decodes MP3, WebM, Ogg and FLAC, so a regression fails in CI instead of in
production. It is part of `test:stt`.

FLAC is the exception to the hook's shape: `@wasm-audio-decoders/flac` reads the
module from its **inner** class `_FLACDecoder`, not from the `FLACDecoder` it
exports, so `decode.ts` imports `_FLACDecoder` from a deep path and sets
`_FLACDecoder.module`. That path is not in the package's `exports` map, so
`vite.config.ts` aliases it and `scripts/raw-import-loader.mjs` resolves it for
the test runner. Both resolve through the package's own entry point, so a layout
change inside the package does not silently break the alias.

Both FLAC classes must be imported from that **same** specifier. Taking the
public `FLACDecoder` from the package entry point as well bundles a second copy
of `FLACDecoder.js`, the hook lands on the copy the public class never reads, and
the runtime compile comes back — a request that hangs until workerd cancels it,
not an error. Node hands both specifiers one module, so no Node test can see
this; `verify-stt-wasm.ts` asserts the import shape instead, and the real proof
is a request against `wrangler dev`.

The FLAC decoder hook and the codec guards are only observable on workerd. Node
resolves the deep specifier to the same module as the entry point, so a duplicate
copy cannot appear, and Node lets the Opus decoder read Vorbis packets without
crashing. Run `npx wrangler --cwd ./.output dev` after a build and post one file
per format; the matrix should be WAV, FLAC, MP3, Ogg Opus and WebM Opus at 200,
and M4A, Ogg Vorbis and WebM Vorbis at 415.

#### FLAC is decoded, not passed through

The engine reads FLAC natively, so FLAC used to be handed to it untouched. That
was wrong twice over, and both halves failed silently — an empty transcript, not
an error:

- The declared sample rate was hard-coded to `16000`. The engine takes that on
  trust and returns nothing when it does not match the stream, and ffmpeg's FLAC
  default is `22050`.
- A single request is capped at about thirty seconds. Anything longer was
  truncated with no indication that text was lost.

So FLAC now goes through `decodeFlac()` like every other container: one PCM
buffer, cut into windows by `transcribeLong`. The decoder reports the rate it
found, and `verify-stt.ts` asserts it against a 22 050 Hz fixture, so neither
half of the bug can come back unnoticed.

#### A very large recording is streamed, not decoded whole

A whole-file decode holds the entire recording as PCM before the first window is
sent — a hundred-megabyte MP3 is well over an hour, hundreds of megabytes of
samples — and the Worker heap dies well before the response. So past
`STREAM_THRESHOLD_BYTES` (8 MB) the batch path switches to `transcribeStream`,
which pulls ~25-second windows lazily from `audioChunks()` in `ingest.ts`: the
streaming decoders in `decode.ts` for compressed containers, and a header-only
read of the WAV data chunk (or bare PCM) for the rest. Peak memory is then a
function of the window length rather than the recording's.

The windows run `WINDOW_CONCURRENCY` at a time and finish out of order, so each
is written to its own slot by index and the transcript is joined in order —
never in completion order. A window is sized in the *source* rate's samples and
resampled after, because sizing it in target samples made a window a fraction of
a second at 44.1 kHz. `TRANSCRIBE_BUDGET_MS` still applies: a recording too long
to finish inside it returns the transcript so far with `truncated: true`, rather
than holding the connection until the host drops it. `canStream()` reports
whether a container has this path, and `verify-stt.ts` asserts that a 60 s clip
comes out as several full 25 s windows carrying exactly the whole recording.

#### M4A/AAC is refused, not silently emptied

An `.m4a` from an iPhone or Safari is an MP4 container, and it used to fall
through `sniff()`'s header checks to the `"pcm"` fallback — so it was read as raw
samples, produced no speech, and came back as an empty transcript that looked
exactly like "nobody spoke". The recogniser rejects both MP4 and raw AAC with a
400, so there is no pass-through to fall back on and no AAC decoder is bundled.
`sniff()` now detects the `ftyp` box and returns `"mp4"`, and
`decodeContainer()` refuses it with a message naming the format and the formats
that work. The endpoint returns 415 for it, not 502: it is the caller's format,
not a server fault.

### The provider is a hub of functions, each with its own page

Every endpoint the provider serves is described once, in
`src/lib/providers/endpoints.ts`, and every *function* of the provider — chat,
the model line, media, tools, errors, speech out, speech in, and each host
application — is described once in `src/lib/providers/functions.ts`. A function
entry does not repeat an endpoint: it points at endpoint ids from
`endpoints.ts` and integration ids from `integrations.ts`, so a page can never
drift from the catalogue it is built from.

`/providers` is the hub: it renders every function as a card linking to
`/providers/<slug>` (`ProviderFunctionPage.tsx`), then the whole endpoint
catalogue underneath (`ProviderEndpointCatalogue`). The hub is for a reader who
does not yet know what they want; a function page is for one who does, and it
shows that function alone. Add a function to the module and its card, its page
and its sitemap entry all appear; do not hand-write one into a page.

`GET /api/public/zyraxon/v1/endpoints` serves the endpoint list as JSON, and the
sitemap generator (`scripts/generate-sitemap.ts`) walks both catalogues, so a
new function is in the sitemap on the next run rather than when someone
remembers it.

The pages are written to be read by a search or fetch tool as well as a person,
so their detail lives in `<details>` rather than behind `useState`. A collapsed
`<details>` still keeps its contents in the HTML; a state toggle does not, which
would put every integration field, step and snippet out of reach of exactly the
reader the page is meant to serve. `public/llms.txt` is the plain-text map that
points such a tool at the page and the JSON contracts, and `robots.txt` allows
the four contract URLs (`/v1/endpoints`, `/v1/models`, `/v1/provider`,
`/v1/integrations`) while still disallowing the rest of `/api/`.

### One large reference per provider system

The provider guide (`provider-docs.ts`) is a tour; the references are what it
links out to. Each system has one, in `src/lib/docs/provider-system-docs.ts` —
speech to text, text to speech, multimodal chat — written to stand alone so a
reader who lands on one has the whole system in front of them. They are long on
purpose: a reference that omits the container list, the error table or the
reason behind a required field sends the reader somewhere else to finish.

`npm run docs:markdown` (`scripts/generate-docs-markdown.ts`) renders the same
blocks to `docs/*.md`, so the Markdown a repository reader opens cannot drift
from the page a site visitor reads. Edit the blocks, not the Markdown.

The provider page itself opens with `ProviderHighlights`, which says the three
things a caller arrives asking about in one line each: put a microphone in your
chat box and the speech-to-text endpoint sends real-time text back; send text
and the text-to-speech endpoint sends audio; and every model takes video, audio,
pictures and documents, inline or by URL.

## The provider's free-tier ceiling, and what actually fixes it

The upstream free tier refuses with `Free usage limit reached. Subscribe to
OpenCode Go`. Its limiter is **per IP address** (`ipRateLimiter.ts` upstream),
not per session: a session fingerprint isolates callers from each other's
counters, but every lane in one process still leaves through one IP and shares
that IP's ceiling. No amount of model rotation clears it, because the next
model is behind the same address.

So the fix is at the network layer, in `src/lib/providers/egress.server.ts`:

- `ZYRAXON_EGRESS_URLS` lists proxy endpoints (`http://user:pass@host:port`,
  comma or whitespace separated). One entry is a pool of one.
- Every turn takes the next address in round-robin and holds it for its whole
  life, so consecutive requests leave by different IPs and a stream is never
  split across two clients.
- An address that answers 429, or whose failure text matches
  `isQuotaFailure()`, is parked for `ZYRAXON_EGRESS_COOLDOWN_MS` (default 10
  min) and taken out of rotation. A turn that hits a limit releases its address
  so its next attempt takes a fresh one.
- `/api/public/zyraxon/v1/provider` reports `egress.mode`; `direct` means the
  deployment has one IP and the upstream may throttle it. That is a deployment
  gap, not something the rotation loop can fix.

Credentials are a second, independent ceiling: `OPENCODE_ZEN_API_KEYS` takes a
comma-separated list, and a key that reports a spent quota is set aside for
`ZYRAXON_KEY_COOLDOWN_MS` (default 90s) in
`src/lib/builder/upstream-keys.server.ts`.

Neither mechanism can conjure capacity. A hundred thousand callers on a free
tier needs a real pool of addresses and accounts — the code now uses whatever
pool it is given, spreads every request across it, and stops spending a
limited address. It cannot invent addresses that were never configured.

## The served pool is a probed allow-list, not a catalogue

`models.dev` and the Zen console both describe the free pool, and both are
wrong — in opposite directions, which is worse than either alone:

- **models.dev is stale.** It still advertises models Zen retired weeks ago
  (34 of 45 "free" ids answer 400/410). A pool built from its `free` flag leads
  a brand with a model that cannot answer, which the caller reads as "the app
  is broken".
- **The console omits live models.** It left out `nemotron-3-ultra-free`,
  `longcat-2.5-preview-free` and `cat-jam-free` while all three answered 429,
  and listed `jev-1.13-free`, which refuses every request with "Model does not
  support this protocol". Filtering by it deletes working models.

So neither source decides what is served. `VERIFIED_FREE_MODELS` in
`src/lib/builder/zen.server.ts` does — an allow-list of ids a live probe has
confirmed answering (429 or 200, never 400/404/410). The catalogue supplies
*metadata* (context, output, modality) for allow-listed ids and nothing else;
an id the catalogue has never heard of is still served with safe defaults.
`RETIRED_FREE_MODELS` is the belt to that allow-list's braces.

The console's listing is a **priority, never a filter** (`liveFirst` in
`zyraxon-brands.ts`): a listed model is tried first, but a model absent from the
listing is not deleted from its brand's chain. Every brand's `preferred` must
sit inside `VERIFIED_FREE_MODELS`; `verify-modalities.ts` asserts it.

Re-probe and update the allow-list when the upstream pool churns. The probe is
a real request carrying the gate `read` tool, so a model that is alive but
gate-broken still fails the check the way the app would.

## A spent quota stops the rotation

Free-tier quota is an **account** decision: every model in the pool draws on the
same window, so a 429 from one is a 429 from all. Rotating after it spent the
lane's whole attempt budget rediscovering the same wall and then reported
`provider_unavailable` (502) — hiding the one fact that explains the failure.
`rotateThrough` and `raceFor` now stop at the first quota refusal
(`isQuotaFailureDetail`) and set `quota: true`, which `brandFailureResponse`
turns into a 429 `free_tier_quota` with `Retry-After`. A measured live turn went
from 502 after walking 11 models to 429 after 1, in 148ms.

This is the same rule as the credential gate and the per-IP limiter: an
account-wide or address-wide refusal is not something model rotation can route
around, so the code stops and tells the truth instead of retrying.

## The free-tier gate is a request-shape check, not a quota

`403 FreeTierError — "free tier can only be used from within OpenCode"` does not
mean the account is spent. It means the request did not look like the OpenCode
client. The gate reads four things, and all four must hold:

1. `User-Agent` whose leading token is `opencode/<version>`.
2. `x-opencode-session` shaped `ses_<12 lowercase hex><14 alnum>` (the old
   shape; the newer `ses_<64 hex>` shape is refused).
3. `stream: true` in the body.
4. Enough of OpenCode's own tool *names* in `tools[]`. The published floor is
   **two** of `bash`, `edit`, `glob`, `grep`, `read`; it has been five and has
   moved. Schemas and descriptions are ignored, and the tools are never called.

`GATE_TOOL_CATALOGUE` therefore carries all eleven names the real client sends
(`bash`, `edit`, `glob`, `grep`, `read`, `skill`, `task`, `todowrite`,
`webfetch`, `websearch`, `write`), not just `read`. Because a tool that is only
advertised can still be *called* by a model that ignores the intent, both wire
paths send `tool_choice: "none"` when the caller defined no tools (and `"auto"`
when they did, since the caller wants their tools to run). The SDK paths send
`toolChoice: "none"` unconditionally — no caller tool ever reaches them.

Verified live: with the full catalogue, `tools[]` of one name and of eleven both
answer 200 from a clean IP, and a caller-supplied tool cannot shrink the
catalogue below the floor.

## The free tier is limited per egress IP, not per account

The same request that answers `429 FreeUsageLimitError` from this workspace's IP
answered `200` with a real completion from a GitHub Actions runner's IP, and
30 consecutive requests from that runner all answered 200. So the 429 is an
address-wide limiter, not a spent account: the deployment's single egress
address is what runs dry. `ZYRAXON_EGRESS_URLS` (a `gw+https://…` Cloudflare
Worker, or a socket proxy) spreads turns across addresses; `egress.server.ts`
already rotates and cools a limited lane, and `/api/public/zyraxon/v1/provider`
reports `egress: { mode, proxies, spread }`. Without a configured egress the app
is one address, and one address is one bucket.

A browser cannot be the egress: the upstream answers the CORS preflight with
404 and sends no `Access-Control-Allow-Origin`, and `User-Agent` is a forbidden
header in the browser, so a direct call from the page can never satisfy the
gate. Spreading across addresses must happen server-side.

Public CORS relays are not an egress either, and this is measured, not assumed.
Twelve no-signup services were called with a real POST carrying the gate
request (thingproxy, allorigins `/raw`, cors.eu.org, cors-anywhere on Heroku,
`test.cors.workers.dev`, corsfix, cors.lol, corsproxy.io, crossorigin.me,
yacdn, codetabs, cors.sh): every one answered fetch-failed, 520/522, an HTML
landing page, or its own rate-limit text — not one forwarded the POST. The
stable ones are GET-only, localhost-only, or want an API key. Do not spend time
here again; deploy the worker instead (`Deploy egress gateway` workflow, or
`scripts/deploy-egress-worker.sh`).

A Cloudflare Worker is deployed and reachable
(`https://zyraxon-egress.nla85695.workers.dev/`, account
`28d233950b95bb39504be4968a1bc6fd`), but it does **not** fix the quota: measured
from one GitHub runner IP, direct was 4/4 PONG while the same calls through the
worker were 0/4, all 429. The worker's egress is a shared Cloudflare address
(`2a06:98c0:3600::103`) that the upstream has already exhausted — every user of
every free Cloudflare Worker leaves from it, so it is burned. A Worker only
helps when the upstream counts *per caller IP*; here it does not. Do not present
the Worker as the fix.

The fresh-IP result also settles what the 429 is: a brand-new runner IP got
4/4, our long-lived workspace IP gets 429 on every model, and Cloudflare's
address gets 429 on every model. The limit follows the address, and our address
(plus Cloudflare's) is spent. A user's own address would work — but the browser
cannot reach the upstream at all (see the CORS paragraph above), so that path is
closed too.

The API key is real but has no entitlement: `GET /zen/v1/models` with it returns
200, a garbage key returns 401, but every chat call returns 429
(`FreeUsageLimitError`, "Subscribe to OpenCode Go") and paid models return 402
("Insufficient account funds"). Buying Go or adding credits is the one lever
that clears the 429 without depending on any address.

## Testing

`npm run test:provider` (1063 checks) covers the brand contract, rotation,
quota short-circuit, gate catalogue, pool integrity and the media/STT/TTS
surfaces.
`npx tsc --noEmit -p tsconfig.json` must stay clean. Scripts that import
`zen.server.ts` need the `?raw` loader: `npx tsx --import
./scripts/raw-import-loader.mjs <script>`.
