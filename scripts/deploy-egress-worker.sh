#!/usr/bin/env bash
# Deploy the ZYRAXON egress gateway to Cloudflare, with no dashboard clicking.
#
# Needs two values from the Cloudflare account:
#   CLOUDFLARE_API_TOKEN   - a token with the "Edit Cloudflare Workers" template
#   CLOUDFLARE_ACCOUNT_ID  - the account id, shown on the Workers overview page
#
# Usage:
#   CLOUDFLARE_API_TOKEN=... CLOUDFLARE_ACCOUNT_ID=... ./scripts/deploy-egress-worker.sh [name]
#
# Prints the gateway URL to put in ZYRAXON_EGRESS_URLS when it finishes.

set -u

NAME="${1:-zyraxon-egress}"
TOKEN="${CLOUDFLARE_API_TOKEN:-}"
ACCOUNT="${CLOUDFLARE_ACCOUNT_ID:-}"
FILE="$(dirname "$0")/../workers/egress-proxy.js"
API="https://api.cloudflare.com/client/v4"

if [ -z "$TOKEN" ] || [ -z "$ACCOUNT" ]; then
  echo "Set CLOUDFLARE_API_TOKEN and CLOUDFLARE_ACCOUNT_ID first." >&2
  exit 1
fi
if [ ! -f "$FILE" ]; then
  echo "Worker source not found at $FILE" >&2
  exit 1
fi

# A worker cannot get a workers.dev address until the account has a subdomain,
# and the account only gets one when the Workers page is opened once. Asking for
# it here makes that failure legible instead of a bare API error.
SUBDOMAIN="$(curl -s "$API/accounts/$ACCOUNT/workers/subdomain" \
  -H "Authorization: Bearer $TOKEN" | python3 -c 'import json,sys; print(json.load(sys.stdin).get("result",{}).get("subdomain",""))' 2>/dev/null)"
if [ -z "$SUBDOMAIN" ]; then
  echo "No workers.dev subdomain on this account yet." >&2
  echo "Open the Cloudflare dashboard once at Workers & Pages; it creates one." >&2
  exit 1
fi

echo "Uploading $NAME ..."
RESULT="$(curl -s -X PUT "$API/accounts/$ACCOUNT/workers/scripts/$NAME" \
  -H "Authorization: Bearer $TOKEN" \
  -F "metadata={\"main_module\":\"egress-proxy.js\",\"compatibility_date\":\"2025-01-01\"};type=application/json" \
  -F "egress-proxy.js=@$FILE;type=application/javascript+module")"

if ! echo "$RESULT" | grep -qE '"success"\s*:\s*true'; then
  echo "Upload failed:" >&2
  echo "$RESULT" | head -c 600 >&2
  exit 1
fi

# Publish it at <name>.<subdomain>.workers.dev.
curl -s -X POST "$API/accounts/$ACCOUNT/workers/scripts/$NAME/subdomain" \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  --data '{"enabled":true}' >/dev/null

# Bind the shared secret the worker reads from its environment. Without it the
# worker accepts any caller who learns its URL, which turns it into an open
# relay that spends our upstream quota on strangers. The value is generated
# here when the caller does not supply one, so the two sides can never drift.
EGRESS_TOKEN="${EGRESS_TOKEN:-$(python3 -c 'import secrets; print(secrets.token_urlsafe(32))')}"
echo "Binding EGRESS_TOKEN ..."
SECRET="$(curl -s -X PUT "$API/accounts/$ACCOUNT/workers/scripts/$NAME/secrets" \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  --data "{\"name\":\"EGRESS_TOKEN\",\"text\":\"$EGRESS_TOKEN\",\"type\":\"secret_text\"}")"
if ! echo "$SECRET" | grep -qE '"success"\s*:\s*true'; then
  echo "Could not bind EGRESS_TOKEN; the worker is reachable but unprotected." >&2
  echo "$SECRET" | head -c 400 >&2
  exit 1
fi

GW="https://$NAME.$SUBDOMAIN.workers.dev/"
echo
echo "Checking the gateway is live ..."

# Propagation is not instant, so a first miss is not a failure. A worker that
# never answers, though, is useless — and silently reporting success for one is
# how a deployment behind Cloudflare Access was previously announced as ready
# while every request through it returned a 302 to a login page. So this
# retries, then fails.
health=""
for attempt in 1 2 3 4 5; do
  health="$(curl -s --max-time 20 "${GW}health" || true)"
  echo "$health" | grep -qE '"ok"\s*:\s*true' && break
  sleep 4
done
if ! echo "$health" | grep -qE '"ok"\s*:\s*true'; then
  echo "Gateway did not answer /health after five attempts:" >&2
  echo "  $health" >&2
  echo "A 302 to a login page means Cloudflare Access is guarding this hostname;" >&2
  echo "remove the Access policy for it, or the worker is unreachable to the app." >&2
  exit 1
fi
echo "Gateway answered its health check."

# Binding a secret and enforcing it are different things: the bind can succeed
# while the worker reads the wrong variable name, in which case it is an open
# relay. Prove the token is actually required before calling this done.
if [ -n "$EGRESS_TOKEN" ]; then
  echo "Checking the token is enforced ..."
  bare="$(curl -s -o /dev/null -w '%{http_code}' --max-time 20 -X POST "$GW" \
    -H "Content-Type: application/json" \
    -H "x-zyraxon-target: https://opencode.ai/inference/v1/models" || true)"
  if [ "$bare" != "403" ]; then
    echo "The worker answered $bare without a token; it should refuse with 403." >&2
    echo "It is reachable as an open relay — do not publish this URL." >&2
    exit 1
  fi
  echo "A request with no token is refused, as it should be."
fi

echo
echo "=============================================================="
echo " Put these two in the app's host secrets, then redeploy:"
echo "=============================================================="
echo
echo "  ZYRAXON_EGRESS_URLS = gw+$GW"
echo "  ZYRAXON_EGRESS_TOKEN = $EGRESS_TOKEN"
echo
echo "The token is also in this run's log. Rotate it by running this"
echo "script again; both sides must carry the same value."
echo
echo "For several accounts, join the URLs with commas on the URLs line"
echo "and use the same token on every worker."
