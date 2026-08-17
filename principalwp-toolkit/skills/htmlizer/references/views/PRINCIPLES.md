# View house style — standing rules

Non-negotiable design rules for every htmlizer view page — implement them, don't re-litigate per
view. The reusable encoding lives in `assets/base.css` (pages `<link>` it, add only page-specific
layout). These are **utility / review tools, not a landing page**: optimise for a human reading the
content and giving one clear signal.

## Information priority — verdict FIRST, questions LAST
Order every page (and every tab/row) by **what the reviewer must decide**:
**verdict → evidence → explainers → questions.**

- **Verdict first, open by default** (leftmost tab / top). Evidence (diff, data) next.
  Agent-authored prose (write-ups, PR descriptions, explainer flowcharts) is the lowest-priority
  *reading* — after the evidence, never default-open.
- **Blocking open questions and calls go at the BOTTOM** (last / rightmost tab).
- **The verdict/decision control sits at the TOP of its view**, under the one-line lede (question
  callouts are the exception, rendered at the bottom).
- **No eyebrow-style kickers on decision controls** — no framing label, leading glyph (⚑/✓/→), `·`
  separator, "· required" prefix, or `.callout-label` on a decision callout.
- **Never re-represent a decision — the control's selected state IS the confirmation.** No status
  line echoing the value ("recorded: X", "✓ recorded", "✗ no choice yet"); a missing *required*
  answer is signalled by the **submit gate** (`_capture.md` → Submit gating), not an inline "still
  needed" label. The one sanctioned aggregate is a single **"N decisions still need an answer"**
  count in the submit bar.
- **A clickable navigator only exposes targets that exist** — when a summary list is broader than
  what's rendered, carry an open-target field per row and tag non-openable rows.
- **Interaction must fit the artifact** — a narrative is approved-or-rewritten as one decision, a
  diff adjudicated per hunk, a flow per node.
- **Count only true blocking decisions** in the "outstanding" count; secondary decisions get no
  per-item ✓ marker. Adding/removing an interaction: keep coverage / CAP_TOTAL in sync and remove
  its CSS, dead DOM hooks, and counter contribution.
- **No standalone overall verdict — derive it from the answers.** Don't make the human pick a
  separate global Approve / Request changes. Instead:
  1. **Every decision is an explicit open call** — a question with options + "Other…".
  2. **When the view proposes changes beyond the itemized calls**, add ONE call — **"Apply the rest
     of the proposed fixes (everything not in an open call above)? — Yes / No / Other…"** (No/Other
     reveals a reason box).
  3. **The verdict is COMPUTED, exactly TWO values — `approve` / `request_changes` — never a separate
     control.** A call = Other and a flagged step are FEEDBACK (ride in the payload `items`, never
     change the verdict); `request_changes` derives only from a blocking gesture ("apply the rest" =
     No, or a blocking question's answer). Set via `Capture.rollup(...)`.
  4. **The submit bar carries only progress + Submit** — no verdict buttons.
  With no changes beyond its calls, derive the verdict from the calls alone.

## Composition — compose views, don't cram them
- Combine components from more than one view only when the content genuinely has multiple facets.
- **Each component earns its place** — no kitchen-sink page.
- **One page = one measure, one `Capture.init`, one derived verdict** (whether one view's components
  or several).
- **Default to a single view when one fits.**

## Review commentary is exception-only
Generated review surfaces flag what the human must know, **not what went well** — verdict/proposal
callouts, inline diff comments, risk notes, PR-description prose.

- **Surface ONLY** changes, risks, follow-ups, open questions, things the human must act on.
- **Cut entirely** praise, affirmations, "what's good", "X is correct" — a comment that only
  validates carries no signal, so delete it (and remove its dead row/reference).
- A verdict states its lean (approve / request changes), but its *body* lists only the
  follow-ups/risks behind it, never the reasons it's good.

## Research / findings — surface only what is relevant to the human
Same exception-only discipline: a findings block informs the human's **decision**, not how the
system works.

- **Keep ONLY** a finding that **contradicts a planning assumption** or is **new information that
  changes a decision**.
- **Cut every implementation / bug-fix detail** (API shapes, required flags, token locations) — it
  belongs in the step body. If a finding doesn't change a call, delete it.

## Clarity & detail — write for an overview-level reader
Exception-only governs *what* to show; this governs *how*. Everything shown must be
**understandable to a reader with only an overview understanding** of the code or problem — the
reviewer shouldn't have to open the codebase.

- **Explain fully — detailed, not insider shorthand.** Expand acronyms, say what a named
  file/function *does* the first time it appears, give the cause → effect chain. A terse note that
  only makes sense if you already know the code is a clarity failure.
- **Don't assume shared context.** Define domain terms; state the "so what".
- **One idea per sentence.** Target ~25 words, ceiling ~35. No semicolon chains; keep a subject next
  to its verb.
- **Name the plain thing — a coined term is a smell even when you define it.** Prefer the plain
  everyday word ("the check that reads the page cold," not "the source-blind sufficiency pass");
  gloss an unavoidable coined term at first use. **Defining jargon does not make prose plain;
  replacing it does.** (`review-sufficiency.md` Pass 2 enforces this and owns the full treatment.)

## Voice — page prose follows the user's stated preferences
Generated prose on a page (ledes, context lines, findings, step bodies, `(why)` rationales, Shape B
`detail` HTML) is Claude replying to the user, and follows the same rules as any other reply. **Do
not restate or copy those rules here — resolve them at generation time and defer:**

- **Apply whatever is in force for THIS conversation** — the user's standing instructions plus any
  session-level switch. When they change, pages change with them; nothing here pins a stale copy.
- **A page is a reply, not an exemption.**
- **No stated preference?** Fall back to "Clarity & detail" plus point-first ordering: answer/decision
  first, reasoning after.

## Depth — default to rich, context-appropriate detail
When presenting OPTIONS or DECISIONS, default to **information-DENSE** content — one line + a thin
blurb per item is a failure.

- **Give enough to decide without leaving the page:** the tradeoffs that distinguish the options
  (pros / cons, when-to-use / when-not, cost/risk, dependencies, what it changes) plus whatever the
  question demands.
- **Choose the sections DYNAMICALLY — don't hardcode a fixed template.** Those headings are examples;
  read the actual question and context.
- **Dense ≠ padded** — exception-only still applies; cut praise, restated summaries, trivia.
- **Put the depth where it renders.** In Shape B this is the item's `detail` (rich HTML — `<h4>`,
  `<ul>`, `<span class="pos/neg">`) at body color under the Details toggle; keep `summary` to the
  one-line gist. For a small board (≈6 items or fewer) set `open:true`.

## References and evidence
Every artifact a page names (a file, PR, ticket, Slack message, agenda, patterns doc) has **source
information** behind it: the thing being decided on. Surface THAT source, not an argument about an
artifact the reader can't see. **Sufficiency:** a decision block is **decidable from the page alone**
— the thing being decided is shown or linked on the page, every option carries its consequence (not
just a label), and no required background lives only off-page. Reasoning may be on-page; the
**evidence must be reachable from the page.** "Well-reasoned but under-sourced" is the exact failure.

- **Show the source, never a fabrication.** When the artifact doesn't exist yet, show the information
  that IS its source (e.g. the talking-point bullets a message will be built from) and label it
  **planned / not yet created**. NEVER invent the contents.
- **Every file/path reference uses the `.file` style** — monospace, dotted underline, distinct from a
  plain `<code>`, everywhere it appears (code list, decision line, or mid-prose).
- **Every reference resolves — the resolution ladder**, in order:
  1. **SHA-pinned GitHub blob link with a line anchor** when the repo has a remote —
     `<a class="file" href="https://github.com/owner/repo/blob/<sha>/path#L76-L80">path:line</a>`,
     resolving repo + SHA at generation time (a linked `.file` shows the accent + a trailing ↗).
  2. **else a local link** minted with the bundled `references/fs-link.sh`.
  3. **else, only for a short gloss** — a hover/focus popover (`.file.has-pop` + `.file-pop`, the
     `.why-pop` mechanism, `tabindex="0"` on the trigger).
  A reference with none of these (a dotted underline that delivers no definition) is a bug. Code not
  in a resolvable repo still gets `.file` but stays unlinked — say so, never emit a dead link.
- **Load-bearing source lives on the page, not in a popover.** When a decision rests on a reference's
  actual CONTENT (not just what it is), put that content in a **visible, selectable, printable on-page
  section** with a stable `id`, linked via **"Read more:"** (`.readmore`). `.file-pop` is for short
  glosses only; a load-bearing planned artifact is `.file.planned` linked to that section.
- **Non-file artifacts too.** A PR #, message, agenda, or ticket is linked (GitHub / Jira / Fireflies
  URL, or fs-link), or — if it's the page's own deliverable-to-be — has its load-bearing source shown
  on-page and labeled planned. A number cited N times with no link and no content is the failure.
- **Diagrams link their references** the same way, reusing the SAME href the prose uses. **Inline
  SVG**: wrap the node's `<text>` (and `<rect>` where practical) in `<a href>` (no JS). **Mermaid**
  (vendored): a `click <nodeId> "<url>"` directive. **HTML-box**: the box is an `<a>`. A node that
  can't link is rendered plain (not dotted-file-styled), never faked.

## No time or effort estimates
Never put a duration or effort estimate on anything (no "~1.5h", "~2–3 days", "~5–7 days over 2–3
weeks") — in decision blocks, step bodies, tables, or tags. The only exception is when the user
explicitly asked for a timeline. **Real calendar facts from the source are NOT estimates and stay:**
a meeting stated on the call ("Friday 10:00 PT"), a dated deadline, a clock fact.

## Typography
- **H1 = Instrument Serif** (`var(--font-display)`, 35px) — and **only H1** (wired in `base.css`); no
  serif anywhere else.
- **IBM Plex Sans for every other heading and all body** — h2=22, h3=18, weight 600 (never a
  different family).
- Body font **≥16px** (aim 16–17px), line-height ~1.55.
- **No enlarged "lead" paragraphs** (a landing-page-ism) — one body size; for emphasis use
  **font-weight 600**, never a larger font-size.
- Monospace (**IBM Plex Mono**) only for code, identifiers, inline `file:line` refs, and
  `.callout-label`.

## Color
- Light, high-contrast: near-white background, dark text (`--ink #1B2A4A`, `--text #313F5C`). **No
  navy hero or dark marketing bands — in EITHER shape, including the board template's own header.**
- **One accent: cranberry `#8C3344`**, used sparingly — primary buttons and the selected state only.
  Nothing else colored for decoration.
- Subtle borders (`#DCDFE3`), generous consistent spacing. One clear reading flow — text is not
  scattered around the viewport. Status colors (success/warning/error) for genuine functional state only.
- **Primary reading text uses `--text`/`--ink` — never `--text-muted`.** Any paragraph meant to be
  *read* (intro/lede, write-up prose, verdict/proposal callout body) is full-ink. `--text-muted` is
  for **metadata and subordinate micro-copy only** (mono `file:line` refs, plain-text `.tag`/`.meta`,
  timestamps, counts, at-a-glance rails, helper captions). De-emphasize with **size** (e.g. 14px),
  not by washing out.
- **Revealed content reads at full body color** — content under a "Show/Hide details" toggle is
  reading copy (`--text`/`--ink`, Shape B board: `--navy-90`), never dimmer than the summary above.
  This does NOT reclassify genuinely-secondary text (`.tag`/`.meta`, `small`, captions, `.neutral`
  stay muted by size).

## Build-time syntax highlighting — the agent is the tokenizer
Code in a `<pre><code>` block that benefits from syntax coloring is highlighted **at generation time,
by the agent, as plain HTML** — never a runtime highlighter, CDN script, or browser-loaded library.

- **HTML-escape the source first** (`&`, `<`, `>`), **then** wrap token spans — so an escaped entity
  is never re-interpreted as markup and a token boundary never splits an entity.
- **Token classes** (in `base.css`, scoped to `pre code` only): `.tok-kw`, `.tok-str`, `.tok-num`,
  `.tok-com`, `.tok-fn` — a deliberate, scoped exception to the one-accent rule, never appearing
  outside a code block. Plain code, or a language you can't confidently tokenize, stays plain.

## Valence — make every sign unambiguous
A bare `-` reads as neutral. Mark **real** negatives (cons, deletions, blockers) with `.neg` (red),
positives with `.pos`, genuinely neutral items with `.neutral`. Never leave a true con/pro unmarked.

## Page header
An `h1` (Instrument Serif) plus **one line of context**, always with the **`.page-header` class**
(bottom rule + generous space below, so the header is clearly separated). Not a colored band. **No
eyebrow** (see below).

## Page layout — one measure, body aligned to the header
`base.css` centers and insets only the `.page-header` itself — it does **NOT** constrain anything
else. The body is your responsibility, and getting it wrong is the most common layout bug.

- **Every page is a `.page-header` followed by all body content inside ONE width-matched container** —
  `<main class="wrap">…</main>` (`.wrap` is `max-width:var(--maxw);margin:0 auto;padding:0 24px`).
  They are a **pair** — use both. Multi-section, tabbed, or multi-column bodies are fine; the invariant
  is that the content shares the header's measure.
- **`.wrap` is the safe default because it is RESPONSIVE** (drops to 18px padding at ≤560px in lockstep
  with `.page-header`). `base.css` has **no `main{}` rule**, so a bare `<main>` centers nothing. A
  page-local container must match both `max-width:var(--maxw)` + centering **and** the responsive
  padding (24px, 18px at ≤560px). Prefer `.wrap`.
- **NEVER place sections, callouts, cards, or paragraphs bare as direct children of `<body>`** — it
  has no max-width or padding, so bare content renders full-bleed and misaligned. Anything not in a
  `.wrap` (or equally width-matched container) is a bug.
- **Don't double-wrap the header** — keep `.page-header` a **sibling** of `<main class="wrap">`, not
  nested (nesting stacks two paddings and misaligns it).
- **Deliberately full-bleed surfaces still align their readable content** — a graph canvas, wide
  diagram, or board grid may span the viewport, but text/controls inside sit in a `.wrap` (or the
  surface's own centered inner container). Full-bleed is for the *backdrop* only.

## Callouts — the standard for dynamic / must-read content
Content the reader **must** notice, or that **reacts to selection**, goes in a `.callout` (left accent
bar + tint), not a plain section.

- `.callout-label` = small mono label — allowed **only** on a pure status / `.is-live` readout
  callout; a callout carrying a **decision control** gets **NO `.callout-label`**.
- `.callout-q` = the question / prompt line, **normal weight**. For a decision **question**, lead with
  a bold **`<strong>Question:</strong>`** then the rest in normal weight. Non-question prompts stay
  plain `.callout-q`.
- Add `.is-live` when the box updates in response to selection.

## Eyebrows — banned
Remove every eyebrow (small UPPERCASE letter-spaced kicker labels); there is no `.eyebrow` class in
`base.css`, never add one. **This applies to BOTH shapes:** the board template ships its own inline
`<style>` and gets no exemption — no eyebrow/kicker, no UPPERCASE letter-spaced label (including state
ribbons like a "re-review" marker), no navy hero band, no pill. Inlining CSS never buys a pass.

## Buttons / controls
- Obviously clickable, high-contrast. Primary = **solid filled** cranberry, white text (`.btn
  .btn-primary`); secondary = **1px outline** (`.btn .btn-secondary`). Min height ~38px, label
  **≥15px**, visible **hover and selected** states.
- **Use fewer buttons** — collapse redundant ones.
- **Never wrap readable prose in a `<button>` or `role="button"`** (it blocks selection). A clickable
  card/row of readable text is a `<div>` with a click handler (`tabindex="0"` + Enter/Space `keydown`,
  `aria-pressed`/selected for single-select), or a small inner control. Short-fixed-label controls
  (verdict buttons, flag toggles, "Choose this") stay real `<button>`s.
- **All text is selectable, everywhere, always** — `base.css` ships a global `*{user-select:text}`
  reset; never add `user-select:none` to readable text (the one exception is a line-number gutter,
  `.ln`). Fix at this level, never per page.
- **Inline `<code>` inside a control is part of the label** — it inherits the control's color, no grey
  well/border (`base.css` handles it). Never give a code token its own background inside a button, tab,
  or link.

## Pills / badges — banned
- **Remove every decorative pill/badge.** No `border-radius:var(--r-pill)` (or `999px`, or any rounded
  fill/outline) on a label, tag, badge, or chip — in `base.css` OR inline `<style>`.
- The only allowed inline label is a minimal **plain-text** `.tag` (Shape A) / `.meta` (the board's
  equivalent): plain mono text, `--text-muted`, no fill/border/border-radius.
- **Metadata is exception-only — default to NONE.** Justified only when a fact genuinely changes the
  decision (a runtime the choice hinges on, a hard license/cost constraint). Cut decorative tags (star
  counts, "Top pick"/"Recommended", a visible language, anything restating the title); if nothing is
  load-bearing, omit the line.
- **Applies to BOTH shapes** — the board's per-item `badges[]` render as this plain-text meta line
  (joined by ` · `), never pill spans.

## Interactions
- **Never multi-select, never rank.** A human picks **one** thing — radios or a single selected
  button, selected state in the cranberry accent.
- **Simplify each view to the minimum useful interaction** — remove anything unlikely to be useful or
  that adds complexity (keep genuinely borderline things for now).
- **Capture feedback per item, never one global box** — each reviewable element gets its own mark/flag
  control (see `_capture.md`). The one sanctioned global box is the auto-injected **"General
  comments"** field `capture.js` adds at the page bottom: it supplements (never replaces) per-item
  capture — don't hand-add another, and don't treat its presence as this violation.
- **Collapse redundant controls; keep genuinely distinct ones — the test is meaning, not count.**
  Three "buttons" that all mean "pick this option (+ a note)" are **one** action (**"Choose this"** + a
  notes textarea); but **"Choose this"** (take as-is) vs **"Use as base"** (adapt with noted changes)
  are genuinely distinct — **keep both**.
- **Confirm-or-correct is TWO options, never three** — exactly **"Yes — that's right"** and **"Make
  changes"** (which reveals a text box). Don't split the change side into "Mostly" and "No": both open
  the same box and route the same way, so they are one option. The signal is binary (accepted vs change
  requested) plus what the human typed. (Does NOT apply to an **open question the agent is blocked on**,
  which keeps its distinct "defer / you decide" option per `pr-writeup.md`.)
- **Required questions get a per-item answer box, pre-opened** (visible, not behind a toggle).
- **Always an escape hatch from fixed options.**
  - **(a)** Every preset / radio / fixed option set includes an **"Other…"** option that reveals a
    free-text box on selection (the recommended option may stay pre-selected).
  - **(b)** Every negative / changes-requesting control (**"Make changes"**, "Reject", any equivalent)
    reveals a text box on selection to capture the reason (required if it gates submit). Capture the
    value + `note` through `window.Capture`; reveal on selection, not always-on.
  - **(c)** A standalone escape-hatch box ("None of these — describe your own") carries trailing space
    in BOTH states — give the *container* a `margin-bottom` (e.g. `var(--space)`); it uses the box
    outline color (`--border-strong`).
- **The per-item objection control reads "Make changes" — one label, every view** (never "Flag",
  "Something off", "Revisit", or a synonym). It's a real `<button>` styled `.btn .btn-secondary` (add
  `.btn-sm` where tight; bare `.btn` reads as a text link); its revealed reason box spans the full
  content width, no local `max-width`. A multi-way verdict rail keeps distinct verbs (Accept / Make
  changes / Reject) and the board's Yes/Maybe/Skip rail is a disposition, not an objection — but any
  changes-requesting option in any rail is labeled "Make changes". The Capture value stays `'flag'`
  (this fixes the label, not the wire format).
- **A per-item flag/objection control sits at the BOTTOM-LEFT of its content card, not the header.**
  When a readable card (plan step, ledger row, variant card) carries an **optional** "Make changes"
  (default = accept), place it on its own row at the bottom, left-aligned, reason box opening directly
  beneath — never in the title row or floated top-right. It's a secondary, default-accept affordance,
  distinct from the PRIMARY verdict at the top of the *view*.
  - **Exemptions — a view that deliberately specifies placement wins:** `code-review-pr-diff.md`'s
    per-hunk Accept / Make changes chips live in the **hunk header**, and the board's Yes/Maybe/Skip
    **disposition rail** is the item's primary control (the bottom-left rule is for the optional flag,
    not a primary adjudication rail).
  - **Compact / single-line rows** (a token swatch) have no "bottom": the flag goes at the **trailing
    end of the row**, out of the title area.
- **Never present a disabled "Submit to Claude" button.** When required fields are incomplete, Submit
  stays **clickable** — clicking **scrolls to the first unmet field and flashes it** (a brief shake + a
  fading cranberry ring) and focuses it, with one short ambient reason line in the bar (no modal, no
  error list). Register a gate with `Capture.setGate(fn)` where `fn()` returns `{ ok, reason, focus }`
  and `focus` points at the field to flash; order the checks top-of-page-first. Never re-implement
  scroll/flash/disable in a view, and never set `disabled` on Submit. See `_capture.md` → "Submit
  gating".

## Recommendations, rationale & read-more
- **`.reco` is ONLY for an actual recommendation** — a single call to action on its OWN line, never
  trailing a paragraph, never on pointer / explanation / context text. Use `.reco` (block, weight 600);
  every `.reco` ends with a trailing `(why)`, and a recommendation not wrapped in `.reco` is wrong.
  Example:
  `<p class="reco">Recommended: <strong>interrupt</strong> <span class="why" tabindex="0">(why)<span class="why-pop">Verified valid in the SDK and simplest.</span></span></p>`
- **The `(why)` rationale shows in a styled hover/focus popover, NOT a native `title` tooltip** — a
  `.why-pop` child of the `.why` that `base.css` reveals on `:hover`/`:focus-within` and keeps
  selectable (pure CSS, no JS). Make `.why` focusable (`tabindex="0"`); keep the recommendation line
  short, reasoning in the `.why-pop`.
- **Cross-reference the detail, don't restate it — wire it systematically.** When a question/decision's
  rationale leans on something explained elsewhere on the page, give it a **"Read more:"** line linking
  there; a question left unlinked while a sibling gets a link is the failure.
  - **Link every distinct target the decision turns on** — fold closely-related detail into one target,
    ~3 links soft cap.
  - **Named, self-describing links — never bare numbers.** `Read more: <target name> · <target name>`,
    each label a concise name of the target's own heading. Reuse the `.readmore` anchor:
    `<p>Read more: <a class="readmore" href="#step-s1">Slack &amp; access test</a> · <a class="readmore" href="#risks">Risks</a></p>`
  - **The anchor lands on the exact thing the label names** — every target carries a stable `id`; when a
    label names a specific item in a long section, the `id` goes on that **`<li>`**, not the section
    `<h2>`. The explanation lives **ONCE** — link, never duplicate.
  - **Click scrolls smoothly to the target — nothing more** (`base.css` sets `scroll-behavior:smooth` +
    a small `scroll-margin-top`; no flash, no back-link).
  - **This is also the home for load-bearing source evidence** (see "References and evidence"): a
    `.readmore` link to a visible on-page section, not a `.file-pop` popover.

## Functional emoji / arrows / icons — allowed, sparingly
Small functional glyphs are **allowed** for clarity only: status, direction (`→`), valence (`✓`/`✗`),
list markers. Use sparingly. **Never decorative**, and **never in place of a clear text label** — the
glyph supplements the label, it doesn't replace it.

## Feedback plumbing (keep)
Feedback routes through `window.Capture` (`capture.js`). Keep **one** batched, prominent "Submit to
Claude" plus a "Copy as prompt" fallback. `base.css` re-themes capture.js's injected `.cap-bar` to the
light house style — don't reintroduce its default navy bar. Keep real content; no mock data.

## Self-contained constraint
- Pages are self-contained except for `assets/fonts`, `base.css`, `capture.js`, and
  **locally-vendored** diagram libs (`vendor/*.js`, e.g. `mermaid.min.js`, `svg-pan-zoom.min.js`).
  These live once in the shared `assets/` folder at the serve root, and every page links them
  **root-absolute** (`/assets/base.css`, `/assets/vendor/…`) — a page's own depth under the serve root
  doesn't affect whether they load. **No CDN, no external script / style / font hosts.**
- **Fonts are external `.woff2` files, never inlined as `data:`/base64.** `base.css` owns every
  `@font-face` (a Shape A page has none of its own); its `src` is `url('../assets/fonts/…')`, and the
  board's inline `<style>` writes the same rule root-absolute (`url('/assets/fonts/…')`).
  "Self-contained" means no external hosts, not one file. (Scoped to htmlizer's HTTP-served pages; the
  separate Artifact tool is one document under a strict CSP and *requires* fonts/assets inlined as
  `data:` URIs.)
- **The favicon is the one deliberate exception** — every page carries the Principal "P" mark inlined
  as a base64 `data:` URI (copy the `<link rel="icon" …>` verbatim from SKILL.md's head boilerplate).
  It's inlined, not relative, because pages live at two depths under the serve root so no single
  relative `href` resolves for both. Don't "fix" it.

## After editing any view
- Run `node --check` on every `<script>`.
- Functional emoji/glyphs are fine (see above); no decorative emoji.
