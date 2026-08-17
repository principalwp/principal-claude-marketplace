# prototype-interaction-drag (mode: bespoke)

Generation prompt + capture contract for ONE view type. A future agent generating this view
must bake in feedback-capture exactly as specified here. Read `PRINCIPLES.md` + `_capture.md`
first — house style and the Capture API live there; this note is only the
prototype-interaction-drag delta. The moved-row delta is **plain text** (e.g. "moved #3 →
#1"), not a chip. Sentence-case headings.

**NO DnD library** (dnd-kit is React, and the model is vendored libs only). Implement drag
with native pointer events + a hand-rolled keyboard sensor.

**BESPOKE — does NOT use the generic verdict rail.** The arrangement surface *is* the capture
UI. **Reorder and confirm once:** the human drags rows, then the single prominent "Submit to
Claude" (capture.js bar) is the one confirm — routed through `Capture.submit()`. Do not add a
second confirm button.

## When to use

The agent proposed an arrangement in a clickable/visual prototype and the human's real
feedback is "this should be ordered differently." Use when the decision is a **single linear
sequence** — priority, ranking, step order, PR sequencing. This is the default, lowest-friction
arrangement decision a prototype review provokes. If the artifact is inherently categorical,
2D-spatial, or a graph, switch to an alternate (below) — do not force the human to flatten
that intent into a list.

## Primary capture interaction — Reorder & confirm with delta capture

Proposed items render as a **vertical sortable list**; the human drags rows into the order
they want, positions re-number live, and a single Confirm serializes the final order **plus
the move-delta against the agent's proposed order**. The load-bearing signal is the delta:
the agent already knows the order it proposed — what carries intent is *which of its
decisions the human overturned, and why*. Capturing only `finalOrder` and discarding
`proposedOrder` throws that away.

Affordances (keep to this minimum set — they are the discoverability):

- **Six-dot grab handle** `⠿` (U+283F, a glyph not an emoji) at the left of each row — the
  grabbability signifier and a safe drag target. Microcopy "Drag to reorder" is
  reinforcement, not the primary cue.
- `cursor: grab` on the handle → `grabbing` on pickup. On pickup the row **lifts** (shadow +
  slight elevation).
- A **drop-placeholder gap/insertion line** opens at the target index so the landing spot is
  visible before release; live re-numbering of the index positions.
- Moved rows get a subtle cranberry-tinted highlight and an **inline plain-text delta**
  ("moved #3 → #1") so the change is self-evident on screen — not a colored chip.
- A **live moved-count line** ("2 of 10 rows moved from the proposed order") plus a single
  **"Reset to proposed order"** button so experimentation is safe. No "Copy order" button —
  the capture.js "Copy as prompt" fallback already covers it.
- **Keyboard sensor (mandatory):** row is focusable; Space picks up, Arrow keys move, Space
  drops, Esc cancels. Announce state changes through an **ARIA live region** ("Picked up
  Verify email, position 2 of 4… moved to position 1"). Discoverability must not depend on a
  mouse.
- **Readable labels stay selectable:** the row is a `<div role="button" tabindex="0">` (or
  `<li>`) with a keydown (Enter/Space) handler, never a native `<button>` (PRINCIPLES.md →
  Buttons/controls). Real `<button>`s are for small fixed controls only (Reset to proposed
  order, etc.).

**Drop the excess.** Do NOT add per-row reason chips, per-move free-text notes, or an
expandable "why moved?" panel — that piles controls onto every row. Reorder + confirm is the
whole interaction; an optional overall note can ride on `rollup` if the human wants to
explain.

**Escape hatch** (PRINCIPLES.md): reordering itself is open-ended, so the list never traps the
human — but a closed set exposed elsewhere on this view still needs one. Any "Request
changes" / "Something's wrong here" escalation beyond plain reorder reveals a free-text
reason box on selection (`Capture` value + `note`/`reason`). In the bucket-sort alternate,
the named zones (Must / Should / Won't) are a closed set — include an **"Other / Unsure"**
zone so a card that fits none of them still has a home.

## What gets captured + JSON payload (via window.Capture)

`Capture.init({ view:'prototype-interaction-drag', total: N })` where `N` = number of
draggable items. Resting state = the proposed order (default-to-keep). On **Confirm**:

- Mark **every row** so coverage is unambiguous:
  `Capture.mark(id, { from: proposedIndex, to: finalIndex, moved: <bool> }, { anchor: stepId })`.
  `moved:false` rows are kept-as-proposed (their resting slot IS their "keep"); `moved:true`
  rows carry the `{ from, to }` delta. Marking all rows (vs leaving un-moved rows un-engaged)
  keeps the drag view consistent with the anim/svg views, where default-to-keep is recorded,
  not silent.
- Stamp the whole-arrangement context onto payload `meta`:
  `{ interaction:'reorder', itemType, proposedOrder:[...ids], finalOrder:[...ids] }`
  (`finalOrder` is fully determined by `proposedOrder` + moves; emit it explicitly for
  legibility).
- `Capture.rollup(verdict)` — `approve` (moved rows ride along in `items` as feedback and
  never change the verdict; only an explicit escalation to `request_changes` blocks — see
  escape hatch above).
- `Capture.submit()` → POST to `window.CAPTURE_SUBMIT_URL`; on failure the primitive copies a
  prompt-formatted fallback to clipboard.

`Capture.payload()` then reduces the bespoke shape onto the generic envelope:

```json
{
  "view": "prototype-interaction-drag",
  "verdict": "approve",
  "items": [
    { "id": "verify-email", "value": { "from": 1, "to": 0, "moved": true }, "reason": null,
      "note": null, "anchor": "step-verify-email" },
    { "id": "set-goal", "value": { "from": 0, "to": 2, "moved": true }, "reason": null, "note": null, "anchor": "step-set-goal" }
  ],
  "coverage": { "engaged": 2, "total": 4 },
  "meta": { "interaction": "reorder", "itemType": "onboarding_step",
            "proposedOrder": ["set-goal","verify-email","connect-bank","invite-team"],
            "finalOrder":    ["verify-email","connect-bank","set-goal","invite-team"] }
}
```
`changed` = `items.length > 0`. `moves` = the `items[]`. Stable-id anchoring: keys are the
agent-assigned item ids, never re-quoted row prose.

## Anti-patterns to avoid

1. A **static, read-only list beside a generic free-text box** ("tell us what order you
   want") — forces the human to TYPE an arrangement they could DRAG: slower, lossy, ambiguous
   to parse.
2. Capturing only `finalOrder` and dropping `proposedOrder` — discards the delta that tells
   the agent which choices were wrong.
3. Drag with no drop-target feedback, no Undo, and no keyboard path — imprecise, error-prone,
   excludes keyboard and screen-reader users. Also: don't bolt on the generic verdict rail —
   this interaction is bespoke.
4. Wrapping a row's readable label in a native `<button>` (see the grab-handle affordance
   above).

## Alternate interactions (switch when the decision shape changes)

- **Bucket-sort / closed card sort** — 2+ labeled drop zones (Must / Should / Won't; Keep /
  Cut; Now / Next / Later) **plus an "Other / Unsure" zone** so the closed set never traps a
  card that fits none (the escape-hatch rule above). Cards drag into a zone; intra-zone
  position = priority; live per-zone count badge; empty zones show ghost outlines.
  `mark(id, { from:'must', to:'should' })` per reclassified card; `meta`:
  `{ interaction:'bucket-sort', buckets:{must:[...],should:[...],wont:[...],other:[...]} }`.
  Use the moment categories are named (scope, severity) — when "order" alone loses the
  grouping signal.
- **Spatial canvas placement** — items snap to a grid (faint overlay during drag, alignment
  guides, corner resize handles, live cell readout, "Reset to proposed layout"). `mark(id, {
  col,row,w,h })` per moved/resized item; `meta`: `{ interaction:'spatial-place', grid:
  {cols,rows} }`. Higher friction; use only when 2D position carries meaning a list would
  discard (dashboard/page layout). (For relationship/graph edits — added/removed directed
  edges — use a `connect-flow` variant instead.)
