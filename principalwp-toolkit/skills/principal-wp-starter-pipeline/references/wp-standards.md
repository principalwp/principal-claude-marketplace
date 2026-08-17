# WP Standards — security, i18n, caching, cleanup, blocks

The six non-negotiable security rules, plus the i18n, caching, and cleanup rules — read by the
Code agent (build and fixer mode), the correctness and security reviewers, and the spec agent when
finalizing ACs.

## The six security rules (non-negotiable)

1. **Nonce + capability — both, always.** A valid nonce proves the request came from your own
   form/page; it is **not** authorization. Every state-changing handler needs `current_user_can()`
   (or an equivalent capability check) in addition to the nonce check, not instead of it.
2. **Sanitize in, escape out — by context.** Sanitize with the function matching the data's shape
   (`sanitize_text_field()`, `sanitize_email()`, `absint()`, …) at the point you accept input.
   Escape with the function matching the *output* context (`esc_html()`, `esc_attr()`, `esc_url()`,
   `esc_js()`) at the point you print — a generic escape at accept-time is not a substitute.
3. **`wp_unslash()` + explicit keys.** Unslash any `$_POST`/`$_GET`/`$_REQUEST` value before
   sanitizing — WP adds slashes to superglobals. Read specific, named keys; never iterate or trust
   arbitrary keys supplied by the request.
4. **`$wpdb->prepare()` on every query with a variable** — including identifiers, via the `%i`
   placeholder (WP 6.2+). Never string-concatenate a table or column name into SQL.
5. **Server-side enforcement is mandatory.** If the spec defines a constraint (min/max counts,
   required fields, format rules), enforce it in the save/update handler. Client-side validation
   improves UX; it is not a security boundary.
6. **Secrets live in env vars or `wp-config.php` constants — never in `wp_options`.** Anything in
   `wp_options` is readable by any code with DB access and is a routine target for options-dumping
   bugs. **Rule #6 is the one rule with a narrow, documented exception** — the other five admit
   none, ever: a violation of #1–#5 is a Critical the spec must design around, and no AC may state
   an accepted deviation from them. For #6 only, a deviation is allowed when the dev genuinely
   cannot use env vars or `wp-config.php` (e.g. a third-party API key entered through wp-admin on
   managed hosting where the dev can't edit `wp-config.php`). Taking it requires an AC that states
   both (a) why env vars/`wp-config.php` aren't usable and (b) a mitigation — capability-gated
   access and encryption at rest, not a plain `wp_options` write — and the deviation must be
   surfaced at the human gate (called out in the AC and/or Open Questions).

## i18n

- Use `_n()` for any user-facing string that includes a count, even when the English singular and
  plural read identically ("%d min read") — other languages still need the plural hook.

## Data lifecycle

- Every `add_option()` / `update_option()` needs a matching `delete_option()` in `uninstall.php`.
  Grep the plugin for every option write and confirm cleanup exists before calling a feature done.
- Never bypass a class's `save()` method with a direct `update_post_meta()` / `update_option()` —
  it skips whatever validation or side effects `save()` performs. Add a narrow public method on
  the owning class that calls `save()` internally instead.
- Never ship a stub or placeholder (hardcoded return, empty function) for a spec-required feature.
  If you genuinely can't implement something, say so — don't ship code that silently does nothing.

## Caching in render paths

- Cache **computed output**, not data WordPress already caches. A plain `get_post_field()` call is
  already cached by core — don't wrap it. Cache the work you do *after* fetching (regex, string
  processing, aggregation) only when that work is non-trivial.
- Prefer post meta (written on `save_post`) over runtime object-cache for post-specific computed
  values — it's fetched in the same batch as the rest of the post's data, no extra cache round trip.

## Frontend data delivery

- A frontend component that renders for logged-out visitors cannot call a REST route whose
  `permission_callback` requires a capability. Embed the data at PHP render time instead —
  `data-*` attributes or a `<script type="application/json">` tag — and check every frontend JS
  feature against the endpoint's `permission_callback` before wiring it up.

## Dynamic blocks

- See `block-guide.md`'s "Dynamic, always" section — every custom block must be dynamic.

## Editor states

- See `block-guide.md`'s "The three editor states" section.
