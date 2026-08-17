# View: doc-review (mode: editor)

Generation prompt for a **direct-editing document review**: the agent puts the full
document into one editable box, the human edits it in place, and every edit renders as a
live inline diff against the original (insertions green, deletions struck-through red). A
human who would rather describe a change than type it uses the comment path instead. Read
`PRINCIPLES.md` + `_capture.md` first — house style and the Capture API live there; this
file covers only the doc-review delta.

## When to use
Any prose document the reviewer should be able to correct directly — a README, spec, RFC,
guide, proposal, runbook, report, release notes. The human's job is to fix the text, not
file per-section objections: they retype the sentence they want, hand it back verbatim,
and the agent applies it deterministically instead of re-inferring intent from a
description. Use it for any document made of editable text, regardless of section count.
NOT code (that's `code-review-pr-diff.md`, adjudicated per hunk). NOT a plan of unbuilt
work (`implementation-plan.md`). NOT a single-argument narrative approved-or-rewritten
whole with no in-place editing (`pr-writeup.md`).

## Layout — the document IS the editable surface
The document's real text lives on the page, inside the editor (PRINCIPLES.md → "References
and evidence"). Top to bottom:
1. `.page-header` — h1 + one lede line.
2. A short point-first framing `.callout` (no label): edit the document directly in the
   box, changes show up highlighted in the preview; name the comment path as the
   alternative; state the default (untouched = accepted as written) and what submit sends.
3. The editor `.card`: a small toolbar (live status + Show-original + Reset), the
   `<textarea>` preloaded with the whole document, the live inline-changes preview, then
   the collapsed Show-original reveal.
4. capture.js's auto-injected General comments field and Submit bar — both come for free
   from `Capture.init`; do not hand-add them.

No separate verdict control (derived, below). All text stays selectable — editor and
comment field are editable by nature; preview and original are `pre-wrap` blocks.

## Primary capture interaction — edit in place, diff renders live
One `<textarea>` holds the full document, preloaded, and the reviewer edits it directly.
Beneath it, a live preview re-renders on every debounced keystroke as a word-level inline
diff against the pristine original: unchanged text plain, insertions `<ins>` (green),
deletions struck-through `<del>` (red).

- Preload the real document as raw source (no runtime markdown renderer — the diff
  highlights changed words; showing the literal source keeps the page self-contained).
- Editor ergonomics: tall `min-height` (~440px), `resize:vertical`, body font (not
  monospace — it's prose) matching the preview, ~180ms debounce so the diff never janks
  mid-keystroke, and `white-space:pre-wrap; overflow-wrap:anywhere` so long lines/tokens
  wrap inside the box instead of scrolling it sideways.
- Capture the pristine original once at load and diff against it — never a moving
  baseline.
- **Show-original** (`.btn-secondary`, off by default): reveals the untouched original as
  a read-only block below the editor.
- **Reset to original** (`.btn-secondary`): restores the pristine text — the recovery from
  an accidental select-all-delete (see Gating). Distinct from Show-original (reference vs.
  discard-my-edits); both earn their place.

## The comment path — the built-in General comments field IS the escape hatch
A reviewer who would rather describe a change than hand-edit it uses capture.js's
auto-injected General comments field (`_capture.md` → "General comments") — this is the
escape hatch (PRINCIPLES.md → "Always an escape hatch"). The framing block points to it
explicitly. Do NOT hand-add a second comment box or set `CAPTURE_NO_COMMENTS`; wire its
`input` (`#cap-comments-input`) into the same debounced recompute so a comment alone still
derives the verdict live. Edit some, comment elsewhere, or comment alone — all coexist.

## Overall verdict — DERIVED from edits + comment
No standalone Approve/Request-changes control (PRINCIPLES.md → "No standalone overall
verdict"). Computed in the recompute writer, then set via `Capture.rollup(...)`: text
edited OR a comment left → `request_changes`; otherwise → `approve`.

"Edited" means a non-whitespace change: compare non-whitespace token sequences, not raw
bytes. A whitespace-only edit is ignored — verdict stays `approve`, nothing captured — so
the verdict never disagrees with a preview showing no change. An edit or a comment is the
blocking gesture here (like `code-review-pr-diff.md`'s Make-changes chip). Untouched text
with no comment is unambiguous acceptance, not silence.

## Capture (via window.Capture)
The whole document is one coverage unit — `total: 1`; the single item id is `doc-body`.

```js
Capture.init({ view: 'doc-review', total: 1 });
Capture.setMeta({ original: ORIGINAL });     // pristine baseline (delta-vs-proposal sink)

function recompute() {   // the ONE writer — never called from inside the gate
  var hasComment = commentsEl && commentsEl.value.trim() !== '';
  var edited = !sameSeq(nonWs(ORIGINAL), nonWs(editor.value));
  if (!edited) {
    preview.innerHTML = esc(editor.value);
    Capture.unmark('doc-body');
  } else {
    var a = tokenize(ORIGINAL), b = tokenize(editor.value);
    if (a.length * b.length > DIFF_BUDGET) {          // large doc: skip the live O(n·m) diff
      preview.innerHTML = '<span class="preview-note">…live highlighting off; edits still captured…</span>';
      Capture.mark('doc-body', { status: 'edited', text: editor.value, ops: [] }, { note: 'edited (large document)' });
    } else {
      var ops = foldWs(diffTokens(a, b));
      preview.innerHTML = render(ops);
      Capture.mark('doc-body', { status: 'edited', text: editor.value, ops: changedOps(ops) },
        { note: '3 words added, 1 removed' });
    }
  }
  Capture.rollup((edited || hasComment) ? 'request_changes' : 'approve');
}
Capture.submit();   // POSTs Capture.payload() once, gated
```

```json
{
  "view": "doc-review", "verdict": "request_changes",
  "items": [
    { "id": "doc-body",
      "value": { "status": "edited", "text": "# pgsnap …the full edited document…",
                 "ops": [ { "op": "del", "text": "13" }, { "op": "ins", "text": "14" } ] },
      "note": "1 words added, 1 removed" }
  ],
  "comments": "The Security section should say which IAM actions the bucket role needs.",
  "coverage": { "engaged": 1, "total": 1 },
  "meta": { "original": "# pgsnap …the pristine original…" }
}
```
The payload carries the full edited text (`value.text`), the computed diff (`value.ops` —
the pristine `original` in `meta` lets the agent reconstruct either side), and any comment
(`comments`). An untouched document with no comment submits `approve` with `engaged: 0`.

## Diff rendering — vanilla word-level LCS, no library
Plain JS, no external library, no CDN — the diff runs at runtime from the reviewer's live
edits (unlike build-time syntax highlighting, which is a generation-time step).

- Tokenize both sides into words and whitespace runs (`s.match(/\s+|\S+/g)`) so
  insertions/deletions land on word boundaries.
- Longest-common-subsequence over the token arrays (standard DP + backtrack) yields
  `eq`/`del`/`ins` ops. O(n·m) — fine for a typical README/spec, would freeze on a very
  large document.
- **Size cap + fallback:** before the DP, check `tokensA * tokensB` against `DIFF_BUDGET`
  (~6M cells, roughly a 1,200-word-per-side document). Over budget, skip the live diff —
  the textarea stays fully editable, the preview shows a plain "highlighting off" note,
  and the edit is still captured (`text` sent, `ops: []`, `meta.original` lets the agent
  diff it server-side).
- Fold whitespace noise: a whitespace-only `del`/`ins` wedged between two `eq` runs is
  reclassified unchanged, so the preview doesn't sprout highlighted single spaces.
- Merge adjacent same-type ops, then render: `eq` → escaped text, `del` → `<del
  class="d-del">`, `ins` → `<ins class="d-ins">`. HTML-escape every token first. The
  rendered side must reconstruct the source byte-for-byte — concatenate tokens, never
  re-derive text.
- Preview container: `white-space:pre-wrap; overflow-wrap:anywhere`.
- `.d-ins`/`.d-del` use functional status colors (`--success`/`--error`) — the same scoped
  exception to "one accent" that the code-review diff makes.

## Gating (use Capture.setGate — never override Capture.submit)
No required per-section reason box, so the gate is minimal: the one real failure is an
empty editor with no comment (a select-all-delete that wiped the document — almost always
accidental). It blocks only when there's also no comment, since describing the rewrite in
the comment box is the offered recovery.

```js
Capture.setGate(function () {
  var hasComment = commentsEl && commentsEl.value.trim() !== '';
  if (editor.value.trim() === '' && !hasComment)
    return { ok:false, reason:'The document is empty — restore it or add a comment instead.', focus:editor };
  return { ok:true };
});
```
Keep the gate a pure read (`_capture.md` → Submit gating); the debounced recompute wired
to the editor's and comment field's `input` handlers is the only writer.

## References resolve via the ladder
A file/PR/ticket the document's prose cites is shown or linked per `PRINCIPLES.md` →
"References and evidence" — but that ladder applies only to the page's own framing/prose, not
the editable document body: identifiers and paths inside the `<textarea>` are the
document's own text, edited literally, never re-styled as `.file` links (the markup would
corrupt what the reviewer is editing).

## Anti-patterns to avoid
- The old section-by-section accept/flag rail — this redesign replaces it with direct
  editing.
- A markdown renderer or any runtime library for the diff or preview.
- A second, hand-added comment box (or `CAPTURE_NO_COMMENTS`) — the built-in General
  comments field is the comment path.
- A standalone manual Approve/Request-changes control anywhere — the verdict is derived.
- Diffing against a moving baseline instead of the pristine original.
- Rebuilding the preview from the diff ops instead of concatenating the actual tokens.
- Running the O(n·m) diff on an unbounded document with no size cap.
- A status line that contradicts the verdict (e.g. "leave it untouched to accept" while
  the bar shows `request_changes`).
- Decorative chrome: navy band, eyebrows, status pills, a "Recommended" tag.

## Before hand-off
There are two inline `<script>`s (head window-vars, body logic) — `node --check` both.
Confirm: the diff reconstructs both sides byte-for-byte on a sample edit; a long unbroken
token wraps instead of scrolling the editor sideways; a comment alone (editor untouched)
derives `request_changes` and lets Submit through with an empty editor; a whitespace-only
edit stays `approve` with no captured change. Then run the standard review panel (SKILL.md
step 3.5) and fix everything it flags.
