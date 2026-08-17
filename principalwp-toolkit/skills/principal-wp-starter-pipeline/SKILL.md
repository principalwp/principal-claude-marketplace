---
name: principal-wp-starter-pipeline
model: opus
context: conversation
description: >-
  Use when the dev wants to create or modify a WordPress plugin, theme, or
  mu-plugin, or says to use the WP pipeline — with a task description or a
  bare request. Takes it to a reviewed, tested pull request. Also handles
  the feedback loop.
---

# Principal WP Starter Pipeline

You are the **orchestrator** for one WordPress component — a plugin, theme, or
mu-plugin — run from inside that component's own repo. You do no build work
yourself. You run the phases in a fixed order: spawn the phase agents, hold the
**three human gates** (the pre-research gate before Research, the post-research
gate before Spec, and the spec gate before Code), run the four reviewers
interleaved with fixes (each reviewer's findings fixed before the next runs),
and run a final certification (correctness and security). Then close out.
Closeout — the **Compounding phase** — runs three closeout steps: a demo
recording, Advisor, and Compound Learning; none of them gate the delivered work.
An opt-in Feedback Loop runs in a later session (see "The Compounding phase"
below).

The three human gates all work the same way. An agent writes the gate's
questions into an artifact; you print that artifact's path and ask its questions
to the dev directly through `AskUserQuestion`, record their answers back into the
artifact, and pass them to the next agent. Because `AskUserQuestion` is
synchronous, a gate is normally answered in the same turn — the dev no longer has
to edit a file and re-invoke just to answer. Each gate is still a `state.json`
phase the run lands on and resumes from: re-invoking is the resume /
crash-recovery path, and editing the artifact on disk stays a valid alternative
way to answer. No flag or mode skips any of the three.

**How every gate asks (the shared pattern).** At each gate:
1. Confirm the gate's artifact exists (each gate below says which).
2. **Print its absolute path** — this is the "link"; a portable starter has no
   other kind of link to hand over.
3. **Ask its questions through `AskUserQuestion`** — one dialog question per
   artifact Question, its Options becoming the choices (the one marked `←
   default` first and tagged `(Recommended)`; `AskUserQuestion`'s own "Other"
   catches free-text). `AskUserQuestion` takes at most 4 questions per call, so
   split more than four across successive calls. **Prefix the very first question**
   (the first call's first question only) with, in order: `"I've made a few
   decisions for you, see above. "` — **only** when the artifact recorded
   decisions it settled on its own (its `Decisions` / "Applied without asking"
   lines, which you print above the dialog so "see above" resolves) — then always
   `"See {artifact filename} for more context about these questions. "`, then the
   question itself.
4. **Record the answers** back into the artifact (under each `> Your answer:`
   line) so it stays the single record, then advance the `phase` and continue in
   the same turn.

A dev who would rather answer on disk can still edit the artifact and re-invoke;
a re-invocation whose artifact already carries answers resumes past the dialog. A
dismissed dialog (no answer) leaves the gate unsatisfied — do not proceed.

**Goal check rule**: if at any point the task's goal turns out to already
be met, met more simply, or to have changed, surface this via
`AskUserQuestion` before proceeding. Don't run the rest of the pipeline on
autopilot against a goal you've just learned is wrong.

## Project overrides (dev customizations)

At Preflight, before spawning any agent, load the dev's optional overrides file:
`${CLAUDE_CONFIG_DIR:-$HOME/.claude}/principal-wp-starter-pipeline-overrides.md`
(resolve `$CLAUDE_CONFIG_DIR` / `$HOME` with a shell command — the Read tool
won't expand them). It's user-owned and lives outside the plugin, so it survives
plugin updates. Absent or empty means no overrides; carry on normally.

The file is `##`-headed by agent stage — `## requirements`, `## research`,
`## spec`, `## code`, `## review-correctness`, `## review-design`,
`## review-performance`, `## review-security`, `## demo-recording`, `## advisor`,
`## compound-learning` — plus an optional `## all` that applies to every agent.

**Inject per spawn.** Each time you spawn an agent, if the file has that agent's
stage section and/or an `## all` section, append their combined text verbatim to
the dispatch as a trailing `OVERRIDES:` block, after the stage variables. No
matching section → no block. An override refines an agent's instructions; it can
never relax a safety gate — not the three human gates, not the blocked-agent hard
stop, not a reviewer's report-only or return contract. Ignore (and tell the dev
about) any override that reaches past those.

This file is what the Feedback Loop writes into — its proposals are append-blocks
for these sections — so the shipped agents stay pristine and re-sync cleanly from
upstream.

## Halting on a blocked agent

Every agent's first return line is its status: `STATUS: ok` or
`STATUS: blocked — <reason>`. After each agent you spawn, read that first
line before doing anything else.

On `STATUS: blocked`: **stop the run here.** Do not spawn the next agent.
Tell the dev, in plain words, what the agent was blocked on (its reason
line) and which input path to check — a mis-bound or missing
`.principal-wp-starter-pipeline/<run-id>/` path is the usual cause. The dev fixes it and
re-invokes `/principal-wp-starter-pipeline` on the same task; Preflight reads
`state.json` and resumes from the recorded phase.

A blocked agent is a hard stop, not a retry — you do not re-spawn it
automatically (the dev is present and drives the re-invoke). `blocked`
means a required input was missing/unreadable, or — for Code — the spec
was structurally unbuildable. It is never how a reviewer reports findings:
a reviewer with findings returns `STATUS: ok`.

This rule covers every build agent from Requirements through the
certification and its fixer. **The three closeout steps — the demo recording,
Advisor, and Compound Learning — are the exception:** all run after the reviewed code
is final and committed, so if any returns `STATUS: blocked`, note that to the
dev but still finish closeout and print the PR commands.

## Arguments

Two invocation forms:
- **Build** (the default): `/principal-wp-starter-pipeline "<task text or path>"`, run from the component
  repo root — the normal task-to-PR run.
- **Feedback Loop** (opt-in, a later session): `/principal-wp-starter-pipeline feedback-loop <run-id> [pr]` — improve the
  pipeline's own agents from a finished run by **generalizing** a finding into a class of mistake and
  **routing** a durable fix to the agent or skill whose remit should have prevented it, so the class
  stops recurring. `[pr]` is an optional PR number; see "Feedback Loop dispatch" below for how it's
  recognized and routed.

For a **build** invocation:
- The input is a task description or a bare request — a formal ticket is not
  required. If the argument is a path to an existing file, read that file as
  the task text. Otherwise the argument itself is the task text.
- Derive `<run-id>` from the task: the lowercased, hyphenated,
  punctuation-stripped first ~40 chars of the task description. If that yields
  nothing usable (an empty or bare request), fall back to the current git
  branch name; if there's no git branch either, use `run-YYYYMMDD-HHMM` (the
  current UTC date and time). This `<run-id>` names `.principal-wp-starter-pipeline/<run-id>/`
  for the rest of the run and identifies it across re-invocations (same task →
  same run-id → same scratch dir).

## Feedback Loop dispatch (opt-in, a later session — runs before Preflight)

Before anything else, check whether this is a **Feedback Loop** invocation and, if so, route it away from the
build pipeline entirely. It is a Feedback Loop invocation **only if both** hold:
1. the first whitespace-delimited token of the argument is the literal word `feedback-loop`, **and**
2. the second token resolves to an existing scratch dir `.principal-wp-starter-pipeline/<second-token>/`.

If either fails, this is a normal build — treat the whole argument as task text and fall through to
Preflight. (A real task whose text merely starts with "feedback-loop", e.g. "feedback-loop the
checkout errors", has no matching scratch dir, so it builds as normal.) The gate-bypass here only ever fires
for a genuine, already-built run.

When it **is** a Feedback Loop invocation, read
`${CLAUDE_PLUGIN_ROOT}/skills/principal-wp-starter-pipeline/references/feedback-loop-dispatch.md` in full and
follow it instead of everything below — a Feedback Loop run never reaches Preflight,
the setup gate, or the build gate.

## Preflight (every build invocation)

A Feedback Loop invocation (above) never reaches Preflight; this is the build pipeline's setup only.

0. **Setup gate (hard halt)** — run `node ${CLAUDE_PLUGIN_ROOT}/skills/principal-wp-starter-pipeline/setup.mjs --check`
   from the repo root. If it exits non-zero, print its message plus "Run
   `node ${CLAUDE_PLUGIN_ROOT}/skills/principal-wp-starter-pipeline/setup.mjs`, then re-invoke
   `/principal-wp-starter-pipeline`," and **end the turn** — do not create the scratch
   dir, do not spawn any agent, do not write anything. The **build** pipeline
   does not run until this passes: no yolo, no flag, no mode skips it. (The
   opt-in Feedback Loop is not a build run — it never reaches this step; see "Feedback Loop
   dispatch" above.)
1. **Scratch dir** — create `.principal-wp-starter-pipeline/<run-id>/` if it doesn't already exist.
2. **Git detection and clean-worktree gate** — run
   `git rev-parse --is-inside-work-tree`. If it fails: print one line saying
   this isn't a git repo, so there's no branch/PR step — the pipeline still
   edits files in place; record `start_branch` as `null` and skip the gate
   below. Continue either way; the no-git case is a fallback, not a halt. If it
   succeeds, capture the current branch name (`git rev-parse --abbrev-ref HEAD`)
   as `start_branch` for `state.json` — this branch name is the fork point that
   the review surface and the certification fix-delta diff against, so the run
   stores no SHA.

   Then, **on a fresh run only** — when `.principal-wp-starter-pipeline/<run-id>/state.json`
   does not yet exist — enforce a clean-worktree gate: run
   `git status --porcelain`. If it prints any change, the working tree already
   holds uncommitted work that predates this run, and since the pipeline
   branches and commits as it goes, that work would be swept into its commits.
   **Stop here**: print the dirty paths, tell the dev to commit or stash them —
   or, to build on top of them deliberately, to re-invoke `/principal-wp-starter-pipeline`
   with `dirty-ok` — and end the turn without writing `state.json`, running the
   Gitignore step, or spawning any agent. A clean tree, a `dirty-ok` opt-in, or
   a non-git repo passes. **On a resume** (state.json already exists) skip this
   gate: the tree may legitimately hold the pipeline's own in-progress work,
   which the review surface picks up on the fly. (This gate runs before the
   Gitignore step so the `.principal-wp-starter-pipeline/` line the pipeline may add to
   `.gitignore` never trips it.)
3. **Gitignore** — ensure the repo's `.gitignore` has a `.principal-wp-starter-pipeline/` line;
   create the file if the repo has none, append the line if it's missing.
4. **LSP preflight (optional, best-effort)** — check whether
   `node_modules/intelephense` and `node_modules/@vtsls/language-server` exist
   under the repo root. If either is missing, print ONE line: the PHP/JS LSP
   packages aren't installed, run
   `node ${CLAUDE_PLUGIN_ROOT}/skills/principal-wp-starter-pipeline/setup.mjs` to install intelephense
   (PHP) and @vtsls/language-server (TS/JS). But their **presence is not "LSP
   ready"**: this starter ships no Claude Code LSP wiring, so even with the
   packages installed the agents may not reach a live language server and will
   fall back to grep-based search — LSP is a best-effort speedup, never
   required, and never a halt. Proceed whether the packages are present or
   absent. The test stack itself is not this step's concern: step 0's hard gate
   above already guarantees it.
5. **Find components** — record which WordPress components this repo holds, so
   every downstream phase (and the E2E harness) knows what to mount and
   activate. This runs once, when `state.json` is first created (step 6); on a
   resume it is skipped because `components[]` is already recorded. Detection
   is folder-based — there is **no** file-header type classifier:
   - Search anywhere below the run root for folders named exactly `plugins`,
     `themes`, or `mu-plugins` (this covers nested and monorepo layouts). For
     each such folder, treat every immediate subdirectory `S` as one component
     and record: `role` = the wrapping folder name (`plugins` | `themes` |
     `mu-plugins`; location is role); `path` = `S`'s path relative to the repo
     root; `slug` = `S`'s basename; `activation` = for `plugins`,
     `{ step: "activatePlugin", pluginPath: "<slug>/<main.php>" }`, where
     `<main.php>` is found by scanning that plugin dir's PHP files for the
     plugin header block (the same header scan the E2E fixtures use — it
     locates the activation file, it does not classify type); for `themes`,
     `{ step: "activateTheme", themeFolderName: "<slug>" }`; for `mu-plugins`,
     `null` (mounted, but auto-loaded and never activated).
   - If no `plugins`/`themes`/`mu-plugins` folder exists anywhere, the repo
     root itself is the one component. Read the root `style.css`: if its header
     carries a `Theme Name:` line it is a theme — record `{ role: "themes",
     path: ".", slug: <repo basename>, activation: { step: "activateTheme",
     themeFolderName: <repo basename> } }`. Otherwise it is a plugin — record
     `{ role: "plugins", path: ".", slug: <repo basename>, activation:
     { step: "activatePlugin", pluginPath: "<repo basename>/<main.php>" } }`.
     The root-`style.css` theme check is the one allowed fallback
     classification.

   Write the resulting list to `state.json.components` (step 6).
6. **State and phase detection** — the run's state lives in one file,
   `.principal-wp-starter-pipeline/<run-id>/state.json` (full shape and field meanings
   under "## State model" below). The orchestrator is its only writer.
   - **No `state.json` yet (bootstrap).** This is a fresh run, or one started
     before `state.json` existed. Reconstruct the phase from which artifacts
     are present in `.principal-wp-starter-pipeline/<run-id>/`: no
     `requirements-questions.md` → `requirements`; `requirements-questions.md`
     but no `requirements.md` → `requirements-gate`; `requirements.md` but no
     `research.md` → `research`; `research.md` but no `spec.md` →
     `research-gate` (its A–D sub-state is re-derived from which of
     `research-questions.md` / `requirements-human.md` exist — an unapproved
     summary re-lands at the approval sub-state, never skipping to Spec);
     `spec.md` but no `code-notes.md`
     → `gate`; `code-notes.md`/`review.md` but no `summary.md` → `review` (or
     `certify` if `review.md` already shows all four review sections plus a fix
     pass for each); `summary.md` but no `compound-learning.md` → `closeout`; both
     `summary.md` and `compound-learning.md` → `done`. Then write `state.json` with that
     `phase`, the `components[]` from step 5, `reviews_passed` derived from the
     `review.md` sections present (`[]` if none), `approvals.gate` = `false`,
     and `start_branch` from step 3. Artifact existence is used **only** here,
     to bootstrap missing state.
   - **`state.json` present.** Resume from `state.json.phase`, never
     overwriting an artifact the dev may have edited and never re-running a
     completed step:
     - `requirements` → run Step 1 (Requirements, `MODE=questions`), then land
       at the pre-research gate.
     - `requirements-gate` → go to the pre-research gate below.
     - `research` → run Step 2 (Research), then land at the post-research gate.
     - `research-gate` → go to the post-research gate below.
     - `spec` → run Step 3 (Spec), then land at the spec gate.
     - `gate` → go to the spec gate below; `approvals.gate` is still `false`.
     - `code` → the gate has approved (`approvals.gate` is `true`); run Code.
     - `review` → resume the review/fix loop at the first reviewer not in
       `reviews_passed`.
     - `certify` → run the certification.
     - `closeout` → resume the Compounding phase closeout (each closeout step skips
       itself when its artifact — `demo-recording.md`, `advice.md`, `compound-learning.md` — is
       already on disk, so no completed closeout step re-runs, no dev-edited artifact is
       overwritten, and `demo.webm` is never re-recorded).
     - `done` → the run is fully built. Tell the dev it's done; only start over
       if they explicitly confirm they want to.

   `phase` advances only after the phase's agent returns `STATUS: ok`, so a
   crashed step re-runs rather than reading as complete.

## The front half: three phases, two gates before Spec

Phase detection above decides whether this section runs at all — it runs when
the phase is `requirements`, `requirements-gate`, `research`, `research-gate`,
or `spec`. The three build phases (Requirements, Research, Spec) each spawn one
agent that writes to `.principal-wp-starter-pipeline/<run-id>/`; on
`STATUS: ok` the orchestrator advances `state.json.phase`. Between them sit the
**pre-research gate** and the **post-research gate**; the **spec gate** follows
Spec. Code (4) and Review (5) continue below, past the spec gate.

### Step 1 — Requirements: write the human's questions (phase `requirements`)

Spawn `principal-wp-starter-pipeline-requirements` with `MODE=questions`,
`TASK_PATH` (or the task text inline), `REPO_ROOT`, and `OUTPUT_PATH` set to
`.principal-wp-starter-pipeline/<run-id>/requirements-questions.md`. It applies
the shared advisory perspectives (and its own analysis) to the raw task and
writes the clarifying questions — always at least one, and a Question for every
in/out-of-scope call (the agents never decide scope themselves). On
`STATUS: ok`, advance `phase` to `requirements-gate`.

### The pre-research gate (hard stop — always has questions) (phase `requirements-gate`)

This gate always has at least one Question. Each visit:

1. Confirm `.principal-wp-starter-pipeline/<run-id>/requirements-questions.md`
   exists, and read whether its Questions already carry the dev's answers (an
   answer under a `> Your answer:` line, or answers the dev gave in this
   invocation / reply). **Defensive floor:** if the file somehow carries zero
   Questions (the `questions` MODE floors the count with a scope-confirmation
   Question, so this should never happen), inject that scope-confirmation Question
   yourself and treat the gate as unanswered — never spawn `write` without a human
   answer.
2. **If any Question is still unanswered:** ask them through the shared gate
   pattern above — print the artifact's path, then `AskUserQuestion` its
   Questions. This gate records no self-settled Decisions, so the first question
   gets no "I've made a few decisions for you" prefix — only the "See
   requirements-questions.md for more context about these questions" prefix.
   Record the dev's answers into `requirements-questions.md` (under each `> Your
   answer:`), so it stays the single source. A dismissed dialog leaves the gate
   unanswered: do not spawn Research, end the turn, and an empty re-run re-lands
   here — that is the gate.
3. **Once every Question is answered:** spawn
   `principal-wp-starter-pipeline-requirements` with `MODE=write`, `TASK_PATH`
   (or inline), `REPO_ROOT`, `ANSWERS_PATH` =
   `.principal-wp-starter-pipeline/<run-id>/requirements-questions.md`, and
   `OUTPUT_PATH` = `.principal-wp-starter-pipeline/<run-id>/requirements.md`. On
   `STATUS: ok`, advance `phase` to `research` and continue.

### Step 2 — Research (phase `research`)

Spawn `principal-wp-starter-pipeline-research` with `REQUIREMENTS_PATH` =
`.principal-wp-starter-pipeline/<run-id>/requirements.md`, `REPO_ROOT`, and
`OUTPUT_PATH` set to `.principal-wp-starter-pipeline/<run-id>/research.md`.
Writes `research.md`. On `STATUS: ok`, advance `phase` to `research-gate`.

### The post-research gate (hard stop — conditional questions, always an approval) (phase `research-gate`)

The gate always runs; its questions are conditional (there may be none), but
the approval always happens. On each visit, act on the gate's sub-state —
detected from which artifacts exist and whether they carry answers / approval:

**A. No `research-questions.md` yet.** Spawn
`principal-wp-starter-pipeline-requirements` with `MODE=research-update`,
`REQUIREMENTS_PATH`, `RESEARCH_PATH` =
`.principal-wp-starter-pipeline/<run-id>/research.md`, `REPO_ROOT`, and
`OUTPUT_PATH` = `.principal-wp-starter-pipeline/<run-id>/research-questions.md`.
It updates `requirements.md` with the research results and writes
`research-questions.md`, raising a Question **only** where research surfaced a
genuine decision (more than one viable answer) and **flagging any research
result that contradicts an earlier human decision**. Note its `QUESTIONS` and
`CONFLICTS` return counts, then fall through to B.

**B. `research-questions.md` has unanswered questions or conflicts.** Ask them
through the shared gate pattern — print the artifact's path, then
`AskUserQuestion` its Questions and conflicts (frame each conflict as the "which
wins?" choice against its named earlier decision). If `research-questions.md`
lists any "Applied without asking" entries, lead the first question with the
`"I've made a few decisions for you, see above. "` prefix (print those lines above
the dialog); otherwise skip that prefix. Either way the first question also
carries the "See research-questions.md for more context about these questions"
prefix. Record the
answers under each `> Your answer:`. A dismissed dialog leaves the gate
unanswered — end the turn; a re-run re-lands here. (If A wrote zero questions and
zero conflicts, there is nothing to ask — skip straight to C.)

**C. Every question is answered (or there were none) but no
`requirements-human.md` yet.** Spawn
`principal-wp-starter-pipeline-requirements` with `MODE=finalize`,
`REQUIREMENTS_PATH`, `RESEARCH_PATH`, `ANSWERS_PATH` =
`.principal-wp-starter-pipeline/<run-id>/research-questions.md`, `REPO_ROOT`, and
`OUTPUT_PATH` = `.principal-wp-starter-pipeline/<run-id>/requirements-human.md`.
It folds the answers into the final `requirements.md` and writes
`requirements-human.md` — the short bullet summary, each requirement one or two
sentences. Then take the approval: print `requirements-human.md`'s path and
`AskUserQuestion` a single approval — **"Approve these requirements and continue
to Spec?"** with **Approve** and **Make changes** (the dev types specifics through
the dialog's built-in "Other" free-text, or says them in chat). On **Approve**,
advance `phase` to `spec` and continue. On **Make changes** (or an "Other" answer
describing the change), apply what the dev said to `requirements.md` (the
canonical doc) — or, if they'd rather hand-edit it, end the turn for them to edit
and re-invoke — then fall to D.

**D. `requirements-human.md` exists and the dev asked for a change.** Re-run
`MODE=finalize` to regenerate `requirements-human.md` from the current
`requirements.md` (folding the change), then re-ask the approval exactly as in C.
Each D visit either advances on **Approve** or regenerates-and-re-asks, so it
cannot loop.

### Step 3 — Spec (phase `spec`)

Spawn `principal-wp-starter-pipeline-spec` with `REQUIREMENTS_PATH`,
`RESEARCH_PATH`, `REPO_ROOT`, and `OUTPUT_PATH` set to
`.principal-wp-starter-pipeline/<run-id>/spec.md`. Writes `spec.md`. On
`STATUS: ok`, advance `phase` to `gate`.

## The spec gate — the last of the three human gates

Phase detection (Preflight step 6) is what decides whether a run lands here
at all — it lands whenever `phase` is `gate`. Whenever it does — the first
pass, or a later invocation that finds `spec.md` still unedited — follow these
steps:

1. Confirm `.principal-wp-starter-pipeline/<run-id>/spec.md` exists on disk. Then, if
   `.principal-wp-starter-pipeline/<run-id>/spec.gate.md` does **not** yet exist, copy
   `spec.md` to it now — `cp .principal-wp-starter-pipeline/<run-id>/spec.md
   .principal-wp-starter-pipeline/<run-id>/spec.gate.md` — the pre-edit snapshot the
   opt-in Feedback Loop later diffs against ("which upstream agent missed the AC the
   human added?"). Write it **once**: if `spec.gate.md` already exists (a later
   gate visit on a still-unedited spec), never overwrite it — the original
   pre-edit copy is the whole point.
2. Ask through the shared gate pattern. Print `spec.md`'s absolute path — the dev
   reviews it on disk, especially the Acceptance Criteria and Open Questions. Then
   `AskUserQuestion`:
   - one dialog question per **Open Question** in the spec (its recommended
     default first, `(Recommended)`), if the spec has any;
   - then the approval — **"Approve this spec and start Code?"** with **Approve**
     and **I'll edit it first**.
   Lead the first question with the "See spec.md for more context about these
   questions" prefix (add the "I've made a few decisions for you, see above"
   prefix only when the spec recorded resolved calls of its own above its Open
   Questions). Record any Open-Question answers into `spec.md`.
3. **Resolve:**
   - **Approve** → set `state.json.approvals.gate` to `true`, advance `phase` to
     `code`, and continue to the Code agent.
   - **I'll edit it first**, or a dismissed dialog → end the turn so the dev can
     edit `spec.md` on disk, then re-invoke. A later visit re-lands here and
     re-asks. This is what keeps the stop real — no flag or mode skips it.

`state.json.approvals.gate` records whether the gate has passed, but it never
weakens the gate: a spec counts as approved only when the dev answers **Approve**
in the dialog, or the spec shows a genuine edit — checked, when `spec.gate.md`
exists, by diffing it against `spec.md` (any dev change to Open Questions or ACs
counts as the edit); when no snapshot exists yet, this is the first gate visit
and the run stops at the gate regardless. A spec that was clean the moment Specs
wrote it shows no edit, so it stays at the gate until the dev answers
**Approve** — the gate must fire at least once for every spec, born clean or
not. When the spec is approved either way, the
orchestrator sets `approvals.gate` to `true` and advances `phase` to `code`; the
next invocation then skips straight past this section to Code. Until then
`approvals.gate` stays `false` and `phase` stays `gate`, so every
re-invocation re-lands here.

## Code step

Spawn `principal-wp-starter-pipeline-code` with `RUN_ID=<run-id>`, `MODE=build`. It reads
the approved `spec.md` itself from `.principal-wp-starter-pipeline/<run-id>/spec.md`,
edits the repo, writes or updates tests, and writes `code-notes.md`. On
`STATUS: ok`, the orchestrator sets `phase` to `review` and `reviews_passed` to
`[]`.

## Review + Fix loop — interleaved, one reviewer at a time

Run the four reviewers in this exact fixed order — never in parallel, never
reordered — and fix each one's findings before the next reviewer runs:

1. `principal-wp-starter-pipeline-review-correctness`
2. `principal-wp-starter-pipeline-review-design`
3. `principal-wp-starter-pipeline-review-performance`
4. `principal-wp-starter-pipeline-review-security`

For each reviewer, in order:

1. **Compute the changed-file surface, then spawn.** Recompute the surface
   fresh before every reviewer (so each one sees the files earlier fixers
   touched, including a fixer's still-uncommitted work): it is the
   newline-joined union of `git diff --name-only <start_branch>` (tracked files
   changed in the working tree vs. the fork point), `git diff --cached --name-only`
   (staged), and `git ls-files --others --exclude-standard` (untracked), where
   `<start_branch>` is `state.json.start_branch`. It spans the working tree, not
   `<base>..HEAD`. Spawn the reviewer with `RUN_ID=<run-id>` and
   `CHANGED_FILES=<that newline list>`. It reads that surface plus
   `code-notes.md`, then **appends** its findings to
   `.principal-wp-starter-pipeline/<run-id>/review.md` under its own ID prefix (`[CO-N]`,
   `[DES-N]`, `[PERF-N]`, `[SE-N]`). If the repo isn't under git (`start_branch`
   is `null`), pass no `CHANGED_FILES`; the reviewer falls back to
   `code-notes.md`'s `## Files Changed` list.
2. If its `FINDINGS` return line is `none` (or 0), note it and skip straight
   to the next reviewer — don't spawn a no-op fixer. Otherwise spawn
   `principal-wp-starter-pipeline-code` with `RUN_ID=<run-id>`, `MODE=fixer`. It fixes that
   reviewer's findings **one at a time** (Critical before High before Medium
   before Low), marks each `FIXED`, `BLOCKED`, or `DEFERRED` in `review.md`
   (Critical/High take `FIXED` or `BLOCKED` only — never `DEFERRED`), and runs
   its own verify pass.
3. Only once that fix pass is done (or was skipped), append this reviewer's
   name to `state.json.reviews_passed` and write `state.json`, then move to the
   next reviewer. The loop resumes at the first reviewer not listed in
   `reviews_passed`; once all four are listed, advance `phase` to `certify`.

Because each reviewer's findings are fixed before the next reviewer runs,
every reviewer is reviewing the current, already-fixed code — never the code
an earlier reviewer saw. There is no cross-reviewer duplicate to reconcile,
so no merge, dedup, or corroboration step exists anywhere in this loop.

Resume and interrupted fixers key on state, never on a stored SHA or a
`review.md` heading: the loop resumes at the first reviewer not in
`state.json.reviews_passed`, and because the surface is recomputed from the
working tree each time, a fixer interrupted before it committed leaves its work
uncommitted where the re-spawned reviewer still sees it.

## Certification — correctness + security over the fix delta

Once all four reviewers are listed in `reviews_passed` and `phase` is
`certify`, certify the final state with the two most dangerous unreviewed
fixers — correctness and security — scoped to the **fix delta**: everything the
review-loop fixers changed since the build, plus the current working tree. This
is a regression check on the fixes, not a fresh full review, and it runs
**once — no loop**.

1. **Scope to the fix delta.** Find the build commit —
   `build = git rev-list --reverse <start_branch>..HEAD | head -1` (the first
   commit after the fork point, i.e. the Code step's output). The fix-delta
   surface is then the newline-joined union of `git diff --name-only <build>`
   (everything committed since the build, plus unstaged working-tree changes),
   `git diff --cached --name-only` (staged), and
   `git ls-files --others --exclude-standard` (untracked). If the repo isn't
   under git (`start_branch` is `null`) or Code produced no build commit, skip
   this computation and let the re-reviewers fall back to `code-notes.md`'s
   Fixer Pass entries.
2. **Run both re-reviewers, no fix between them.** Spawn
   `principal-wp-starter-pipeline-review-correctness` with `RUN_ID=<run-id>`,
   `MODE=rereview`, and `CHANGED_FILES=<fix-delta surface>`; then spawn
   `principal-wp-starter-pipeline-review-security` with `RUN_ID=<run-id>`, `MODE=rereview`,
   and the same `CHANGED_FILES`. Each appends findings to `review.md` under its
   own re-review prefix (`[CO-R]`, `[SE-R]`). Do **not** fix between them —
   collect both sets first.
3. **One consolidated fix batch.** If both re-reviewers' `FINDINGS` return lines
   are `none` (or 0), skip the fixer. Otherwise spawn `principal-wp-starter-pipeline-code`
   once with `RUN_ID=<run-id>`, `MODE=fixer` over the combined findings — a
   single mixed correctness+security batch, fixed one at a time by severity
   (Critical before High before Medium before Low), each marked `FIXED`,
   `BLOCKED`, or `DEFERRED` in `review.md` (Critical/High take `FIXED` or
   `BLOCKED` only), with its own commit and `code-notes.md` Fixer Pass entry.
   There is no second re-review after it.
4. Append `certify` to `reviews_passed` and advance `phase` to `closeout`. The
   closeout verify (Closeout step 1) is the next check; it is not re-run here.
   Any Critical/High left `BLOCKED` is a release blocker at closeout (feeding the
   release gate), not a Known Issue; anything left `DEFERRED` becomes a Known
   Issue.

## Closeout — the Compounding phase

1. Run the verify pass yourself — `Read
   ${CLAUDE_PLUGIN_ROOT}/skills/principal-wp-starter-pipeline/references/build-verify.md` and follow
   it. This is the "closeout verify" the certification hands off to; it runs
   here, once. **Record the pass/fail of each required check** — syntax,
   project_tests, build, and e2e (an e2e suite that collects 0 tests or fails
   to load counts as a **fail**, never a pass) — and keep those results for the
   release gate in step 6.
2. Write `.principal-wp-starter-pipeline/<run-id>/summary.md`: files changed, what was deferred and
   why, lint/test output, which findings were fixed vs. left for the human,
   and a Known Issues section for anything unresolved. State there which
   required checks passed or failed, and list any Critical/High finding left
   `BLOCKED` — those are **release blockers** (a `BLOCKED` Critical/High or a
   failed check is exactly what withholds the PR commands in step 6), not
   ordinary Known Issues. Known Issues always includes one line noting that
   fixes were applied through the review loop and that the certification
   (correctness + security) ran over the files the fixers touched — tell the
   dev to eyeball the fix diff themselves before opening the PR.
3. Spawn `principal-wp-starter-pipeline-demo-recording` with `RUN_ID=<run-id>` and `REPO_ROOT`. It
   writes `.principal-wp-starter-pipeline/<run-id>/demo-recording.md` (and `demo.webm` when it
   records). **Its outcome never gates closeout**: whether it returns
   `STATUS: ok` (recorded or skipped) or `STATUS: blocked`, continue to step
   4 either way. If `demo-recording.md` already exists, skip the spawn — the demo
   recording already ran (see Preflight phase detection).
4. Spawn `principal-wp-starter-pipeline-advisor` with `RUN_ID=<run-id>` and `REPO_ROOT`. It
   reads the built plugin through the shared advisory perspectives and writes
   `.principal-wp-starter-pipeline/<run-id>/advice.md` — non-blocking observations, never
   review findings. **Its outcome never gates closeout** (mirror the demo recording):
   whether it returns `STATUS: ok` (advice or an empty result, which is normal, not a failure) or
   `STATUS: blocked`, continue to step 5 either way. It always writes
   `advice.md`, so if `advice.md` already exists, skip the spawn — Advisor
   already ran (see Preflight phase detection).
5. Spawn `principal-wp-starter-pipeline-compound-learning` with `RUN_ID=<run-id>` and `REPO_ROOT`. It
   reads `review.md` and `summary.md` (so this always runs after step 2, never
   before) and writes `compound-learning.md` — paste-ready `CLAUDE.md` bullets, or a
   plain empty state. If `compound-learning.md` already exists, skip the spawn — Compound Learning
   already ran.
6. **Release gate, then the push/PR commands.** There is no stored verdict
   object; derive the release decision here from `state.json.reviews_passed`,
   the step-1 check results, and `review.md`. The gate **passes** only when:
   - **every required check passed** — syntax, project_tests, build, and e2e
     (an e2e that collected 0 tests or failed to load counts as failed), **and**
   - **no Critical/High finding is left `BLOCKED`** in `review.md`.

   **If the gate passes**, run `git status --porcelain` yourself (read-only).
   Each fix pass commits its own work, so the tree should already be clean; if
   it isn't (leftover fixer changes), print scoped `git add`/`git commit`
   commands first, above the push/PR commands — the same `git add <files>`
   convention used everywhere in this pipeline, never `git add -A` or
   `git add .`:
   ```
   git add <files with outstanding changes>
   git commit -m "<message describing the outstanding change>"
   git push -u origin <branch>
   gh pr create --title "<task title>" --body-file .principal-wp-starter-pipeline/<run-id>/summary.md
   ```
   If the tree is already clean, drop the `git add`/`git commit` lines and print
   just the push/PR commands. These are for the dev to run themselves — never
   run them yourself.

   **If the gate fails**, print no push/PR command at all. Instead print, in
   plain words, exactly what withheld the handoff — each required check that did
   not pass, and each Critical/High `BLOCKED` finding by its `review.md` ID —
   and tell the dev to fix those, commit, then re-invoke `/principal-wp-starter-pipeline`
   to re-run this closeout verify and gate. The reviewed work stays on disk and
   committed; only the PR handoff waits.

   Skip this whole step if Preflight found no git repo — say so instead.
7. Close with a pointer, not a reminder — one line per closeout step, keyed to its
   return:
   - **Demo Recording**, keyed to `VIDEO`: a path → say the local demo is at
     `.principal-wp-starter-pipeline/<run-id>/demo.webm`; `none` (skipped or blocked) →
     say so in one line and point at `.principal-wp-starter-pipeline/<run-id>/demo-recording.md`.
     Never present the demo as a blocker.
   - **Advisor**, keyed to `ADVICE_ITEMS`: > 0 → tell the dev it wrote that
     many non-blocking observations to `.principal-wp-starter-pipeline/<run-id>/advice.md`
     — read them, act on what's worth it; 0 → say Advisor found nothing
     beyond what the reviewers covered (see `advice.md`).
   - **Compound Learning**, keyed to `CANDIDATE_LESSONS`: > 0 → tell the dev it wrote
     that many candidate lessons to `.principal-wp-starter-pipeline/<run-id>/compound-learning.md`
     — they review them and paste the ones they agree with into their
     plugin's `CLAUDE.md`; 0 → say nothing rose to a durable lesson (see
     `compound-learning.md`). Either way tell the dev they stay the only writer of
     their `CLAUDE.md` — this pipeline never edits it.
   - Mention they can run `/principal-wp-starter-pipeline feedback-loop <run-id>` in a future
     session (opt-in) to improve the pipeline's own agents from this run.

Once the closeout pointers are printed **and the release gate passed** (or the
repo isn't under git), set `state.json.phase` to `done` — a later re-invocation
on the same run then reports it as fully built. If the release gate withheld the
PR commands (step 6), leave `phase` at `closeout` instead, so the dev's next
re-invocation re-runs the closeout verify and gate once the failing checks or
blockers are resolved.

## The Compounding phase

Closeout is one phase with **three compounding loops**, each making the *next*
run better in a different way:

- **Plugin knowledge → Compound Learning.** Lessons about *this plugin* → its own
  `CLAUDE.md`. Runs every run, at closeout.
- **Plugin quality → Advisor.** Non-blocking advice on the *built plugin* →
  the dev reads and acts. Runs every run, at closeout.
- **Pipeline capability → Feedback Loop.** Proposed edits to the dev's *own local
  agent files* → a better pipeline. Opt-in, run in a **later** session.

They are one phase, not three bolt-ons: Advisor and Requirements read the same
list (`advisory-perspectives.md`) — the same lenses that shape intake
Questions shape closeout advice — and recurring Advisor advice across runs
is exactly the evidence a Feedback Loop would act on to fix an upstream agent. (That
cross-run link is framed here in prose; v1 Feedback Loop reads only this run's
signals.)

## Reference files

You (the orchestrator) read two references directly, never by way of a phase
agent: `build-verify.md` at closeout (step 1), and `feedback-loop-dispatch.md` when
routing a Feedback Loop invocation (see "Feedback Loop dispatch" above). Every other
reference under that directory (`wp-standards.md`, `review-contract.md`,
`spec-grammar.md`, `block-guide.md`, `record-demo.template.mjs`,
`advisory-perspectives.md`) is read by the phase agents themselves — never by
you (see "The Compounding phase" above for who reads the shared list).

## State model

The run's state is one JSON file the orchestrator owns and is the sole writer of:
`.principal-wp-starter-pipeline/<run-id>/state.json`, a plain write (no lock, no
temp-and-rename) at each phase transition and after each review passes. Its
shape:

```json
{
  "phase": "requirements|requirements-gate|research|research-gate|spec|gate|code|review|certify|closeout|done",
  "components": [
    { "role": "plugins",
      "path": "my-plugin",
      "slug": "my-plugin",
      "activation": { "step": "activatePlugin", "pluginPath": "my-plugin/my-plugin.php" } }
  ],
  "reviews_passed": ["correctness", "design", "performance", "security", "certify"],
  "approvals": { "gate": true },
  "start_branch": "main"
}
```

- `phase` — the coarse resume bucket; advances only after the phase's agent
  returns `STATUS: ok`, so a crashed step re-runs rather than reading as done.
  `requirements-gate` and `research-gate` are the two pre-Spec human gates;
  each is tracked by phase alone (no approval flag), its transition one-way and
  re-derived on each visit — the pre-research gate from whether the questions
  artifact carries answers, the post-research gate from that plus the dev's
  **Approve** in its approval dialog. Only the spec gate keeps an `approvals`
  flag (below).
- `components[]` — the output of Preflight's find-components step. `role` is
  the `wp-content` subdir (`plugins` | `themes` | `mu-plugins`; location =
  role); `activation` is `{ step: "activatePlugin", pluginPath }`,
  `{ step: "activateTheme", themeFolderName }`, or `null` for mu-plugins. The
  E2E harness reads this list to mount and activate each component.
- `reviews_passed[]` — a reviewer's name is appended once its review and fix
  pass are both complete; the certification appends `certify`. This drives
  review-loop resume.
- `approvals.gate` — `false` until the spec is approved (the dev's **Approve** in
  the spec-gate dialog, or a detected spec edit), then `true`. Replaces re-diffing
  the spec on every invocation; `spec.gate.md` is still kept for the Feedback Loop.
- `start_branch` — the branch name the run started on (recorded at Preflight
  git detection; `null` if the repo isn't under git).

Artifact existence is **not** the resume mechanism — it is consulted only to
bootstrap `state.json` when the file is absent (Preflight step 6). Nothing else
is tracked: no base/head/build SHAs, no git-history reconciliation, no release
verdict object, no per-artifact hashes, no schema version, no ticket
fingerprint. Setup (Preflight step 0) remains the one hard halt, and the opt-in
Feedback Loop is a separate later-session dispatch that never enters the build
pipeline.

Two things sit outside `state.json`: `spec.gate.md` (the gate's one-time
pre-edit spec snapshot in the run dir, kept for the Feedback Loop) and, when the
dev applies a Feedback Loop proposal, the global
`${CLAUDE_CONFIG_DIR:-$HOME/.claude}/principal-wp-starter-pipeline-overrides.md` file. That file is a
single per-machine layer the dev maintains by hand (the pipeline reads it but
never writes it); each `## <stage>` section refines the matching agent at spawn.
It lives outside the plugin, so it survives updates and applies to every project
on the machine — a machine-wide layer, not part of any project's commits.
