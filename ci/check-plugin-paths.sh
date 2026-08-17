#!/usr/bin/env bash
# Fails if any plugin references a PLUGIN_DIR / ${CLAUDE_PLUGIN_ROOT} path that
# does not exist inside that same plugin's own directory.
# Usage: check-plugin-paths.sh <repo-root-or-install-root> [plugin-dir ...]
set -uo pipefail
ROOT="${1:?usage: check-plugin-paths.sh <root> [plugin-dir ...]}"; shift || true
if [ "$#" -gt 0 ]; then PLUGINS=("$@"); else
  mapfile -t PLUGINS < <(cd "$ROOT" && for d in */; do [ -f "${d}.claude-plugin/plugin.json" ] && printf '%s\n' "${d%/}"; done)
fi
fail=0
for p in "${PLUGINS[@]}"; do
  pdir="$ROOT/$p"
  while IFS= read -r hit; do
    file="${hit%%:*}"; rest="${hit#*:}"; line="${rest%%:*}"
    while IFS= read -r ref; do
      rel="${ref#\{PLUGIN_DIR\}/}"; rel="${rel#PLUGIN_DIR/}"; rel="${rel#\$\{CLAUDE_PLUGIN_ROOT\}/}"
      rel="${rel%\`}"; rel="${rel%\'}"; rel="${rel%\"}"; rel="${rel%,}"; rel="${rel%.}"
      [ -z "$rel" ] && continue
      case "$rel" in *'<'*|*'{'*|*'*'*) continue;; esac   # skip templated/globbed paths
      if [ ! -e "$pdir/$rel" ]; then
        echo "BROKEN  $p: $file:$line -> $rel"; fail=1
      fi
    done < <(printf '%s\n' "$rest" | grep -oE '(\{PLUGIN_DIR\}|PLUGIN_DIR|\$\{CLAUDE_PLUGIN_ROOT\})/[A-Za-z0-9_./<>{}-]+')
  done < <(grep -rnE '(\{PLUGIN_DIR\}|PLUGIN_DIR|\$\{CLAUDE_PLUGIN_ROOT\})/' "$pdir" 2>/dev/null | sed "s|^$pdir/||")
done
[ "$fail" -eq 0 ] && echo "OK: every PLUGIN_DIR path resolves inside its own plugin."
exit "$fail"
