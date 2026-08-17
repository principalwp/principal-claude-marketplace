#!/usr/bin/env sh
# fs-link.sh — turn an absolute path under an allowed root into a clickable
# http:// link, served by board-server.js's /fs/<absolute-path> route (or, for a
# path under the serve root, its /s/<code> shortlink route). Also the ONE place
# that starts the board-server: it auto-starts it on every mint if it isn't
# already running, so there is nothing to manage by hand.
#
# Unlike link.sh (which serves paths relative to a single fixed board root),
# this serves arbitrary files under any of several allowed roots — e.g. so a
# file written anywhere in a session gets an openable link without being
# copied under the htmlizer serve root first.
#
# FS_ROOTS-for-linking below is a convenience mirror for validation/error
# messages only; the server enforces its own allow-list from
# HTML_SKILLS_FS_ROOTS (set from the config file's FS_ROOTS at launch, below)
# and is the actual authority — keep the two in sync.
#
# Usage:  fs-link.sh /path/to/some-project/report.md

. "$(dirname "$0")/net-config.sh"
SKILL_REFS_DIR=$(cd "$(dirname "$0")" && pwd)

# Links use a short /s/<code> form instead of embedding the whole path, so they
# never wrap across terminal lines. CODE is the first CODE_LEN chars of the
# base64url HMAC of the resolved path; fs-link.sh registers code -> path in
# FS_STORE_FILE and the server (board-server.js) looks it up, recomputes the
# HMAC, and re-verifies the code is a genuine prefix before serving. At 16
# base64url chars a code is 96 bits (~2^96 to forge one for a chosen path).
# Must stay >= the server's FS_TOKEN_MIN_LEN floor (16). Old /fs/<path>?fst=
# links still work server-side, so anything already pasted keeps resolving.
CODE_LEN=16

p="$1"
if [ -z "$p" ]; then echo "usage: fs-link.sh <absolute-path>" >&2; exit 2; fi

case "$p" in
  /*) ;;
  *) echo "fs-link.sh requires an absolute path, got: $p" >&2; exit 2;;
esac

# Reject control chars in the path: a TAB or NEWLINE would corrupt the
# code<TAB>path store format (split a line, or inject extra code->path lines),
# so refuse before signing. (nl holds a literal newline; tab a literal tab.)
nl='
'
tab=$(printf '\t')
case "$p" in
  *"$tab"*|*"$nl"*) echo "fs-link.sh: path contains a tab/newline; refusing (would corrupt the shortlink store): $p" >&2; exit 2;;
esac

# Fast-fail if this is a path board-server.js's FS_DENYLIST would refuse to serve
# anyway (secrets/creds) — so we don't hand back a link that only 403s, and don't
# record a secret's path in the store. board-server.js is the authority; keep
# this roughly in sync with its FS_DENYLIST.
if printf '%s' "$p" | grep -Eq '(^|/)\.(ssh|aws|gnupg|docker)(/|$)|(^|/)\.config/gcloud(/|$)|(^|/)\.(netrc|npmrc|pgpass|git-credentials)$|(^|/)\.env(\.|$)|_history$|(^|/)\.fs-(signing-secret|shortlinks\.tsv)(\.|$)|(^|/)\.claude/(settings[^/]*\.json|\.credentials\.json)$'; then
  echo "fs-link.sh: refusing to mint a link for a denylisted (secret/cred) path: $p" >&2; exit 2
fi

# The serve root is always linkable (the server already serves generated pages
# from there regardless of FS_ROOTS); the config file's FS_ROOTS adds any
# further opt-in roots.
LINK_ROOTS="$SERVE_ROOT $(printf '%s' "$FS_ROOTS" | tr ',' ' ')"

under_allowed_root=0
for root in $LINK_ROOTS; do
  [ -n "$root" ] || continue
  case "$p" in
    "$root" | "$root"/*) under_allowed_root=1; break ;;
  esac
done
if [ "$under_allowed_root" -ne 1 ]; then
  printf '%s\n' "NOT-SERVED: $p is not under any allowed root ($LINK_ROOTS) — no http link." >&2
  exit 1
fi

# ---------- ensure the board-server is up (auto-start) ----------------------
# Probe semantics: ANY HTTP response (including a 403) means up; connection
# refused / timeout means down. Never key this on status 200 — the static
# route 403s without the /s/ cookie, and that is still "up".
probe_up() {
  node -e '
    const http = require("node:http");
    const req = http.get({ host: process.argv[1], port: process.argv[2], path: "/", timeout: 1500 }, res => { res.resume(); process.exit(0); });
    req.on("timeout", () => { req.destroy(); process.exit(1); });
    req.on("error", () => { process.exit(1); });
  ' "$HOST" "$PORT" 2>/dev/null
}

if ! command -v node >/dev/null 2>&1; then
  echo "fs-link.sh: node is required to run htmlizer's board-server but was not found on PATH — install Node.js >= 16 and try again" >&2
  exit 4
fi

if ! probe_up; then
  mkdir -p "$SERVE_ROOT" "$STATE_DIR" 2>/dev/null || {
    echo "fs-link.sh: could not create state dirs under $STATE_DIR" >&2; exit 5;
  }
  # setsid (not just backgrounding) so the daemon survives this script's own
  # process group exiting; </dev/null plus redirecting both streams to $LOG
  # means the Monitor + token grep always have a file to read.
  HTML_SKILLS_CHANNEL_HOST="$HOST" \
  HTML_SKILLS_LINK_HOST="$LINK_HOST" \
  HTML_SKILLS_CHANNEL_PORT="$PORT" \
  HTML_SKILLS_SERVE_ROOT="$SERVE_ROOT" \
  HTML_SKILLS_FS_ROOTS="$FS_ROOTS" \
  HTML_SKILLS_ALLOWED_HOSTS="$ALLOWED_HOSTS" \
  HTML_SKILLS_FS_SECRET_FILE="$FS_SECRET_FILE" \
  HTML_SKILLS_FS_STORE_FILE="$FS_STORE_FILE" \
  setsid node "$SKILL_REFS_DIR/board-server.js" </dev/null >>"$LOG" 2>&1 &
  disown 2>/dev/null || true

  up=0
  i=0
  while [ "$i" -lt 25 ]; do  # ~5s total (25 * 0.2s)
    if probe_up; then up=1; break; fi
    i=$((i + 1))
    sleep 0.2
  done
  if [ "$up" -ne 1 ]; then
    # Losing an EADDRINUSE race to another process that then dies too, a
    # crashed node, a bad secret file, etc. all land here. Never print a link
    # that won't serve.
    echo "fs-link.sh: board-server did not come up at http://${HOST}:${PORT}/ after ~5s — check $LOG" >&2
    exit 6
  fi
  # An EADDRINUSE race we lost, but where SOMEONE's server answers the probe
  # (ours or the winner's), is success — proceed either way.
fi

# ---------- sign + register the path, mint the /s/<code> link ---------------
[ -r "$FS_SECRET_FILE" ] || { echo "fs-link.sh: signing secret unreadable: $FS_SECRET_FILE" >&2; exit 3; }
# Sign with a node one-liner, not `openssl -hmac`, so the secret never appears
# in this (or any) process's argv — argv is readable by any local user via
# /proc/<pid>/cmdline where hidepid isn't set. The secret is read from the file
# INSIDE node; only the non-secret path is passed as an argument. node's
# path.resolve also normalizes the path lexically (no symlink deref) the same
# way board-server.js's serveFs does, so trailing slashes / '.' / '..' can't
# cause a signature mismatch against what the server computes.
CODE=$(FS_SECRET_FILE="$FS_SECRET_FILE" FS_STORE_FILE="$FS_STORE_FILE" node -e '
  const fs = require("fs"), path = require("path"), crypto = require("crypto");
  const secret = fs.readFileSync(process.env.FS_SECRET_FILE, "utf8").trim();
  const target = path.resolve("/", process.argv[1]);
  const len = Number(process.argv[2]) || 16;
  const digest = crypto.createHmac("sha256", secret).update(target).digest("base64url");
  // Terminals auto-linkify a URL but drop a trailing "-" (some also drop "_"),
  // silently truncating /s/<code> and 404ing. The code is a prefix of the digest
  // and the server accepts any genuine prefix >= 16 chars, so grow the slice by
  // one until it no longer ends in "-"/"_". Interior "-"/"_" are safe — only a
  // trailing one is trimmed. (~3% of codes; markdown /s/<code>.md is already immune.)
  let end = len;
  while (end < digest.length && (digest[end - 1] === "-" || digest[end - 1] === "_")) end++;
  const code = digest.slice(0, end);
  // Register code -> path so the server can resolve /s/<code>. Idempotent:
  // append the line only if this code is not already present. A code that
  // already maps to a DIFFERENT path is a (astronomically unlikely at 96-bit)
  // truncation collision — fail loudly rather than mint a wrong/broken link.
  const store = process.env.FS_STORE_FILE;
  const line = code + "\t" + target;
  let existing = "";
  try { existing = fs.readFileSync(store, "utf8"); } catch (e) { if (e.code !== "ENOENT") throw e; }
  const hit = existing.split("\n").find(l => { const t = l.indexOf("\t"); return t >= 0 && l.slice(0, t) === code; });
  if (hit) {
    if (hit !== line) { process.stderr.write("shortcode collision for " + code + "\n"); process.exit(4); }
  } else {
    try { process.umask(0o077); } catch (e) {}          // owner-only store
    fs.appendFileSync(store, line + "\n", { mode: 0o600 });
    try { fs.chmodSync(store, 0o600); } catch (e) {}     // belt-and-suspenders vs a permissive umask/ACL on first create
  }
  process.stdout.write(code);
' "$p" "$CODE_LEN") || { echo "fs-link.sh: failed to sign/register path" >&2; exit 3; }

# For markdown targets, append a cosmetic .md after the shortcode so the link
# ends in .md; board-server.js's serveShort strips it back off before resolving
# the code. Only .md files get it (matches the server's markdown MIME entry).
md=""
case "$p" in *.md) md=".md" ;; esac

# LINK_HOST (resolved in net-config.sh) is the address a human clicks, which is
# NOT always the address the server binds. Never print $HOST here: under a
# wildcard bind that mints "http://0.0.0.0:PORT/…", a dead link the caller is
# then told by every doc in this skill not to repair by hand.
#
# When the bind is a wildcard and no LINK_HOST was configured, the link falls
# back to loopback and only works on this machine — say so on stderr rather than
# letting someone discover it when the page won't open on their laptop. stderr,
# so stdout stays exactly the link and callers can keep using "$(fs-link.sh …)".
if [ "${LINK_HOST_DERIVED:-0}" = "1" ]; then
  echo "fs-link.sh: HOST is a wildcard bind ($HOST) and LINK_HOST is unset, so this link uses 127.0.0.1 and only opens ON this machine. To hand it to another device, set LINK_HOST=<the address you reach this box by> in $CONFIG_FILE, then restart the server by PORT: fuser -k ${PORT}/tcp  (never 'pkill -f board-server.js' — it also matches the shell running it and any second instance)" >&2
fi
printf '%s\n' "http://${LINK_HOST}:${PORT}/s/${CODE}${md}"

# ---------- retention: prune stale serve-root output on every successful mint
# Hard guards first — never run the finds unless SERVE_ROOT is non-empty,
# absolute, not "/", and an existing directory.
case "$SERVE_ROOT" in
  /) ;;                                    # never operate on the filesystem root
  /*)
    if [ -n "$SERVE_ROOT" ] && [ -d "$SERVE_ROOT" ]; then
      find "$SERVE_ROOT" -mindepth 1 -maxdepth 1 -type d ! -name assets -mtime +30 -exec rm -rf {} + 2>/dev/null
      find "$SERVE_ROOT" -mindepth 1 -maxdepth 1 -type f -name '*.html' -mtime +30 -exec rm -f {} + 2>/dev/null
    fi
    ;;
  *) ;;                                    # not absolute — refuse
esac

exit 0
