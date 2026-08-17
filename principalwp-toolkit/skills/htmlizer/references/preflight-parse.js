#!/usr/bin/env node
// preflight-parse.js — single-pass node helper for preflight-lint.sh.
//
// Reads the page ONCE and writes every intermediate file the bash checks in
// preflight-lint.sh consume, replacing the perl producers those checks used
// to shell out to (one perl fork per check, plus — for check 15 — one perl
// fork per inline <script>, which is the concurrency bug this rewrite fixes:
// a fork that fails under load was silently swallowed by `2>/dev/null` and
// produced a spurious HIGH on a correctly-wired page).
//
// Usage: node preflight-parse.js <page.html> <tmpdir>
//
// Writes into <tmpdir>:
//   channel.tsv            — check 2  (CAPTURE_CHANNEL)
//   fontface.tsv            — check 5  (@font-face base64/data: fonts)
//   css_rules.tsv            — checks 6-11 (CSS rule pass)
//   scripts.tsv + inline_script_N.js — checks 15/16 (inline <script> bodies)
//   scripts_uncommented.txt — check 15 (comment-stripped script bodies)
//   syntax_errors.tsv       — check 16 (in-process syntax check, one row per
//                              inline <script> that fails to compile)

'use strict';

const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const PAGE = process.argv[2];
const TMPDIR = process.argv[3];

const text = fs.readFileSync(PAGE, 'utf8');

// ---- char-offset -> 1-based line number, O(log n) per lookup ----
const newlineOffsets = [];
for (let i = 0; i < text.length; i++) {
  if (text[i] === '\n') newlineOffsets.push(i);
}
function lineOf(pos) {
  let lo = 0, hi = newlineOffsets.length;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (newlineOffsets[mid] < pos) lo = mid + 1; else hi = mid;
  }
  return lo + 1;
}

function writeTsv(name, rows) {
  fs.writeFileSync(path.join(TMPDIR, name), rows.length ? rows.join('\n') + '\n' : '');
}

// ---------------------------------------------------------------------------
// channel.tsv — check 2 (CAPTURE_CHANNEL well-formed). Scanned line-by-line,
// same as the perl it replaces. A row is emitted even when the captured
// value is empty — the empty-channel case is exactly what check 2 must
// catch, so an empty val becomes "lineno\t" (trailing tab, empty field).
// ---------------------------------------------------------------------------
{
  const CHANNEL_RE = /(?:window\.CAPTURE_CHANNEL|const\s+CHANNEL)\s*=[^"']*["']([^"']*)["']/;
  const lines = text.split('\n');
  const rows = [];
  for (let i = 0; i < lines.length; i++) {
    const m = lines[i].match(CHANNEL_RE);
    if (m) rows.push(`${i + 1}\t${m[1]}`);
  }
  writeTsv('channel.tsv', rows);
}

// ---------------------------------------------------------------------------
// fontface.tsv — check 5 (base64/data: fonts inside @font-face only).
// ---------------------------------------------------------------------------
{
  const rows = [];
  const FONTFACE_RE = /@font-face\s*\{([^}]*)\}/gs;
  let m;
  while ((m = FONTFACE_RE.exec(text)) !== null) {
    const block = m[1];
    if (/;base64|data:font|data:application\//.test(block)) {
      rows.push(String(lineOf(m.index)));
    }
  }
  writeTsv('fontface.tsv', rows);
}

// ---------------------------------------------------------------------------
// css_rules.tsv — checks 6-11. Ports the perl brace-depth CSS rule parser
// exactly: scans every <style>...</style>; blanks /* */ comments in place
// (preserving newlines, so offsets/line numbers stay aligned and comment
// text can never bleed into a selector); tracks brace depth; emits every
// top-level `selector { decls }` rule; ALSO emits rules that are direct
// children of a single at-rule (@media/@supports/…) — one level of at-rule
// nesting — but never emits the at-rule prelude itself, and swallows
// anything nested two-or-more levels deep; collapses selector/decl
// whitespace (incl. newlines/tabs) to single spaces and trims; lineno is the
// 1-based line of the selector's first non-whitespace char.
// ---------------------------------------------------------------------------
{
  const rows = [];

  // sel_info(block, blockStart, marker, i) — the raw text of `block` between
  // marker and i is a pending selector (the stretch right before an opening
  // '{'). Returns [is_at_rule, collapsed selector, 1-based line number of
  // the selector's first non-whitespace char].
  function selInfo(block, blockStart, marker, i) {
    const raw = block.slice(marker, i);
    const leadMatch = raw.match(/^\s*/);
    const lead = leadMatch ? leadMatch[0].length : 0;
    const line = lineOf(blockStart + marker + lead);
    const trimmed = raw.replace(/^\s+|\s+$/g, '');
    const isAt = /^@/.test(trimmed) ? 1 : 0;
    const sel = trimmed.replace(/\s+/g, ' ');
    return [isAt, sel, line];
  }

  // decl_text(block, start, end) — the declarations between a rule's braces,
  // whitespace collapsed and trimmed.
  function declText(block, start, end) {
    let decl = block.slice(start, end);
    decl = decl.replace(/\s+/g, ' ');
    decl = decl.replace(/^\s+|\s+$/g, '');
    return decl;
  }

  const STYLE_OPEN_RE = /<style\b[^>]*>/g;
  let sm;
  while ((sm = STYLE_OPEN_RE.exec(text)) !== null) {
    const blockStart = STYLE_OPEN_RE.lastIndex;
    const closeAt = text.indexOf('</style>', blockStart);
    if (closeAt < 0) break;
    const rawBlock = text.slice(blockStart, closeAt);

    // Blank CSS comments in place (keep embedded newlines) before scanning.
    const block = rawBlock.replace(/\/\*[\s\S]*?\*\//g, (c) => c.replace(/[^\n]/g, ' '));
    const len = block.length;

    let depth = 0;
    let marker = 0, interior = 0, curIsAt = 0, curSel = '', curLine = 0;
    // Child-level state — only meaningful while depth >= 1 AND curIsAt,
    // i.e. while scanning the direct children of the one open at-rule.
    let childMarker = 0, childInterior = 0, childIsAt = 0, childSel = '', childLine = 0;

    for (let i = 0; i < len; i++) {
      const c = block[i];
      if (c === '{') {
        if (depth === 0) {
          [curIsAt, curSel, curLine] = selInfo(block, blockStart, marker, i);
          interior = i + 1;
          if (curIsAt) childMarker = i + 1; // arm one level of child scanning
        } else if (depth === 1 && curIsAt) {
          [childIsAt, childSel, childLine] = selInfo(block, blockStart, childMarker, i);
          childInterior = i + 1;
        }
        depth++;
      } else if (c === '}') {
        if (depth > 0) depth--;
        if (depth === 1 && curIsAt) {
          // closes a direct child of the currently-open at-rule
          if (!childIsAt) {
            rows.push(`${childLine}\t${childSel}\t${declText(block, childInterior, i)}`);
          }
          childMarker = i + 1;
        } else if (depth === 0) {
          // closes the root-level thing itself (a plain rule, or the
          // at-rule wrapper — never emit the wrapper)
          if (!curIsAt) {
            rows.push(`${curLine}\t${curSel}\t${declText(block, interior, i)}`);
          }
          marker = i + 1;
        }
      }
    }
    // STYLE_OPEN_RE.lastIndex is untouched here, so the next exec() resumes
    // searching for <style> right after THIS open tag — same as perl's
    // pos()-driven /g loop, which never skips ahead to closeAt.
  }

  writeTsv('css_rules.tsv', rows);
}

// ---------------------------------------------------------------------------
// scripts.tsv + inline_script_N.js + scripts_uncommented.txt +
// syntax_errors.tsv — checks 15/16. Skips any <script src=…> (nothing to
// check) and an effectively-empty body. scripts_uncommented.txt is the
// concatenation of every inline-script body with comments stripped (same
// strip check 15 used to run per-script via perl): first remove /* */
// blocks, then remove // line comments only when preceded by start-of-line
// or whitespace (preserving that char, so http://... is never touched).
// This is the fix for the concurrency bug: check 15 now greps this ONE
// precomputed file instead of forking a process per inline script.
//
// syntax_errors.tsv is check 16, also folded into this single pass instead
// of forking `node --check` once per script. Each body is compiled
// in-process with vm.compileFunction(body, [], {filename}) — this wraps the
// body the same way Node's CommonJS module loader does, so it accepts a
// top-level `return` exactly as `node --check` does (a bare `new vm.Script`
// would reject that). One row per script that fails to compile.
// Known limitation: this validates as a CLASSIC script (CommonJS scope), so a
// `<script type="module">` using import/export/top-level await would be wrongly
// flagged — htmlizer's house style emits only classic inline scripts, so it
// can't arise on a generated page.
// ---------------------------------------------------------------------------
{
  const manifestRows = [];
  const strippedBodies = [];
  const syntaxErrorRows = [];
  const SCRIPT_RE = /<script\b([^>]*)>([\s\S]*?)<\/script>/g;
  let n = 0;
  let m;
  while ((m = SCRIPT_RE.exec(text)) !== null) {
    const attrs = m[1];
    const body = m[2];
    if (/\bsrc\s*=/.test(attrs)) continue;
    if (!/\S/.test(body)) continue;
    // The <script> tag's own page line (the match start) — not a body-local
    // offset.
    const line = lineOf(m.index);
    n++;
    const outfile = path.join(TMPDIR, `inline_script_${n}.js`);
    fs.writeFileSync(outfile, body);
    manifestRows.push(`${line}\t${outfile}`);

    try {
      vm.compileFunction(body, [], { filename: outfile });
    } catch (e) {
      const name = (e && e.name) || 'SyntaxError';
      const msg = String((e && e.message) || e);
      // V8 attaches "<filename>:<line>" as the first line of the stack for
      // a compile-time error — pull the script-local line out of it so the
      // HIGH can point at both the page line and the line inside the file.
      const firstStackLine = String((e && e.stack) || '').split('\n')[0];
      const lm = firstStackLine.match(/:(\d+)$/);
      const local = lm ? ` (script line ${lm[1]})` : '';
      syntaxErrorRows.push(`${line}\t${outfile}\t${name}: ${msg}${local}`);
    }

    let stripped = body.replace(/\/\*[\s\S]*?\*\//g, '');
    stripped = stripped.replace(/(^|\s)\/\/[^\n]*/gm, '$1');
    strippedBodies.push(stripped);
  }
  writeTsv('scripts.tsv', manifestRows);
  fs.writeFileSync(path.join(TMPDIR, 'scripts_uncommented.txt'), strippedBodies.join('\n'));
  writeTsv('syntax_errors.tsv', syntaxErrorRows);
}
