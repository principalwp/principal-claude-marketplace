# Spec Grammar & Template — Principal WP Starter Pipeline

The AC grammar and `spec.md` template the spec agent writes to, and the correctness reviewer
checks against for AC-completeness.

## Precedence (when spec sections conflict)

Precedence when sections conflict: gate Decisions (the edits and answers the
dev recorded in spec.md at the human gate) > AC text > Task prose. A
violation of the six security rules (in wp-standards.md) always blocks.
Rules #1–#5 admit no accepted deviation, ever — write the AC to comply
instead. Rule #6 (secrets) is the sole exception: an AC may accept a
deviation from env vars/`wp-config.php` only when the dev genuinely can't use
them, and only if the AC states both why they're unusable and a mitigation
(capability-gated access, encrypted at rest) — surfaced at the human gate via
the AC and/or Open Questions. See wp-standards.md's six security rules, rule
#6, for the full rule.

## AC Grammar

### Sentence patterns for acceptance criteria (apply where they add clarity — don't force)
- **Ubiquitous**: "The system shall [response]" — no trigger/condition.
- **Event-driven**: "When [trigger], the system shall [response]."
- **State-dependent**: "While [condition], the system shall [response]."
- **Error handling**: "If [error condition], then the system shall
  [response]."
- **Optional feature**: "Where [feature is enabled], the system shall
  [response]."

Plain Ubiquitous ACs are fine on their own: "The system shall validate all
user input server-side."

### Keywords for measurable requirements (Scale / Meter / Goal / Stretch)
Use these keywords instead of the sentence patterns above for anything with a measurable number
(performance, capacity, availability):

| Keyword | Meaning | Example |
|---|---|---|
| Scale | What's measured | "Render time for a list of 10 items" |
| Meter | How it's measured | "Server-Timing header" |
| Goal | Pass/fail threshold | "< 50ms" |
| Stretch | Aspirational, non-blocking | "< 20ms" |

Goal is what the coder must hit; Stretch caps ambition — don't gold-plate
past it.

### Multi-claim ACs → lettered sub-assertions
When an AC body lists more than two items (fields, behaviors, states),
write each as `(a)`, `(b)`, `(c)`… inside the AC body. The `Verify:` clause
must reference the full range: "each of (a)–(N)". A single-clause Verify
for a multi-item AC fails AC-completeness.

### The Verify clause (mandatory, every AC)
Every AC-NNN ends with a `Verify:` line stating exactly how to confirm it
— concrete, checkable, no hedge words. A Verify clause is one of two
objective kinds: a **behavioral assertion** — an observable, external
behavior (page state, output, a DB row) an E2E spec can assert against,
not an internal implementation detail — or a **design/UX intent
assertion** (see "Design-bearing ACs" below), which stays just as
checkable: element/component presence, a computed-style value, or a
theme-token reference in the emitted markup. Either kind must be concrete;
neither may hedge. Hedge words that fail AC-completeness: "as appropriate",
"as needed", "properly", "correctly", "handle edge cases", and — for design
— "looks good", "polished", "modern", "clean". Write the specific behavior
or the specific visual outcome instead: "Return `''` (empty string) when
`WP_Query` returns 0 posts," not "handle empty state appropriately"; "the
list container computes `display: grid`," not "lay it out nicely."

### Design-bearing ACs (design/UX intent clause)
An AC may carry a **design/UX intent** — the visual/UX outcome it delivers
— alongside or instead of a pure behavioral assertion. This is how a visual
bar becomes specifiable: not "make it look good" (taste, un-gateable) but a
**verifiable** outcome the coder builds to and a reviewer can confirm is
present. Express design intent only as objective, checkable assertions:

- **Component / element presence** — "status renders as a badge element,
  not a bare text `<span>`"; "the item list is a grid of cards, one
  `<article>` per item".
- **Computed-style checks** — a value an E2E spec (or a MANUAL check) reads
  off the rendered page: "the list container computes `display: grid`"; "the
  status badge has a non-transparent `background-color`"; "interactive
  controls expose a visible `:focus-visible` outline".
- **Mandatory theme-token colour & type** — every colour and font value the
  AC introduces routes through `var(--wp--preset--*)` / `var(--wp--custom--*)`
  (with a fallback), never a hardcoded brand palette. This is non-negotiable
  on any front-end AC and is what keeps the output theme-neutral (see
  Design Direction): colour/type defer to the theme, layout/components are
  the plugin's own.

A design-bearing AC still gets a `Verify:` clause; the clause just asserts
the visual outcome. Where an outcome can't be reached by E2E (fine visual
judgement, layout at a real viewport), mark that Task `Level: MANUAL` so it
lands in the Verification Checklist instead of vanishing.

Example — a design-bearing AC:

> ### AC-014 [core]
> When a member views their library, each entry renders as a card in a
> responsive grid — (a) the list container computes `display: grid`; (b)
> each entry is a card element showing its cover art at ≥120px wide,
> cover-forward (image before text); (c) the entry's status renders as a
> badge with a non-transparent `background-color`, not plain text; (d) all
> colour and type come from theme tokens (`var(--wp--preset--*)` with
> fallbacks), no hardcoded hex.
> Verify: E2E asserts computed `display: grid` on the list container, an
> `<img>` ≥120px wide in each card, and a non-transparent `background-color`
> on the status badge; a `Level: MANUAL` item confirms the cover-forward
> composition reads as designed under the active theme.

### core / deferred marks (every AC and NFR)
Every AC-NNN and NFR-NNN (NFR = a quality or performance rule, as opposed to a feature) carries
one mark:
- **[core]** — in scope for this release. It generates at least one Task and
  gets a line in the Verification Checklist.
- **[deferred]** — out of scope for **this** release: a real requirement,
  consciously not built now. A deferred AC needs a one-line reason, generates
  **no Task**, and is **excluded from the Verification Checklist**. List it
  under the Overview's "Out of scope" so the dev sees what was set aside.

This AC-scope `[deferred]` is a different thing from a review finding's
`DEFERRED` outcome (see review-contract.md): one says a requirement is out
of this release, the other records how a reviewer handled a finding. Don't
conflate them.

## Design Direction (front-end features)

Any feature that emits front-end views carries a short **Design Direction** —
a per-feature design brief the coder builds to and the design reviewer checks
against. It sets the visual/UX bar **objectively and upstream**, so "designed"
is a decision made at spec time, not a taste call invented late by a reviewer.
Keep it tight — a handful of bullets, not a style guide. It states:

- **Layout model & signature element** — how the feature composes ("responsive
  card grid for the library; single-column reading layout for a profile") and
  the one thing this feature is visually about (here: cover art, laid out
  cover-forward).
- **Component inventory** — the plugin-owned components the views are built
  from (card, badge, tab/pill nav, styled control), named — instead of bare
  `<ul><li>` and pipe-separated text links.
- **States** — the interactive, empty, and loading states each view must
  render (hover/focus/active on controls, a real empty state, a visible
  error), cross-checked by the design reviewer.
- **Spacing & type scale** — a small, consistent scale **bound to theme
  tokens** (`var(--wp--preset--spacing--*)`, `var(--wp--preset--font-size--*)`
  with fallbacks), not one-off literals.

**Theme-neutrality split (bake this in — don't hand-wave it).** Colour and
typography **defer to the active theme** — always via `var(--wp--preset--*)` /
`var(--wp--custom--*)` with fallbacks, never a hardcoded brand palette that
fights the theme. **Layout and components are plugin-owned** and should be
genuinely designed: a template-takeover feature (one that renders its own
document via `template_redirect` + rewrite endpoints) gets no header, nav, or
layout from the theme, so composition is the plugin's to build — and it can be
built without fighting any theme, because there is no theme template to
collide with. "Design liberty" here means tasteful, componentized,
theme-token-based, gracefully theme-degradable layout — **not** an imposed
opinionated colour/type system.

Building to the Design Direction is **in scope, not gold-plating** — it lifts
front-end visual quality out of an unguided "Coder Judgment: CSS styling" line.
Each Design Direction produces at least one **design-bearing AC** (above) and
at least one Verification-Checklist line (E2E where reachable, else
`Level: MANUAL`), so the bar is visible and checkable rather than delegated
away.

## spec.md Template

```markdown
# Spec: {ticket title}

## Open Questions
{Blind spots + unresolved requirements.md Questions + the spec agent's own
 — each with 2-3 options and a recommended default, so the spec gate can ask
 it directly}

## Overview
{what, why, who}
Out of scope: {explicit}

## Requirements
### AC-001 [core|deferred]
{sentence-pattern form or plain statement; (a)/(b)/(c) if multi-claim}
Verify: {concrete check}

### NFR-001 [core|deferred]
Scale: … Meter: … Goal: … Stretch: …
Verify: {concrete check}

## Design
### Design Direction
{front-end features only: layout model + signature element, plugin-owned
 component inventory, required interactive/empty/loading states, spacing/type
 scale bound to theme tokens. Colour/type defer to the theme; layout/components
 are plugin-owned — see "Design Direction" above. Omit for backend-only work.}
### Components
{table: component, responsibility}
### Data Model
{table: field, type, storage, sanitization — only if new data}
### Integration Points
{hooks, filters, extension patterns}

## Tasks
{only [core] ACs generate Tasks; a [deferred] AC gets none}
### T1
Files: {path} (create|modify)
Depends on: {task or "none"}
AC refs: {AC-NNN, ...}
Constraints: {exact function/file/class-level rules}
Test: {assertion} — Level: E2E | MANUAL

## Boundaries
Always Do: {list}
Never Do: {list}
Coder Judgment: {list}

## Verification Checklist
{one line per [core] AC, mapped; deferred ACs excluded}

## Known Risks
{Risk Check Monitor-level findings}
```

## Risk Check (run before the spec is final)

Seven categories — check all, don't skip any:
1. **Data flow** — empty/malformed data, network failures, timeouts
2. **Auth & permissions** — capability checks, nonces, REST auth
3. **Silent UX failures** — swallowed errors, no-feedback empty states,
   stuck loading
4. **Environment & configuration** — required constants/env vars, setup
   steps
5. **Edge cases** — concurrency, cache races, i18n
6. **Editor UI correctness** (block features only) — missing
   placeholder/loading/error states, sidebar-only controls, deprecated
   component props
7. **Visual / UX design** (front-end features only) — is the Design
   Direction met: componentized layout (not bare `<ul><li>` or
   pipe-separated links), the signature element built, required
   interactive/empty/loading states present, colour/type on theme tokens?
   A front-end view left as bare theme-default markup is a Must Fix here —
   turn it into a design-bearing AC.

Classify each finding: **Must Fix** (becomes an AC or test) / **Monitor**
(Known Risks) / **Blind Spot** (Open Questions).

## Over-Engineering Self-Check

Flag and simplify unless backed by real evidence (a schema constraint, a
known slow-query pattern, a concrete prior measurement — not confident
prose):
- **Scale-proportionality** — batching/queueing/locking for bounded,
  predictable volume
- **Behavior-free component** — a class with only constants or no-op
  methods
- **Abstraction without reuse** — a container/interface/dispatcher with
  one caller
- **Imagined-future extensibility** — an extension point with only
  today's consumer
- **Application-level locking** — prefer schema constraints (`UNIQUE`,
  `ON DUPLICATE KEY`) over advisory locks/mutexes/transient locks
- **Redundant invariant enforcement** — app-level checks duplicating a
  DB/framework guarantee
- **Cache without a demonstrated latency problem** — caching a DB query
  without a shown slow-query pattern; remote HTTP calls are the
  exception — cache those by default
- **Premature evolution scaffolding** — version gates/migrations on a
  feature with no prior shipped release
- **Re-implementing the platform** — duplicating what WordPress, PHP, or
  MySQL already provide
