# View: data-chart-review (bespoke capture)

Generation prompt for reviewing **analysis output** — tables and charts the agent produced
— where the human sanity-checks the numbers: flag a whole row or series, or question a
single figure. Read `PRINCIPLES.md` + `_capture.md` first; this note is only this view's
delta.

## When to use
The deliverable is a **result of analysis**: one or more data tables and/or charts (a
breakdown by month, a metric over time, a distribution), and the human's job is to check it
before the agent acts on it — spotting a row that looks wrong, a series that's off, or a
single number that doesn't add up.
- NOT tuning parameters to *produce* a number — that is `editor-feature-flags.md` /
  `concept-explainer-sliders.md`.
- NOT a document with prose sections — that is `doc-review.md`.
- NOT competing options to choose between — that is `compare-and-flip.md` /
  `three-code-approaches.md`.

## Charts are SELF-CONTAINED — no chart library, ever
Every chart is rendered **inline** — hand-built **SVG** (`<rect>`/`<line>`/`<circle>`/`<path>`
+ `<text>` axes) or **simple HTML/CSS bars** (a `<div>` per bar sized by width/height). **No
external charting library and no CDN** (PRINCIPLES.md → Self-contained constraint) — no
Chart.js, Recharts, Plotly, or d3-from-a-CDN. This is not negotiable; a page that `<script
src>`s a chart lib is a build defect.

- **Palette is functional and restrained.** Distinguishing data series is functional (like
  diff add/del tints), not decoration — but keep it to a **small** set drawn from the house
  ramp: the navy/ink scale for series, the single cranberry accent for the one series in
  focus or the highlighted point, `--success`/`--warning`/`--error` only where a value has
  genuine functional state. No rainbow. When building the marks, the `dataviz` skill's
  method for categorical palettes and axes is a good reference — but the **self-contained +
  house-color rules here win** over anything it suggests that needs a lib or a wider
  palette.
- **Charts and tables are full-bleed-capable but their labels align to the header** — a wide
  chart may span the measure, but axis text and controls sit in `.wrap` (or the chart's own
  centered inner container), per PRINCIPLES.md → Page layout. A wide table scrolls inside
  its own `overflow-x:auto` container; the page body never scrolls sideways.
- htmlizer pages are **light only** (no dark mode — that is the separate Artifact tool), so
  design the one light palette; do not add `prefers-color-scheme` blocks.

## Two capture granularities — per-element, over stable ids
The value is surfacing the few elements that look wrong, so this is a **default-accept**
surface with two markable element kinds. Both route through `window.Capture`.

1. **Flag a row or a series (the primary unit).** Each **table row** and each **chart
   series** carries a **Make changes** control (`.btn .btn-secondary .btn-sm`,
   PRINCIPLES.md → the "Make changes" label rule). Default = accepted; resting needs no
   click. Selecting it reveals a **required** reason box (the escape hatch —
   `.reveal`/`.reveal-box`): "what's wrong with this row / series". Placement follows the
   compact-row rule — at the **trailing end of the row** (table) or **beside the series'
   legend entry** (chart), out of any title slot, never top-right (PRINCIPLES.md →
   Interactions). → `Capture.mark(rowOrSeriesId, 'flag', { reason })`.
2. **Question a specific number (the deeper, progressively-disclosed layer).** A single
   **table cell** or **chart data point** can be questioned in place — the code-review
   inline comment idiom. Hovering a cell / point reveals a small **"?"** affordance;
   clicking it anchors a **required** note box to that figure ("what looks off about this
   number"). → `Capture.mark(cellOrPointId, 'question', { note, anchor })`, where `anchor`
   locates the figure (`{ table, row, col }` or `{ series, x }`). These are **extra
   items**, not counted toward `total` (like code-review's inline comments).

Table cells, axis labels, and series names stay plain selectable text, never a `<button>`
(PRINCIPLES.md → Buttons/controls); only the Make-changes and "?" controls are buttons.

## Verdict — DERIVED, never a manual button
No standalone verdict control (PRINCIPLES.md → "No standalone overall verdict"). Two
values, computed on every `Capture.onChange`, set via `Capture.rollup(...)`:
- **any row/series flagged OR any number questioned → `request_changes`** (the reviewer is
  telling the agent not to take the analysis as final); otherwise → `approve`. A questioned
  figure is a change request (verify/fix it), same as a flag — both derive
  request_changes. Untouched output submits as `approve`.

## Capture (via window.Capture)
`total` = the count of primary flaggable units (**rows + series**); questioned cells/points
are extra items not counted against `total`, so use `setCoverage` to keep `engaged` to the
primary units. Stable ids name the element (`revenue-by-month:row-mar`,
`chart-signups:series-actual`, `revenue-by-month:mar:net`,
`chart-signups:series-actual:x-mar`) — never re-quoted prose.

```js
Capture.init({ view: 'data-chart-review', total: ROW_COUNT + SERIES_COUNT });
Capture.setCoverage(function (id, rec) { return rec.value === 'flag'; });   // only row/series flags count toward engaged

// flag a whole row or series (required reason)
Capture.mark('revenue-by-month:row-mar', 'flag', { reason: 'March net is negative — refund batch double-counted?' });
Capture.mark('chart-signups:series-actual', 'flag', { reason: 'Actual line flat after May — data feed likely stalled.' });

// question one specific figure (required note + anchor)
Capture.mark('revenue-by-month:mar:net', 'question',
  { note: 'This should be ~$40k given gross above it.', anchor: { table: 'revenue-by-month', row: 'mar', col: 'net' } });

Capture.unmark('revenue-by-month:row-mar');   // un-flag → back to accepted

Capture.onChange(function () {
  const flagged = Capture.payload().items.length > 0;   // any flag or question present
  Capture.rollup(flagged ? 'request_changes' : 'approve');
});
Capture.submit();   // POSTs Capture.payload() once to window.CAPTURE_SUBMIT_URL (gated)
```

`Capture.payload()` wraps these marks in the standard envelope (`_capture.md` → API). The
`anchor` lets the agent land on the exact figure without re-parsing the page; `engaged`
counts only the row/series flags, so coverage reads as "1 of 9 primary units flagged" even
with a questioned figure also present in `items`.

## Gating (use Capture.setGate — do not override Capture.submit)
Block Submit while a **flagged row/series** or a **questioned number** has an empty box.
Each branch returns a `focus` target so clicking Submit scrolls to and flashes the empty
box (top-of-page first — flagged rows/series before questioned cells, matching reading
order).

```js
Capture.setGate(function () {
  const noReason = firstFlagWithEmptyReason();     // DOM read only
  if (noReason)  return { ok:false, reason:'Add a reason to each flagged row / series.', focus:noReason };
  const noNote  = firstQuestionWithEmptyNote();
  if (noNote)    return { ok:false, reason:'Say what looks off about each questioned number.', focus:noNote };
  return { ok:true };
});
```
Keep the gate a pure read; the writer that calls `Capture.mark` / `rollup` is wired to the
controls' handlers (`_capture.md` → Submit gating).

## Real data only, references resolve
Render the **real** analysis output — never mock rows or a placeholder chart
(PRINCIPLES.md → "Feedback plumbing", the "keep real content; no mock data" rule). If a figure
was computed from a source the reviewer might want (a query, a sheet, a file), link it per
PRINCIPLES.md → "References and evidence" (`.file` + SHA-pinned blob, or the real URL). No invented totals to fill a
gap.

## Anti-patterns to avoid
- A CDN / npm charting library, or a chart image pulled from an external host — inline SVG
  or HTML/CSS bars only.
- A single free-text "any issues with the numbers?" box + Submit — it discards which
  row/series/figure is wrong and forces the agent to re-locate it. Per-element marks with
  anchors carry that for free.
- A manual Approve / Request-changes button — the verdict derives from the flags and
  questions.
- Decorative multi-color palettes, a "Recommended"/status pill on a series, per-cell
  verdict rails, a "recompute" button, CSV/copy export buttons, multi-select reason chips —
  clutter this view does not use.
- Wrapping table cells, axis labels, or series names in `<button>`s (blocks selection);
  only the small Make-changes and "?" controls are buttons.

## Before hand-off
Verify every markable element has **exactly one** stable id and the anchors resolve to a
real cell/point. Pass the review panel before hand-off (SKILL.md step 3.5) and fix
everything it flags.
