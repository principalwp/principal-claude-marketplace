#!/usr/bin/env bash
#
# harvest.sh — deterministic asset harvest for the wp-prototype skill.
#
# Downloads pinned WordPress admin CSS + the WordPress design-system token CSS,
# concatenates the classic-admin bundle, and writes assets/manifest.json with
# versions, source URLs, and sha256 checksums.
#
# Re-run on a new WordPress release to refresh the assets:
#   ./scripts/harvest.sh 7.1            # a WordPress/WordPress git tag or branch
#   ./scripts/harvest.sh 7.1 1.1.0      # also bump the @wordpress/theme npm version
#
# After a rescrape: eyeball the four shells in a browser (they inline these
# assets), update the "Supported versions" section in SKILL.md, and commit.

set -euo pipefail

WP_REF="${1:-7.0.2}"            # git tag or branch in github.com/WordPress/WordPress
THEME_VERSION="${2:-1.0.0}"     # @wordpress/theme npm version (design-tokens.css)

SKILL_DIR="$(cd "$(dirname "$0")/.." && pwd)"
ASSETS_DIR="$SKILL_DIR/assets"
TMP_DIR="$(mktemp -d)"
trap 'rm -rf "$TMP_DIR"' EXIT

RAW="https://raw.githubusercontent.com/WordPress/WordPress/$WP_REF"

# Core CSS files to harvest, as "<repo path>|<local name>".
# .min.css because these get inlined into single-file prototypes.
FILES=(
  "wp-includes/css/buttons.min.css|buttons.min.css"
  "wp-admin/css/common.min.css|common.min.css"
  "wp-admin/css/forms.min.css|forms.min.css"
  "wp-admin/css/admin-menu.min.css|admin-menu.min.css"
  "wp-admin/css/dashboard.min.css|dashboard.min.css"
  "wp-admin/css/list-tables.min.css|list-tables.min.css"
  "wp-admin/css/edit.min.css|edit.min.css"
  "wp-includes/css/admin-bar.min.css|admin-bar.min.css"
  "wp-includes/css/dashicons.min.css|dashicons.min.css"
)

# Order matters for the bundle: buttons first so admin CSS can override it,
# mirroring core's load order closely enough for prototype purposes.
BUNDLE_ORDER=(
  buttons.min.css
  common.min.css
  forms.min.css
  admin-menu.min.css
  dashboard.min.css
  list-tables.min.css
  edit.min.css
  admin-bar.min.css
)

sha256() {
  if command -v sha256sum >/dev/null 2>&1; then
    sha256sum "$1" | awk '{print $1}'
  else
    shasum -a 256 "$1" | awk '{print $1}'
  fi
}

fetch() {
  local url="$1" out="$2"
  echo "  GET $url"
  curl -fsSL --retry 3 -o "$out" "$url"
  [ -s "$out" ] || { echo "ERROR: empty download: $url" >&2; exit 1; }
}

echo "Harvesting WordPress $WP_REF admin CSS + @wordpress/theme@$THEME_VERSION tokens"
mkdir -p "$ASSETS_DIR"

for entry in "${FILES[@]}"; do
  path="${entry%%|*}"; name="${entry##*|}"
  fetch "$RAW/$path" "$TMP_DIR/$name"
done

fetch "https://unpkg.com/@wordpress/theme@$THEME_VERSION/design-tokens.css" "$TMP_DIR/wpds-tokens.css"

# Sanity check: dashicons must ship its font as an embedded data URI, or
# single-file prototypes lose their icons.
if ! grep -qE 'data:(application/(x-)?font-woff|font/woff2?)' "$TMP_DIR/dashicons.min.css"; then
  echo "ERROR: dashicons.min.css no longer embeds its font as a data URI." >&2
  echo "Single-file prototypes would render without icons — investigate before shipping." >&2
  exit 1
fi

# Build the classic-admin bundle. admin-theme-vars.css is hand-authored (core
# emits these custom properties from PHP, not from a harvestable file) and goes
# first so rules that use the vars without fallbacks resolve.
BUNDLE="$TMP_DIR/classic-admin.bundle.min.css"
: > "$BUNDLE"
if [ -f "$ASSETS_DIR/admin-theme-vars.css" ]; then
  printf '\n/* ===== admin-theme-vars.css (hand-authored) ===== */\n' >> "$BUNDLE"
  cat "$ASSETS_DIR/admin-theme-vars.css" >> "$BUNDLE"
fi
for name in "${BUNDLE_ORDER[@]}"; do
  printf '\n/* ===== %s (WordPress %s) ===== */\n' "$name" "$WP_REF" >> "$BUNDLE"
  cat "$TMP_DIR/$name" >> "$BUNDLE"
done

# Everything downloaded and built — move into place.
for entry in "${FILES[@]}"; do
  name="${entry##*|}"
  mv "$TMP_DIR/$name" "$ASSETS_DIR/$name"
done
mv "$TMP_DIR/wpds-tokens.css" "$ASSETS_DIR/wpds-tokens.css"
mv "$BUNDLE" "$ASSETS_DIR/classic-admin.bundle.min.css"

# Write the manifest: provenance for the HARVESTED assets only. Hand-authored
# files (admin-theme-vars.css, wpds-components.css, wpp-runtime.*) are
# deliberately excluded — they change independently of a harvest and would
# make these checksums go stale.
MANIFEST="$ASSETS_DIR/manifest.json"
MANIFEST_NAMES=()
for entry in "${FILES[@]}"; do MANIFEST_NAMES+=("${entry##*|}"); done
MANIFEST_NAMES+=(wpds-tokens.css classic-admin.bundle.min.css)
{
  echo '{'
  echo "  \"wordpress_ref\": \"$WP_REF\","
  echo "  \"wordpress_theme_package\": \"$THEME_VERSION\","
  echo "  \"harvested_at\": \"$(date -u +%Y-%m-%dT%H:%M:%SZ)\","
  echo '  "sources": {'
  echo "    \"wordpress_css\": \"https://raw.githubusercontent.com/WordPress/WordPress/$WP_REF/\","
  echo "    \"design_tokens\": \"https://unpkg.com/@wordpress/theme@$THEME_VERSION/design-tokens.css\""
  echo '  },'
  echo '  "license": "Harvested files are WordPress core / @wordpress/theme, GPL-2.0-or-later — not covered by this repo'"'"'s license.",'
  echo '  "note": "Covers harvested assets only; regenerate with scripts/harvest.sh <wp-tag> [<theme-version>]. Hand-authored assets (admin-theme-vars.css, wpds-components.css, wpp-runtime.*) are not listed — review them against Gutenberg Storybook after a major WP bump. classic-admin.bundle.min.css also embeds admin-theme-vars.css.",'
  echo '  "files": {'
  first=1
  for name in "${MANIFEST_NAMES[@]}"; do
    f="$ASSETS_DIR/$name"
    [ $first -eq 1 ] || echo ','
    first=0
    printf '    "%s": { "sha256": "%s", "bytes": %s }' \
      "$name" "$(sha256 "$f")" "$(wc -c < "$f" | tr -d ' ')"
  done
  echo ''
  echo '  }'
  echo '}'
} > "$MANIFEST"

echo ''
echo "Done. Assets in $ASSETS_DIR:"
ls -la "$ASSETS_DIR"
