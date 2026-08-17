# The tell catalog

Run each lens as its own hostile pass over the whole text, in order. Lens 1 is a gate: if the opening fails it, rebuild the opening before running anything else, because the line-level lenses cannot fix essay scaffolding.

**The quoted phrases are specimens, not the definition.** Each lens names a property; the phrases only calibrate your eye. A sentence matching no specimen still fails if it has the property. Run each lens's test on every sentence; do not grep the specimen strings and call the pass done.

---

## 1. Opening posture: explanation, not essay (the gate)

The deepest failure, invisible to the line-level lenses: every word clean, but the piece is built as a persuasive essay (cold open, thesis-building, a problem dramatized for tension, rhythm beats) instead of an explanation. A person explaining something says what it is; an essay warms up to it.

**Test.** Does the opening lead with a fact or a mood? A plain statement of what the thing is and who it is for passes; so does a concrete, specific scenario (a real account is fine). A hook, an antithesis, or any line that sets a mood before a fact lands fails. "It's vivid" and "it draws the reader in" defend how it sounds, not what it carries; the test takes no mood exception. Then the whole arc: does it state things or build to them? Abstract-first, concrete-later fails.

**Fix.** Rebuild from a plain statement: sentence one is what it is and who it is for, then the specifics, concrete first. If sentence one can't be written as a plain statement, the writer doesn't yet understand the thing. Ask; don't paper over with a hook.

**Exception:** a genuinely narrative piece (the point is the lived telling) may open scene-led, but only if the opening carries facts, not pure mood. Unsure whether the intent justifies a slow lead → show the line and ask. Mood without fact fails outright, no asking.

---

## 2. Closing the loop

State the fact and stop. The offending clause hands the reader the conclusion the fact already delivered; a sharp reader got there first and reads the spelled-out version as condescension. An open loop the reader closes themselves, they believe.

**Test.** For every fact-bearing sentence, isolate the final clause: could a sharp reader reach this unaided? Yes → cut. Four shapes:

1. Handing over the implication. A fact, then the conclusion it already delivered.
2. The avoided-disaster tail, ending in "instead of / rather than [the bad thing that obviously would have happened]."
3. Grading the actor. How carefully it works instead of what it does ("weighs each constraint carefully," "thoughtfully routes").
4. Self-praising adjectives such as "a surprisingly clean separation" or "an elegant approach."

Tail-words that flag it (run the test, don't auto-delete): *so, so that, which means, meaning, instead of, rather than, ensuring.*

**Keep** a tail that adds a fact the reader could not supply: a non-obvious causal consequence, a number, or a real contrast naming a concrete alternative ("opens a pull request, not a direct commit"). Cut one that restates the fact, names the obvious benefit or avoided harm, grades the actor, or praises the work. In doubt, cut.

---

## 3. Rating the work

A line labeling the work just described as hard, real, important, or serious instead of letting it show its own weight. Usually passive and actorless, the writer patting their own back.

**Test.** After a passage of concrete work, is the closing line naming what happened or rating it? Two tells: passive with no actor ("the hard calls are made," "the real work is done"), and evaluative abstraction ("the heavy lifting," "where the magic happens," "the part that matters").

**Fix.** Cut, or name the actor and the concrete action; the reader supplies the verdict. Softening a smug line leaves a smug line. Two rewrites still rating → cut.

---

## 4. Writerly tics

Storytelling cadence in prose that should just explain: each move performs instead of informs, and survives a word-level scrub because no single word is banned.

**Test (every sentence).** Why is this sentence here? Two legitimate answers: it states a fact, or it gives a concrete specific the reader needs. Anything else is the tic, whether it sets a scene, lands a point, sounds profound, or makes the reader feel. Strip to the fact; cut any residue whose only job is effect; no fact under it → cut the sentence.

Common shapes (specimens, not a checklist):

- **Faux-insight setups.** "This is the part most people skip," "Here's what nobody tells you," "What most people get wrong," "The part everyone misses." Cut the setup; let the claim stand alone.
- **Throat-clearing openers.** "Let me be clear," "I'll be honest," "The uncomfortable truth is." Cut and state the point.
- **Unearned universals / recognition hooks.** "Every team has shipped this one," "Most teams do this by hand." You can't stand behind "every," and it flatters by comparison. State the specific true thing.
- **The dramatic coda and fake-casual beat.** A fragment tacked on for gravity or manufactured casualness ("...every time," "...signed off once," "Back at it.," "Picking it back up now."). Fold into a complete sentence, or cut. Not a ban on short sentences: a blunt, grammatically complete short sentence is fine, and so is a genuine fragment in a slot that takes one (a greeting, an imperative, a caption, a one-word reply).
- **Setup-by-negation.** One negation as a flourish before the real sentence ("No one files a ticket. It monitors and starts a run on its own."). Cut the negation; let the mechanism show it.
- **Colon reveals.** A noun phrase, a colon, a lowercase dramatic reveal ("The detail that makes it work: a separate agent grades it"). Rewrite as a plain sentence. Colons are for lists, labels, and quotes.
- **Superficial "-ing" analysis.** A trailing "-ing" clause pretending to explain: "highlighting," "underscoring," "reflecting," "showcasing." Replace with the real consequence, or cut.
- **The aphoristic closer / fake-profound kicker.** A punchy maxim, metaphor, or mic-drop at the end. Delete it; end on the clearest concrete sentence already there. Do not rewrite it into a better metaphor.
- **Rhetorical setups.** "What if I told you...," "Think about it:," "Plot twist:," self-answered "Question? Answer." pairs. Drop them; make the point.
- **Dramatic fragmentation.** "X. And Y. And Z." or "That's it. That's the whole thing." Use complete sentences.
- **Doom-narration.** A consequence dramatized into a story arc. State it as a fact.
- **Self-flattering contrast.** "...not a generic checklist," "not just another tool." If the positive already conveys it, cut the tail. (Fixed strings also scanned in `banned-words.md`.)
- **Inflation over precision.** The grander phrasing where a plain one is more exact. Use the plain, precise words.
- **Benefit-recap.** A clause recapping in abstract terms what the reader "gets" ("you come away with a working setup," "everything you need, ready to go"). State the concrete mechanic. (Fixed strings scanned in `banned-words.md`; this lens catches the variants.)

---

## 5. Meta-commentary, or writing about the writing

A sentence whose subject is the piece's own vocabulary, framing, or structure instead of the thing being explained. Carries no information about the subject; survives every other pass because each word is plain.

**Test.** Is the subject the thing being explained, or the explanation itself? Tells:

- **Naming the naming.** "A few names, used plainly," "Plain language, on purpose."
- **Reassuring against an unraised objection.** "Nothing fancy here," "This isn't jargon for its own sake."
- **Announcing the structure.** "Let's keep this simple," "Here's how this works."
- **Interpretive metadiscourse.** "That last part matters more than it sounds," "The key point is," "As you can see," redundant "In other words."

**Fix.** Delete the meta sentence; use the vocabulary, don't introduce it. If a name needs defending, the name is wrong. Fix the name, don't apologize for it.

---

## 6. Vague declaratives

A sentence announcing importance without naming the specific thing. It feels like a strong topic sentence but carries no information.

**Test.** Does it name a specific thing, or only assert that one exists? Can't point to the noun it's about → vague. Specimens: "The reasons are structural," "The implications are significant," "The stakes are high," "This is genuinely hard."

**Fix.** Replace the announcement with the thing it points at, or cut it.

---

## 7. False agency

Inanimate things performing human verbs. This reads as evasion: no one is responsible, so the claim can't be checked. Specimens: "the decision emerges," "the culture shifts," "the data tells us," "the market rewards," "a complaint becomes a fix."

**Test.** For each verb: who or what is doing it? Abstract subject plus a verb only a person does = false agency.

**Fix.** Name the human who acts; if no specific person fits, use "you" (the reader). Active voice throughout.

---

## 8. Weasel attribution

A claim leaned on an unnamed authority. Specimens: "experts agree," "studies show," "widely regarded," "many argue," "it's well established."

**Test.** Does the sentence name who says this, or gesture at a crowd that agrees?

**Fix.** Name the source, or cut the claim. No source → ask; never invent one.

---

## 9. Fake-strong verbs and synonym cycling

- **Fake-strong verbs.** A verb that sounds active but adds nothing over plain "is" or "has": "serves as a centralized hub for," "acts as a bridge between." Prefer "is"/"has" when clearer; let the specifics carry the sentence.
- **Synonym cycling.** Rotating terms for the same thing for variety ("the agent reviews... the assistant scores... the tool suggests..."). If the clear word is right, repeat it.

---

## 10. Negative listing

Defining by negation before the reveal: "Not a tool. Not a platform. A system."

**Test.** Two or more consecutive "not a / not the / it wasn't" clauses leading to the real noun.

**Fix.** State the real thing; delete the runway.

---

## 11. Significance padding and tidy wrap-ups

- **Significance padding / importance puffery.** A phrase whose only job is to say "this matters": "marking a pivotal moment," "part of a broader movement," "in an increasingly [adjective] world," "stands as a testament," "plays a vital role," "solidifies its position." Delete it, state the fact, let the reader judge whether it matters. (Fixed business-phrase strings scanned in `banned-words.md`; this lens catches the variants.)
- **Tidy wrap-ups / summary-recap endings.** A closing sentence restating what the section just said, or a final recap paragraph ("In conclusion," "Ultimately," "Overall"). The reader was just there. End on the last load-bearing sentence, takeaway, or next action.

---

## 12. Structural and rhythm tells

Read for shape, not meaning.

- **Default triplets.** Lists of exactly three because the model defaults to three ("speed, clarity, and efficiency"). Use the real count.
- **Mirror structure.** Symmetrically balanced sentences ("While X does Y, Z does W"). Make them lopsided and clause-chained.
- **Metronomic / robotic rhythm.** Short-long-short-long, repeated sentence shapes, identical paragraph structures, stacked punchy fragments. Vary length and shape irregularly.
- **Rhetorical questions as transitions.** "But what does this mean for you?" Use a paragraph break.
- **Transition-word pile-up.** Every paragraph joined by "That said," "However," "Furthermore." Cut most of them.
- **Formatting slop.** Emoji in headings, bold sprinkled mid-sentence, bullet lists where two sentences read better, headers over two-sentence sections, sentence case dropped after a colon (prefer sentence case unless grammar, a proper noun, a title, or code requires otherwise). Format follows the content.

---

## 13. Document-level checks

- **Vague quantifiers.** "Significantly improved," "many teams," "a lot faster," "greatly reduced." Replace with a number or a proper noun, or cut the claim if there is no real figure behind it.
- **Label subheadings.** A subheading naming a generic category ("Overview," "Our approach," "Key takeaways") instead of the section's specific point. Rewrite it to carry the point, so a scanning reader learns something.
- **Cross-document redundancy.** The same point, example, or definition in more than one place. Inventory what each section establishes, then cut every restatement doing no new work. This is broader than lens 11's wrap-up. It catches a claim repeated three sections apart.
