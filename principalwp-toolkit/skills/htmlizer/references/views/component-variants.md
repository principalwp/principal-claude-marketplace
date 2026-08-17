# component-variants — Select-and-Tune (bespoke)

Generation prompt for a `component-variants` view with feedback-capture baked in. Bespoke
— this view does NOT use the generic feedback rail. Its capture surface IS the variant
grid: the cards are selectable and their tokens are tunable, so the submitted JSON is the
decision, not a description of it.

Read `PRINCIPLES.md` + `_capture.md` first; this note is only this view's delta. (No
bundled example.)

## When to use
The agent rendered the **same component as N token treatments** (e.g. Button as
primary / secondary / ghost, each with its own color, radius, elevation tokens) and the
real decision is *"which treatment ships, and with exactly what values"* — not "I like
the middle one". Pick one winner AND nudge a couple of its tokens before committing.
- One agent-recommended default among the set → Select-and-Tune (this view).
- Exactly two polished finalists where reasoning per axis matters → lead with **A/B
  compare** (alternate 1).
- 4+ rough candidates, goal is to cut the field → use the Yes/Maybe/Skip triage board
  instead of this view (Shape B in SKILL.md) — dispositioning every card against a grid
  is exactly what this view's own closing rule below forbids.

## Primary capture interaction — Select-and-Tune
Each variant is a **selectable card with radio semantics** showing the live component.
The agent pre-flags one card as its recommendation (the proposal). Selecting a card
promotes it (selected-ring + lift) and reveals an **inline token panel on that card
only** — Tweakpane/Leva idiom — bound to the component's CSS custom properties: labeled
swatch pickers, numeric sliders/steppers for radius/spacing/border, a font-size stepper.
Edits mutate the variant's `--tokens` in real time, so the human tunes the live
component, not a guess. Every override row has a **"reset to variant default"** link so
the delta stays honest.

The recommendation renders as a `.reco` line (e.g. "Recommended: Balanced") per
PRINCIPLES.md → Recommendations, rationale & read-more — never a pill. The pre-flagged
card's selected state is the confirmation of the pick; do not add a separate
"recorded"/value-echo status line (PRINCIPLES.md → "Never re-represent a decision"). If
the pick or any decision sits in a callout, it carries no `.callout-label` (PRINCIPLES.md
→ Callouts).

The selected card uses `base.css`'s `.card.is-selected` (cranberry border + faint wash);
the pick control is a plain radio with a visible label, not a corner dot. Keep the tune
panel to the genuinely useful knobs (padding/radius sliders, border-weight and accent as
single-select radio groups, one "Reset to preset" link) — **do not** add a separate
"resolved CSS" readout or a "Copy CSS" button; the resolved set is already in the payload,
and fewer buttons is the rule.

**Escape hatch.** The pick radiogroup carries one extra option, **"Other — none of these"**,
revealing a free-text box on selection (PRINCIPLES.md → escape hatch). It shares the pick
radio's name: selecting it clears any variant pick and vice versa; re-tapping it reverts to
the recommendation. Capture on the same `cv:pick` item with `picked:'other'` and the text
in `note`; rolls up as `request_changes`. The tune panel's own sub-radios (border weight,
accent) don't need their own `Other…` — the sliders already give continuous range, and the
pick-level `Other…` covers "none of these."

Discoverability (no instructional preamble — controls follow standard form affordances):
- Radio + label in each card = "pick me"; hover state on the card = it's selectable.
- Selected card gets the cranberry selected state and reveals sliders/steppers with
  visible thumbs and numeric readouts = "drag/click to change".
- The shared **Submit to Claude** bar (injected by `capture.js`, themed light by
  `base.css`) carries the one batched submit + the **Copy as prompt** fallback. A short
  plain-text `.tag` tally states live status (`Picked Balanced · 2 tokens tuned`).

## Exactly what gets captured
The winning variant id, the precise token edits as **from→to deltas** (so intent is
legible and the agent won't relitigate), AND the full resolved token set for the winner.
The agent's recommended variant is the baseline: a different pick or a tuned value is
recorded as what changed against it.

## Wiring to window.Capture
```js
Capture.init({ view: 'component-variants', total: N });   // N = variant cards present
Capture.setMeta({ component: 'Button', recommended: 'primary' }); // proposal baseline

// Rung 1 — pick the winner (radio: exactly one marked 'win')
function pick(variantId){
  prevWinner && Capture.unmark(prevWinner);               // radio: revert the old pick
  prevWinner = variantId;
  Capture.mark(variantId, { pick:'win', overrides:[], resolved: defaults[variantId] },
               { anchor: variantId });
  Capture.rollup('approve');                              // recommendation taken, untouched
}

// Rung 2 — tune a token on the winner (called on each slider/swatch change)
function tune(variantId, token, from, to){
  const v = current(variantId);                           // the marked value object
  upsert(v.overrides, { token, from, to });               // from→to delta
  v.resolved[token] = to;                                 // resolved final set
  Capture.mark(variantId, v, { anchor: variantId });      // re-mark with updated value
  Capture.rollup('approve');   // tuning a token is feedback — the verdict stays approve
}
// CAPTURE_SUBMIT_URL is set by the page; one batched atomic submit:
submitBtn.onclick = () => Capture.submit();
```
`Capture.payload()` then yields the decision (the bespoke `chosen / overrides / resolved`
live inside the single winner item + `meta`):
```json
{ "view":"component-variants", "verdict":"approve",
  "meta":{ "component":"Button", "recommended":"primary" },
  "items":[ { "id":"ghost", "anchor":"ghost",
    "value":{ "pick":"win",
      "overrides":[ {"token":"--btn-radius","from":"8px","to":"6px"},
                    {"token":"--btn-border","from":"1px","to":"1.5px"} ],
      "resolved":{ "--btn-bg":"transparent","--btn-fg":"#1f2933",
                   "--btn-radius":"6px","--btn-border":"1.5px" } } } ],
  "coverage":{ "engaged":1, "total":3 } }
```

## Anti-pattern (do not ship)
A single free-text "What do you think of these variants?" textarea, or a row of 1–5 star
ratings, beneath the grid with a generic Submit. It discards the two things that matter —
which variant id won and the exact token values to ship — forcing the agent to parse
prose ("the middle one but maybe a bit rounder") and guess numbers it could have captured
precisely. Stars rank without resolving values; a comment box captures sentiment without
structure. Make the variants themselves the input surface.

## Alternate interaction (single-winner only)
**Pairwise A/B compare** — late stage, exactly two finalists, dark/parity not at issue.
Pin two into a side-by-side frame and let the human pick **one** overall winner (single
radio), with an optional one-line reason. `Capture.mark('winner','design-a',{note})`,
`Capture.rollup('approve')`. Use only when the decision really is one-of-two; otherwise
lead with Select-and-Tune.

**Banned here** (PRINCIPLES.md → Interactions: never multi-select, never rank): a "matrix
triage" that dispositions every card, per-dimension A/tie/B voting that ranks axes, star
ratings, or a separate "Lock values / Copy CSS" export button. A human picks **one**
variant; the resolved token set is already captured in that one item.
