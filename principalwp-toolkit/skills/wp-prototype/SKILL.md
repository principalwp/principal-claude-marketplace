---
name: wp-prototype
description: Clickable single-file HTML mockups of WordPress UI — settings pages, list tables, block + inspector sidebar, WP 7.0 DataViews/admin — built from real wp-admin CSS and WPDS tokens. Delivers one interactive mockup by default, or 2–3 side by side when the user is choosing between layouts. Use when the user wants to preview, mock up, or compare designs for a WP screen or block BEFORE writing real code. Do NOT use to build real blocks/plugins, block themes (wordpress-block-theme family), or to run actual WordPress (wp-trial).
---

# wp-prototype

Produce a **single self-contained HTML file** that looks like real WordPress and is clickable enough to judge a design — so UX decisions get made on a cheap mockup instead of on real plugin code. Typical uses: sketch a settings page or list screen before building it, work out what goes in a block's inspector sidebar, or put 2–3 layouts side by side to choose between them.

## Decide the shape before you build anything

**This is the first decision and it is easy to get wrong in the expensive direction.** There are two jobs here and they want opposite things:

| The request | What to build |
|---|---|
| Names one thing — "make me a prototype of X", "mock up the settings page for Y" | **One screen, properly interactive.** Plus its empty/loading/error states if it loads anything. No variants, no compare screen. Offer directions at the end if they'd help; don't assume them. |
| Asks for a choice — "which layout", "compare", "a few options", "help me decide" | **Two or three deliberately cheap variants**, mostly static, plus the compare screen. Then stop and ask them to pick one — interaction goes into the winner on a second pass. |

Interaction is both the expensive part and the valuable part, so spend it once rather than three times. A prototype you can click beats three you can only look at.

If you genuinely can't tell which job it is, ask exactly one question — *one design, or a few to choose from?* Do not ask how many; read that from the request. Do not ask a list of questions before starting.

## Supported versions

Fidelity is pinned in `assets/manifest.json` (currently **WordPress 7.0.2** admin CSS + **@wordpress/theme 1.0.0** design tokens). Classic-admin prototypes use WordPress's actual stylesheets — byte-faithful. WPDS prototypes (block editor, DataViews, WP 7.0 admin) use official design tokens plus hand-written component replicas in `assets/wpds-components.css` — convincing, not pixel-perfect.

Licensing: the harvested files in `assets/` are WordPress core / @wordpress/theme code, **GPL-2.0-or-later** — they are vendored third-party assets, not covered by this repo's own license.

**Rescrape on a new WP release:** run `scripts/harvest.sh` with the new WP tag (and optionally the @wordpress/theme version) — it re-downloads everything and rewrites the manifest. Afterwards: rebuild + eyeball the four shells, review `wpds-components.css` against the [Gutenberg Storybook](https://wordpress.github.io/gutenberg/) (machine-readable component list at `/index.json`), and update the version numbers in this section.

## Workflow

**1. Pick the dialect, then the shell:**

| The user is mocking… | Dialect | Shell |
|---|---|---|
| Plugin settings page, options screen, admin form | classic | `shells/settings-page.html` |
| WP_List_Table-style list screen | classic | `shells/list-table.html` |
| A block's canvas appearance + inspector sidebar controls | wpds | `shells/block-editor.html` |
| WP 7.0-style admin screen, DataViews list | wpds | `shells/wp7-admin.html` |

When unsure: plugin admin screens today are still overwhelmingly classic; block-editor UI is always wpds.

**2. Copy the shell** to a working file (`.prototypes/` in the project — add it to `.gitignore` first if it isn't there — or the scratchpad for throwaways). The shell is small and readable — the heavy CSS is pulled in later. **Never edit or Read the built output or the files in `assets/` — they are huge and generated.**

**3. Fill the slots.** Each shell marks its editable regions with `SLOT:` comments (content, menu, canvas, inspector, styles). Compose from the files in `snippets/classic/` and `snippets/wpds/` — they carry the canonical markup for form tables, notices, tabs, metaboxes, panels, controls, DataViews, buttons, pagination; `snippets/runtime.html` covers the interactive behaviours below. Use realistic content (the user's actual field names and labels), never lorem ipsum.

**Seed the awkward case.** At least one piece of the sample content should misbehave — an image missing its alt text, one caption three times longer than the rest, a portrait photo among landscapes, a title that wraps to three lines. Tidy, uniform sample content is how a mockup looks fine and then falls over on real data, and the awkward items surface the editorial decisions WordPress will force anyway: media wants alt text, links want a new-tab decision, headings want a level, collections want their one-item and fifty-item cases. Flag problems with WordPress's own components — canonical markup for the two flags (warning badge overlaid on the item, matching inspector notice) is at the bottom of `snippets/wpds/buttons-notices.html`; classic screens use `snippets/classic/notices.html`. Never invent scaffolding styles for this — the flag should look like something the block could ship.

**Icons:** dashicons is bundled and is the right choice for classic screens, but it is a small, dated set — it has no sun, no chart, no arrows-in-circles. Rather than force a wrong dashicon, hand-write a tiny inline `<svg><symbol id="…">` sprite near the top of `<body>` and reference it with `<use href="#id">`; two or three 2px-stroke line icons read as a deliberate set. Do not invent "official" Gutenberg icon paths from memory — either use a real one you are sure of, or draw your own and say so.

**4. Variants — only on the choosing path.** If the request named one thing, skip this step entirely and go to step 5. Otherwise duplicate the `<section data-screen="…" data-title="…">` per variant — give each a short opinionated title ("A — everything in one panel"), a unique screen id, and **rename any radio `name=` attributes per variant** (the wpds shells have no `<form>`s, so same-name radios group document-wide and checked state leaks between screens — prefix with the screen id, e.g. `a-layout` / `b-layout`). A floating switcher bar appears automatically when there is more than one screen. Annotate design rationale with `data-note="…"` on any element; a ✎ notes toggle appears in the bar.

**States earn a screen on either path.** Anything that loads data has an empty state, a loading state, and a failure state, and those are usually where the unresolved design questions actually are — what does the block show before a location is picked, or when the API is down? Add them as their own screens (see `examples/reviews-block-variants.html`, which opens on a setup state) rather than only mocking the happy path. Two or three screens total is normal even for a single-design job.

**Give each screen a `data-subtitle`** — one honest sentence naming the trade-off, not a description of what's on screen. It appears in a strip above the switcher bar, so the reasoning is readable the moment someone switches without them having to find the ✎ button. Say the cost, not just the appeal.

**End with a compare screen — on the choosing path only.** With two or more *directions*, add a final `data-screen` that drops the editor chrome and puts them side by side on one row — `snippets/compare.html` has the markup. Flipping between full-screen mockups one at a time is a bad way to choose between them; this is the view where someone actually decides. Do not add one for a single design with a couple of state screens; there is nothing to compare.

**Make the block behave like the block. Don't build what sits behind it.**

That line decides every wiring question. The block's own behaviour is the thing being judged, so it should work: a carousel's arrows, dots, autoplay and drag-to-reorder; a gallery's add and remove; a tab strip's tabs; captions you can type into; a toggle that makes a row appear. A carousel you cannot click is barely a prototype.

What sits behind it should not be built: real uploads, a working media library search, an amortisation schedule, a live API, saving anything. Those cost the most and settle nothing — a fixed, realistic value answers the design question just as well and is honest about being a mockup.

On the choosing path this applies to the winning variant, not to all three. `data-mirror` and `data-reveals` cover the cheap sidebar-to-canvas cases (see `snippets/runtime.html`); anything richer is worth hand-writing for the block itself.

**At three or more screens, share the chrome.** Repeating the editor shell per screen becomes most of the document. Move it into a `<template data-chrome="editor">` and let each screen supply only its canvas and inspector — `snippets/chrome-template.html`. Keep the working file out of whatever directory you hand over.

**5. Build the single file:** run `scripts/inline.sh` with the working file and an output path — it replaces the `/*@inline …*/` markers with the bundled CSS/JS (~300 KB classic, ~120 KB wpds, fully offline, icons embedded).

**6. Look at it before handing it over.** Screenshot each screen and actually read the images — layout collisions are invisible in the markup. The block toolbar in particular floats above its block and will land on a heading if the block sits too close to one. If the mockup shows a calculated figure, check one against a known-good value first; a visibly wrong number ends the design conversation before it starts.

```bash
CHROME=$(ls -d ~/.cache/ms-playwright/chromium_headless_shell-*/chrome-headless-shell-linux64/chrome-headless-shell 2>/dev/null | tail -1)
for s in variant-a variant-b; do
  "$CHROME" --headless --no-sandbox --disable-gpu --hide-scrollbars --window-size=1440,1000 \
    --screenshot=shot-$s.png "file://$PWD/prototype.html#/$s"
done
```

(The binary is named `chrome-headless-shell`, not `headless_shell` — that is the LICENSE file. If no Chromium is installed, skip this and say you could not check it visually.)

**Then drive what you wired.** A screenshot proves the layout, never the behaviour — it cannot tell you that a caption overlay is sitting on top of the reorder buttons, or that clicking a thumbnail deselects the block. Append a temporary script to a copy of the built file that clicks through the interactions in order and logs what it finds, screenshot the result, then delete the copy. Anything you made interactive is worth one pass.

**Deliver.** Default: tell the user the output path to open in a browser. When they want click-to-choose feedback routed back into the session, serve it via the **htmlize** flow instead.

**7. Graduate.** Once a variant wins, the mockup's markup/classes map nearly 1:1 onto real WP APIs (`add_settings_field`, `WP_List_Table`, `InspectorControls`). For validating in a real WordPress, hand off to `wp-trial` or WordPress Playground — this skill stops at mockups.

## Runtime interactions (built into every shell)

- **Screens:** `<section data-screen="id" data-title="Label" data-subtitle="The trade-off in one sentence">`, hash-routed (the URL becomes #/id) — back button works, states are linkable. The subtitle shows in a strip above the bar that overlays the page rather than pushing it, and the ⓘ button hides it.
- **Compare screen:** a screen wrapped in `.wpp-compare` shows variants side by side with no editor chrome — see `snippets/compare.html`.
- **Tabs:** `data-tab`/`data-tab-panel` inside a `data-tab-group` (works for classic nav-tabs and WPDS tab panels).
- **Collapsibles:** Gutenberg `components-panel__body` titles and classic `.postbox` handles toggle on click.
- **Generic toggle:** `data-toggle="#selector"` + optional `data-toggle-class`.
- **Native controls:** WPDS toggles/radios/segmented controls are real inputs — they flip without JS.
- **Value swapping:** a control marked `data-swap-control="units"` rewrites every `data-swap="units"` element in the same screen from its own `data-<value>` attribute — one mockup shows °F and °C, free and pro, logged-in and logged-out. Cheaper than a second variant.
- **Viewport preview:** `data-viewport="desktop|tablet|mobile"` buttons narrow the canvas like Gutenberg's View menu, so a layout that breaks at phone width breaks in front of the reviewer. Already in the block-editor shell.
- **Charts:** `data-chart="54,55,56"` plus optional `data-chart-type` (area/line/bars), `-labels`, `-values`, `-height`, `-suffix`. No library; inherits the surrounding `color`.
- **Control → canvas:** `data-mirror="key"` on an input writes into `[data-mirror-target="key"]`; `data-reveals="key"` on a checkbox shows/hides `[data-reveal="key"]`.
- **Shared chrome:** `<template data-chrome="editor">` with `[data-slot]` markers, screens supply `[data-fill]`.

Full markup for the interactive ones is in `snippets/runtime.html`; the template pattern is in `snippets/chrome-template.html`.

## Layout

```
assets/     harvested CSS (do not read/edit; regenerate via harvest.sh) + manifest.json
            wpds-components.css (hand-written replicas), wpp-runtime.{css,js}
shells/     4 copy-from templates with SLOT: markers and @inline markers
snippets/   canonical markup per pattern: classic/, wpds/, runtime.html,
            compare.html, chrome-template.html
scripts/    harvest.sh (rescrape), inline.sh (build single file)
examples/   worked samples (settings variants, block inspector variants, list views)
```
