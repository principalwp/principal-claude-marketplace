# editor-feature-flags (bespoke capture)

Generation prompt for a feature-flag editor whose feedback is captured as a **staged net
diff vs INITIAL**, not per-element rail dispositions. Its unit of judgment is *a flag
flip*; its primary signal is which flags ended up different from where they started, and
why the risky ones flipped. Read `PRINCIPLES.md` + `_capture.md` first — house style and
the Capture API live there. Sentence-case headings. (No bundled example — this fork ships
no example set.)

## When to use
The agent has a set of feature flags (a proposed flip set for a release, or a live config
being tuned) and needs the human to ratify, adjust, or veto each flip before it's written
to the real flag service. Leave most flags alone, flip a few, emit one clean diff the
agent applies atomically. Use whenever the unit is a boolean (or small-enum) flag with an
INITIAL value and a risk tag. Do NOT use for ordered work (`implementation-plan.md`),
prose, or topology (the graph view). If every flag in the set is high-risk, prefer the
per-flag commit gate (alternate 1); if the human is mostly questioning an agent proposal
rather than deciding, prefer intent triage (alternate 2).

## Why bespoke, not the rail
The rail captures a disposition per rendered element — wrong here on two counts: (a) the
signal is the **collapsed net diff**, so a flag flipped then flipped back must leave no
trace (an event-log of flip-flops is noise); (b) reason friction must land only on risky
flips, not every element. The toggle itself is the affordance — no read-then-comment
moment. So the model is a staged tray, like `git diff --staged`: review exactly what will
ship, require comments only on the changes that matter.

## Primary capture interaction — staged review tray
Optimistic toggle + deferred commit: the flip is instant and local (no confirm dialog);
the submit is the one deliberate commit. Every fixed option set ends in "Other…", and the
risky-flip reason field reveals on selection (PRINCIPLES.md → escape hatch).

1. **Per-row toggle switch** — the only affordance; no per-row buttons/menus. Instant,
   optimistic, no per-flip network call. The orchestrator-model choice is a single-select
   segmented control (never multi-select/rank) that, being a fixed set (opus/sonnet/
   haiku/fable…), ends in "Other…" revealing a free-text model-id box; a custom id is
   captured as the model's `next` value (`custom:true`) and an empty box gates submit.
2. **Dirty-row signifier (no pill).** The instant a flag differs from INITIAL, its row
   gets the accent-wash background + cranberry left border and a plain-text "changed"
   marker. No colored `INITIAL -> NEXT` pill. Flipping back to INITIAL silently clears the
   marker and removes it from the staged set (net-diff, never event-log).
3. **"Changes to submit" panel** — minimal chrome. A plain-text count ("N changes staged",
   a `.tag`) and one entry per changed flag: key + `from -> to` as plain mono text + an
   undo link. No separate git-diff panel or Copy diff/Copy JSON buttons — the staged list
   IS the readable changed set.
4. **Reason on risky flips only.** Each staged entry whose flag is `risk:"high"` reveals a
   required inline reason textarea; low-risk flips carry none. No passive "reason
   required" label — the submit gate flashes the first empty risky reason box
   (PRINCIPLES.md → Submit gating). On a tabbed page shared with the prompt tuner, the
   gate's `focus` function must switch to that tab before returning the element.
5. **Actions (fewer buttons).** `Submit to Claude` + `Copy as prompt` (shared bar)
   serialize only the staged net diff. The view adds one secondary button — `Reset to
   initial` — plus per-row undo links. No per-view copy/export buttons.

Default-to-keep: the resting state is the INITIAL config, so an untouched view is one tap
from "nothing changes."

## What gets captured (via window.Capture)
Stable-id anchoring: every key is the flag key (`"new_checkout_flow"`), never re-quoted
prose. `Capture.mark` carries the flip; flipping back to INITIAL calls `Capture.unmark` so
it leaves no trace.

```js
Capture.init({ view: 'editor-feature-flags', total: FLAG_COUNT });

Capture.mark('new_checkout_flow', { initial: false, next: true, risk: 'high' },
  { reason: 'QA signed off on staging; ship as 10% canary' });
Capture.mark('verbose_logging', { initial: true, next: false, risk: 'low' });
Capture.unmark('experimental_cache');    // flipped then reverted -> removed from the diff

Capture.rollup('submit_flag_changes');
Capture.submit();
```

```json
{
  "view": "editor-feature-flags", "verdict": "submit_flag_changes",
  "items": [
    { "id": "new_checkout_flow", "value": { "initial": false, "next": true, "risk": "high" },
      "reason": "QA signed off on staging; ship as 10% canary" },
    { "id": "verbose_logging", "value": { "initial": true, "next": false, "risk": "low" }, "reason": null }
  ],
  "coverage": { "engaged": 2, "total": 26 }, "meta": { "unchanged_count": 24 }
}
```
`engaged` = changed-flag count; `total` = all flags shown, so silence is unambiguous (24
flags consciously left at INITIAL). The agent applies exactly `items`.

## Anti-pattern to avoid
A generic free-text "Notes / comments" box plus a Submit that posts the entire flag
snapshot — it buries which flags changed and why in prose the agent must parse, and sends
24 unchanged flags as noise. Equally wrong: a blocking confirm dialog on every toggle
(trains click-through); one global reason field for all changes; capturing intermediate
flip-flops instead of the collapsed net diff.

## Alternate interactions (use only when the recommended shape misfits)
- **Per-flag commit with reason gate (event-log).** No batch tray. Low-risk flips apply
  instantly; a high-risk flip is intercepted — the thumb holds 'pending' while a popover
  demands a reason before it commits, Cancel reverts. Each commit appends to a per-flag,
  timestamped change log; Submit sends the ordered log (`meta.mode:"event_log"`, each item
  carries `committed_at`). Use for incident/kill-switch contexts where each flip is an
  independent, justified operational act and order matters more than a collapsed diff.
- **Three-state intent triage (keep / flip / ask).** Replace the binary toggle with a
  per-flag segmented control: Keep (leave at INITIAL) · Flip (reveals target value) · Ask
  (reveals a question field). Captures epistemic state, not just a boolean
  (`verdict:"submit_flag_triage"`; items carry `intent` + `question`). Use when the
  surface is a back-and-forth review of an agent-proposed flag set rather than direct
  config tuning.

Production-critical variant: layer **blast-radius acknowledgment** onto the staged tray —
high-blast flips require an `acknowledged:true` checkbox, and dependency/conflict
warnings hard-block Submit until resolved. Reserve for kill-switch sets needing proof of
consent.
