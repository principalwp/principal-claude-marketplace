# htmlizer accuracy review — the page-vs-source gate

The ONLY reviewer that reads the source. Runs in parallel with the rest of the panel (`SKILL.md`
step 3.5). Trace every load-bearing claim and reference against the source and **recommend** — with
a receipt — what is untrue, unsupported, or contradicted. You never edit the page and never issue a
binding disposition; the generating session decides and applies. Report only findings
(exception-only); write full findings to OS temp, return summary + path.

## Inputs
1. **Required** — the page path(s) under the serve root (`$STATE_DIR/serve/…`).
2. **Optional** — a **source manifest** path (schema below). With none, the dispatch names the
   repo(s) / working-tree root(s) to check against instead; **self-source and do NOT halt** — the
   manifest is a shortcut, not a precondition. Report a blocking finding ONLY for a specific
   load-bearing claim you cannot verify any way (quote it, say what you'd need) — never a blanket
   "no manifest" halt.

## Coverage line — REQUIRED, the last line of every run
- `coverage: full` — every load-bearing claim verified against a manifest and/or the named repo /
  working tree.
- `coverage: degraded — <what you couldn't reach>` — no manifest AND no repo/tree (or a specific
  claim unverifiable), so some claims rest only on the page's own references. Name them. A degraded
  pass with no HIGH is NOT a clean verified pass — the session treats those claims as still-open.

## Source manifest schema (the generating session assembles this to OS temp)
    # Source manifest — <page slug>
    Session transcript: ~/.claude/projects/<project-slug>/<SESSION_ID>.jsonl
    Generating thread's channel (CAPTURE_CHANNEL baked into the page): <hex>

    ## Digests (consult FIRST — cheap, already-verified extracts of the transcript/planning material)
    - <abs path to digest> · <one line: what it covers>
    Only grep the raw transcript (may be 1MB+) to verify a SPECIFIC quote a digest doesn't cover.

    ## Repos (for explainer pages the CODE is the source)
    - <abs path> · remote <git remote get-url origin, or "none"> · sha <git rev-parse HEAD> · github-linkable? yes/no

    ## References cited on the page
    | reference | kind | backing | where the backing lives | resolution |
    |-----------|------|---------|--------------------------|------------|
    | cg-accumulate.mjs | file | exists | context-gardener @<sha> | github-blob |
    | docs/foo-checklist.md | file | planned (not yet created) | plan.md contents outline | popover(planned) |
    | Slack message to X | artifact | talking-points only (never drafted) | plan.md T2, 5 bullets | on-page section + readmore |
    | PR #5407 | artifact | exists (external) | GitHub PR URL / transcript | link |
  `backing` ∈ exists | planned | talking-points-only | external. `resolution` = the ladder rung the page uses —
  a `.file-pop`/popover only for a short gloss; load-bearing content is an on-page section + `.readmore`.

    ## User corrections (bindings the page MUST honor)
    - <correction> (source: transcript line/ref)

    ## External links — <label>: <url>

## Disposition rule (every pass; no percentage) — you recommend, the session decides
- **Source CLEARLY CONTRADICTS** → recommend `fix` (source-backed correction) or `cut`, **quoting
  the exact contradicting source line**. No cut on inference alone. (Pass 3: a fact you searched for
  and cannot find anywhere counts as the receipt — "no matching line found in <where>"; a documented
  absence, not inference.)
- **Source SILENT or genuinely AMBIGUOUS** → recommend `question`: exact question text + 2–3 options
  for a bottom-of-page callout. Never cut on uncertainty.
- **Known bias, accepted:** the session judging critiques of its own output is a real risk — the
  mitigation is receipts (every recommendation auditable) plus the question-at-bottom valve.

## On a re-run — verify ONLY new or changed claims (HARD RULE)
When the session resumes you for a new version, every claim you already traced and cleared is
**settled — do NOT re-verify it**, not even on an unscoped whole-page pass. Verify only claims that
are NEW on this version, whose wording or number CHANGED since your last pass, or that a change
elsewhere newly makes load-bearing. Re-tracing settled claims only wastes the pass and churns
findings.

## Pass 1 — Claim accuracy
For every load-bearing claim, confirm against the manifest (digests first, raw transcript only for a
specific quote) / repo / working tree. Flag a claim the source contradicts, a reference marked
"exists" that isn't, "drafted" that was only outlined, a figure or attribution with no source.
Dispose per the rule above.

## Pass 2 — Reference-resolution TRUTHFULNESS
**Resolve every link mechanically — do NOT eyeball them.** Extract the page's URLs and run
`check-links.sh` at the absolute path your dispatch gives you (`$SKILL/references/check-links.sh`;
your shell has no `$SKILL`, so use the resolved path the dispatch pasted in). It resolves
private-repo GitHub blob links via the authenticated API — a plain curl 404s on those — and every
other link via curl:

    grep -oE 'https?://[^"'"'"'<> )]+' <page.html> | sort -u | "$SKILL/references/check-links.sh"

Any `BAD` line → recommend `fix`, quoting the manifest's real sha/path as the receipt. The script
proves a link RESOLVES; you still judge what it can't: a `.file.planned` label matches the source
(the artifact really doesn't exist yet), and an on-page load-bearing section's content matches the
source (the 5 bullets are the actual bullets, not invented). Mismatch → recommend `fix`.

## Pass 3 — Estimate-source confirmation (owns the invented-estimate-vs-real-fact call)
Settled only against the source. Every duration/effort figure the linter surfaced
(`references/preflight-lint.sh` check 11) as a claimed calendar fact must actually be in the source;
one you cannot find anywhere → recommend `cut` (receipt: "no matching line found"). Scope to those
linter-surfaced figures only — non-duration numbers are Pass 1's job.

## Also: scan the page for references the manifest omits
Grep the page for reference-shaped things (`.file`, `PR #`, "Slack", "agenda", a named ticket/doc)
and flag any the manifest doesn't back — an omitted reference still surfaces as "unbacked".

## Output (exception-only, HIGH/MED/LOW)
    [pass] <location> — <problem> → recommend <disposition>: <receipt — the quoted contradicting
    source line, OR "no matching line found in <digest/manifest/transcript>"> — <the source-backed
    correction, OR the question text + 2–3 options>
    disposition ∈ fix | cut | link | popover | show-source | question

    coverage: full | degraded — <what went unverified>      (REQUIRED — the last line, every run)

## How to run (dispatch — runs in parallel with the source-blind reader and the design+hygiene lint)
> Accuracy-review `<page.html>` against `references/review-accuracy.md`[, using source manifest
> `<path>`]. Manifest given → consult its Digests first, grep the raw transcript only for a specific
> quote. NO manifest → self-source against the repo(s)/working tree at `<repo root(s)>` and the
> page's own references; do NOT halt. Resolve links with `$SKILL/references/check-links.sh` (Pass 2
> — the dispatcher pastes the resolved absolute path), never by eye. On a re-run verify ONLY
> new/changed claims. Return only RECOMMENDATIONS: for `fix`/`cut`
> quote the contradicting source line (or "no matching line found"); for `question` give the text +
> 2–3 options. End with the REQUIRED `coverage:` line. Write full findings to OS temp; return summary
> + path. Do NOT edit the page.

## Extending
New check classes route by scope — see the routing note in `review-design.md` → "Extending". A new
source-requiring accuracy class gets a pass here; fix-at-cause in `PRINCIPLES.md`/views.
