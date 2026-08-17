# Writing guidelines for LLM-facing documents

Reference for writing any document an LLM agent consumes: a skill, a subagent, a `CLAUDE.md` / `AGENTS.md`, or a reference file reached by a pointer. The packaging differs (read `mechanics.md` when the document is a skill or agent); the writing does not. Every rule here serves **predictability**: the agent taking the same *process* every run, not producing the same output. (Distilled from Matt Pocock's [writing-for-agents](https://github.com/mattpocock/skills/tree/main/skills/productivity/writing-for-agents), the renamed successor of writing-great-skills, and [Anthropic's skill-creator](https://github.com/anthropics/skills).)

## The two loads

Every document and pointer you add spends one of two budgets:

- **Context load**: the cost of always-loaded material on the agent's window: a `CLAUDE.md` line, a skill description, anything sitting in context every turn, spending space and attention whether or not it fires.
- **Cognitive load**: the cost on you, the human: which documents exist and when to reach for each. Not a cost to minimise: it is the price of your own agency; spend it where your judgement matters, remove it where it does not.

Material reached only through a pointer escapes context load for the price of the pointer's own line; material with no pointer rides entirely on cognitive load. Most rules below are one of these two budgets in a specific place.

## Context pointers: say when, never what

A **context pointer** is a reference held in context that names out-of-context material and encodes the condition for reaching it. A skill's description is one; a line in `CLAUDE.md` naming a doc is the same object. The pointer's *wording*, not its target, decides whether the material is ever read: a pointer that summarizes its target lets the reader believe it already knows the contents and skip the read; a pointer that names the moment sends it to the source.

- Write: "Before writing any deployment config, read `references/aws.md` in full."
- Not: "`references/aws.md`: AWS deployment configuration details."

Every pointer carries a trigger ("before X", "when you reach step N", "if the user asks Y") and, where a partial read would hurt, the depth ("in full"). Front-load the leading word: the pointer is where it does its triggering work. One trigger per genuinely distinct case; collapse synonyms. Cut identity the body already carries. If a must-read file keeps getting skipped, sharpen the wording first; inline the content only if that fails. (A skill or agent description is a context pointer with extra routing rules: see `mechanics.md`.)

## Invoke a skill, never read its file

A pointer to a reference file says read it. A pointer to a *skill* is the exception: tell the agent to invoke the skill and apply it, never to read the skill's own file. A file read lets the agent riff off what it saw and skip the skill's real behavior; invoking loads the skill and runs it. This holds anywhere you send an agent to a skill: a subagent dispatch, a `CLAUDE.md` line, another skill's body. (Reference files stay different: those are reached by reading, per the pointer rules above.)

## Information hierarchy

Two content types mix freely: **steps** (the ordered actions the agent performs) and **reference** (definitions, rules, facts consulted on demand). A document can be all steps (a recipe), all reference (a review's rules, this file), or both. Rank each piece by how immediately the agent needs it:

1. **In-file step**: the primary tier: what the agent does, in order. Keep legible at the top.
2. **In-file reference**: consulted on demand. Often a legitimately flat peer-set (every rule of a review on one rung): a fine arrangement, not a smell.
3. **Disclosed reference**: pushed to a separate file behind a pointer, loaded only when the pointer fires.

**Progressive disclosure** is the move down that ladder, so the top stays legible. Branching is the cleanest test: inline what every branch needs, push behind a pointer what only some branches reach. Under ~500 lines of a top-level file is the ceiling; lean is far lower.

**Co-location** keeps a concept's definition, rules, and caveats under one heading; scattering fragments the meaning across the file. (Distinct from duplication: that repeats one meaning in two places; scattering splits one meaning across many.)

**Sprawl** is the failure mode here: a document too long even when every line is live and unique. Attention thins across the excess. Cure it with disclosure and splitting by branch or sequence, not tighter phrasing alone.

## Completion criteria

End every step on a condition the agent can check. Two properties make it a lever:

- **Clarity**: can the agent tell done from not-done? A vague bound ("understanding reached") invites **premature completion**: declaring done and slipping to the next step. Sharpen the bound first: local and cheap. Only if it is irreducibly fuzzy *and* you see the rush, hide the later steps by splitting the sequence, and hiding only works across a real context boundary (a hand-off or a subagent dispatch; an inline call leaves the later steps in context and clears nothing).
- **Demand**: how much it requires. "Every modified file accounted for" forces thorough work where "produce a change list" does not. It is not step-bound: "every rule applied" binds a body of flat reference just as "every step done" binds a sequence, which is how an all-reference document still carries an exhaustiveness bar.

The strongest criteria are both checkable and exhaustive.

## Leading words

A compact concept already living in the model's pretraining (*tight*, *relentless*, *fog of war*) anchors a whole region of behavior in one word, by recruiting priors the model already holds. It anchors twice. In the body, *execution*: the agent reaches for the same behavior every time the word appears. In a pointer, *invocation*: when the same word lives in your prompts, your docs, and your code, the agent links that shared language to the material and reaches it more reliably.

Refactor restatements into one word: "fast, deterministic, low-overhead" → a *tight* loop. Reach for an existing word before coining one: a made-up word recruits no priors, so you pay in words of definition what a pretrained word gives free. A weak word (*be thorough* to an already-thorough model) is a no-op; the fix is a stronger word, not more sentences.

## Prompt the positive

State the target behavior; a prohibition names the banned thing into attention ("don't think of an elephant"). Keep a prohibition only as a hard guardrail you can't phrase positively, then pair it with what to do instead.

## Name what the agent has, not what it lacks

Tell the agent what it receives and what to do with it. Do not enumerate the inputs it does not receive. A line like "you receive only the draft, never the author, how it was produced, or any note of prior review" plants the author, the production history, and the prior review in the agent's attention as things to wonder about, exactly what the line meant to keep out, and it carries no instruction of its own. Keep the positive constraint ("you receive only the draft; review what is on the page") and cut the list of absences. One exception: a genuine "Do not use for X" routing clause stays, since it steers routing rather than describing inputs the agent lacks. That pass does not extend to a "you only get X" line, which this rule judges like any other. Same root as *Prompt the positive*: naming a thing to exclude it still puts it in front of the agent.

## Explain why; spend caps sparingly

Reasoned rules travel further than stacked MUSTs. Budget at most 2–3 ALL-CAPS directives per document, reserved for real hazards. Pair a rule with the concrete consequence it prevents: a fact ("this leaks connections"), not a threat.

## Escalate to a hook

Prose is advisory (roughly 80% adherence). A rule that must hold on every run belongs in a PreToolUse/PostToolUse hook, not in a louder sentence.

## No em-dashes

Write no em-dash (the character U+2014) into any document you produce. Use a colon, a comma, parentheses, or a full stop, whichever fits the clause. This is a hard rule, not a stylistic preference the model weighs against others: the final review scans for the character literally and treats every hit as a defect to fix. The ban is on the character, not on setting off an aside, which the other punctuation does cleanly.

## Pruning

- **Single source of truth**: each meaning lives in one authoritative place, so a behavior change is a one-place edit. Duplication costs maintenance and space, and inflates a meaning's apparent rank on the hierarchy.
- **Cache the environment, don't restate it**: `package.json` scripts, config files, the directory layout, `--help` output are themselves a source of truth. A document that restates them is a **cache**: a copy of a lookup, earning its load only when the lookup is expensive. Cache what the agent cannot find by looking: the unwritten convention, the reason behind a choice, the gotcha no config confesses. Leave the one-file, one-command lookups to the environment, where they cannot go stale.
- **No-op test**: does the line change behavior versus the model's default? The test is model-relative, not reader-relative: settle a dispute about whether a line is a no-op by running the document, not by debate. Delete failures whole; don't trim their wording.
- **Relevance**: reread each line against what the document does today; stale layers (**sediment**) settle wherever adding feels safe and removing feels risky.
- **Examples**: expensive, and models over-fit to them. Default zero; when a concept can't be conveyed without one, keep exactly one, cut to the minimum that makes the point.

## Per-document notes

- **Skill / subagent**: its description is a context pointer that also routes the dispatcher. Frontmatter, invocation, tools, and routers live in `mechanics.md`; read it before drafting or judging one.
- **CLAUDE.md / AGENTS.md**: always-loaded, so pure context load on every turn: the cache rule and the no-op test bite hardest here, and length is never free. It is reference, not steps. A line naming another document is a context pointer: hold it to the pointer rules above.
- **Reference file**: pure disclosed reference, reached by a pointer; the pointer's wording is the whole game, since an unread reference file is dead weight. No frontmatter. It earns its keep only when the material is real and non-inferable; otherwise it is a cache that will go stale.
