# View: code-review-pr-diff (bespoke capture)

Generation prompt for a PR-diff sign-off view with feedback-capture baked in. Bespoke —
the diff gutter, hunk headers, and finish-gate ARE the capture surface; do not add the
generic feedback rail. Read `PRINCIPLES.md` + `_capture.md` first; this note is only the
diff-review delta.

## When to use
The agent has authored a concrete change (a real diff: files → hunks → lines) and wants
sign-off. The human's job is adjudication, not authoring: bulk-greenlight the mechanical
hunks, flag the few risky ones, and — where they disagree — hand back the corrected code
verbatim so the agent applies it deterministically instead of re-inferring intent. Use
this whenever the deliverable is a diff. For an unbuilt plan use `implementation-plan.md`;
for explaining untouched code use `code-understanding-walkthrough.md`.

## Primary capture interaction
Three layers over one diff, closed by one gate. Reuse the GitHub/difit mental model so no
instructions are needed.

1. **Per-hunk verdict chips (the one-tap floor).** Every hunk header carries an unset
   segmented chip group: **Accept / Make changes / Reject** (or the two-way **Accept /
   Make changes**). Present on 100% of hunks on load. Selecting a chip calls
   `Capture.mark(hunkId, verdict, …)` and marks the hunk engaged. Resting state reads as
   acceptance, but un-engaged ≠ Accept in coverage. **Make changes / Reject must reveal a
   per-hunk reason box on selection** (PRINCIPLES.md → escape hatch), and the typed text
   rides along via `Capture.mark`. Per-file **Viewed** checkbox collapses the file and
   advances focus.
2. **Inline line-anchored comment (deeper, progressively disclosed).** Hovering any diff
   row reveals a gutter **`+`**. Click a line, or click-drag/shift-click a range, to anchor
   a comment box. Records via `Capture.mark` with an `anchor` (file, side, line range,
   sha).
3. **Structured suggestion block (deepest).** Inside the comment box, an **Insert
   suggestion** toggle renders an editable before→after code block seeded with the
   selected lines, so the human edits the actual code, not a prose description of it. The
   edited `{before, after}` rides along as the item's machine-applicable value.
4. **Finish-review gate (terminal, batched).** A sticky bottom-right **Finish review (N
   pending)** bar shows a live pending count. It opens a modal showing the **derived
   verdict** — computed from every hunk's own verdict, read-only — plus a cross-cutting
   summary textarea and a read-only roll-up of every pending item. Confirm calls
   `Capture.rollup(deriveVerdict())` then a single `Capture.submit()`.

Discoverability: the diff itself is the affordance — gutter `+` on row hover, unset chips
on every hunk header at load, a live **N of M hunks adjudicated / K files viewed** meter,
and the sticky pending-count finish bar. No instructional copy.

## Layout & decision placement
Decisions above evidence above explainers (PRINCIPLES.md → Information priority).

1. **Lede, then straight into the diff — no standalone verdict control.** One short
   context line, then the diff. No separate Approve/Request-changes control
   (PRINCIPLES.md → "No standalone overall verdict") — the routable verdict is computed
   from the hunk chips via `Capture.rollup(deriveVerdict())`, never picked by the human.
   **Partial diffs need an explicit call.** When the page renders only some changed files,
   add one decision callout at the bottom, alongside the other open calls: **"Apply the
   rest of the diff (the N files not shown here)? — Yes / No / Other…"** No/Other reveals
   a reason box and No blocks approval (see "What gets captured"). Skip this call entirely
   when every changed file is rendered.
   **A stated agent lean shows read-only** as `Claude leans: approve` under the lede, no
   eyebrow. With a rationale, render it as a `.reco` ending in `(why)` per PRINCIPLES.md →
   Recommendations, rationale & read-more. The lean is plain text, never a control. Its
   body and every inline comment are exception-only (PRINCIPLES.md → Review commentary is
   exception-only) — changes and risks only, no praise. The lede and lean body are
   primary reading text — never `--text-muted`.
2. **Diff is the primary artifact — give it room + an escape hatch.** The diff is the
   widest column. Put an expand toggle in its top-right; expanded, the diff takes the risk
   map's place full-width and the risk map reflows below it. Toggle restores. Place the
   risk map DOM-after the diff so single-column reflow (and the expanded state) is
   automatic — no JS re-parenting.
3. **The finish bar submits; it does not re-ask.** The sticky **Finish review (N pending)**
   bar batches the submit and shows the derived verdict — it does not collect a second,
   competing overall decision.

## Risk map
The risk map sits in the sidebar (DOM-after the diff). Every filename links to that file
in the diff (switches/scrolls to its tab or hunk). Apply PRINCIPLES.md → "A clickable
navigator only exposes targets that exist": when the risk map lists more files than
are rendered (e.g. all 17 files of the commit while only 2 are shown), tag the extras "not
viewable here" and don't style them as links.

## Selectable prose
Never wrap reading text — open questions, inline comments, hunk text, file-tour items,
risk-row descriptions — in a `<button>` (PRINCIPLES.md → Buttons/controls). A clickable
row is a `<div>` with a click handler, or the action moves to an explicit inner control (an
Accept / Make changes chip, a filename link). Buttons stay reserved for hunk verdict chips,
tabs, and filename open-links. (The line-number gutter keeps its `user-select:none`.)

## Diff rendering — wrapping & line backgrounds
Long diff lines wrap; the colored row background must never stop short of the text. Code
tokens get build-time syntax coloring (PRINCIPLES.md → Build-time syntax highlighting),
separate from the diff tinting below; both can coexist in one hunk.

- **Every change is a real hunk, not a bare +/- pair.** Render the changed lines together
  with unchanged context immediately above and below them — **3 lines each side is the
  target, 1 line each side is the hard floor.** Never fall back to zero just because the
  file doesn't offer a full 3 — show as many as exist down to that floor of 1. Drop below
  1 only where there is genuinely nothing to show: the change starts at line 1 of the file
  (nothing exists above) or ends at the file's last line (nothing exists below), or the
  neighbouring line is itself part of the change (it renders as its own `add`/`del` row,
  not context, so the hunk continues instead of inserting a floor line). Never emit a run
  of `add`/`del` rows with nothing around it. Context rows carry the real line number from
  **both** the old and new file (never a blank gutter), and the hunk's own header names the
  file and the `@@ -oldStart,oldLines +newStart,newLines @@` range, so a reader knows what
  they're looking at without hunting for a tab or file list. Tag every row
  `["ctx"|"add"|"del"|"meta", oldLineNo, newLineNo, text]` in a per-file `rows` array —
  `"ctx"` rows are real unchanged lines with both line numbers filled in, and a
  `["meta", null, null, "@@ ...@@"]` row opens each hunk:
  ```js
  rows: [
    ["meta", null, null, "@@ -1,12 +1,25 @@"],
    ["ctx",  1,    1,    "/**"],
    ["ctx",  2,    2,    " * POST /checkout/orders"],
    ["del",  4,    null, " * Creates one order from a priced session. Not safe to retry."],
    ["add",  null, 4,    " * Creates one order from a priced session. Safe to retry: the"],
    ["add",  null, 5,    " * request must carry an Idempotency-Key."],
    ["ctx",  7,    12,   " */"]
  ]
  ```
  Copy that shape rather than reinventing it. The row grid and the `ctx`/`add`/`del`/`hunk`
  tints live in `base.css` (the `.drow` block, appended at the file's end) — `<link>` it
  rather than hand-rolling the grid and colors again per page.
- **Pair removed lines to added lines by similarity, never by position.** `diff` emits
  every removed line in a change block first and only then every added line, so pairing
  the Nth `del` with the Nth `add` is wrong — on a real page it matched the old `-
  **Plain** — just answer.` against the new `- (a) the work destroys…` and never once
  compared the genuine `(a)→(a)`, `(b)→(b)`, `(c)→(c)` rewrites that were the actual edit.
  Within each contiguous run of `del` rows followed by `add` rows, score every `del`×`add`
  pair by token-level similarity (the LCS in the next rule tells you how many tokens two
  lines share), then accept pairs **best-similarity-first**, each row used at most once. A
  row with no pair clearing the 0.35 floor below stays unpaired and renders as a plain
  tinted row — never force a bad match.
- **Inside a paired line, highlight only the words that actually differ.** Run a real
  **token-level longest-common-subsequence** over whitespace-preserving tokens (split the
  line on `/(\s+)/`, keeping the whitespace tokens as tokens of their own) — never
  common-prefix/suffix trimming, which smears one span across the rest of a line the
  moment it changes in more than one place. Tokens outside the LCS are "changed": wrap
  each contiguous run of them in `<span class="tk-del">` (removed side) or `<span
  class="tk-add">` (added side) — both now styled in `base.css` as a stronger shade of the
  row's own red/green **over** the lighter whole-row tint: background-only, never
  `opacity`, text stays full-ink, selectable, and in the same font. Fold a lone highlighted
  whitespace token sitting between two unchanged tokens back into "unchanged" — a single
  highlighted space is noise, not signal. Apply a **similarity floor of ~0.35** (shared
  non-whitespace tokens ÷ the longer line's token count): below it, skip intra-line
  highlighting entirely and leave the pair as two plain tinted rows — a mostly-rewritten
  line only shares stray "the"/"not" tokens with its pair and turns into confetti
  otherwise (613 highlight spans on one real page, 253 once the floor went in). Whatever
  you build, the rendered line must reconstruct the source line byte for byte — assemble
  spans by concatenating tokens, never by re-deriving the text from the diff.
- **Dim context, don't bury it.** Context rows sit visually behind add/del rows so the
  change reads first, but they stay selectable prose, full-ink enough to actually read —
  never faded to decoration. Dim with a muted text color (`--text-faint`), never `opacity`,
  which would also wash out text selection. `base.css` ships
  `.drow.ctx.dim .txt{color:var(--text-faint)}`; a page adds only the **"dim context"**
  checkbox (checked by default), whose `change` handler toggles `.dim` on every
  `.drow.ctx` row — reuse the pattern instead of inventing a new one.
- **Rows WRAP — the diff never scrolls sideways.** `base.css`'s `.drow` sets the last grid
  column to `minmax(0,1fr)` with `white-space:pre-wrap` and `overflow-wrap:anywhere`, so a
  long line wraps inside the row and the added/removed tint (and the `.tk-add`/`.tk-del`
  intra-line highlight) covers all of it. This is the pick between PRINCIPLES.md's two
  permitted diff-sizing options, and it is not optional. Do not restore `max-content`
  sizing or a horizontal scroller, and do not add a page-local override that reintroduces
  one — a diff of prose, markdown, or config carries several-hundred-character lines, and
  content-sized rows hand the reader a scrollbar they have to drag to read one sentence.
- **A wrapped line is still one row.** Don't clip a long line to a fixed height with no way
  to see the rest. Where a page clamps a row for density, that is for *context* rows only,
  it is opt-in per row, and it carries a visible control to expand — a changed line is
  never hidden.
- **Keep prose/comment rows OUT of the diff grid.** Inline comment boxes and suggestion
  blocks are standalone blocks with their own `max-width`, not grid rows.

## What gets captured (via window.Capture)
- `Capture.init({ view:'code-review-pr-diff', total })` — `total` = **hunk count** (the
  coverage unit). Inline comments are extra items, not counted against `total`.
- **Hunk verdict:** `Capture.mark(hunkId, 'accept'|'request_change'|'reject', { reason })`
  — `reason` only when Request change/Reject. Stable id, e.g. `path/to/file.php@H3` (file +
  hunk index, never re-quoted prose).
- **Inline thread / suggestion:** `Capture.mark(lineAnchorId,
  { body, suggestion:{before,after}|null }, { anchor:{ file, side:'new'|'old',
  range:{start,end}, sha } })`. `lineAnchorId` e.g. `path/to/file.php#new:L42-58`.
- **File viewed:** `Capture.mark(fileId, 'viewed')` (optional disposition flag).
- **Apply the rest (only when the page renders a subset of the changed files):**
  `Capture.mark('apply-rest', 'yes'|'no'|'other', { note })` — the one call that gives the
  files not shown a home; `no`/`other` carry the typed reason as `note`. Omit this mark,
  and the callout that sets it, entirely when every changed file is rendered.
- **Terminal:** `Capture.rollup(deriveVerdict())` — `deriveVerdict()` returns
  `'request_changes'` if any hunk is marked `request_change`/`reject`, or if "apply the
  rest" is answered **No**, else `'approve'`, then `Capture.submit()` POSTs once to
  `window.CAPTURE_SUBMIT_URL`. **A Make changes/Reject chip is a blocking call here, not
  feedback that rides along at approve** — unlike `implementation-plan.md`'s optional
  per-step flag, PRINCIPLES.md treats the hunk chip as a primary adjudication rail, a
  verdict invited on every hunk, not an exception flag.

`Capture.payload()` yields one atomic review:
```json
{
  "view": "code-review-pr-diff",
  "verdict": "request_changes",
  "items": [
    { "id": "lib/db.php@H2", "value": "accept" },
    { "id": "lib/db.php@H4", "value": "request_change",
      "reason": "non-VIP-safe DB call" },
    { "id": "lib/db.php#new:L42-44", "value": {
        "body": "Use the VIP-safe wrapper here.",
        "suggestion": {
          "before": "$wpdb->query( $sql );",
          "after":  "vip_safe_wpdb_query( $sql );" } },
      "anchor": { "file": "lib/db.php", "side": "new",
                  "range": { "start": 42, "end": 44 }, "sha": "a1b2c3d" } },
    { "id": "apply-rest", "value": "yes" }
  ],
  "coverage": { "engaged": 12, "total": 40 },
  "meta": { "summary": "Two DB calls need the VIP wrapper; rest is fine.",
            "sha": "a1b2c3d" }
}
```

## Gating (use Capture.setGate — do not override Capture.submit)
Block Submit while the "apply the rest" call is unanswered, its No/Other reason box is
empty, or a hunk marked Make changes/Reject has no reason yet. Every `ok:false` branch MUST
return a `focus` target (DOM element, CSS selector, array, or function) pointing at the
exact missing field, so clicking Submit scrolls to and flashes it. Order branches
top-of-page first (`_capture.md` → Submit gating).

```js
Capture.setGate(function () {
  // "apply the rest" — present only when the diff is partial; unanswered blocks first
  if (applyRestPending())     return { ok:false, reason:'Say whether to apply the rest of the diff.',
                                  focus:'[data-decision="apply-rest"]' };
  if (applyRestReasonEmpty()) return { ok:false, reason:'Fill the reason box for the rest of the diff.',
                                  focus:'[data-decision="apply-rest"] .reveal' };
  // a hunk marked Make changes / Reject with no reason yet
  const missing = emptyHunkReasons();   // hunks marked request_change/reject with reason ''
  if (missing.length)         return { ok:false, reason:'Add a reason to each Make changes/Reject hunk.',
                                  focus:function(){ return missing[0]; } };
  return { ok:true };
});
```

`applyRestPending()` is false, and the first two checks are skipped entirely, when every
changed file is rendered — there is no call to gate on.

## Anti-pattern to avoid
A single free-text box at the bottom of the whole diff ("Any thoughts on this PR?"). It
strips line anchoring (agent re-guesses which line and what fix), discards the
before→after that makes a suggestion deterministically applicable, collapses distinct
per-hunk verdicts into one ambiguous blob, and forces prose where a chip carries the
signal far more cheaply. Equally banned: firing each comment as its own network call — all
items accumulate as **pending** and leave in one `Capture.submit()` (Copy-as-prompt is the
only fallback).

## Alternate interactions (swap the primary only when the trigger holds)
- **Finding adjudication cards** — when the agent shipped the diff WITH its own
  severity-tagged self-flags. Each finding is a card pinned to its hunk with a **Confirm /
  Downgrade / Dismiss** chip row (a severity stepper appears on Downgrade).
  `Capture.mark(findingId, 'confirm'|'downgrade'|'dismiss', { value:{ humanSeverity },
  reason })`. Ratifying pre-localized risk is cheaper human signal than authoring threads —
  promote this to primary whenever the agent pre-annotates.
- **Per-hunk triage rail only** — when nothing is pre-flagged AND the diff is very
  large/mechanical. Lead with chips + per-file Viewed so the human bulk-clears noise fast;
  inline suggestions stay available but secondary. Lossier (Request change without a
  suggestion forces the agent to re-infer the fix), so reserve it for speed-over-fidelity
  sign-offs.

## Brand
Added lines tint `--success`, removed lines tint `--error` (the only semantic-color uses
beyond cranberry, which colors interactive verdict controls/links; structure uses the navy
ramp). Mono covers code, line numbers, verdict-control labels, hunk headers, and counts.
Sentence-case headings, flat.

## Cited PRs, commits, and files resolve via the ladder
A PR/commit/file referenced OUTSIDE the diff itself (the risk map's summary text, an
inline comment citing another PR) is a real link (the GitHub PR/commit URL, or a
SHA-pinned blob link with a line anchor for a file) per PRINCIPLES → "References and evidence" —
never a bare `#5407`. The diff's own hunks already carry their file/line context; this is
about cross-references beyond it.

## House-style specifics
"Chip" above means an **interactive** verdict control (Accept / Request change / Reject) —
not decorative chrome; severity/status stays plain valence text, never a pill
(PRINCIPLES.md → Pills/badges).

## After editing this view (self-challenge)
- Verify each id has **exactly one home** — every risk-map link target resolves to a
  rendered hunk/file, and no two elements claim the same id.
- Count only true **blocking** decisions in the outstanding/pending indicator and any
  per-tab badge; surface secondary dispositions (file **Viewed**, inline comments) as
  informational ✓ that do **not** inflate the outstanding count. Keep `total`/CAP_TOTAL in
  sync if you add or remove an interaction.
- When you remove an interaction, also remove its CSS, dead DOM attributes/hooks, and its
  contribution to shared counters.
- **Gate registered:** confirm `Capture.setGate` covers the apply-the-rest call (when
  present) plus any empty Make changes/Reject reason box — a page with required-answer
  language and no `setGate` fails `review-design.md` §7 (Submit gating presence).
- Pass the review panel before hand-off (SKILL.md step 3.5) and fix everything it flags.
