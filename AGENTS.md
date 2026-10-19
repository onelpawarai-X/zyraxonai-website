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

### Two gotchas that caused real bugs

- Do not pass `muted` to `<video>` as a JSX prop. React re-applies it on every
  render, so the audio dies as soon as any state changes. Set `video.muted`
  imperatively via a ref, and call `play()` inside the click handler that
  unmutes so the gesture unlocks sound.
- The site header is `sticky z-50`. Any full-screen overlay must render above
  it (`z-[100]`) and be portalled to `document.body`, otherwise the header
  covers the overlay's top controls and eats the clicks. Portal in an effect
  (`if (!mounted) return null`) because there is no `document` during SSR.

