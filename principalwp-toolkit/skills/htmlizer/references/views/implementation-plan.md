# View: implementation-plan (mode: rail)

Generation prompt + capture contract for a plan view: the agent proposes work as an
ordered list of discrete, enumerated steps/phases (PRs, migration steps, build tasks) and
needs a human go/no-go before executing. Read `PRINCIPLES.md` + `_capture.md` first —
house style and the Capture API live there. (No bundled example — this fork ships no
example set.)

## When to use
The human's real decision is surgical-but-bounded: accept most of the plan, object to a
few specific steps, emit ONE routable verdict. Use when the plan has clean step
boundaries. Do NOT use for flowing prose where objections live mid-sentence
(`pr-writeup.md` instead), nor for explaining existing code, nor for comparing competing
approaches.

## House style
`PRINCIPLES.md` + `base.css`; below are only this view's deltas.
- One clean top-to-bottom flow, ordered **evidence → explainers → decisions**: a plain
  `.page-header` (h1 + one lede telling the reviewer what to do), short supporting context
  as prose/lists, the step list, then the open decisions at the bottom. Steps show in
  full — never hidden behind a single-open accordion — so the reviewer reads straight down.
- Directly under the lede, a short plain-words framing block (2-4 sentences, no jargon):
  what this plan changes, why, what happens on submit. When the plan carries a SHAPE
  statement (PrincipalWP Bot plan gates), render it: what will exist after this ships, what
  won't change, what the work is.
- FEWER buttons: one flag toggle per step, the single-select answer controls on each open
  call, and capture.js's Submit + Copy. No manual verdict buttons.
- Code inside a step body gets build-time syntax coloring, not a runtime highlighter
  (PRINCIPLES.md → "Build-time syntax highlighting").

Findings obey PRINCIPLES.md → "Research / findings": only items that shaped a call the
human is making here; implementation detail belongs in the step body.

## Open decisions — live callouts at the bottom, no kicker label
Open calls render as live `.callout` cards, last on the page: `.callout-q` question +
choice controls, recommended default pre-selected where the plan stated one, a `required`
call with no default gates submit. No status-echo, no `.callout-label` kicker
(PRINCIPLES.md → Callouts, "Never re-represent a decision") — the selected control is the
confirmation.

Where the plan recommends an option, present it per PRINCIPLES.md → "Recommendations,
rationale & read-more": pre-selected, rationale as a `(why)` `.why-pop`; any long
root-cause lives once in the supporting-context section, linked with `.readmore`, never
restated at the callout.

Give a decision's rationale a "Read more:" line of `.readmore` anchors to the step/risk/
section it turns on, per PRINCIPLES.md → "Cross-reference the detail" (named labels,
~3-link cap, stable `id` on the exact item named).

**Escape hatch — every decision's option set ends with "Other…"** (PRINCIPLES.md → escape
hatch). Selecting it reveals a free-text box on selection; the recommended default stays
pre-selected. `Capture.mark(d.id, 'other', { note })`; switching back to a canned option
clears the stale note. An "Other…" pick with an empty box blocks Submit
(`emptyOtherDecisions()` in the gate).

Every open call resolves its source per PRINCIPLES.md → "References and evidence": if a call is
"trim this Slack message" or "cut this step," the message/step's actual content is shown
or linked via the resolution ladder — never argued about in the abstract. A message that's
only talking-points-so-far is `.file.planned`, its talking points in a visible on-page
section linked via "Read more:." A gap here (the reviewer must trust an off-page artifact)
is a build defect, not a follow-up.

No effort/duration tags on steps (PRINCIPLES.md → "No time or effort estimates"). The
smaller-option line below names a scope tradeoff, not a duration — don't let one creep in.

## PRIMARY capture interaction — default-accept + one flag/comment per step
A plan reviewer needs to (a) answer the open calls, (b) flag the specific steps they
object to, with a reason, and (c) say whether to apply the rest of the proposed steps —
everything else is noise. The go/no-go itself is computed from these answers (see
"Overall verdict" below).

Every step renders as a readable card carrying ONE control: a **Make changes** toggle.
- Default = accepted. Untouched steps need zero interaction and are un-engaged in
  coverage. Do NOT render a "Keep" button.
- Place the toggle at the bottom-left of the step card, below the content — not in the
  header, not floated top-right (PRINCIPLES.md → Interactions, "bottom-left" rule).
- Toggle on: the card gets a warning left-border and reveals a single required reason
  field ("what's wrong, or what to change") directly beneath the toggle. The reviewer
  writes the objection here — including "cut this" or "change X to Y"; there is no
  separate Edit/Cut/Rank control. Toggling off returns the step to accepted.
- A flagged step with no reason yet is unresolved and holds Submit (red hint on the card;
  reason surfaced in the bar).

Do NOT add a four-way Keep/Edit/Cut/Flag rail, inline contenteditable rewrite, "add a
step" insertion zones, ranking, or multi-select. A single flag-with-reason is the minimum
useful objection; the free-text reason absorbs cut/edit/insert intent.

## Smaller-option line — only where a smaller build is plausible
Where a materially smaller alternative exists for a step, end that step's body with one
plain line — `Smaller option: <the alternative> — trades off: <what it gives up>`. Most
steps get none; never add it to every step, never as a badge/pill.

## Overall verdict — DERIVED from the answers, never a manual button
No standalone Approve/Request-changes control (PRINCIPLES.md → "No standalone overall
verdict"). The single routable verdict is COMPUTED from the open-call answers + per-step
flags and set via `Capture.rollup(...)` — never a button, never mirrored into the sticky
bar.

The step list is a body of changes beyond the itemized calls, so it needs a yes/no home.
Add ONE explicit call — **"Build the steps you didn't flag, as written? — Yes / No /
Other…"** — with one plain sub-line under the question ("Flagged steps get reworked from
your reasons; this covers all the others."), rendered like the other decision callouts.
`Yes` is the recommendation (a `.reco` line) but, like other `required` calls, is not
pre-selected — the call gates submit until answered. No/Other reveal a reason box for
what must change before the rest can be applied.

Derive the verdict from state — recompute on every `Capture.onChange`, then `rollup`:
- all required calls answered + "apply the rest" != No → `approve` (a flagged step, a
  decision = Other, or "apply the rest" = Other are FEEDBACK — they ride along in `items`
  and never change the verdict);
- "apply the rest" = No → `request_changes` (the one blocking answer);
- "apply the rest" not yet answered → leave the verdict unset (`rollup(undefined)`) — the
  gate holds Submit until the call is made.

Do NOT offer a four-way manual verdict (Approve as-is / with changes / Request changes /
Reject) — see "Submit bar" below for what the bar carries.

## Submit bar — progress + Submit only
The sticky bottom bar is the shared `.fixed-actionbar` shell with capture.js's
`#capture-bar` host nested inside (light, house-styled): coverage/progress readout,
**Submit to Claude**, **Copy as prompt** — and nothing else. No verdict buttons, no manual
tally.

## Gating (use Capture.setGate — never override Capture.submit)
Block Submit while a required call is unanswered, an "Other…"/No-Other reveal box is
empty, or a flagged step lacks a reason. No separate verdict-button gate — the verdict is
derived and can never be "unpicked"; the "apply the rest" call is what makes the go/no-go
answerable. Every `ok:false` branch returns a `focus` target; order branches top-of-page
first (`_capture.md` → "Submit gating").

```js
Capture.setGate(function () {
  const c = counts();
  if (pendingRequiredDecisions().length) return { ok:false, reason:'Make the required call.',
    focus:function(){ return document.querySelector('[data-decision="'+pendingRequiredDecisions()[0].id+'"]'); } };
  if (emptyRevealDecisions().length) return { ok:false, reason:'Fill the reason box to record that call.',
    focus:function(){ return document.querySelector('[data-decision="'+emptyRevealDecisions()[0].id+'"] .reveal'); } };
  if (c.unresolved > 0) return { ok:false, reason:'Add a reason to each flagged step to submit.',
    focus:function(){ return document.querySelector('.step.is-flagged:not(.has-reason) .step-fb'); } };
  return { ok:true };
});
```
`pendingRequiredDecisions()` covers the required "apply the rest" call, so no separate
verdict branch is needed.

## Exactly what gets captured (via window.Capture)
Stable-id anchoring: every key is the step/phase id (`"2.3"`), never re-quoted prose.

```js
Capture.init({ view: 'implementation-plan', total: STEP_COUNT + DECISION_COUNT });

Capture.mark('1.4', 'flag', { reason: 'redundant with existing middleware — cut it' });
Capture.mark('2.3', 'flag', { reason: 'wrong assumption: tokens must be httpOnly cookies' });
Capture.unmark('2.3');

Capture.mark('decision-audit', 'retire');
Capture.mark('decision-labels', 'other', { note: 'cache the map but refresh it nightly' });
Capture.mark('apply-rest', 'yes');

Capture.rollup(deriveVerdict());   // approve | request_changes
Capture.submit();
```
```json
{
  "view": "implementation-plan", "verdict": "approve",
  "items": [
    { "id": "1.4", "value": "flag", "reason": "redundant with existing middleware — cut it" },
    { "id": "decision-audit", "value": "retire" },
    { "id": "decision-labels", "value": "other", "note": "cache the map but refresh it nightly" },
    { "id": "apply-rest", "value": "yes" }
  ],
  "coverage": { "engaged": 4, "total": 12 }, "meta": {}
}
```
A `setCoverage(fn)` counting only step + decision ids keeps `engaged` honest — there is no
`verdict-changes` annotation. Default-accept keeps `engaged` low when the human only
objects to a few steps; a derived `approve` over an otherwise-untouched plan is
unambiguous acceptance.

## Anti-patterns to avoid
- A single free-text "Any feedback on this plan?" textarea with one Submit.
- A standalone manual Approve/Request-changes control (in a callout or the sticky bar) —
  and a bare Approve/Reject with no per-step granularity lets one bad step poison the
  whole plan.
- Piling controls onto each step (Keep/Edit/Cut/Flag, rewrite boxes, add-step zones,
  ranking).
- Decorative scaffolding: navy hero, eyebrows, stat-cards-as-decoration, a mermaid
  dependency diagram with pan/zoom, a separate execution checklist with its own
  copy/preview buttons.
