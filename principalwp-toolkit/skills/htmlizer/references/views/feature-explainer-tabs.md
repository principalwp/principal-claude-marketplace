# feature-explainer-tabs (mode: rail) — generation prompt

Generate a self-contained view that explains ONE feature/integration/approach across a
tab strip of facets (Overview, How it works, Setup, Limitations, Security, Cost…). Read
`PRINCIPLES.md` + `_capture.md` first — house style and the Capture API live there.
Sentence-case headings.

## When to use
The default view when an agent has written an explainer needing validation for
accuracy/clarity, facet by facet — "is each part of this right and clear?". The tabs are
genuine peer facets of one object. Not for sequenced work (`implementation-plan.md`) or
competing options as the primary axis (approaches/decision views — though a
same-facet-per-approach explainer fits here).

## This view IS the shared disposition rail
The facets are a genuine list, so this view uses the shared rail directly: one signal per
facet, keyed to a stable `tabId`, default resting state = un-flagged — batching, coverage,
submit, and submitted-state come for free. Never multi-select, never rank; no cross-facet
"which facet decides this?" pick.

## Primary capture interaction: a single clear flag per tab
Each tab gets one control: a **Make changes** toggle marking the facet wrong/unclear, plus
an optional one-line note ("What is off?"). Single-select: flagged or not, no tri-state
split. The active state uses the cranberry accent — the only colored control.

**Escape hatch:** reveal the note box on selection (progressive disclosure) — appears when
flagged, hidden otherwise; a read-fine facet needs no reason.

Discoverability (no instructional copy): each pane shows the control with a plain prompt
("Anything to change in <Facet>?"); a plain-text count under the strip reads "2 of 6
facets flagged" (not a pill); Submit stays always enabled (never gated on flagging every
tab); Copy as prompt is the fallback.

## What gets captured (via window.Capture)
```js
Capture.init({ view:'feature-explainer-tabs', total: 6 });   // total = facet-tab count
Capture.mark('tabs:limitations', 'flagged', { note: '3-IdP cap is configurable, not hard' });
Capture.mark('tabs:pricing', 'flagged');
Capture.unmark('tabs:pricing');
Capture.rollup('request_changes');   // any flagged facet -> request_changes; else approve
```
```json
{
  "view": "feature-explainer-tabs", "verdict": "request_changes",
  "items": [
    { "id": "tabs:limitations", "value": "flagged", "note": "3-IdP cap is configurable, not hard" },
    { "id": "tabs:pricing", "value": "flagged" }
  ],
  "coverage": { "engaged": 2, "total": 6 }, "meta": { "featureId": "sso-okta" }
}
```
`value` is always `'flagged'`; absence = the facet read fine.

## Anti-pattern to avoid
A single global comment box + one Submit at the bottom — it discards which facet the
feedback is about. Equally bad: a tri-state or multi-chip control per tab, or a
"which facet decides this?" ranking pick. Do not coerce coverage by disabling Submit until
every tab is flagged — let partial, honest input through.

## File/symbol references resolve via the ladder
Every file/function/symbol named in a facet's prose or diagram resolves per PRINCIPLES.md
→ "References and evidence" (incl. its "Diagrams link their references" rule if the facet has one) — GitHub
blob/fs-link where resolvable, else a `.file-pop` gloss. A runtime artifact that doesn't
exist yet is `.file.planned` with what it will contain in the popover.

## Validate
Confirm the only colored control is the flag's cranberry selected state, `base.css` is
linked, and no second submit path exists besides the persistent capture bar + Copy as
prompt.
