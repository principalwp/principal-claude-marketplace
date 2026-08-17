# htmlizer design-implementation review — the page/house-style lint

Scope: visual house style, layout, typography, controls, capture wiring — purely visual/mechanical
(clarity, plain language, and voice are `review-sufficiency.md`'s). Runs on `model: sonnet` as ONE
sub-agent with `review-content-hygiene.md`, in parallel with the rest of the panel (`SKILL.md` step
3.5). Enforces `PRINCIPLES.md` (same dir). Report ONLY violations, HIGH/MED/LOW, each `file:line` +
a concrete fix (exception-only); the generating session applies them — reviewers never edit.

**Not here — moved; old numbers 9, 10, 14, 17 left as gaps so cross-references stay stable:**
clarity / plain language / voice → `review-sufficiency.md` Pass 2 (9, 17); option/decision depth →
`review-sufficiency.md` Pass 1 (14); file-reference resolution → `review-content-hygiene.md`
presence + `review-accuracy.md` Pass 2 truthfulness (10).

## Deterministic vs residue — who runs which check
`references/preflight-lint.sh` runs the GREPPABLE checks at write time (exits non-zero on any HIGH),
so the session clears them *before* this reviewer is dispatched. This reviewer owns ONLY the
judgment residue. Three sub-checks fall through and are an accepted gap.

| run by | checks |
|---|---|
| `preflight-lint.sh` — greppable, at write time (do NOT re-derive) | 1, 2, 5-greppable (pills / eyebrows / navy / kicker-on-decision / font-floor), 7, 8, 15-HIGH, 19; hygiene H1-structural, H3-presence |
| this sonnet reviewer — judgment | 3, 4, 5-decorative-accent, 6, 11, 12, 13, 16, 18, 20; hygiene H1-load-bearing, H2, H4 |
| NEITHER — accepted gap | 7's `Capture.setGate` presence; 8's page-serves-200 + fonts-resolve (linter can't `curl` the `/s/` link); 15's mobile-padding-drift + double-wrapped-header MEDs |

## How to run (dispatch — one sub-agent on `model: sonnet`)
> Review `<page.html>` against `references/review-design.md`, `references/review-content-hygiene.md`,
> and `PRINCIPLES.md`, on `model: sonnet`. It is NOT WordPress. The greppable checks already ran in
> `preflight-lint.sh` — do NOT re-derive them. Judge ONLY the judgment residue: design 3, 4,
> 5-decorative, 6, 11, 12, 13, 16, 18, 20 plus hygiene H1-load-bearing, H2, H4. Return only
> `[class] file:line — problem → fix`, HIGH/MED/LOW. (Clarity/plain-language/voice are not your job;
> don't paste the user's communication rules.) Write full findings to OS temp; return summary + path.

## Judgment checks (this reviewer runs these)

**3. Unreadable controls.** Inline `<code>`/tokens in a `<button>`/`.btn`/`.tab`/`<a>`/`<label>`
must not have a local background/border re-added (base.css gives no grey well — white-on-grey pill
is a flag). Spot-check contrast, esp. the **selected** (cranberry) state and `--warning` text.

**4. Recommendations & rationale.** Each reco on its own `.reco` line, never trailing a paragraph,
ending in a `(why)` whose rationale is a `.why-pop` popover (child span, base.css-revealed,
selectable) — not a native `title`. Flag a reco with no `(why)`, a `(why)` using `title=`, or a
`.why` with no `.why-pop`. A long explanation lives once in an `id` section, linked via `.readmore`,
not restated.

**5 (decorative-accent + single-select).** The one cranberry accent is primary/selected only — flag
it used decoratively. Single-select only — never multi-select or ranking as a feedback mechanism.
(Pills / eyebrows / navy / kicker-on-decision / font-floor are the linter's half of 5.)

**6. Escape hatches & submit gating.** Every fixed option set has **"Other…" → a `.reveal`
`.reveal-box`**; every negative/changes-requesting control reveals a reason box on selection.
Submit is **never disabled** for validation — gating is `Capture.setGate` → scroll-to-and-flash the
missing field (returns `{ok, reason, focus}`); flag a disabled submit or an inline "still required"
label used in place of the gate. (Channel well-formedness is the linter's, check 2 — rationale in
`serving.md`.)

**11. Decision question formatting.** A `.callout-q` question leads with a bold **`Question:`** then
normal weight — flag one all-bold or missing the lead-in. Non-question prompts/status lines stay
plain.

**12. No standalone overall verdict — derive it.** Flag a global **Approve / Request changes**
control beside per-item calls — the routable verdict is **computed** via `Capture.rollup`. When the
page proposes changes beyond its itemized calls, require ONE *"Apply the rest? Yes/No/Other…"* call.
The submit bar carries progress + Submit only.

**13. Revealed content reads at body color — MED.** Primary content under a reveal/detail toggle
(`.reveal` / `.detail`) renders at full body color, not dimmer than the summary. Grep the
reveal/detail rule for a muted token (`--text-muted`/`--text-faint`/`--navy-60`/`--navy-80`) → set
`--text`/`--ink` (board `--navy-90`). Don't flag genuinely-secondary text (`.tag`/`.meta`, `small`,
captions, `.neutral`, helper micro-copy).

**16. Identical-routing options collapse to one — MED.** ≥2 options that reveal the SAME box and
route identically (a "yes/mostly/no" triad where both non-yes options open the same correction
textarea and are handled the same) → collapse to **"Yes — that's right"** + **"Make changes"**. The
shared reveal is the tell, even if they `Capture.mark` different values. A genuinely distinct option
reveals a *different* control (or none) and is handled differently — don't flag it (e.g.
pr-writeup.md's "defer / you decide" third option).

**18. Per-item optional flag sits bottom-left — MED each.** For a readable content card (plan step,
ledger row, token/variant card) with an **optional** objection toggle (default = accept):
- **Placement** — its own trailing row at the **bottom-left**, after the content; flag it inside the
  title/header row or pushed top-right (`float`/`margin-left:auto`/`order`/right `justify-content`).
  The reason box opens directly beneath it.
- **Label** — exactly **"Make changes"**; flag "Flag"/"Something off"/"Revisit"/any synonym
  (recorded value stays `'flag'`).
- **Affordance** — `.btn` with a visible variant (`.btn-secondary`, selected via `aria-pressed`);
  flag a text link, a bespoke chip, or a bare variantless `.btn`.
- **Reason box** — spans the full content width; flag any local `max-width`.
- **EXEMPT** — a deliberate primary per-item rail (code-review-pr-diff.md's per-hunk chips, the
  board's Yes/Maybe/Skip). Compact single-line rows put the flag at the trailing end of the row.
- Source: PRINCIPLES → Interactions.

**20. Uniqueness bar — MED.** Flag page-local CSS/classes that rebuild a shared component (a
base.css class or a `references/components/` fragment — accordion, table, card-grid). Tell: a local
`.card`/`.acc`/`.grid` rule, a hand-rolled disclosure/table/grid, or a bespoke class duplicating a
component the page could have composed. A genuinely novel one-off is fine — the bar is reinvention.
Fix: use the fragment / base.css class. Source: PRINCIPLES → shared components; SKILL.md step 2.

## Greppable checks — linter-owned (`preflight-lint.sh`; listed for cross-reference, not re-run here)
- **1** — text selectable everywhere (`user-select:none` only on a `.ln` line-number gutter).
- **2** — no decision re-representation / value-echo (the selected state is the only confirmation;
  one allowed aggregate is the submit bar's outstanding-count).
- **5-greppable** — no pills, no eyebrows/kickers, no navy hero, no kicker-on-decision; H1 =
  Instrument Serif and only H1, body ≥16px, IBM Plex Mono for code only.
- **7** — bars/toasts/reveals compose base.css utilities (flag re-implementations); `id`s are JS
  hooks, not style rules. (`Capture.setGate` presence is the gap — see the table.)
- **8** — root-absolute `/assets/base.css` + `/assets/capture.js`, fonts resolve, diagram libs
  vendored (no CDN); inline `<script>` passes `node --check`. (Page-serves-200 + fonts-resolve are
  the gap; only the `fs-link.sh` `/s/<code>` link is ever handed out.)
- **15-HIGH** — body content width-matched to the header: wrap all content in one
  `<main class="wrap">`, sibling to `.page-header`. (Mobile-padding + double-wrap MEDs are the gap.)
- **19** — fonts external `.woff2`, never base64 / `data:` inside `@font-face`.

## Extending — the canonical routing note (the other three panel docs point here)
A new problem class gets a section in the doc that owns its scope:
- **visual / control / capture-wiring** → here (numbered section: description, grep/heuristic, fix).
- **page-only mechanical content pattern** → `review-content-hygiene.md`.
- **source-requiring truthfulness** → `review-accuracy.md`.
- **reader-can't-decide / clarity / plain-language / voice** → `review-sufficiency.md`.

A house rule belongs in `PRINCIPLES.md` with its fix in `base.css`/`capture.js` — this lint is the
safety net, the canonical files are the cure.
