# Block Guide

This page is the handful of facts that keep a block implementation from breaking convention, for
the Code agent on block or CSS/theme.json tickets and for the design reviewer. For depth beyond
it — component selection, control placement, pattern design, theme.json tokens — read the full
skills `wp-patterns` and `wp-block-development` (installed into `.claude/skills/` by
`setup.mjs`); this page exists so most tickets don't need to.

## Dynamic, always

Every custom block is dynamic: `block.json`'s `render` points at `render.php`, `save()` returns
`null` (or is omitted entirely), `html` support is `false`. Never ship a static block whose markup
is frozen into post content — it can't evolve without breaking content already inserted with it.

## `block.json` supports + context

- Enable `supports.typography` and `supports.color` unless there's a specific reason not to — it
  lets theme.json and Global Styles control presentation instead of hardcoded CSS in the block.
- If `block.json` declares `usesContext`, `edit.js` **must** consume the `context` prop for that
  data. Never pull the same value from the `core/editor` store directly when context is available
  — that breaks the block inside Query Loop and other context providers.

## Tokens over hardcoded values

Use `var(--wp--preset--color--*, fallback)`, `var(--wp--preset--spacing--*, fallback)`, and
`var(--wp--custom--*, fallback)` — never a hardcoded hex, px, or rem value. Presets track theme
changes and style variations automatically; a hardcoded value doesn't.

## `useBlockProps()` on every render path

Put `useBlockProps()` on the outermost element in `edit.js` — in the placeholder state, the
loading state, the error state, and the live preview alike. Every block support (color, spacing,
typography, anchor) depends on the attributes it adds; skip it in one state and that state quietly
loses those controls.

## The three editor states

Any block that fetches or depends on async/external data implements: loading (`Spinner` inside a
`Placeholder`), error (`Notice status="error"`, never a silently-swallowed `catch`), and the live
preview matching frontend output. If the spec doesn't specify error copy, default to a plain
WordPress `Notice`.

## Compile JSX/ESM source, always

`setup.mjs` guarantees `@wordpress/scripts` is installed, so a block or editor script written in
JSX or modern JavaScript is always compiled, never shipped raw:

- Source lives in `src/`; compiled output goes to `build/`.
- If `package.json` has no `scripts.build` / `scripts.start`, add them (`wp-scripts build` /
  `wp-scripts start`) — the tool is always present, so this is never something to skip.
- `npm ci` (or `npm install` with no lockfile), then `npm run build`.
- Register the **compiled** `build/` output — `register_block_type( __DIR__ . '/build' )`, or
  enqueue `build/*.js` via its generated `build/*.asset.php`. Never register or enqueue raw `src/`.
