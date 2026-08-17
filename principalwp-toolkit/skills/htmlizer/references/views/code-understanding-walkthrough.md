# code-understanding-walkthrough — generation prompt (bespoke capture)

Stepper: each step pairs code with line numbers and a plain-language narrative note, with a
progress rail above. The agent is *teaching* the human how a piece of code works, step by
step. Bespoke, deliberately minimal: ONE Got it / Confused signal per step plus an optional
per-step question, all routed through `window.Capture`. Keep it about reading — do not pile
controls onto a step.

Read `PRINCIPLES.md` + `_capture.md` first; this note is only the walkthrough delta. Each
step's code block gets build-time syntax coloring — the agent tokenizes the source and
wraps `.tok-*` spans while generating the page, never a runtime highlighter
(PRINCIPLES.md → "Build-time syntax highlighting").

## When to use
- Onboarding a human to an unfamiliar code path (auth flow, a reducer, a refactor) where
  understanding can silently fracture mid-walkthrough and the agent needs to know *which
  step*.
- Walking a developer through *why* an AI-generated change is correct, where they may
  distrust one specific line and want to ask anchored to that exact token without losing
  their place.
- Teaching a concept where "reading it feels clear" diverges from "can reproduce it".

Not for reviewing a diff (use code-review-pr-diff) or proposing unbuilt work (use
implementation-plan).

## PRIMARY capture interaction — one comprehension signal per step + optional question
Keep this view **about reading.** Every narrative step ends with ONE simple, single-select
signal: **Got it / Confused** — two buttons, the human picks one. That tap is the one-tap
signal on 100% of steps. Do **not** render a row of controls, a flag, deepen-chips, or a
per-line gutter composer. The only escalation is a single **optional per-step question**
field ("Ask a question about this step").

Affordances (each is a concrete element to render, and nothing more):
- **Two-button Got it / Confused control** at the foot of each step, single-select.
  Selected state uses functional status color: Got it → `--success`, Confused → `--error`.
  These are the *only* semantic-color uses on the page. If a step's signal sits in a
  callout, it carries no `.callout-label` (PRINCIPLES.md → Callouts).
- Any hand-styled control that sets `outline:none` (a rating button, the caret toggle, the
  reason textarea) needs a visible `:focus-visible` ring (cranberry `box-shadow`) — never
  strip focus without replacing it.
- **One reason/question textarea** per step, anchored to that step's id, **revealed on
  selection**, not always-on. Rating the step reveals it; a **Confused** rating reframes it
  as the "what's confusing about this step?" reason box, so the negative signal always has
  a place to say *why*. Typing it is the entire escalation path. No line-level markers, no
  chips, no flag.
- **Progress rail** whose segments recolor by the step's signal (`--success` Got it /
  `--error` Confused), so the learner watches their own comprehension fill in.

**Selectable prose.** The step title, subtitle, and narrative note are readable content and
stay a `<div>` with a click handler, never a `<button>` (PRINCIPLES.md → Buttons/controls)
— an expander header gets a small caret `<button>` as the keyboard toggle, its click
bubbling to the row. Guard the row handler so a click that *ends a text selection* doesn't
also toggle. Got it / Confused, the per-step question, and Copy stay real `<button>`s.

How it is discoverable (no legend):
1. The Got it / Confused buttons sit under each step's code — rating reads as "the next
   thing to do".
2. The rail recolors the instant a signal registers — immediate visible feedback.
3. The persistent "Submit to Claude" bar carries a **live tally** ("2 confused · 1
   question").

## Exactly what gets captured (via window.Capture)
Stable ids are step ids (`code:s1`, `code:s2`, …). Anchor each signal to the step's id and
source range — never to re-quoted narrative prose.

```js
Capture.init({ view: 'code-understanding-walkthrough', total: STEP_COUNT });

// One signal per step. value is an OBJECT: { rating, question }. 'got_it' still marks the step
// engaged (coverage); silence on a step = not yet read. Unmark a step with no rating and no question.
Capture.mark('code:s3',
  { rating: 'confused', question: 'Why is expiry verification disabled here?' },  // rating ∈ got_it|confused
  { anchor: { file: 'auth.py', step: 'L42-45' } });

Capture.rollup('need_reteach');   // single routable verdict: understood | partial | need_reteach
Capture.submit();                  // the persistent bar is the one submit; "Copy as prompt" is the fallback
```

`Capture.payload()` yields, per step: rating and any typed question — an ordered
comprehension state showing which steps held and which broke, in sequence, plus
`coverage:{engaged,total}` where engaged = steps marked and total = step count (so a
learner confused at step 4 is unambiguously distinct from one who never reached step 9).

## Anti-pattern to avoid
A single free-text "Any questions?" box at the bottom, collected only on submit: it strips
the anchor (the agent can't tell which step "the confusing part" means), produces no
per-step signal, and biases toward zero input. Equally bad: piling controls onto each step
(3+ ratings, a flag, deepen-chips, a per-line composer) — it turns a reading aid into a
form and buries the one signal that matters. And do **not** fall back to the generic rail;
capture confusion per step, anchored and low-friction.

## Alternate interaction (offer only when the walkthrough is short and concept-dense)
- **Predict-then-reveal self-explanation checkpoint** — at 1–3 load-bearing steps, gate the
  reveal behind a prediction ("What does verify_token() return for an expired token?"),
  then self-grade. Captures the *shape of the misconception*, not just its presence:
  `Capture.mark(stepId, { rating, prediction:'It returns None', self_grade:'off' }, opts)`.
  Promote to PRIMARY only when the walkthrough is 1–3 steps and illusory "feels clear" is
  the real risk. It still resolves to ONE signal per step — never a row of controls.

## File/symbol references resolve via the ladder
Every file/function/symbol named resolves per PRINCIPLES.md → "References and evidence"; an
unbuilt artifact is `.file.planned`.

## House style (this view)
The comprehension status colors (got_it `--success`, confused `--error`) are the only
color beyond cranberry, and only because they are genuine functional state. Flat.
