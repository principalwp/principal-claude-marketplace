# Principal WP — Claude Code marketplace

Public Claude Code tools from [Principal WP](https://principalwp.com), shipped as a
single plugin: **principalwp-toolkit**.

## Install

```
/plugin marketplace add principalwp/principal-claude-marketplace
/plugin install principalwp-toolkit@principalwp
```

After you install, you will need to restart Claude Code to apply.

## Updating

Pull the latest version and restart Claude Code:

    claude plugin update principalwp-toolkit@principalwp

(Or run `/plugin` and update it there.) No version to track — it always moves to the current tip of the repo.

## What's in it

### WordPress Starter Pipeline

**[How the Starter Pipeline works →](https://principalwp.github.io/principal-claude-marketplace/principal-wp-starter-pipeline.html)** — a visual walkthrough of the phases and gates.

Build or make changes to a WordPress plugin or theme through a pipeline inside
Claude Code: gated agent phases (requirements, research, spec, code, review) turn
your request into a reviewed, tested pull request, with three human gates and a
closeout that makes your next run better. Run it with
`/principal-wp-starter-pipeline "<task>"` from a component repo. The first run in a
project performs a one-time setup (E2E test stack, WordPress Agent Skills).

**Customizing the pipeline.** The pipeline reads an optional per-machine overrides
file, `~/.claude/principal-wp-starter-pipeline-overrides.md`, at the start of every
run and applies each `## <stage>` section to the matching agent. Its Feedback Loop
proposes additions to that file, so your customizations survive plugin updates
without ever editing the shipped agents.

### htmlizer

A skill that renders your agent’s markdown as a page you can read. 
Instead of reviewing a wall of markdown to help you make decisions,
view it as a designed self-contained interactive HTML page served over local HTTP.
You visualize decisions, flag issues, and send it back to your interactive session
so it can act on it. Trigger it by saying "*htmlize* this or *show me in htmlize*.

### wp-prototype

Produce a single self-contained HTML file that looks like real WordPress admin and
is clickable enough to judge a design — settings pages, list tables, a block's
canvas plus its inspector sidebar, or a WP 7.0 DataViews screen. Built from real
wp-admin CSS and WordPress design tokens. One interactive mockup by default, or two
or three side by side when you're choosing between layouts.

### writing-for-llms

Write or review any document an LLM agent consumes — a skill, an agent, a
`CLAUDE.md`/`AGENTS.md`, or a reference file. Runs a token audit, trim pass, and
concision review so the instructions stay tight and unambiguous. Two modes:
Create and Review.

### anti-ai-slop

Review and fix prose that reads as AI-generated — hedging, filler, giveaway
phrasing — in either Fix mode (rewrites) or Detect mode (flags without editing).
For human-facing writing, not model-instructing files (that's writing-for-llms).

## License

GPL-3.0. See [LICENSE](LICENSE). htmlizer additionally ships its own `LICENSE` and
`NOTICE` inside the plugin.
