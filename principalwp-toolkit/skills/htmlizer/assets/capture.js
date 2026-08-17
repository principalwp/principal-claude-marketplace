/*
 * window.Capture — shared feedback-capture primitive for Principal WP review views.
 *
 * One tiny dependency-free module that every view loads via <script src="capture.js">.
 * It owns the plumbing that must be identical across all views: a local pending store,
 * coverage tracking, a single batched atomic submit, a clipboard "copy as prompt"
 * fallback (file:// safe), and a persistent "Submitted / Resubmit" action bar.
 *
 * Brand-agnostic: it ships only structural/neutral styling, exposed through CSS
 * custom properties and stable class hooks so a view can restyle it to the design
 * system. It injects its own fixed action bar only if the page provides no host.
 *
 * Public API (see references/views/_capture.md):
 *   Capture.init({ view, total })
 *   Capture.mark(id, value, opts)        // opts: { reason, note, anchor }
 *   Capture.unmark(id)
 *   Capture.rollup(verdict)
 *   Capture.payload()
 *   Capture.submit()  -> Promise
 *   Capture.onChange(cb) -> unsubscribe fn
 */
(function (window, document) {
  'use strict';

  if (window.Capture) { return; } // idempotent: never clobber an existing instance

  // ---- private state ------------------------------------------------------
  var state = {
    view: null,
    total: 0,
    items: new Map(),     // id -> { id, value, reason, note, anchor }
    coverageFn: null,     // optional (id, rec) -> boolean; when set, only matching items count toward coverage.engaged
    verdict: null,
    meta: {},             // view-supplied metadata (e.g. proposal baselines); merged into payload().meta
    gate: null,           // optional fn -> { ok:boolean, reason?:string }; blocks submit while ok===false
    submitted: false,
    busy: false,          // true while a submit POST is in flight
    gateMsgShown: false,  // whether the bar message currently shows a gate reason
    subscribers: [],
    bar: null,            // { host, ownsHost, status, submitBtn, copyBtn, badge }
    commentsEl: null,     // the auto-injected free-text "General comments" textarea (bottom of every page)
    booted: false,
    _settleSeq: 0,        // monotonic token; only the newest scrollToAndFlash settle loop may flash
    _inNotify: false,     // reentrancy latch — see notify()
    _inRender: false,     // reentrancy latch — see renderBar()
    _queuedChange: null
  };

  // ---- helpers ------------------------------------------------------------
  function nowISO() { return new Date().toISOString(); }

  function notify(change) {
    // change: { type, id?, value? } — best-effort, never let a subscriber throw out.
    // Subscribers may themselves call mark/rollup/setMeta (the derived-verdict pattern
    // rolls up inside onChange); a nested notify() must not recurse — unbounded, it
    // stalls the main thread for 100ms+ per event and snowballs typing into a
    // seconds-long frozen queue. Nested calls queue ONE follow-up pass instead.
    if (state._inNotify) { state._queuedChange = change || {}; return; }
    state._inNotify = true;
    try {
      var passes = 0;
      do {
        state._queuedChange = null;
        var snapshot = Capture.payload();
        for (var i = 0; i < state.subscribers.length; i++) {
          try { state.subscribers[i](snapshot, change || {}); }
          catch (e) { /* a broken listener must not break capture */ }
        }
        change = state._queuedChange;
      } while (change && ++passes < 8);
    } finally {
      state._inNotify = false;   // an unexpected throw must never wedge the latch shut
    }
    renderBar();
  }

  function asRecord(id, value, opts, prev) {
    opts = opts || {};
    var base = prev || { id: id, value: undefined, reason: undefined, note: undefined, anchor: undefined };
    return {
      id: id,
      value: value,
      // progressive disclosure: keep previously-supplied detail unless overwritten
      reason: 'reason' in opts ? opts.reason : base.reason,
      note: 'note' in opts ? opts.note : base.note,
      anchor: 'anchor' in opts ? opts.anchor : base.anchor
    };
  }

  // Canonical coverage numerator. By default every recorded item counts as
  // "engaged". A view may register a coverageFn (via setCoverage) so that only
  // the primary, bounded coverage units count — ancillary marks (section chips,
  // file-viewed flags, free inline comments) are then excluded so engaged can
  // never exceed total and the judged-vs-skipped fraction stays meaningful.
  function engagedCount() {
    if (!state.coverageFn) { return state.items.size; }
    var n = 0;
    state.items.forEach(function (rec) {
      try { if (state.coverageFn(rec.id, rec)) { n++; } } catch (e) { /* a broken filter must not break coverage */ }
    });
    return n;
  }

  // ---- core API -----------------------------------------------------------
  var Capture = {
    init: function (cfg) {
      cfg = cfg || {};
      if (cfg.view != null) { state.view = String(cfg.view); }
      if (cfg.total != null) { state.total = Number(cfg.total) || 0; }
      ensureBar();
      renderBar();
      return Capture;
    },

    mark: function (id, value, opts) {
      if (id == null) { throw new Error('Capture.mark requires a stable element id'); }
      id = String(id);
      var rec = asRecord(id, value, opts, state.items.get(id));
      state.items.set(id, rec);
      notify({ type: 'mark', id: id, value: value });
      return Capture;
    },

    unmark: function (id) {
      if (id == null) { return Capture; }
      id = String(id);
      if (state.items.delete(id)) {
        notify({ type: 'unmark', id: id });
      }
      return Capture;
    },

    rollup: function (verdict) {
      var v = verdict == null ? null : String(verdict);
      // unchanged verdict emits nothing — a derived verdict recomputed inside
      // onChange converges instead of looping
      if (v === state.verdict) { return Capture; }
      state.verdict = v;
      notify({ type: 'rollup', value: state.verdict });
      return Capture;
    },

    // Merge view-supplied metadata into the payload's meta block. This is the
    // delta-vs-proposal sink: a view records what the agent proposed (e.g.
    // recommended variant, proposed direction) so the human's result can be
    // diffed against it. Additive and backward-compatible: views that never
    // call setMeta keep the prior meta shape (built-in fields only).
    setMeta: function (obj) {
      if (obj && typeof obj === 'object') {
        for (var k in obj) {
          if (Object.prototype.hasOwnProperty.call(obj, k)) { state.meta[k] = obj[k]; }
        }
        notify({ type: 'meta' });
      }
      return Capture;
    },

    // Register an optional coverage filter. fn(id, rec) -> boolean decides which
    // recorded items count toward coverage.engaged (the canonical judged-vs-skipped
    // numerator). Additive: no filter => every item counts (prior behavior).
    setCoverage: function (fn) {
      state.coverageFn = (typeof fn === 'function') ? fn : null;
      notify({ type: 'coverage' });
      return Capture;
    },

    // Register an optional pre-submit gate. fn() must return { ok:boolean, reason?:string, focus? }.
    // While ok===false the Submit button stays CLICKABLE (not disabled); clicking it
    // does not POST — instead capture.js scrolls to and flashes the `focus` target so
    // the reviewer sees exactly what to complete. Additive: no gate => always submittable.
    setGate: function (fn) {
      state.gate = (typeof fn === 'function') ? fn : null;
      renderBar();
      return Capture;
    },

    payload: function () {
      var items = [];
      state.items.forEach(function (rec) {
        items.push({
          id: rec.id,
          value: rec.value,
          reason: rec.reason,
          note: rec.note,
          anchor: rec.anchor
        });
      });
      // Overlay view-supplied meta first, then stamp the built-in fields last so
      // they always reflect live state and can't be shadowed by a view.
      var meta = {};
      for (var mk in state.meta) {
        if (Object.prototype.hasOwnProperty.call(state.meta, mk)) { meta[mk] = state.meta[mk]; }
      }
      meta.generatedAt = nowISO();
      meta.href = (window.location && window.location.href) || null;
      meta.title = (document && document.title) || null;
      meta.userAgent = (window.navigator && window.navigator.userAgent) || null;
      meta.submitted = state.submitted;
      // Free-text general comments (auto-injected field at the bottom of the page).
      // Top-level and additive: null when the field is empty or not yet mounted.
      var comments = state.commentsEl ? String(state.commentsEl.value || '').trim() : '';
      return {
        // Thread-routing key: a random per-page value minted by the generating
        // thread (set via window.CAPTURE_CHANNEL). The board-server log is shared
        // by every thread on the box, so the Monitor greps the log for THIS page's
        // channel: a submit from another thread's page carries a different channel
        // and never wakes this one. Randomness is load-bearing, and the reason this
        // is not the session id: one session id can host sibling branches (a rewind
        // forks it), which would all derive the same channel and receive each
        // other's submits. null only on pages that predate the channel; a
        // channel-filtered Monitor won't match those, so a page and the Monitor
        // watching it must both carry the same value.
        channel: (window.CAPTURE_CHANNEL || null),
        view: state.view,
        verdict: state.verdict,
        items: items,
        comments: comments || null,
        coverage: { engaged: engagedCount(), total: state.total },
        meta: meta
      };
    },

    submit: function () {
      // In-flight guard: the UI disables the button while busy, but a programmatic
      // double Capture.submit() would otherwise fire two POSTs. Bail on the second.
      if (state.busy) { return Promise.resolve({ ok: false, blocked: true, reason: 'submit already in flight' }); }
      // Pre-submit gate (required-field signifier). Short-circuit without POSTing
      // when a view's gate is unsatisfied; the bar stays in its disabled state.
      if (state.gate) {
        var g;
        try { g = state.gate(); } catch (e) { g = null; }
        if (g && g.ok === false) {
          // Don't dead-end: take the reviewer to the first missing field and flash it.
          var target = resolveFocusTarget(g.focus);
          if (target) { scrollToAndFlash(target); }
          setBarSubmitted(state.submitted, g.reason || 'Complete the highlighted field to submit.', null, false);
          return Promise.resolve({ ok: false, blocked: true, reason: g && g.reason, focused: !!target });
        }
      }
      var url = window.CAPTURE_SUBMIT_URL;
      var data = Capture.payload();
      var body = JSON.stringify(data);
      setBarBusy(true);

      var attempt;
      if (!url) {
        attempt = Promise.reject(new Error('CAPTURE_SUBMIT_URL is not set'));
      } else if (typeof window.fetch === 'function') {
        attempt = window.fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: body,
          credentials: 'same-origin'
        }).then(function (res) {
          if (!res || !res.ok) {
            throw new Error('Submit failed: HTTP ' + (res ? res.status : '?'));
          }
          return res;
        });
      } else {
        attempt = Promise.reject(new Error('fetch is unavailable in this environment'));
      }

      return attempt.then(function () {
        state.submitted = true;
        setBarBusy(false);
        setBarSubmitted(true, null);
        return { ok: true, payload: data };
      }).catch(function (err) {
        // Fallback: hand the reviewer a paste-ready prompt instead of losing input.
        var prompt = toPrompt(data);
        return copyText(prompt).then(function (copied) {
          setBarBusy(false);
          setBarSubmitted(false, copied
            ? 'Submit failed — feedback copied to clipboard as a prompt. Paste it to Claude.'
            : 'Submit failed — copy the prompt below and paste it to Claude.', prompt, !copied);
          return { ok: false, error: String(err && err.message || err), copied: copied, prompt: prompt };
        });
      });
    },

    onChange: function (cb) {
      if (typeof cb !== 'function') { return function () {}; }
      state.subscribers.push(cb);
      return function unsubscribe() {
        var i = state.subscribers.indexOf(cb);
        if (i !== -1) { state.subscribers.splice(i, 1); }
      };
    }
  };

  // ---- prompt rendering (clipboard fallback) ------------------------------
  function toPrompt(data) {
    var lines = [];
    lines.push('You are receiving structured review feedback from a Principal WP feedback view.');
    lines.push('Treat each item as keyed to a stable element id (not re-quoted prose).');
    lines.push('');
    lines.push('View: ' + (data.view || '(unnamed)'));
    lines.push('Overall verdict: ' + (data.verdict || '(none recorded)'));
    lines.push('Coverage: ' + data.coverage.engaged + ' of ' + data.coverage.total + ' elements engaged');
    if (data.meta && data.meta.href) { lines.push('Source: ' + data.meta.href); }
    lines.push('');
    if (!data.items.length) {
      lines.push('No per-element dispositions were recorded.');
    } else {
      lines.push('Items:');
      data.items.forEach(function (it) {
        lines.push('- [' + formatValue(it.value) + '] ' + it.id);
        if (it.anchor != null && it.anchor !== '') { lines.push('    anchor: ' + it.anchor); }
        if (it.reason != null && it.reason !== '') { lines.push('    reason: ' + it.reason); }
        if (it.note != null && it.note !== '') { lines.push('    note: ' + it.note); }
      });
    }
    if (data.comments != null && data.comments !== '') {
      lines.push('');
      lines.push('General comments:');
      lines.push(data.comments);
    }
    lines.push('');
    lines.push('Raw payload:');
    lines.push(JSON.stringify(data, null, 2));
    return lines.join('\n');
  }

  function formatValue(v) {
    if (v == null) { return 'engaged'; }
    if (typeof v === 'object') { try { return JSON.stringify(v); } catch (e) { return String(v); } }
    return String(v);
  }

  // ---- clipboard (file:// safe) -------------------------------------------
  function copyText(text) {
    // Prefer the async Clipboard API; fall back to a hidden textarea + execCommand,
    // which is the only path that works on file:// pages and older engines.
    if (window.navigator && window.navigator.clipboard && window.navigator.clipboard.writeText) {
      return window.navigator.clipboard.writeText(text)
        .then(function () { return true; })
        .catch(function () { return legacyCopy(text); });
    }
    return Promise.resolve(legacyCopy(text));
  }

  function legacyCopy(text) {
    try {
      var ta = document.createElement('textarea');
      ta.value = text;
      ta.setAttribute('readonly', '');
      ta.style.position = 'fixed';
      ta.style.top = '-1000px';
      ta.style.left = '-1000px';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.select();
      ta.setSelectionRange(0, text.length);
      var ok = false;
      try { ok = document.execCommand('copy'); } catch (e) { ok = false; }
      document.body.removeChild(ta);
      return ok;
    } catch (e) {
      return false;
    }
  }

  // ---- attention: scroll to + flash a missing field ----------------------
  // A blocked Submit is not a dead end. Instead of a disabled button, the bar
  // stays clickable; on click while a gate is unmet we bring the first missing
  // field into view and flash it so the reviewer sees exactly what to complete.
  // The gate reports the target via its return value: { ok, reason, focus }.
  // `focus` may be a DOM element, a CSS selector, an array of either (first that
  // resolves wins), or a function returning any of those.
  function resolveFocusTarget(focus) {
    if (!focus) { return null; }
    if (typeof focus === 'function') { try { focus = focus(); } catch (e) { return null; } }
    if (!focus) { return null; }
    if (Array.isArray(focus)) {
      for (var i = 0; i < focus.length; i++) {
        var t = resolveFocusTarget(focus[i]);
        if (t) { return t; }
      }
      return null;
    }
    if (typeof focus === 'string') {
      try { return document.querySelector(focus); } catch (e) { return null; }
    }
    if (focus.nodeType === 1) { return focus; }
    return null;
  }

  function focusableWithin(el) {
    var sel = 'input,textarea,select,button,[tabindex],[contenteditable="true"]';
    if (el.matches && el.matches(sel)) { return el; }
    return el.querySelector ? el.querySelector(sel) : null;
  }

  function flashTarget(el) {
    if (!el || !el.classList) { return; }
    // Cancel any in-flight cleanup from a prior flash on this same element, or it
    // would strip .cap-flash mid-animation when we re-arm within the 4.2s window.
    if (el._capFlashT) { clearTimeout(el._capFlashT); el._capFlashT = null; }
    el.classList.remove('cap-flash');
    void el.offsetWidth; // reflow so the animation restarts if it's mid-flight
    el.classList.add('cap-flash');
    var f = focusableWithin(el);
    if (f) { try { f.focus({ preventScroll: true }); } catch (e) { try { f.focus(); } catch (e2) {} } }
    el._capFlashT = window.setTimeout(function () { el.classList.remove('cap-flash'); el._capFlashT = null; }, 4200);
  }

  function scrollToAndFlash(el) {
    if (!el) { return; }
    // Smooth scroll must honor prefers-reduced-motion: the CSS reduced-motion guard
    // governs the flash animation, not the JS scroll behavior, so resolve it here.
    var reduce = !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion:reduce)').matches);
    try { el.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'center' }); }
    catch (e) { try { el.scrollIntoView(); } catch (e2) {} }
    // Single active-settle token: each blocked Submit click starts a fresh settle
    // loop. Stamp this loop's seq and bail if a newer click superseded it, so a
    // stale loop can't flash a field the reviewer has already moved past.
    var seq = ++state._settleSeq;
    // Wait for the smooth scroll to settle so the flash lands AFTER motion stops,
    // not during it. Poll the scroll position until it's stable for a few frames,
    // with a hard cap so the flash always fires even if nothing moved.
    var lastY = (window.pageYOffset || 0), stable = 0, start = nowMs(), moved = false;
    function tick() {
      if (seq !== state._settleSeq) { return; } // superseded by a newer blocked-submit; don't flash
      var y = window.pageYOffset || 0;
      if (Math.abs(y - lastY) >= 1) { moved = true; }
      stable = (Math.abs(y - lastY) < 1) ? stable + 1 : 0;
      lastY = y;
      // Don't accept "stable" until either motion was actually observed OR ~120ms
      // has elapsed — otherwise we flash before the smooth scroll even begins.
      // If the page was already in position (no scroll needed), motion never starts
      // but the 120ms floor still lets us fire promptly. Hard cap at 2.5s.
      var elapsed = nowMs() - start;
      var settled = stable >= 3 && (moved || elapsed > 120);
      if (settled || elapsed > 2500) { flashTarget(el); return; }
      schedule(tick);
    }
    schedule(tick);
  }

  function nowMs() { return (window.performance && window.performance.now) ? window.performance.now() : new Date().getTime(); }
  function schedule(fn) {
    // Bind to window: calling a detached requestAnimationFrame reference throws
    // "Illegal invocation" in strict mode, which would abort the whole scroll+flash.
    if (window.requestAnimationFrame) { window.requestAnimationFrame(fn); }
    else { window.setTimeout(fn, 16); }
  }

  // ---- action bar ---------------------------------------------------------
  // The bar is a thin DOM rendering of the same state. A page may supply a host
  // element (id="capture-bar" or [data-capture-bar]); otherwise we inject a fixed
  // one. All visuals are themeable via the cap-* classes and --cap-* variables.
  function whenReady(fn) {
    if (document.body) { fn(); return; }
    document.addEventListener('DOMContentLoaded', fn, { once: true });
  }

  function injectStyleOnce() {
    if (document.getElementById('cap-style')) { return; }
    var css =
      ':root{--cap-bg:#1b2a4a;--cap-fg:#fff;--cap-muted:#a8c0cf;' +
      '--cap-accent:#8c3344;--cap-accent-hover:#6d2735;--cap-accent-fg:#fff;' +
      '--cap-border:rgba(255,255,255,.18);--cap-ok:#639922;--cap-radius:6px;' +
      '--cap-flash-halo:rgba(140,51,68,.28)}' +
      '.cap-bar{position:fixed;left:0;right:0;bottom:0;z-index:2147483000;' +
      'display:flex;align-items:center;gap:14px;padding:10px 18px;' +
      'background:var(--cap-bg);color:var(--cap-fg);' +
      'font-family:ui-sans-serif,system-ui,sans-serif;font-size:13px;' +
      'border-top:1px solid var(--cap-border);box-sizing:border-box}' +
      '.cap-bar.cap-host{position:static;border-top:0;background:none;color:inherit;padding:0}' +
      // Attribution: a small plain muted text link, leftmost in the bar's real flex row
      // (the fixed bar sits at the page bottom, so leftmost here reads as bottom-left).
      // No pill/badge — plain text, underline only on hover/focus, themed via --cap-muted
      // so base.css's light remap (var(--text-muted)) picks it up for free.
      '.cap-attribution{flex:0 0 auto;font-size:11px;color:var(--cap-muted);' +
      'text-decoration:none;white-space:nowrap}' +
      '.cap-attribution:hover,.cap-attribution:focus-visible{text-decoration:underline}' +
      '.cap-status{flex:1 1 auto;min-width:0;display:flex;flex-wrap:wrap;align-items:center;gap:6px 14px}' +
      '.cap-cov{font-variant-numeric:tabular-nums;color:var(--cap-muted)}' +
      '.cap-verdict{color:var(--cap-muted)}' +
      '.cap-msg{flex-basis:100%;color:var(--cap-muted);font-size:12px}' +
      '.cap-badge{display:none;align-items:center;gap:6px;color:var(--cap-ok);font-weight:600}' +
      '.cap-bar[data-submitted="true"] .cap-badge{display:inline-flex}' +
      '.cap-dot{width:8px;height:8px;border-radius:50%;background:var(--cap-ok);display:inline-block}' +
      '.cap-actions{display:flex;gap:8px;flex:0 0 auto}' +
      '.cap-btn{font:inherit;cursor:pointer;border-radius:var(--cap-radius);' +
      'padding:8px 16px;border:1px solid transparent;line-height:1}' +
      '.cap-submit{background:var(--cap-accent);color:var(--cap-accent-fg)}' +
      '.cap-submit:hover{background:var(--cap-accent-hover)}' +
      '.cap-bar[data-submitted="true"] .cap-submit{background:var(--cap-ok)}' +
      '.cap-bar[data-submitted="true"] .cap-submit:hover{background:var(--cap-ok);filter:brightness(.92)}' +
      '.cap-submit[disabled]{opacity:.6;cursor:progress}' +
      '.cap-copy{background:transparent;color:inherit;border-color:var(--cap-border);' +
      'text-decoration:underline;text-underline-offset:2px}' +
      '.cap-fallback{flex-basis:100%;width:100%;margin-top:6px;display:none;' +
      'min-height:64px;font-family:ui-monospace,monospace;font-size:11px;' +
      'border-radius:var(--cap-radius);border:1px solid var(--cap-border);padding:8px;' +
      'background:rgba(0,0,0,.18);color:var(--cap-fg);box-sizing:border-box}' +
      '.cap-bar[data-fallback="true"] .cap-fallback{display:block}' +
      // General-comments block: an auto-injected free-text field that sits as the
      // last content block on every page (normal flow, above the fixed bar). It
      // self-centers to the page measure (--cap-maxw, themed to --maxw by base.css)
      // so it aligns with .wrap content without depending on the view's markup.
      // Label uses color:inherit so it reads correctly on the page bg in both the
      // themed (base.css) and unthemed standalone cases; the textarea uses the same
      // --cap-* tokens as the bar, so base.css's light remap themes it for free.
      '.cap-comments{max-width:var(--cap-maxw,1040px);margin:36px auto 0;padding:0 24px;' +
      'box-sizing:border-box;font-family:ui-sans-serif,system-ui,sans-serif}' +
      '.cap-comments-label{display:block;font-size:13px;font-weight:600;color:inherit;margin:0 0 6px}' +
      '.cap-comments-hint{font-weight:400;opacity:.65}' +
      '.cap-comments-input{display:block;width:100%;min-height:80px;box-sizing:border-box;' +
      'font-family:inherit;font-size:15px;line-height:1.5;color:var(--cap-fg);' +
      'background:var(--cap-bg);border:1px solid var(--cap-border);' +
      'border-radius:var(--cap-radius);padding:10px 12px;resize:vertical}' +
      '.cap-comments-input:focus{outline:none;border-color:var(--cap-accent);' +
      'box-shadow:0 0 0 3px var(--cap-flash-halo)}' +
      // Attention flash: when Submit is clicked with a required field unmet, the
      // missing element gets .cap-flash — a brief shake plus a cranberry ring that
      // pulses 4x, then clears. The ring is an OUTLINE (not box-shadow) so it is
      // never clipped by an overflow:hidden ancestor (cards, code panes, editor
      // wraps). Applied to PAGE elements (not the bar), so these rules are global.
      // Honors prefers-reduced-motion (one static ring, no shake, no pulse loop).
      '.cap-flash{animation:cap-flash-shake 2s ease both,cap-flash-pulse .9s ease-in-out 4 both;' +
      'border-radius:var(--cap-radius);position:relative;z-index:1;' +
      'outline:3px solid transparent;outline-offset:2px}' +
      // Shake: decaying oscillation across the full 2s so it keeps wiggling, not slow-mo.
      '@keyframes cap-flash-shake{0%{transform:translateX(0)}4%{transform:translateX(-7px)}' +
      '8%{transform:translateX(7px)}12%{transform:translateX(-6px)}16%{transform:translateX(6px)}' +
      '20%{transform:translateX(-6px)}24%{transform:translateX(6px)}28%{transform:translateX(-5px)}' +
      '32%{transform:translateX(5px)}36%{transform:translateX(-5px)}40%{transform:translateX(5px)}' +
      '44%{transform:translateX(-4px)}48%{transform:translateX(4px)}52%{transform:translateX(-4px)}' +
      '56%{transform:translateX(4px)}60%{transform:translateX(-3px)}64%{transform:translateX(3px)}' +
      '68%{transform:translateX(-3px)}72%{transform:translateX(3px)}76%{transform:translateX(-2px)}' +
      '80%{transform:translateX(2px)}84%{transform:translateX(-2px)}88%{transform:translateX(1px)}' +
      '92%{transform:translateX(-1px)}96%{transform:translateX(1px)}100%{transform:translateX(0)}}' +
      // Pulse: outline ring fades in and out, repeated 4x (.9s each) — the outline
      // is not clipped by ancestor overflow the way a box-shadow ring would be.
      '@keyframes cap-flash-pulse{0%,100%{outline-color:transparent}' +
      '50%{outline-color:var(--cap-accent)}}' +
      // Reduced motion: a single static cranberry ring (no shake, no pulse loop),
      // held until flashTarget() removes the class.
      '@media (prefers-reduced-motion:reduce){.cap-flash{animation:none;outline-color:var(--cap-accent)}}';
    var el = document.createElement('style');
    el.id = 'cap-style';
    el.textContent = css;
    (document.head || document.documentElement).appendChild(el);
  }

  function buildBarInto(host, ownsHost) {
    host.classList.add('cap-bar');
    if (!ownsHost) { host.classList.add('cap-host'); }
    host.setAttribute('data-submitted', 'false');
    host.setAttribute('role', 'region');
    host.setAttribute('aria-label', 'Review feedback actions');

    // Attribution — plain muted text link, leftmost in the bar so it reads bottom-left.
    var attribution = document.createElement('a');
    attribution.className = 'cap-attribution';
    attribution.href = 'https://principalwp.com';
    attribution.target = '_blank';
    attribution.rel = 'noopener';
    attribution.textContent = 'htmlizer is a product of PrincipalWP.com';

    var status = document.createElement('div');
    status.className = 'cap-status';

    var cov = document.createElement('span');
    cov.className = 'cap-cov';

    var verdict = document.createElement('span');
    verdict.className = 'cap-verdict';

    var badge = document.createElement('span');
    badge.className = 'cap-badge';
    badge.innerHTML = '<span class="cap-dot"></span><span>Submitted</span>';

    var msg = document.createElement('span');
    msg.className = 'cap-msg';

    status.appendChild(cov);
    status.appendChild(verdict);
    status.appendChild(badge);
    status.appendChild(msg);

    var actions = document.createElement('div');
    actions.className = 'cap-actions';

    var copyBtn = document.createElement('button');
    copyBtn.type = 'button';
    copyBtn.className = 'cap-btn cap-copy';
    copyBtn.textContent = 'Copy as prompt';
    copyBtn.addEventListener('click', function () {
      copyText(toPrompt(Capture.payload())).then(function (ok) {
        setBarSubmitted(state.submitted,
          ok ? 'Copied feedback to clipboard as a prompt.' : 'Could not copy — select the text below.',
          ok ? null : toPrompt(Capture.payload()), !ok);
      });
    });

    var submitBtn = document.createElement('button');
    submitBtn.type = 'button';
    submitBtn.className = 'cap-btn cap-submit';
    submitBtn.textContent = 'Submit to Claude';
    submitBtn.addEventListener('click', function () { Capture.submit(); });

    actions.appendChild(copyBtn);
    actions.appendChild(submitBtn);

    var fallback = document.createElement('textarea');
    fallback.className = 'cap-fallback';
    fallback.readOnly = true;
    fallback.setAttribute('aria-label', 'Feedback prompt to copy manually');

    host.appendChild(attribution);
    host.appendChild(status);
    host.appendChild(actions);
    host.appendChild(fallback);

    state.bar = {
      host: host, ownsHost: ownsHost,
      cov: cov, verdict: verdict, badge: badge, msg: msg,
      submitBtn: submitBtn, copyBtn: copyBtn, fallback: fallback
    };
  }

  // Inject the free-text "General comments" field as the last content block on the
  // page (normal flow, above the fixed bar). Runs regardless of whether the page
  // hosts the bar itself, so every view gets the field for free. Idempotent.
  function ensureComments() {
    // Opt-out: a view that ALREADY renders its own whole-page ("comment on the
    // whole") affordance sets window.CAPTURE_NO_COMMENTS so we don't add a second,
    // duplicate field. This is only for a genuine global comment box — per-element
    // reason/note/escape-hatch boxes are NOT a whole-page comment; don't set it for
    // those, or the page loses its guaranteed comment-on-the-whole catch-all.
    if (window.CAPTURE_NO_COMMENTS) { return; }
    if (state.commentsEl || document.getElementById('cap-comments')) { return; }
    var sec = document.createElement('section');
    sec.id = 'cap-comments';
    sec.className = 'cap-comments';

    var label = document.createElement('label');
    label.className = 'cap-comments-label';
    label.setAttribute('for', 'cap-comments-input');
    label.appendChild(document.createTextNode('General comments '));
    var hint = document.createElement('span');
    hint.className = 'cap-comments-hint';
    hint.textContent = '— anything not tied to a specific item above';
    label.appendChild(hint);

    var ta = document.createElement('textarea');
    ta.id = 'cap-comments-input';
    ta.className = 'cap-comments-input';
    ta.setAttribute('rows', '3');
    ta.setAttribute('placeholder', 'Optional — overall thoughts, missing context, or a general note for Claude.');

    sec.appendChild(label);
    sec.appendChild(ta);
    document.body.appendChild(sec);
    state.commentsEl = ta;
  }

  function ensureBar() {
    if (state.bar || state.booted) { return; }
    whenReady(function () {
      if (state.bar) { return; }
      injectStyleOnce();
      ensureComments();
      var host = document.getElementById('capture-bar') || document.querySelector('[data-capture-bar]');
      var ownsHost = false;
      if (!host) {
        host = document.createElement('div');
        host.id = 'capture-bar';
        ownsHost = true;
        document.body.appendChild(host);
      }
      buildBarInto(host, ownsHost);
      state.booted = true;
      renderBar();
    });
  }

  function renderBar() {
    var b = state.bar;
    if (!b) { return; }
    // Reentrancy guard — the mirror of notify()'s _inNotify latch, and needed for the
    // same reason at a different door. notify() releases _inNotify in its finally and
    // THEN calls us, so by the time state.gate() runs below, that latch is open again.
    // A gate that writes (Capture.mark/rollup/unmark) therefore starts a fresh notify,
    // which calls renderBar, which calls the gate… unbounded, and invisible: the
    // try/catch around the gate swallows the RangeError and the bar reads as unblocked.
    // The gate is documented as a pure read (references/views/_capture.md) — this makes
    // breaking that rule a dropped frame instead of a locked-up page.
    if (state._inRender) { return; }
    state._inRender = true;
    try { renderBarBody(b); } finally { state._inRender = false; }
  }

  function renderBarBody(b) {
    b.cov.textContent = 'Coverage ' + engagedCount() + '/' + state.total + ' engaged';
    b.verdict.textContent = state.verdict ? ('Verdict: ' + state.verdict) : '';
    b.host.setAttribute('data-submitted', state.submitted ? 'true' : 'false');

    // Busy wins: keep the button disabled while a POST is in flight.
    if (state.busy) {
      b.submitBtn.textContent = 'Submitting…';
      b.submitBtn.setAttribute('disabled', '');
      b.submitBtn.removeAttribute('title');
      return;
    }
    b.submitBtn.textContent = state.submitted ? 'Resubmit' : 'Submit to Claude';

    // Gate: disable + surface the reason while unsatisfied.
    var blocked = false, reason = '';
    if (state.gate) {
      var g;
      try { g = state.gate(); } catch (e) { g = null; }
      if (g && g.ok === false) { blocked = true; reason = g.reason || ''; }
    }
    // The button stays ENABLED while blocked: clicking it takes the reviewer to the
    // missing field and flashes it (see submit()), which is a clearer signifier than
    // a greyed-out button. We keep a short ambient reason line + tooltip as context.
    if (blocked) {
      b.submitBtn.removeAttribute('disabled');
      b.submitBtn.setAttribute('title', reason);
      b.msg.textContent = reason;
      state.gateMsgShown = true;
    } else {
      b.submitBtn.removeAttribute('disabled');
      b.submitBtn.removeAttribute('title');
      if (state.gateMsgShown) { b.msg.textContent = ''; state.gateMsgShown = false; }
    }
  }

  function setBarBusy(busy) {
    state.busy = !!busy;
    renderBar();
  }

  function setBarSubmitted(submitted, message, fallbackText, showFallback) {
    state.submitted = !!submitted;
    var b = state.bar;
    if (!b) { return; }
    renderBar();
    b.msg.textContent = message || '';
    // An explicit submit/copy message is not a gate message; don't let the next
    // unblocked render clear it as if it were one.
    state.gateMsgShown = false;
    if (fallbackText != null) { b.fallback.value = fallbackText; }
    b.host.setAttribute('data-fallback', showFallback ? 'true' : 'false');
    if (showFallback && b.fallback) {
      try { b.fallback.focus(); b.fallback.select(); } catch (e) {}
    }
  }

  // ---- expose -------------------------------------------------------------
  window.Capture = Capture;
})(window, document);
