# View: compare-and-flip (mode: bespoke)

Generation prompt for a **two-option comparison** with a layout **flip toggle at the top**:
the reader flips the same two options between a **side-by-side** layout and an **overlaid
before/after** view, then makes **one** decision — which option they prefer — through
`window.Capture`. Read `PRINCIPLES.md` + `_capture.md` first; this note is only the
compare-and-flip delta. (This shape matches a mockup the owner approved.)

## When to use
Exactly **two** things to weigh head to head where seeing them *overlaid* — not just next
to each other — changes the judgement: two design revisions, before/after of a refactor,
v1 vs v2 of a layout, an old copy block vs a rewrite. The flip earns its place when an
overlay reveals a difference the side-by-side hides (a shifted baseline, a changed number,
a moved element).
- Three or more candidates → `three-code-approaches.md` (or the Yes/Maybe/Skip board).
- Two *code* implementations to choose between → `three-code-approaches.md` (used with
  two).
- Picking one variant AND tuning its tokens → `component-variants.md`.
- If an overlay adds nothing (the two are unrelated, not two states of one thing), don't
  fake the flip — use a plain side-by-side view.

## Layout — flip toggle on top, decision with the evidence
Order: `.page-header` (h1 + one lede line naming the two options and the call to make), the
**flip toggle**, then the compare surface holding both options, then the escape hatch below
it, then capture.js's Submit bar.

- **The flip toggle is a view-mode control, at the very top of the compare surface** — a
  two-option segmented control (`.btn`/tab pair, `aria-pressed`/`aria-selected`): **Side by
  side | One at a time**. It is **not a decision** — it changes how the evidence is
  displayed, not what the reader chooses. Do **not** mark it through Capture, do **not**
  count it in coverage, and it carries no `.callout-label`.
- **The pick lives WITH the evidence, not above it.** Each option panel carries its own
  **Prefer this** control (like `three-code-approaches.md`) rather than a standalone
  verdict rail: the per-panel pick satisfies PRINCIPLES.md's "decision at the top of its
  view" without a separate global control ("No standalone overall verdict").

### The two layout modes share ONE DOM
Render each option **once**; the flip toggles a **layout class** on the compare container
(`.cmp.is-sidebyside` / `.cmp.is-overlay`), CSS does the rest. Never re-parent or
re-render on flip — the reader's pick and any typed note **must persist across flips**, so
the panels and their controls are the same elements in both modes.

- **Side by side** — two equal columns (CSS grid; stack to one column below ~700px). Each
  column is one option panel: a heading (the option's own name — "v1" / "v2", "Before" /
  "After", or the real labels), the rendered content, an information-dense **what-differs**
  summary (`PRINCIPLES.md` → Depth — the tradeoffs that let the reader decide without
  leaving the page, chosen dynamically), and the panel's **Prefer this** control at the
  bottom.
- **Overlay** — the two panels stacked in the same box so the reader sees the change in
  place. Pick the overlay mechanism that fits the artifact, all **self-contained** (inline
  SVG / HTML / CSS, no libs):
  - **Rendered visuals** (an image, a mock, an SVG): a **wipe slider** — both panels
    absolutely positioned in the box, a `range` input drives a `clip-path` on the top panel
    so dragging wipes between before and after. Label the two edges.
  - **Text / code / config**: a **swap toggle** inside the overlay (A / B) that shows one
    at a time in the same frame, so differences register as the block changes under the
    eye; or a stacked diff-style before→after if the change is line-level.
  Whichever you use, the **Prefer this** controls stay visible in overlay mode too — the
  reader can decide from either layout.

## Primary capture interaction — single pick + Other…
Single-select across the two options, one optional note on the chosen one, one escape
hatch below — modeled on `three-code-approaches.md`.

- Each panel's **Prefer this** button (`.btn .btn-secondary`, flipping to `.btn-primary
  .is-selected` when active). Selecting one **deselects the other** (`Capture.unmark(prev)`)
  and gives its panel the `.card.is-selected` cranberry state, so exactly one is ever
  marked. Tapping the active button again clears the pick. →
  `Capture.mark(optionId, 'prefer', { note })`.
- **When a panel is selected, a note box appears inside it** ("Notes for Claude (optional)")
  whose text rides as the mark's `note` — the place to say *why*, or what to carry over
  from the other option. Reveal on selection, not always-on (`.reveal`/`.reveal-box`).
- **Escape hatch — the two options are a closed set, so add an explicit "Other — neither"**
  below the panels (PRINCIPLES.md → escape hatch). Selecting it clears any A/B pick
  (`Capture.unmark(prev)`), reveals a free-text box ("describe what should ship instead"),
  and captures as `Capture.mark('other','other',{ note })`. It shares single-select with
  the panel picks. Give its container trailing `margin-bottom` so it never crowds the
  Submit bar in either state, and use the box outline color (`--border-strong`).

The selected panel's cranberry state and its `✓ Preferred` button ARE the confirmation —
don't add a plain-text line echoing the choice (PRINCIPLES.md → "Never re-represent a
decision"). Submit + Copy as prompt are capture.js's bar (re-themed by `base.css`) — do not
build your own.

## Capture (via window.Capture)
`total: 2` — the two options are the coverage units; `other` is included so picking it
counts as engaging the decision. Stable ids are the option ids (`v1`/`v2`, `before`/
`after`), never re-quoted prose. Record the agent's leaning as the starting point, so
agreement vs override is legible:

```js
Capture.init({ view: 'compare-and-flip', total: 2 });
Capture.setMeta({ compareProposal: { agent: 'after', label: 'After — the rewrite' } });

// single-select: clicking either panel's Prefer this, or Other, clears the previous pick
Capture.mark('after', 'prefer', { note: 'Cleaner, but keep v1’s error copy.' });
// Capture.mark('other', 'other', { note: 'Neither — combine v1 layout with v2 spacing.' });

Capture.onChange(function () {
  // prefer A or B → approve; Other (neither) → request_changes (the one blocking gesture)
  Capture.rollup(picked === 'other' ? 'request_changes' : 'approve');
});
Capture.submit();   // POSTs Capture.payload() once to window.CAPTURE_SUBMIT_URL (gated)
```

`Capture.payload()` wraps these marks in the standard envelope (`_capture.md` → API): a
preferred option submits `verdict:'approve'` with that option's id and note in `items`;
"Other — neither" submits `verdict:'request_changes'` with `id:'other'` instead.

## Verdict & gate
Verdict is DERIVED (recompute on every `Capture.onChange`, never a manual button): a pick
of either option → `approve` (the note rides along as feedback); **Other — neither** →
`request_changes` (the whole set declined). The pick is the one decision, so it **is
required** — `Capture.setGate` blocks Submit until something is chosen, and until a picked
**Other** (or a per-panel note that gates, if you make it required — by default it does
not) has text:

```js
Capture.setGate(function () {
  if (!picked)                          return { ok:false, reason:'Pick an option or choose Neither.', focus:'#compare-decision' };
  if (picked === 'other' && !otherText) return { ok:false, reason:'Describe what should ship instead.', focus:'#other-box' };
  return { ok:true };
});
```
Order branches top-of-page first; the gate flashes the first `ok:false` (`_capture.md` →
Submit gating). Keep the gate a pure read.

## Anti-patterns to avoid
- Making the **flip toggle** a captured decision, or counting it in coverage — it is a view
  mode, not a choice.
- A single shared comment box under both panels — it strips the link between the remark and
  the option. Keep the note **inside the selected panel**.
- Multi-select, ranking, a "both / tie" option, or a per-dimension A/tie/B matrix
  (PRINCIPLES.md → Interactions: never multi-select, never rank). "Neither" is the escape
  hatch, not a third rank.
- Re-rendering or re-parenting the panels on flip (loses the pick and the typed note). One
  DOM, a layout class.
- A "Recommended" pill on a panel — present the agent's leaning as a `.reco` line ending in
  a `(why)` popover instead (PRINCIPLES.md → Recommendations, rationale & read-more).
- Wrapping a panel's readable content in a `<button>` — it blocks selection and feels
  draggable. The panel is a `<div>`; only **Prefer this** / **Other** / the flip toggle are
  `<button>`s.
- A CDN chart/image/diff library for the overlay — it must be inline SVG / HTML / CSS
  (PRINCIPLES.md → Self-contained constraint).

## Before hand-off
Confirm the pick and note **survive a flip** (flip side-by-side ↔ overlay after selecting;
the selection must hold). Pass the review panel before hand-off (SKILL.md step 3.5) and
fix everything it flags.
