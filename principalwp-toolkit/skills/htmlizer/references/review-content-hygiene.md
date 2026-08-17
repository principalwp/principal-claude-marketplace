# htmlizer content-hygiene review — the page-only content lint

Page-only, grep-driven: content REFERENCES and NUMBERS are mechanically well-formed — not whether
they are true (`review-accuracy.md`) or sufficient (`review-sufficiency.md`). Its greppable half (H1
structural presence, H3 estimate presence) is mechanized by `references/preflight-lint.sh` at write
time; its judgment half (H1 load-bearing, H2, H4) is read on `model: sonnet` by the same sub-agent
that carries `review-design.md`'s residue (`SKILL.md` step 3.5 — split table in `review-design.md`).
Report only violations, HIGH/MED/LOW, `[check] file:line — problem → fix`. Write full findings to OS
temp; return summary + path. Do NOT edit the page.

## H1. Every reference resolves — no inert dotted term
- Every filename/path uses `.file` (distinct from `<code>`), everywhere incl. mid-prose.
- A non-link `<span class="file">` must be ONE of: `<a class="file" href="…SHA-pinned blob#Lx-Ly">`,
  an fs-link `<a class="file">`, `.file.has-pop` with a non-empty `.file-pop` child, or
  `.file.planned` with a `.file-pop`. A bare dotted `.file` with no link, popover, or inline gloss
  is HIGH (inert-dotted-term bug). Source: PRINCIPLES → "References and evidence".
- **A popover is a gloss, not a source — HYBRID (judgment).** `.file-pop`/`.has-pop` resolves only a
  GLOSS (what the file/term IS). When a reference is **load-bearing** — a decision rests on its
  content (the 5 talking-point bullets a planned message is built from, a checklist's items) — a
  popover alone is NOT resolution → HIGH. That content belongs in a visible, selectable, printable
  **on-page section**, linked via the **"Read more:"** `.readmore` line. Tell: the decision names the
  reference as what it acts on, yet its content exists ONLY inside a `.file-pop` (unreachable on
  touch, invisible on print).
- **`tabindex="0"` on every trigger** — a `.has-pop` span without it is HIGH (the dotted underline
  promises an affordance that never opens for keyboard/touch).

## H2. Diagram nodes naming files/symbols link or explain
For each diagram (SVG / Mermaid / HTML-box): a node `<text>` matching a filename/symbol pattern
(`\.\w+$`, `/`, a known symbol) is inside an `<a>` / has a `click` directive / is a deliberately-plain
node whose prose mirror carries the reference. A dead named node (plain SVG `<text>`, no `<a>`) is
HIGH; reuse the href the prose mention already minted. Source: PRINCIPLES → "References and
evidence" (the "Diagrams link their references" rule).

## H3. No time/effort estimates
Grep the page body (exclude `#L\d+` / SHA / `blob/` anchors) for duration units
`\b\d+\s*(h|hr|hrs|hour|hours|min|mins|minute|minutes|day|days|wk|week|weeks)\b`, a `~` prefix on a
number, and ranges. Flag each unless it's a dated/clock CALENDAR FACT (a weekday, `10:00 PT`, `EOD`,
`7/13`). MED per hit; HIGH if dense. Presence-only, mechanized by `preflight-lint.sh`. The
invented-estimate-vs-real-fact judgment is `review-accuracy.md` Pass 3's (verify against source).
Source: PRINCIPLES → "No time or effort estimates".

## H4. Planned artifacts are labeled
A reference the page treats as a to-be-created deliverable must be `.file.planned` (or say "planned /
not yet created" in its popover) — never presented as already existing. MED.

## Extending
New check classes route by scope — see the routing note in `review-design.md` → "Extending". A new
page-only mechanical content check gets a section here; fix-at-cause in `PRINCIPLES.md`/`base.css`.
