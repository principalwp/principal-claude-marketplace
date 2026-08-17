#!/usr/bin/env bash
# Asserts every tracked file belongs to a plugin directory declared in
# .claude-plugin/marketplace.json, or to the short allowlist of repo-level files.
# Also flags a repeated adjacent path segment (the `git mv` nesting accident).
# Usage: ci/check-plugin-layout.sh [repo-root]   (default: .)
set -uo pipefail
ROOT="${1:-.}"
cd "$ROOT" || exit 2

mapfile -t PLUGIN_DIRS < <(python3 - <<'PY'
import json
m = json.load(open(".claude-plugin/marketplace.json"))
for p in m["plugins"]:
    s = p["source"]
    if not isinstance(s, str) or not s.startswith("./"):
        raise SystemExit("marketplace source must be a './dir' string: %r" % (s,))
    print(s[2:].rstrip("/"))
PY
) || exit 2

# ---------------------------------------------------------------------------
# CLOSED LIST. These two arrays are the only paths allowed to sit outside a
# plugin. They are not a place to add things. Every entry below exists for a
# stated reason: repo metadata, CI, or the .planning/ archive (historical
# project planning, kept for reference, ships to no one). Anything else that
# belongs to the product belongs inside a plugin. If you find yourself
# widening this list to make the check pass, the file is misplaced, not the list.
# ---------------------------------------------------------------------------
ALLOW_EXACT=(
  .claude-plugin/marketplace.json
  .gitignore
  README.md
  CONTRIBUTING.md
  CLAUDE.md
  LICENSE
)
ALLOW_PREFIX=( .claude/ .github/ ci/ .planning/ )

fail=0
while IFS= read -r f; do
  for a in "${ALLOW_EXACT[@]}";  do [ "$f" = "$a" ] && continue 2; done
  for a in "${ALLOW_PREFIX[@]}"; do case "$f" in "$a"*) continue 2;; esac; done
  for d in "${PLUGIN_DIRS[@]}";  do case "$f" in "$d"/*) continue 2;; esac; done
  echo "ORPHAN  $f  (belongs to no declared plugin directory)"
  fail=1
done < <(git ls-files)

while IFS= read -r f; do
  echo "NESTED  $f  (repeated adjacent path segment — a git mv landed inside its own target)"
  fail=1
done < <(git ls-files | awk -F/ '{for(i=1;i<NF;i++) if($i==$(i+1)) {print; break}}')

for d in "${PLUGIN_DIRS[@]}"; do
  [ -f "$d/.claude-plugin/plugin.json" ] || { echo "NOMANIFEST  $d/.claude-plugin/plugin.json missing"; fail=1; }
done

[ "$fail" -eq 0 ] && echo "OK: every tracked file belongs to a declared plugin directory."
exit "$fail"
