# `window.Capture` — the shared feedback primitive

Every htmlizer view renders its **own** native affordances but routes all feedback through this
one API — local batching, atomic submit, clipboard fallback, coverage, submitted-state. Never
reimplement it per view.

- **Canonical source (edit here):** the skill's `assets/capture.js`. At generation time it is
  copied into the shared `$SERVE_ROOT/assets/` and linked same-origin, root-absolute
  (`<script src="/assets/capture.js"></script>`); the served copy is *derived* — fix bugs and
  change behavior in the canonical file, never the copy (SKILL.md → "Lay down the assets").
- **Deps:** none (vanilla, brand-agnostic). **Validate:** `node --check assets/capture.js`.

## API

| Call | Purpose |
|------|---------|
| `Capture.init({ view, total })` | Set the view id and the count of feedback-bearing elements present (for coverage). Mounts the action bar. Idempotent. |
| `Capture.mark(id, value, opts)` | Record a one-tap disposition/value for a **stable element id**; marks it engaged. `value` may be a string (`'keep'`/`'cut'`/`'flag'`), a number, or an object. `opts`: `{ reason, note, anchor }`, all optional. |
| `Capture.unmark(id)` | Revert `id` to its default (un-engaged); removes it from coverage. |
| `Capture.rollup(verdict)` | Set the single overall routable verdict (`approve` or `request_changes`). |
| `Capture.payload()` | Return `{ view, verdict, items:[{id,value,reason,note,anchor}], comments, coverage:{engaged,total}, meta }`. `comments` is the free-text general-comments field (string, or `null` when blank). |
| `Capture.submit()` | POST `payload()` as JSON to `window.CAPTURE_SUBMIT_URL`. On ok → persistent **Submitted / Resubmit** state (Submitted badge, green Submit button — `--cap-ok`). On failure → copies a prompt-formatted version to the clipboard (file:// textarea fallback) and surfaces it. If a gate is unmet it does **not** POST — it scrolls to and flashes the missing field (below). Returns a `Promise`. |
| `Capture.setGate(fn)` | Register a pre-submit validator. `fn()` returns `{ ok, reason?, focus? }`. While `ok===false`, Submit stays **clickable** (never disabled); clicking it brings `focus` into view and flashes it. See "Submit gating". |
| `Capture.setCoverage(fn)` | Register `fn(id, rec) -> boolean` so only primary, bounded units count toward `coverage.engaged`. No filter ⇒ every marked item counts. |
| `Capture.setMeta(obj)` | Merge view-supplied metadata (e.g. proposal baselines, the human's diff against a proposal) into `payload().meta`. |
| `Capture.onChange(cb)` | Subscribe to any mark/unmark/rollup change: `cb(payload, change)`. Returns an unsubscribe function. Use for live tallies. |

### Semantics worth knowing

- **Stable-id anchoring.** Keys are element/step/node/edge/section/token ids — never re-quoted
  prose. `mark()` throws if `id` is null.
- **Progressive disclosure.** `mark()` *merges*: `mark(id,'cut')` then `mark(id,'cut',{reason})`
  keeps the value and adds the reason. A one-tap signal is enough; reason/note/anchor are optional
  deeper input.
- **Coverage.** `coverage.engaged` = number of marked ids, `coverage.total` = the `total` from
  `init`. Silence is unambiguous: an unmarked id is *skipped*, a marked one is *judged*. Resting
  state is un-engaged/acceptance (default-to-keep); effort scales with disagreement.
- **One batched atomic submit.** Marks accumulate locally; only `submit()` touches the network,
  exactly once. No per-element network calls. "Copy as prompt" is the only fallback.
- **Delta-vs-proposal.** Where the agent proposed something, store the human's result in `value`
  and the diff against the proposal in `value`/`reason` (e.g. `value:{ from:'B', to:'A' }`).

## General comments — auto-injected, every page

`init()` injects a **"General comments"** free-text field as the last content block (normal flow,
above the fixed bar), guaranteeing every page a way to comment on the whole. It is part of the
primitive — **do not hand-add your own per view.** Its value rides along as the top-level
`comments` string in `payload()` (and the clipboard-fallback prompt), `null` when blank, and
never counts toward `coverage.engaged`. It self-centers to the page measure (`--cap-maxw`, themed
to `--maxw` by `base.css`) so it aligns with `.wrap`. A view's `setGate` still governs Submit — a
comment alone won't bypass a required verdict.

This is the always-present **supplement**, not the "single generic comment box" anti-pattern the
view prompts warn against (that anti-pattern *replaces* per-element feedback with only a generic
box). If a view renders its OWN whole-page comment affordance (rare — most views anchor feedback
to elements), set `window.CAPTURE_NO_COMMENTS = true` before `init()` to suppress the built-in,
and route its own global comment into the payload (e.g. `Capture.setMeta({ comments: value })`).
Do **not** set the flag just because you have per-element reason/note boxes — those aren't a
comment-on-the-whole, and setting it strips the page's guaranteed catch-all.

## Submit gating — never a disabled button; click takes you to the problem

A required-field gate must **not** present as a greyed-out, un-clickable Submit. The button stays
clickable; clicking it with something missing scrolls to the first unmet field and flashes it (a
brief shake + a cranberry ring that holds after the scroll settles). No modal, no error list —
the field itself is the message. This is built into the primitive; a view gets it by registering a
gate that reports *which* element is missing:

```js
Capture.setGate(function () {
  if (!verdictPicked())       return { ok:false, reason:'Pick a verdict to submit.',        focus:'#verdict-controls' };
  if (flaggedWithoutReason()) return { ok:false, reason:'Add a reason to the flagged step.', focus:firstFlaggedReasonBox() };
  return { ok:true };
});
```

- **`focus`** may be a DOM element, a CSS selector, an **array** of either (first that resolves
  wins), or a **function** returning any of those. Resolve it to the element the reviewer must act
  on. Build a revealed reason / escape-hatch box from the shared **`.reveal` / `.reveal.is-open` /
  `.reveal-box`** primitive (toggle `.is-open` on selection) — do not reimplement disclosure per
  view. See README → "Shared components".
- Return failures in **priority order** — the gate flashes the **first** `ok:false`, so order the
  checks the way you'd walk the reviewer through them (top of page first).
- **The gate must be a pure read.** Never call `Capture.mark`/`unmark`/`rollup`/`setMeta` from
  inside it, directly or through a helper. The gate runs inside the bar render, and a write from
  there re-enters the render, which calls the gate again; `mark()` (unlike `rollup()`) does not
  short-circuit on an unchanged value, so nothing converges. The symptom is a dropped frame (the
  `try/catch` around the gate swallows the `RangeError`, so the bar reads as unblocked — it used
  to be silent). Keep one read-only function for the gate and a separate writer wired to your
  `change`/`input` handlers.
- `capture.js` owns the scroll-settle + flash (lands after the smooth scroll finishes, honors
  `prefers-reduced-motion` → ring only, no shake); the view never animates or disables anything.
  Keep `reason` to **one short line** (it shows as ambient context in the bar and the button
  tooltip) — the flashed field carries the meaning.

## Action bar / styling hooks

`init()` mounts a bar. If the page provides a host (`id="capture-bar"` or `[data-capture-bar]`),
Capture renders the controls **into** it and leaves positioning to the page; otherwise it injects
its own fixed bottom bar. It carries "Submit to Claude" + "Copy as prompt", a live coverage
readout, a persistent "Submitted" badge, and a hidden textarea for the manual-copy fallback.

Do **not** theme it per view: `base.css` already re-themes it to the light house style (light
surface bg, ink text, cranberry accent) using `:root:root` to out-specify capture.js's own navy
`:root` defaults — don't re-declare the `--cap-*` mapping per view, and don't reintroduce the navy
bar. Class hooks: `.cap-bar` (host, gets `data-submitted` / `data-fallback`), `.cap-status`,
`.cap-cov`, `.cap-verdict`, `.cap-badge`, `.cap-msg`, `.cap-actions`, `.cap-submit`, `.cap-copy`,
`.cap-fallback`.

## Minimal usage

```html
<script src="/assets/capture.js"></script>
<script>
  window.CAPTURE_SUBMIT_URL = "/?t=fae7eb7a34b72790199cfed6a113d51d"; // page sets this

  Capture.init({ view: "review", total: document.querySelectorAll("[data-fb-id]").length });

  document.querySelectorAll("[data-fb-id]").forEach(function (el) {
    el.querySelector(".keep").addEventListener("click",  function () { Capture.mark(el.dataset.fbId, "keep"); });
    el.querySelector(".cut").addEventListener("click",   function () { Capture.mark(el.dataset.fbId, "cut", { reason: el.querySelector(".why").value }); });
    el.querySelector(".reset").addEventListener("click", function () { Capture.unmark(el.dataset.fbId); });
  });

  document.querySelector("#verdict").addEventListener("change", function (e) {
    Capture.rollup(e.target.value); // approve | request_changes
  });

  Capture.onChange(function (p) {
    document.querySelector("#tally").textContent = p.coverage.engaged + "/" + p.coverage.total + " judged";
  });
  // submit is handled by the injected bar; call Capture.submit() directly if you add your own button.
</script>
```

`submit()` resolves to `{ ok:true, payload }` on success, or `{ ok:false, error, copied, prompt }`
when it fell back to the clipboard — so a custom button can react without reading the DOM.
