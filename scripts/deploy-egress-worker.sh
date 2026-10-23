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

if ! echo "$RESULT" | grep -q '"success":true'; then
  echo "Upload failed:" >&2
  echo "$RESULT" | head -c 600 >&2
  exit 1
fi

# Publish it at <name>.<subdomain>.workers.dev.
curl -s -X POST "$API/accounts/$ACCOUNT/workers/scripts/$NAME/subdomain" \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  --data '{"enabled":true}' >/dev/null

echo
echo "Done. Put this in the app's secrets:"
echo
echo "  ZYRAXON_EGRESS_URLS = gw+https://$NAME.$SUBDOMAIN.workers.dev/"
echo
echo "For several accounts, join the URLs with commas on that one line."
