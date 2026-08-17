# Skill & agent mechanics

The packaging-specific branch of `guidelines.md`: what changes when the document is a skill or a subagent (the description-as-router, frontmatter, invocation, tools, and routers). Everything else about writing them is the universal reference in `guidelines.md`. Read this before drafting or judging a skill or agent.

## Descriptions (skills and agents)

The description is the trigger: Claude fires a skill, and the main loop delegates to an agent, from name + description alone. All when-to-use information lives here, not the body. A description is a context pointer, so every pointer rule in `guidelines.md` applies: front-load the leading word, one trigger per distinct case, cut identity the body carries. On top of those:

- Front-load the words the user actually *types*: a description keyed on the author's vocabulary undertriggers.
- Cover every real situation: **undertriggering is the common failure**, so name the distinct cases the artifact should catch ("even if they don't say the word X"): add cases, not synonyms.
- Keep it under 1024 characters.
- Before shipping, read the descriptions of the skills and agents already installed where this one will live: two artifacts claiming the same trigger both fire unreliably.
- Every skill or agent `description` is held to `compress-description.md`, always: when you write one in Create and when you review one in Review, not only on request.

## Skills

- Anatomy: `skill-name/SKILL.md`, plus optional `references/`, `scripts/`, `assets/`. Frontmatter: `name`, `description`; `disable-model-invocation: true` for user-invoked; `allowed-tools` when the skill should be tool-limited.
- Three loading tiers: metadata always in context; body on trigger; bundled files only when a pointer fires. Weigh where content sits by that cost (the two loads).
- If every run would hand-write the same helper (a converter, a build step), bundle it in `scripts/` once and point to it.

### Invocation: two choices, trading the two loads

- **Model-invoked** keeps a `description`, so the agent can fire it on its own and other skills can reach it. You can still type its name: model-invocation *includes* user reach, never removes it. Its description is a permanent context-load pointer, in exchange for that discoverability. A model-invoked, all-reference skill can double as a **shared-reference hub** other skills invoke, so reference several skills need lives in one place. Mechanics: omit `disable-model-invocation`; write a model-facing description carrying the trigger cases (all the description rules above apply).
- **User-invoked** (`disable-model-invocation: true`) strips the description from the agent's reach: only the human typing its name fires it, and no other skill can. Zero context load, but it spends cognitive load: you are the index that must remember it exists. Its `description` becomes human-facing: one plain line, trigger list stripped.
- Pick user-invocation only when a human alone will ever fire it. Shared reference two *user-invoked* skills both need can live in neither (with no descriptions, neither can reach the other), so push it to a plain file outside the skill system that any skill can point at.

### Splitting off a new skill

Split when the material has a distinct leading word that should trigger it on its own (a trigger word you actually type) or another skill must reach it. You pay context load for the new always-loaded description, so the independent reach has to be worth it.

### Router skills

When user-invoked skills multiply past what you can remember, that piled-up cognitive load is cured by a **router**: one user-invoked skill that names the others and when to reach for each, so you have one skill to remember instead of many. It can only hint, never fire them: user-invoked skills have no description for it to reach.

## Agents (subagents)

- One file: `agents/<name>.md`. Frontmatter: `name`; `description`; `tools`: give every agent Write so it can save findings to a file and return a summary plus the path; read-only only when the user asks. An omitted `tools` field silently inherits everything the parent has, MCP tools included. Set `model` only when the default is wrong for the load.
- The description is a routing rule for the dispatcher: lead with "Use when…" and the trigger phrases, aiming for ~280 characters; add a "Do not use for…" clause when false-positive routing is a real risk. A description that summarizes the body's steps is a **workflow leak**: the dispatcher decides it knows enough and the body never gets read. Give it a narrow role: "flaky-test diagnostician" routes itself where "backend engineer" routes nothing reliably.
- The body is a system prompt for a fresh context. The agent knows nothing of the conversation: everything it needs on every run goes in the body; everything per-task must arrive in the dispatch prompt, so state what the dispatch must supply ("your dispatch names the target files").
- Open the body with the role and the hard boundary (report-only or may-edit) in the first lines. In a long body, restate the 1–3 most-violated rules at the very end; attention sags in the middle.
- Define the return: the agent's final message is its entire output to the caller. Spell out the exact shape: severity-graded findings with file:line, or a one-paragraph summary plus the path of a report file. When the caller needs a file rather than prose, say where to write it and what the final message carries instead.
- When the agent depends on a plan or spec, make its first action mandatory: "Before any other tool call, read `<path>` in full."
- Pair every scope boundary with the move when blocked: "stop and report" beats silent improvisation.
