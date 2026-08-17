# three-code-approaches — generation prompt (mode: bespoke)

Generation reference for a view that presents 2–3 competing implementations of the **same**
function/unit and routes the human's choice through `window.Capture`. The human picks **one**
approach and sets a **disposition** for it — take it **as-is** (`Choose this`) or adopt it
**as a base to adapt** (`Use as base`) — and optionally comments on it. Read `PRINCIPLES.md`
+ `_capture.md` first — house style and the Capture API live there; this note is only the
three-code-approaches delta.

## When to use
The agent has generated several real, line-numbered implementations of one thing (e.g. A =
small synchronous, B = streaming with error handling, C = cached/memoized) and needs the
human to choose one — either as-is, or as a base to adapt with noted changes.
- Do NOT use for a single chosen path (that is an implementation-plan view).
- Render the actual code in each pane (mono, gutter line numbers) so the reader can judge.
- Each pane's code gets build-time syntax coloring (PRINCIPLES.md → "Build-time syntax
  highlighting"), never a runtime highlighter.

## Primary capture interaction
**Single-select across the approaches, with TWO genuinely-distinct actions per card, plus
one comment box revealed inside the selected card, plus an "Other / none of these" escape
below the cards.** No ranking, no multi-select, no blend, no graft, no veto — confusing and
low-value. `Choose this` and `Use as base` stay separate because they mean different things
(PRINCIPLES.md → "collapse redundant controls... meaning, not count").

Each approach renders as a card (real code in a `<pre>`, gutter line numbers, the pros and
cons as a plain `+`/`−` list — never colored pills). Default to **information-dense** per
approach — enough for the reviewer to decide without leaving the page (pros/cons, when-to-use
vs when-not, cost/risk/deps, whatever fits THIS choice; chosen dynamically, not a fixed
template — PRINCIPLES.md → "Depth"). At the foot of each card, **two distinct** buttons
(`.btn`, min-height 38px, label ≥15px), stacked:

- **`Choose this`** — adopt this approach **as-is**. → `Capture.mark(id, 'choose', { note })`.
- **`Use as base`** — adopt it as a **base to adapt** with the noted changes. →
  `Capture.mark(id, 'base', { note })`.

Selection is **single across all cards and both dispositions**: clicking either button on any
card deselects whatever was selected before (`Capture.unmark(prev)`), so exactly one approach
+ disposition is ever marked. Tapping the active button again clears the selection; clicking
the other disposition on the same card switches it in place. The selected card gets the
cranberry selected state and the active button flips to its selected state (`✓ Chosen` / `✓
Base to adapt`).

**When an approach is selected, a comment box appears inside that card** ("Notes for Claude
(optional)"), its placeholder prompting the change ("What would you change to use this as
your base? Leave blank to take it as-is."). Its text rides as the `note` on the mark. That is
the place to leave changes — there are no line-level note affordances and no separate graft
composer.

**Escape hatch** (PRINCIPLES.md — never trap the reader in a closed set): render an explicit
**"None of these — describe your own"** option below the three cards, **mutually exclusive**
with picking A/B/C — selecting it clears any A/B/C pick (`Capture.unmark(prev)`), reveals a
free-text box on selection, and captures as `Capture.mark('other','other', { note })`. This
is in addition to the per-card notes box, not a replacement for it: the per-card box adapts a
*chosen* approach, this one rejects all of them. The same progressive-disclosure rule governs
any other negative/changes-requesting control on the page (e.g. a companion module
overview's `Flag for review` reveals a short "why" box on selection).

The selected card's cranberry state and its button (`✓ Chosen` / `✓ Base to adapt`) ARE the
confirmation — do **not** add a separate plain-text decision line that re-echoes the chosen
value (PRINCIPLES.md → "Never re-represent a decision"). The delta vs the agent's
recommendation is captured in `meta` for the reading agent (below), not re-rendered as a
status line. The single **Submit to Claude** button and **Copy as prompt** fallback are the
capture.js action bar (re-themed by `base.css`) — do not build your own.

### Discoverability
The two per-card action buttons (`Choose this`, `Use as base`) and the `None of these` escape
are always visible and clearly clickable; selecting reveals the relevant comment box in
place. No hidden menus, no modes.

## What gets captured (via window.Capture)
`Capture.init({ view:'three-code-approaches', total:3 })` — `total` = number of approaches,
for coverage. Each approach is a markable element keyed by stable id `A`/`B`/`C` (never
re-quoted prose); the escape is keyed `other`. The mark's **value** is the disposition:
`'choose'` (as-is), `'base'` (adapt), or `'other'` (none of these). Because selection is
single, at most one of `A`/`B`/`C`/`other` is ever marked; the others read as
**acceptable-but-not-chosen** (default-to-keep), so silence is unambiguous. Include `other`
in the coverage set so picking it counts as engaging the decision.

Record the delta-vs-proposal baseline so the reading agent can tell "agreed with the
recommendation" from "overrode it":
```js
Capture.setMeta({
  approachProposal: { agent: 'C', label: 'approach 03 — per-ticket reused worktree' },
  approachDecision: { selected, disposition, note, agreesWithProposal, diff }
});
```

Verdict via `Capture.rollup(...)`: `Choose this` and `Use as base` both → `approve` (any note
rides along as feedback in `items` and never changes the verdict); `None of these` (`other`)
rejects all presented approaches and asks for a different one → `request_changes` — the one
blocking gesture this view exposes.

`Capture.payload()` for "Choose this on C, as-is":
```json
{
  "view": "three-code-approaches",
  "verdict": "approve",
  "items": [
    {"id":"C","value":"choose","note":null}
  ],
  "coverage": {"engaged":1,"total":3},
  "meta": {"approachProposal":{"agent":"C","label":"approach 03 — per-ticket reused worktree"}}
}
```
"None of these — describe your own" keeps the same shape with `verdict:"request_changes"` and
`items:[{"id":"other","value":"other","note":"none isolate well enough — use a per-ticket
bind-mounted overlay instead"}]`.

## Anti-patterns to avoid
- A single shared comment box under all three panes — it strips the link between the remark
  and the approach it concerns. Keep the comment **inside the selected card**.
- Redundant controls meaning the *same* thing worded differently — collapse those to one.
  `Choose this`/`Use as base` are the exception (see above): genuinely distinct dispositions,
  kept per PRINCIPLES.md's meaning-not-count test — do not collapse them back to one button.
- Multi-select, ranking (1/2/3), constant-sum blend sliders, line-level graft composers, or a
  dealbreaker/veto — low-value; do not add them.
- Decorative pills/badges (e.g. a "Recommended" chip) — present the agent's recommendation
  per PRINCIPLES.md's `.reco`/`(why)` pattern instead (`Recommended: approach 03`), never a
  pill.
- Eyebrow/kicker labels above the question (a glyph + `·` tag, "live status · …", "your
  decision ·") — banned; the `.callout-q` question + the controls stand alone.
- Wrapping a card's readable prose (taglines, pros/cons, descriptions) in a `<button>`
  (PRINCIPLES.md → Buttons/controls) — the card/row is a `<div>` (clickable via a handler or
  an inner control); only the small actions (`Choose this`, and a `Flag` where the view has
  one) are `<button>`s.

## Build conventions
`.btn .btn-secondary` for the resting `Choose this`, `Use as base`, and `None of these`
buttons, flipping to `.btn .btn-primary` (`.is-selected`) on the **active** button only. The
page sets `window.CAPTURE_SUBMIT_URL` before any `Capture.submit()`. Before hand-off, pass
the review panel (SKILL.md step 3.5 — `review-accuracy.md` + `review-sufficiency.md`, then
`review-design.md` + `review-content-hygiene.md`), fixing everything it flags.
