# pr-writeup — the draft PR description (mode: bespoke)

**This write-up IS the draft PR description Claude will use when it opens the PR** — an
agent-authored narrative (Summary / Motivation / What changed / Risk / Test plan, plus any
**Open questions** the agent is blocked on). **Say that purpose on the page** ("This is the
draft PR description Claude will submit — approve it as written, or request changes"). Read
`PRINCIPLES.md` + `_capture.md` first — house style and the Capture API live there; this note
is only the pr-writeup delta. This view has a **bespoke** interaction; it does **NOT** use
the generic disposition rail.

**Priority — lowest.** Per PRINCIPLES.md's verdict → evidence → explainers → questions
ordering, this view sits after the diff and before the open-questions tab when both are on
the same page.

## When to use
The deliverable is a prose argument the agent wrote about a change it already made or is
about to make, and the agent is **blocked on explicit decisions** it surfaced in an "Open
questions / Decisions needed" section. Use this whenever the write-up poses questions the
agent cannot answer itself (delete v1 now or flag it? rollout %?). If the write-up is a pure
FYI with no open questions, or the human's job is line-level diff review, prefer
`code-review-pr-diff.md`. If it is a plan that hasn't been built, use
`implementation-plan.md`.

## PRIMARY capture interaction — inline open-question resolver

**The agent's open questions render as answerable controls, not prose.** This is the single
highest-leverage output of a write-up; a generic comment box buries it. Each question the
agent posed becomes a **card keyed by a stable question id** (`q_*`), and the human resolves
it in place.

Concrete affordances:
- **One card per open question.** Enumerated questions ("keep behind flag" / "delete now")
  render as a **radio / segmented control** — the selectable control is the signifier that
  this is a prompt to answer, not text to skim. Open-ended questions get a short structured
  answer field. No `.callout-label` kicker on the card (PRINCIPLES.md → Callouts).
- **A "defer / you decide" option on every card** (including open-ended ones), so the human
  is never forced into a false binary and every card has a valid one-tap.
- **Unanswered = blocking, not accepted.** Unlike most views' default-to-keep, silence here
  is an unmet requirement: each open question counts toward coverage and gates Submit via
  `Capture.setGate(fn)` (checks ordered top-of-page-first, so Submit scrolls to and flashes
  the first unanswered card). No per-card "still waiting"/"recorded" marker (PRINCIPLES.md →
  "Never re-represent a decision"); the unset control is the signal.
- **Optional rationale line** under each answer, collapsed until an option is picked.
- **Delta-vs-proposal:** if the agent stated a leaning, render it read-only as `Claude leans:
  <option>` so the human's tap is comparable against it. A stated rationale follows
  PRINCIPLES.md's `.reco`/`(why)` pattern; long root-cause lives once in a detail section,
  linked via `.readmore`.

Discoverability: the cards look like a form to complete, not text to read — the selectable
controls (and their unset state) carry the affordance with no instructional copy. A sticky
bottom bar shows live unblock progress (`2 of 3 decisions answered`) and the primary
**Submit to Claude** button.

### SECONDARY — one verdict on the description as a whole
The narrative is a **draft PR description**, not an explanation to be annotated. Interaction
must fit that artifact (PRINCIPLES.md — a drafted narrative is approved-or-rewritten as one
decision, not annotated per hunk): the human **approves it as the PR description** or
**requests changes**, as ONE decision, not N per-section flags. Do **NOT** put per-section
verdict chips on Summary / Motivation / What changed / Risk / Test plan, and do not invite
margin/span comments on sub-sections of the prose.

Concrete affordance: a single **Approve as description / Request changes** control under the
rendered narrative. **Request changes is never a dead end** — selecting it reveals an
edit/reason box on selection (the escape-hatch rule, PRINCIPLES.md): an editable view of the
body so the human can hand back the corrected description verbatim, plus a place to say what
to change. The edited/typed text rides along as the decision's machine-applicable value via
`Capture.mark('description','request_changes',{ edited, note })`. The questions above are the
blocking gate; this is one verdict.

## What gets captured + payload (via window.Capture)

Wire coverage to the **open-question count** — that is the unit whose silence must be
unambiguous:

```js
Capture.init({ view: 'pr-writeup', total: OPEN_QUESTION_COUNT });
```

Per question (one-tap resolution; rationale optional). Deferral is encoded as the value
`'deferred'`:
```js
Capture.mark('q_v1_endpoint', 'keep_behind_flag', { reason: 'One enterprise customer still pins v1; remove next release.' });
Capture.mark('q_rollout', 'deferred', { note: 'Ask the SRE on-call before deciding rollout %.' });
Capture.unmark('q_v1_endpoint'); // reverts to unanswered (amber dot returns)
```

The narrative's one verdict is a single mark keyed `description`, carrying the optional
edited body (resting = unmarked = approve-as-written, so only a request-changes is
recorded):
```js
Capture.mark('description', 'request_changes', { edited: '<full corrected PR description text>', note: 'Tighten the Risk section; the migration is NOT backward-compatible.' });
```

One overall routable verdict, set by the submit bar, then a single atomic POST:
```js
Capture.rollup('request_changes');      // approve | request_changes
Capture.submit();                       // POSTs Capture.payload() once to window.CAPTURE_SUBMIT_URL
```

`Capture.payload()` yields the structured result the agent consumes — answered decisions
keyed by question id (with `deferred` derivable from `value === 'deferred'`), optional
rationale, the single `description` verdict (with any `edited` body), the overall verdict,
and coverage:

```json
{
  "view": "pr-writeup",
  "verdict": "request_changes",
  "items": [
    { "id": "q_v1_endpoint", "value": "keep_behind_flag", "reason": "One enterprise customer still pins v1; remove next release." },
    { "id": "q_rollout", "value": "deferred", "note": "Ask the SRE on-call before deciding rollout %." },
    { "id": "description", "value": "request_changes", "edited": "<full corrected PR description text>", "note": "Tighten the Risk section; the migration is NOT backward-compatible." }
  ],
  "coverage": { "engaged": 2, "total": 3 }
}
```

`coverage.engaged < total` ⇒ an open question the human never resolved — the agent is still
blocked and must re-ask, not assume. Bind `Capture.onChange` to the live `answered / total`
counter and to enabling Submit. **Coverage counts open questions only** — the `description`
verdict is a single secondary decision that does NOT inflate the blocking outstanding count,
and gets **no per-decision ✓ / "recorded" echo** (PRINCIPLES.md → "Never re-represent a
decision") — its selected control state is the only confirmation. If you add or remove an
interaction, keep `total` / CAP_TOTAL in sync, and when you remove one also strip its CSS,
dead DOM hooks, and counter contribution.

## Anti-patterns to avoid
- A single free-text comment box plus one Submit at the bottom of the whole write-up. It
  discards the agent's own question structure, forces the human to re-type which decision
  they're answering, and collapses "answered", "deferred", and "I'm blocking on this" into
  undifferentiated prose the agent must re-parse.
- An all-or-nothing Approve/Reject on the **questions** — it strips the location of the
  problem and leaves the blocking questions unanswered.
- **Per-section verdict chips or margin/span comments on the narrative** (see SECONDARY
  above) — the wrong shape for a draft PR description you either approve-as-written or
  rewrite. **Do not fall back to the generic disposition rail for this view** — questions are
  the blocking unit (bespoke answer controls); the narrative is one approve-as-description
  decision.

## Alternate interactions (situational layers)
- **Claim-level sign-off checklist (ship gate).** When the Test plan / Risk sections make
  verifiable assertions ("added unit tests for X", "no data migration required"), extract
  each into a tri-state attestable claim: **Verified / Not checked / Disputed**
  (`Capture.mark('c_no_migration','disputed',{note:'schema.sql renames a column — this IS a
  migration'})`), with a progress meter gating Submit. Use at a final merge/regulated gate
  where "who attested to what" must be recorded.
- **Inline edit of the description (deeper than a verdict).** On Request changes, an "Edit
  description" toggle makes the narrative body editable so the human hands back the corrected
  PR description verbatim (rides on the `description` mark as `edited`). This is the approved
  deeper interaction — it fixes the draft as a whole. Not per-sentence margin/span comments:
  span anchors break once the agent rewrites the prose.

## Cited PRs, commits, and files
A PR/commit/file the narrative cites resolves via PRINCIPLES.md's reference ladder — a real
GitHub PR/commit URL, or a SHA-pinned blob link with a line anchor for a file — never a bare
`#5407` or a filename in plain prose. If the artifact is the page's own deliverable-to-be (a
PR not yet opened), label it planned rather than fabricating a link (PRINCIPLES.md → "Show
the source, never a fabrication").

## Brand (Principal WP)
House style: PRINCIPLES.md + base.css (`<link>` it; do not inline a `:root` block or
`@font-face`); below are only this view's deltas. Any code excerpt inside the write-up (e.g.
in "What changed") gets build-time syntax coloring per PRINCIPLES.md → "Build-time syntax
highlighting", not a runtime highlighter. Cranberry is the only accent — the submit-gate
flash ring is cranberry too, there is no per-card amber required marker. Secondary action is
an underlined text-link. Flat. Before hand-off, pass the review panel (SKILL.md step 3.5 —
`review-accuracy.md` + `review-sufficiency.md`, then `review-design.md` +
`review-content-hygiene.md`), fixing everything it flags.
