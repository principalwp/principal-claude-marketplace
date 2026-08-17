# htmlizer

A Claude Code skill that turns whatever you're about to show the user — a plan, a code
review, competing approaches, a design system, a live config — into a self-contained
interactive HTML page they read and give feedback through, served locally over HTTP,
with their feedback auto-returned into the Claude Code session. No copy-paste: the page
POSTs to a small bundled Node server, which hands the submission straight back to the
agent.

Ships every capability of the internal version this was forked from intact: the Node
board-server, 19 view-type prompts, house style + review panel, the `/fs/`+`/s/` link
mechanism, feedback capture, and the two-phase Yes/Maybe/Skip review board.

## Requirements

- **Node.js >= 16** (the code uses `require('node:*')` and `digest('base64url')`, both
  needing a reasonably recent Node). Zero npm dependencies.
- **Linux, macOS, or WSL.** The server and scripts are POSIX-sh + Node — no native
  Windows support (no launchd/Task Scheduler integration); on Windows use WSL.

## Install

htmlizer ships in the **`principalwp-toolkit`** plugin in Principal WP's public Claude
Code marketplace. Add the marketplace once, then install the plugin:

```bash
/plugin marketplace add principalwp/principal-claude-marketplace
/plugin install principalwp-toolkit@principalwp
```

That's the entire install. There's nothing to start by hand — the skill starts its own
server on demand the first time you use it.

To use it outside Claude Code (see **Other coding agents** below), the skill is a
self-contained directory — symlink or copy it into your agent's skills folder:

```bash
ln -s /path/to/htmlizer ~/.claude/skills/htmlizer
```

## Quick start

In Claude Code, say **"htmlize this"**, **"htmlizer this"**, or **"render in html"** (or
`/htmlizer`) about anything you'd otherwise paste as text. The skill generates a page, mints a link via `references/fs-link.sh`
(which auto-starts the local board-server if it isn't already running), and hands you a
`http://127.0.0.1:26537/s/…` link to open.

To prove the auto-start works without going through Claude Code first:

```bash
. references/net-config.sh && mkdir -p "$SERVE_ROOT" && references/fs-link.sh "$SERVE_ROOT"
```

The first run spins up the server (a few hundred ms) and prints a link; run it again and
it returns instantly (the server was already up). The printed link 404s if you open it —
it points at the empty serve-root directory, not a real page — this command only proves
the server starts.

## Other coding agents

htmlizer isn't Claude Code-only: the skill is a `SKILL.md` plus plain shell/Node
references, and it works the same way under Claude Code, Gemini (via the Antigravity
CLI), Codex, and OpenCode — any agent that can read a skill file, run shell commands,
and act on the link it's handed.

The one piece that's Claude-Code-specific is the auto-return path: Claude Code's
Monitor tool tails the board-server's log and delivers your feedback back into the
session the moment you hit Submit, with nothing to copy-paste. Agents without a Monitor
equivalent don't get that for free — the fallback, built into every page, is the
**"Copy as prompt"** button next to Submit: click it, then paste what's on your
clipboard back into the agent's session yourself.

## Configuration

One file, plain shell syntax: `${XDG_CONFIG_HOME:-~/.config}/htmlizer/config`. It's
auto-created with all six keys commented out (built-in defaults shown) the first time
anything needs it:

```sh
#HOST=127.0.0.1
#LINK_HOST=
#PORT=26537
#FS_ROOTS=
#STATE_DIR=${XDG_STATE_HOME:-$HOME/.local/state}/htmlizer
#ALLOWED_HOSTS=
```

`HOST` is the address the server **binds**; `LINK_HOST` is the address that goes in the
**link you get handed**. Empty `LINK_HOST` follows `HOST`, except under a wildcard bind
(`0.0.0.0`/`::`) where there is no clickable bind address and it falls back to `127.0.0.1`
(on-box only, and `fs-link.sh` warns on stderr when that happens). **Reaching a page from
another device is one key: set `LINK_HOST` to the address you reach this machine by**
(Tailscale IP, LAN IP, hostname). The board-server is started accepting submits addressed
to `LINK_HOST`, so the Submit button works without also listing it in `ALLOWED_HOSTS`.

Everything else — the serve root, the server log, the HMAC signing secret, the shortlink
store — derives from `STATE_DIR`: `$STATE_DIR/serve`, `$STATE_DIR/.board-server.log`,
`$STATE_DIR/.fs-signing-secret`, `$STATE_DIR/.fs-shortlinks.tsv`. Change `STATE_DIR` to
move all of htmlizer's state somewhere else in one edit.

**To change a value:** edit the file, then stop the board-server listening on your
configured port — the next mint (any use of `fs-link.sh`) auto-starts a fresh one:

```sh
fuser -k 26537/tcp                      # Linux
lsof -ti tcp:26537 | xargs kill         # macOS (no fuser)
```

**Stop it by port, never by process name.** `pkill -f board-server.js` looks like the
obvious command and is wrong twice over. It matches the shell you typed it in whenever the
command is passed through `sh -c` — which is how every coding agent runs a command — so it
kills the caller mid-command. And if a second board-server is running (a system service on
another port, a second user's instance), it matches that too: both are the same file with
the same command line, so nothing in the process table distinguishes them. The port is the
only thing that does.
The next mint (any use of `fs-link.sh`) auto-starts a fresh server with the new values —
there's no service to restart by hand.

**FS_ROOTS** is a second, opt-in GET route (`/fs/<absolute-path>`) for linking files
*outside* the serve root — comma-separated absolute paths. Empty by default: only pages
this skill generated (under the serve root) are linkable out of the box.

## Manual foreground debugging

If `fs-link.sh`'s auto-start isn't coming up and the log isn't enough, run the server
yourself in a terminal to watch its stdout/stderr directly:

```bash
. references/net-config.sh
mkdir -p "$SERVE_ROOT" "$STATE_DIR"
HTML_SKILLS_CHANNEL_HOST="$HOST" HTML_SKILLS_LINK_HOST="$LINK_HOST" \
HTML_SKILLS_CHANNEL_PORT="$PORT" \
HTML_SKILLS_SERVE_ROOT="$SERVE_ROOT" HTML_SKILLS_FS_ROOTS="$FS_ROOTS" \
HTML_SKILLS_ALLOWED_HOSTS="$ALLOWED_HOSTS" HTML_SKILLS_FS_SECRET_FILE="$FS_SECRET_FILE" \
HTML_SKILLS_FS_STORE_FILE="$FS_STORE_FILE" \
node references/board-server.js
```

Kill it (Ctrl-C) when done; the next `fs-link.sh` mint will auto-start it again in the
background as usual. The `HTML_SKILLS_*` environment variables above are the server's
internal interface — they're what `net-config.sh`'s resolved values get exported as; the
config file is the interface you actually edit.

## Security

- **Default exposure is loopback only** — bound to `127.0.0.1:26537`. Nothing off this
  machine can reach it. This is the single most important default.
- **What a page exposes:** the POST submit route is token-gated — every submit has to
  carry the server's current token (`?t=`, minted per run), and a stale or missing one
  is rejected — and host-allowlisted to `127.0.0.1`/`localhost`/`HOST`. The GET static
  route is cookie-gated: opening a page over a valid `/s/` link sets a session cookie,
  and the route then requires that cookie on every read (a bookmarked path URL or a bare
  `curl` 403s). Both the `/fs/` and `/s/` links themselves are HMAC-signed — the
  signature is checked before anything is served, so a link can't be guessed or
  hand-typed — and `/fs/` is additionally disabled by default (empty `FS_ROOTS`).
- **`HOST` is what the server binds; `LINK_HOST` is what goes into the links you hand
  out** — they can differ on purpose: bind loopback, hand out a Tailscale or LAN
  address, and the server still only listens where `HOST` says. If you bind a
  non-loopback host (`HOST=0.0.0.0` or a LAN IP in the config file), set `LINK_HOST` to
  the address you actually open pages at. The server accepts a submit
  POST only when the `Host:` header matches `127.0.0.1`/`localhost`/`HOST`/`LINK_HOST`/
  `ALLOWED_HOSTS`, and `LINK_HOST` is in that list, so setting it is enough on its own —
  `ALLOWED_HOSTS` is only for *further* addresses you also reach the server by. Get this
  wrong and the page loads fine while every Submit 403s "bad host". Every route stays
  authenticated either way, but the machine is now reachable by anything on that
  interface — **do not bind `0.0.0.0` on an untrusted network.** If you must expose it,
  put it behind a private VPN, and lengthen the HMAC floor (`FS_TOKEN_MIN_LEN` in
  `board-server.js`, `CODE_LEN` in `fs-link.sh`) if peers are untrusted.
- **Using this from the cloud or a remote box:** set `LINK_HOST` to an address you can
  actually reach the machine by — a Tailscale IP, a LAN IP, or a hostname — so Submit
  and feedback auto-return keep working when you're not sitting on the same box as the
  server.
- **No telemetry, no outbound network calls anywhere in the shipped code** — no CDN, no
  external fetches; the diagram libraries are vendored locally.

## Known limitations

- **The submit token rotates on every server restart** — a page/Monitor handed out
  before a restart 403s on submit; regenerate and re-serve.
- **The secret and shortlink store are persistent** under `STATE_DIR` (so old `/s/`
  links keep resolving across restarts). If you point `STATE_DIR` at a directory that
  gets cleared (e.g. `$TMPDIR`), a clear regenerates the secret and dead-links every
  old `/s/` URL.
- **A trailing slash or relative `XDG_STATE_HOME`** can make the shell's path
  concatenation double a slash, causing `fs-link.sh` to refuse a mint the server would
  actually serve. Keep `STATE_DIR` (and `XDG_STATE_HOME`, if you set it) an absolute
  path with no trailing slash.
- **Multiple concurrent Claude Code sessions sharing one server** is handled by the
  per-page random channel the skill bakes into every page and Monitor — see
  `references/serving.md`.
- **The 30-day prune keys on each page directory's mtime**, which only updates when an
  entry inside it is added or removed — not when an existing file is edited in place. A
  long-lived page you keep overwriting under the same filename can be pruned while still
  in use; iterating by writing new files (e.g. `-r2.html` rounds) refreshes the
  directory's age and keeps it alive.
- **The log (`.board-server.log`) grows unbounded** (append-only). It's a working file
  under `STATE_DIR` — truncate or rotate it manually if it gets large. No logrotate is
  shipped.
- **macOS / Windows:** no launchd or Task Scheduler template. On macOS the server and
  scripts just work (POSIX-sh + Node); run the manual foreground command above in a
  dedicated terminal, or wire your own supervisor, if you want it to survive a reboot.
  Native Windows is out of scope — use WSL.
- **Secret file permissions are `0600` (owner-only)** — the default single-user
  posture. If you widen `FS_ROOTS` or bind non-loopback on a genuinely multi-user
  machine, you inherit the usual shared-box caveats (a local peer that can already read
  your files gains nothing new, but review who else has an account on the box).

## Layout

```
SKILL.md            — the skill Claude reads
references/         — runtime scripts (board-server, fs-link), view prompts, review panel
assets/             — fonts, images, vendored diagram libs, base.css, capture.js
branding/           — htmlizer logo marks and lockups
gallery/            — example rendered pages, one per view type
README.md, LICENSE, NOTICE
```

This skill ships in the `principalwp-toolkit` plugin of Principal WP's
[principal-claude-marketplace](https://github.com/principalwp/principal-claude-marketplace).

## License

**License: GPLv3** — see [`LICENSE`](LICENSE) for the full text.

htmlizer is a fork of [f-labs-io/agent-html-skills](https://github.com/f-labs-io/agent-html-skills)
(MIT); its MIT-licensed code is incorporated here (MIT permits this) and the project as a
whole is distributed under the GPLv3. The upstream MIT notice is retained in full — see
[`NOTICE`](NOTICE) for the complete third-party credits.

Third-party components keep their own upstream licenses:
- IBM Plex Sans/Mono and Instrument Serif (`assets/shared/fonts/`) — SIL Open Font
  License.
- `assets/vendor/mermaid.min.js` — vendored from [mermaid](https://github.com/mermaid-js/mermaid)
  (MIT). The shipped minified build carries no inline header; see the upstream repo for
  its license text.
- `assets/vendor/svg-pan-zoom.min.js` — vendored from
  [svg-pan-zoom](https://github.com/ariutta/svg-pan-zoom) (BSD-2-Clause).
- `references/board-server.js` is derived from f-labs-io/agent-html-skills' `server.js`
  (MIT, commit `76e5c6e`) — see the MIT-provenance comment at the top of the file.
