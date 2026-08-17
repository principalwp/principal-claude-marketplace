# View: visual-designs-light-dark (bespoke capture)

Generation prompt for ONE view type. The interaction is **bespoke to this pattern** — it does
NOT use the generic verdict rail. Light/dark is a first-class evaluation axis, so the verdict
is captured **per surface**, not per design and not as one blended score. Read
`PRINCIPLES.md` + `_capture.md` first — house style and the Capture API live there; this note
is only the visual-designs-light-dark delta. (No bundled example — this fork ships no example
set.)

## When to use

A designer-agent presents a set of compositions for **one** design direction, rendered on
**both** a light and a dark (navy) surface. The human's decision is *"does this read on each
surface"* — a system can be fine in light and break contrast in navy. Use this whenever dark
mode is a real evaluation axis, not a cosmetic skin.

The navy stage here is the surface under review, not page chrome — it is not a violation of
the no-navy-hero rule.

## Primary capture interaction — one clear verdict per surface

A single **surface toggle** (`Light` / `Navy`, single-select) flips the whole stage between
the two surfaces. Under the stage sits **one verdict control** — a single-select rail **Ship /
Needs work / Reject / Other…** (`role="radio"` in a `role="radiogroup"`; the checked radio
fills cranberry) — that applies to **the surface currently shown**. Flip to Light, give the
Light verdict; flip to Navy, give the Navy verdict. **Two cells total**, one decision each.

- The toggle + the verdict-panel label (`Verdict for the Light surface`) make the per-surface
  axis self-evident; no help text needed.
- **Resting state is Ship** (default-to-keep): an un-rated surface counts as Ship, so a human
  who taps nothing still produces a full, honest result.
- **Escape hatch** (PRINCIPLES.md — never trap the reviewer in a closed set). The verdict is
  a fixed option set, so it carries an **"Other…"** radio that, on selection, reveals the
  free-text box — where the box *is* the verdict the three presets can't say. And every
  changes-requesting verdict — **Needs work** and **Reject** — reveals the same box on
  selection to capture the reason. Reveal on selection (progressive disclosure), never
  always-on; the typed text rides through `window.Capture` as `opts.note`. "Other" means
  neither design was accepted, so it rolls up as `request_changes` — the one blocking
  gesture this view exposes.
- **One optional note** per surface, disclosed on Needs work / Reject / Other (progressive
  disclosure): one line on what to fix — or, for Other, the verdict itself.

**Do NOT add:** a per-composition verdict on every card, a "this is the direction" pick
(there is one direction — these are compositions of it, not competing entries),
multi-select downgrade-reason chips/pills, or a star rating. One verdict per surface + one
optional note is the whole interaction.

## What gets captured (via window.Capture)

Two stable ids, one per surface: `vd:light` and `vd:dark`. `value` is the verdict string; the
note rides in `opts.note`. Wire with `Capture.init({ view: 'visual-designs-light-dark',
total: 2 })` and one `Capture.mark(id, verdict, { note, anchor })` call per surface — the
"Other…" escape hatch marks `value:'other'` with the box text as the note, and
`Capture.unmark(id)` reverts a surface to the default Ship. `Capture.rollup(...)` derives the
one routable verdict: any reject or other → `request_changes` (declining a surface is
blocking) | else `approve` — needs_work is feedback and rides along in `items`.

`Capture.payload()` then yields the batched shape (one atomic POST on Submit):

```json
{
  "view": "visual-designs-light-dark",
  "verdict": "approve",
  "items": [
    { "id": "vd:light", "value": "ship", "anchor": "light" },
    { "id": "vd:dark",  "value": "needs_work", "note": "body text ~3:1 on navy, below 4.5", "anchor": "dark" }
  ],
  "coverage": { "engaged": 2, "total": 2 },
  "meta": {}
}
```

The agent reconstructs the cross-surface asymmetry directly (ships light, needs work in
navy) plus the per-surface note. That asymmetry is the whole value — do not collapse it.

## Anti-pattern to avoid

A single overall star rating, or one generic "Leave a comment" box, that blends light and
dark into one undifferentiated score — it destroys the cross-surface signal, so the agent
never learns the system ships in light but fails contrast in navy. Equally bad in the other
direction: a per-composition × per-surface grid plus a "pick the direction" radio plus
multi-select reason pills — that is clutter this view does not use. Exactly two single-select
verdicts (one per surface), each with one optional note.

## Alternate interaction (single-winner only)

**Cross-surface A/B preference** — when there really are 2–3 *competing* finished directions
and the question is which one is most stable across surfaces. Show them with ONE synced
surface toggle and let the human pick **one** winner in light and **one** in navy, each with a
required short reason: `Capture.mark('winner:light','design-a',{note})`,
`Capture.mark('winner:dark','design-a',{note})`. Use only for a true one-of-N choice; never
rank, never multi-select. For a single chosen direction needing per-surface sign-off, the
primary interaction above is the default.
