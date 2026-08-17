---
name: htmlizer
description: "Trigger on any use of htmlize, htmlizer, or \"render in html\". Renders what you would otherwise paste as text into a self-contained interactive HTML view served over local HTTP: hand over the http:// link, the reader annotates it and hits Submit to Claude, and their picks return into this session."
---

# htmlizer

Turn the thing you'd otherwise paste as text — a plan, a review, competing approaches,
a design, a config change — into a **self-contained interactive HTML view** the user
reads and gives feedback through, served over HTTP, with their feedback auto-returned
into this session so you can act on it.

**Follow-ups stay in htmlizer.** Once a thread is using htmlizer, a non-trivial
follow-up that is itself a document or decision — more options, a fuller answer, a
revised plan — is another htmlizer page, not chat text and not a raw file link. A quick
factual answer goes in chat first, then is repeated inside the next page.

Two shapes, one feedback pipeline (Capture → POST → Monitor → session):

- **A — a rich interactive view** (the default): pick the best-fit view type from the
  library below (or compose several, step 1) and render the real content as one
  self-contained `.html` in the house style, wired to `window.Capture`.
- **B — the Yes/Maybe/Skip review board** for a *set of items* to triage ("review these 8
  files/options"): one board lists them; they rate each.

## Canonical source vs. served copy

There is **one** source of truth for runtime assets: the skill's `assets/` dir (below).
Edit only there. The serve root holds a *derived* working copy that exists only so the
browser can fetch same-origin; never hand-edit it. To change behavior or house style, fix
the canonical file and re-copy (step 3), so every future view stays consistent. (`$SKILL` =
the directory containing this SKILL.md — the path you read it from; no fixed install.)

## Skill layout (paths relative to `$SKILL`)

- Canonical assets:  `assets/` (capture.js, base.css, vendor/, shared/fonts, shared/img)
- View prompts:      `references/views/*.md`
- House style:       `references/views/PRINCIPLES.md` (non-negotiable)
- Capture primitive: `references/views/_capture.md`
- Page scaffold:     `references/scaffold/page.html` — copy + fill `{{TITLE}}/{{LEDE}}/{{TOKEN}}/{{CHANNEL}}` + `<!-- CONTENT -->` (step 2)
- Shared components: `references/components/{accordion,table,card-grid}.html`
- Preflight linter:  `references/preflight-lint.sh <page>` — deterministic mechanical checks, cleared before the panel (step 3.5)
- Review panel (four reviewer docs): `references/review-{accuracy,sufficiency,design,content-hygiene}.md` — roster and inputs in step 3.5
- Board plumbing:    `references/{board-server.js, board-template.html}`
- Link minting + server lifecycle: `references/fs-link.sh` — the ONE way to mint links; auto-starts the board-server if it isn't running. `references/link.sh` is a compat shim that execs it.
- Config + derived paths: `references/net-config.sh`

## House style

Every view obeys `references/views/PRINCIPLES.md`, encoded in `assets/base.css`. When
the user's feedback changes a rule, fix the cause: PRINCIPLES.md + the relevant
`references/views/*.md` + `assets/`, not just one page. The Shape B board is a
self-contained page with its own inline `<style>` and gets no exemption — same rules,
same review panel (step 2.5).

## 0 — Resolve `$SKILL` and load the config

```bash
SKILL="<absolute path of the directory containing this SKILL.md>"
. "$SKILL/references/net-config.sh"
```

Sourcing this sets `$HOST`, `$PORT`, `$STATE_DIR`, `$SERVE_ROOT`, and `$LOG` from the
user's config (`${XDG_CONFIG_HOME:-~/.config}/htmlizer/config`, auto-created on first
use). It's the SAME loader `fs-link.sh` and the board-server use — re-source it (never
hard-code a parallel default) whenever a fresh shell/turn needs these paths.

**First time this session:** prime the server before generating anything (see
`references/serving.md` → "Prime the server and read the token"). The submit token you
bake into a page (step 2) must be the server's real token, so the server must be up
*before* you generate, not just before you mint the link.

## Serve-root layout rule

Assets are referenced root-absolute from the shared `$SERVE_ROOT/assets/`, so a page's
own depth doesn't affect resolution (PRINCIPLES.md → "Self-contained constraint") — the
`<slug>/<slug>.html` subdirectory is housekeeping only.

Don't name a board file/directory under `$SERVE_ROOT` starting with `fs`, or exactly
`s` — the `/fs/` and `/s/` route prefixes are matched before the board fallthrough, so
it would be misrouted.

---

# Shape A — a rich interactive view

### 1 — Pick the best-fit view(s) and read their prompts

| Presenting… | Read (in `references/views/`) |
|-------------|-------------------------------|
| an implementation plan — proposing a body of work (PRs, phases) not yet agreed on, for a go/no-go | `implementation-plan.md` |
| 2–3 competing approaches to weigh | `three-code-approaches.md` |
| a map of a service you don't know yet — your job is pointing the agent at the modules worth a closer look, not comparing approaches or walking through how it works | `module-map-interactive-graph.md` |
| a code review (flow + diff + write-up) | `code-review-pr-diff.md`, `annotated-flowchart.md`, `pr-writeup.md` |
| a flow, runbook, or business-process diagram to validate structurally — safety-critical steps, or a process unrelated to code | `annotated-flowchart.md` |
| how an existing feature/system works | `code-understanding-walkthrough.md`, `feature-explainer-tabs.md` |
| tokens / component variants / visual designs | `design-system.md`, `component-variants.md`, `visual-designs-light-dark.md` |
| prototypes to tune or reorder — motion timing, dragging a sequence into order already agreed on (PR sequencing included), or SVG illustrations | `prototype-animation.md`, `prototype-interaction-drag.md`, `svg-illustrations.md` |
| tuning live settings — pick config values, edit a prompt, or try numbers out until they feel right | `editor-feature-flags.md`, `editor-prompt-tuner.md`, `concept-explainer-sliders.md` |
| open questions to answer before building | `interview.md` |
| a post-build decision ledger (simplified / kept-complex / escalated) | `decision-ledger.md` |
| a test/QA plan to run — flows broken into steps (action + copyable snippet, expected pass, optional watch), each step marked pass / fail / blocked / skipped, with sticky resolved/total progress | `testing-checklist.md` |
| two options or versions head-to-head, with a top toggle flipping side-by-side ↔ overlaid before/after, resolving to one derived "prefer this" decision | `compare-and-flip.md` |
| a multi-section document to review section by section — default-accept, "Make changes" per section, one derived verdict | `doc-review.md` |
| analysis output to review — tables plus self-contained inline SVG/CSS charts — where the reader flags a row/series or questions a specific number | `data-chart-review.md` |

**Pick the single closest library view and read its prompt — the table is the menu, not
a suggestion.** Hand-author a bespoke view ONLY when no library view fits, and then name
in one line why each plausible view was wrong first (a bespoke page reaching for "faster"
is the failure this blocks; PRINCIPLES.md → "Composition"). When the content has several
facets, compose components from more than one library view on one page: **one
`Capture.init`** with a summed `total`, **one derived verdict** in the primary decision's
vocabulary (PRINCIPLES.md → "Information priority", No standalone overall verdict), and
copy assets for every component used. Each component earns its place; default to a single
view.

Always also read `PRINCIPLES.md` and `_capture.md`. A per-view prompt is authoritative
for its capture interaction when it is the page's only view; on a composed page the
page's shared `Capture.init` is authoritative and each component folds its marks into it.

### 2 — Generate the view

Write **one self-contained `.html`** with the real content (no mock data) into
`$SERVE_ROOT/<slug>/<slug>.html`.

**Copy `references/scaffold/page.html` and fill its `{{TITLE}}`, `{{LEDE}}`, `{{TOKEN}}`,
`{{CHANNEL}}`, and `<!-- CONTENT -->` markers — do NOT retype the shell or hand-build the
`<head>`.** The scaffold already carries the root-absolute `/assets/` links, the inlined
favicon, the `.page-header` + `<main class="wrap">` skeleton, and the capture `<script>`
(submit URL from `{{TOKEN}}`, channel from `{{CHANNEL}}`). Drop all content at
`<!-- CONTENT -->` inside `.wrap`, never bare in `<body>` (PRINCIPLES.md → "Page layout").

**Compose from what exists BEFORE writing any CSS.** For each block, use what covers it;
a page-local rule is the exception:

- **Copy-me fragments — `references/components/`:** `accordion.html` (multi-item
  disclosure), `table.html` (data table), `card-grid.html` (responsive card grid). Copy;
  never rebuild.
- **base.css classes (apply the class, style nothing):** `.card`/`.section`;
  `.callout` + `.callout.is-live` + `.callout-q`; `.btn` + `.btn-primary`/`.btn-secondary`/
  `.btn-sm` (incl. selected state via `aria-pressed`); `.tabs`/`.tab`;
  `.reveal`/`.is-open`/`.reveal-box`; `.grid`; `.reco`/`.why`/`.why-pop`/`.readmore`;
  `.tag` (never a pill); `.pos`/`.neg`/`.neutral`; `.file`/`.file.planned`/`.file-pop`;
  `.fixed-actionbar`/`.toast`; `.wrap`/`.stack`. Read the matching comment in
  `assets/base.css` for exact markup.

A page-local rule is allowed ONLY for something genuinely one-off that nothing above
covers; mark it with an HTML comment naming why no shared component fit (the uniqueness bar,
`references/review-design.md` check 20). Duplicating an accordion, callout, tag, or table is
the reinvention this blocks.

`CAPTURE_CHANNEL` is the **per-session channel literal** — minted once with `openssl rand
-hex 8` the first time you serve this session, reused on every page and round, baked in as a
quoted string. Wrong, or taken from another thread's page or the session id, and your
submit's `channel` won't match your Monitor, so feedback is silently dropped
(`references/serving.md` → "Feedback channel").

Generate against PRINCIPLES.md's fix-at-cause rules ("References and evidence",
"No time or effort estimates", "Clarity & detail") so the step-3.5 net rarely trips.
**Assemble the source manifest as you go** (schema: `references/review-accuracy.md`) from the
working set already in context, write it to OS temp, and hand its path to the accuracy
reviewer in step 3.5. Build it for any sourced page (citing repo files, PRs, tickets, or
numbers); skip it only for a synthetic/no-source page, where it just forces the reviewer to
self-source.

Wire each native affordance to `window.Capture` per the view's prompt + `_capture.md`.
Validate every inline `<script>` with `node --check`.

### 3 — Lay down the assets (copy from the skill canonical)

So the page can fetch them same-origin. Copy only what the view needs:

```bash
PAGEDIR="$SERVE_ROOT/<slug>"            # the dir holding the .html (housekeeping only)
mkdir -p "$PAGEDIR" "$SERVE_ROOT/assets/fonts"
cp "$SKILL/assets/capture.js" "$SKILL/assets/base.css" "$SERVE_ROOT/assets/"     # served as /assets/capture.js, /assets/base.css
cp "$SKILL/assets/shared/fonts/"*.woff2 "$SERVE_ROOT/assets/fonts/"        # served as /assets/fonts/…
cp "$SKILL/assets/shared/img/"*.svg     "$SERVE_ROOT/assets/"   2>/dev/null || true   # only if the page uses logos/marks
mkdir -p "$SERVE_ROOT/assets/vendor" && cp "$SKILL/assets/vendor/"*.js "$SERVE_ROOT/assets/vendor/"  # ONLY if the view needs a diagram lib
```

Assets live once in the shared `$SERVE_ROOT/assets/` and every page references them
root-absolute, so page depth is irrelevant. Reference fonts by relative URL only — never
inline a font as a `data:`/base64 URI (PRINCIPLES.md → "Self-contained constraint").

### 3.5 — Review panel (parallel dispatch, required gate)

When `$ARCHIVE` is set, snapshot the just-generated page before the panel touches it:
`"$SKILL/references/archive.sh" <slug> <N> draft <page>`, where `<N>` is the version number
(the `-r<N>` count) — the same value you stamp on this handover's `final`. The panel's
in-place fixes otherwise overwrite the pre-panel draft, so this is the only copy of it.

**Run `references/preflight-lint.sh <page>` first and fix every HIGH.** The linter owns
the deterministic greppable checks; it is a precondition to the panel, never a replacement
— it can't make the design-residue and reader judgments where escaped defects live (the
greppable/judgment split lives in `references/review-design.md` → "How to run").

**The panel runs on EVERY page and board — internal, meta, one-off, tiny, or already
self-read — with no exemption.** A self-read is not one of the three reviewers, and a green
linter is not a reviewed page.

Dispatch **three sub-agents in ONE message, three `Task` calls — never serialize** (that
is the biggest wasted wall-clock):

- **Accuracy** (`references/review-accuracy.md`): page path + the source-manifest path from
  step 2 (self-sourcing from the repo/working tree is the fallback when there's no manifest) +
  the resolved `$SKILL/references/check-links.sh` path (paste the real absolute path — the
  reviewer's shell has no `$SKILL`) for its mechanical link check. Blocks only if a load-bearing
  claim genuinely can't be verified any way.
- **Reader** (`references/review-sufficiency.md`): the **rendered page content pasted inline,
  never a path** — the blindness is structural (see that doc). Runs Pass 1 (decidability) and
  Pass 2 (plain language + voice). The user's standing communication rules are already in the
  sub-agent's context — do NOT paste or summarize them; add ONE line naming the session voice
  only if it differs from the default. If this session carries no user communication rules,
  paste `references/voice.md` inline as the marked fallback.
- **Design + hygiene residue** (`references/review-design.md` + `references/review-content-hygiene.md`
  + `PRINCIPLES.md`, on **`model: sonnet`**): the linter already ran both docs' greppable
  checks, so this reviewer judges only the non-deterministic residue (see `review-design.md`).
  Purely visual/mechanical — clarity, plain language, and voice are the reader's job, so do
  NOT paste the user's communication preferences here.

Reviewers only **recommend** — they never edit the page and never issue a binding
disposition. This session applies fixes, renders question callouts, and regenerates.

**When it runs — before the user sees the page, and again before any later version.** Any
change counts: a sub-agent's correction, a re-checked fact, a reworded paragraph, a swapped
term. Two things do not re-trigger it — the panel's own fixes (they settle under the Stop
condition) and wording the user dictated (their words go in as written, straight back).

**Record the dispatch — the resume ledger.** The moment you dispatch, write the agent IDs
to `$STATE_DIR/<slug>.reviewers` — one `role=id` line each for `accuracy`, `reader`,
`design`; step 6 resumes from this file. It only lists who to resume; the mint gate is the
`.clean` marker (below), not this file.

**Adjudicate the recommendations:**
- A `fix`/`cut` is binding only if it quotes the exact contradicting source line (accuracy)
  or you independently confirm the gap against your own working set (sufficiency) — no cut
  on inference alone.
- Where the source is silent/ambiguous (accuracy said `question`; a sufficiency Pass-1 gap
  you can't fill from your working set), it becomes a **question-at-bottom** — not a silent
  cut, not a guess.
- **The reader's Pass-2 (plain language + voice, plus Pass-2b `[bulk]` cuts) is
  auto-applied, never questioned.** Rewrite every coined term (naked or defined) in plain
  words, cut every quoted `[bulk]` span (never a load-bearing one), apply every voice
  finding, and regenerate. The coined-term list is never shown to the user — they see only
  the finished, plain page. Only Pass-1 decidability gaps become questions.
- Apply every binding fix, render one `.callout` question per item at the BOTTOM of the
  page, and regenerate to a new round file.
- **Question cap ~5.** If the list would exceed roughly five, the content is too unsourced —
  stop and escalate to the user in chat instead of sprouting a wall of callouts.

When `$ARCHIVE` is set, write each reviewer's raw findings to
`$HISTORY_DIR/<slug>/<slug>__r<N>__$(date -u +%Y%m%dT%H%M%SZ)__<role>.md` (role = accuracy |
reader | design). Lead each file with one header line carrying that reviewer's cost, read from
its Task result's `usage` block — `duration_ms`, `subagent_tokens`, and the model you dispatched
it on: `<!-- role=<role> duration_ms=<N> model=<model> tokens=<N> -->`, then the findings body.
Omit any field the result doesn't carry rather than guessing. No separate metadata file — the
header plus the set of files present carry it.

Keep a content fix a content fix, not a design regression: reuse existing components (a new
card/table/option to hold reworded text is a *structural* change); scope a `.file` fix to
real filename/path tokens only (never a prose word or sentence); any new list/table
inherits `--fs-body`, never a local `font-size`.

**Stop condition (HIGH-only fixed point):** done when the linter reports no HIGH, all three
reviewers returned no outstanding HIGH on the exact version being handed over, every binding
content fix is applied, and no dispatch that would still change the page is outstanding. Only
an outstanding HIGH (any reviewer or the linter) keeps the loop going or blocks handover.
MED/LOW findings are applied within the round but do not re-trigger the panel or block the
mint — a pass surfacing only MED/LOW is clean once those fixes are in.

**Clean marker = the mint gate.** When the Stop condition holds, write an empty
`$STATE_DIR/<slug>-r<N>.clean`, where `N` is the **version number** (the `-r` count) — NOT
the panel-pass count. N climbs by one per version: the initial page is v1 (its file keeps
the unsuffixed name `<slug>/<slug>.html`, marker still `<slug>-r1.clean`); each iteration is
the next N (`<slug>-r<N>.html` + `<slug>-r<N>.clean`, step 6). Any later edit starts version
N+1, which needs its own clean pass and marker; an earlier version's marker never counts.

**What re-runs on a new version:** every version re-runs the linter and the design/hygiene
reviewer (cheap and parallel, so no version the user sees is unreviewed by house style); the
content reviewers resume scoped per step 6.

**Panel-pass cap — at most 2 panel passes per handover cycle.** A handover cycle runs from a
fresh page (initial generation, or a new page you generate after feedback) to handing over
its link. Dispatch the panel at most twice: pass 1 (initial + fixes), pass 2 only if pass 1
left a HIGH — never a 3rd. HIGH-only still lets you stop after pass 1. A new page from
feedback starts a new cycle with a fresh 2-pass budget; these pass counts reset per cycle,
while the `-r<N>` version number and `.clean` marker keep climbing (a separate counter). If
pass 2 still leaves a HIGH, hand over anyway but render that HIGH as a visible `.callout` /
bottom question on the page — the one case a page ships with an unresolved HIGH, and the one
case step 4 mints without a `.clean` marker.

If the page is about to change under an outstanding dispatch, `TaskCreate` the pending
re-run and run it when that dispatch returns; its only consequence is this Stop-condition
re-run.

### 4 — Start the server, hand over the link, arm the Monitor

**Do not mint until the current version's `$STATE_DIR/<slug>-r<N>.clean` marker exists**
(step 3.5). The one exception: the 2-pass ceiling — mint with the residual HIGH shown on the
page as a callout, no marker.

Everything about how the server runs — token, feedback-channel Monitor, security,
troubleshooting — lives in **`references/serving.md`**. Read it now: mint the link via
`fs-link.sh` (it auto-starts the board-server), read the token, arm the Monitor, and hand
the user **ONLY** the `/s/` link `fs-link.sh` printed. The server streams the page in place
(no redirect), so that link is also the only address the page's own address bar shows —
never rebuild one by hand.

When `$ARCHIVE` is set, snapshot the handed-over page: `"$SKILL/references/archive.sh" <slug>
<N> final <page>`.

**Arm the follow-up discipline.** If the page you just served carries a form with more than
one question or decision, `TaskCreate` a task now — subject **"Follow up on `<slug>` feedback
via htmlizer"**, body: *"When the user submits feedback on this page, deliver the follow-up
as a NEW htmlizer page (re-run this skill), not a chat reply — UNLESS the follow-up is a
single question, which may go in chat. Hard rule."* A single-question page is exempt.

### 5 — Process the feedback (size the fan-out to the work)

Size the fan-out to the work, not the item count: batch small same-kind items (e.g. wording
tweaks) into ONE sub-agent; one per item only when items are individually substantial or
need independent judgment. Dispatch in a single message so they run in parallel.
Default-to-keep: unmarked = accepted, drop it from the action list. When they return,
summarize each outcome in a line or two — don't paste transcripts.

### 6 — Iterate

Regenerate the view (or a follow-up view) reflecting the changes, flag what was addressed,
re-lay assets if needed, and re-link. **Keep the same session channel and the one persistent
Monitor already armed** — do not mint a new channel or re-arm per round (re-minting drops a
submit made on an older tab; `references/serving.md`). Every regenerated page is a new
handover cycle: back through the step-3.5 panel, with a fresh 2-pass budget. Repeat until the
user is done, then summarize what changed across passes.

**Decide each pass's scope.** UNSCOPED = all three reviewers re-read the WHOLE page for drift
and newly load-bearing text; SCOPED = they evaluate only what changed (treating approved
sections as settled, except a defect a change introduced elsewhere). Any pass whose clean
return could be handed to the user is UNSCOPED (a fresh page, a full regeneration, the last
pass before you mint); use SCOPED only for a re-check you KNOW is intermediate. When unsure,
go unscoped.

**Resume the SAME reviewers, not fresh ones.** Resume each by its ID (from
`$STATE_DIR/<slug>.reviewers`) via `SendMessage`, telling it the scope. A resumed reviewer
persists across the user's feedback turns, breaking only on `/clear` or a new session. All
three resume every round — no diff-based skip. The reader is source-BLIND every pass, so its
resume message pastes text tracking the scope (UNSCOPED = the entire rendered page inline;
SCOPED = only the changed sections' new text) — still no page or repo path. Accuracy and
design hold the page path and re-read the file themselves; accuracy never re-verifies a claim
it already cleared, tracing only new or changed claims (`references/review-accuracy.md`).
Fallback (only if `SendMessage` is unavailable): dispatch a fresh reviewer given the prior
findings + the diff, told to treat unchanged sections as approved.

**Write each pass to a NEW round-numbered file** — `<slug>/<slug>-r<ROUND>.html`, same
`<slug>/` dir; do not overwrite the prior page. If you must overwrite a filename, `Read` it
first (the Write tool refuses to overwrite a file it hasn't seen in-session). Re-generate and
re-link against the new file (the Monitor watches the server log and needs no re-pointing;
the link does).

**Archival applies to every version, not just the first.** When `$ARCHIVE` is set, each new
version runs the same step-3.5 / step-4 archival: snapshot the new version's `<page>` as its
`draft` before the panel touches it, archive each resumed reviewer's findings, and snapshot
its `final` at mint — bump `<N>` per version so each set is distinct.

---

# Shape B — the Yes/Maybe/Skip review board

For a *set* of items to triage. The board (`references/board-template.html`) lists items;
the user rates each **Yes / Maybe / Skip**, annotates, and submits.

### 1 — Assemble the items

First read `references/views/PRINCIPLES.md` (including "Depth") and `references/review-design.md`;
the board is a page like any other, obeys both, and goes through the same panel (step 2.5).

```js
{ id:"kebab-unique", title:"…", status:"",            // status:"ready" only on re-review passes
  badges:[],                                          // OPTIONAL meta line (plain mono, joined by " · "; NOT pills).
                                                      // Exception-only — most items: []
  summary:"one-line gist",
  detail:"<h4>Pros</h4><ul><li><span class=\"pos\">+</span> …</li></ul><h4>When to use</h4><p>…</p>",
  open:true,                                          // default-expand detail (use for small/dense option boards)
  links:[{label:"open ↗", href:"<http:// link from fs-link.sh>"}] }  // links optional
```

A one-line `summary` + thin `detail` fails — put the gist in `summary`, the deciding
substance in `detail`. A linked file must live under `$SERVE_ROOT` to be linkable —
generate its `href` with `fs-link.sh`.

### 2 — Generate the board

Inject the data into a copy of the template by replacing its **five** markers (use node so
JSON escaping is safe, via `JSON.stringify` — do NOT hand-edit/sed). Set `SUBMIT_URL` to
`/?t=<TOKEN>` (token from `references/serving.md`):

```bash
CHANNEL=$(openssl rand -hex 8)   # ONLY the first board this session; reuse the SAME literal on later rounds — see references/serving.md
node - "$ROUND" "$TOKEN" "$CHANNEL" "$SKILL" "$SERVE_ROOT" <<'JS'
const fs = require("fs");
const ROUND = parseInt(process.argv[2], 10);
const TOKEN = process.argv[3];
const CHANNEL = process.argv[4];
const SKILL = process.argv[5];
const SERVE_ROOT = process.argv[6];
const TITLE = "Short round title";
const ITEMS = [ ... ];   // the array from step 1
const SUBMIT_URL = "/?t=" + TOKEN;
let tpl = fs.readFileSync(SKILL + "/references/board-template.html", "utf8");
// function-replacement form: $ in JSON content (prices, regexes) must NOT be read as a
// replacement pattern ($&, $1, $$) the way a string-arg replace/replaceAll would; ROUND stays
// numeric (%d-equivalent), the rest are JSON.stringify'd (json.dumps-equivalent)
tpl = tpl.replaceAll("/*__ROUND__*/ 1", () => "/*__ROUND__*/ " + ROUND);
tpl = tpl.replaceAll('/*__TITLE__*/ ""', () => "/*__TITLE__*/ " + JSON.stringify(TITLE));
tpl = tpl.replaceAll("/*__ITEMS__*/ []", () => "/*__ITEMS__*/ " + JSON.stringify(ITEMS));
tpl = tpl.replaceAll('/*__SUBMIT_URL__*/ ""', () => "/*__SUBMIT_URL__*/ " + JSON.stringify(SUBMIT_URL));
tpl = tpl.replaceAll('/*__CHANNEL__*/ ""', () => "/*__CHANNEL__*/ " + JSON.stringify(CHANNEL));
fs.writeFileSync(`${SERVE_ROOT}/<slug>-r${ROUND}.html`, tpl);
JS
```

Name it `<slug>-r<ROUND>.html`; keep prior rounds for a trail. Then copy the fonts the
template references (`cp` is overwrite-safe):

```bash
mkdir -p "$SERVE_ROOT/assets/fonts"
cp "$SKILL/assets/shared/fonts/"*.woff2 "$SERVE_ROOT/assets/fonts/"
```

The template is self-contained for CSS/JS but **not** for fonts: its `@font-face` rules use
root-absolute `url('/assets/fonts/…')`. Skip the copy above and a board-only session 404s
all six faces and silently falls back to system serif/sans.

### 2.5 — Review panel (required gate — same panel as Shape A step 3.5)

The board is a page like any other — run the full step-3.5 panel before handover (three
reviewers in parallel, adjudicate, fix, regenerate; every new board version re-runs it under
the Stop condition and 2-pass cap), and mint only after its `$STATE_DIR/<slug>-r<N>.clean`
marker exists. If a fix is a house-style change, fix the cause in
`references/board-template.html` + `PRINCIPLES.md` + the relevant `review-*.md`, never on one
generated board.

### 3–6 — Same pipeline

Start the server + hand the link (step 4), wait, then process feedback per the step-5
fan-out and re-serve with addressed items set `status:"ready"` (they sort to top, marked
"→ Re-review") for another pass.

---

## Archival (opt-in)

Off by default. When the `ARCHIVE` config key (or `HTMLIZER_ARCHIVE=1`) is set, the step-3.5
and step-4 calls above save each version's draft, final, and reviewer findings under
`$STATE_DIR/history/<slug>/`. Full layout and rationale in `references/serving.md` →
"Archiving page history".

## Notes

- **Turn-model reality:** this works in batched passes, not a continuously streaming queue.
  The HTTP submit + Monitor is a true auto-return, but an external page can't trigger
  sub-agents mid-turn — the Monitor delivers the submission as the next turn, then you fan out.
- **Submit reliability:** the POST is token-gated (`?t=<token>`) and host-allowlisted. If it
  can't reach the server the page silently falls back to copying a paste-ready prompt — a
  submit is never lost.
- **Security:** see `references/serving.md` for the full posture (loopback default, cookie
  gate, `/fs/` signing, denylist, symlink realpath, token rotation, opt-in roots). Every
  route is authenticated — there is no tokenless GET.
- `fs-link.sh` prunes serve-root pages older than 30 days on every mint — don't expect an old
  link to resolve indefinitely.
- **Every board-server restart mints a fresh submit TOKEN**, which silently 403s the POST for
  any board/view handed out before the restart and orphans its Monitor. Warn the user their
  older open links are dead if you ever restart it.
