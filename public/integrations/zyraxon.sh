#!/usr/bin/env bash
# zyraxon.sh — use the ZYRAXON provider from any shell, by sourcing it.
#
#   . ./zyraxon.sh
#   zyraxon_models                       # list the models
#   zyraxon_ask "what is a race condition"
#   zyraxon_stream "write a haiku"       # stream to stdout
#   zyraxon_ask -m zyraxon-apex "..."    # pick a model
#   zyraxon_agent "create hello.py and run it"
#
# Works in bash and zsh; needs only curl and jq. Source it, do not run it.

ZYRAXON_BASE_URL="${ZYRAXON_BASE_URL:-https://zyraxonai.lovable.app/api/public/zyraxon/v1}"
ZYRAXON_MODEL="${ZYRAXON_MODEL:-zyraxon-codex}"
ZYRAXON_API_KEY="${ZYRAXON_API_KEY:-zyraxon}"

_zyraxon_api() {
  # Retry the codes the provider documents as transient (429, 502, 503); never
  # retry 400/401/413, which need the request fixed.
  local body="$1" attempt=1 resp code
  while :; do
    resp="$(curl -sS -w '\n%{http_code}' "$ZYRAXON_BASE_URL/chat/completions" \
      -H "Content-Type: application/json" \
      -H "Authorization: Bearer $ZYRAXON_API_KEY" \
      -H "User-Agent: zyraxon-shell/1.0" \
      -d "$body")"
    code="$(printf '%s' "$resp" | tail -n1)"
    resp="$(printf '%s' "$resp" | sed '$d')"
    case "$code" in
      429|502|503)
        if [ "$attempt" -ge 3 ]; then printf '%s' "$resp"; return 0; fi
        printf 'busy (%s), retrying in %ss...\n' "$code" "$attempt" >&2
        sleep "$attempt"
        attempt=$((attempt + 1)) ;;
      *) printf '%s' "$resp"; return 0 ;;
    esac
  done
}

_zyraxon_error() {
  # Only a JSON object carries an error; an SSE body starts with "data: ".
  local resp="$1" message=""
  case "$resp" in
    \{*) message="$(printf '%s' "$resp" | jq -r '.error.message // empty' 2>/dev/null)" ;;
  esac
  [ -n "$message" ] || return 1
  printf 'error: %s\n' "$message" >&2
  local type
  type="$(printf '%s' "$resp" | jq -r '.error.type // empty' 2>/dev/null)"
  [ -n "$type" ] && printf '       type: %s\n' "$type" >&2
  return 0
}

# zyraxon_models — print every model id the provider serves.
zyraxon_models() {
  curl -sS "$ZYRAXON_BASE_URL/models" \
    -H "Authorization: Bearer $ZYRAXON_API_KEY" \
    -H "User-Agent: zyraxon-shell/1.0" \
  | jq -r '.data[].id'
}

# zyraxon_ask [-m model] "prompt" — send one turn, print the whole reply.
zyraxon_ask() {
  local model="$ZYRAXON_MODEL" prompt=""
  while [ $# -gt 0 ]; do
    case "$1" in
      -m|--model) model="$2"; shift 2 ;;
      *) prompt="$1"; shift ;;
    esac
  done
  [ -n "$prompt" ] || prompt="$(cat)"

  local body resp
  body="$(jq -nc --arg m "$model" --arg p "$prompt" \
    '{model:$m, stream:false, messages:[{role:"user",content:$p}]}')"
  resp="$(_zyraxon_api "$body")"
  _zyraxon_error "$resp" && return 1
  printf '%s\n' "$resp" | jq -r '.choices[0].message.content // empty'
}

# zyraxon_stream [-m model] "prompt" — send one turn, print as it arrives.
zyraxon_stream() {
  local model="$ZYRAXON_MODEL" prompt=""
  while [ $# -gt 0 ]; do
    case "$1" in
      -m|--model) model="$2"; shift 2 ;;
      *) prompt="$1"; shift ;;
    esac
  done
  [ -n "$prompt" ] || prompt="$(cat)"

  local body raw
  body="$(jq -nc --arg m "$model" --arg p "$prompt" \
    '{model:$m, stream:true, messages:[{role:"user",content:$p}]}')"
  raw="$(curl -sS "$ZYRAXON_BASE_URL/chat/completions" \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer $ZYRAXON_API_KEY" \
    -H "User-Agent: zyraxon-shell/1.0" \
    -d "$body")"
  _zyraxon_error "$raw" && return 1
  printf '%s\n' "$raw" \
    | sed -n 's/^data: //p' \
    | grep -v '^\[DONE\]$' \
    | jq -rj '.choices[0].delta.content // empty'
  echo
}

# zyraxon_agent [-m model] "prompt" — the tool-calling loop, confined to the
# current directory tree. write_file and run_shell ask before they act.
zyraxon_agent() {
  local model="$ZYRAXON_MODEL" prompt=""
  while [ $# -gt 0 ]; do
    case "$1" in
      -m|--model) model="$2"; shift 2 ;;
      *) prompt="$1"; shift ;;
    esac
  done
  [ -n "$prompt" ] || prompt="$(cat)"

  # Reserve a descriptor for the user's answers before the loop redirects stdin,
  # or the confirmation would read from the tool-call stream instead of the
  # person running the command. A piped stdin is the answers, so prefer it; only
  # fall back to the terminal when stdin is not a pipe. Reading a /dev/tty that
  # exists but is never written to would block forever.
  if [ -p /dev/stdin ]; then
    exec 3<&0
  elif { true < /dev/tty; } 2>/dev/null; then
    exec 3< /dev/tty
  else
    exec 3<&0
  fi
  local answer_fd=3

  local tools='[
    {"type":"function","function":{"name":"read_file","description":"Read a text file.","parameters":{"type":"object","properties":{"path":{"type":"string"}},"required":["path"]}}},
    {"type":"function","function":{"name":"write_file","description":"Write text to a file.","parameters":{"type":"object","properties":{"path":{"type":"string"},"content":{"type":"string"}},"required":["path","content"]}}},
    {"type":"function","function":{"name":"run_shell","description":"Run a shell command and return its output.","parameters":{"type":"object","properties":{"command":{"type":"string"}},"required":["command"]}}}
  ]'

  local messages last="" repeats=0 turn choice reason name args result sig
  messages="$(jq -nc --arg p "$prompt" '[{role:"user",content:$p}]')"

  for turn in $(seq 1 8); do
    local body resp
    body="$(jq -nc --arg m "$model" --argjson msgs "$messages" --argjson tools "$tools" \
      '{model:$m, stream:false, messages:$msgs, tools:$tools}')"
    resp="$(_zyraxon_api "$body")"
    _zyraxon_error "$resp" && return 1

    choice="$(printf '%s' "$resp" | jq -c '.choices[0]')"
    messages="$(jq -nc --argjson msgs "$messages" --argjson msg "$(printf '%s' "$choice" | jq -c '.message')" '$msgs + [$msg]')"

    reason="$(printf '%s' "$choice" | jq -r '.finish_reason')"
    if [ "$reason" != "tool_calls" ]; then
      printf '%s' "$choice" | jq -r '.message.content // empty'
      return 0
    fi

    # A process substitution, not a pipe: a pipe would run this in a subshell and
    # discard every $messages update, so the model would repeat its tool call.
    while read -r call; do
      name="$(printf '%s' "$call" | jq -r '.function.name')"
      args="$(printf '%s' "$call" | jq -r '.function.arguments')"
      sig="$name|$args"
      if [ "$sig" = "$last" ]; then repeats=$((repeats + 1)); else repeats=0; fi
      last="$sig"
      if [ "$repeats" -ge 2 ]; then
        printf 'stopping: the model asked for the same %s call three times.\n' "$name" >&2
        return 1
      fi

      printf '  -> %s\n' "$name" >&2
      case "$name" in
        read_file)
          local path; path="$(printf '%s' "$args" | jq -r '.path')"
          if [ -f "$path" ]; then result="$(head -c 20000 "$path")"; else result="no such file: $path"; fi ;;
        write_file)
          local wpath content reply
          wpath="$(printf '%s' "$args" | jq -r '.path')"
          content="$(printf '%s' "$args" | jq -r '.content')"
          printf 'write %s (%s bytes)? [y/N] ' "$wpath" "${#content}" >&2
          read -r reply <&"$answer_fd" || reply=""
          case "$reply" in
            y|Y|yes) printf '%s' "$content" > "$wpath"; result="wrote $wpath" ;;
            *) result="declined by the user" ;;
          esac ;;
        run_shell)
          local command reply
          command="$(printf '%s' "$args" | jq -r '.command')"
          printf 'run: %s ? [y/N] ' "$command" >&2
          read -r reply <&"$answer_fd" || reply=""
          case "$reply" in
            y|Y|yes) result="$(bash -c "$command" 2>&1 | head -c 20000)" ;;
            *) result="declined by the user" ;;
          esac ;;
        *) result="unknown tool: $name" ;;
      esac
      [ -n "$result" ] || result="(no output)"

      messages="$(jq -nc --argjson msgs "$messages" \
        --arg id "$(printf '%s' "$call" | jq -r '.id')" --arg out "$result" \
        '$msgs + [{role:"tool",tool_call_id:$id,content:$out}]')"
    done < <(printf '%s' "$choice" | jq -c '.message.tool_calls[]')
  done

  printf 'stopping: the agent used its whole turn budget.\n' >&2
  return 1
}
