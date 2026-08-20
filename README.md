# Principal WP — Claude Code marketplace

Public Claude Code tools from [Principal WP](https://principalwp.com), shipped as a
single plugin: **principalwp-toolkit**.

## Install

```
/plugin marketplace add principalwp/principal-claude-marketplace
/plugin install principalwp-toolkit@principalwp
```

After you install, restart Claude Code.

## Updating

We recommend enabling auto updates. To do this, run `/plugin`, open the **Marketplaces** tab, select `principalwp`, and choose **Enable auto-update**, or ask Claude to enable auto-updates for the principalwp-toolkit.

To manually update, run the command below in the terminal, then restart Claude Code (as of August 2026, `/reload-plugins` doesn't reload marketplace plugins):

    claude plugin update principalwp-toolkit@principalwp

## What's in the PrincipalWP toolkit

### WordPress Starter Pipeline

**[How the Starter Pipeline works →](https://principalwp.github.io/principal-claude-marketplace/principal-wp-starter-pipeline.html)** is a visual walkthrough of the phases and checkpoints.

Build or change a WordPress plugin or theme through a pipeline inside Claude Code.
The pipeline runs checkpointed agent phases (requirements, research, spec, code,
review) and opens a pull request that's been reviewed and tested. It has three human
checkpoints and a closeout that improves your next run. Run it with
`/principal-wp-starter-pipeline "<task>"` from a component repo. The first run in a
project does a one-time setup (E2E test stack, WordPress Agent Skills).

**Customizing the pipeline.** The pipeline reads an optional per-machine overrides
file, `~/.claude/principal-wp-starter-pipeline-overrides.md`, at the start of every
run and applies each `## <stage>` section to the matching agent. Its Feedback Loop
proposes additions to that file, so your customizations survive plugin updates
without ever editing the shipped agents.

### htmlizer

A skill that renders your agent's markdown as a page you can read. Instead of reading
a wall of markdown to make your decisions, you view it as a self-contained interactive
HTML page served over local HTTP. You mark decisions, flag issues, and send it back to
your interactive session so it can act on it. Trigger it by saying "*htmlize* this or
*show me in htmlize*.

### wp-prototype

Produce a single self-contained HTML file that looks like real WordPress admin and is
clickable enough to judge a design. It can show settings pages, list tables, a block's
canvas plus its inspector sidebar, or a WP 7.0 DataViews screen. It's built from
wp-admin CSS and WordPress design tokens. It makes one interactive mockup by default,
or two or three side by side when you're choosing between layouts.

### writing-for-llms

Write or review any document an LLM agent consumes, such as a skill, an agent, a
`CLAUDE.md`/`AGENTS.md`, or a reference file. It runs a token audit, trim pass, and
concision review. Two modes: Create and Review.

### anti-ai-slop

Review and fix prose that reads as AI-generated, such as hedging, filler, and giveaway
phrasing. It runs in Fix mode (rewrites) or Detect mode (flags without editing). For
human-facing writing, not model-instructing files (that's writing-for-llms).

## License

GPL-3.0. See [LICENSE](LICENSE). htmlizer additionally ships its own `LICENSE` and
`NOTICE` inside the plugin.
