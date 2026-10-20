#!/data/data/com.termux/files/usr/bin/bash
# ZYRAXON provider — Termux setup.
#
# Installs the two tools this needs (curl, jq), stores the provider settings in
# ~/.zyraxon/env, and installs a `zyraxon` command that streams a reply or runs
# a small tool-calling agent loop on the device.
#
# Safe to re-run: it overwrites the config and the command, and installs nothing
# twice. Read it before you run it; that is the point of it being a file rather
# than a one-line pipe from a stranger.

set -euo pipefail

ZYRAXON_ORIGIN="${ZYRAXON_ORIGIN:-https://zyraxonai.lovable.app}"
ZYRAXON_BASE="${ZYRAXON_BASE:-${ZYRAXON_ORIGIN}/api/public/zyraxon/v1}"
ZYRAXON_MODEL="${ZYRAXON_MODEL:-zyraxon-codex}"
ZYRAXON_KEY="${ZYRAXON_KEY:-zyraxon}"

CONFIG_DIR="${HOME}/.zyraxon"
CONFIG_FILE="${CONFIG_DIR}/env"
BIN_DIR="${HOME}/.local/bin"
CMD_FILE="${BIN_DIR}/zyraxon"

say() { printf '%s\n' "$*"; }
die() { printf 'error: %s\n' "$*" >&2; exit 1; }

# ── 1. Dependencies ──────────────────────────────────────────────────────
if ! command -v pkg >/dev/null 2>&1; then
  die "this looks like it is not running inside Termux (no 'pkg' command)"
fi

say "-> installing curl and jq"
pkg install -y curl jq >/dev/null 2>&1 || die "pkg install failed; run 'pkg update' and retry"

# ── 2. Settings ──────────────────────────────────────────────────────────
mkdir -p "${CONFIG_DIR}" "${BIN_DIR}"

cat > "${CONFIG_FILE}" <<EOF
# ZYRAXON provider settings. Sourced by the zyraxon command.
ZYRAXON_BASE="${ZYRAXON_BASE}"
ZYRAXON_MODEL="${ZYRAXON_MODEL}"
ZYRAXON_KEY="${ZYRAXON_KEY}"
EOF
chmod 600 "${CONFIG_FILE}"
say "-> wrote ${CONFIG_FILE}"

# ── 3. The command ───────────────────────────────────────────────────────
# Written as its own file so it can be read, edited and re-run by hand. The
# agent loop is a small, explicit set of tools — it is not a general shell
# escape hatch, and it asks before it writes or runs anything.
cat > "${CMD_FILE}" <<'ZYRAXON_CMD'
#!/data/data/com.termux/files/usr/bin/bash
# zyraxon — talk to the ZYRAXON provider from Termux.
#
#   zyraxon "explain this repo"           stream an answer
#   zyraxon -a "make hello.py and run it" run the tool-calling agent loop
#   echo "what is 2+2?" | zyraxon         read the prompt from stdin
#   zyraxon -m zyraxon-apex "..."         pick another model
#   zyraxon --models                      list the ZYRAXON models
set -euo pipefail

CONFIG_FILE="${HOME}/.zyraxon/env"
[ -f "${CONFIG_FILE}" ] || { echo "run the ZYRAXON setup script first" >&2; exit 1; }
# shellcheck disable=SC1090
. "${CONFIG_FILE}"

AGENT=0
MODEL="${ZYRAXON_MODEL}"
PROMPT=""

while [ $# -gt 0 ]; do
  case "$1" in
    -a|--agent)  AGENT=1; shift ;;
    -m|--model)  MODEL="$2"; shift 2 ;;
    --models)    curl -s "${ZYRAXON_BASE}/models" | jq -r '.data[] | "\(.id)\t\(.description // "")"'; exit 0 ;;
    -h|--help)   sed -n '2,12p' "$0"; exit 0 ;;
    *)           PROMPT="$1"; shift ;;
  esac
done

[ -n "${PROMPT}" ] || PROMPT="$(cat)"

api() {
  # Retry the codes the provider documents as transient (429, 502, 503) with a
  # short backoff, so a phone client survives a busy moment instead of failing a
  # turn. 400/401/413 are never retried — they need the request fixed.
  local body="$1" attempt=1 resp code
  while :; do
    resp="$(curl -sS -w '\n%{http_code}' "${ZYRAXON_BASE}/chat/completions" \
      -H "Content-Type: application/json" \
      -H "Authorization: Bearer ${ZYRAXON_KEY}" \
      -d "${body}")"
    code="$(printf '%s' "${resp}" | tail -n1)"
    resp="$(printf '%s' "${resp}" | sed '$d')"
    case "${code}" in
      429|502|503)
        if [ "${attempt}" -ge 3 ]; then printf '%s' "${resp}"; return 0; fi
        printf 'busy (%s), retrying in %ss...\n' "${code}" "${attempt}" >&2
        sleep "${attempt}"
        attempt=$((attempt + 1)) ;;
      *) printf '%s' "${resp}"; return 0 ;;
    esac
  done
}

# Print the provider's own error, if the response is an error object, and return
# 0 when it handled it. Without this an error body reads as an empty answer,
# which hides the one piece of information that says what to fix.
report_error() {
  local resp="$1"
  local message=""
  # Only a JSON object can carry an error. SSE frames start with "data: ", and
  # handing those to jq would make it exit non-zero and trip `set -e`.
  case "${resp}" in
    \{*) message="$(jq -r '.error.message // empty' <<<"${resp}" 2>/dev/null || true)" ;;
  esac
  [ -n "${message}" ] || return 1
  printf 'error: %s\n' "${message}" >&2
  local type; type="$(jq -r '.error.type // empty' <<<"${resp}" 2>/dev/null || true)"
  [ -n "${type}" ] && printf '       type: %s\n' "${type}" >&2
  return 0
}

if [ "${AGENT}" -eq 0 ]; then
  BODY="$(jq -nc --arg m "${MODEL}" --arg p "${PROMPT}" \
    '{model:$m, stream:true, messages:[{role:"user",content:$p}]}')"
  # A streaming turn can still fail before any delta, and the error arrives as a
  # JSON object rather than SSE. Capture the raw stream, print the deltas, and if
  # nothing came through, show the provider's error instead of an empty line.
  RAW="$(curl -sS "${ZYRAXON_BASE}/chat/completions" \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer ${ZYRAXON_KEY}" \
    -d "${BODY}")"
  if report_error "${RAW}"; then
    exit 1
  fi
  printf '%s\n' "${RAW}" \
    | sed -n 's/^data: //p' \
    | grep -v '^\[DONE\]$' \
    | jq -rj '.choices[0].delta.content // empty'
  echo
  exit 0
fi

# ── agent loop ──────────────────────────────────────────────────────────
# Three tools, all confined to the current directory tree. write_file and
# run_shell ask before they act.

# Reserve a dedicated descriptor for the user's answers before any loop
# redirects stdin. Without this the loop's own `read` (which consumes the tool
# calls) would be what the prompt reads from, so every confirmation would be
# answered by a stray tool-call line instead of by the person running it.
if { true < /dev/tty; } 2>/dev/null; then
  exec 3< /dev/tty
else
  exec 3<&0
fi

confirm() {
  printf '%s [y/N] ' "$1" >&2
  local answer=""
  read -r answer <&3 || answer=""
  case "${answer}" in y|Y|yes) return 0 ;; *) return 1 ;; esac
}

TOOLS='[
  {"type":"function","function":{"name":"read_file","description":"Read a text file from the current directory.","parameters":{"type":"object","properties":{"path":{"type":"string"}},"required":["path"]}}},
  {"type":"function","function":{"name":"write_file","description":"Write text to a file in the current directory.","parameters":{"type":"object","properties":{"path":{"type":"string"},"content":{"type":"string"}},"required":["path","content"]}}},
  {"type":"function","function":{"name":"run_shell","description":"Run a shell command in the current directory and return its output.","parameters":{"type":"object","properties":{"command":{"type":"string"}},"required":["command"]}}}
]'

run_tool() {
  local name="$1" args="$2"
  case "${name}" in
    read_file)
      local path; path="$(jq -r '.path' <<<"${args}")"
      if [ -f "${path}" ]; then head -c 20000 "${path}"; else echo "no such file: ${path}"; fi ;;
    write_file)
      local path content
      path="$(jq -r '.path' <<<"${args}")"
      content="$(jq -r '.content' <<<"${args}")"
      if confirm "write ${path} (${#content} bytes)?"; then
        printf '%s' "${content}" > "${path}"; echo "wrote ${path}"
      else
        echo "declined by the user"
      fi ;;
    run_shell)
      local command; command="$(jq -r '.command' <<<"${args}")"
      if confirm "run: ${command} ?"; then
        bash -c "${command}" 2>&1 | head -c 20000
      else
        echo "declined by the user"
      fi ;;
    *) echo "unknown tool: ${name}" ;;
  esac
}

MESSAGES="$(jq -nc --arg p "${PROMPT}" '[{role:"user",content:$p}]')"

# The last tool call we ran, as `name + arguments`. A model that repeats the same
# call after seeing its result is stuck, not working; running it again only
# burns turns and re-asks the user. One repeat is tolerated, the second stops.
LAST_CALL=""
REPEATS=0

for _ in $(seq 1 8); do
  BODY="$(jq -nc --arg m "${MODEL}" --argjson msgs "${MESSAGES}" --argjson tools "${TOOLS}" \
    '{model:$m, stream:false, messages:$msgs, tools:$tools}')"
  RESP="$(api "${BODY}")"
  if report_error "${RESP}"; then
    exit 1
  fi

  CHOICE="$(jq -c '.choices[0]' <<<"${RESP}")"
  MESSAGES="$(jq -nc --argjson msgs "${MESSAGES}" --argjson msg "$(jq -c '.message' <<<"${CHOICE}")" '$msgs + [$msg]')"

  REASON="$(jq -r '.finish_reason' <<<"${CHOICE}")"
  if [ "${REASON}" != "tool_calls" ]; then
    CONTENT="$(jq -r '.message.content // empty' <<<"${CHOICE}")"
    if [ -n "${CONTENT}" ]; then
      printf '%s\n' "${CONTENT}"
    else
      printf 'the model stopped without an answer (finish_reason: %s)\n' "${REASON}" >&2
    fi
    break
  fi

  # A process substitution, not a pipe: a pipe would run this loop in a
  # subshell and every MESSAGES update would be discarded, so the model would
  # be handed the same history on the next turn and call the same tool again.
  while read -r call; do
    NAME="$(jq -r '.function.name' <<<"${call}")"
    ARGS="$(jq -r '.function.arguments' <<<"${call}")"

    CALL_SIG="${NAME}|${ARGS}"
    if [ "${CALL_SIG}" = "${LAST_CALL}" ]; then
      REPEATS=$((REPEATS + 1))
    else
      REPEATS=0
    fi
    LAST_CALL="${CALL_SIG}"
    if [ "${REPEATS}" -ge 2 ]; then
      printf 'stopping: the model asked for the same %s call three times.\n' "${NAME}" >&2
      printf 'the tool ran, so the result is in the history; the model is not using it.\n' >&2
      exit 1
    fi

    printf '%s\n' "-> ${NAME}" >&2
    RESULT="$(run_tool "${NAME}" "${ARGS}")"
    MESSAGES="$(jq -nc --argjson msgs "${MESSAGES}" \
      --arg id "$(jq -r '.id' <<<"${call}")" --arg out "${RESULT}" \
      '$msgs + [{role:"tool",tool_call_id:$id,content:$out}]')"
  done < <(jq -c '.message.tool_calls[]' <<<"${CHOICE}")
done
ZYRAXON_CMD

chmod +x "${CMD_FILE}"
say "-> installed ${CMD_FILE}"

# ── 4. PATH ──────────────────────────────────────────────────────────────
# shellcheck disable=SC2016
if ! grep -q 'HOME/.local/bin' "${HOME}/.bashrc" 2>/dev/null; then
  printf '\n# ZYRAXON\nexport PATH="${HOME}/.local/bin:$PATH"\n' >> "${HOME}/.bashrc"
  say "-> added ~/.local/bin to PATH in ~/.bashrc"
fi
export PATH="${HOME}/.local/bin:${PATH}"

# ── 5. Prove it works ────────────────────────────────────────────────────
say ""
say "-> checking the model list"
if MODELS="$(curl -sS --max-time 20 "${ZYRAXON_BASE}/models" | jq -r '.data[].id' 2>/dev/null)"; then
  printf '%s\n' "${MODELS}" | sed 's/^/    /'
else
  say "    could not read the model list — check your network and ${ZYRAXON_BASE}"
fi

say ""
say "Done. Try:"
say "    zyraxon \"hello from my phone\""
say "    zyraxon -a \"create hello.py that prints hi, then run it\""
say ""
say "Open a new terminal first, or run: source ~/.bashrc"
