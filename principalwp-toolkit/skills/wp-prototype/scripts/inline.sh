#!/usr/bin/env bash
#
# inline.sh — turn a shell/working file into a single self-contained HTML file
# by replacing marker lines of the form:
#
#     /*@inline classic-admin.bundle.min.css*/
#
# with the contents of that file from the skill's assets/ directory (falling
# back to the input file's own directory for prototype-local assets).
#
# Usage:
#   scripts/inline.sh working.html prototype.html
#   scripts/inline.sh working.html > prototype.html

set -euo pipefail

if [ $# -lt 1 ]; then
  echo "usage: inline.sh input.html [output.html]" >&2
  exit 64
fi

IN="$1"; OUT="${2:-}"
ASSETS_DIR="$(cd "$(dirname "$0")/../assets" && pwd)"
IN_DIR="$(cd "$(dirname "$IN")" && pwd)"

emit() {
  local line asset name
  while IFS= read -r line || [ -n "$line" ]; do
    # markers must be the whole line ([[:space:]] also eats a trailing CR)
    if [[ "$line" =~ ^[[:space:]]*/\*@inline[[:space:]]+([A-Za-z0-9._-]+)\*/[[:space:]]*$ ]]; then
      name="${BASH_REMATCH[1]}"
      if [ -f "$ASSETS_DIR/$name" ]; then asset="$ASSETS_DIR/$name"
      elif [ -f "$IN_DIR/$name" ]; then asset="$IN_DIR/$name"
      else echo "ERROR: @inline asset not found: $name" >&2; exit 1
      fi
      cat "$asset"; echo
    else
      printf '%s\n' "$line"
    fi
  done < "$IN"
}

if [ -n "$OUT" ]; then
  # write via a temp file so a failure never leaves a truncated output behind
  TMP_OUT="$OUT.tmp.$$"
  trap 'rm -f "$TMP_OUT"' EXIT
  emit > "$TMP_OUT"
  mv "$TMP_OUT" "$OUT"
  trap - EXIT
  echo "Wrote $OUT ($(wc -c < "$OUT" | tr -d ' ') bytes)" >&2
else
  emit
fi
