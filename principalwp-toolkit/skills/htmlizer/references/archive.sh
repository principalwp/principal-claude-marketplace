#!/usr/bin/env sh
# archive.sh — durable, opt-in snapshot of ONE htmlizer artifact into the history
# archive. No-op unless archiving is enabled (ARCHIVE non-empty, via the config key
# or the HTMLIZER_ARCHIVE env var). Safe to call unconditionally.
#
# Usage: archive.sh <slug> <N> <stage> <src-file>
#   stage: draft | final
#   (reviewer findings files are written by the orchestrator, not this helper)
# Sources net-config.sh (beside it) for ARCHIVE / HISTORY_DIR.
DIR=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
. "$DIR/net-config.sh"
[ -n "$ARCHIVE" ] || exit 0
slug=$1; ver=$2; stage=$3; src=$4
if [ -z "$slug" ] || [ -z "$ver" ] || [ -z "$stage" ] || [ -z "$src" ]; then
  echo "archive.sh: usage: archive.sh <slug> <N> <stage> <src-file>" >&2; exit 2
fi
[ -f "$src" ] || { echo "archive.sh: source not found: $src" >&2; exit 3; }
ts=$(date -u +%Y%m%dT%H%M%SZ)
ext=${src##*.}
dest="$HISTORY_DIR/$slug"
mkdir -p "$dest" || exit 4
cp -- "$src" "$dest/${slug}__r${ver}__${ts}__${stage}.${ext}"
