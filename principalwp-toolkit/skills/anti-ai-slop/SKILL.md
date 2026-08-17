---
name: anti-ai-slop
description: "Reviews and fixes text that reads as AI-generated. Two modes: Fix and Detect. Use when asked to run anti-ai-slop, check for AI tells, or de-slop a draft. anti-slop-reviewer wraps this for a blind, authorless pass. Do NOT use for model-instructing files (a skill, agent, CLAUDE.md; use writing-for-llms)."
---

This skill can run two ways: invoked directly, by name or automatically on a matching prompt, or through the **anti-slop-reviewer** agent, which invokes it every run as a blind pass over text it did not write and received no context on.

## Two modes

**Fix (default).** Rewrite the problems and return the edited draft plus a short *what changed* list naming what was removed or replaced. No preamble, no praise, no justification, no explanations.

**Detect.** Name each pattern, quote the offending line, give the fix in a few words. Do not rewrite. Offer to create the Fixed version.

## Before editing

- No draft → ask for it.
- Audience, format, or goal unclear → ask once: who is this for, where will it run, what should the reader think, feel, or do? Do not assume.
- Read the whole draft. Done when you can state its core point in one line and have noted three to five voice signals to preserve (vocabulary, cadence, bluntness, humor, uncertainty, digressions).

## The review

Slop survives a single read. Read many times, one lens per pass, each pass hostile: every sentence guilty until it passes. "It's vivid" / "it flows" defends how a line sounds, not what it carries. When in doubt or when it's borderline, always make a change or cut the line.

1. **Opening-posture gate.** Read `references/tells.md`; apply lens 1 to the opening. Wrong posture → rebuild the opening from a plain statement, don't line-edit it. Done when the opening leads with a fact.
2. **Remaining lenses.** Run the rest of `references/tells.md`, one lens per pass. Done when every lens has run and every hit is resolved (Fix: fixed; Detect: named, quoted, fix given).
3. **Vocabulary scan.** Read `references/banned-words.md`; search the text for each item. Done when every item is searched and every hit resolved.
4. **Plain-language check.** Read `references/plain-language.md`: coined-term census plus readability sweep. Done when every coined term has a verdict and every flagged sentence is resolved.
5. **LinkedIn or social post?** Also read and run `references/linkedin.md`. Done when its pre-publish checklist passes.
6. **Final read** (below). Done when the whole piece passes both tests.

## Fix well

- **Fix at the right altitude.** A structurally broken section (warms up instead of stating, rates its own work, built as an essay) gets rewritten from scratch from the fact it should assert, and the rewrite stays at the section level. Only in rare circumstances should you rewrite the whole piece, never token-patch a broken section.
- A real rewrite changes the shape of the sentence, not three words in it. If 3 rewrites on the same slot still smell → cut the slot.
- **Don't invent to fill a gap.** No new claims, examples, stats, or opinions. A fix needs a fact you don't have → ask.

## Preserve the voice

Removing slop and flattening voice are different acts; do the first without the second.

- Keep what is personal: vocabulary, cadence, bluntness, humor, honest uncertainty, digressions. Keep the edge too: strong opinions, profanity, self-interruptions, honest admissions. Don't make every paragraph equally tidy.
- Open it up, don't dumb it down: keep substance, nuance, precision; strip only jargon, over-long sentences, abstract nouns, tangled structure.
- Keep the structure and the detours.
- Make verbs do the work. "Decided," not "made a decision"; active voice; no inanimate thing performing a human verb.
- Keep "empty" words when they aren't. "I think," "just," a fragment stay when they carry real uncertainty, emphasis, contrast, or rhythm.
- Reading as human is more important than polish, grammar, vocabulary. Things that are overly polished sound like AI.

## The final read

1. **Sniff test.** Would a sharp reader wonder if this was AI-generated? Any sentence that triggers the suspicion gets rewritten, even with no named violation. The common tell: technically correct but socially wrong. Too polished, too balanced, too complete. Run it hardest on the opening; the lede is the line you most want to forgive.
2. **Read-aloud test.** Stilted, performed, or salesy read aloud to a sharp colleague → it fails.
