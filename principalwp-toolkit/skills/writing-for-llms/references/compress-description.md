# Compress a description

The frontmatter `description` is the single line that decides when a skill auto-invokes, or when the dispatcher routes to an agent. It is a trigger, not documentation: its only jobs are to make the artifact fire at the right moment and to name its shape. Read `mechanics.md` first for the description principles; this file is the standard every skill or agent `description` is held to. Apply it whenever you write one (Create) and whenever you review one (Review), not only when asked to shrink one. Adapt the steps to the context.

Rewrite the description to contain only these, in order:

1. **One short sentence saying what it does.** If the current description never plainly says what the artifact does, write that sentence yourself from what is there.
2. **A few representative trigger phrases:** the literal words a user would actually say to invoke it. Keep the strongest handful, roughly three to six. Drop any phrase that is a paraphrase or near-synonym of one you already kept, and trust the matcher to generalize. But keep every genuinely distinct way in: two triggers that reach the artifact for different reasons are both essential, so collapse only the ones that mean the same thing.
3. **The names of any modes, operations, or sub-commands**, names only, no explanation.

Cut everything else and let the body carry it: how it works and the step-by-step mechanism, what each mode does, examples, outcomes, negative scope ("does not do X"), and "also when another workflow produces this" chaining conditions.

Keep the author's own plain wording. Do not add flourish or invent terms. Aim for under about 40 words or 250 characters, but never drop an invocation-critical trigger just to hit the number.

Done when the description carries the one plain sentence, the strongest distinct triggers, and any mode names, and nothing else, and every phrase a user would really type to reach the artifact still fires it.
