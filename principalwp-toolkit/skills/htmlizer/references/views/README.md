# View reference library

Regeneration notes for the htmlizer view-types, one per cluster: when to use it, its capture
interaction (keyed to `_capture.md`), and its view-specific layout. **All house style defers
to `PRINCIPLES.md` (the rules) and `../../assets/base.css` (the encoding)** — never restate or
contradict a visual rule here; change it in those two files. This fork ships no bundled example
set — each view prompt is self-contained.

These are *content views* (a plan, a review, a design system), distinct from the Yes/Maybe/Skip
board (`../board-template.html`). Both are reached over `fs-link.sh` http:// links and must live
under the serve root to be served.

Each view is one self-contained `.html` that **links** the shared house style and capture
primitive — it never re-implements either. The scaffold is specified once, not here:
root-absolute `/assets/base.css` + `/assets/capture.js`, vendored diagram libs, the
`.page-header` + `<main class="wrap">` body layout, and the mandatory review-panel gate all live
in SKILL.md (asset copy, body skeleton, step 3.5) and `PRINCIPLES.md`.

## Shared components (in `base.css` — compose, do not reimplement)

Interaction primitives that live in `base.css`. A view **composes** them by applying the class
and toggling its state class from JS — never reimplement the markup, CSS, or animation per view:

- **`.fixed-actionbar`** (with `--shadow-bar`) — a page-owned fixed bottom bar. capture.js's own
  `.cap-bar` is themed separately (see `_capture.md`).
- **`.toast`** / **`.toast.is-show`** — a transient toast; toggle `.is-show` to reveal/hide it.
- **`.reveal`** / **`.reveal.is-open`** / **`.reveal-box`** — the progressive-disclosure reason /
  escape-hatch box (`PRINCIPLES.md` → Interactions). Container is `.reveal`; toggle `.is-open` to
  reveal it on selection; the revealed control is `.reveal-box`.

Style via classes; keep `id`s as JS hooks only (including `Capture.setGate` `focus` targets) —
never style by `#id`.

## Composing multiple views on one page

When content has several facets, a page combines components from more than one cluster under one
shared `Capture` (one `init` with a summed `total`, one derived `rollup`, vendored assets copied
for every component present). Full contract: SKILL.md step 1 (the compose-multiple-views contract). A view prompt's
"the whole page has exactly…" phrasing describes that view used **alone**; as one component among
several, its capture folds into the page's shared `Capture`.
