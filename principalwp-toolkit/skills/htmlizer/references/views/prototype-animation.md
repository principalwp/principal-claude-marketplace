# View: prototype-animation (bespoke)

Generation prompt for ONE view type. A future agent uses this to produce the view with
feedback-capture baked in. This view's interaction is **bespoke** — it does NOT use the
generic accept/flag rail. The preview IS the control. Read `PRINCIPLES.md` + `_capture.md`
first — house style and the Capture API live there; this note is only the
prototype-animation delta. Live state (e.g. "Using your edited motion") is **plain text**,
never a colored pill. The single prominent action is the shared capture.js "Submit to Claude"
bar; in-card controls are secondary — use fewer controls (PRINCIPLES.md → Buttons/controls).

## When to use

A single animation/motion treatment the agent produced (CSS transition, Framer-Motion/GSAP
tween, a spring) where the real decision is **tuning the feel** and the human can and should
hand back exact, implementable values — a cubic-bezier 4-tuple (or spring config) + duration —
not prose like "make it snappier." One hero animation per view; if the agent shipped multiple
discrete variants, switch to the A/B bake-off alternate below.

## Primary capture interaction — Adjust ONE motion setting, or keep the default

Keep the interaction to **one motion setting** (the easing curve + its duration) plus a
one-tap keep. The animation **auto-plays once on load** (the unprompted motion is the
discoverability signal — no instructional copy needed) and **re-plays on every change**.
Directly beneath the preview, in the reading path, render an inline editor (NOT a side rail)
per animation:

- **Draggable cubic-bezier curve** with two control-point handles — grab cursor, like
  cubic-bezier.com. Handles also nudge with arrow keys for precision. This is the bespoke
  value of the view.
- **Duration slider** (ms) with a live readout; the original value shown as a tick mark.
- **Preset chips** as **single-select** starting points (e.g. standard, ease-out, emphasized,
  snappy, gentle) that snap the curve when clicked. Style them as small buttons with a
  cranberry selected state — not decorative pills. (These are genuine small controls with
  short labels, so a native `<button>` is correct here.) **Escape hatch** (PRINCIPLES.md):
  the preset set is a *closed* set, so it MUST end with an **"Other / Custom…"** chip.
  Selecting it reveals (progressive disclosure) a free-text box where the human can paste an
  arbitrary `cubic-bezier(...)` or describe a spring/curve the presets don't cover. A valid
  4-number tuple updates the curve + preview live; anything else is still captured verbatim
  as the human's written request. The recommended/default preset stays pre-selected; "Other"
  is always available. Capture the typed text through `Capture.mark` (e.g. `preset:'custom'`,
  `customEasing:'<verbatim text>'`) so silence ≠ "the presets were enough." A stated
  recommendation follows PRINCIPLES.md's `.reco`/`(why)` pattern, never a pill or a separate
  "recorded" echo; a decision callout carries no `.callout-label` kicker (PRINCIPLES.md →
  Callouts).
- **When the project already defines a motion-token set** (e.g. a Material-3-style
  duration/easing scale), build the preset chips from those tokens instead of the generic
  standard/ease-out/emphasized/snappy/gentle list, so the reviewer can't mint an off-spec
  value. Fall back to the generic presets only when no such set exists.
- The live preview replays the real UI motions on every drag/slider/preset change so the
  change is felt, not guessed.

**Drop the excess controls.** Do NOT add a delay field, numeric bezier coordinate inputs, or a
separate ghost-A/B track and its replay button — they pile on controls for marginal value. A
single optional **Replay** button (re-fire the preview) and the one-tap **Keep brand default**
are the only in-card buttons; the page Submit is the prominent action.

Each animation has a **stable id** (e.g. `modal-open`, `hero-reveal`). The editor is anchored
to that id — never to re-quoted prose. Resting state is pre-marked keep-original, so coverage
is complete the instant the page loads.

**Readable labels stay selectable** (PRINCIPLES.md → Buttons/controls): a card with readable
prose (e.g. an A/B variant card labelled with its real params) is a `<div role="button"
tabindex="0">` with a keydown (Enter/Space) handler, never a native `<button>` wrapping the
label. Native `<button>`s are correct only for the small short-label controls (preset chips,
Replay, Keep brand default).

## What gets captured + payload (via window.Capture)

`Capture.init({ view:'prototype-animation', total:<#animations on page> })` on load.

Resting state is **keep-original** (default-to-keep). Touching any handle/slider/chip flips
the element to `use_edited` and records the concrete params; the one-tap "Keep" confirms the
original. Wire it to one `mark` per animation id:

```js
Capture.mark('modal-open', {
  interaction: 'easing_editor',
  verdict: 'use_edited',            // 'keep_original' | 'use_edited'
  preset: 'custom',                 // 'preset' | 'custom' — 'custom' = the Other… escape was used
  customEasing: 'cubic-bezier(.17,.67,.83,.67)',  // verbatim free text; omit when preset:'preset'
  original: { easing:'cubic-bezier(0.34,1.56,0.64,1)', durationMs:800 },
  edited:   { type:'cubic-bezier',  // 'cubic-bezier' | 'spring'
              easing:'cubic-bezier(0.22,1,0.36,1)', durationMs:320, delayMs:0 },
  changedFromOriginal: true         // false when verdict is keep_original
}, { note:'overshoot lingered' });  // note optional; anchor defaults to the id
```

For a spring keeper, `edited` is `{ type:'spring', stiffness:260, damping:24, durationMs:… }`.
`Capture.unmark(id)` reverts to default (un-engaged). `Capture.rollup(verdict)` records the
one overall routable verdict (`approve` | `request_changes`). On submit, `Capture.payload()`
yields the canonical shape — items carry the per-animation values, coverage records
engaged-vs-default so silence is unambiguous:

```json
{ "view":"prototype-animation", "verdict":"approve",
  "items":[ { "id":"modal-open", "value":{ "interaction":"easing_editor", "verdict":"use_edited",
    "original":{"easing":"cubic-bezier(0.34,1.56,0.64,1)","durationMs":800},
    "edited":{"type":"cubic-bezier","easing":"cubic-bezier(0.22,1,0.36,1)","durationMs":320,"delayMs":0},
    "changedFromOriginal":true }, "note":"overshoot lingered", "anchor":"modal-open" } ],
  "coverage":{"engaged":1,"total":1}, "meta":{} }
```

Use `Capture.onChange` to keep a live "N of M tuned" tally. The Submit button is **never
disabled** for validation — gate it with `Capture.setGate` (clicking with something missing
scrolls to and flashes the unmet field; see `_capture.md` → "Submit gating"). One batched
atomic submit via `Capture.submit()`; "Copy as prompt" is the only fallback.

## Anti-pattern to avoid

A static GIF/MP4 that cannot be scrubbed, re-timed, or adjusted, above a generic "What do you
think of this animation?" textarea — forcing the human to translate felt motion into lossy
prose the agent must re-encode into numbers. Equally bad: a bare thumbs-up/down that discards
the curve shape, duration, and beat the reviewer is already judging. The point of this view is
that the preview is **editable**; degrading it to display-plus-textarea is the failure mode.

## Alternate interactions

- **Timeline scrubber + timestamped flags** (secondary tab, good for multi-beat/sequenced
  motion the human can pinpoint but not author): draggable playhead with frame ticks, speed
  toggle (0.25x/0.5x/1x), and pinned flag markers. Mark per flag, anchoring the normalized
  time:
  `Capture.mark('onboarding-seq#0.30', { interaction:'timeline_flags', t:0.30, tag:'too_slow' }, { note:'second beat drags' })`.
  Tags: `too_slow`, `too_fast`, `bounce_overshoots`, `janky`, `robotic`.
- **A/B variant bake-off** (auto-promote to PRIMARY when the agent supplied 2–4 variants):
  synchronized "Replay all" grid, **single-select** "keep" across the cards (radio semantics —
  a human picks ONE; never rank), each card labelled with its real params. `Capture.mark('card-flip',
  { interaction:'variant_pick', chosen:'v2', variants:{ v2:{type:'spring',stiffness:260,damping:24} } },
  { reason:'v2 settles without the bounce' })`.
