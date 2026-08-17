# voice.md — default plain-voice rules (fallback when no user rules are loaded)

`review-sufficiency.md` Pass 2 checks page prose against the reviewing sub-agent's own
user-communication rules (a CLAUDE.md "how to talk to me" section). When the session has none, it
checks against these generic plain-voice defaults instead — editable, or replaceable by pointing
the reviewer at your own rules file.

## The rules

- Lead with the answer or decision; put a command, path, or snippet first, and
  repeat it at the end.
- Plain words — name the actual thing; no jargon or business idioms.
- Number multi-step work and lists; one action per step.
- Answer questions first, before status updates or proposals.
- When you recommend something, say what you compared it against and the
  tradeoffs.
- Explain anything the reader can't see in one line, and link to it.
- Don't cite rules back to the reader, and don't reassure them that a rule was
  followed — just do the thing.
- Keep status compact; no process narration.
