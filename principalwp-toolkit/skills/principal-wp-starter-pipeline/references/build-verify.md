# Build Verify — guaranteed E2E, best-effort static

Two tiers, two different postures, read by the Code agent (build mode step 7, fixer mode's final
pass) and the orchestrator at closeout:

- **Guaranteed tier — E2E via WordPress Playground.** `setup.mjs` already installed Playwright,
  `@wp-playground/cli`, and scaffolded `tests/e2e/` before this pipeline could even start — SKILL.md's
  preflight gate (`node setup.mjs --check`) halts the whole run otherwise. So this tier **runs, it
  doesn't detect** — there's nothing to check for, it's guaranteed present.
- **Best-effort tier — static tools (PHPCS/PHPStan/ESLint) + `php -l`.** Outside the setup guarantee:
  detect what's present, run it, and record what's missing without failing the run.

## Guaranteed tier — E2E (run, don't detect)

**Per-task (Code agent, build or fixer mode):** run only the spec you wrote or touched — not the
whole suite:

```bash
npx playwright test --config=tests/e2e/playwright.config.ts tests/e2e/specs/<this-spec>.spec.ts --project=chromium
```

**Closeout (orchestrator verify pass):** run the full suite once:

```bash
npm run test:e2e
```

Record results in `code-notes.md` (per-task) / `summary.md` (closeout): `e2e: {N passing, N failing}`.

A suite that **collects 0 tests, or fails to load**, counts as an E2E **FAIL** — a verdict input the
orchestrator reads at closeout (see "Fix your own failures, capped"), not something to swallow as if
nothing needed testing. This mirrors the real pipeline: a fail-to-load suite is a hard failure that
withholds the PR handoff, never a silent pass.

**Never install here** — setup.mjs already installed this tier; a missing E2E stack means the
setup gate was bypassed, so surface that to the dev, don't install around it.

## Always

```bash
php -l path/to/ChangedFile.php   # once per changed .php file
```

No install needed — `php -l` ships with PHP.

## Best-effort tier — detect, then run if present

| Changed | Tool | Relevant when | Detect | Run |
|---|---|---|---|---|
| `*.php` | PHPCS | any PHP file changed | `vendor/bin/phpcs -i` lists a `WordPress*` standard | `vendor/bin/phpcs --standard=<discovered> <files>` |
| `*.php` | PHPStan | any PHP file changed | `vendor/bin/phpstan --version` succeeds AND a `phpstan.neon*` exists | `vendor/bin/phpstan analyse` |
| `*.js`/`*.ts` | ESLint | any JS/TS file changed | `node_modules/.bin/eslint --version` succeeds | `node_modules/.bin/eslint <files>` (or `npm test` if that's how the repo wires it) |

**PHPCS standard: discover, then fall back.** Use the repo's own `phpcs.xml` / `phpcs.xml.dist` if
one exists. Otherwise `--standard=WordPress` — the portable default. Never `WordPress-VIP-Go`;
this starter targets ordinary WordPress plugins, not VIP.

## Missing tool → record, don't fail

When a relevant best-effort tool isn't present, add one line to `.principal-wp-starter-pipeline/<run-id>/code-notes.md`
under **Missing Tools** with the exact install command, then continue:

- PHPCS → `composer require --dev wp-coding-standards/wpcs dealerdirect/phpcodesniffer-composer-installer`
- PHPStan → `composer require --dev phpstan/phpstan szepeviktor/phpstan-wordpress`
- ESLint → `npm i -D @wordpress/eslint-plugin eslint`

Tell the developer to re-run `node setup.mjs` — it offers these installs itself. Do not offer a
`[Y/n]` prompt and do not install anything yourself, even though this is an interactive session —
installing is `setup.mjs`'s job, never a sub-agent's. (The exact commands above go in the
code-notes record; they are not for you to run.)

## Fix your own failures, capped

If a check you just ran reports errors in code you just wrote, fix and re-run — cap 2 iterations
(lint → test → lint, once). Beyond the cap, stop looping and record what's left — but *how* you
record it decides whether it gates the run:

- **Required checks** — `php -l` syntax, the E2E suite (including the collects-0 / fails-to-load
  case above), and any repo-wired build or test script. `@wordpress/scripts` is guaranteed present
  the same way the E2E stack is (see `setup.mjs`), so a block or editor script with a JavaScript/JSX
  entry under `src/` (a `src/index.{js,jsx,ts,tsx}`, or a `block.json` whose
  `editorScript`/`script`/`viewScript` points into `src/`) that ships without its compiled `build/`
  output — or whose `npm run build` fails — falls in this required tier too: it is not "not
  applicable" just because no build script existed before this task. (Plain `src/` used only for PHP
  autoloading, with no JS entry, is not this case, and a repo with no JS entry and no build script
  runs no build at all.) An
  outstanding failure here is a **verdict input**, not just a note: record it under an **Outstanding
  Failures** heading in `code-notes.md` (per-task) and `summary.md` (closeout), naming the check and
  what failed. The orchestrator reads these at closeout and **withholds the push/PR handoff** until
  they're resolved — a run does not hand off a PR over a failing required check.
- **Best-effort static tier** — PHPCS/PHPStan/ESLint. An outstanding failure is a note, not a gate:
  record it and move on, exactly like a missing tool. It does not withhold the handoff.

Either way, don't loop indefinitely chasing a clean run past the cap.

## Hygiene

- Never commit `vendor/` or `node_modules/`.
- Offline, or no `composer`/`npm` on `PATH`: treat exactly like a missing tool — record and
  continue. Degrade gracefully; never halt the run over connectivity. **This applies to the
  best-effort static tier only** — the E2E tier above is guaranteed present by the setup gate, so
  there's no "offline" case for it to degrade into. If it fails to run at all, that's the
  0-collected / fail-to-load case above, not a connectivity shrug.
