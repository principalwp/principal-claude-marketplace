# View: decision-ledger (mode: rail)

Post-build record of decisions actually made. Read `PRINCIPLES.md` + `_capture.md` first —
house style and the Capture API live there; this note is only the ledger-specific delta.

## When to use
A build loop just finished and the user should see what got decided on their behalf without
asking: right-sizing calls (simplified vs kept-complex), places the implementer deviated from
the plan, and review findings fixed vs escalated. Not a pre-build page (that's
`interview.md`) and not a diff review (that's `code-review-pr-diff.md`).

## Layout
Three grouped sections, in order: **Right-size**, **Deviations**, **Fixed vs escalated**.
A leading **Built** group (new artifacts) and a closing full-reports link list may be
added when the loop produced them; the core three keep their order. Skip a section
entirely if it has no entries — never render an empty group. Every entry is
one row:
- A one-line decision statement (what was decided, in plain words). When the session
  touched more than one artifact (several skills, a config file), the statement names
  the artifact it changed, so entries from different artifacts don't blur together.
- An expandable `(why)` detail — PRINCIPLES.md → "Recommendations, rationale & read-more"
  `.reveal` pattern — carrying the reasoning or the specific deviation, not a repeated
  summary.
- A **Right-size** entry's statement MUST resolve to one of two shapes: `Simplified —
  applied` (states what was cut) or `Kept complex — <reason>` (states why the simpler option
  was rejected). An entry that asserts a simpler option existed with no reason it wasn't
  taken is a pipeline failure, not a normal entry: render it as a loud negative `.callout`
  (never buried in the plain list) so it can't be scrolled past.

## Capture
Default-accept rail, one control per entry: **Acknowledge** (the resting state) or **Make
changes**, which reveals a required reason box (escape hatch). Only flagged entries need a
click; an untouched entry is a legible "this is fine". The closing teach-session question
(below) is tracked separately — exclude it from ledger coverage with
`Capture.setCoverage(id => id !== 'teach-session')`.
```js
Capture.init({ view:'decision-ledger', total: ENTRY_COUNT });

Capture.mark('rightsize-cache-layer', 'flag', { reason:'the Redis fallback still looks unnecessary here' });
Capture.mark('deviation-retry-count', 'ack');    // explicit ack is fine; silence also reads as accepted
Capture.mark('teach-session', 'yes');             // end-of-page quiz offer, excluded from coverage

Capture.setMeta({ topic:'Auth refactor build',
  counts:{ simplified:4, keptComplex:1, deviations:2, escalated:1 } });

Capture.rollup(Capture.payload().items.some(i => i.value === 'flag')
  ? 'revisit_requested' : 'acknowledged');   // derived — recompute on every Capture.onChange
```
`Capture.payload()` wraps these marks in the standard envelope (`_capture.md` → API).

## Verdict & gate
Verdict is DERIVED — recomputed on every `Capture.onChange`, never a manual button: any
entry `flag`ged → `revisit_requested`, else
`acknowledged`. `Capture.setGate` blocks Submit only on a flag with an empty reason box —
`focus` points at that entry's `.reveal-box`, first-flagged-first.

## End of page
One closing question in its own callout, below the three sections: "Quiz me on this
change?" — Yes / No, captured as `Capture.mark('teach-session', 'yes'|'no')`. A `yes` at
submit time is the signal for the session to run the `teach-session` skill against this
ledger's content.

## Anti-patterns
- Writing the ledger as a to-do list of simplifications still to make — every entry records
  something that already happened, not a pending suggestion.
- A Right-size entry that says "could have been simpler" with no `<reason>` and no
  negative-callout treatment — that silently normalizes an unexplained miss.
