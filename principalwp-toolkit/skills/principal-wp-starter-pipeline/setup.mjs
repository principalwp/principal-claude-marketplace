#!/usr/bin/env node
// setup.mjs — one-time installer for Principal WP Starter Pipeline.
// Run once from your project root. Re-run any time
// to refresh the fetched WordPress Agent Skills or re-verify the E2E stack.
// Nothing here runs in the background — it prompts, installs, and exits.
//
// `--check` is a fast, non-interactive mode: it verifies the
// E2E stack this script installs is actually present and exits 0/1. The
// principal-wp-starter-pipeline SKILL.md preflight runs this before every pipeline
// invocation and halts on non-zero — see references there.

import { execSync } from "node:child_process";
import { createInterface } from "node:readline";
import { createRequire } from "node:module";
import {
  existsSync, mkdirSync, rmSync, cpSync, readdirSync, readFileSync, writeFileSync,
} from "node:fs";
import { join, dirname, basename } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = process.cwd();
const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const SELF = join(SCRIPT_DIR, "setup.mjs");   // absolute path to this script, for user-facing "re-run" hints — correct under any install location, including a plugin cache dir
const AGENT_SKILLS_TARBALL = "https://github.com/WordPress/agent-skills/archive/refs/heads/trunk.tar.gz";
const GITIGNORE_MARKER = "# principal-wp-starter-pipeline: fetched WordPress Agent Skills (setup.mjs) — do not hand-edit below";

// Non-interactive (piped stdin, CI): a readline Interface per prompt doesn't
// work here — piped input arrives as one buffered chunk, and closing the
// Interface after the first question discards whatever of that chunk it
// hadn't handed out yet (verified: a second sequential question gets "" even
// with more lines still in the pipe). So for the non-TTY case we slurp all of
// stdin once, up front, and hand out one line per ask() call. "" (no line
// left, or nothing was piped at all) means "accept default" — this only
// blocks if fd 0 is open but never closes, which doesn't happen for a pipe,
// a redirected file, or /dev/null.
let pipedStdinLines = null;
function nextPipedLine() {
  if (pipedStdinLines === null) {
    let data = "";
    try { data = readFileSync(0, "utf-8"); } catch { /* nothing piped */ }
    pipedStdinLines = data ? data.split(/\r?\n/) : [];
    if (pipedStdinLines.length && pipedStdinLines[pipedStdinLines.length - 1] === "") pipedStdinLines.pop();
  }
  return pipedStdinLines.length ? pipedStdinLines.shift() : null;
}

function ask(question) {
  if (!process.stdin.isTTY) {
    const line = nextPipedLine();
    if (line === null) {
      console.log(question + "(no input piped — using default)");
      return Promise.resolve("");
    }
    console.log(question + line);
    return Promise.resolve(line.trim().toLowerCase());
  }
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((res) => {
    rl.question(question, (answer) => {
      rl.close();
      res(answer.trim().toLowerCase());
    });
  });
}
const accepted = (a) => a === "" || a === "y" || a === "yes";
const hasCmd = (cmd) => { try { execSync(`${cmd} --version`, { stdio: "pipe" }); return true; } catch { return false; } };
// A bare x.y.z is an exact pin (enforced exactly); ^/~/range specs stay as the dev has them.
const isExactPin = (v) => /^\d+\.\d+\.\d+$/.test(v);

// ─── WordPress Agent Skills (fetched, not bundled) ─────────────────────────

function fetchAgentSkills() {
  const cacheDir = join(ROOT, ".wp-agent-skills-cache");
  const tarballPath = join(cacheDir, "agent-skills.tar.gz");
  const extractDir = join(cacheDir, "extracted");
  const skillsDest = join(ROOT, ".claude", "skills");

  console.log("\nFetching WordPress/agent-skills (trunk)...");
  try {
    if (existsSync(extractDir)) rmSync(extractDir, { recursive: true });
    mkdirSync(extractDir, { recursive: true });
    execSync(`curl -fsSL -o "${tarballPath}" "${AGENT_SKILLS_TARBALL}"`, { stdio: "pipe" });
    execSync(`tar -xzf "${tarballPath}" -C "${extractDir}" --strip-components=1`, { stdio: "pipe" });

    const upstreamSkillsDir = join(extractDir, "skills");
    if (!existsSync(upstreamSkillsDir)) {
      console.error("  Warning: no skills/ directory in upstream repo — nothing fetched.");
      return [];
    }
    const fetched = [];
    for (const entry of readdirSync(upstreamSkillsDir, { withFileTypes: true })) {
      if (!entry.isDirectory()) continue;
      cpSync(join(upstreamSkillsDir, entry.name), join(skillsDest, entry.name), { recursive: true });
      fetched.push(entry.name);
    }
    console.log(`  Installed ${fetched.length} WordPress skills into .claude/skills/`);
    try { rmSync(tarballPath); } catch { /* ignore */ }
    return fetched;
  } catch (e) {
    console.error(`  Warning: could not fetch WordPress Agent Skills: ${e.message}`);
    return [];
  }
}

// Always ignore the scaffold directory itself, regardless of whether the
// agent-skills fetch above succeeded — a dev who is offline on first run
// still needs `.principal-wp-starter-pipeline/` kept out of their commits.
function ensureBaseGitignoreLine() {
  const path = join(ROOT, ".gitignore");
  const lines = existsSync(path) ? readFileSync(path, "utf-8").split("\n") : [];
  if (lines.includes(".principal-wp-starter-pipeline/")) return;
  lines.push(".principal-wp-starter-pipeline/");
  const text = [...lines, ""].join("\n").replace(/\n{3,}/g, "\n\n");
  writeFileSync(path, text);
}

function updateGitignore(fetchedDirs) {
  const path = join(ROOT, ".gitignore");
  const lines = existsSync(path) ? readFileSync(path, "utf-8").split("\n") : [];

  // Drop any block this script wrote before, then rewrite it fresh — the
  // fetched dir list can change release to release.
  const start = lines.indexOf(GITIGNORE_MARKER);
  if (start !== -1) {
    let end = start + 1;
    while (end < lines.length && lines[end].startsWith(".claude/skills/")) end++;
    lines.splice(start, end - start);
  }

  const block = [GITIGNORE_MARKER, ...fetchedDirs.map((d) => `.claude/skills/${d}/`)];
  const text = [...lines, "", ...block, ""].join("\n").replace(/\n{3,}/g, "\n\n");
  writeFileSync(path, text);
}

// ─── LSP servers ─────────────────────────────────────────────────────────────

async function offerLSPInstall() {
  const hasIntelephense = existsSync(join(ROOT, "node_modules", "intelephense"));
  const hasVtsls = existsSync(join(ROOT, "node_modules", "@vtsls", "language-server"));
  if (hasIntelephense && hasVtsls) {
    console.log("\nPHP + JS/TS LSP server packages already present (installing them doesn't itself enable LSP in Claude Code).");
    return;
  }
  console.log("\nLSP servers (go-to-definition / find-references for agents):");
  console.log("  PHP: intelephense — JS/TS: @vtsls/language-server");
  console.log("  Note: this only installs the npm packages — it does not by itself wire LSP");
  console.log("  into Claude Code. That may need Claude Code's own LSP/plugin config, which");
  console.log("  this starter doesn't ship; see Claude Code's LSP/plugin docs. Without it,");
  console.log("  agents degrade to grep-based search.");
  const answer = await ask("  Install missing LSP server(s) now? [Y/n] ");
  if (!accepted(answer)) { console.log("  Skipped. Agents will degrade to grep-based search."); return; }
  try {
    execSync("npm install --save-dev intelephense @vtsls/language-server", { cwd: ROOT, stdio: "inherit" });
  } catch (e) {
    console.error(`  npm install failed: ${e.message}`);
  }
}

// ─── E2E test stack (mandatory — this is how the pipeline verifies code) ───
//
// Mirrors principal-wp's own stack: Playwright driving WordPress Playground
// (WASM WordPress + SQLite, no separate MySQL/WP install). E2E-only — the
// real pipeline runs no PHPUnit at all (see build-verify.md). Unlike the
// dev-tools below, this is not offered with [Y/n] — build-verify.md's
// guaranteed tier and SKILL.md's preflight gate both assume it is present.

const E2E_DEV_DEPENDENCIES = {
  "@playwright/test": "^1.52.0",
  "@wp-playground/cli": "3.1.12", // pinned exactly — 3.1.34 shipped a parent-directory regression that broke every test
};
const E2E_SCRIPTS = {
  "test:e2e": "npx playwright test --config=tests/e2e/playwright.config.ts --project=chromium",
  "playground": "npx @wp-playground/cli server --auto-mount",
};

// WordPress-standard block build tool (wraps webpack + babel): compiles
// JSX/ESM/SCSS and emits build/*.asset.php (deps + version hash) alongside
// each compiled script. Mandatory for the same reason the E2E stack is —
// without it, agents have no compiler and JSX ships broken to the browser.
const BUILD_DEV_DEPENDENCIES = {
  "@wordpress/scripts": "^34.0.0",
};

function readPackageJson() {
  const path = join(ROOT, "package.json");
  if (existsSync(path)) return JSON.parse(readFileSync(path, "utf-8"));
  const scaffold = { name: basename(ROOT) || "wordpress-plugin", version: "0.0.0", private: true };
  writeFileSync(path, JSON.stringify(scaffold, null, 2) + "\n");
  return scaffold;
}

function injectE2EManifest() {
  const path = join(ROOT, "package.json");
  const pkg = readPackageJson();
  let changed = false;

  pkg.devDependencies = pkg.devDependencies || {};
  for (const deps of [E2E_DEV_DEPENDENCIES, BUILD_DEV_DEPENDENCIES]) {
    for (const [name, version] of Object.entries(deps)) {
      const current = pkg.devDependencies[name];
      if (!current) {
        pkg.devDependencies[name] = version; changed = true;
      } else if (isExactPin(version) && current !== version) {
        // An exact pin (e.g. @wp-playground/cli 3.1.12) must match exactly — a
        // wrong version like the known-bad 3.1.34 breaks every test, so correct
        // it rather than trusting whatever is already there.
        console.log(`  Correcting ${name} ${current} -> ${version} (pinned exactly).`);
        pkg.devDependencies[name] = version; changed = true;
      }
    }
  }
  pkg.scripts = pkg.scripts || {};
  for (const [name, cmd] of Object.entries(E2E_SCRIPTS)) {
    if (!pkg.scripts[name]) { pkg.scripts[name] = cmd; changed = true; }
  }
  if (changed) writeFileSync(path, JSON.stringify(pkg, null, 2) + "\n");
  return changed;
}

// Recursive copy that never overwrites a file the dev already has —
// scaffolded E2E files are the dev's own once they exist. `relPath` tracks
// the path so far under tests/e2e/, purely for the log line.
function copyDirNoOverwrite(srcDir, destDir, relPath = "") {
  if (!existsSync(srcDir)) return;
  mkdirSync(destDir, { recursive: true });
  for (const entry of readdirSync(srcDir, { withFileTypes: true })) {
    const srcPath = join(srcDir, entry.name);
    const destPath = join(destDir, entry.name);
    const entryRelPath = relPath ? `${relPath}/${entry.name}` : entry.name;
    if (entry.isDirectory()) {
      copyDirNoOverwrite(srcPath, destPath, entryRelPath);
    } else if (!existsSync(destPath)) {
      cpSync(srcPath, destPath);
      console.log(`  Created tests/e2e/${entryRelPath}`);
    }
  }
}

function scaffoldE2ETests() {
  const srcDir = join(SCRIPT_DIR, "templates", "e2e");
  const destDir = join(ROOT, "tests", "e2e");
  if (!existsSync(srcDir)) {
    console.error(`  Warning: ${srcDir} not found, so tests/e2e/ cannot be scaffolded. Is this script still next to its templates/ folder?`);
    return;
  }
  copyDirNoOverwrite(srcDir, destDir);
}

async function installE2EStack() {
  console.log("\nE2E test stack + block build tool (mandatory — Playwright + WordPress Playground, no PHPUnit, plus @wordpress/scripts):");

  injectE2EManifest();

  console.log("  Installing npm packages...");
  execSync("npm install", { cwd: ROOT, stdio: "inherit" });

  console.log("  Installing Chromium for Playwright (~150 MB download, one-time)...");
  execSync("npx playwright install chromium", { cwd: ROOT, stdio: "inherit" });

  console.log("  Scaffolding tests/e2e/...");
  scaffoldE2ETests();

  // No Playground boot at setup — the first real E2E run is the first boot.
  // `--check` confirms the packages, Chromium, and scaffold are present
  // without booting.
}

// ─── Dev tools (offer only, never force) ────────────────────────────────────

async function offerComposer(label, packages) {
  const answer = await ask(`  Install ${label} via composer? [Y/n] `);
  if (!accepted(answer)) { console.log("  Skipped."); return; }
  try { execSync(`composer require --dev ${packages.join(" ")}`, { cwd: ROOT, stdio: "inherit" }); }
  catch (e) { console.error(`  composer require failed: ${e.message}`); }
}

async function offerNpm(label, packages) {
  const answer = await ask(`  Install ${label} via npm? [Y/n] `);
  if (!accepted(answer)) { console.log("  Skipped."); return; }
  try { execSync(`npm install --save-dev ${packages.join(" ")}`, { cwd: ROOT, stdio: "inherit" }); }
  catch (e) { console.error(`  npm install failed: ${e.message}`); }
}

// `composer config` (unlike `composer require`) refuses to run with no
// composer.json in cwd yet — "File './composer.json' cannot be found" — so on
// a plugin repo's first run the allow-plugins pre-step below silently failed
// and the later `composer require` hit the exact block it exists to prevent.
// Scaffold a minimal one first, same pattern as readPackageJson() for npm.
function ensureComposerJson() {
  const path = join(ROOT, "composer.json");
  if (existsSync(path)) return;
  writeFileSync(path, JSON.stringify({ name: "local/plugin", require: {} }, null, 2) + "\n");
}

async function offerDevTools() {
  console.log("\nDev tools (all optional):");
  if (!hasCmd("composer")) {
    console.log("  composer not found — skipping phpcs/phpstan offers.");
  } else {
    // dealerdirect's installer plugin has to be explicitly allowed or
    // Composer refuses to run it and WPCS never registers as a standard.
    ensureComposerJson();
    try {
      execSync("composer config allow-plugins.dealerdirect/phpcodesniffer-composer-installer true", { cwd: ROOT, stdio: "pipe" });
    } catch (e) {
      console.error(`  composer config (allow-plugins) failed: ${e.message}`);
    }
    await offerComposer("phpcs + WordPress Coding Standards", ["wp-coding-standards/wpcs", "dealerdirect/phpcodesniffer-composer-installer"]);
    await offerComposer("phpstan + WordPress stubs", ["phpstan/phpstan", "szepeviktor/phpstan-wordpress"]);
  }
  if (!hasCmd("npm")) {
    console.log("  npm not found — skipping eslint offer.");
  } else {
    await offerNpm("eslint + @wordpress/eslint-plugin", ["@wordpress/eslint-plugin", "eslint"]);
  }
}

// ─── Check mode (`--check`) ───
//
// Fast (~1s), non-interactive, no Playground boot. Run by SKILL.md's
// preflight gate before every pipeline invocation. Exits 0 if the E2E stack
// this script installs is fully present, else 1 with one actionable line.

const NODE_MIN_MAJOR = 20;
const NODE_MIN_MINOR = 18;
const REQUIRED_PACKAGES = [
  "@wp-playground/cli",
  "@playwright/test",
  "@wordpress/scripts",
];

function nodeVersionOk() {
  const [major, minor] = process.versions.node.split(".").map(Number);
  return major > NODE_MIN_MAJOR || (major === NODE_MIN_MAJOR && minor >= NODE_MIN_MINOR);
}

function packagesPresent() {
  return REQUIRED_PACKAGES.every((pkg) => existsSync(join(ROOT, "node_modules", ...pkg.split("/"))));
}

// Presence isn't enough for the exactly-pinned @wp-playground/cli: 3.1.34
// installs and imports fine but breaks every test. Read the version actually
// on disk and require the exact pin.
function playgroundVersionOk() {
  try {
    const pkgPath = join(ROOT, "node_modules", "@wp-playground", "cli", "package.json");
    return JSON.parse(readFileSync(pkgPath, "utf-8")).version === E2E_DEV_DEPENDENCIES["@wp-playground/cli"];
  } catch {
    return false;
  }
}

// `npx playwright install --dry-run chromium` never prints "already
// installed" on 1.6x — --dry-run only describes what it would do, regardless
// of current state — so that text match always failed here even right after
// a correct install. Resolve Chromium's real executable path the way
// Playwright itself does (via playwright-core, respects
// PLAYWRIGHT_BROWSERS_PATH) and check the binary is actually on disk.
function chromiumInstalled() {
  try {
    const require = createRequire(join(ROOT, "package.json"));
    const { chromium } = require("playwright-core");
    return existsSync(chromium.executablePath());
  } catch {
    return false;
  }
}

function e2eScaffoldPresent() {
  const dir = join(ROOT, "tests", "e2e");
  return existsSync(join(dir, "playwright.config.ts")) && existsSync(join(dir, "fixtures.ts"));
}

// Checked in cheapest-first order, and each `if` returns before the next
// check runs — so a broken-environment case (e.g. Node too old) reports in
// ~1s instead of also paying for the Chromium probe below it.
function runCheckMode() {
  if (!nodeVersionOk()) {
    console.error(
      `Setup incomplete: Node ${NODE_MIN_MAJOR}.${NODE_MIN_MINOR}+ required (found ${process.versions.node}). ` +
      `Upgrade Node — e.g. \`nvm install ${NODE_MIN_MAJOR} && nvm use ${NODE_MIN_MAJOR}\`, or download from nodejs.org — then re-run \`node ${SELF} --check\`.`,
    );
    process.exit(1);
  }
  if (!packagesPresent()) {
    console.error(
      `Setup incomplete: required packages not installed — the E2E stack and the block build tool (${REQUIRED_PACKAGES.join(", ")}). Run \`node ${SELF}\` from your project root, then re-run.`,
    );
    process.exit(1);
  }
  if (!playgroundVersionOk()) {
    console.error(
      `Setup incomplete: @wp-playground/cli must be exactly ${E2E_DEV_DEPENDENCIES["@wp-playground/cli"]} on disk ` +
      `(3.1.34 breaks every test). Run \`node ${SELF}\` from your project root, then re-run.`,
    );
    process.exit(1);
  }
  if (!chromiumInstalled()) {
    console.error("Setup incomplete: Chromium not installed for Playwright. Run `node " + SELF + "` from your project root, then re-run.");
    process.exit(1);
  }
  if (!e2eScaffoldPresent()) {
    console.error("Setup incomplete: tests/e2e/ scaffold missing. Run `node " + SELF + "` from your project root, then re-run.");
    process.exit(1);
  }
  process.exit(0);
}

// ─── Main ────────────────────────────────────────────────────────────────────

async function main() {
  if (process.argv.includes("--check")) {
    runCheckMode();
    return;
  }

  console.log("Principal WP Starter Pipeline — one-time setup\n");
  const fetched = fetchAgentSkills();
  ensureBaseGitignoreLine();
  if (fetched.length > 0) updateGitignore(fetched);

  try {
    await installE2EStack();
  } catch (e) {
    console.error(`\nE2E stack setup did not complete: ${e.message}`);
    console.error("Fix the error above, then re-run `node " + SELF + "`. The pipeline will not run without this.");
    process.exit(1);
  }

  await offerLSPInstall();
  await offerDevTools();
  console.log('\nDone. Setup wrote tests/e2e/, devDeps, and a .gitignore line — commit that scaffold before your first pipeline run, so the clean-worktree preflight gate doesn\'t trip on it.');
  console.log('Run /principal-wp-starter-pipeline "<task text or path>" from Claude Code to start.');
}

main();
