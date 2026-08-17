# View: interview (mode: bespoke)

Pre-build open-questions page. Read `PRINCIPLES.md` + `_capture.md` first — house style and
the Capture API live there; this note is only the interview-specific delta.

## When to use
2+ open questions — or one guessed requirement that would change what gets built — need to
reach the user before implementation starts. Questions typically arrive as structured data
from a planning/critique sub-agent or a `challenge`-skill audit run (one card per open item
flagged). NOT for a single quick question — that stays a plain `AskUserQuestion`, no page
needed.

## Layout
**Every prose block on the page — not just the question line — is written plain** (see
PRINCIPLES → "Clarity & detail" / "Name the plain thing"). The context / "where this stands"
sections above the questions are where insider jargon piles up, so gloss every coined term on
first use there too, or use the plain word instead. `review-sufficiency.md` Pass 2 checks this.

One `.callout` card per question, in the order they arrived (do not re-sort by
recommendation). Each card:
- The question in plain words, as the `.callout-q` (bold `Question:` lead-in, per
  PRINCIPLES.md → Callouts).
- One line, normal weight: why this matters — what a wrong guess here changes downstream.
- **Enumerable options** (a bounded choice set): single-select controls, the recommended
  option listed **first** and carrying plain-text `(Recommended)` in its own label — not a
  pill/badge (PRINCIPLES.md bans decorative "Recommended" tags; this is the option's own
  text). No option is pre-selected — see "Defer" below for why.
- **Non-enumerable questions** (no fixed set of answers) skip the option list and render one
  free-text answer box directly — don't fake radios for an open-ended question.
- **Always** an `Other…` option appended to the enumerable set, revealing a free-text box
  on selection (PRINCIPLES.md → escape hatch).
- **Always** a `Defer — decide during build with the recommendation` choice on **every**
  card, distinct from the canned options and from `Other…`. Picking it is a full answer
  ("use your recommendation, I'm not engaging further"), never a "skip this" link — on an
  enumerable card it's a normal option in the control; on a non-enumerable card, one Defer
  control beside the free-text box. Every card therefore states a recommendation (the
  `(Recommended)` option, or a working assumption on a free-text card) and records it in
  `meta.recommended`, so a defer always resolves to something concrete.

## Capture
```js
Capture.init({ view:'interview', total: 4 });

Capture.mark('q-auth-storage', 'session-token');                       // picked a canned option
Capture.mark('q-retry-policy', 'other', { note:'retry twice, then page on-call' });
Capture.mark('q-error-copy', 'defer');                                  // go with the recommendation
Capture.mark('q-rollback-plan', 'answered',                             // non-enumerable, free text
  { note:'Roll back via the previous Terraform state file, ~10 min.' });

Capture.setMeta({ topic:'Auth refactor open questions',   // one recommended entry PER card
  recommended:{ 'q-auth-storage':'session-token', 'q-retry-policy':'exp-backoff',
                'q-error-copy':'generic-message', 'q-rollback-plan':'previous Terraform state' } });

Capture.rollup(Capture.payload().items.some(i => i.value === 'defer')
  ? 'answers_partial' : 'answers_complete');   // derived — recompute on every Capture.onChange
```
`Capture.payload()`:
```json
{
  "view": "interview", "verdict": "answers_partial",
  "items": [
    { "id": "q-auth-storage", "value": "session-token" },
    { "id": "q-retry-policy", "value": "other", "note": "retry twice, then page on-call" },
    { "id": "q-error-copy", "value": "defer" },
    { "id": "q-rollback-plan", "value": "answered", "note": "Roll back via the previous Terraform state file, ~10 min." }
  ],
  "coverage": { "engaged": 4, "total": 4 },
  "meta": { "topic": "Auth refactor open questions", "recommended": { "q-auth-storage": "session-token", "q-retry-policy": "exp-backoff", "q-error-copy": "generic-message", "q-rollback-plan": "previous Terraform state" } }
}
```

## Verdict & gate
Verdict is DERIVED via `Capture.rollup` — recomputed on every `Capture.onChange`, never a
manual button: every question answered (canned / `other` / free-text) with none deferred →
`answers_complete`; any `defer` present → `answers_partial`. `Capture.setGate` blocks
Submit until every card has a value — an unanswered card, or a picked `Other…`/free-text
box left empty, is the `ok:false` case; `focus` points at that card (or its
`.reveal-box`), first-unanswered-first:
```js
Capture.setGate(function () {
  const missing = firstUnansweredCard();   // unmarked, or Other/free-text picked but empty
  if (missing) return { ok:false, reason:'Answer or defer each question.', focus:missing };
  return { ok:true };
});
```

## Anti-patterns
- Collapsing every question into one shared textarea — it discards which question an answer
  belongs to and hides the per-question recommendation.
- Hiding or omitting the recommended option to "seem neutral" — state it plainly; neutrality
  comes from also offering `Other…` and `Defer`, not from withholding the recommendation.
