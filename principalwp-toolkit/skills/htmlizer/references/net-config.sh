#!/usr/bin/env sh
# net-config.sh — the ONE config loader for htmlizer's link-minting scripts
# (fs-link.sh, link.sh) and the manual debug command in the repo README. Built-in
# defaults, then the user's config file (if present) overrides HOST / LINK_HOST /
# PORT / FS_ROOTS / STATE_DIR / ALLOWED_HOSTS / REDACT_SECRETS / ARCHIVE. Everything else
# (serve root, log, secret, shortlink store) derives from STATE_DIR, so there is
# exactly one file to edit.
#
# HOST and LINK_HOST are two different things and conflating them is the bug this
# split exists to prevent: HOST is the address the server BINDS to, LINK_HOST is
# the address that goes in the link a human clicks. They are the same for the
# loopback default, and they are NOT the same the moment HOST is a wildcard —
# "http://0.0.0.0:PORT/" is a bind address, not a destination.
#
# Not meant to be executed directly — sourced with `. net-config.sh`.

# ---- built-in defaults ----
HOST="127.0.0.1"
LINK_HOST=""            # empty = derive from HOST below; set in the config to force one
PORT="26537"
FS_ROOTS=""
STATE_DIR="${XDG_STATE_HOME:-$HOME/.local/state}/htmlizer"
ALLOWED_HOSTS=""
REDACT_SECRETS=""       # empty = off (default). Any non-empty value turns it on — see references/serving.md
ARCHIVE=""             # empty = off (default). Any non-empty value turns on durable version+reviewer archiving — see references/serving.md

# ---- user config file: shell syntax, eight commented keys. Auto-created with
# commented defaults on first use if it doesn't exist yet, so there is always
# something to open and edit.
CONFIG_FILE="${XDG_CONFIG_HOME:-$HOME/.config}/htmlizer/config"
if [ ! -e "$CONFIG_FILE" ]; then
  mkdir -p "$(dirname "$CONFIG_FILE")" 2>/dev/null
  cat > "$CONFIG_FILE" <<'EOF'
# htmlizer config — shell syntax (this file is sourced, not parsed). Uncomment a
# line to override its default. After editing, stop the board-server on your
# port — fuser -k 26537/tcp — and the next mint (fs-link.sh) restarts it with
# the new values. Stop it by PORT, never `pkill -f board-server.js`: that also
# matches the shell running it (killing your own command) and any second
# instance, which is the same file with the same command line.

# Host the board-server BINDS to. Loopback-only by default: nothing off this
# machine can reach it. Only change this to reach it from another device —
# read the security note in README.md first.
#HOST=127.0.0.1

# Host that goes in the LINK you get handed. This is NOT the bind address, and
# it is the key to set when a link has to work from another device.
#
# Leave it empty and it follows HOST — except when HOST is a wildcard
# (0.0.0.0 / ::), where there is no clickable bind address, so it falls back to
# 127.0.0.1 (works on this machine only).
#
# So: binding 0.0.0.0 to reach this box from a laptop/phone means setting this
# to the address you reach it BY — the Tailscale IP, LAN IP, or hostname —
# e.g. LINK_HOST=100.64.0.1. Whatever you put here, the board-server accepts
# submits addressed to it, so the Submit button works without also listing it in
# ALLOWED_HOSTS below. Restart the server after changing this (see the top of
# this file) — the allow-list is read once at launch.
#
# Bare host or IP only: no scheme, no port, no trailing slash. "http://1.2.3.4"
# or "1.2.3.4/" is pasted in verbatim and mints a broken link.
#LINK_HOST=

# Port the board-server listens on.
#PORT=26537

# Comma-separated absolute paths the /fs/ route may additionally serve, beyond
# the serve root (which is always linkable via /s/ links). Empty by default —
# only pages this skill generated are reachable out of the box.
#FS_ROOTS=

# Where generated pages, the server log, and its signing secret / shortlink
# store live. Change this to move all of htmlizer's state elsewhere.
#STATE_DIR=${XDG_STATE_HOME:-$HOME/.local/state}/htmlizer

# Extra Host-header values the POST submit route accepts, comma-separated.
# The server already accepts 127.0.0.1, localhost, HOST, and LINK_HOST — so
# this is only for ADDITIONAL addresses you also reach the server by (a second
# interface, a hostname alias). Setting LINK_HOST does not require touching
# this. Order here means nothing.
#ALLOWED_HOSTS=

# Redact credential/secret-looking values (API keys, tokens, passwords) out of
# generated page content. OFF by default — a page may quote what it found in
# the source verbatim. Set to any non-empty value (e.g. 1) to turn it on. See
# references/serving.md → "Redacting secrets from a page" for what this does
# and does not cover. No restart needed — Claude reads this at SKILL.md step 0,
# same as everything else in this file.
#REDACT_SECRETS=

# Durably archive every generated page version (pre-panel draft + handed-over
# final) and each reviewer's raw findings under STATE_DIR/history/<slug>/, for
# later analysis. OFF by default — a normal run writes nothing here. Set to any
# non-empty value (e.g. 1) to turn it on. Overridable per-run by the
# HTMLIZER_ARCHIVE env var. See references/serving.md → "Archiving page history".
#ARCHIVE=
EOF
fi
if [ -r "$CONFIG_FILE" ]; then
  # Test-source in a subshell first: a syntax error must fail the mint with a
  # clear message, never a raw shell crash or a silent partial-apply of the
  # file's assignments to this shell's real environment.
  if ! ( . "$CONFIG_FILE" ) >/dev/null 2>&1; then
    echo "net-config.sh: $CONFIG_FILE failed to load (syntax error?) — fix or remove it, then try again" >&2
    exit 1
  fi
  . "$CONFIG_FILE"
fi
ARCHIVE="${HTMLIZER_ARCHIVE:-$ARCHIVE}"   # env var overrides the config key for a one-off run

# ---- resolve the two hosts ----
# An empty HOST means loopback, matching board-server.js's own
# `process.env.HTML_SKILLS_CHANNEL_HOST || '127.0.0.1'`. Normalize it here so
# every consumer (the link, the liveness probe, the launch env) agrees with what
# the server will actually bind, instead of each guessing separately.
HOST="${HOST:-127.0.0.1}"

# LINK_HOST from the config wins, verbatim. Otherwise follow HOST — unless HOST
# is a wildcard, which is not a destination, so fall back to loopback. That
# fallback is always reachable ON this machine and never claims to be reachable
# off it; LINK_HOST_DERIVED lets fs-link.sh say so out loud.
LINK_HOST_DERIVED=0
if [ -z "$LINK_HOST" ]; then
  case "$HOST" in
    0.0.0.0|::) LINK_HOST="127.0.0.1"; LINK_HOST_DERIVED=1 ;;
    *)          LINK_HOST="$HOST" ;;
  esac
fi

# ---- everything else derives from STATE_DIR ----
SERVE_ROOT="$STATE_DIR/serve"
FS_SECRET_FILE="$STATE_DIR/.fs-signing-secret"
FS_STORE_FILE="$STATE_DIR/.fs-shortlinks.tsv"
LOG="$STATE_DIR/.board-server.log"
HISTORY_DIR="$STATE_DIR/history"
