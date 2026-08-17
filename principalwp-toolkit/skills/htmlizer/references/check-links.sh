#!/usr/bin/env bash
# check-links.sh — resolve every URL a page cites, in parallel, one verdict per line.
#
# The htmlizer repo is PRIVATE, so a plain curl of a github.com/OWNER/REPO/blob/SHA/PATH
# link 404s even when the link is valid. This script special-cases those: it parses
# OWNER/REPO/SHA/PATH out of the blob URL and checks the file via the authenticated
# GitHub API (`gh api repos/OWNER/REPO/contents/PATH?ref=SHA`). Every other http(s) URL
# is checked with a plain HEAD-less GET.
#
# Usage:
#   references/check-links.sh <urls-file>      # one URL per line
#   <extract links> | references/check-links.sh   # URLs on stdin
# e.g.  grep -oE 'https?://[^"'\''<> )]+' page.html | sort -u | references/check-links.sh
#
# Output: one line per URL — "OK   <url>" or "BAD  <url> — <reason>"
#   reason ∈ an HTTP code (404, 500, …) | "timeout" | "unreachable" | "404 missing" (gh)
# Exit: 0 if every URL is OK, 1 if any is BAD, 2 on usage error.
#
# Non-http(s) and blank/`#` lines are skipped silently. GitHub blob checks need `gh`
# installed and authenticated; without it those links report unreachable (gh not found).
set -uo pipefail

# --- read input (file arg, else stdin) -------------------------------------
if [ -n "${1:-}" ]; then
  if [ ! -f "$1" ]; then
    echo "usage: check-links.sh <urls-file>   (or pipe URLs on stdin)" >&2
    exit 2
  fi
  RAW="$(cat -- "$1")"
else
  RAW="$(cat)"
fi

TMPDIR="$(mktemp -d)"
trap 'rm -rf "$TMPDIR"' EXIT

HAVE_GH=1
command -v gh >/dev/null 2>&1 || HAVE_GH=0

# check_one <url> <out-file> — write "OK …" / "BAD …" to out-file; touch out-file.bad if bad.
check_one() {
  local url="$1" out="$2" result

  if [[ "$url" =~ ^https?://github\.com/([^/]+)/([^/]+)/blob/([^/]+)/(.+)$ ]]; then
    # Private-repo blob → authenticated contents API.
    local owner="${BASH_REMATCH[1]}" repo="${BASH_REMATCH[2]}"
    local sha="${BASH_REMATCH[3]}" path="${BASH_REMATCH[4]}"
    path="${path%%#*}"; path="${path%%\?*}"          # strip #Lx-Ly anchor / ?query
    if [ "$HAVE_GH" -eq 0 ]; then
      result="unreachable (gh not found)"
    else
      local err rc code
      err="$(timeout 10 gh api --silent "repos/$owner/$repo/contents/$path?ref=$sha" 2>&1 >/dev/null)"
      rc=$?
      if [ "$rc" -eq 0 ]; then
        result="OK"
      elif [ "$rc" -eq 124 ]; then
        result="timeout"
      else
        code="$(printf '%s' "$err" | grep -oE 'HTTP [0-9]+' | grep -oE '[0-9]+' | head -1)"
        if [ "$code" = "404" ]; then result="404 missing"
        elif [ -n "$code" ]; then    result="$code"
        else                         result="unreachable"
        fi
      fi
    fi
  else
    # Any other http(s) URL → plain GET, report the code.
    local code rc
    code="$(curl -sS -o /dev/null -w '%{http_code}' --max-time 10 "$url" 2>/dev/null)"
    rc=$?
    if [ "$rc" -eq 0 ] && [ "$code" -ge 200 ] 2>/dev/null && [ "$code" -lt 400 ] 2>/dev/null; then
      result="OK"
    elif [ "$rc" -eq 28 ]; then
      result="timeout"
    elif [ "$rc" -ne 0 ] || [ "$code" = "000" ]; then
      result="unreachable"
    else
      result="$code"
    fi
  fi

  if [ "$result" = "OK" ]; then
    printf 'OK   %s\n' "$url" > "$out"
  else
    printf 'BAD  %s — %s\n' "$url" "$result" > "$out"
    : > "$out.bad"
  fi
}

# --- fan out: one background job per URL, all at once -----------------------
i=0
declare -a OUTS=()
while IFS= read -r line; do
  line="${line#"${line%%[![:space:]]*}"}"   # ltrim
  line="${line%"${line##*[![:space:]]}"}"   # rtrim
  [ -z "$line" ] && continue
  case "$line" in \#*) continue ;; esac
  [[ "$line" =~ ^https?:// ]] || continue
  out="$TMPDIR/$i"
  OUTS+=("$out")
  check_one "$line" "$out" &
  i=$((i + 1))
done <<< "$RAW"

wait

if [ "${#OUTS[@]}" -eq 0 ]; then
  echo "no http(s) URLs found" >&2
  exit 0
fi

# --- print in input order; fail if any was bad -----------------------------
bad=0
for out in "${OUTS[@]}"; do
  cat -- "$out"
  [ -f "$out.bad" ] && bad=1
done

exit "$bad"
