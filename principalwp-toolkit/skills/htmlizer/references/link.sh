#!/usr/bin/env sh
# link.sh — compat shim. Every link is minted by fs-link.sh as a short /s/<code>
# URL, and board-server.js streams any code that resolves under the serve root in
# place; pages reference their assets root-absolute (/assets/base.css,
# /assets/capture.js, /assets/fonts, /assets/vendor) so they load regardless of
# the /s/<code> address bar. This shim exists only so older callers of link.sh
# keep working — new callers should invoke fs-link.sh directly.
exec "$(dirname "$0")/fs-link.sh" "$@"
