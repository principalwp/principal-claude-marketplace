# annotated-flowchart (bespoke) — generation prompt

Generate ONE self-contained `.html` view rendering an agent-authored control-flow diagram
(Mermaid/SVG) with feedback capture baked in via `window.Capture`. Bespoke: no generic
verdict rail. Interaction is graph-native — feedback binds to addressable node/edge IDs,
and every decision node gets a branch audit.

Read `PRINCIPLES.md` + `_capture.md` first — house style and the Capture API live there;
this note is only the flowchart delta. If rendering from Mermaid, use the **vendored**
build only — `/assets/vendor/mermaid.min.js` (and `/assets/vendor/svg-pan-zoom.min.js` for
pan/zoom). Hand-authored SVG is also fine.

## When to use
A flowchart/state-machine/runbook the agent wants a human to validate **structurally**
before it writes or merges code. Three triggers: (1) reverse-engineered flow — "is this
what your system actually does?"; (2) a proposed new control flow (retry/backoff,
validation pipeline); (3) a safety-critical process diagram (incident runbook, BPMN) where
a missing path is a defect. The reviewer's job is catching divergence: a step out of
order, a decision whose outcome was never drawn, an edge that can't fire. If the unit of
correctness is whole end-to-end routes rather than individual elements, prefer the
path-trace alternate below.

**Priority when composed into a multi-view review.** A flowchart is structural *context*:
it ranks below the verdict and above open questions (PRINCIPLES.md → Information
priority). Standalone, it leads as normal.

## PRIMARY capture interaction
Decision-branch completeness audit on every gateway node, plus a per-element verdict on
every node and edge. Two affordances, both anchored to stable IDs:

1. **Per-element verdict (every node AND edge).** Each shape is an addressable target —
   emit `data-element-id` on every node/edge in the rendered SVG (Mermaid IDs edges too;
   run an ID-injection pass first if your source doesn't). On hover the shape lifts/
   outlines and the cursor becomes a pointer; a small verdict toolbar pins to it
   (Figma/Miro hover-pin) with one-tap chips: **Approve · Wrong · Wrong-order · Make
   changes**. The element recolors to its verdict. A persistent legend maps color→meaning;
   a sticky summary bar shows `"3 approved · 1 wrong · 2 unreviewed"`; unreviewed elements
   stay gently dimmed/pulsing.
2. **Gateway completeness audit (every decision/diamond node).** Decision nodes are
   visually distinguished and badged `"1 of 2 outcomes confirmed"`. Each renders an inline
   panel ENUMERATING its existing outgoing branches read straight off the diagram's edges
   (yes/no/error/…), a confirm checkbox per branch ("this outcome is handled correctly"),
   and a `"+ Add missing branch"` row with a condition-label field (e.g.
   `gateway_timeout`). A `complete` toggle flips green only when every existing branch is
   confirmed or every gap is recorded. The human audits exhaustiveness against a generated
   checklist, not freeform prose.

The submit button shows a live count ("Submit 4 verdicts") with "Copy as prompt" beside it.

## What gets captured (via window.Capture)
Resting state is acceptance: an untouched element is un-engaged and counts as *unreviewed*
in coverage — silence stays unambiguous (dimmed/pulsing) until the human acts.

Init with the count of every addressable element so coverage is real:
```js
Capture.init({ view: 'annotated-flowchart', total: nodeCount + edgeCount });
```
One `Capture.mark` per element, keyed to its stable ID (never re-quoted prose):
```js
// plain node or edge — one-tap verdict; note only after a non-approve verdict
Capture.mark('node_validatePayment', 'wrong-order', { anchor: 'node', note: 'must run after inventory check' });
Capture.mark('edge_n4_n7',           'flag',        { anchor: 'edge', note: "can't fire when cart empty" });

// decision node — the audit IS its mark; value is the structured coverage object
Capture.mark('node_isPaymentValid', {
  verdict: 'approve',
  complete: false,
  coveredBranches: ['yes', 'no'],
  missingBranches: [{ condition: 'gateway_timeout', note: 'no path for gateway timeout' }]
}, { anchor: 'gateway' });

Capture.unmark('node_x');                 // revert to un-engaged / default-accept
Capture.onChange(updateSummaryBar);       // live "X approved · Y unreviewed" + per-gateway badge
Capture.rollup('approve');   // single whole-flow verdict: approve | request_changes — per-node/edge
                              // verdicts are feedback, never blocking (see anti-pattern below)
```
`Capture.payload()` wraps these marks in the standard envelope (`_capture.md` → API); put
the flow's own id in `meta.flowId`. One batched atomic submit: marks accumulate locally;
one "Submit to Claude" calls `Capture.submit()`. No per-element network calls.

## Anti-pattern to avoid
A single freeform comment box under the diagram ("Any feedback on this flow?") plus one
whole-diagram Approve/Reject. It detaches feedback from the element, discards the graph
structure the view exists to convey, and forces the agent to re-parse prose to guess which
node "the second decision" meant. Equally wrong: whole-flow-only approval with no element
granularity (the human sees a step is misordered but can't say which). Capture MUST anchor
to addressable node/edge/gateway IDs, never to the canvas.

## Diagram nodes link, same as the prose (PRINCIPLES → "References and evidence", the "Diagrams link their references" rule)
The link is the node's own reference resolving — separate from the per-element verdict
chip, which captures judgment, not reference. A node with no backing reference renders
plain, never faked as linkable.

## Alternate interactions (opt-in, not the default)
- **Structural edit proposal (drag-to-connect graph diff).** React-Flow-style connection
  handles on node borders; drag node→node to add an edge, click an edge to mark remove,
  drag an endpoint to reroute — accumulating an ordered op list. Reach it as a **"Propose
  fix"** mode from a flagged element. Capture each op as a mark, e.g.
  `Capture.mark('edit_1', { op:'reroute-edge', edgeId:'edge_n2_n5', newTo:'node_retry' }, { anchor:'edit' })`.
  Use only when the human is the flow's author rebuilding correct topology; higher
  friction.
- **Path-trace approval (walk an end-to-end route).** Click nodes in sequence (or a preset
  chip like "Happy path" / "Decline path") to highlight a route, then mark it Valid/Broken
  with a "breaks at →" node picker. Make this primary only for runbook/state-machine views
  where whole-route traversal-and-termination is the unit of correctness. Capture as
  `Capture.mark('path_decline', { sequence:[...], verdict:'broken', breaksAt:'node_declined', note:'...' }, { anchor:'path' })`.
