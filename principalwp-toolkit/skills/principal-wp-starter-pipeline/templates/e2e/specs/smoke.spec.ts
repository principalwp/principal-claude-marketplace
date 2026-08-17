import { test, expect } from '../fixtures';

/**
 * Setup-time smoke test — proves the whole E2E chain actually boots:
 * Playground server up, WordPress installed, the run's components mounted
 * and activated, wp-admin reachable. `setup.mjs` runs this once at install
 * time. It also runs again as part of the closeout `npm run test:e2e` full
 * suite — that command globs every spec under specs/, this one included —
 * which is harmless, it's cheap and re-checks the same chain.
 *
 * Kept deliberately type-agnostic: it asserts only that wp-admin loads, so
 * it holds whether the run's component is a plugin, a theme, or mu-plugins.
 */
test.describe( 'Setup smoke test', () => {
	test( 'WP admin dashboard loads', async ( { page, serverUrl } ) => {
		// domcontentloaded, not the default 'load'/networkidle — WordPress's
		// block editor keeps network activity alive indefinitely under
		// Playground, so a networkidle wait never resolves here.
		await page.goto( `${ serverUrl }/wp-admin/`, { waitUntil: 'domcontentloaded' } );
		await expect( page.locator( '#wpadminbar' ) ).toBeVisible();
	} );
} );
