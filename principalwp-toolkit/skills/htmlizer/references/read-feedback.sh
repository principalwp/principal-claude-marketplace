#!/usr/bin/env bash
# read-feedback.sh — print htmlizer feedback submission(s) for a channel, formatted.
#
# The board-server logs every Submit as one JSON-RPC line in $LOG, and the
# Monitor notification of that line is usually truncated in delivery — so run
# this to pull the FULL, readable payload instead of hand-parsing the log.
#
# Usage:
#   references/read-feedback.sh <channel> [--all]
#     <channel>   the 16-hex CAPTURE_CHANNEL baked into this session's page(s)
#     --all       print every submission on the channel (default: latest only)
#
# Paths come from net-config.sh (same loader the server and fs-link.sh use).
# No `set -u`: net-config.sh sources the user's config file, which — like
# fs-link.sh — must tolerate a config that leaves optional keys unset.

DIR="$(cd "$(dirname "$0")" && pwd)"
. "$DIR/net-config.sh"   # sets $LOG (+ HOST/PORT/SERVE_ROOT/etc.)

CHANNEL="${1:-}"
MODE="${2:-}"
if [ -z "$CHANNEL" ]; then
  echo "usage: read-feedback.sh <channel> [--all]" >&2
  echo "  <channel> is the 16-hex CAPTURE_CHANNEL for this session (see the page's window.CAPTURE_CHANNEL)." >&2
  exit 2
fi
if [ ! -f "$LOG" ]; then
  echo "no board-server log at $LOG — nothing has been submitted yet." >&2
  exit 1
fi

ALL=0
[ "$MODE" = "--all" ] && ALL=1

# node is the last command, so its exit code becomes the script's — a clean
# non-zero on "no submissions" without needing `set -e`.
node - "$LOG" "$CHANNEL" "$ALL" <<'NODE'
const fs = require('node:fs');
const [ , , logPath, channel, allStr ] = process.argv;
const all = allStr === '1';

const subs = [];
let lastMethodParsedOk = true;   // did the most recent notification line parse?
for (const line of fs.readFileSync(logPath, 'utf8').split('\n')) {
  if (!line.includes('"method":"notifications/claude/channel"')) continue;
  const i = line.indexOf('{"jsonrpc"');
  let payload = null;
  if (i >= 0) {
    try { payload = JSON.parse(JSON.parse(line.slice(i)).params.content); } catch { payload = null; }
  }
  lastMethodParsedOk = payload !== null;               // track the newest line's fate
  if (payload && payload.channel === channel) subs.push(payload);
}

if (!subs.length) {
  console.error(`no submissions for channel ${channel} in ${logPath}`);
  process.exit(1);
}

const chosen = all ? subs : [subs[subs.length - 1]];
const s = v => (v == null ? '' : String(v));
const indent = (t, n) => s(t).replace(/\n/g, '\n' + ' '.repeat(n));

chosen.forEach((p, n) => {
  if (all) console.log(`\n===== submission ${n + 1} of ${subs.length} =====`);
  else if (subs.length > 1) console.log(`(latest of ${subs.length} submissions on this channel — run with --all to see them all)`);
  console.log(`view:     ${s(p.view)}`);
  console.log(`verdict:  ${s(p.verdict)}`);
  if (p.coverage) console.log(`coverage: ${p.coverage.engaged}/${p.coverage.total} engaged`);
  const items = p.items || [];
  console.log(`items (${items.length}):`);
  for (const it of items) {
    const val = (it.value && typeof it.value === 'object') ? JSON.stringify(it.value) : s(it.value);
    const note = it.reason || it.note || '';
    console.log(`  [${s(it.id)}] ${val}` + (note ? `\n      ${indent(note, 6)}` : ''));
  }
  console.log(`comments: ${p.comments == null ? '(none)' : p.comments}`);
});

// If the newest notification line in the log couldn't be parsed (e.g. truncated),
// the "latest" above may be a round behind — say so instead of misleading silently.
if (!lastMethodParsedOk) {
  console.error('note: the most recent notification line could not be parsed (possibly truncated) — the latest submission shown may be one round behind.');
}
NODE
