# View: testing-checklist (mode: rail)

Generation prompt for a **test / QA plan** the agent hands a human to run: a set of flows,
each an ordered list of steps to execute, where the human records what actually happened.
Read `PRINCIPLES.md` + `_capture.md` + `base.css` first — house style and the Capture API
live there; this note is only the checklist-specific delta.

## When to use
The agent produced a concrete plan for **verifying** something already built or about to
ship — a manual smoke test, a QA pass, a release checklist, a reproduction script — and
needs a human to run the steps and report the outcome step by step. Use this when the work
is *running and observing*, not deciding.
- NOT a plan of work to greenlight before building — that is `implementation-plan.md`.
- NOT a diff to adjudicate — that is `code-review-pr-diff.md`.
- NOT open questions to answer before building — that is `interview.md`.

## Structure — Flow → Step
Two levels, both rendered in full (no accordions; the tester reads straight down):

- **Flow** — a named group of steps that exercise one path ("Checkout — happy path",
  "Checkout — declined card"). Rendered as a `.section`, each flow a stable id.
- **Step** — one readable card inside a flow. Every step carries three parts:
  1. **Action** — what to do, in plain words, plus a **copyable code snippet** where the
     action is a command / request / payload the tester runs verbatim.
  2. **Pass** — the expected result if the step is healthy ("`200` with an `order_id`").
     This is what the tester compares reality against.
  3. **Watch** (optional) — a known **failure sign** to look out for ("a `500` here means
     the idempotency key wasn't stored"). Omit it when there's nothing specific to warn about;
     never pad every step with one.

Order the page: `.page-header` (h1 + one lede line telling the tester to run the steps and
record each result), a short plain-words framing block (what's under test, how to read
Pass vs Watch, what happens on submit), then the flows in run order, then capture.js's
Submit bar. There is **no separate verdict control** — it is derived (below).

## Snippets — highlighted at build time, never a runtime highlighter
Render each Action snippet in a `<pre>` (styled by `base.css`), tokens wrapped in `.tok-kw` /
`.tok-str` / `.tok-num` / `.tok-com` / `.tok-fn` spans **at generation time** — never pull a
runtime highlighter (highlight.js / Prism / Shiki) from a CDN (PRINCIPLES.md →
"Self-contained constraint" and "Build-time syntax highlighting"). Keep the palette
restrained (PRINCIPLES.md → Color) — code coloring is functional, not decoration. All text
stays selectable; a small **Copy** control per snippet is allowed (pasting a command is the
core action) but is the only extra button a step gets.

## Primary capture interaction — a 4-state result per step
Each step is a disposition rail: a per-step **result control** with four states, plus an
unset **pending** resting state. This is a **primary per-item adjudication rail** (a result
is invited on every step), so — like the diff hunk chips — it stays where the view puts it
(PRINCIPLES.md → Interactions, the adjudication-rail exemption): a control row at the
**bottom of the step card**, after Action / Pass / Watch, so the tester runs the step, then
records the outcome underneath.

- **pending** — resting / unset. The step hasn't been run. **Not a Capture value** — the
  step is simply unmarked. Silence here means "not run yet", not "accepted": coverage
  (`engaged < total`) tells the agent exactly how many steps the human actually ran, so a
  **partial run is a legitimate submit**.
- **Pass** → `Capture.mark(stepId, 'pass')`. Matched the expected result.
- **Fail** → `Capture.mark(stepId, 'fail', { note })`. Didn't match. Reveals a required note
  box on selection (escape hatch, PRINCIPLES.md) — a fail with an empty note is a dead end
  for the agent, so it gates Submit.
- **Blocked** → `Capture.mark(stepId, 'blocked', { note })`. Couldn't run the step (a
  prerequisite failed, the environment was down). Also reveals a required note box — same
  reason, same gate.
- **Skipped** → `Capture.mark(stepId, 'skipped')`. Deliberately not run (not relevant this
  pass). An **optional** note box is offered but never required.
- **Un-set** → `Capture.unmark(stepId)` returns the step to pending.

The four state buttons are real `<button>`s (`.btn .btn-secondary .btn-sm`). Their
**selected state takes the state's functional status color** as the fill —
`pass=--success`, `fail=--error`, `blocked=--warning`, `skipped=--text-muted`/neutral —
**not** cranberry. This is the sanctioned use of status color for genuine functional state
(PRINCIPLES.md → Color; the same principle behind diff add/del tints): the color *is* the
signal, so the tester scans a flow and sees red/green at a glance, and it matches the
progress bar below. Unselected buttons are plain outline. The reveal box for Fail/Blocked
opens directly beneath the control (full card width) via the shared
`.reveal`/`.reveal.is-open`/`.reveal-box` primitive — do not reimplement disclosure markup.

Do NOT add per-step severity steppers, retry counters, screenshot-upload widgets, a
five-plus-state rail, or a global "any bugs?" textarea — one 4-state result + one note is
the whole per-step interaction.

## Sticky progress bar — resolved / total, with per-flow sub-bars
A **page-local sticky bar** (`position:sticky; top:0`, page-owned CSS — this is *not* the
capture.js action bar, which stays fixed at the bottom) shows overall **resolved / total**
(resolved = steps given any of the four states). Each **flow header** carries its own
mini **stacked sub-bar** — one segment per state (pass=success, fail=error, blocked=warning,
skipped=muted, pending=hairline) sized to the counts — so the tester sees at a glance which
flows are clean and which have failures. Both are **live status readouts, not decisions**:
recompute them on every `Capture.onChange` from `Capture.payload()`. They carry no control,
so no `.callout-label` and no eyebrow. Keep `body{padding-bottom}` clearing the bottom
capture bar; the sticky top bar needs no such allowance.

## Verdict — DERIVED, never a manual button
No standalone Approve / Request-changes control (PRINCIPLES.md → "No standalone overall
verdict"). The verdict has exactly two values, **computed from the step results** on every
`Capture.onChange` and set via `Capture.rollup(...)`: any step **Fail** or **Blocked** →
`request_changes`; otherwise, once at least one step is resolved (`coverage.engaged > 0`) →
`approve`. Skipped steps never block; pending means *not run*, not accepted, so an
**all-pending checklist never derives `approve`** — Submit stays gated until at least one
step resolves (Gating, below).

## Capture — no capture.js change is needed
`Capture.mark(stepId, state)` records the four states as plain strings — `capture.js`'s
`mark()` already accepts any string as the value (`_capture.md` → API) — so no `capture.js`
change is needed. Stable-id anchoring: every key is the step id (`checkout-happy:s3`), never
re-quoted prose.

```js
Capture.init({ view: 'testing-checklist', total: STEP_COUNT });   // total = every step present

Capture.mark('checkout-happy:s1', 'pass');
Capture.mark('checkout-happy:s3', 'fail',    { note: 'Got 500 — idempotency key not persisted on retry.' });
Capture.mark('checkout-declined:s2', 'blocked', { note: 'Stripe test mode returned no decline code — could not reach this step.' });
Capture.mark('checkout-declined:s4', 'skipped');
Capture.unmark('checkout-happy:s3');   // back to pending

// verdict is DERIVED — recompute on every change, never a button:
Capture.onChange(function () { Capture.rollup(deriveVerdict()); });  // any fail/blocked → request_changes, else approve
Capture.submit();   // POSTs Capture.payload() once to window.CAPTURE_SUBMIT_URL (gated)
```

`Capture.payload()` (one failed step, one blocked, one skipped, the rest passed):
```json
{
  "view": "testing-checklist",
  "verdict": "request_changes",
  "items": [
    { "id": "checkout-happy:s1", "value": "pass" },
    { "id": "checkout-happy:s3", "value": "fail", "note": "Got 500 — idempotency key not persisted on retry." },
    { "id": "checkout-declined:s2", "value": "blocked", "note": "Stripe test mode returned no decline code — could not reach this step." },
    { "id": "checkout-declined:s4", "value": "skipped" }
  ],
  "coverage": { "engaged": 4, "total": 10 },
  "meta": {}
}
```
`coverage.engaged < total` means some steps weren't run — a legitimate partial pass, not a
defect. Every step is a bounded coverage unit, so no `setCoverage` filter is needed.

## Gating (use Capture.setGate — do not override Capture.submit)
Two gates block Submit: a **Fail or Blocked step whose note box is still empty**, and a
checklist where **no step has been resolved at all** (`coverage.engaged === 0` — leaving SOME
steps pending is a valid partial run; leaving ALL of them pending is not). The Submit button
is **never disabled** for validation — every `ok:false` branch returns a `focus` target so
clicking Submit scrolls to and flashes the empty note or the first step.

```js
Capture.setGate(function () {
  const missing = firstFailOrBlockedWithEmptyNote();   // top-of-page first (DOM read only)
  if (missing) return { ok:false, reason:'Add a note to each Fail / Blocked step.', focus:missing };
  if (Capture.payload().coverage.engaged === 0) {
    return { ok:false, reason:'Run at least one step before submitting.', focus:firstStep() };
  }
  return { ok:true };
});
```
Keep the gate a **pure read** (`_capture.md` → Submit gating): the writer that calls
`Capture.mark` / `rollup` is wired to the buttons' `change`/`click` handlers, never called
from inside the gate.

## No time or effort estimates
Per PRINCIPLES.md: no "~2 min per step" or per-flow duration tag. A real clock fact from the
source (a stated timeout, "wait 30s for the webhook") is not an estimate and stays.

## Anti-patterns to avoid
- A single "Did the tests pass? — yes / no" control, or one free-text "bugs found?" box, at
  the bottom. It discards which step failed and forces the agent to re-parse prose for the
  location and the symptom.
- A manual Approve / Request-changes button (in a callout or mirrored into the sticky bar) —
  the verdict is derived, see above.
- Treating pending as "accepted" (design-system's resting = keep does not apply here —
  pending means *not run*). Do not roll pending steps into Pass.
- A runtime CDN syntax highlighter, a charting/screenshot lib, or any external host — the
  page is self-contained (`PRINCIPLES.md` → "Self-contained constraint").
- Decorative chrome: navy bar, eyebrows, status pills. State color lives in the result
  buttons and the progress sub-bars (functional), nowhere else.

## Before hand-off
`node --check` every inline `<script>`, then pass the review panel (SKILL.md step 3.5 —
`review-accuracy.md` + `review-sufficiency.md`, then `review-design.md` +
`review-content-hygiene.md`), fixing everything it flags.
