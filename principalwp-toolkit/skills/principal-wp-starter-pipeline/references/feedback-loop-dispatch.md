# Feedback Loop dispatch (opt-in, a later session)

Used for a confirmed Feedback Loop invocation — SKILL.md's recognition test already
matched (`feedback-loop <run-id>` with an existing scratch dir). Follow this instead of the
build pipeline.

Do **not** run Preflight — skip the setup gate (step 0), the scratch-dir /
gitignore / git / LSP checks, and phase detection — and do **not** touch the
build gate. The Feedback Loop reads a finished ticket's artifacts and needs no E2E
stack, so the one build-time hard halt does not apply to it. Route it:

1. **PR + authorization (the permissioned pull).** If a third token is present and looks like a PR
   number, resolve/confirm it with `gh pr view <that-number> --json number,url` (read-only) and use
   it as `PR_REF`. If no third token is present, fall back to `gh pr view --json number,url` for the
   current branch's PR (read-only). Either way, if `gh` is missing, `gh auth
   status` fails, or no PR is found, set `PR_REF=none` and note it. If a PR is found, show the dev
   the PR and ask — via `AskUserQuestion` — whether the Feedback Loop may pull its review comments; set
   `PR_AUTHORIZED=yes|no`. `PR_REF` keeps the found number either way — the Feedback Loop only pulls comments
   when both `PR_AUTHORIZED=yes` and `PR_REF` is not `none`. Once the ticket's branch is merged and
   deleted, the current-branch lookup won't find the PR — pass the PR number as the third token
   instead.
2. **Spawn** `principal-wp-starter-pipeline-feedback-loop` with `RUN_ID=<run-id>`, `REPO_ROOT`, `PR_REF`, and
   `PR_AUTHORIZED`.
3. Read its first `STATUS` line. On `STATUS: blocked` (missing scratch dir), tell the dev the run-id
   didn't resolve. Otherwise point them at `.principal-wp-starter-pipeline/<run-id>/feedback-loop.md`: it holds proposed
   override blocks for their overrides file (pure-proposal — they append the ones they agree with by
   hand). **End the turn.**

## What the Feedback Loop is

**Feedback Loop** (the pipeline-capability loop) is **not** part of the automatic
closeout — it is opt-in and runs in a later session via
`/principal-wp-starter-pipeline feedback-loop <run-id>`. It reads the finished ticket's artifacts,
the `spec.gate.md` diff, this ticket's mined sub-agent transcripts, and — with
the dev's ok — its PR comments. For each finding it **generalizes** the concrete
symptom into the *class* of mistake it belongs to, **routes** that class to the
single agent or skill whose remit should have prevented it, and then writes
`.principal-wp-starter-pipeline/<run-id>/feedback-loop.md`: **proposed** override blocks for the dev's
overrides file, one per stage the class routes to. Pure-proposal — the dev
appends what they agree with; the pipeline moves no bytes into any agent, the
skill, or the overrides file. This is the one place the pipeline's own behavior
gets refined; Compound and Advisor never touch it.
