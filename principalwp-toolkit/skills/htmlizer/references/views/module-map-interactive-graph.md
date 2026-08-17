# module-map-interactive-graph (bespoke capture)

Generation prompt for ONE view: a module/dependency overview of an unfamiliar service
whose feedback is captured element-natively. The human's job is to read what each module
does and flag the ones Claude should look at. Read `PRINCIPLES.md` + `_capture.md` first —
house style and the Capture API live there.

## Honesty about the topology (read this first)
Before choosing a node-link graph, verify the actual call structure against the source.
These overviews are usually hand-derived from reading the file's top-level declarations
and call sites — say so; label the view plainly as a *hand-derived overview, not a full
static call graph.*

A very common shape is a **star**: one entry point (`main`, a router, an `index`) calls
almost everything, few other edges. A node-link diagram of a star just "points at one box"
and isn't reviewable. **When the structure is a star (or otherwise low-signal), do NOT
render an interactive node-link graph — render a readable grouped list instead**, grouped
by role. Only reach for the interactive graph when the topology genuinely carries
reviewable structure (real clusters, cross-cutting edges, cycles) that a list would hide.

## When to use
The human's first job is to route the agent's attention across the modules — flag a god
module, a confusing function, a suspicious dependency — before any refactor plan is
written. If there's exactly one chosen path with no structure to judge, use
`implementation-plan.md`; if comparing 2-3 build approaches, use the three-code-approaches
view.

## Primary capture interaction
ONE interaction: click a module to see its detail, then optionally flag it with a
comment. Do NOT add edge verdicts, lasso/marquee subgraph grouping, an expand/collapse
frontier, or a multi-chip verdict palette.

Default rendering — a **grouped list** (the star fallback, and the usual choice):
- Group modules by role (e.g. main flow, worktree lifecycle, prompt builder, Jira I/O,
  state machine, imports, spawned processes) — a plain group heading + count.
- Each row: module name (mono), `file:line` (mono, muted), one-line description. Rows are
  clickable `<div role="button">`s (tabindex + Enter/Space keydown), not `<button>`s — the
  text must stay selectable. Obvious hover state, pointer cursor, single-select.
- The whole row is the affordance — clicking anywhere selects it (cranberry state) and
  opens its detail + comment box. No separate "+ flag" control or resting flag chrome on
  the row.
- The detail fills a sticky panel: full description, `Calls →` and `Called by ←` lists
  (each a text link that selects that module), a `file:line` copy, a **`Flag for review`**
  toggle, and a comment box ("Comment for Claude (optional)").
- Selection is single. Flags are per-module and persist. A row shows no flag marker until
  flagged; once flagged it reads plain-text **`Flagged ✓`** (cranberry).

Optional graph rendering — only when the topology is genuinely worth it: the **vendored**
`vendor/mermaid.min.js` + `vendor/svg-pan-zoom.min.js` (no CDN), copied into the shared
`/assets/vendor/` at the serve root and linked root-absolute — the page's own depth
doesn't affect whether they load. Author the layout as a Mermaid graph, render with
`mermaid.initialize({ startOnLoad:false, securityLevel:'loose' })` + `mermaid.render(...)`,
attach the click handler to each rendered `.node`, wrap the SVG with `svgPanZoom`. Theme to
`base.css` tokens. Keep the same one interaction: click a node → detail panel → flag +
comment. No edge menus, no lasso, no mode toolbar.

Discoverability: rows/nodes are obviously clickable (hover, pointer cursor); clicking
reveals detail + comment box, the flag toggle lives in the panel, not on the row. The
capture.js action bar is always present. Any instruction/helper line (e.g. "every row is a
feedback target") is normal selectable body text — a plain `<p>`, not a `.callout-q`, not
weight 800, never `user-select:none`; `.callout-q` is reserved for an actual design
question.

## What gets captured — via window.Capture
Every module is one stable item ID (its symbol name).
- **Init (coverage):** `Capture.init({ view:"module-map-interactive-graph", total:
  MODULE_COUNT })` — modules are the guaranteed one-tap surface, so silence is unambiguous.
- **Flag a module:** `Capture.mark(moduleId, "flag", { note:"why look here / what to
  change" })`. Unflag → `Capture.unmark(moduleId)`. Typing a comment also engages the
  module; the flag toggle removes it.
- **Overall verdict:** flags are FEEDBACK — `Capture.rollup(...)` is `approve` once there
  is any signal, else `null` (this view has no blocking gesture).
- **Submit once:** page sets `window.CAPTURE_SUBMIT_URL`; the capture.js bar calls
  `Capture.submit()` — single atomic POST, clipboard fallback.

```json
{ "view":"module-map-interactive-graph", "verdict":"approve",
  "items":[
    {"id":"main","value":"flag","note":"1700-line god function — routes everything; split by action"},
    {"id":"setupDispatchWorktree","value":"flag","note":"the --detach hard-fail is the load-bearing invariant — explain it"}
  ],
  "coverage":{"engaged":2,"total":41}, "meta":{} }
```

## Anti-patterns to avoid
- A node-link graph of a star — it "points at one box"; render the grouped list instead.
- A free-text comment box below the graph divorced from the modules — it forces the human
  to re-describe in prose which element they mean.
- Edge-verdict menus, lasso/marquee grouping, ranking, or multi-select.
- A resting "+ flag" affordance or always-visible flag chrome on a row — show no marker
  until flagged, then `Flagged ✓`; the row click is the only way in.
- Helper/instruction copy styled as a heading or `.callout-q`.
- Decorative pills/badges for kinds — use plain group headings and a plain `file:line`.

## Diagram nodes link, same as the prose (PRINCIPLES.md → "References and evidence", the "Diagrams link their references" rule)
When the optional graph is used, every module node that names a real file/symbol reuses
the SAME href the module's row/detail-panel reference already resolved (GitHub blob/
fs-link, or a `.file-pop` gloss) — wrap the rendered node in `<a href>` (Mermaid: a `click
<nodeId> "<url>"` directive per node). A node with no backing reference renders plain.

## Build conventions
`PRINCIPLES.md` + `base.css`; below are only this view's deltas. The page sets
`window.CAPTURE_SUBMIT_URL` before any `Capture.submit()`.
