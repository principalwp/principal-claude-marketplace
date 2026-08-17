# View: design-system (mode: rail)

Generation prompt for a **generated token-sheet** view — color ramps, type scale,
spacing/radii tokens rendered as swatches for sign-off. Read `PRINCIPLES.md` +
`_capture.md` first — house style and the Capture API live there; this file covers only
what's native to this view. (No bundled example — this fork ships no example set.)

## Rail mode / when to use
A token sheet is a flat list of independent, atomic tokens — most of them correct. Use
the shared disposition rail: one per-token Keep / Make changes toggle, default-to-keep,
coverage tracked. A flag carries an optional one-line note (what's wrong, and if known,
the right value). That's the whole interaction — do not invent bespoke plumbing. Fits a
sign-off pass over an existing or agent-extracted token set where most tokens are correct.

## Primary capture interaction
Each swatch/type/spacing/radius row carries one **Make changes** toggle
(`.btn.btn-secondary.btn-sm`, `aria-pressed`, fills cranberry when pressed). Resting
(un-pressed) = keep. Place it at the **trailing end of the row**, after its content, never
in the title/header slot (PRINCIPLES.md → Interactions: the compact-row case of the
bottom-left flag rule).

Row content — name, hex, type sample, spacing/radius value, description — stays in plain
`<span>`/`<div>` elements so it's selectable (PRINCIPLES.md → Buttons: never wrap readable
prose in a `<button>`); only the toggle itself is a `<button>`.

- One control per token (100% coverage); tap to flag, tap again to un-flag.
- One optional note, disclosed only on flag: a short free-text line ("fails contrast on
  white", "should be #5A6678"). The corrected value, if any, lives here as plain text —
  do not build a typed override editor, color picker, or stepper.

**Do NOT add:** multi-select reason-code chips/pills, a three-state Keep/Change/Reject
rail, contrast AA/AAA/FAIL badges, alternate-swatch radio pickers, or inline value
editors. One flag + one note is the whole interaction.

A token-disposition callout, if used, carries no `.callout-label` kicker (PRINCIPLES.md →
Callouts).

**Discoverability:** a live plain-text tally (`.tag`, e.g. "2 of 33 tokens flagged · the
rest are kept"); the shared Submit bar self-labels with coverage; "Copy as prompt" is the
`file://`-safe fallback.

## What gets captured — via window.Capture
`id` is the stable token path (`color.accent`, `space.16`, `type.body`), never re-quoted
prose. `value` is `"flag"`; the note rides in `opts.note`.

```js
Capture.init({ view: 'design-system', total: NUM_TOKENS });
Capture.mark('color.accent', 'flag', { note: 'reads pinkish — should be #8C3344' });
Capture.mark('space.16', 'flag');           // flag with no note is fine
Capture.unmark('color.accent');             // un-flag → back to keep
Capture.rollup('approve');                  // flags are feedback; verdict is always approve
```

```json
{
  "view": "design-system", "verdict": "approve",
  "items": [
    { "id": "color.accent", "value": "flag", "note": "reads pinkish — should be #8C3344" },
    { "id": "space.16", "value": "flag" }
  ],
  "coverage": { "engaged": 2, "total": 33 }, "meta": {}
}
```

## No verdict radio needed
Flags are feedback, not blocking, so the derived verdict is always `approve` —
PRINCIPLES.md's "fixed option set needs an Other…" rule has nothing to attach to here. Do
not add a Ship/Needs-work/Reject rail to manufacture one; that rail belongs to
`visual-designs-light-dark.md`'s surface-check, not here.

## Anti-pattern to avoid
A single freeform "Feedback on these tokens" textarea + Submit — it discards the
per-token anchor and forces the agent to guess which swatch is meant.

## Brand / house style
PRINCIPLES.md + base.css; below are only this view's deltas. Swatches and labels large
and readable — generous chip height, 15px mono token names, 14px hex. No contrast
badges/status colors. Flat.
