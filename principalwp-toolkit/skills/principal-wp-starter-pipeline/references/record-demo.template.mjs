/**
 * Template for principal-wp-starter-pipeline-demo-recording's generated recording driver.
 *
 * `principal-wp-starter-pipeline-demo-recording` copies this file to
 * `.principal-wp-starter-pipeline/<run-id>/record-demo.mjs` and replaces the single
 * `SCENE ACTIONS` block below with that task's own walk-through (built
 * from the spec's Acceptance Criteria). Everything else — finding the
 * plugin's main file, mounting the repo root, loading the E2E blueprint,
 * launching Chromium, recording — mirrors `tests/e2e/fixtures.ts`'s
 * Playground-boot approach exactly, so the demo boots the plugin the same
 * way the E2E tests do, not a parallel boot.
 *
 * This is a standalone Node script, NOT a Playwright Test: it is never
 * wired into playwright.config.ts, so recording a demo never turns on
 * video for the normal `npm run test:e2e` run. Run it with
 * `node .principal-wp-starter-pipeline/<run-id>/record-demo.mjs` from the plugin repo
 * root (or anywhere — paths below resolve from this file's own location,
 * not from the current working directory).
 */
import { chromium } from 'playwright';
import { runCLI } from '@wp-playground/cli';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

// This file lives at .principal-wp-starter-pipeline/<run-id>/record-demo.mjs inside the
// plugin's own repo — two levels down from the repo root, same depth
// tests/e2e/fixtures.ts resolves PROJECT_ROOT from.
const OUT_DIR = path.dirname( fileURLToPath( import.meta.url ) );
const REPO_ROOT = path.resolve( OUT_DIR, '..', '..' );
const PLUGIN_SLUG = path.basename( REPO_ROOT );
const VIDEO_DIR = path.join( OUT_DIR, 'videos' );
const VIEWPORT = { width: 1280, height: 720 };
// Deliberate pacing, so the recording reads as a walk-through instead of a blur. These are the
// ONLY sanctioned page.waitForTimeout() values: never waitForTimeout() to wait for content to
// appear (wait on the element the next step needs); these are on-screen holds for the viewer.
const HIGHLIGHT_HOLD = 900;  // ms — hold the click-highlight ring before clicking, so the eye lands on the target
const ACTION_DELAY = 500;    // ms — settle pause after each visible action, so steps don't run together
const TYPE_DELAY = 90;       // ms — between keystrokes, so typing is visible on camera
const SCENE_PAUSE = 1500;    // ms — hold on a scene's result before moving to the next scene
const SCENE_END_HOLD = 2000; // ms — hold the final frame before stopping the recording

/**
 * Find the plugin's main file: a top-level `*.php` file whose header
 * docblock contains a `Plugin Name:` line — the same signal
 * tests/e2e/fixtures.ts uses to recognize the plugin under test.
 */
function findPluginMainFile() {
	const entries = fs.readdirSync( REPO_ROOT ).filter( ( f ) => f.endsWith( '.php' ) );
	for ( const file of entries ) {
		const contents = fs.readFileSync( path.join( REPO_ROOT, file ), 'utf-8' );
		if ( /^\s*\*?\s*Plugin Name:/im.test( contents ) ) return file;
	}
	return null;
}

/**
 * Load tests/e2e/blueprints/base.json — the same blueprint the E2E suite
 * boots from (login, permalinks, WP_DEBUG) — and unshift an
 * `activatePlugin` step for the plugin under test. Mount does NOT
 * activate a plugin on its own.
 */
function loadBlueprint() {
	const blueprint = JSON.parse(
		fs.readFileSync( path.join( REPO_ROOT, 'tests', 'e2e', 'blueprints', 'base.json' ), 'utf-8' )
	);
	const mainFile = findPluginMainFile();
	if ( ! mainFile ) {
		throw new Error(
			`No PHP file with a "Plugin Name:" header found at ${ REPO_ROOT } — record-demo.mjs must run from the plugin's own repo root, same as tests/e2e/fixtures.ts expects.`
		);
	}
	if ( ! blueprint.steps ) blueprint.steps = [];
	blueprint.steps.unshift( { step: 'activatePlugin', pluginPath: `${ PLUGIN_SLUG }/${ mainFile }` } );
	return blueprint;
}

/** Mount the whole repo root into the site as the plugin-under-test. */
function buildMounts() {
	return [
		{ hostPath: REPO_ROOT, vfsPath: `/wordpress/wp-content/plugins/${ PLUGIN_SLUG }` },
		// If a build dir (e.g. `build/`) may be a symlink, mount its real target
		// too — Playground can't read through a symlink pointing outside the
		// mounted tree. Uncomment and adjust if this plugin has one:
		// {
		// 	hostPath: fs.realpathSync( path.join( REPO_ROOT, 'build' ) ),
		// 	vfsPath: `/wordpress/wp-content/plugins/${ PLUGIN_SLUG }/build`,
		// },
	];
}

/**
 * Minimal caption bar — a persistent bottom bar showing what's on screen
 * right now. No audio, no narration script, no chapters: just enough to
 * keep the walk-through legible. Call it again to swap the text in place.
 *
 * Call this AFTER a navigation lands, never before: a page.evaluate()
 * injected element does not survive the next page.goto() / navigation, so
 * a caption set before navigating is wiped before any frame records it.
 *
 * The bar sets pointer-events:none, so clicks pass through it to controls
 * beneath. A control at the very bottom edge is still painted under the bar,
 * though — if a scene must clearly show one, scroll it above the bar first.
 */
async function caption( page, text ) {
	await page.evaluate( ( t ) => {
		let el = document.getElementById( 'pwb-demo-caption' );
		if ( ! el ) {
			el = document.createElement( 'div' );
			el.id = 'pwb-demo-caption';
			// pointer-events:none — a passive label must never intercept clicks on a control
			// beneath it; without it Playwright's actionability check finds the caption over a
			// bottom-of-page button and the click times out.
			el.style.cssText = `
				position: fixed; bottom: 0; left: 0; right: 0; z-index: 999999;
				pointer-events: none;
				background: rgba(15, 23, 42, 0.92); color: #f8fafc;
				padding: 14px 24px; font: 600 15px/1.4 system-ui, sans-serif;
				border-top: 2px solid #3b82f6;
			`;
			document.body.appendChild( el );
		}
		el.textContent = t;
	}, text );
}

/**
 * Click a target the way a viewer can follow: draw a pulsing ring around it,
 * hold HIGHLIGHT_HOLD so the eye lands there, click, remove the ring, then
 * settle ACTION_DELAY so the next step doesn't run into this one. Use this for
 * every click a scene is meant to show; a plain locator.click() is fine only
 * for off-camera setup nothing is demonstrating.
 *
 * The ring is position:fixed at the target's viewport box (boundingBox() is
 * viewport-relative, and stays correct for elements inside the editor-canvas
 * iframe), and pointer-events:none so it never intercepts the click it's
 * advertising. It removes itself right after, so nothing lingers on screen or
 * blocks the next target.
 */
async function highlightAndClick( locator ) {
	await locator.scrollIntoViewIfNeeded();
	const page = locator.page();
	const box = await locator.boundingBox();
	if ( box ) {
		await page.evaluate( ( { x, y, w, h } ) => {
			if ( ! document.getElementById( 'pwb-highlight-style' ) ) {
				const style = document.createElement( 'style' );
				style.id = 'pwb-highlight-style';
				style.textContent =
					'@keyframes pwb-pulse {' +
					'0%{transform:scale(1);opacity:1}' +
					'25%{transform:scale(1.06);opacity:0.6}' +
					'50%{transform:scale(1);opacity:1}' +
					'75%{transform:scale(1.06);opacity:0.6}' +
					'100%{transform:scale(1);opacity:1}}';
				document.head.appendChild( style );
			}
			const ring = document.createElement( 'div' );
			ring.id = 'pwb-click-ring';
			ring.style.cssText = `
				position: fixed; z-index: 1000000; pointer-events: none; box-sizing: border-box;
				left: ${ x - 4 }px; top: ${ y - 4 }px;
				width: ${ w + 8 }px; height: ${ h + 8 }px;
				border: 3px solid #3b82f6; border-radius: 6px;
				box-shadow: 0 0 12px rgba(59, 130, 246, 0.5);
				animation: pwb-pulse 0.9s ease-in-out;
			`;
			document.body.appendChild( ring );
		}, { x: box.x, y: box.y, w: box.width, h: box.height } );
	}
	await page.waitForTimeout( HIGHLIGHT_HOLD );
	await locator.click();
	await page.evaluate( () => document.getElementById( 'pwb-click-ring' )?.remove() );
	await page.waitForTimeout( ACTION_DELAY );
}

/**
 * Type into a field character by character (pressSequentially, not fill) so
 * the keystrokes are visible on camera, then settle ACTION_DELAY. Use for any
 * text entry a scene is showing; fill() is instant and reads as a jump-cut.
 */
async function typeSlow( locator, text ) {
	await locator.scrollIntoViewIfNeeded();
	await locator.click();
	await locator.pressSequentially( text, { delay: TYPE_DELAY } );
	await locator.page().waitForTimeout( ACTION_DELAY );
}

async function main() {
	const blueprint = loadBlueprint();

	// Clear any leftover .webm from a prior failed attempt before this run —
	// a failed scene still saves a (partial) video via context.close() in the
	// finally block below, and a stale file left over from that would make
	// this run's rename guard (videoFiles.length === 1) silently no-op even
	// after a fully successful recording.
	if ( fs.existsSync( VIDEO_DIR ) ) fs.rmSync( VIDEO_DIR, { recursive: true, force: true } );
	fs.mkdirSync( VIDEO_DIR, { recursive: true } );

	const cli = await runCLI( {
		command: 'server',
		blueprint,
		mount: buildMounts(),
		// Clear any persisted site so the recording boots clean every time —
		// same reason tests/e2e/fixtures.ts sets this.
		reset: true,
	} );

	const browser = await chromium.launch( {
		args: [ '--enable-experimental-webassembly-jspi' ],
	} );

	// Warmup: pay WP Playground's WASM cold-start off-camera, so the recorded
	// context's first navigation is fast.
	const warmup = await browser.newContext( { viewport: VIEWPORT } );
	const warmupPage = await warmup.newPage();
	warmupPage.setDefaultNavigationTimeout( 120_000 );
	await warmupPage.goto( `${ cli.serverUrl }/wp-admin/`, { waitUntil: 'domcontentloaded' } );
	await warmup.close();

	// Recording context — video save is triggered by context.close() below.
	const context = await browser.newContext( {
		viewport: VIEWPORT,
		recordVideo: { dir: VIDEO_DIR, size: VIEWPORT },
	} );
	const page = await context.newPage();
	page.setDefaultNavigationTimeout( 120_000 );
	page.setDefaultTimeout( 30_000 );

	const recordStart = Date.now();
	try {
		/* === SCENE ACTIONS ===
		 * Replace this block with this task's own walk-through, in the order
		 * built in Step 2 of principal-wp-starter-pipeline-demo-recording.md. One shape per AC —
		 * navigate first, THEN caption (a caption set before navigating is
		 * wiped by the navigation, see caption()'s own docs above), then drive
		 * the scene with highlightAndClick() / typeSlow() so clicks are ringed
		 * and actions are paced, and hold SCENE_PAUSE on the result before the
		 * next scene:
		 *
		 *   await page.goto( `${ cli.serverUrl }/wp-admin/options-general.php?page=my-plugin` );
		 *   await caption( page, 'AC-001 — open the plugin settings page' );
		 *   await typeSlow( page.getByRole( 'textbox', { name: 'API key' } ), 'demo-key' );
		 *   await highlightAndClick( page.getByRole( 'button', { name: 'Save Changes' } ) );
		 *   await page.getByText( 'Settings saved' ).waitFor( { state: 'visible', timeout: 30_000 } );
		 *   await page.waitForTimeout( SCENE_PAUSE ); // hold on the result before the next scene
		 *
		 * Prefer getByRole / getByLabel / getByText — never CSS selectors. Use
		 * highlightAndClick() for clicks the scene is showing and typeSlow() for
		 * text it's showing (they draw the click ring and pace each action); a
		 * bare .click() / fill() is only for off-camera setup. Two name-matching
		 * traps that time out instead of erroring clearly:
		 *   - getByRole name matching is case-insensitive SUBSTRING by default, so a
		 *     name that is also a substring of another element's name (a username that
		 *     also appears inside a "View posts by <name>" link) is strict-mode
		 *     ambiguous — pass { exact: true } to pin it.
		 *   - a submit button's accessible name is its `value`, not the page heading:
		 *     wp-admin's Add-User form heading reads "Add New User" but the submit
		 *     button's value is "Add User", so getByRole('button',{name:'Add New User'})
		 *     matches zero elements. Confirm the real value; don't assume the heading.
		 * Wait for the element the next step needs rather than page.waitForTimeout() — the
		 * only sanctioned waitForTimeout()s are the pacing holds above (SCENE_PAUSE
		 * between scenes) and the ones baked into the two helpers. Let a missing
		 * key element throw — never `.catch(() => false)` past the primary
		 * content a scene is demonstrating; Step 4's capped retry is what handles
		 * a real failure, not a silent skip here.
		 */

		await page.waitForTimeout( SCENE_END_HOLD );
	} finally {
		await context.close(); // triggers the video save
		await browser.close();
		try {
			cli.server?.close(); // callback-based Node HTTP server, not a Promise
		} catch {
			/* ignore */
		}
	}

	// Only reached if the scene actions above didn't throw. Playwright names
	// the video randomly — rename it to the fixed demo.webm path.
	const videoFiles = fs.readdirSync( VIDEO_DIR ).filter( ( f ) => f.endsWith( '.webm' ) );
	if ( videoFiles.length === 1 ) {
		const demoPath = path.join( OUT_DIR, 'demo.webm' );
		fs.renameSync( path.join( VIDEO_DIR, videoFiles[ 0 ] ), demoPath );
		fs.rmSync( VIDEO_DIR, { recursive: true } );
		// Machine-readable success line: the agent reads this from the Bash
		// tool's own output to confirm the file was written and get a
		// duration for demo-recording.md, without needing a separate Bash command.
		const { size } = fs.statSync( demoPath );
		const seconds = Math.round( ( Date.now() - recordStart ) / 1000 );
		console.log( `DEMO_RECORDED path=${ demoPath } bytes=${ size } seconds=${ seconds }` );
	}
}

main().catch( ( err ) => {
	console.error( err );
	process.exit( 1 );
} );
