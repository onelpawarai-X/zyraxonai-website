#!/usr/bin/env bash
# zyraxon-ask — stream one ZYRAXON turn from any Linux shell.
#
# Works on Kali, Debian, Ubuntu, Arch, Alpine, macOS and inside the Kali
# NetHunter chroot on an Android phone. Needs only curl and jq.
#
# Install:
#   curl -fsSL https://zyraxonai.lovable.app/integrations/kali-ask.sh -o ~/.local/bin/zyraxon-ask
#   chmod +x ~/.local/bin/zyraxon-ask
#
# Configure (once), then put these in ~/.bashrc:
#   export ZYRAXON_BASE="https://zyraxonai.lovable.app/api/public/zyraxon/v1"
#   export ZYRAXON_MODEL="zyraxon-codex"
#   export ZYRAXON_KEY="zyraxon"
#
# Use:
#   zyraxon-ask "explain this nmap output"
#   nmap -sV 10.0.0.1 -oN - | zyraxon-ask "summarise for a report"
#   zyraxon-ask -m zyraxon-apex "long reasoning task"

set -euo pipefail

ZYRAXON_BASE="${ZYRAXON_BASE:-https://zyraxonai.lovable.app/api/public/zyraxon/v1}"
ZYRAXON_MODEL="${ZYRAXON_MODEL:-zyraxon-codex}"
ZYRAXON_KEY="${ZYRAXON_KEY:-zyraxon}"

MODEL="${ZYRAXON_MODEL}"
PROMPT=""

while [ $# -gt 0 ]; do
  case "$1" in
    -m|--model) MODEL="$2"; shift 2 ;;
    --models)
      curl -sS "${ZYRAXON_BASE}/models" | jq -r '.data[].id'
      exit 0 ;;
    -h|--help)
      sed -n '2,22p' "$0"
      exit 0 ;;
    *) PROMPT="$1"; shift ;;
  esac
done

# No argument means the prompt arrives on stdin, so this composes with a pipe.
[ -n "${PROMPT}" ] || PROMPT="$(cat)"

[ -n "${PROMPT}" ] || { printf 'usage: %s "your question"\n' "$0" >&2; exit 2; }

command -v jq >/dev/null 2>&1 || { printf 'error: jq is required (apt install jq)\n' >&2; exit 1; }

BODY="$(jq -nc --arg m "${MODEL}" --arg p "${PROMPT}" \
  '{model:$m, stream:true, messages:[{role:"user",content:$p}]}')"

# Capture first, so a pre-stream error (which arrives as JSON, not SSE) can be
# shown as the provider's own message instead of an empty answer. Retry the
# documented transient codes with a short backoff; never retry 400/401/413.
RAW=""
attempt=1
while :; do
  RAW="$(curl -sSN -w '\n%{http_code}' "${ZYRAXON_BASE}/chat/completions" \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer ${ZYRAXON_KEY}" \
    -d "${BODY}")"
  CODE="$(printf '%s' "${RAW}" | tail -n1)"
  RAW="$(printf '%s' "${RAW}" | sed '$d')"
  case "${CODE}" in
    429|502|503)
      if [ "${attempt}" -ge 3 ]; then break; fi
      printf 'busy (%s), retrying in %ss...\n' "${CODE}" "${attempt}" >&2
      sleep "${attempt}"
      attempt=$((attempt + 1)) ;;
    *) break ;;
  esac
done

MESSAGE=""
case "${RAW}" in
  \{*) MESSAGE="$(jq -r '.error.message // empty' <<<"${RAW}" 2>/dev/null)" ;;
esac
if [ -n "${MESSAGE}" ]; then
  printf 'error: %s\n' "${MESSAGE}" >&2
  TYPE="$(jq -r '.error.type // empty' <<<"${RAW}" 2>/dev/null)"
  [ -n "${TYPE}" ] && printf '       type: %s\n' "${TYPE}" >&2
  exit 1
fi

# Unwrap the SSE frames, drop the terminator, print the text deltas.
printf '%s\n' "${RAW}" \
| sed -n 's/^data: //p' \
| grep -v '^\[DONE\]$' \
| jq -rj '.choices[0].delta.content // empty'
echo
