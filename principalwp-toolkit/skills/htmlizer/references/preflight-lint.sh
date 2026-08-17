#!/usr/bin/env bash
# preflight-lint.sh — deterministic mechanical design lint for ONE generated htmlizer page.
#
# Usage: references/preflight-lint.sh <page.html>
#
# Scope: high-confidence, greppable/mechanical DESIGN checks only. NO plain-language, voice,
# or jargon checks — those are review-sufficiency.md's job and need real reading comprehension,
# which does not belong in a script. It owns every check below so the step-3.5 review panel
# never re-derives them in a slow LLM round. It supplements, never replaces, that panel.
#
# This linter is an additional gate, never a substitute for the review panel. `0 HIGH` is
# necessary, never sufficient — every version still goes through all three reviewers.
#
# Output: one line per hit — "TAG file:line — problem → fix hint" (TAG is HIGH or MED).
# Exit: 0 if no HIGH hit fired (MED hits do not fail the build), 1 if any HIGH fired,
#       2 on usage/IO error.
set -uo pipefail   # deliberately NOT -e: grep exits 1 on "no match", which is a normal,
                    # expected outcome for most checks below, not a script failure.

PAGE="${1:-}"
if [ -z "$PAGE" ] || [ ! -f "$PAGE" ]; then
  echo "usage: $0 <page.html>" >&2
  exit 2
fi

if ! command -v node >/dev/null 2>&1; then
  echo "preflight-lint: node is required but not on PATH — install Node" >&2
  exit 2
fi

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
HELPER="$SCRIPT_DIR/preflight-parse.js"

TMPDIR="$(mktemp -d)"
trap 'rm -rf "$TMPDIR"' EXIT

# ---------------------------------------------------------------------------
# One single-pass node parse of the page, producing every intermediate file
# the checks below consume (channel.tsv, css_rules.tsv, fontface.tsv,
# scripts.tsv + inline_script_N.js, scripts_uncommented.txt, syntax_errors.tsv).
# ---------------------------------------------------------------------------
node "$HELPER" "$PAGE" "$TMPDIR"

HIGH_COUNT=0
MED_COUNT=0

# hit SEV "file:line" "problem" "fix hint"
hit() {
  local sev="$1" loc="$2" problem="$3" fix="$4"
  printf '%-4s %s — %s \xe2\x86\x92 %s\n' "$sev" "$loc" "$problem" "$fix"
  if [ "$sev" = "HIGH" ]; then HIGH_COUNT=$((HIGH_COUNT+1)); else MED_COUNT=$((MED_COUNT+1)); fi
}

# ---------------------------------------------------------------------------
# 1. Missing <!DOCTYPE html> / <meta charset> / <meta name="viewport">
# ---------------------------------------------------------------------------
grep -qi '<!doctype html>' "$PAGE" \
  || hit HIGH "$PAGE:1" "missing <!DOCTYPE html>" "add <!DOCTYPE html> as the very first line"
grep -qi '<meta[^>]*charset=["'"'"']\?utf-8' "$PAGE" \
  || hit HIGH "$PAGE:1" "missing <meta charset=\"utf-8\">" "add it as the first line inside <head>"
grep -qi '<meta[^>]*name=["'"'"']viewport["'"'"']' "$PAGE" \
  || hit HIGH "$PAGE:1" "missing <meta name=\"viewport\">" 'add <meta name="viewport" content="width=device-width, initial-scale=1"> inside <head>'

# ---------------------------------------------------------------------------
# 2. CAPTURE_CHANNEL well-formed (16 lowercase hex, not a uuid, not empty)
#    Covers Shape A `window.CAPTURE_CHANNEL = "…"` and Shape B `const CHANNEL = "…"`.
# ---------------------------------------------------------------------------
while IFS=$'\t' read -r lineno val; do
  [ -z "${lineno:-}" ] && continue
  if [ -z "$val" ]; then
    hit HIGH "$PAGE:$lineno" "CAPTURE_CHANNEL is empty/placeholder" "mint one with: openssl rand -hex 8 (reuse the SAME session literal on every page/round — never re-mint per round)"
  elif [[ "$val" =~ ^[0-9a-f]{8}-[0-9a-f]{4}- ]]; then
    hit HIGH "$PAGE:$lineno" "CAPTURE_CHANNEL is uuid-shaped ($val) — this is the session id, not a minted channel" "mint a channel with: openssl rand -hex 8 — a session id cross-routes every sibling branch's submits into this one Monitor"
  elif ! [[ "$val" =~ ^[0-9a-f]{16}$ ]]; then
    hit HIGH "$PAGE:$lineno" "CAPTURE_CHANNEL \"$val\" is not 16 lowercase hex chars" "mint one with: openssl rand -hex 8"
  fi
done < "$TMPDIR/channel.tsv"

# ---------------------------------------------------------------------------
# 3. Dead in-page anchors: href="#name" with no matching id="name" anywhere on the page
# ---------------------------------------------------------------------------
mapfile -t PAGE_IDS < <(grep -oP 'id=["'"'"']\K[^"'"'"']+' "$PAGE" | sort -u)
while IFS=: read -r lineno anchor; do
  [ -z "${anchor:-}" ] && continue
  found=0
  for id in "${PAGE_IDS[@]:-}"; do
    if [ "$id" = "$anchor" ]; then found=1; break; fi
  done
  if [ "$found" -eq 0 ]; then
    hit HIGH "$PAGE:$lineno" "dead in-page anchor href=\"#$anchor\" — no id=\"$anchor\" on the page" "add id=\"$anchor\" to the target element, or fix the href"
  fi
done < <(grep -noP 'href=["'"'"']#\K[^"'"'"']+' "$PAGE")

# ---------------------------------------------------------------------------
# 4. `.file` spans with no href / no popover / no tabindex (inert dotted term)
#    See references/review-content-hygiene.md → H1.
# ---------------------------------------------------------------------------
while IFS=: read -r lineno tag; do
  [ -z "${tag:-}" ] && continue
  has_tabindex=0; has_pop=0; is_planned=0
  [[ "$tag" == *tabindex=* ]] && has_tabindex=1
  [[ "$tag" == *has-pop* ]] && has_pop=1
  [[ "$tag" == *planned* ]] && is_planned=1
  if [ "$has_pop" -eq 1 ] && [ "$has_tabindex" -eq 0 ]; then
    hit HIGH "$PAGE:$lineno" ".file.has-pop span has no tabindex=\"0\" — a keyboard/touch reader can never open its gloss" 'add tabindex="0" to the trigger span'
  elif [ "$has_pop" -eq 0 ] && [ "$is_planned" -eq 0 ]; then
    hit HIGH "$PAGE:$lineno" "inert .file span — plain dotted term, no link, no popover, not .planned" 'link it (<a class="file" href="…">), add .has-pop + tabindex="0" + a .file-pop gloss, or mark .file.planned'
  fi
done < <(grep -noP '<span\b[^>]*class=["'"'"'][^"'"'"']*(?<![\w-])file(?![\w-])[^"'"'"']*["'"'"'][^>]*>' "$PAGE")

# ---------------------------------------------------------------------------
# 5. base64 / data: fonts inside @font-face ONLY (never the whole page — that would also
#    match a perfectly legitimate inline data: SVG favicon or icon).
# ---------------------------------------------------------------------------
while IFS=$'\t' read -r lineno; do
  [ -z "${lineno:-}" ] && continue
  hit HIGH "$PAGE:$lineno" "font inlined as base64/data: URI inside @font-face" "reference the external .woff2 instead (../assets/fonts/… or /assets/fonts/…) — never inline a font"
done < "$TMPDIR/fontface.tsv"

# ---------------------------------------------------------------------------
# One CSS-rule pass, reused by checks 6–9 below. Scans every top-level
# `selector { decls }` rule inside <style>…</style>, regardless of how many
# physical lines it spans — brace depth is tracked so a selector or a
# declaration block broken across lines is still captured as one row.
# Selector/decl whitespace (including newlines/tabs) is collapsed to single
# spaces and trimmed, so the TSV stays one row per rule. Rules that are
# direct children of a single at-rule (@media/@supports/…) are ALSO emitted
# — one level of at-rule nesting is checked, e.g. a rule inside a bare
# `@media(...){ … }` — but the at-rule's own prelude (`@media(...)`) is
# never emitted as a rule itself, and anything nested TWO OR MORE levels
# deep (an at-rule inside an at-rule, or a rule inside that) is swallowed
# unexamined. This stays a shallow, bounded-depth pass, not a real CSS
# parser.
# ---------------------------------------------------------------------------
CSS_RULES="$TMPDIR/css_rules.tsv"

# ---------------------------------------------------------------------------
# 6. Pills: border-radius:999px or var(--r-pill), on ANY selector. No legitimate rule
#    in this house style uses 999px / --r-pill for anything but a pill/badge shape —
#    unlike 50% (icon dots/avatars), 999px is unambiguous.
# ---------------------------------------------------------------------------
while IFS=$'\t' read -r lineno sel decl; do
  [ -z "${lineno:-}" ] && continue
  if echo "$decl" | grep -qiE 'border-radius[^;]*(999px|var\(--r-pill\))'; then
    hit HIGH "$PAGE:$lineno" "pill shape on \`$sel\` (border-radius 999px / --r-pill)" "plain-text .tag/.meta instead — no fill, no rounded pill, per house style"
  fi
done < "$CSS_RULES"

# ---------------------------------------------------------------------------
# 7. Eyebrows: text-transform:uppercase + letter-spacing together on the same rule.
# ---------------------------------------------------------------------------
while IFS=$'\t' read -r lineno sel decl; do
  [ -z "${lineno:-}" ] && continue
  if echo "$decl" | grep -qi 'text-transform\s*:\s*uppercase' && echo "$decl" | grep -qi 'letter-spacing'; then
    hit HIGH "$PAGE:$lineno" "eyebrow/kicker styling on \`$sel\` (uppercase + letter-spacing)" "drop both — sentence-case, no letter-spacing; no eyebrows in this house style"
  fi
done < "$CSS_RULES"

# ---------------------------------------------------------------------------
# 8. Navy hero: background:var(--navy) or #1B2A4A on a header/hero selector.
# ---------------------------------------------------------------------------
while IFS=$'\t' read -r lineno sel decl; do
  [ -z "${lineno:-}" ] && continue
  # F5 fix: was '(^|[^-])\b(header|hero|masthead)\b', which required a NON-hyphen char
  # (or start-of-string) before the word — that excludes ".page-header" (preceded by "-"),
  # which is exactly the real convention name and the actual violation to catch. Plain
  # \b already matches correctly across a hyphen (a hyphen is a non-word char, so the
  # boundary is there): \bheader\b matches inside ".page-header" fine on its own.
  if echo "$sel" | grep -qiE '\b(header|hero|masthead)\b'; then
    if echo "$decl" | grep -qiE 'background(-color)?\s*:\s*(var\(--navy\)|#1b2a4a)\b'; then
      hit HIGH "$PAGE:$lineno" "navy hero/dark marketing band on \`$sel\`" "light background per house style (var(--bg)/var(--surface)); a bottom rule marks the header, not a colored band"
    fi
  fi
done < "$CSS_RULES"

# ---------------------------------------------------------------------------
# 9. `#id{}` style rules — ids are JS hooks only, styling goes through classes.
# ---------------------------------------------------------------------------
while IFS=$'\t' read -r lineno sel decl; do
  [ -z "${lineno:-}" ] && continue
  if echo "$sel" | grep -qE '(^|,)\s*#[A-Za-z][A-Za-z0-9_-]*\s*$'; then
    hit HIGH "$PAGE:$lineno" "style rule keyed on \`$sel\` (an id selector)" "restyle via a class — ids are JS hooks only in this house style"
  fi
done < "$CSS_RULES"

# ---------------------------------------------------------------------------
# 10. user-select:none anywhere outside a line-number gutter (.ln)
# ---------------------------------------------------------------------------
while IFS=$'\t' read -r lineno sel decl; do
  [ -z "${lineno:-}" ] && continue
  if echo "$decl" | grep -qi 'user-select\s*:\s*none' && ! echo "$sel" | grep -qE '\.ln\b'; then
    hit HIGH "$PAGE:$lineno" "user-select:none on \`$sel\` (not a line-number gutter)" "drop it — base.css's global *{user-select:text} reset means ALL text stays selectable; the ONLY sanctioned exception is a .ln line-number gutter"
  fi
done < "$CSS_RULES"

# ---------------------------------------------------------------------------
# 11. Sub-16px font-size on reading copy (mono/labels/controls/meta are exempt —
#     this house style intentionally sets those smaller; see base.css).
# ---------------------------------------------------------------------------
EXEMPT_SEL='mono|code|pre|kbd|samp|\bsmall\b|\.tag\b|\.meta\b|\.count\b|\.file\b|callout-label|\.why\b|\.ln\b|\.gut\b|\bcap-|badge|chip|pill|attribution|\.btn|\.tab\b|label\b|input|select|textarea|\.reco\b|readmore|\.st\b'
while IFS=$'\t' read -r lineno sel decl; do
  [ -z "${lineno:-}" ] && continue
  while IFS= read -r px; do
    [ -z "$px" ] && continue
    # integer compare against 16 (px is a decimal like "13" or "13.5" — strip any fraction)
    whole="${px%%.*}"
    if [ "$whole" -lt 16 ] 2>/dev/null; then
      if ! echo "$sel" | grep -qiE "$EXEMPT_SEL"; then
        hit HIGH "$PAGE:$lineno" "font-size:${px}px on \`$sel\` — below the 16px reading-copy floor" "use var(--fs-body) (16.5px) or drop the override; sub-16px is reserved for mono/labels/meta/controls"
      fi
    fi
  done < <(echo "$decl" | grep -oiE 'font-size\s*:\s*[0-9.]+px' | grep -oE '[0-9.]+')
done < "$CSS_RULES"

# ---------------------------------------------------------------------------
# 11b. Time/effort estimate strings (MED) — presence only, per review-content-hygiene.md H3.
#      The invented-estimate-vs-real-fact judgment is review-accuracy.md Pass 3's call; this only
#      flags the DURATION pattern so it gets looked at. Clock/date facts (10:00, a date) are
#      filtered out; MED, so it never fails the build.
# ---------------------------------------------------------------------------
while IFS=: read -r lineno match; do
  [ -z "${lineno:-}" ] && continue
  hit MED "$PAGE:$lineno" "possible time/effort estimate (\"$match\")" "if it's an invented estimate, cut it (PRINCIPLES: no time/effort estimates); a real dated/clock fact is fine"
done < <(grep -noiP '\b~?\d+\s*(hrs?|hours?|mins?|minutes?|days?|wks?|weeks?)\b' "$PAGE" \
           | grep -viP 'href|#L[0-9]|blob/|[0-9]{1,2}:[0-9]{2}')

# ---------------------------------------------------------------------------
# 12. Decision re-representation / value-echo (design #2) — the control's own selected
#     state is the only confirmation; don't print the picked value back beside it. Bare
#     "recorded" is deliberately NOT grepped — it false-positives on ordinary prose ("as
#     recorded in the doc").
# ---------------------------------------------------------------------------
while IFS=: read -r lineno match; do
  [ -z "${lineno:-}" ] && continue
  hit HIGH "$PAGE:$lineno" "decision re-representation / value-echo (\"$match\")" "drop it — the control's own selected state (border/color) is the only confirmation; the one allowed aggregate is an outstanding-count in the submit bar"
done < <(grep -noiP 'data-status-for|✓\s*recorded|no choice yet|no verdict yet' "$PAGE")

# ---------------------------------------------------------------------------
# 13. Off-origin/CDN asset (design #8) — assets load same-origin from /assets/… only,
#     never an external CDN. Scoped to actual asset-loading tags (<link>/<script>/<img>),
#     NOT every href on the page: design #8's own scope is "Links /assets/base.css +
#     /assets/capture.js…", i.e. assets — a content <a href="http://…"> citation (e.g.
#     an fs-link .file cross-reference to another served document, or a real external
#     source link) is a different, legitimate thing and is deliberately not flagged here.
#     data: URIs (the inline favicon) never match — they don't start with "//" or
#     "http(s)://". A root-absolute /assets/base.css (single leading slash) doesn't
#     match either, by construction (the pattern requires a literal "//").
# ---------------------------------------------------------------------------
while IFS=: read -r lineno url; do
  [ -z "${lineno:-}" ] && continue
  hit HIGH "$PAGE:$lineno" "off-origin/CDN asset ($url)" "serve it same-origin from /assets/… instead (copy into \$SERVE_ROOT/assets/ per SKILL.md step 3) — no external CDN/http(s) asset URLs"
done < <(grep -noP '<(?:link|script|img)\b[^>]*?\b(?:src|href)\s*=\s*["'"'"']\K(?:https?:)?//[^"'"'"']*' "$PAGE")

# ---------------------------------------------------------------------------
# 14. Bare-in-body layout (design #15) — readable content must sit inside a max-width
#     container (normally <main class="wrap">), sibling to .page-header, or it renders
#     full-bleed at x=0 while the header stays inset. Accepts any element carrying a
#     "wrap" class token, not only <main> — a fully self-contained page (e.g.
#     board-template.html) may define its own local .wrap on a plain <div> without
#     loading base.css at all; that content is still properly contained, just not via
#     the <main> tag specifically. Bare-in-<body> (no wrap-classed ancestor anywhere) is
#     the actual bug this catches.
# ---------------------------------------------------------------------------
if grep -qiE '<section\b|<h2\b|class=["'"'"'][^"'"'"']*\b(card|callout)\b' "$PAGE"; then
  if ! grep -qiE '<(main|div)\b[^>]*class=["'"'"'][^"'"'"']*\bwrap\b' "$PAGE"; then
    hit HIGH "$PAGE:1" "readable content present but no wrap container (<main class=\"wrap\"> or equivalent)" 'wrap all body content in one <main class="wrap">, sibling to the header — content bare in <body>, or in a container with no max-width, renders full-bleed and misaligned'
  fi
fi

# ---------------------------------------------------------------------------
# 15. Capture wiring present AND uncommented (design #7/#12) — the commented-skeleton
#     silent-break. A page with real feedback controls (data-fb-id/data-verdict/
#     Capture.mark(…)) needs a REAL, uncommented Capture.init(...) and a REAL,
#     uncommented Capture.rollup(...), or the action bar never mounts / Submit can post
#     a null verdict. Greps scripts_uncommented.txt — every inline script's body with
#     /* */ and // comments already stripped by the node parse pass above — so a
#     left-over commented example (like the scaffold's) can never satisfy this. A page
#     with NO feedback controls at all — e.g. the bare scaffold, which ships that exact
#     skeleton fully commented-out on purpose, as a copy-me template — is exempt:
#     nothing is wired yet, so there is nothing to check.
# ---------------------------------------------------------------------------
if grep -qE 'data-fb-id|data-verdict|Capture\.mark\(' "$PAGE"; then
  UNCOMMENTED="$TMPDIR/scripts_uncommented.txt"
  if ! grep -q 'Capture\.init(' "$UNCOMMENTED"; then
    hit HIGH "$PAGE:1" "feedback controls present (data-fb-id/data-verdict/Capture.mark) but no UNCOMMENTED Capture.init(...) call" "wire a real Capture.init({view,total}) — a commented-out skeleton left as-is never mounts the action bar"
  fi
  if ! grep -q 'Capture\.rollup(' "$UNCOMMENTED"; then
    hit HIGH "$PAGE:1" "feedback controls present but no UNCOMMENTED Capture.rollup(...) call" "wire a real Capture.rollup(verdict) on every path, including default-accept, or Submit can POST a null verdict"
  fi
fi

# ---------------------------------------------------------------------------
# 16. Syntax check on every inline <script> (skips any tag with a src=
#     attribute). The check itself already ran in-process during the single
#     node parse pass above (vm.compileFunction, one call per script — no
#     per-script fork); this just reports what syntax_errors.tsv found.
# ---------------------------------------------------------------------------
while IFS=$'\t' read -r lineno jsfile summary; do
  [ -z "${lineno:-}" ] && continue
  hit HIGH "$PAGE:$lineno" "inline <script> fails syntax check: $summary" "fix the syntax error (temp copy: $jsfile)"
done < "$TMPDIR/syntax_errors.tsv"

# ---------------------------------------------------------------------------
echo "---"
echo "preflight-lint: $HIGH_COUNT HIGH, $MED_COUNT MED ($PAGE)"
[ "$HIGH_COUNT" -gt 0 ] && exit 1
exit 0
