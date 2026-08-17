# Review Contract

Shared finding format that the four reviewers (correctness, design, performance, security) and
the Code agent in fixer mode all read before they write anything — the Compound Learning closeout
step also reads it, to parse review.md.

## Finding Format

Each finding is a block with these fields, in this order:

- **SEVERITY** — Critical / High / Medium / Low, classified by impact not fix
  difficulty (see the Severity table below). State it explicitly on every
  finding; the fixer orders its work Critical → High → Medium → Low, so don't
  leave it to be inferred from the wording.
- **PROBLEM** — what's wrong, specific and actionable.
- **IMPACT** — why it matters (bug risk, UX cost, perf cost, security risk).
- **EVIDENCE** — `file:line`, plus a short code snippet (max ~3 lines) if it helps.
- **CONFIDENCE** — high / medium / low, that the finding is real. Report an
  uncertain finding rather than dropping it — say so via CONFIDENCE.
- **FIX** — a specific fix. "Consider improving this" is not a fix.

````
**[XX-N] Short description — `path/to/file.php:123`**

SEVERITY: Critical | High | Medium | Low
PROBLEM: ...
IMPACT: ...
EVIDENCE:
```lang
// the problematic code
```
CONFIDENCE: high | medium | low
FIX:
```lang
// corrected code
```
````

## Finding IDs

Prefix by reviewer, numbered sequentially within that reviewer's own pass:
correctness `[CO-N]`, design `[DES-N]`, performance `[PERF-N]`, security `[SE-N]`.

The correctness and security reviewers' final re-review passes append their
findings under distinct prefixes, `[CO-R-N]` (correctness re-review) and
`[SE-R-N]` (security re-review), so they're not confused with their first-pass
`[CO-N]` / `[SE-N]` findings.

## Multi-Instance Defects

When the same defect shows up in multiple places, file ONE finding with a
`RECURRING:` line right after PROBLEM, and list every location in
EVIDENCE. Don't file one finding per instance.

## Severity

Four levels — classify by **impact, not fix difficulty**:

| Level | Meaning |
|---|---|
| **Critical** | Production incident, data loss, or exploitable vulnerability |
| **High** | Must fix before merge |
| **Medium** | Should fix — best-practice violation |
| **Low** | Minor — style, polish, small optimization |

A finding that needs an architectural change is still Critical if it risks a
production incident. Effort to fix has zero bearing on severity.

## Reading the Existing Review

The four reviewers run in this fixed order — correctness, design,
performance, security — but not back-to-back: after each one appends its
findings to `.principal-wp-starter-pipeline/<run-id>/review.md`, the Code agent fixes
them before the next reviewer runs. So every reviewer after the first is
looking at code the previous reviewer's fixes already changed — there's no
cross-reviewer duplicate at the same `file:line` to reconcile, and no
merge, dedup, or tie-break step of any kind. Each reviewer's section stands
as written.

## Outcome (Code agent, fixer mode)

When the Code agent fixes findings afterward, it marks each one in place,
right after FIX, with exactly one of these:

- `**OUTCOME:** FIXED — {one-line what you changed}`
- `**OUTCOME:** BLOCKED — {one-line why you couldn't fix it}`
- `**OUTCOME:** DEFERRED-PENDING-ACCEPTANCE — {one-line why it's the
  developer's call to accept or reject at closeout, not yours}`
- `**OUTCOME:** DEFERRED — {one-line why: out of scope, can't reproduce,
  etc.}`

Which outcome is allowed is **bound to the finding's SEVERITY** (see the
Severity table above) — the fixer may not deviate:

| Severity | Allowed outcomes |
|---|---|
| **Critical / High** | `FIXED` or `BLOCKED` only — **never** deferred |
| **Medium** | `FIXED` or `DEFERRED-PENDING-ACCEPTANCE` |
| **Low** | `FIXED` or `DEFERRED` (with a reason) |

A `BLOCKED` Critical or High finding is a **release blocker**: it feeds the
closeout gate, which withholds the PR handoff until the developer resolves it.
A `DEFERRED-PENDING-ACCEPTANCE` Medium is one the developer accepts or rejects
at closeout — not one the fixer may silently drop.

This finding-level outcome vocabulary is **separate** from the AC-scope
term `OUT-OF-SCOPE` (used by the correctness reviewer for `[deferred]`
acceptance criteria). Do not merge the two: `OUT-OF-SCOPE` marks an AC as
out of scope for the release, not a finding as unfixed.

Every `BLOCKED`, `DEFERRED-PENDING-ACCEPTANCE`, and `DEFERRED` finding stays
visible in `review.md` for the human — copied to `summary.md` at closeout, the
`BLOCKED` Critical/High ones as release blockers, the rest as Known Issues.
