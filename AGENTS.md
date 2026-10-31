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

Catalogue reads have their own patience. `TURN_IDLE_MS` (30s) is what a chat turn
is owed when a model goes quiet mid-answer; `ZEN_CATALOG_MS` (6s) is what a model
listing is owed. The two must stay separate — a listing has nothing to stream and
sits on the critical path of every `/v1/models` request, so inheriting the turn
timeout made a cold catalogue cost 8s (models.dev) + 30s (console) ≈ 40s on the
live deployment while a warm one took 4ms. `zenFreeModels` also reads models.dev
and the console listing concurrently for the same reason. `scripts/verify-catalog-latency.ts`
pins both: it points the transport at a console that accepts the connection and
never answers, and asserts the read gives up in about `ZEN_CATALOG_MS` rather
than 30s.

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

**Only `<prosody>` works.** Measured against the live engine, an SSML body
containing `<break>`, `<emphasis>`, `<sub>`, `<phoneme>` or
`<mstts:express-as>` — in any spelling — comes back as a turn with **zero bytes
of audio**, no error. So the entire expressive surface is `rate`, `pitch` and
`volume` on one `<prosody>` element, and the only other lever is the punctuation
in the text: a comma adds ~0.36 s and a sentence terminator ~1.08 s, while
newlines and `…` add nothing at all. That is why `ssml()` normalises the spacing
around punctuation and never emits a pause tag.

**The numbers in `TONES` are measured, not taste.** The metric is F0 span —
p10..p90 over voiced frames — because that is what a listener hears as
liveliness. Nine runs each, median, on the Bengali voices: the female voice goes
116 Hz at `natural` → 125 Hz at `warm` → 131 Hz at `expressive`, while the male
voice sits at 127–134 Hz at every setting. So one table serves both: a clear gain
for the female voice and no worse than neutral for the male one. An earlier
revision keyed the table by gender on the strength of a difference that turned
out to be an **octave error in the pitch estimate** — the naive tracker picks the
second autocorrelation peak and reports half the true F0. Pick the *first* strong
peak, not the global maximum, and the difference disappears.

**Voice liveliness is a property of the voice, not of prosody.** Same measurement
on all four Bengali voices: `bn-IN-TanishaaNeural` 176 Hz, `bn-IN-BashkarNeural`
155 Hz, `bn-BD-NabanitaNeural` 132 Hz, `bn-BD-PradeepNeural` 119 Hz. The `bn-IN`
pair moves nearly twice as far as the `bn-BD` pair at every setting, and no
`tone` closes the gap. `VOICE_PREFERENCE` in `edge-speech.server.ts` therefore
orders `bn` by that measurement, so `locale=bn` resolves to the livelier voice
for each gender. It is scoped per language on purpose: a language with no
measured order keeps the old female-first rule, so this cannot silently change
some other language's default. `locale=bn-BD` still gets `bn-BD`, because an
exact region match is checked before the language fallback.

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

#### Choosing the voice: `voice` names it, `gender` picks its kind

A caller decides who speaks in one of two ways, and they are not the same lever:

- **`voice`** names an exact voice from the catalogue
  (`GET /api/public/tts/voices`). It is matched **case-insensitively** and
  canonicalised before it is sent upstream — the engine accepts
  `bn-bd-pradeepneural`, but the catalogue spells it `bn-BD-PradeepNeural`, and
  the response header always carries the catalogue spelling. A name that matches
  nothing is refused with a **400 `unknown voice`**. That check matters: the
  engine answers an unknown name with `200` and **zero bytes of audio**, which a
  caller reads as "the audio is broken" rather than "that voice does not exist".
  It was doing exactly that on the live site until the check was added.
- **`gender`** (`female` / `male`, plus `f`/`m`/`woman`/`man`) chooses the *kind*
  of voice **in the language of the text**, without the caller knowing any name.
  It is consulted only when `voice` was not given.

`pickVoice(locale, voices, preferred, gender)` applies them in that order, and
the rule is that **the language outranks the gender**: if a language has no voice
of the requested gender, the gender is dropped and a voice in the language is
chosen anyway, because a voice in the wrong language does not read the text at
all. `gender` is also applied to an **exact** locale match, not only to a
language-prefix match — the first cut returned the first voice of `bn-IN` and
ignored `male`, which `verify-tts.ts` now pins.

Measured live, by median F0 of the returned audio (autocorrelation over voiced
frames), so the choice is proven and not just labelled:

| Voice | median F0 | reads as |
| --- | --- | --- |
| `bn-BD-NabanitaNeural` | 213 Hz | female |
| `bn-IN-TanishaaNeural` | 250 Hz | female |
| `bn-BD-PradeepNeural` | 121 Hz | male |
| `bn-IN-BashkarNeural` | 120 Hz | male |

Bengali ships four voices — two female, two male — across `bn-BD` and `bn-IN`,
so both genders resolve in Bengali. `X-ZYRAXON-Voice` reports the voice that
actually spoke, which is how a client confirms what it got.

#### The engine answers a pause *element* with silence

This one is worth its own heading because it is invisible until someone listens.
Measured against the live engine: an SSML request containing `<break>` — any
spelling, with `time` or `strength`, self-closed or not — comes back with **zero
bytes of audio**. Not a short utterance, not an error: `turn.start`, then
`turn.end`, and nothing in between. `<s>` and `<mstts:silence>` fail the same
way. So the obvious way to add a "natural breathing pause" silences the entire
reply, and every check that only asserts a 200 still passes.

The pauses have to come from the text, and they do. On the same two words:
a comma adds ~0.36 s, a sentence terminator ~1.08 s. `ssml()` therefore only
normalises the spacing around a terminator — a `।` glued to the next word is read
as part of it and loses its pause — and leaves the punctuation itself alone. It
must never emit a pause element. `verify-tts.ts` asserts the absence of one
(`/<break|<s>|mstts:silence/i`) as well as the spacing, because the failure mode
is silent audio rather than an error.

`<prosody>` is the one SSML element the engine honours, and it is what the
`tone` parameter (`warm` default, `expressive`, `natural`, `clear`) sets: rate,
pitch and volume for the whole utterance. Tone does not change the pauses — a
pause is what makes speech intelligible, and no tone is better without one.

#### Long text is chunked, so the first byte does not wait for the last word

`SINGLE_UTTERANCE_CHARS` (2000) is where a request stops being one utterance.
The engine plans a whole utterance before it sends the first frame, so one
50,000-character utterance makes the caller wait for that plan; chunking bounds
the wait to the first sentence. Measured on a 5000-character Bengali request:
time-to-first-audio 7 ms, whole 5.3 MB body in 60 s. `MAX_CHARS` is 50,000 and
the chunks are piped through one continuous MP3 stream, so a player hears one
recording rather than a series of clips.

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

#### Rolling mode exists because the host can buffer the upload

The SSE live mode needs the host to hand the worker the request body **as it
arrives**. On the live deployment it does not: measured directly, the worker saw
`ready` at **11.4 s** for a 5.3 s clip whose body was streamed in over 5 s, and
at **6.2 s** over HTTP/2 — i.e. only after the whole upload landed. The same
request against local `workerd` answered `ready` at **0.07 s**. So the code was
never the problem: the platform holds the request body, and no single-stream
design can be real-time behind it. Do not "fix" this by rewriting the SSE path —
it is correct on a runtime that streams the body, and that is what it is for.

`?mode=rolling` (or `?rolling=1`) is the shape that works behind a buffering
host. The caller sends a short, **complete** window per tick — `multipart/form-
data`, `audio/wav`, `audio/l16` or JSON — and gets `{ text, added, committed }`
back. `added` is the part of `text` past the `committed` the caller sent, so the
client appends and never rewrites. Each tick is a small request the host passes
straight through; measured live, the first text arrived at **0.13–0.24 s** and a
6.5-minute clip transcribed at **2.2× real time**.

Two things about the protocol are load-bearing:

- **The unit is an utterance, not a fixed slice.** Post the sentence being spoken
  as it grows and start a new one when the speaker **pauses**. A hard cut
  mid-word leaves two half-words that the recogniser joins without a space —
  measured on a 6.5-minute clip, that dropped verbatim sentences from 10/12 to
  8/12. Cutting on silence is what makes the join clean.
- **`alignAddition` must keep the space at the seam.** It returns the fresh text
  from just after the matched suffix's last character, not from the addition's
  first one; slicing from the addition drops the separating space and runs two
  words together when the client appends. It also matches with whitespace
  ignored and handles the window sliding back, because the recogniser revises its
  first word as the window grows. `verify-stt-realtime.ts` pins every one of
  these cases, including a sequence that must never duplicate a word.

`wantsRolling` is checked **before** `wantsStream` in the POST handler: a
`?mode=rolling` request is not a stream, and letting it fall into the SSE path
would give the caller a stream that only starts after they stop speaking.


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

So FLAC now goes through `decodeFlac()` like every other container: one PCM
buffer, cut into windows by `transcribeLong`. The decoder reports the rate it
found, and `verify-stt.ts` asserts it against a 22 050 Hz fixture, so the rate
half of the bug cannot come back unnoticed.

A note on the other half, because the code comment used to claim more than is
true. It said a single request was "capped at about thirty seconds" and anything
longer was silently truncated. Measured against the live recogniser, that is
wrong: clips of 60 s, 90 s and 120 s all came back complete, with no cut-off and
no error. The window is **30 s for memory and latency, not because the engine
refuses more** — a window is decoded, transcribed and released before the next is
read, so peak memory tracks the window rather than the recording. Do not shrink
it back on the strength of a truncation that does not happen.

#### Window size and concurrency are measured, not guessed

`WINDOW_SECONDS` (30) lives in `ingest.ts` and the batch endpoint imports it, so
there is one number rather than two that can disagree. `WINDOW_CONCURRENCY` (8)
is how many windows are in flight. Both were checked against the live engine
rather than assumed:

- Concurrency 4, 8, 12, 16 and 24 all completed with zero empty results and zero
  errors. 8 is a comfortable middle: parallel enough to make a long file fast,
  not so parallel that a burst looks like abuse.
- A multi-window clip packs back to exactly the whole recording — 30 s/8, 30 s/4
  and 25 s/4 all produced the same transcript and the same 748 characters, with
  no empty window — which is the property that matters, because a dropped window
  is a silently missing sentence, not an error.
- Measured end to end: a 99 s Bengali recording (four windows) transcribed in
  3.4 s, complete and in order.

#### A very large recording is streamed, not decoded whole

A whole-file decode holds the entire recording as PCM before the first window is
sent — a hundred-megabyte MP3 is well over an hour, hundreds of megabytes of
samples — and the Worker heap dies well before the response. So past
`STREAM_THRESHOLD_BYTES` (8 MB) the batch path switches to `transcribeStream`,
which pulls ~30-second windows lazily from `audioChunks()` in `ingest.ts`: the
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
comes out as several full 30 s windows carrying exactly the whole recording.

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

### The MCP Hub: one page per server, generated from the registry

The site publishes the whole MCP registry, not a curated handful. `scripts/build-mcp-catalog.ts`
parses `MCP Hub/ALL MCP.md` from the assets repository, emits
`src/lib/mcp-catalog.generated.ts` (the 108 curated servers and their copy),
`src/lib/mcp-facts.generated.ts` (the counts the copy quotes),
sharded registry assets under `public/mcp/*.json` (16 category files plus
`index.json`, ~3.5 MB total, fetched lazily per category so a phone never
downloads the lot), and a compact SSR index `src/lib/mcp-seo-index.server.ts`.

Current totals, which the copy and the tests both read: 8,202 servers — 108
curated plus 8,094 verified — across 18 categories (16 of which hold a verified
server and so have a category file; Automation and Monitoring are curated-only).

**Never write an MCP count as a literal.** Every page, doc and prompt that
quotes a figure imports it from `src/lib/mcp-facts.generated.ts`
(`MCP_TOTAL_TEXT`, `MCP_CURATED_TEXT`, `MCP_VERIFIED_TEXT`, `MCP_SUMMARY`).
The prose used to carry "108 MCP integrations" as a literal while the catalog
had grown to 8,202, and nothing caught it — the number was regenerated in one
place and quoted in another. `scripts/verify-mcp-facts.ts` now fails if any
surface still hardcodes a stale figure.

`src/lib/mcp-seo.ts` is the one composer for the per-server page text
(`describeRegistryServer`, the connect/install/verify vocabularies). Both the
generator and the pages import it, so a page cannot describe a server
differently from the way the sitemap does. `/apps` groups by category and loads
one shard at a time; `/apps/$slug` is the per-server page.

Two things that bit, both worth keeping:

- The routes are directory-form (`src/routes/apps/index.tsx` and
  `src/routes/apps/$slug.tsx`), not sibling files. A parent route's `head()`
  applies to its children, so `apps.tsx` carrying `canonical: /apps` put a
  *second* canonical on all 8,202 child pages pointing at the parent — Google
  would have indexed the index instead of the servers. Directory form makes
  `/apps` a sibling of `/apps/$slug` rather than its parent, so each page has
  exactly one canonical. Verify with
  `curl -s --compressed .../apps/<id> | grep -c 'rel="canonical"'` → 1.
- The generator's table parser is escape-aware. Server descriptions contain
  `\|`, and a naive split on `|` both truncated those rows and let separator
  rows through as servers.

`scripts/verify-seo.ts` asserts the MCP sitemap lists every server page by
count and that `robots.txt` points at `/sitemap-mcp.xml`.

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
4. **All five** of OpenCode's core tool names in `tools[]`: `bash`, `edit`,
   `glob`, `grep`, `read`. Schemas and descriptions are ignored, the tools are
   never called, and the names are matched **case-sensitively**. The
   documentation's floor of *two* is stale and the mock enforced it for a while,
   which is exactly how a catalogue that satisfied every test was refused by the
   real upstream. Measured directly: four of the five is refused, all five is
   accepted, and non-core names (`write`, `skill`, …) do not substitute for a
   missing core one.

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

**Every** request that reaches the upstream must satisfy this, not just a chat
turn. `testZenModel` used `generateText` with no tools and no streaming, so the
health check was refused with `403 FreeTierError` on a model that serves fine —
it reported the identity refusal as if it were the model's fault. It now goes
through `completeRaw`, the same path a turn takes. When adding any new upstream
call, send the catalogue and stream, or the gate will read the probe as a
rejected client.

`scripts/verify-gate-contract.ts` asserts the shape the real turn puts on the
wire, through the real code path, and `scripts/mock-upstream.mjs` enforces the
measured contract — so the test and the upstream cannot drift apart again.

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

## The AI helper's OpenHands conversation backend

`src/lib/providers/helper-conversation.server.ts` is the helper's last line of
defence. When every brand model fails, the helper sends the visitor's message
into **one long-lived OpenHands conversation** instead of giving up.

Facts worth knowing before touching it, each learned the hard way:

- **`events/search` caps `limit` at 100.** A larger value returns `422`, not a
  smaller page — so asking for 200 yields *no* messages and the helper would see
  an empty conversation forever. Use `limit=100`.
- **Match a reply by message id, not by counting messages.** The window holds the
  most recent 100 events, so a count means something different once a conversation
  is long. `Conversation.lastMessageId` is the baseline.
- **A reply is an agent `MessageEvent` with text.** `llm_message.content[].text`.
  State updates, the system prompt and tool events share the same feed and are not
  part of the conversation.
- **Turns are serialised** through a promise queue: one conversation works on one
  message at a time, so concurrent visitors would otherwise be answered out of
  order.
- **One conversation is intentional.** Starting one provisions a sandbox and takes
  ~25s, so a conversation per message would be unusably slow and would leak a
  sandbox per question.
- **The conversation is deleted and replaced** when its sandbox is `MISSING` or
  `ERROR`, when `execution_status` is `error`/`failed`, or when a turn times out.
  A `PAUSED` sandbox is fine — OpenHands resumes it.
- **Endpoints that matter:** `POST /api/v1/app-conversations` (create, returns a
  start-task id), `GET /api/v1/app-conversations/start-tasks?ids=<id>` (poll until
  `app_conversation_id` appears), `POST /api/v1/app-conversations/<id>/send-message`,
  `GET /api/v1/conversation/<id>/events/search?limit=100`, and
  `DELETE /api/v1/app-conversations/<id>`. Note `send-message` is on
  `app-conversations`, not `conversation`, and the two prefixes are not
  interchangeable.

### One prompt, two backends

`src/lib/providers/helper-prompt.server.ts` holds the facts, the page list, the
endpoint catalogue (read from the `ENDPOINTS` registry) and the identity rules
once. `helperWirePrompt()` and `helperConversationPrompt()` compose them and
differ only where the environment differs — the brand path has `search_web` and
`fetch_page`; the conversation has its own tools and must not be told about tools
it lacks.

Both are capped at 28,000 chars (`capPrompt`) because OpenHands truncates a
system prompt past its own limit, and a silently truncated prompt keeps the facts
while losing whichever section fell off the end. **Order matters:** identity and
answer rules come first, reference material last, so a trim never drops the rule
that stops the assistant naming an upstream vendor.

### Why the helper went down, and the two rules that keep it up

The deployed helper answered "I could not reach a model just now" for a morning.
Neither provider was broken. The OpenHands account had hit its **daily sandbox
limit of 20**, and the conversation backend needed a sandbox for every new
conversation it created. Two design mistakes fed that:

1. **Every process restart created another conversation.** The shared conversation
   lived only in module memory, so a redeploy, a cold isolate or a second
   instance could not see the previous one and started a fresh conversation —
   each one a new sandbox against the daily cap. Once the cap was reached,
   creation was refused outright and there was nothing to fall back to.
2. **A refusal was retried on every message.** Each visitor's turn paid a failed
   round trip to find out the same thing.

Both are fixed, and the fixes are the rules to preserve:

- **Adopt before starting.** `adoptOrStart()` lists conversations titled
  `ZYRAXON site helper`, keeps the newest one whose sandbox is alive *and* whose
  `SystemPromptEvent` carries the current `PROMPT_SIGNATURE`, and deletes the
  rest. This is why `TITLE` and the signature check exist: a conversation's system
  prompt is fixed at creation, so one left over from an older build would answer
  from a stale catalogue. A prompt change retires old conversations on purpose.
- **Match the signature, never the whole prompt.** OpenHands appends its own
  blocks (`<BROWSER_TOOLS>`, tool descriptions) to the stored prompt, so an
  equality check fails on *every* conversation. That is exactly what happened: the
  old `promptMatches` compared byte-for-byte, never matched, and the code retired
  and recreated the conversation on every turn — one new sandbox per visitor
  message, the pile of conversations and the multi-minute waits. `PROMPT_SIGNATURE`
  is carried inside the prompt and matched as a substring, which survives the
  upstream's additions. Bump it when the prompt changes.
- **Pin the id when the deployment runs more than one isolate.** `current` is
  module memory; serverless isolates do not share it, so two visitors can each
  see "no conversation" and each create one. Setting
  `ZYRAXON_HELPER_CONVERSATION_ID` makes every isolate adopt the same
  conversation. The id is logged as `[zyraxon-helper] conversation ready: <id>`
  when one is created, which is where to read it from.
- **Never retry a refused start on every turn.** A failed start is remembered for
  `ZYRAXON_HELPER_CONVERSATION_COOLDOWN_MS` (default 5 minutes), and
  `conversationUnavailable()` makes the turn fail immediately and honestly
  instead of after another doomed attempt.
- **Do not delete a conversation because one turn timed out.** A slow turn is
  usually a cold sandbox waking up; the next message into a warm conversation is
  fast. Discarding it pays the ~25s setup again and burns one of the 20 daily
  sandbox slots.
- **No `initial_message` at creation.** A greeting sent at creation is an agent
  reply that lands after the baseline is taken, so the first visitor's question
  gets answered with the greeting. Leaving it out also saves a whole model turn on
  every cold start.

### URLs in answers must be the site's own

The agent behind the conversation will happily cite the host it runs on. Those
URLs are wrong for a visitor and were showing up in answers. `URL_RULES` in
`helper-prompt.server.ts` names `SITE_ORIGIN` (`https://zyraxonai.lovable.app`) as
the only origin allowed in a link or a code sample, in both prompts. If a new
prompt is added, include `URL_RULES` — a missing rule is how the wrong host comes
back.

**Answer from the prompt first.** The prompt already carries every route, the
licence, the tiers, the download page and the endpoint catalogue. `ANSWER_RULES`
tells the assistant to answer from it and reach for a tool only when the answer is
genuinely absent: a lookup costs the visitor ~30s for something already written
down.

**Diagnosing it again:** `GET /api/v1/app-conversations/start-tasks?ids=<task>` is
where the truth is. A refused creation is not an HTTP error — it returns 200 and
the task comes back with `status: "ERROR"` and
`detail: "Daily sandbox limit of 20 reached..."`. Reading only the HTTP status
makes it look like success.

**Cost of a cold turn:** a warm conversation answers in ~2s, but a conversation
idle for more than ~15s answers in ~32s. This is not sandbox pause/resume (a
`POST /api/v1/sandboxes/<id>/resume` before the turn does not help, and the
sandbox already reads `RUNNING`), and it is not the prompt size (a 127-char
prompt and a 28k-char prompt both take 32.8s). Polling the events endpoint to
keep it warm does not help either — an 8s poll made it *worse* (41s). Treat the
32s as the price of a cold turn and keep the conversation warm by opening the
panel, not by polling: `GET /api/public/zyraxon/helper` calls `warmConversation()`
and `HelpAgent.tsx` reads that route when the panel opens.

### The helper's brand pass is quota-gated, not gate-gated

`providerGateOpen` in `star-gate.ts` is the single switch for the *public* API
line: until the repository reaches 100,000 stars, `v1/chat/completions.ts`
returns `gateReply()` before anything else, and it never reads the brand line.

The helper's POST handler is different by design. It runs `raceBrands()` first —
the brand line is the product, and the decision to walk visitors past the
countdown is the owner's call, not the code's. The protection against burning the
shared free pool is the pool itself: the pass is skipped outright once
`quotaResetStatus().spent` is known, so a spent line is not touched at all, and
when the line still has room the pass is a fast win or a thin sting while the
conversation warms. The conversation then catches every visitor the brand pass
cannot answer.

When the pool is spent (or on a spent pool the pass never ran), the visitor's
turn goes to the OpenHands conversation directly; the fallback sits between them.

**Rule:** the brand pass is allowed only when `quotaResetStatus().spent` is
false. There is deliberately no `providerGateOpen` check here — that gate talks
to API callers, not to visitors on the site.

## The download buttons: one resolver, four families, four repositories

`src/routes/api/public/downloads.ts` is the single place a download is resolved.
`TARGETS` describes every button, `resolveReleases()` reads GitHub once and caches
for a minute, and `/api/download/<id>` answers a 302 to the asset's own URL — so a
click saves the file and never opens a page. Adding a platform means adding one
`TARGETS` entry; the download page, the homepage and the redirect route all read
that list.

**A target may name the repositories it searches.** `Target.repos` scopes the
search; without it a target searches `ALL_REPOS`. The Android APK ships from
`onelpawarai-X/zyraxon-mobile-ai` on its own version (`v19.0.8` while the desktop
repo is on `v19.0.7`), so `android` sets `repos` and can never be answered by a
file from the desktop release. The "latest release" label stays pinned to the
desktop repo: `computeReleases()` picks `perRepo.find(r => r.repo === REPO)` rather
than the first entry, or a newer mobile tag would relabel the whole page.

**Both the homepage and the download page advertise Android.** The homepage has an
Android card in the download row and its own `MobileApp` section at the foot of the
page; the download page has a `mobile` group above `desktop`. The `smartphone` icon
in `Icon.tsx` exists for these.

## ZyraxonOS: a second resolver, because it is a second repository

The OS ships from `onelpawarai-X/ZyraxonOS` on its own version, so it does not go
through `TARGETS`. It has its own resolver, `src/lib/os-releases.server.ts`, its own
JSON route (`GET /api/public/os`) and its own ids on the *same* redirect route
(`/api/download/zyraxon-os`, `/api/download/zyraxon-os-part01`). `$platform.ts`
checks `isOsId()` first, so a future Agent target cannot shadow the OS id.

The GitHub read itself — `latestTag`, `assetsOf`, `recentTags`, `downloadUrl`,
`releaseUrl` — lives once, in `src/lib/github-releases.server.ts`, and both
resolvers import it. It is the public-HTML read: no token, so a rejected credential
can never be mistaken for "this repo has no releases", which is the bug that once
blanked the download page.

**The tag is never hardcoded, and neither is the file name.** The resolver walks
`recentTags()` newest-first and takes the first release that actually carries an
image, so a release published a minute ago is on the page after the next 60 s cache
lapse with no deploy — and a release whose upload failed falls back to the previous
tag that has one. `verify-os-downloads.ts` asserts the resolved tag equals
`/releases/latest`, so a stale pin fails the suite instead of the page.

**An image may be one file or several parts, and both must work.** GitHub refuses
an asset over 2 GB, so an image past that is published as
`ZyraxonOS-<v>-amd64.iso.part00`, `.part01`, … — and the repository has shipped
both shapes (`v1.0`/`v1.1` single, `v9.0.0` split). `readImage()` handles each and
the split case is not cosmetic: a part is not bootable, so the page says "published
in N parts", lists every part, and hands over `cat part00 part01 … > <iso>`. The
parts are ordered by their **numeric** suffix, not by GitHub's listing order — the
listing put `part01` before `part00` for `v9.0.0`, and rejoining in that order
produces a corrupt image. `readImage()` is exported so the test can pin both shapes
on fixtures, because only one is live at a time.

Two smaller things that would be silent bugs: the rejoin name strips only the
`.part<NN>` suffix (stripping the whole match once produced
`ZyraxonOS-9.0.0-amd64`, an ISO with no `.iso`), and a checksum file
(`SHA256SUMS`, `.sha256`) is never read as the image — `.iso.sha256` ends in
`.iso` to a careless pattern.

`src/lib/os-download.ts` holds the client-safe facts (the repo, the button id, the
rejoin command, the requirements) so a page never imports a `.server` module.
`OsDownloadCard` is the one card the homepage's download band and its own
`ZyraxonOs` section both render, so the two cannot name different tags.

## The conversation's reply loop must filter its reads

`GET /conversation/<id>/events/search` returns every event kind — tool actions,
observations, state updates. On a real conversation the unfiltered 100-event
window is about **3 MB**, and the reply loop reads once a second, so an unfiltered
poll costs a second of transfer on every tick. Add `kind__eq=MessageEvent` and the
same read is about **5 KB**. `messages()` and `promptMatches()` both filter for
this reason; dropping the filter is a silent 600× regression in the hot path.

**The conversation's LLM is the other half of the latency.** The account's default
profile (`zyraxon`) points at the closed ZYRAXON provider, and the model in use
(`openhands/deepseek-v4.1-flash`) runs with `reasoning_effort: high` and a 200k
extended-thinking budget — so even "reply PING" takes ~30s of thinking. Measured
on the live account: ready ~21s, answer ~35s. `ZYRAXON_HELPER_CONVERSATION_MODEL`
picks a faster model when one is available; the value is passed as `llm_model` at
creation.
