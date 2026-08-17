# Concision pass

Runs as the concision pass of Review, over the scope Review step 1 already listed.

## Procedure

1. **Read the always-loaded context** the artifact runs under (project and user CLAUDE.md, plugin manifest) so lines that only restate it can be cut.
2. **Scan** every file in scope, holding each line against the table below.
3. **Return a unified diff per file**: the cut and rewritten lines in their final form, nothing else. A file with nothing to cut gets no diff, said in one line. Write nothing to disk; Review step 4 owns what gets applied.

No savings table, no word counts, no ranking of wins: the diff is the output.

## What to cut

| Code | Name | Cut a line that… |
|------|------|------------------|
| R1 | Always-loaded redundancy | repeats what a CLAUDE.md or plugin manifest already puts in every conversation |
| R2 | Duplication | echoes a meaning another line owns, here or in another file of the same skill: cut the echo, keep the line that owns it |
| R3 | Fluff | pads an instruction with words carrying none of it: "It is important to always X" → "Always X" |
| R4 | No-op | tells the model to do what it would do anyway |
| R5 | Stale | names a feature, rule, file, or path that no longer exists |
| R6 | Excess example | is an example a plain rule could replace, or a second example of one concept: one concept gets one example at most |
| R7 | Bloated example | is an example carrying setup or detail past the point it exists to make |
| R8 | Format overhead | spends a table or nested list where a flat list reads the same; a fence around a command or file content stays |
| R9 | Eager loading | sits inline although only some runs need it |
| R10 | One-off defense | re-forbids a mistake the model would not repeat anyway; a warning about real tool or environment behavior is a gotcha, keep it |
| R11 | Padded description | is frontmatter `description` text past one sentence of what the artifact does plus the phrases and situations that invoke it |
| R12 | Environment restatement | restates what the environment already answers (a `package.json` script, a config value, `--help` output, the directory layout) instead of only the non-inferable (the unwritten convention, the reason behind a choice, the gotcha) |

Unsure whether a line earns its keep? Leave it in and say so under the diff: Review step 4 hands the call to the user.

## Keep: never cut

- Gotchas, bug interactions, environment constraints: knowledge that cost someone a debugging session.
- Frontmatter `name`: the handle everything else routes through. The `description` is fair game: see R11.
- Headers, step numbers, and an agent body's closing restatement of its top rules: how a long file stays navigable.
