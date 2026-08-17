# View: concept-explainer-sliders (bespoke capture)

Generation prompt for ONE view type. The reviewer's feedback is the *slider state itself*
— this view does **not** use the generic review rail. Its capture is bespoke: the human
sets the values, then commits them once.

Read `PRINCIPLES.md` + `_capture.md` first; this note is only this view's delta.

## When to use
A live, parameter-driven explainer where each `type="range"` slider drives an immediate
visual/numeric preview, and the agent needs the human to **commit an operating point** in
parameter space before it ships. Examples: tuning a content-ranking weight vector
(recency/relevance/diversity), an SIR epidemic model, a pricing/packaging tradeoff
explorer. Use it when the agent needs *a configuration the human chose*, not code to
review or a system to understand. Only use sliders when feedback is immediate — the
concept must repaint on every drag, or this pattern is unjustified.

## PRIMARY capture interaction — set the values, commit them once
The user drags sliders (and toggles any plain checkboxes that are part
of the configuration) until the live preview "feels right," then fires **one** deliberate
commit that records the full parameter vector **and which params they actually changed
vs. left at default**. Exploring is free: dragging repaints the preview but captures
nothing until commit.

Affordances (render these natively — and keep it minimal):
- **Draggable handles with a persistent value bubble** by each thumb; the thumb is the
  only cranberry-accented element on the slider (track stays a neutral border color).
- Any hand-styled `type="range"` (or custom input) that sets `outline:none` needs a
  visible `:focus-visible` ring on the thumb (a cranberry glow via `box-shadow`) — never
  strip focus without replacing it.
- **Live "Your configuration" readout** — **plain text**, not chips/pills/badges — listing
  the params that differ from default, repainting on every drag, proving state is being
  tracked.
- **One primary "Commit these values" button**. Clicking it records the current vector to
  Capture. The live readout above plus the committed button state ARE the confirmation —
  do not add a "Recorded N of M values" value-echo line (PRINCIPLES.md → "Never
  re-represent a decision"). The persistent capture bar is the single Submit; do not add a
  second submit button. If the commit sits in a callout, it carries no `.callout-label`
  (PRINCIPLES.md → Callouts).
- **One optional free-text note on the commit (escape hatch)** — "Add a note for Claude
  (optional) — anything the sliders can't say". A continuous-parameter view is not a fixed
  option set, but the human must never be *confined to the numbers*: a single
  commit-level note lets them say what the vector can't. Capture it on commit
  (`Capture.mark('…:note', { note }, { note })`, unmark when empty) and **exclude it from
  coverage** (`Capture.setCoverage`) so it never inflates engaged past the param count. One
  note for the whole commit, never a per-row note control.

Discoverability: sliders are already the web's "try me" signifier; the gap is signaling
that the SET state is *captured*. Close it with the live plain-text readout plus the
explicit commit — no instructions needed.

### Wiring to window.Capture
Map: one stable id per param; `value` is an object carrying the diff vs. the agent's
proposed default; coverage = the committed-changed set.

```js
Capture.init({ view: 'concept-explainer-sliders', total: PARAMS.length });

// Exploring is free — drag/toggle updates the preview + the plain-text readout, captures nothing.
PARAMS.forEach(p => p.el.addEventListener('input', renderReadout));

// ONE deliberate commit records the off-default params; defaults are unmarked.
commitBtn.addEventListener('click', () => {
  PARAMS.forEach(p => {
    const cur = p.kind === 'range' ? Number(p.el.value) : p.el.checked;
    if (cur === p.def) Capture.unmark(p.id);
    else Capture.mark(p.id, { value: cur, default: p.def, unit: p.unit }, { anchor: p.id });
  });
  Capture.rollup('commit');
  // The persistent capture bar's "Submit to Claude" sends the batch; show a plain confirmation here.
});
```

`Capture.submit()` (the persistent bar) POSTs once to `window.CAPTURE_SUBMIT_URL`; on
failure it copies a prompt-formatted fallback to the clipboard (file:// safe). "Copy as
prompt" is the only manual fallback — no per-slider network calls, no auto-submit on drag.

### What gets captured (`Capture.payload()`)
Touched params become `items`; untouched sliders stay un-engaged (their default is
already known to the agent), so coverage encodes the touched-vs-default split
unambiguously.

```json
{
  "view": "concept-explainer-sliders",
  "verdict": "commit",
  "items": [
    { "id": "recency",   "value": { "value": 0.6, "default": 0.8, "unit": "weight" },
      "reason": "lowered", "note": "evergreen posts survive", "anchor": "recency" },
    { "id": "relevance", "value": { "value": 0.9, "default": 0.7, "unit": "weight" },
      "reason": "raised",  "note": "", "anchor": "relevance" }
  ],
  "coverage": { "engaged": 2, "total": 4 }
}
```

## Anti-pattern to avoid
A working slider explorable with a generic free-text "Any feedback?" box bolted to the
bottom, divorced from slider state — it throws away the one thing this pattern uniquely
captures (coordinates in parameter space). Two corollaries: (a) **auto-submitting on every
drag** floods the agent with intermediate noise instead of one deliberate commit — explore
freely, commit once; (b) **capturing only the final vector and discarding the changed
set** reads a left-at-default value as a deliberate choice. Also avoid **pill/chip/badge
readouts** and **per-row note controls, "why" popovers, or decorative value pills** — they
pile decoration and complexity onto a reading view; use plain text and a single commit. Do
**not** drop this view onto the generic review rail — its commit gesture is bespoke.

## Alternate interactions (swap in when the underlying decision differs)
- **Constraint band (range handles).** When the agent is the optimizer and the human is
  setting guardrails, not a point: dual-thumb sliders (WAI-ARIA Slider Multi-Thumb) with a
  shaded fill, an optional "ideal" notch, and a per-row lock toggle (hard vs. soft).
  Capture per param as `Capture.mark(id, { min, max, ideal, hard:true }, { reason:'hard
  limit' })`, `Capture.rollup('set_guardrails')`. Use when a single point would
  over-constrain the agent.
- **Point annotation / calibration marker.** When the view *teaches a model* and the human
  is a domain expert flagging where it diverges from reality: drop a marker at a slider
  value and tag it (sweet-spot / surprising / disagree). Capture each marker under a
  coordinate-unique id `Capture.mark(param + '@' + value, { parameter, value, reaction },
  { note, anchor: param })`, plus the final resting config; `Capture.rollup('calibrate')`.
  Best for catching where the explainer teaches something the human knows is wrong.

## File/symbol references resolve via the ladder
Every file/function/parameter's source symbol named resolves per PRINCIPLES.md → Source
information; an unbuilt artifact is `.file.planned`.

## House style (this view)
The slider thumb is the only cranberry-accented element (`#8C3344`) — the track stays a
neutral border color; numeric value bubbles and config readouts render in IBM Plex Mono as
plain text, never chips/pills. Status colors only for genuine functional state. Flat,
sentence-case headings.
