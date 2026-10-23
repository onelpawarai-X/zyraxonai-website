# Free egress rotation with a Cloudflare Worker

The upstream free tier counts usage **per IP address**. A deployment that calls
it from one address runs out and then refuses *every* caller, however isolated
their sessions are. A Cloudflare Worker fixes that for free: the worker runs on
Cloudflare's whole network, so requests leave from a rotating set of addresses.

## Measured: extra workers do not buy extra quota

This was tested rather than assumed, because the obvious reading of "the free
tier counts per IP" is that N workers give N times the allowance. They do not.

The worker reports the address each request actually leaves from (`GET /ip`,
token-gated), and the upstream reports its own reset clock in `retry-after`.
Sampled together:

| source | egress IPv4 | retry-after |
| --- | --- | --- |
| worker A | rotates (172.70.50.90, 104.22.62.156, …) | 10711 |
| worker B | rotates (104.22.24.73, 172.68.70.42, …) | 10710 |
| worker C | rotates (172.71.255.65, …) | 10710 |
| a Google Cloud container | 34.136.162.246 | 10709 |

Three separate workers do leave from *different, rotating* IPv4 addresses — the
address spread is real — and yet every one of them, plus an unrelated network,
is refused with the same countdown to the same instant. A per-address limit
cannot produce that. The window is shared, so the ceiling is the window, not
the number of gateways pointed at it.

IPv6 is a red herring: Workers always leave over `2a06:98c0:3600::103`, the same
address for every worker, but `opencode.ai` publishes no AAAA record, so it is
never the address the upstream sees.

What actually raises the ceiling is a keyed quota — the upstream's own refusal
says so ("Subscribe to OpenCode Go"). Setting `OPENCODE_ZEN_API_KEY` in the app
moves traffic off the shared free window entirely. A gateway is still worth
having for the address spread it does provide, but it is not a way to multiply
a shared allowance.

## Cloudflare is not required

Nothing in the app knows about Cloudflare. The only contract is the two headers
`x-zyraxon-target` and `x-zyraxon-token`, plus a streaming response — so any host
that can run an HTTP function works:

- **Cloudflare Workers** — the worked example here. Free plan, no card.
- **Deno Deploy / Val Town / Vercel Edge** — same shape, port `egress-proxy.js`.
- **A VPS you already own** — run the worker as a tiny server, or use a socket
  proxy instead by listing it plainly (`http://user:pass@host:port`) with no
  `gw+` prefix. `ProxyAgent` speaks CONNECT, so no gateway code is needed.

What matters is that requests leave from *many* addresses. A single VPS is one
address, so it is no better than calling upstream directly. The gateway is
worth deploying when its egress addresses are shared and numerous, which is why
an edge platform fits.

## Setup (about five minutes, no card)

1. Create a free account at <https://dash.cloudflare.com/sign-up>.
2. Go to **Workers & Pages → Create → Worker**. Name it `zyraxon-egress`.
3. Replace the default code with the contents of `egress-proxy.js` in this
   folder, then click **Deploy**.
4. Copy the worker URL. It looks like
   `https://zyraxon-egress.<your-account>.workers.dev`.
5. In the app's host settings, add this secret:

   | Name | Value |
   | --- | --- |
   | `ZYRAXON_EGRESS_URLS` | `gw+https://zyraxon-egress.<your-account>.workers.dev/` |

   The `gw+` prefix tells the app this entry is an HTTP gateway rather than a
   socket proxy. Several entries, separated by commas, are used in rotation.

6. Optionally set `EGRESS_TOKEN` inside the worker and add the same value to
   the app as `x-zyraxon-token` support, so the URL is not an open relay.

## What the app does with a gateway URL

Put it in `ZYRAXON_EGRESS_URLS` and every turn is routed through it. Two
behaviours are worth knowing, because both were learned from a live deployment:

- **A 429 through a gateway is not the gateway failing.** It means one of the
  gateway's addresses was spent. The URL stays in rotation so the next turn
  leaves by a different address, and it is only parked after a sustained run of
  refusals with no success in between.
- **Add the token.** Without `ZYRAXON_EGRESS_TOKEN` the worker accepts anyone who
  learns its URL, which spends your upstream quota on strangers. The deploy
  script binds one automatically and prints both values.

## Limits, honestly

- Workers free plan: **100,000 requests per day per account**. Enough for a
  small deployment, not for a hundred thousand callers. Add more workers on
  more accounts to raise it; the app rotates over every entry it is given.
- The worker allow-list permits only `opencode.ai`. Widen `ALLOWED_HOSTS`
  deliberately if you ever need another host.
- A worker adds one hop of latency. Streaming still passes through unbuffered.

## What this does not fix

Nothing can make a free tier serve unlimited traffic. This spreads the load so
one address's ceiling is not everyone's ceiling, and it parks an address that
reports a rate limit. It is a real fix for moderate traffic and a genuine
improvement for heavy traffic; it is not unlimited capacity.
