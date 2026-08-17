#!/usr/bin/env node
/**
 * board-server.js — derived from f-labs-io/agent-html-skills server.js
 * (MIT, commit 76e5c6e), patched for a split server/browser topology.
 *
 * Original is a loopback-only POST submit-receiver. This version:
 *   1. Binds to a configurable host (HTML_SKILLS_CHANNEL_HOST) so the board can
 *      be reached from a different machine over a configurable non-loopback
 *      host — NOT just 127.0.0.1. Loopback is the default.
 *   2. Adds a GET route that serves the board .html from HTML_SKILLS_SERVE_ROOT,
 *      so the open-link is a clickable http:// URL (terminals block file://).
 *   3. Relaxes the Host-header allowlist to include the bound host.
 *   4. Keeps the original POST submit flow: token-gated, size-capped, emitted as
 *      a JSON-RPC notification on stdout for Monitor to forward to the agent.
 *   5. Adds a second GET route, /fs/<absolute-path>, for serving arbitrary files
 *      (not just the htmlizer board) under an allow-list of roots
 *      (HTML_SKILLS_FS_ROOTS) — e.g. so any file written during a session can get
 *      a clickable link without living under HTML_SKILLS_SERVE_ROOT. See fs-link.sh.
 *
 * Security note: binding off-loopback widens exposure from this-machine-only to
 * anything that can reach the bound interface. If you must bind non-loopback,
 * prefer a private VPN IP over 0.0.0.0 to keep the blast radius small.
 * The per-session ?t= nonce still gates every POST. Of the three GET routes:
 * /fs/<path> requires a per-path HMAC (?fst=, floor FS_TOKEN_MIN_LEN chars of
 * hex) checked against FS_SECRET; /s/<code> is self-authenticating (the code
 * itself is a truncated HMAC of its target path, re-verified on lookup) and,
 * when the target is under SERVE_ROOT, is streamed in place carrying a
 * Set-Cookie; the plain static route (serveStatic — everything else under
 * SERVE_ROOT) requires that same cookie, so it's no longer an unauthenticated
 * read — only a browser that already opened a valid /s/ link has it. Only
 * add /fs/ roots you're fine exposing, per-link, to every peer that can reach
 * the bound host.
 *
 * Zero runtime dependencies.
 */
'use strict';

const http = require('node:http');
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');

const PORT = parseInt(process.env.HTML_SKILLS_CHANNEL_PORT || '26537', 10);
const HOST = process.env.HTML_SKILLS_CHANNEL_HOST || '127.0.0.1';
// The address that goes in a LINK, which is not always the address we bind:
// a wildcard HOST listens everywhere but "http://0.0.0.0:PORT/" is not a
// destination. fs-link.sh resolves this in net-config.sh and passes it down so
// the server's own log can't advertise an address nobody can open. Absent (e.g.
// the systemd unit, which binds a real IP), the bind host IS the link host.
const LINK_HOST = process.env.HTML_SKILLS_LINK_HOST || HOST;
// XDG state dir default — must match net-config.sh's STATE_DIR expression
// exactly (${XDG_STATE_HOME:-$HOME/.local/state}/htmlizer) so a bare
// `node board-server.js` serves the SAME dir fs-link.sh computes.
const STATE_DIR = path.join(process.env.XDG_STATE_HOME || path.join(os.homedir(), '.local', 'state'), 'htmlizer');
const SERVE_ROOT = path.resolve(process.env.HTML_SKILLS_SERVE_ROOT || path.join(STATE_DIR, 'serve')); // GET static root
// Real (symlink-resolved) SERVE_ROOT, computed once at startup — serveStatic
// checks the REQUESTED path's realpath against this, not against SERVE_ROOT
// itself, so a symlink planted inside SERVE_ROOT can't point outside it and
// still pass containment. Falls back to SERVE_ROOT if the
// dir doesn't exist yet at boot (realpathSync throws ENOENT); the per-request
// realpath check in serveStatic still 404s a request in that case.
let SERVE_ROOT_REAL;
try { SERVE_ROOT_REAL = fs.realpathSync(SERVE_ROOT); } catch (e) { SERVE_ROOT_REAL = SERVE_ROOT; }
// /fs/ route allow-list — comma-separated absolute paths. Empty by
// default, so the /fs/ route 403s everything unless explicitly configured.
const FS_ROOTS = (process.env.HTML_SKILLS_FS_ROOTS || '')
  .split(',').map(s => s.trim()).filter(Boolean).map(p => path.resolve(p));
const TOKEN = process.env.HTML_SKILLS_CHANNEL_TOKEN || crypto.randomBytes(16).toString('hex');
const MAX_BODY_BYTES = 256 * 1024;

// PATCH: static-route cookie gate. Independent random value, generated fresh
// every boot — unrelated to TOKEN (POST auth) and FS_SECRET (/fs/, /s/ auth).
// serveShort sets this as a cookie ONLY on the 200 it streams in place after a
// /s/ code's HMAC already checked out; serveStatic then requires the cookie for every
// other GET under SERVE_ROOT. Never logged — do not add a log line for this
// (see the startup log() calls below, which log TOKEN but must not log this).
const STATIC_COOKIE_VALUE = crypto.randomBytes(16).toString('hex');
const STATIC_COOKIE_NAME = 'htmlizer_static';

// PATCH: /fs/ per-link auth. Dedicated persistent secret (NOT the POST TOKEN
// above) for signing /fs/ URLs, so a path under FS_ROOTS is only servable if
// fs-link.sh actually minted a link for it. Lives under the XDG state dir,
// outside the serve root (so it's never reachable via the static/`/fs/`
// routes — see the denylist below) and outside any git-tracked directory.
// Path kept in sync with net-config.sh's FS_SECRET_FILE (sh can't require()
// this file, so the value is duplicated there — same pattern already used for
// FS_ROOTS). Overridable via HTML_SKILLS_FS_SECRET_FILE so the integration
// test can point at a throwaway secret instead of the real one; default is
// unchanged so normal behavior is identical.
const FS_SECRET_FILE = process.env.HTML_SKILLS_FS_SECRET_FILE || path.join(STATE_DIR, '.fs-signing-secret');
function loadOrCreateFsSecret() {
  try {
    return fs.readFileSync(FS_SECRET_FILE, 'utf8').trim();
  } catch (e) {
    if (e.code !== 'ENOENT') throw e;
  }
  // Write-then-link, not open('wx') directly on FS_SECRET_FILE: writing the
  // fresh secret to a private per-pid temp file first, then publishing it
  // with an atomic link(), means FS_SECRET_FILE never exists in a
  // partially-written state. A plain open('wx')+write()+close() on the final
  // path has a window where a losing process's EEXIST-triggered read could
  // observe a zero-byte file (open() succeeds before write() lands) — this
  // avoids that race entirely rather than just catching the crash.
  // mkdirSync first: a fresh install's state dir may not exist yet (fs-link.sh's
  // auto-start already mkdir -p's it, but a bare/manual `node board-server.js`
  // run before that has ever happened must not crash here).
  fs.mkdirSync(path.dirname(FS_SECRET_FILE), { recursive: true });
  const tmp = `${FS_SECRET_FILE}.${process.pid}.tmp`;
  // mode 0o600: owner-only (single-user default). link() below publishes this
  // same inode, so the mode set here is the mode that lands.
  fs.writeFileSync(tmp, crypto.randomBytes(32).toString('hex') + '\n', { mode: 0o600, flag: 'wx' });
  try {
    fs.linkSync(tmp, FS_SECRET_FILE); // atomic publish — EEXIST means another process already won
  } catch (e) {
    if (e.code !== 'EEXIST') throw e;
  } finally {
    fs.unlinkSync(tmp); // safe either way: on success this just drops our private name, the data lives on via FS_SECRET_FILE
  }
  return fs.readFileSync(FS_SECRET_FILE, 'utf8').trim();
}
const FS_SECRET = loadOrCreateFsSecret(); // never logged (see log() calls below) — do not add a log line that includes this value
// PATCH: /s/ shortlink store — maps a short base64url code -> the absolute path
// fs-link.sh minted it for, so a link can be /s/<code> instead of embedding the
// whole path (which wraps across terminal lines). fs-link.sh is the only writer
// (appends `code<TAB>path`); this server only reads. Lives under the XDG state
// dir beside the signing secret. Path duplicated in net-config.sh's
// FS_STORE_FILE — sh can't require() this file — keep them in sync.
// Overridable via HTML_SKILLS_FS_STORE_FILE — same reason as FS_SECRET_FILE
// above; default unchanged.
const FS_STORE_FILE = process.env.HTML_SKILLS_FS_STORE_FILE || path.join(STATE_DIR, '.fs-shortlinks.tsv');
// allow the bound host, the host we tell people to open (LINK_HOST — a page
// served at that address posts back to it, so excluding it would 403 every
// submit), plus any additional addresses. HTML_SKILLS_ALLOWED_HOSTS
// (comma-separated) extends this — only needed for an address that is neither
// HOST nor LINK_HOST. LINK_HOST belongs in this Set rather than being folded in
// by the caller, so EVERY launch path (fs-link.sh, the README's manual
// foreground command, a systemd unit) gets it right without remembering to.
const ENV_ALLOWED = (process.env.HTML_SKILLS_ALLOWED_HOSTS || '')
  .split(',').map(s => s.trim()).filter(Boolean);
const ALLOWED_HOSTS = new Set([
  '127.0.0.1', 'localhost', HOST, LINK_HOST,
  ...ENV_ALLOWED
]);

function tokenMatches(presented) {
  if (typeof presented !== 'string') return false;
  const a = Buffer.from(presented);
  const b = Buffer.from(TOKEN);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

// PATCH: static-route cookie gate — constant-time full-value compare, same
// shape as tokenMatches above (length-checked first so timingSafeEqual never
// throws on mismatched lengths; this is a full-value compare, not a prefix
// compare like fsTokenMatches below — the cookie isn't meant to be shortened).
function staticCookieMatches(req) {
  const header = req.headers['cookie'] || '';
  let presented = null;
  for (const part of header.split(';')) {
    const eq = part.indexOf('=');
    if (eq < 0) continue;
    if (part.slice(0, eq).trim() === STATIC_COOKIE_NAME) { presented = part.slice(eq + 1).trim(); break; }
  }
  if (typeof presented !== 'string') return false;
  const a = Buffer.from(presented);
  const b = Buffer.from(STATIC_COOKIE_VALUE);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

// PATCH: /fs/ per-link auth — like tokenMatches above (constant-time compare
// against the per-path HMAC), but accepts a *prefix* of the full 64-char hex so
// links can be shortened. fs-link.sh now emits only the first FS_TOKEN_MIN_LEN
// hex chars; older links carrying the full 64-char hash still verify because a
// string is a prefix of itself. The presented length (attacker-chosen, not
// secret) sets how many chars are compared, so FS_TOKEN_MIN_LEN is the real
// security floor: at 16 hex chars an attacker must brute-force ~2^64 HMAC
// prefixes for one chosen path to forge a token. Keep client emit-length >= this
// floor; shortening the floor weakens every link, so change it deliberately.
// This same prefix-compare also backs the /s/ shortlink route (serveShort), where
// the digest is base64url instead of hex — 96 bits at 16 chars vs hex's 64.
const FS_TOKEN_MIN_LEN = 16;
function fsTokenMatches(presented, expectedHex) {
  if (typeof presented !== 'string') return false;
  const n = presented.length;
  if (n < FS_TOKEN_MIN_LEN || n > expectedHex.length) return false;
  const a = Buffer.from(presented);
  const b = Buffer.from(expectedHex.slice(0, n)); // compare against the first n hex chars
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

function log(s) { process.stderr.write(`[board-server] ${s}\n`); }
function notify(method, params) { process.stdout.write(JSON.stringify({ jsonrpc: '2.0', method, params }) + '\n'); }

// Content-Type by extension. Only Markdown, JSON, and image files get a
// specific type; every other extension (and unknown ones) falls through to
// DEFAULT_MIME and is served as UTF-8 text/plain, so arbitrary session files
// (.txt/.log/.py/.yaml/.csv/...) render inline in the browser instead of
// prompting a download. The board's own framework assets (.html/.css/.js and
// fonts) keep their real types because board pages served from SERVE_ROOT
// cannot render without them.
const DEFAULT_MIME = 'text/plain; charset=utf-8';
const MIME = {
  // board framework — real types required or board pages won't render
  '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.woff2': 'font/woff2', '.woff': 'font/woff', '.ttf': 'font/ttf',
  // markdown — tell the browser it's markdown, not generic text
  '.md': 'text/markdown; charset=utf-8',
  // json
  '.json': 'application/json; charset=utf-8',
  // images
  '.svg': 'image/svg+xml', '.png': 'image/png', '.ico': 'image/x-icon',
  '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.gif': 'image/gif',
  '.webp': 'image/webp', '.avif': 'image/avif',
  // pdf — keep the browser's built-in inline PDF viewer
  '.pdf': 'application/pdf',
};

function isUnderAnyRoot(target, roots) {
  return roots.some(root => target === root || target.startsWith(root + path.sep));
}

// defense-in-depth for the /fs/ route — never serve well-known
// credential/secret paths even if they fall under an allowed root. This is
// NOT exhaustive; the real security boundary is "don't add a root you
// wouldn't want exposed, unauthenticated, to anything that can reach the
// bound host."
const FS_DENYLIST = [
  /(^|\/)\.ssh(\/|$)/, /(^|\/)\.aws(\/|$)/, /(^|\/)\.gnupg(\/|$)/,
  /(^|\/)\.netrc$/, /(^|\/)\.git-credentials$/, /(^|\/)\.docker(\/|$)/,
  /(^|\/)\.config\/gcloud(\/|$)/, /(^|\/)\.npmrc$/, /(^|\/)\.pgpass$/,
  /(^|\/)\.env(\.|$)/, /_history$/,
  /(^|\/)\.claude\/(settings[^/]*\.json|\.credentials\.json)$/,
  /(^|\/)\.fs-signing-secret(\.|$)/, // the /fs/ signing secret AND its .<pid>.tmp generation artifacts — never servable
  /(^|\/)\.fs-shortlinks\.tsv(\.|$)/, // the /s/ code->path store: each line is a live capability, so never servable via /fs/ or /s/
  /(^|\/)\.board-server\.log(\.|$)/, // the daemon's own stdout/stderr log — historically contained the POST submit TOKEN; kept outside SERVE_ROOT too (belt and suspenders, see PATCH below)
];
function isDenied(target) { return FS_DENYLIST.some(re => re.test(target)); }

// ---------- shared tail for the file-serving routes: given an already-resolved
// absolute path that the caller has ALREADY authenticated (via ?fst= for /fs/ or
// the shortcode HMAC for /s/), apply the allow-list + denylist + realpath gates
// and stream the file. One copy so both routes get identical, independent path
// checks — authentication never lets a request skip the realpath/denylist recheck.
function serveTarget(res, target, uniform404) {
  // /s/ passes uniform404 so an authorization rejection is an indistinguishable
  // 404 (see serveShort) rather than a 403 that would confirm a code maps to a
  // denylisted/out-of-root path. /fs/ leaves it falsy and keeps the explicit 403s.
  const forbid = uniform404
    ? () => { res.writeHead(404, { 'Content-Type': 'text/plain' }); res.end('not found'); }
    : (msg) => { res.writeHead(403); res.end(msg); };
  if (!isUnderAnyRoot(target, FS_ROOTS) || isDenied(target)) {
    forbid('forbidden: not under an HTML_SKILLS_FS_ROOTS entry\n'); return;
  }
  // re-check the REALPATH (after symlink resolution) too — a symlink
  // planted under an allowed root (e.g. by another process with write access
  // there) can otherwise point anywhere readable on disk and would be served
  // as if it were in-root. fs.realpath/readFile throw SYNCHRONOUSLY on a
  // malformed path (e.g. an embedded null byte), so both are try/catch-guarded
  // — an uncaught throw here would otherwise crash the whole daemon on one bad
  // request (confirmed empirically; not hypothetical).
  try {
    fs.realpath(target, (err, real) => {
      if (err) { res.writeHead(404, { 'Content-Type': 'text/plain' }); res.end('not found'); return; }
      if (!isUnderAnyRoot(real, FS_ROOTS) || isDenied(real)) {
        forbid('forbidden: resolves outside the allow-list\n'); return;
      }
      try {
        fs.readFile(real, (err2, buf) => {
          if (err2) { res.writeHead(404, { 'Content-Type': 'text/plain' }); res.end('not found'); return; }
          res.writeHead(200, { 'Content-Type': MIME[path.extname(real).toLowerCase()] || DEFAULT_MIME });
          res.end(buf);
        });
      } catch (e) { res.writeHead(400); res.end('bad path\n'); }
    });
  } catch (e) { res.writeHead(400); res.end('bad path\n'); }
}

// ---------- GET /fs/<absolute-path>: serve any file under HTML_SKILLS_FS_ROOTS
function serveFs(req, res, pathname) {
  const rest = pathname.slice('/fs/'.length);
  if (!rest) { res.writeHead(400); res.end('usage: /fs/<absolute-path-without-leading-slash>\n'); return; }
  const target = path.resolve('/', rest); // normalizes '..' before the allow-list check runs
  // PATCH: per-link auth — a request is only served if it carries the HMAC
  // fs-link.sh computed for this exact (normalized) path. Checked before the
  // allow-list/denylist/realpath logic in serveTarget, which stays a second,
  // independent gate (a valid token doesn't skip the realpath/denylist recheck).
  let presentedFst = null;
  try { presentedFst = new URL(req.url, 'http://x').searchParams.get('fst'); } catch (e) {}
  const expectedFst = crypto.createHmac('sha256', FS_SECRET).update(target).digest('hex');
  if (!fsTokenMatches(presentedFst, expectedFst)) {
    res.writeHead(403); res.end('forbidden: missing or invalid fs token\n'); return;
  }
  serveTarget(res, target);
}

// ---------- GET /s/<code>: serve a file via a short base64url code that
// fs-link.sh registered (code -> absolute path) in FS_STORE_FILE. Lets a link be
// /s/<16 chars> instead of embedding the whole path, so it never wraps in a
// terminal. The code IS the truncated HMAC of the path, so this route is exactly
// as strong as /fs/'s ?fst=: look the path up, then recompute its HMAC and require
// the code to be a genuine prefix. That recompute is load-bearing, not cosmetic —
// without it anyone able to add a line (code<TAB>/some/path) to FS_STORE_FILE
// would get an arbitrary read of any non-denylisted file under an allowed root;
// forging a code that prefixes HMAC(path) still needs the signing secret. Every
// auth rejection collapses to an identical 404 (via serveTarget's uniform404) so
// /s/ is not an existence/authorization oracle.
let shortStoreCache = { mtimeMs: -1, map: new Map() };
function lookupShort(code) {
  let st;
  try { st = fs.statSync(FS_STORE_FILE); } catch (e) { return null; } // no store yet
  if (st.mtimeMs !== shortStoreCache.mtimeMs) {
    // re-parse only when the file actually changed (mtime); a stat per request is
    // negligible at personal volume and keeps the lookup synchronous+simple.
    const map = new Map();
    let text = '';
    try { text = fs.readFileSync(FS_STORE_FILE, 'utf8'); } catch (e) { return null; }
    for (const line of text.split('\n')) {
      const tab = line.indexOf('\t');
      if (tab < 0) continue;
      const c = line.slice(0, tab);
      if (!map.has(c)) map.set(c, line.slice(tab + 1)); // first line wins (matches fs-link.sh's idempotent append)
    }
    shortStoreCache = { mtimeMs: st.mtimeMs, map };
  }
  return shortStoreCache.map.get(code) || null;
}
function serveShort(req, res, pathname) {
  let code = pathname.slice('/s/'.length);
  // fs-link.sh appends a cosmetic ".md" after the shortcode for markdown targets
  // so the link ends in .md (nicer "Save As" filename; extension-sniffing tools
  // recognize it). A base64url code never contains a dot, so a trailing .md is
  // always that suffix — strip it before the charset check and store lookup.
  if (code.endsWith('.md')) code = code.slice(0, -3);
  // base64url charset + length bound: reject junk before touching the store.
  if (!/^[A-Za-z0-9_-]{16,64}$/.test(code)) { res.writeHead(404, { 'Content-Type': 'text/plain' }); res.end('not found'); return; }
  const target = lookupShort(code);
  if (target === null) { res.writeHead(404, { 'Content-Type': 'text/plain' }); res.end('not found'); return; }
  const expected = crypto.createHmac('sha256', FS_SECRET).update(target).digest('base64url');
  if (!fsTokenMatches(code, expected)) { res.writeHead(404, { 'Content-Type': 'text/plain' }); res.end('not found'); return; }
  // PATCH: a target under SERVE_ROOT is streamed IN PLACE at /s/<code> (no
  // redirect), with the static-route cookie set on the 200. Pages reference
  // their assets by ROOT-ABSOLUTE url (/assets/base.css, /assets/capture.js,
  // /assets/fonts/..., /assets/vendor/...), so those fetches resolve against the
  // serve root regardless of the /s/<code> address bar and carry the cookie
  // serveStatic requires. Streaming in place (vs the old 302 to the real path)
  // keeps window.location.href = the short /s/<code> url, so capture.js's
  // meta.href records the short link, never the resolved long real path — that
  // post-redirect long url was the whole source of the leak back through the
  // feedback log. The cookie is set here, after the HMAC check above already
  // passed, so it only ever reaches a browser that presented a valid /s/ code.
  if (target === SERVE_ROOT || target.startsWith(SERVE_ROOT + path.sep)) {
    serveStaticFile(res, target, true);
    return;
  }
  serveTarget(res, target, true); // out-of-root: uniform404, no cookie (standalone page, no /assets/ deps)
}

// Stream a file already confirmed to lie lexically under SERVE_ROOT. Re-checks
// the REALPATH + denylist + isFile against SERVE_ROOT_REAL — a symlink planted
// in-root (by any process with write access there) can point anywhere readable
// on disk; the caller's lexical guard only catches '..' in the requested path,
// not an in-root symlink resolving elsewhere. Every failure collapses to the
// same 404 as a missing file — do NOT distinguish, so this never becomes an
// existence oracle. fs.realpath/stat/readFile throw SYNCHRONOUSLY on a malformed
// path (e.g. an embedded null byte); each is try/catch-guarded — an uncaught
// throw would crash the whole daemon on one bad request.
//
// KNOWN RESIDUAL (accepted, not fixed): realpath resolves SYMLINKS but not
// HARDLINKS, so an in-root hardlink to an out-of-root file still serves it. Left
// open deliberately: many Linux systems run fs.protected_hardlinks=1 by default,
// in which case a user can only hardlink a file they already own or can write —
// no read they didn't already have. If that sysctl is disabled on your system,
// or FS_ROOTS widens, add a `st.nlink === 1` check to the stat gate (all
// legitimate serve-root files are single-link).
//
// setCookie: when true the 200 also carries the static-route cookie — used when
// a /s/<code> for an in-root page is streamed in place (see serveShort) so the
// page's own root-absolute /assets/... fetches (which serveStatic gates on this
// cookie) succeed without a redirect that would expose the real path.
function serveStaticFile(res, target, setCookie) {
  try {
    fs.realpath(target, (err, real) => {
      if (err) { res.writeHead(404, { 'Content-Type': 'text/plain' }); res.end('not found'); return; }
      if (!isUnderAnyRoot(real, [SERVE_ROOT_REAL]) || isDenied(real)) {
        res.writeHead(404, { 'Content-Type': 'text/plain' }); res.end('not found'); return;
      }
      try {
        fs.stat(real, (err2, st) => {
          if (err2 || !st.isFile()) { res.writeHead(404, { 'Content-Type': 'text/plain' }); res.end('not found'); return; }
          try {
            fs.readFile(real, (err3, buf) => {
              if (err3) { res.writeHead(404, { 'Content-Type': 'text/plain' }); res.end('not found'); return; }
              const headers = { 'Content-Type': MIME[path.extname(real).toLowerCase()] || DEFAULT_MIME };
              if (setCookie) headers['Set-Cookie'] = `${STATIC_COOKIE_NAME}=${STATIC_COOKIE_VALUE}; Path=/; HttpOnly; SameSite=Lax; Max-Age=43200`;
              res.writeHead(200, headers);
              res.end(buf);
            });
          } catch (e) { res.writeHead(400); res.end('bad path\n'); }
        });
      } catch (e) { res.writeHead(400); res.end('bad path\n'); }
    });
  } catch (e) { res.writeHead(400); res.end('bad path\n'); }
}

// ---------- GET: serve the board (static files under SERVE_ROOT) -------------
function serveStatic(req, res) {
  let pathname;
  try { pathname = decodeURIComponent(new URL(req.url, 'http://x').pathname); }
  catch (e) { res.writeHead(400); res.end('bad url'); return; }
  // /fs/ and /s/ carry their own per-link HMAC auth and must stay reachable
  // without the static cookie — dispatch to them BEFORE the cookie check below.
  if (pathname.startsWith('/fs/')) { serveFs(req, res, pathname); return; }
  if (pathname.startsWith('/s/')) { serveShort(req, res, pathname); return; }
  // PATCH: cookie gate — everything else this function serves (including the
  // '/' help message below) used to be an unauthenticated read of SERVE_ROOT.
  // The only way to get this cookie is a /s/ link whose HMAC already checked
  // out (see serveShort's in-place stream), so this closes that off.
  if (!staticCookieMatches(req)) {
    res.writeHead(403, { 'Content-Type': 'text/plain' });
    res.end('forbidden: open this page via its /s/ link (fs-link.sh) so the browser gets a session cookie\n');
    return;
  }
  if (pathname === '/' || pathname === '') {
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end('board-server: append a board filename, e.g. /smoke-test-r1.html\n');
    return;
  }
  const target = path.resolve(SERVE_ROOT, '.' + pathname);
  if (target !== SERVE_ROOT && !target.startsWith(SERVE_ROOT + path.sep)) { // traversal guard
    res.writeHead(403); res.end('forbidden'); return;
  }
  // realpath + denylist + isFile gate lives in serveStaticFile (shared with the
  // in-place /s/<code> stream in serveShort). No cookie set here — this request
  // already presented the cookie (checked above); it's an asset/page fetch, not
  // the initial /s/ hit that mints it.
  serveStaticFile(res, target, false);
}

// ---------- per-IP rate limit — a safety valve against reckless request
// volume (someone brute-forcing the /fs/ HMAC or the POST token, or a runaway
// client). Token bucket per client IP: up to RL_BURST requests can arrive at
// once, then the bucket refills at RL_RPS/sec. Normal board page-loads (a
// handful of assets) and view polling stay far under this; only a flood trips
// it. Keyed on the raw socket peer IP, NOT X-Forwarded-For (a client can forge
// that) — fine on the default loopback bind, where every peer connects
// directly. Tuned high enough never to bite real use, low enough that the
// 64-bit /fs/ token can't be brute-forced in human timescales from one IP:
// 2^63 guesses / 100 rps ≈ 2.9 billion yr. (64-bit hex is the weaker of the
// two routes at the same FS_TOKEN_MIN_LEN character floor — /s/'s base64url
// code is 96 bits.)
//
// SECURITY POSTURE (deliberate): this per-IP cap is the ONLY throttle on /fs/
// token guessing. An attacker spreading guesses across many source IPs divides
// that figure by the IP count. On the default loopback bind this is moot —
// nothing off-machine can reach the server at all. A non-loopback bind trusts
// whatever can reach that interface: anyone who can reach it can also spread
// guesses across many source IPs, so widen the token (raise FS_TOKEN_MIN_LEN
// and fs-link.sh's CODE_LEN beyond 16) rather than leaning harder on rate
// limiting if you ever bind somewhere untrusted.
const RL_RPS = 100;          // sustained requests/sec per IP
const RL_BURST = 200;        // bucket capacity — max instantaneous burst per IP
const RL_MAX_BUCKETS = 8192; // hard cap on tracked IPs — bounds memory AND per-request work
const rlBuckets = new Map(); // ip -> { tokens, last (ms epoch) } — Map keeps insertion order
function rateLimitOk(ip) {
  const now = Date.now();
  let b = rlBuckets.get(ip);
  if (!b) {
    // Hard cap with O(1) insertion-order (oldest-first) eviction so a flood of
    // DISTINCT source IPs can't grow the map — or the per-request work — without
    // bound. Evicting an entry is lossless: a re-seen IP just gets a fresh full
    // bucket, which never grants LESS than the limit intends. (An earlier
    // scan-and-prune version was O(N²) under exactly this flood — do not restore.)
    if (rlBuckets.size >= RL_MAX_BUCKETS) {
      const oldest = rlBuckets.keys().next().value;
      if (oldest !== undefined) rlBuckets.delete(oldest);
    }
    b = { tokens: RL_BURST, last: now };
    rlBuckets.set(ip, b);
  } else {
    const elapsed = Math.max(0, now - b.last) / 1000; // clamp: a clock step-back must not drive tokens negative (self-lockout)
    b.tokens = Math.min(RL_BURST, b.tokens + elapsed * RL_RPS);
    b.last = now;
  }
  if (b.tokens < 1) return false;
  b.tokens -= 1;
  return true;
}

// ---------- POST: submit receiver (token-gated) ---------------
const httpServer = http.createServer(async (req, res) => {
  const clientIp = req.socket.remoteAddress || 'unknown';
  if (!rateLimitOk(clientIp)) {
    // Access-Control-Allow-Origin so a rate-limited CORS preflight/POST surfaces
    // as a clean 429 to the browser rather than an opaque CORS failure.
    res.writeHead(429, { 'Content-Type': 'text/plain', 'Retry-After': '1', 'Access-Control-Allow-Origin': '*' });
    res.end('rate limit exceeded — slow down\n');
    return;
  }
  if (req.method === 'OPTIONS') {
    res.writeHead(204, { 'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Content-Type, X-HTML-Skills-Token',
      'Access-Control-Allow-Methods': 'POST, GET, OPTIONS' });
    res.end(); return;
  }
  if (req.method === 'GET') { serveStatic(req, res); return; }
  if (req.method !== 'POST') { res.writeHead(405, { 'Content-Type': 'text/plain' }); res.end('POST a JSON body to submit\n'); return; }

  const hostName = (req.headers.host || '').replace(/:\d+$/, '');
  if (!ALLOWED_HOSTS.has(hostName)) { res.writeHead(403, { 'Content-Type': 'application/json' }); res.end(JSON.stringify({ ok: false, error: 'bad host' })); return; }

  let presentedToken = null;
  try { presentedToken = new URL(req.url, 'http://x').searchParams.get('t'); } catch (e) {}
  if (!presentedToken) presentedToken = req.headers['x-html-skills-token'] || null;
  if (!tokenMatches(presentedToken)) {
    res.writeHead(403, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
    res.end(JSON.stringify({ ok: false, error: 'missing or invalid channel token' })); return;
  }

  let body = '';
  let bodyBytes = 0;
  req.setEncoding('utf8');
  for await (const chunk of req) {
    body += chunk;
    bodyBytes += Buffer.byteLength(chunk); // count bytes, not UTF-16 units, so the cap is real for non-ASCII
    if (bodyBytes > MAX_BODY_BYTES) { res.writeHead(413, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }); res.end(JSON.stringify({ ok: false, error: 'body too large' })); return; }
  }

  let meta = {};
  try { const p = JSON.parse(body); if (p && typeof p === 'object') {
    if (typeof p.skill === 'string') meta.skill = p.skill;
    if (typeof p.kind === 'string') meta.kind = p.kind;
    if (typeof p.version === 'number') meta.version = String(p.version);
  } } catch (e) {}
  // meta keys are literals set above and values are already type-checked, so no
  // key sanitizer is needed.

  notify('notifications/claude/channel', { content: body, meta });
  res.writeHead(200, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
  res.end(JSON.stringify({ ok: true }));
});

httpServer.on('error', err => {
  // A listen failure leaves no listener — exit non-zero so a supervisor/caller
  // notices instead of a "running but serving nothing" process.
  log(err.code === 'EADDRINUSE' ? `port ${PORT} in use` : `http error: ${err.message}`);
  process.exit(1);
});
httpServer.listen(PORT, HOST, () => {
  const actualPort = httpServer.address().port;
  log(`serving ${SERVE_ROOT}`);
  log(FS_ROOTS.length ? `/fs/ roots: ${FS_ROOTS.join(', ')}` : '/fs/ roots: (none configured — /fs/ route disabled)');
  log('/fs/ per-link auth: enabled (?fst= required; see FS_SECRET_FILE)'); // never log FS_SECRET itself
  log(`/s/ shortlinks: enabled (store: ${FS_STORE_FILE})`);
  // Two lines, deliberately: the bind address is NOT a link, and under a
  // wildcard bind "http://0.0.0.0:PORT/" is not a destination at all. This log
  // is what the skill greps for the submit token, so emitting a bind address in
  // URL form here is handing whoever reads it a dead link to copy. The bind line
  // carries no scheme; only the LINK_HOST line is a real URL.
  log(`listening on ${HOST}:${actualPort}  (bind address — not a link)`);
  log(`links use http://${LINK_HOST}:${actualPort}/  (submit token ?t=${TOKEN})`);
});
process.on('SIGTERM', () => process.exit(0));
process.on('SIGINT', () => process.exit(0));
// backstop — the try/catch guards above should catch every known
// synchronous-throw path (e.g. null-byte paths), but this keeps one
// unanticipated bad request from taking down the whole daemon.
process.on('uncaughtException', err => log(`uncaught exception (request likely dropped): ${err.message}`));
