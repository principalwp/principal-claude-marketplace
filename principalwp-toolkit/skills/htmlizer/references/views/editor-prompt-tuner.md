# View: editor-prompt-tuner (bespoke capture)

Generation prompt for a prompt-tuning view. This view is **bespoke** — its primary
interaction lives inside the editor, not a side rail. Do not add the generic feedback
rail. Keep it readable and minimal: edit the template with live slot highlighting, rebind
slot values, pick ONE terminal disposition, submit. Drop the heavy per-edit control
thicket — no tracked-changes/suggesting mode, no per-edit intent chips, no span-comment
composer, no per-slot lock/reviewed taps; those exist only as alternates below when their
trigger genuinely holds. Read `PRINCIPLES.md` + `_capture.md` first for house style and
the Capture API.

## When to use
The agent has authored free-text for a model to consume — a system prompt, instruction
block, or templated prompt — and wants the human to tune it. The deliverable is prose the
human will rewrite some of, while the agent must see exactly what changed and why (the
changelog) and distinguish "I rewrote this, use it" from "I'm flagging this, you decide."
For settings/flags use a config editor; for a diff of real code use
`code-review-pr-diff.md`; for read-only explanation use `code-understanding-walkthrough.md`.

## Primary capture interaction
Plain editor with live slot highlighting + slot-value rebinding. The prompt loads into a
single editable `<textarea>` overlaid by a read-only highlight layer; the human edits the
wording directly and fills/rebinds the detected `{{slots}}`. Minimal chrome — editor, slot
inputs, one disposition choice.

1. **Editable template with live slot highlighting.** A highlight overlay tints every
   `{{SLOT}}` as it's typed — known slots (in the n8n contract) one tint, unknown slots
   another with a wavy underline. Editing the wording is recorded as **one `substitute`
   op** (before/after + a computed line-level diff) — not per-keystroke tracked changes —
   so the agent gets the true before→after without re-diffing.
2. **Slot-value rebinding (the core decision).** One row per detected slot: a plain
   `{{NAME}}` label, a plain-text known/unknown indicator (not a colored badge), and a
   value input seeded from the proposed binding. Editing past the proposed binding marks
   it engaged. No lock toggle, no "Reviewed — no change" tap — leaving a slot at its
   proposed value is the silent default. A new `{{NAME}}` in the editor auto-adds a row.
3. **Filled preview (read-only).** Renders exactly what n8n would hand to Claude: filled
   slots substituted, unresolved ones left literal and flagged, plus a functional warning
   box for unbound/unknown slots. One secondary **Copy prompt** button exports the filled
   text; the only other per-view button is **Reset text**.
4. **Terminal disposition.** A single-select radio: **Apply as final** ("use my rebuilt
   prompt") vs **Suggest to the agent** ("apply my edits/bindings yourself"). If in a
   callout, no `.callout-label` kicker (PRINCIPLES.md → Callouts). Fixed set → ends in an
   "Other…" radio (verdict `prompt-tuner:other`, empty box gates submit). **Apply as
   final** (the overwriting option) reveals a justification box on selection. Both ride
   along as an extra `disposition` mark, excluded from coverage.

### Discoverability
Live slot tinting is the persistent cue that `{{slots}}` are editable; the filled preview
updates as you type. A plain "N changes staged" line tracks accumulated edits. Choosing
Apply as final with unbound `{{variables}}` raises a blocking gate ("N unbound variables
block Apply as final"); Suggest to the agent lets the agent fill gaps. The gate
(`Capture.setGate`) targets, in order: the first unbound slot input, the empty disposition
radio set, then the empty "Other…" box (PRINCIPLES.md → Submit gating). On a page shared
with the feature-flags editor, the gate's `focus` function must switch to this tab first.

## What gets captured (via window.Capture)
- `Capture.init({ view:'editor-prompt-tuner', total })` — `total` = slot count. The
  template-rewrite op is extra, not counted (register a `Capture.setCoverage` filter so
  only `var:*` ids count).
- **Slot rebinding:** `Capture.mark('var:'+name, { value, proposed, changed }, { reason:
  changed ? 'rebind' : undefined, anchor:{ slot:'variables', name } })`. Returning to the
  proposed binding calls `Capture.unmark`.
- **Template edit op:** `Capture.mark('template', { type:'substitute', before, after, diff
  }, { anchor:{ slot:'template' } })`, `diff` precomputed line-level. Reverting to the
  seed `unmark`s it.
- **Terminal:** `Capture.rollup('apply_as_final'|'suggest_to_agent'|'other')`, one
  `Capture.submit()`. Apply-as-final is gated on zero unbound variables.
- **Disposition reveal box:** rides along as one extra `Capture.mark('disposition', {
  verdict, custom? }, { reason, anchor:{ slot:'disposition' } })`, excluded from coverage.

```json
{
  "view": "editor-prompt-tuner", "verdict": "suggest_to_agent",
  "items": [
    { "id": "var:SLACK_CHANNEL_NAME", "value": { "value": "demo-prod", "proposed": "demo-dev", "changed": true },
      "reason": "rebind", "anchor": { "slot": "variables", "name": "SLACK_CHANNEL_NAME" } },
    { "id": "template", "value": { "type": "substitute", "before": "<seed text>", "after": "<rewritten text>",
        "diff": [ { "op": "-", "line": "be helpful" }, { "op": "+", "line": "refuse out-of-scope requests" } ] },
      "anchor": { "slot": "template" } }
  ],
  "coverage": { "engaged": 1, "total": 10 }, "meta": { "submitted": false }
}
```
`engaged` counts only rebound slots; the template-rewrite op rides along excluded from
coverage. The agent applies the bindings and (if present) the substitute op.

## Anti-pattern to avoid
A single textarea pre-filled with the prompt plus a generic Submit that posts the whole
blob with no slot detection — the agent must then re-diff to guess what changed and can't
recover the intended bindings. Capture the wording edit as one `substitute` op and each
binding as its own `var:*` item instead. Also banned: firing each edit as its own network
call (ops accumulate locally, one `Capture.submit()`); piling a heavy per-edit control
thicket onto the default — those belong only in the alternates below, under their trigger.

## Alternate interactions (swap the primary only when the trigger holds)
- **Suggesting-mode tracked edits + per-edit intent chips** — promote to primary only when
  the deliverable is prose the human rewrites heavily and the agent must see a true
  line-by-line before→after with a classified *why* per edit. Non-destructive tracked
  changes, a per-edit intent chip (tighten / expand / fix-factual / reword-tone /
  fix-format), a revertible changelog. Heavier; reserve for genuine copy-editing surfaces.
- **Span-anchored critique ("point, don't fix")** — when the reviewer can diagnose but
  should not author the fix, or the prompt is long and the value is precise localization.
  Read-only render; select a span, attach a typed critique with a single-select resolution
  (`agent-decides` vs `must-fix`), `editsMade:false`. Lead with it only when no editing is
  expected at all.

## Brand
PRINCIPLES.md + base.css; below are only this view's deltas. Slot highlighting and
warnings use functional status colors, not decoration. Fewer buttons (`Submit` + `Copy as
prompt` in the shared bar; `Reset text` + `Copy prompt` are the only per-view buttons).
Sentence-case headings. (No bundled example — this fork ships no example set.)
