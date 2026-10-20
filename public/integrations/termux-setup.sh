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
# The client is served as its own file so it can be read and edited by hand
# rather than being buried in this installer. It is downloaded, not inlined, so
# `zyraxon --help` and this script can never drift apart.
say "-> downloading the zyraxon client"
if ! curl -fsSL --max-time 60 "${ZYRAXON_ORIGIN}/integrations/zyraxon-chat.sh" -o "${CMD_FILE}"; then
  die "could not download ${ZYRAXON_ORIGIN}/integrations/zyraxon-chat.sh"
fi
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
say "    zyraxon              # open the chat box"
say "    zyraxon \"hello from my phone\""
say "    zyraxon -a \"create hello.py that prints hi, then run it\""
say ""
say "Inside the chat box, /help lists the commands (/models, /model, /agent, /new)."
say "Open a new terminal first, or run: source ~/.bashrc"
