/**
 * Shared Playwright fixtures for WordPress E2E tests, running against
 * WordPress Playground (WASM WordPress + SQLite, no separate MySQL/WP
 * install to stand up).
 *
 * Starts a Playground server per worker via `@wp-playground/cli`'s
 * programmatic `runCLI()` and exposes the resulting `serverUrl` to every
 * test.
 *
 * Component-driven, type-agnostic. The pipeline records the components it
 * found (plugins, themes, mu-plugins) in a run's `state.json`; this file
 * reads that state and, for each component, does two things:
 *   1. Mounts the component's host directory where WordPress expects that
 *      kind of thing to live — `wp-content/<role>/<slug>` (role is the
 *      wp-content subdir: plugins | themes | mu-plugins). Mounting copies
 *      the source in; it does NOT activate anything.
 *   2. Injects the component's activation step (from state) onto the front
 *      of the blueprint so it's already active when the site boots —
 *      `activatePlugin` for a plugin, `activateTheme` for a theme, and
 *      nothing for mu-plugins (WordPress auto-loads those).
 *
 * State is located via `process.env.PWB_STATE` (an absolute path the
 * pipeline exports when it runs E2E), falling back to the newest
 * `.principal-wp-starter-pipeline/<run-id>/state.json` under the project root for
 * hand runs. With no state at all, a bare WordPress boots (nothing
 * mounted) — enough for a dashboard smoke check.
 *
 * Usage in specs:
 *   import { test, expect } from '../fixtures';
 *   test( 'my test', async ( { page, serverUrl } ) => { ... } );
 */
import { test as base, expect } from '@playwright/test';
import { runCLI } from '@wp-playground/cli';
import * as path from 'path';
import * as fs from 'fs';

/** A single Playground host-to-vfs mount entry. */
type Mount = { hostPath: string; vfsPath: string };

/** A Blueprint step, as loaded from blueprints/*.json. */
type BlueprintStep = Record< string, unknown >;
type Blueprint = { steps?: BlueprintStep[]; [ key: string ]: unknown };

/**
 * A component the pipeline found, as recorded in state.json:
 *   role       — the wp-content subdir it belongs in (plugins|themes|mu-plugins)
 *   path       — the component's directory, relative to the project root
 *   slug       — its folder name (the vfs slug it mounts under)
 *   activation — the blueprint step that activates it, or null (mu-plugins)
 */
type Component = {
	role: 'plugins' | 'themes' | 'mu-plugins';
	path: string;
	slug: string;
	activation: BlueprintStep | null;
};
type State = { components?: Component[]; [ key: string ]: unknown };

// tests/e2e/ -> repo root is two levels up.
const PROJECT_ROOT = path.resolve( __dirname, '..', '..' );
const BLUEPRINTS_DIR = path.join( __dirname, 'blueprints' );

/**
 * Locate the run's state.json. The pipeline exports its absolute path as
 * `PWB_STATE` when it runs E2E; for hand runs, fall back to the newest
 * `.principal-wp-starter-pipeline/<run-id>/state.json` under the project root. Returns
 * null when neither is present — the caller then boots a bare WordPress.
 */
function locateStateFile(): string | null {
	const fromEnv = process.env.PWB_STATE;
	if ( fromEnv ) {
		return fromEnv;
	}

	const runsDir = path.join( PROJECT_ROOT, '.principal-wp-starter-pipeline' );
	let runIds: string[];
	try {
		runIds = fs.readdirSync( runsDir );
	} catch {
		return null;
	}

	const candidates = runIds
		.map( ( id ) => path.join( runsDir, id, 'state.json' ) )
		.filter( ( candidate ) => fs.existsSync( candidate ) );
	if ( candidates.length === 0 ) {
		return null;
	}

	candidates.sort(
		( a, b ) => fs.statSync( b ).mtimeMs - fs.statSync( a ).mtimeMs
	);
	return candidates[ 0 ];
}

/**
 * Read the components the pipeline found. Missing state, an unreadable
 * file, or malformed JSON all degrade to an empty list (bare-WordPress
 * smoke run) rather than failing the whole worker.
 */
function readComponents(): Component[] {
	const stateFile = locateStateFile();
	if ( ! stateFile ) {
		return [];
	}
	try {
		const state = JSON.parse(
			fs.readFileSync( stateFile, 'utf-8' )
		) as State;
		return state.components ?? [];
	} catch {
		return [];
	}
}

/** Mount each component where WordPress expects that kind of thing to live. */
function buildMounts( components: Component[] ): Mount[] {
	return components.map( ( component ) => ( {
		hostPath: path.resolve( PROJECT_ROOT, component.path ),
		vfsPath: `/wordpress/wp-content/${ component.role }/${ component.slug }`,
	} ) );
}

/**
 * Load a blueprint JSON file from the blueprints/ directory. Falls back to
 * base.json if the requested blueprint doesn't exist.
 *
 * Each component's activation step (from state) is unshifted onto the
 * blueprint's steps so the component is already active by the time a test's
 * first `page.goto()` runs. Components with a null activation (mu-plugins,
 * which WordPress auto-loads) contribute no step.
 */
function loadBlueprint( name = 'base', components: Component[] ): Blueprint {
	const blueprintPath = path.join( BLUEPRINTS_DIR, `${ name }.json` );
	const sourcePath = fs.existsSync( blueprintPath )
		? blueprintPath
		: path.join( BLUEPRINTS_DIR, 'base.json' );

	const blueprint = JSON.parse(
		fs.readFileSync( sourcePath, 'utf-8' )
	) as Blueprint;

	if ( ! blueprint.steps ) blueprint.steps = [];
	for ( const component of components ) {
		if ( component.activation ) {
			blueprint.steps.unshift( component.activation );
		}
	}

	return blueprint;
}

/**
 * Worker-scoped fixtures — shared across tests in the same worker file.
 * Playground lifecycle lives here so we boot one instance PER WORKER — a
 * shared server would bleed state between parallel tests. Each worker boots
 * its own via runCLI (auto-assigned port) and tears it down.
 */
type PlaygroundFixtures = {
	/** The URL of the running WordPress Playground instance. */
	serverUrl: string;
	/** Name of the blueprint to use. Override via test.use(). */
	blueprintName: string;
};

export const test = base.extend< object, PlaygroundFixtures >( {
	// Default blueprint — override per-file with test.use({ blueprintName: 'other' })
	blueprintName: [ 'base', { option: true, scope: 'worker' } ],

	serverUrl: [
		async ( { blueprintName }, use ) => {
			const components = readComponents();
			const blueprint = loadBlueprint( blueprintName, components );

			const cli = await runCLI( {
				command: 'server',
				blueprint: blueprint as Parameters< typeof runCLI >[ 0 ][ 'blueprint' ],
				mount: buildMounts( components ),
				// Clear any persisted site so each run boots clean — @wp-playground/cli
				// persists site state per project path and reuses it across runs
				// otherwise.
				reset: true,
			} );

			try {
				await use( cli.serverUrl );
			} finally {
				// Close in `finally` so the server is torn down even when a test
				// throws or the worker is killed mid-run.
				try {
					cli.server?.close();
				} catch {
					/* callback-based, may throw */
				}
			}
		},
		{ scope: 'worker' },
	],

	// Bridge serverUrl into Playwright's baseURL so relative goto() calls
	// resolve to the Playground server.
	baseURL: async ( { serverUrl }, use ) => {
		await use( serverUrl );
	},
} );

export { expect };
