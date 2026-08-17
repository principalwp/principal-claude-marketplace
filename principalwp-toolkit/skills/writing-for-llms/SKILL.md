---
name: writing-for-llms
description: "Write or review any document an LLM agent consumes: a skill, an agent, a CLAUDE.md or AGENTS.md, or a reference file. Use when he says create or review a skill or agent; run the token audit, trim pass, pruning, or concision; write or improve a CLAUDE.md or reference file; or when another workflow produces one for a quality pass. Modes: Create, Review."
---

# Writing for LLMs

Write and review any document an LLM agent consumes (a skill, a subagent, a `CLAUDE.md` / `AGENTS.md`, or a reference file) so it behaves predictably: the agent taking the same *process* every run, not producing the same output. Two branches, **Create** and **Review**, over those document types. Create ends by running Review on its own draft, so every path out of this skill passes the same review.

Before drafting or judging anything, read `references/guidelines.md` in full: the universal writing rules for every document type. When the document is a skill or subagent, also read `references/mechanics.md` for the description-as-router, frontmatter, invocation, tools, and routers. Both branches hold the work to every rule in them.

## Choose the branch

- Nothing exists yet, or "turn this into a skill / agent / reference" → **Create**.
- The user names an existing document, or asks for a review or the concision pass (token audit, trim pass, pruning) → **Review**.
- The user supplies a draft → ask which they want: the draft reviewed as-is (→ **Review**) or developed further (→ **Create**, with the draft as intake: requirements to interrogate, not a finished artifact).

Which document type, when the user hasn't said: a **skill** packages a process the current conversation follows; a **subagent** packages a worker that runs in its own context and reports back; a **CLAUDE.md / AGENTS.md** is always-loaded standing context for a project or user; a **reference file** is disclosed detail reached by a pointer. Recommend one in a line and confirm.

## Create

**1. Capture intent.** Mine the conversation first: the material to capture is often already in it (tools used, step order, corrections the user made). Interview for the rest. Done when you can state, one line each: what it enables; the distinct situations that should trigger it (for a reference file, the pointer that reaches it; for a CLAUDE.md, the standing behavior it sets); the expected output and how the user will judge it correct; where it lives. Confirm those before writing anything. A plain CLAUDE.md or reference file has no triggers and no frontmatter: skip what doesn't apply to it.

**2. Settle the shape.** Skill or subagent: read `references/mechanics.md` and settle invocation, the tool allowlist, and what gets disclosed behind pointers. CLAUDE.md or reference file: settle only what sits inline versus behind a pointer, and (for a CLAUDE.md) which standing rules it sets; the guidelines settle the rest. State the calls and the reasons in a few lines: the user corrects cheap words here, expensive files later. Done when the shape is stated and the user has confirmed it.

**3. Draft.** Write the document per `references/guidelines.md` (and `references/mechanics.md` for a skill or agent): its own files and nothing else. Done when: any frontmatter is valid; every step ends on a condition the agent can check; and every line of reference content is non-inferable, nothing the environment already answers (the cache rule), and earns its load; for a skill or agent, the `description` meets the standard in `references/compress-description.md`; and no em-dash (U+2014) appears anywhere in it. (An all-reference skill has no steps, so the reference bar is its whole done condition.)

**4. Independent review.** One review, from a reader who did not write the draft. You drafted it, so you can't read it cold, and someone seeing it for the first time is the real test. Dispatch a subagent and have it **invoke `writing-for-llms` and run the Review branch**: invoking loads the branch into its context, so it never opens this `SKILL.md` by path (invoke the skill, don't read its file). Its dispatch carries the draft's absolute path; the Review branch pulls in the reference files it needs. It returns findings only, no edits. Done when the review's findings and concision diffs are in hand.

**5. Fix and hand over.** Apply the findings you accept; report the ones you rejected, with reasons. Hand the user the file paths, plus the way in for each: for a skill or agent, how to invoke it and 2–3 realistic test prompts phrased the way a user actually types; for a CLAUDE.md, where it lives and that it auto-loads (nothing triggers it); for a reference file, where it lives and the pointer that reaches it. Confirm that pointer actually exists in the document meant to pull it in. Done when the user has the paths and the way in for every file.

## Review

**1. Inventory.** Scope is the document(s) the user named. Read every file in it end to end: no sampling, no judging a skill from its SKILL.md alone.

**2. Quality pass.** Hold every file against every rule in `references/guidelines.md` (and `references/mechanics.md` when the document is a skill or agent), the Pruning section of `references/guidelines.md` excepted: the concision pass owns waste. A finding cites file and line(s), names the rule it breaks, and gives the exact change as a concrete suggested edit (the full replacement text), and when more than one fix is reasonable, lists the alternatives as options: a complaint without a rewrite is not a finding. For a skill or agent, always run its `description` through `references/compress-description.md` and give the compressed form as the finding; a `description` past that standard is a finding every time, not only when it looks long. One rule is checked mechanically, not by eye: search every file in scope for the pattern `\x{2014}` and treat each hit as a defect. Use ripgrep, which Claude Code bundles and which supports the glyph-free `\x{2014}` escape where plain `grep` may not: run `rg -n '\x{2014}' <files>` in the shell, or use the Grep tool with the same pattern. The guidelines ban it; this scan is what guarantees no document the skill writes ships with one.

**3. Concision pass.** When you reach this step, read `references/concision.md` and run its procedure over the same scope.

**4. Hand over and stop.** Two things: the quality findings, and the concision pass's diffs. Run as the independent-review subagent (Create step 4): return both to the caller and stop. Run because the user asked for the review: wait. The user picks what to apply; apply exactly that.
