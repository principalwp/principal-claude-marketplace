import { defineConfig, devices } from '@playwright/test';

/**
 * Playwright configuration for WordPress E2E tests against WP Playground.
 *
 * Uses @wp-playground/cli programmatically (via fixtures.ts) rather than
 * Playwright's `webServer` config — Playground returns 302 on every route
 * while it's still booting, so a `webServer.url` readiness poll never
 * resolves and the run hangs. `runCLI()` in fixtures.ts returns a
 * `serverUrl` directly once the server is actually up.
 *
 * WASM overhead: Playground runs PHP compiled to WebAssembly, roughly 3-6x
 * slower than native PHP. Timeouts below are set accordingly — do not tune
 * them down to "normal" Playwright defaults.
 */
export default defineConfig( {
	testDir: './specs',
	outputDir: './test-results',
	fullyParallel: false,
	forbidOnly: !! process.env.CI,
	retries: process.env.CI ? 2 : 0,
	workers: 1,
	timeout: 120_000,
	expect: { timeout: 30_000 },

	reporter: process.env.CI
		? [ [ 'github' ], [ 'html', { open: 'never', outputFolder: './playwright-report' } ] ]
		: [ [ 'html', { outputFolder: './playwright-report' } ] ],

	use: {
		screenshot: 'only-on-failure',
		trace: 'on-first-retry',
		actionTimeout: 30_000,
		navigationTimeout: 60_000,
	},

	projects: [
		{
			name: 'chromium',
			use: {
				...devices[ 'Desktop Chrome' ],
				launchOptions: {
					args: [ '--enable-experimental-webassembly-jspi' ],
				},
			},
		},
		// WebKit and Firefox are intentionally not configured — WebKit is
		// disabled by the Playground team's own CI (flaky against Playground),
		// and a second browser adds run time for a teaching starter without
		// adding coverage that matters here. Chromium only.
	],
} );
