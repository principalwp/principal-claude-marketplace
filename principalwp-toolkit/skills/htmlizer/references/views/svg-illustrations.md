# svg-illustrations (bespoke) — generation prompt

Generate a review surface for a **set of agent-generated inline SVG illustrations** where the
human curates the set AND fixes off-palette assets in place. Read `PRINCIPLES.md` +
`_capture.md` first — house style and the Capture API live there; this note is only the
svg-illustrations delta. This view is **bespoke**: render its own canvas + swatch palette +
per-card disposition. Do **not** mount the generic feedback rail — the interaction is
direct-manipulation on the live vector DOM, which a rail cannot express. Light surfaces
only — the navy wordmark reads fine on the light card, so do not invert it into a dark card
band.

## When to use
A multi-asset SVG set (spot illustrations, icons, brand marks) where assets are fundamentally
good but ship in the model's default palette/weight and need brand alignment, and the set
still needs a keep/kill decision per asset. If the deliverable is pure motion/interaction, use
`prototype-animation.md`. If it's static tokens/variants with no per-asset fate to decide, use
`design-system.md`.

## PRIMARY capture interaction — single recolor + one keep/make-changes per asset
Two coupled affordances per card, both bespoke. Keep it to **one clear action per asset**: a
single recolor, plus a binary **Keep / Make changes** decision.

1. **Direct-manipulation recolor (the SVG-native move).** Each illustration is rendered as
   inline live SVG. Hovering highlights individual paths (outline + cursor change) — the
   signifier that the vector is editable and what distinguishes it from a raster preview.
   Clicking an element selects it (Figma-style direct selection) and opens a **brand-token
   swatch palette constrained to the design system** (navy, cranberry, steel-blue, navy inks,
   off-white, white). Picking a swatch re-renders the element in place instantly and appends a
   plain-text row to a visible **fill map** (`source hex → token`). A single whole-asset
   **Revert colors** link keeps it safe. Constrain to preset swatches — **never a freeform
   color wheel** (off-system hexes the agent then has to reconcile). **Drop the stroke-width
   stepper and per-element reset** — single recolor is the move; those are excess controls.
2. **Per-asset decision (the spine).** Every card carries a **single-select, two-state
   control — Keep · Make changes** (cranberry selected state; **never multi-select**). Keep
   is the default resting state. The recorded disposition is derived: Make changes →
   `request_changes`; Keep with recolor edits → `approve_with_edits` (auto, the moment an
   edit is made); Keep clean → `approve`. **Escape hatch** (PRINCIPLES.md): Make changes is a
   negative control, so selecting it reveals a `<textarea>` (placeholder "What is wrong /
   what to change?") for what to change; the note rides on `Capture` (value + `note`) and
   stays optional unless a flag gates submit. This is also the escape from the *deliberately
   closed* swatch palette: when the human wants a color the tokens don't offer, Make changes
   → reason box is where they say so. **Drop the Favorite star and the multi-select
   reason-chip set** — pill clutter and (chips) a multi-select violation.

**Discoverability:** first card focused with its Keep / Make changes control already visible
and labeled (not behind a kebab). Hovering any illustration highlights its vector elements,
silently advertising editability. The shared capture.js bar shows triage progress and the
**Submit to Claude** button; **Copy as prompt** sits beside it as the only fallback. Optional:
left/right arrow keys move focus between cards for keyboard users.

**Readable labels stay selectable** (PRINCIPLES.md → Buttons/controls): the asset card is a
focusable `<div tabindex="0">` (the arrow-key focus target above), never a native `<button>`.
Native `<button>`s are for the small in-card controls only (Keep, Make changes, swatch chips,
Revert, Download).

## What gets captured (via window.Capture)
- `Capture.init({ view:'svg-illustrations', total: <assetCount> })` once on load — `total` is
  the number of asset cards present, for coverage.
- One `Capture.mark(assetId, value, opts)` **per asset**, where `assetId` is the stable card
  id (e.g. `spot-rocket`), `value` carries the derived disposition + the recolor edits, and
  `opts.note` holds the optional line (only when Make changes is selected). Marking engages
  the asset for coverage. Re-mark on every change. Pre-mark every card Keep on load so
  coverage is complete from the start.
- `Capture.rollup(verdict)` — single set-level verdict: `approve` | `request_changes`. This
  view has no whole-set decline control, so per-asset Make changes and recolor edits are
  FEEDBACK that ride along in `items` (each item's own `value.disposition` still records
  `request_changes` / `approve_with_edits` / `approve` per asset) — the set-level rollup is
  always `approve`.
- `Capture.onChange(cb)` drives the live "N of M decided" counter.
- `Capture.submit()` after setting `window.CAPTURE_SUBMIT_URL` — one batched atomic POST. No
  per-element network calls; recolor edits accumulate locally as pending.

`Capture.payload()` shape (the `value`/`reason`/`note` carried per item):
```json
{
  "view": "svg-illustrations",
  "verdict": "approve",
  "items": [
    { "id": "spot-rocket",
      "value": { "disposition": "approve_with_edits",
                 "edits": [
                   { "target": "#path-3", "property": "fill",
                     "from": "#3B82F6", "to": "token:brand.cranberry", "toHex": "#8C3344" },
                   { "target": "[data-part=outline]", "property": "stroke-width",
                     "from": "2", "to": "1.5" }
                 ] },
      "reason": null, "note": null },
    { "id": "spot-globe",
      "value": { "disposition": "request_changes", "edits": [] },
      "reason": null, "note": "concept fine, execution busy" },
    { "id": "spot-chart",
      "value": { "disposition": "approve" }, "reason": null, "note": null }
  ],
  "coverage": { "engaged": 3, "total": 8 },
  "meta": { }
}
```
Each edit is **machine-replayable**: which element (id/selector/path index), which property,
the original value, and the chosen brand token with resolved hex — never prose like "make it
on-brand".

## Anti-pattern to avoid
A single free-text "What do you think of these?" box under the grid (or one per card). It
collapses per-asset attribution, yields un-replayable prose ("make them more on-brand"), and
squanders the one thing SVG uniquely offers — directly addressable, editable vector elements.
Equally bad: forcing a whole-asset **Make changes** when only one region is wrong rather than
letting the human recolor that region in place (throws away good work, gives the agent no
locality), and a **freeform color wheel** instead of constrained brand tokens.

## Alternate interactions (use only if the case demands)
- **Pin annotation (coordinate-anchored redraw).** When most of an asset is right but one
  region is wrong (a flame that reads as a leaf). Click to drop a numbered pin storing
  **viewBox-normalized** x/y (survives scaling) with a constrained action verb
  (`redraw`/`remove`/`simplify`/`move`) and a short comment. The verb set is closed, so
  include an **"Other…"** verb that reveals the comment box as the required free-text (the
  escape-hatch rule) — never force a wrong verb. Carry as
  `value.pins:[{x,y,coordSpace:'viewBox-normalized',action,comment}]` under a
  `request_changes` disposition. Anchor by normalized coordinate, never re-quoted prose.
- **Set-level harmonization (batch token map + winner pick).** When the set is variants of
  one concept or batch consistency matters more than per-asset nuance: a control bar above
  the grid maps each detected source color → brand token, a global stroke-weight slider, a
  filled/outline toggle, and a single "winner" radio across variant cards, all previewing
  live across every card. Record set-level transform in `meta` (`paletteMap`, `strokeWidth`,
  `style`, `winner`); per-asset dispositions still mark each card so coverage stays complete.

## Brand + build constraints
Principal WP tokens only: swatch palette is the brand token set, ink outlines use navy.
Sentence-case headings, flat, cranberry primary + underlined text-link secondary.
