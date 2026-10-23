# Free egress rotation with a Cloudflare Worker

The upstream free tier counts usage **per IP address**. A deployment that calls
it from one address runs out and then refuses *every* caller, however isolated
their sessions are. A Cloudflare Worker fixes that for free: the worker runs on
Cloudflare's whole network, so requests leave from a rotating set of addresses.

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
