# serving.md — the agent runbook (read this at SKILL.md step 0 / step 4)

What Claude needs mid-skill to run the board-server, bake a working token + channel into a page,
hand over the link, and get feedback auto-returned. Everything human-facing (install, config
file, security posture, manual debugging, license) lives in the repo's `README.md`.

Assumes `$SKILL`, `$HOST`, `$PORT`, `$STATE_DIR`, `$SERVE_ROOT`, `$LOG` are set (SKILL.md step 0:
`. "$SKILL/references/net-config.sh"`).

## Redacting secrets from a page (opt-in, default OFF)

`$REDACT_SECRETS` (set in `net-config.sh`) is **empty by default = off**: quote whatever you read
from the source (code, logs, config, transcript) exactly as found, including anything that looks
like a credential. Do not invent redaction — that is a silent, unrequested edit to the source.

**Only when `$REDACT_SECRETS` is non-empty**, mask credential-shaped values (API keys, tokens,
passwords, private keys, connection strings with an embedded password) before writing them onto
the page, keeping enough shape to identify what it is (`sk-…REDACTED`,
`postgres://user:REDACTED@host/db`) but never the full value. This applies to values copied FROM the material you're
presenting, never to the page's own submit token or `CAPTURE_CHANNEL` (this skill's plumbing —
redacting them breaks Submit). The flag is read by you at step 0, so it takes effect on the next
page you write — no server restart.

## Archiving page history (opt-in, default OFF)

`$ARCHIVE` and `$HISTORY_DIR` (set in `net-config.sh`, `$HISTORY_DIR` = `$STATE_DIR/history`)
gate a durable, per-version archive: **off by default**, so a normal run writes nothing here.
Turn it on with the `ARCHIVE` config key or the `HTMLIZER_ARCHIVE` env var for a one-off run
(overrides the config key).

When on, SKILL.md's step 3.5 and step 4 call `references/archive.sh` and write reviewer
findings directly, saving three things per version under `$HISTORY_DIR/<slug>/`: the
pre-panel draft, the handed-over final, and each reviewer's raw findings (accuracy, reader,
design), as flat files named `<slug>__r<N>__<ts>__<stage>.<ext>`. This is plain file copies
made by the orchestrator (SKILL.md) — independent of the board-server, the submit token, and
`$SERVE_ROOT`; it works even though `$SERVE_ROOT` gets pruned after 30 days. The history
archive is never pruned, and it never leaves this machine — plain local file copies only.

## Prime the server and read the token

The board-server is **not** always-on — `fs-link.sh` auto-starts it on every mint. But the submit
token you bake into a page must be the server's REAL current token, so the server has to be up
*before* you generate page content. The first time in a session, prime it with a throwaway mint:

```bash
"$SKILL/references/fs-link.sh" "$SERVE_ROOT" >/dev/null 2>&1   # throwaway — triggers auto-start
TOKEN=$(grep -o 'submit token ?t=[0-9a-f]*' "$LOG" | tail -n1 | grep -o '[0-9a-f]*$')
```

(`$SERVE_ROOT` is always an allowed link target, so this succeeds before any page exists; its
printed link is discarded.) Re-read `$TOKEN` the same way whenever you need it — a restart mints a
fresh one and a page baked against a stale token 403s on submit, so never restart the server to
match old pages.

**Take ONLY the token off that line.** The startup log labels its two addresses so they can't be
confused — `listening on <HOST>:<PORT> (bind address — not a link)` and `links use
http://<LINK_HOST>:<PORT>/ (submit token ?t=…)`; the bind line carries no `http://` on purpose
(under a wildcard bind it reads `0.0.0.0`). The link you hand over always comes from `fs-link.sh`'s
stdout, never this log (see "Handover mechanics").

Bake `TOKEN` in before minting the real link: `window.CAPTURE_SUBMIT_URL = "/?t=" + TOKEN`
(Shape A) or `SUBMIT_URL = "/?t=" + TOKEN` in the Shape B node inject. Never pass the token on a
command line or as an env var — let the server mint its own.

## Mint the real page link

```bash
LINK=$("$SKILL/references/fs-link.sh" "$SERVE_ROOT/<slug>/<slug>.html")
```

`fs-link.sh` re-probes the server and, only if it's down, repeats the auto-start (creates state
dirs + config if absent, launches, waits ~5s), then mints and prints the `/s/<code>` link. If the
server never comes up it exits non-zero with a stderr message and prints **nothing** to stdout —
it never hands back a link that won't serve; check `$LOG` for the real error (missing Node, broken
config, port already in use) before retrying.

It also prunes serve-root output older than 30 days on every successful mint (depth-1 page dirs
and depth-1 board `*.html` files, `assets/` excluded) — expected, not a bug if an old link 404s
later.

## Feedback channel (why every page is stamped, and the Monitor is filtered)

`$LOG` can be shared by more than one Claude Code session talking to the same board-server, so a
Monitor that greps the whole log fires on **every** session's submits. To scope submits to you,
stamp every page this session with **the same per-session random channel** and grep the log for
that channel only.

**Mint it once per session and reuse the literal on every page and round — NEVER the session id or
anything derived from it:**

```bash
openssl rand -hex 8   # e.g. 9f2c41a3b8d47e60 — mint ONCE per session, then reuse
```

Not the session id, because one id can host several live threads at once — a rewound or edited
message forks the session into siblings that all resolve the same id, which cross-wires their
submits. Not per-page either: one stable channel with one persistent Monitor catches a submit on
any round, including older tabs the user still has open; re-minting per round silently drops a
submit made on a superseded round.

Bake the literal into the submit payload (Shape A `window.CAPTURE_CHANNEL`, Shape B the injected
`CHANNEL`) and grep for it when arming the Monitor. **Inline the resolved literal — never the
`openssl` call itself** in the page or the Monitor command: a live call there mints a second value
that matches nothing, and an empty/placeholder channel matches far too much. The step-3.5 lint
(`review-design.md` check 6) rejects a channel that is missing, empty, malformed, or
session-id-shaped.

**Never take a channel off a page another thread generated** (one already in the serve root, or
another run's page you're templating) — it wires that thread's submits into your Monitor and yours
into theirs. The one channel you may re-read is one YOU served earlier this session (e.g. after a
compaction wiped it from context): recover it from that page's `CAPTURE_CHANNEL` rather than
minting a second, which splits your pages across two filters.

**Accepted tradeoff:** a sibling branch from a mid-session rewind/edit inherits the same channel,
so the two branches receive each other's submits — far rarer than the dropped-tab failure per-page
minting caused; if you knowingly fork that way, mint a fresh channel by hand. **Don't add a
"silently ignore submits that aren't mine" fallback:** with the filter a foreign submit never
arrives, so if one surfaces the filter regressed — fix it, don't swallow it.

## Arm the Monitor for auto-return

Before the user submits, arm a **persistent Monitor** (the Monitor tool, with `persistent: true`)
watching the log so their submit returns into the session (no copy-paste). The second grep is **required** — it filters to this page's
channel so another thread's submit never wakes you:

```
tail -n0 -f "$LOG" | grep --line-buffered "notifications/claude/channel" | grep -F --line-buffered '\"channel\":\"CHANNEL-LITERAL\"'
```

Replace `CHANNEL-LITERAL` with the resolved channel, e.g. `grep -F --line-buffered
'\"channel\":\"9f2c41a3b8d47e60\"'`. `grep -F` is a **fixed-string** match (no regex escaping).
Keep the whole `\"channel\":\"…\"` wrapper exactly: the server logs the payload JSON-escaped, so
the channel appears literally as `\"channel\":\"<value>\"` (verify: `grep channel "$LOG" | od -c`).
The wrapper pins the match to the channel key on the left and the value's closing quote on the
right, so it catches your channel and only yours — dropping either end widens the match.

**Arm once with `persistent: true`, and keep it — do NOT stop or re-arm it per round.**
`persistent: true` runs the Monitor for the whole session with no timeout; without it the Monitor
tool's `timeout_ms` defaults to 5 minutes, so a non-persistent monitor silently dies while the user
is still reading and any submit made after that is dropped. The channel is stable for the session,
so the single Monitor already matches every round's page, including older tabs the user still has
open; re-arming per round is exactly what drops a submit made on a superseded round.

When a submit fires, its `content` is the Capture payload but is usually **truncated in delivery**,
so treat it as a *trigger*. Read the full submission with the bundled reader; do **not** hand-parse
`$LOG`:

```bash
"$SKILL/references/read-feedback.sh" <CHANNEL>          # the latest submission
"$SKILL/references/read-feedback.sh" <CHANNEL> --all    # every submission this session
```

It sources `net-config.sh` for `$LOG`, pulls that channel's submission(s) from the log
(double-decoding the JSON-escaped payload), and prints view / verdict / coverage / each item's id +
value + reason (or note) / comments. `<CHANNEL>` is this session's `CAPTURE_CHANNEL` literal. Until
a submit arrives (or the user pastes the clipboard fallback), stop and wait — don't start working.

## Handover mechanics

**The link you hand over is EXACTLY `fs-link.sh`'s `/s/<code>` stdout.** For a target under
`$SERVE_ROOT` the server **streams the page in place at `/s/<code>`** (no redirect) and sets a
session cookie on that response; the page's root-absolute `/assets/…` URLs are then fetched from
`$SERVE_ROOT` carrying that cookie, so they resolve regardless of the `/s/<code>` address bar
(which stays put — there's no long real-path URL for anything to pick up). Re-hand `fs-link.sh`'s
original stdout rather than rebuilding a link by hand.

**The bind host is not the link host — never build a link out of `HOST`.** `HOST` is what the
server binds; `LINK_HOST` (config, resolved in `net-config.sh`) is what goes in the link. They
match for the loopback default and diverge the moment `HOST` is a wildcard (`http://0.0.0.0:PORT/`
is a bind address, not a destination). `fs-link.sh` already prints `LINK_HOST` and the server
accepts submits addressed to it, so the page posts back same-origin. The config file's `HOST` is
not a handoff link either.

**If the link doesn't resolve, report it and stop — do not substitute a host.** Say which link you
were handed and that it didn't load; the fix is `LINK_HOST` in
`${XDG_CONFIG_HOME:-~/.config}/htmlizer/config` (then restart by PORT — `fuser -k 26537/tcp`,
**never** `pkill -f board-server.js`, which also matches the shell running it and any second
board-server instance — then re-mint). That is the user's call, not a URL to repair in-flight.

Streaming in place is why pages must live under `$SERVE_ROOT`: their `/assets/…` fetches are served
(and cookie-gated) only from the serve root; a page linked from anywhere else streams at
`/s/<code>` with no cookie, so its `/assets/…` fetches 403.

## Agent-facing troubleshooting

- **Submit POSTs 403 ("missing or invalid channel token").** The token rotated (a server restart
  between minting the link and the user submitting). Re-read the token from `$LOG`, regenerate and
  re-serve the page with it, and tell the user the old link is dead.
- **Submit POSTs 403 `{"error":"bad host"}`.** Different failure, same-looking symptom — the page
  shows only "Submit failed: HTTP 403", so check the response body before assuming the token
  rotated. The server doesn't accept the `Host:` the page posted from; its allow-list
  (`127.0.0.1`/`localhost`/`HOST`/`LINK_HOST`/`ALLOWED_HOSTS`) is **fixed at launch**. Usual cause:
  a config edit (`LINK_HOST`) without a restart, so the link points somewhere new but the running
  process still holds the old allow-list. GET is cookie-gated not host-checked, so the page loads
  and only Submit fails. Fix: restart by port (`fuser -k <PORT>/tcp`), re-mint, re-serve.
- **`fs-link.sh` prints `NOT-SERVED: … is not under any allowed root`.** The page must live under
  `$SERVE_ROOT` (Shape A: one level below; Shape B: at the root). `fs-link.sh` only mints links for
  the serve root plus the config file's opt-in `FS_ROOTS`.
- **`fs-link.sh` exits non-zero with "board-server did not come up".** Check `$LOG` for the real
  error — a broken config file, a port already in use, or Node missing. Read the log before
  retrying.
- **Fonts render as system serif/sans.** The font files were never copied to
  `$SERVE_ROOT/assets/fonts/` — re-run SKILL.md step 3's asset copy.
