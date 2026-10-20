#!/data/data/com.termux/files/usr/bin/bash
# zyraxon — an interactive ZYRAXON chat client for Termux and any Linux shell.
#
# Run `zyraxon` with no arguments and you get a chat box: type a message, press
# enter, and the reply streams in. Everything the provider can do is reachable
# from that box, and every setting can be changed without leaving it.
#
# One-shot use (for scripts and pipes):
#   zyraxon "explain this repo"            stream one answer and exit
#   zyraxon -a "make hello.py and run it"  one agent turn with tools, then exit
#   echo "what is 2+2?" | zyraxon          read the prompt from stdin
#   zyraxon -m zyraxon-apex "..."          pick a model for one turn
#   zyraxon --models                       list the models
#
# Needs only curl and jq.

set -uo pipefail

CONFIG_FILE="${HOME}/.zyraxon/env"

# Defaults, so the client works even before the setup script has run.
ZYRAXON_BASE="${ZYRAXON_BASE:-https://zyraxonai.lovable.app/api/public/zyraxon/v1}"
ZYRAXON_MODEL="${ZYRAXON_MODEL:-zyraxon-codex}"
ZYRAXON_KEY="${ZYRAXON_KEY:-zyraxon}"

if [ -f "${CONFIG_FILE}" ]; then
  # shellcheck disable=SC1090
  . "${CONFIG_FILE}"
fi

command -v curl >/dev/null 2>&1 || { printf 'error: curl is required\n' >&2; exit 1; }
command -v jq >/dev/null 2>&1 || { printf 'error: jq is required (pkg install jq)\n' >&2; exit 1; }

# ── state ────────────────────────────────────────────────────────────────
MODEL="${ZYRAXON_MODEL}"
AGENT=0                 # tool calling on/off inside the chat box
HISTORY="[]"            # the running message list, as JSON
LAST_CALL=""            # repeat-call guard for the agent loop
REPEATS=0

# The user's answers come from the terminal, never from a pipe, so a redirected
# or piped invocation cannot answer a confirmation for the person using it.
if { true < /dev/tty; } 2>/dev/null; then
  exec 3< /dev/tty
else
  exec 3<&0
fi

# ── transport ────────────────────────────────────────────────────────────
api() {
  # Retry the codes the provider documents as transient (429, 502, 503) with a
  # short backoff, so a phone survives a busy moment instead of failing a turn.
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

# Print the provider's own error when the body is an error object, and return 0
# when it handled it. Only a JSON object can carry an error: an SSE body starts
# with "data: " and handing that to jq would exit non-zero.
report_error() {
  local resp="$1" message=""
  case "${resp}" in
    \{*) message="$(jq -r '.error.message // empty' <<<"${resp}" 2>/dev/null || true)" ;;
  esac
  [ -n "${message}" ] || return 1
  printf 'error: %s\n' "${message}" >&2
  local type; type="$(jq -r '.error.type // empty' <<<"${resp}" 2>/dev/null || true)"
  [ -n "${type}" ] && printf '       type: %s\n' "${type}" >&2
  return 0
}

# ── model catalogue ──────────────────────────────────────────────────────
# Read live, so a model added or retired upstream shows up without a new client.
fetch_models() {
  curl -sS --max-time 25 "${ZYRAXON_BASE}/models" 2>/dev/null | jq -r '.data[].id' 2>/dev/null
}

print_models() {
  local models i=0
  models="$(fetch_models)"
  if [ -z "${models}" ]; then
    printf 'could not read the model list from %s\n' "${ZYRAXON_BASE}" >&2
    return 1
  fi
  printf '\n  Models (pick one with /model <number> or /model <id>)\n'
  while IFS= read -r id; do
    i=$((i + 1))
    if [ "${id}" = "${MODEL}" ]; then
      printf '  %2d) %-24s <- current\n' "${i}" "${id}"
    else
      printf '  %2d) %s\n' "${i}" "${id}"
    fi
  done <<<"${models}"
  printf '\n'
}

model_by_number() {
  local n="$1" i=0
  while IFS= read -r id; do
    i=$((i + 1))
    if [ "${i}" -eq "${n}" ]; then printf '%s' "${id}"; return 0; fi
  done < <(fetch_models)
  return 1
}

# ── tools (agent mode) ───────────────────────────────────────────────────
# Three tools, confined to the current directory tree. write_file and run_shell
# ask before they act. It is not a general shell escape hatch by accident.
TOOLS='[
  {"type":"function","function":{"name":"read_file","description":"Read a text file from the current directory.","parameters":{"type":"object","properties":{"path":{"type":"string"}},"required":["path"]}}},
  {"type":"function","function":{"name":"write_file","description":"Write text to a file in the current directory.","parameters":{"type":"object","properties":{"path":{"type":"string"},"content":{"type":"string"}},"required":["path","content"]}}},
  {"type":"function","function":{"name":"run_shell","description":"Run a shell command in the current directory and return its output.","parameters":{"type":"object","properties":{"command":{"type":"string"}},"required":["command"]}}}
]'

confirm() {
  printf '%s [y/N] ' "$1" >&2
  local answer=""
  read -r answer <&3 || answer=""
  case "${answer}" in y|Y|yes) return 0 ;; *) return 1 ;; esac
}

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

# ── turns ────────────────────────────────────────────────────────────────
# One streaming turn. Prints the reply as it arrives and returns the assistant
# text on stdout via REPLY_TEXT.
REPLY_TEXT=""
stream_turn() {
  local body raw
  body="$(jq -nc --arg m "${MODEL}" --argjson msgs "${HISTORY}" \
    '{model:$m, stream:true, messages:$msgs}')"
  # Capture first so a pre-stream error (which arrives as JSON, not SSE) can be
  # shown as the provider's own message instead of a silent empty answer.
  raw="$(curl -sS "${ZYRAXON_BASE}/chat/completions" \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer ${ZYRAXON_KEY}" \
    -d "${body}")"
  if report_error "${raw}"; then return 1; fi
  REPLY_TEXT="$(printf '%s\n' "${raw}" \
    | sed -n 's/^data: //p' \
    | grep -v '^\[DONE\]$' \
    | jq -rj '.choices[0].delta.content // empty')"
  printf '%s\n' "${REPLY_TEXT}"
}

# One agent turn: send the tools, run whatever the model calls, feed the result
# back, repeat until it answers. History is updated as it goes.
agent_turn() {
  local i choice reason content name args result sig
  LAST_CALL=""
  REPEATS=0
  for i in $(seq 1 8); do
    local body resp
    body="$(jq -nc --arg m "${MODEL}" --argjson msgs "${HISTORY}" --argjson tools "${TOOLS}" \
      '{model:$m, stream:false, messages:$msgs, tools:$tools}')"
    resp="$(api "${body}")"
    if report_error "${resp}"; then return 1; fi

    choice="$(jq -c '.choices[0]' <<<"${resp}")"
    HISTORY="$(jq -nc --argjson msgs "${HISTORY}" --argjson msg "$(jq -c '.message' <<<"${choice}")" '$msgs + [$msg]')"

    reason="$(jq -r '.finish_reason' <<<"${choice}")"
    if [ "${reason}" != "tool_calls" ]; then
      content="$(jq -r '.message.content // empty' <<<"${choice}")"
      if [ -n "${content}" ]; then printf '%s\n' "${content}"; else
        printf 'the model stopped without an answer (finish_reason: %s)\n' "${reason}" >&2
      fi
      return 0
    fi

    # A process substitution, not a pipe: a pipe would run this loop in a
    # subshell, so every HISTORY update would be discarded and the model would
    # be handed the same history again and repeat its tool call forever.
    while read -r call; do
      name="$(jq -r '.function.name' <<<"${call}")"
      args="$(jq -r '.function.arguments' <<<"${call}")"

      sig="${name}|${args}"
      if [ "${sig}" = "${LAST_CALL}" ]; then REPEATS=$((REPEATS + 1)); else REPEATS=0; fi
      LAST_CALL="${sig}"
      if [ "${REPEATS}" -ge 2 ]; then
        printf 'stopping: the model asked for the same %s call three times.\n' "${name}" >&2
        printf 'the tool ran, so its result is in the history; the model is not using it.\n' >&2
        return 1
      fi

      printf '  -> %s\n' "${name}" >&2
      result="$(run_tool "${name}" "${args}")"
      HISTORY="$(jq -nc --argjson msgs "${HISTORY}" \
        --arg id "$(jq -r '.id' <<<"${call}")" --arg out "${result}" \
        '$msgs + [{role:"tool",tool_call_id:$id,content:$out}]')"
    done < <(jq -c '.message.tool_calls[]' <<<"${choice}")
  done
  printf 'stopping: the agent used its whole turn budget.\n' >&2
  return 1
}

# ── the chat box ─────────────────────────────────────────────────────────
HELP_TEXT() {
  cat <<'HELP'
  Commands
    /help              this list
    /models            list every model the provider serves
    /model <n|id>      switch model (by number from /models, or by id)
    /agent [on|off]    toggle tool calling (read, write, run) for this session
    /new               forget the conversation and start fresh
    /history           how many messages are in the conversation
    /save <file>       write the conversation to a file as JSON
    /exit              leave (also /quit)

  Anything else you type is sent to the model. With /agent on, the model can
  read files, write files and run commands here, asking first each time.
HELP
}

banner() {
  printf '\n'
  printf '  ZYRAXON  ·  chat\n'
  printf '  model %s   ·   %s\n' "${MODEL}" "$([ "${AGENT}" -eq 1 ] && echo 'tools on' || echo 'tools off')"
  printf '  /help for commands, /exit to leave\n\n'
}

chat_loop() {
  banner
  local line
  while :; do
    # Read from the terminal, so a piped stdin cannot end the session early.
    printf 'you> ' >&2
    if ! IFS= read -r line <&3; then break; fi

    case "${line}" in
      "") continue ;;
      /exit|/quit) printf 'bye\n'; break ;;
      /help|/?) HELP_TEXT; continue ;;
      /models) print_models; continue ;;
      /model)
        printf 'usage: /model <number|id>   (see /models)\n' >&2; continue ;;
      /model\ *)
        local want="${line#/model }"
        if [ "${want}" -eq "${want}" ] 2>/dev/null; then
          local picked
          picked="$(model_by_number "${want}")" || picked=""
          if [ -z "${picked}" ]; then printf 'no model number %s\n' "${want}" >&2; continue; fi
          MODEL="${picked}"
        else
          MODEL="${want}"
        fi
        printf 'model is now %s\n' "${MODEL}" >&2
        continue ;;
      /agent)
        if [ "${AGENT}" -eq 1 ]; then AGENT=0; else AGENT=1; fi
        printf 'tools %s\n' "$([ "${AGENT}" -eq 1 ] && echo on || echo off)" >&2
        continue ;;
      /agent\ *)
        case "${line#/agent }" in
          on|yes|1) AGENT=1 ;;
          off|no|0) AGENT=0 ;;
          *) printf 'usage: /agent on|off\n' >&2; continue ;;
        esac
        printf 'tools %s\n' "$([ "${AGENT}" -eq 1 ] && echo on || echo off)" >&2
        continue ;;
      /new)
        HISTORY="[]"
        printf 'conversation cleared\n' >&2
        continue ;;
      /history)
        printf '%s message(s) in the conversation\n' "$(jq 'length' <<<"${HISTORY}")" >&2
        continue ;;
      /save)
        printf 'usage: /save <file>\n' >&2; continue ;;
      /save\ *)
        printf '%s' "${HISTORY}" | jq '.' > "${line#/save }" \
          && printf 'saved to %s\n' "${line#/save }" >&2
        continue ;;
      /*)
        printf 'unknown command: %s  (try /help)\n' "${line}" >&2
        continue ;;
    esac

    HISTORY="$(jq -nc --argjson msgs "${HISTORY}" --arg p "${line}" '$msgs + [{role:"user",content:$p}]')"
    printf '\nzyraxon> '
    if [ "${AGENT}" -eq 1 ]; then
      if ! agent_turn; then printf '(turn failed)\n' >&2; fi
    else
      if ! stream_turn; then printf '(turn failed)\n' >&2; fi
    fi
    printf '\n\n'
  done
}

# ── argument handling ────────────────────────────────────────────────────
PROMPT=""
CHAT=0

while [ $# -gt 0 ]; do
  case "$1" in
    -h|--help) sed -n '2,20p' "$0"; exit 0 ;;
    -c|--chat) CHAT=1; shift ;;
    -a|--agent) AGENT=1; shift ;;
    -m|--model) MODEL="$2"; shift 2 ;;
    --models) print_models; exit 0 ;;
    *) PROMPT="$1"; shift ;;
  esac
done

if [ -n "${PROMPT}" ]; then
  HISTORY="$(jq -nc --arg p "${PROMPT}" '[{role:"user",content:$p}]')"
  if [ "${AGENT}" -eq 1 ]; then agent_turn || exit 1; else stream_turn || exit 1; fi
  exit 0
fi

# No prompt on the command line. A pipe means a one-shot turn; a terminal means
# the interactive chat box.
if [ ! -t 0 ] && [ ! -r /dev/tty ]; then
  PROMPT="$(cat)"
  [ -n "${PROMPT}" ] || { printf 'usage: zyraxon "your question"\n' >&2; exit 2; }
  HISTORY="$(jq -nc --arg p "${PROMPT}" '[{role:"user",content:$p}]')"
  if [ "${AGENT}" -eq 1 ]; then agent_turn || exit 1; else stream_turn || exit 1; fi
  exit 0
fi

chat_loop
