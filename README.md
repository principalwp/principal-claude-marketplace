# Principal WP — Claude Code marketplace

Public Claude Code tools from [Principal WP](https://principalwp.com), shipped as a
single plugin: **principalwp-toolkit**.

## Install

```
/plugin marketplace add principalwp/principal-claude-marketplace
/plugin install principalwp-toolkit@principalwp
```

Restart Claude Code to apply.

## What's in it

### htmlizer

Turn the thing you'd otherwise paste as text — a plan, a review, competing
approaches, a design, a config change — into a self-contained interactive HTML
page served over local HTTP. Hand over the `http://` link; the reader annotates
the page and hits Submit, and their feedback returns into the session so you can
act on it. Trigger it by saying *htmlize*, *htmlizer*, or *render in html*.

### wp-prototype

Produce a single self-contained HTML file that looks like real WordPress admin and
is clickable enough to judge a design — settings pages, list tables, a block's
canvas plus its inspector sidebar, or a WP 7.0 DataViews screen. Built from real
wp-admin CSS and WordPress design tokens. One interactive mockup by default, or two
or three side by side when you're choosing between layouts.

### WordPress Starter Pipeline

Take one change to a WordPress plugin or theme through a small pipeline inside
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

## License

GPL-3.0. See [LICENSE](LICENSE). htmlizer additionally ships its own `LICENSE` and
`NOTICE` inside the plugin.
