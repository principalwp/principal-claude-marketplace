/*
 * wpp-runtime.js — tiny prototype runtime. No dependencies.
 *
 * Features (all opt-in via data attributes):
 *   - Screens/variants: <section data-screen="id" data-title="Variant A — compact">
 *     Hash-routed (#/id) so the back button works and states are linkable.
 *     A floating switcher bar is auto-built when there is more than one screen.
 *   - Tabs: <button data-tab="id"> + <div data-tab-panel="id"> inside a
 *     [data-tab-group] container. Active button gets .is-active (classic admin
 *     nav-tabs get .nav-tab-active instead).
 *   - Collapsible panels: .components-panel__body-title click toggles .is-opened
 *     (Gutenberg), .postbox .handlediv click toggles .closed (classic metabox).
 *   - Generic toggle: <button data-toggle="#selector" data-toggle-class="is-open">
 *   - Notes: <span data-note="annotation"> — toggled by the ✎ button in the bar.
 *   - Value swapping: a control marked [data-swap-control="units"] rewrites every
 *     [data-swap="units"] in the same screen to its per-value dataset entry, e.g.
 *     <span data-swap="units" data-f="54°F" data-c="12°C"> follows a radio/select
 *     whose value is "f" or "c". Lets one mockup show both unit systems, both
 *     currencies, logged-in vs logged-out copy, etc.
 *   - Viewport preview: <button data-viewport="desktop|tablet|mobile"> narrows the
 *     canvas the way Gutenberg's preview menu does, so reviewers can see a layout
 *     break before it is built.
 *   - Charts: <div data-chart="54,55,56" data-chart-type="area|line|bars">
 *     draws a small trend chart. Optional data-chart-labels, data-chart-values,
 *     data-chart-height, data-chart-suffix.
 *   - Control → canvas: <input data-mirror="heading"> writes into
 *     [data-mirror-target="heading"]; <input type="checkbox" data-reveals="x">
 *     shows/hides [data-reveal="x"]. Wire only the controls the design question
 *     turns on — a fixed realistic value beats a simulated one everywhere else.
 *   - Shared chrome: <template data-chrome="editor"> with [data-slot="canvas"]
 *     markers; a screen supplies [data-fill="canvas"] instead of repeating the
 *     whole shell.
 */
(function () {
  'use strict';

  /* ---------- shared chrome ----------
     At three or more screens, repeating the editor shell in every one is most
     of the document. Put it in <template data-chrome="editor"> with <div
     data-slot="canvas"> markers, and let each screen supply only <div
     data-fill="canvas">. Runs first, because everything below reads the DOM. */
  Array.prototype.forEach.call(document.querySelectorAll('[data-screen][data-chrome]'), function (screen) {
    var tpl = document.querySelector('template[data-chrome="' + screen.dataset.chrome + '"]');
    if (!tpl) return;
    var fills = {};
    Array.prototype.forEach.call(screen.querySelectorAll('[data-fill]'), function (el) {
      fills[el.dataset.fill] = el;
    });
    var clone = tpl.content.cloneNode(true);
    Array.prototype.forEach.call(clone.querySelectorAll('[data-slot]'), function (slot) {
      var fill = fills[slot.dataset.slot];
      if (!fill) return;
      while (fill.firstChild) slot.appendChild(fill.firstChild);
    });
    screen.textContent = '';
    screen.appendChild(clone);
  });

  /* ---------- screens + variant bar ---------- */
  var screens = Array.prototype.slice.call(document.querySelectorAll('[data-screen]'));

  /* Per-screen rationale, shown in a strip just above the bar. It overlays the
     page instead of pushing it, so a screen's reasoning is readable without
     costing the mockup any height. One line, clipped — click it to see the rest. */
  var infoEl = null;
  var screenSelect = null;
  var countEl = null;
  if (screens.some(function (s) { return s.dataset.subtitle; })) {
    infoEl = document.createElement('div');
    infoEl.className = 'wpp-info';
    infoEl.title = 'Click to expand';
    infoEl.addEventListener('click', function () { infoEl.classList.toggle('is-expanded'); });
    document.body.appendChild(infoEl);
  }

  function drawInfo() {
    if (!infoEl) return;
    var id = currentId();
    var match = screens.filter(function (s) { return s.dataset.screen === id; })[0];
    var text = match && match.dataset.subtitle;
    infoEl.textContent = text || '';
    infoEl.classList.toggle('wpp-hidden', !text);
  }

  function currentId() {
    var h = location.hash.replace(/^#\/?/, '');
    return h && screens.some(function (s) { return s.dataset.screen === h; })
      ? h
      : (screens[0] ? screens[0].dataset.screen : null);
  }

  /* Note bubbles are real absolutely-positioned elements (never ::after —
     that collides with wp-clearfix/dashicons pseudo-elements). Rebuilt on
     every toggle, screen switch, resize, and click so they track layout. */
  function drawNotes() {
    Array.prototype.forEach.call(document.querySelectorAll('.wpp-note-bubble'), function (b) { b.remove(); });
    if (!document.body.classList.contains('wpp-notes-on')) return;
    Array.prototype.forEach.call(document.querySelectorAll('[data-note]'), function (el) {
      var r = el.getBoundingClientRect();
      if (!r.width && !r.height) return; // hidden (inactive screen, collapsed panel)
      var b = document.createElement('div');
      b.className = 'wpp-note-bubble';
      b.textContent = el.dataset.note;
      b.style.left = (r.left + window.scrollX) + 'px';
      b.style.top = (r.bottom + window.scrollY + 6) + 'px';
      document.body.appendChild(b);
    });
  }
  window.addEventListener('resize', drawNotes);
  // capture phase: editor-style shells scroll inside inner containers, and
  // those scroll events don't bubble
  var scrollPending = false;
  document.addEventListener('scroll', function () {
    if (scrollPending || !document.body.classList.contains('wpp-notes-on')) return;
    scrollPending = true;
    requestAnimationFrame(function () { scrollPending = false; drawNotes(); });
  }, true);

  function render() {
    var id = currentId();
    screens.forEach(function (s) {
      s.classList.toggle('wpp-active', s.dataset.screen === id);
    });
    if (screenSelect) screenSelect.value = id;
    if (countEl) {
      var pos = 0;
      screens.forEach(function (s, i) { if (s.dataset.screen === id) pos = i + 1; });
      countEl.textContent = pos + '/' + screens.length;
    }
    drawInfo();
    drawNotes();
  }

  if (screens.length) {
    window.addEventListener('hashchange', render);
    render();
  }

  var hasNotes = document.querySelector('[data-note]') !== null;
  if (screens.length > 1 || hasNotes || infoEl) {
    /* One row, always. A button per screen looked fine at two screens and ran
       off both edges of the window at six, so the switcher is a dropdown plus
       arrows — same width whether there are two screens or twenty. */
    var bar = document.createElement('div');
    bar.className = 'wpp-bar';
    var label = document.createElement('span');
    label.className = 'wpp-bar__label';
    label.textContent = 'prototype';
    bar.appendChild(label);

    if (screens.length > 1) {
      var step = function (delta) {
        var ids = screens.map(function (s) { return s.dataset.screen; });
        var i = ids.indexOf(currentId());
        location.hash = '#/' + ids[(i + delta + ids.length) % ids.length];
      };

      var prev = document.createElement('button');
      prev.className = 'wpp-bar__nav';
      prev.textContent = '‹';
      prev.title = 'Previous screen';
      prev.addEventListener('click', function () { step(-1); });
      bar.appendChild(prev);

      var wrap = document.createElement('span');
      wrap.className = 'wpp-bar__sel';
      screenSelect = document.createElement('select');
      screens.forEach(function (s) {
        var o = document.createElement('option');
        o.value = s.dataset.screen;
        o.textContent = s.dataset.title || s.dataset.screen;
        screenSelect.appendChild(o);
      });
      screenSelect.addEventListener('change', function () { location.hash = '#/' + screenSelect.value; });
      wrap.appendChild(screenSelect);
      bar.appendChild(wrap);

      var next = document.createElement('button');
      next.className = 'wpp-bar__nav';
      next.textContent = '›';
      next.title = 'Next screen';
      next.addEventListener('click', function () { step(1); });
      bar.appendChild(next);

      countEl = document.createElement('span');
      countEl.className = 'wpp-bar__count';
      bar.appendChild(countEl);
    }
    if (infoEl) {
      var i = document.createElement('button');
      i.textContent = 'ⓘ';
      i.title = 'Toggle the rationale line';
      i.className = 'wpp-bar__icon wpp-on';
      i.addEventListener('click', function () {
        var off = document.body.classList.toggle('wpp-info-off');
        i.classList.toggle('wpp-on', !off);
      });
      bar.appendChild(i);
    }
    if (hasNotes) {
      var n = document.createElement('button');
      n.className = 'wpp-bar__icon';
      n.textContent = '✎';
      n.title = 'Toggle annotations';
      n.addEventListener('click', function () {
        document.body.classList.toggle('wpp-notes-on');
        n.classList.toggle('wpp-on', document.body.classList.contains('wpp-notes-on'));
        drawNotes();
      });
      bar.appendChild(n);
    }
    document.body.appendChild(bar);
    render();
  }

  /* ---------- tabs ---------- */
  document.addEventListener('click', function (e) {
    var tab = e.target.closest('[data-tab]');
    if (!tab) return;
    var group = tab.closest('[data-tab-group]') || document;
    var id = tab.dataset.tab;
    // only touch this group's own tabs/panels, not a nested group's
    Array.prototype.forEach.call(group.querySelectorAll('[data-tab]'), function (t) {
      if ((t.closest('[data-tab-group]') || document) !== group) return;
      t.classList.toggle('is-active', t === tab);
      t.classList.toggle('nav-tab-active', t === tab && t.classList.contains('nav-tab'));
    });
    Array.prototype.forEach.call(group.querySelectorAll('[data-tab-panel]'), function (p) {
      if ((p.closest('[data-tab-group]') || document) !== group) return;
      p.style.display = p.dataset.tabPanel === id ? '' : 'none';
    });
    e.preventDefault();
  });

  /* ---------- collapsible panels ---------- */
  document.addEventListener('click', function (e) {
    if (e.target.closest('[data-tab]')) return; // a tab inside a panel title is a tab, not a collapse
    var title = e.target.closest('.components-panel__body-title');
    if (title && title.parentElement.classList.contains('components-panel__body')) {
      title.parentElement.classList.toggle('is-opened');
      return;
    }
    var handle = e.target.closest('.postbox .handlediv, .postbox .hndle');
    if (handle) handle.closest('.postbox').classList.toggle('closed');
  });

  /* ---------- generic toggle ---------- */
  document.addEventListener('click', function (e) {
    var t = e.target.closest('[data-toggle]');
    if (!t) return;
    var target = document.querySelector(t.dataset.toggle);
    if (target) target.classList.toggle(t.dataset.toggleClass || 'is-open');
  });

  /* ---------- value swapping (units, currency, locale, …) ---------- */
  function scopeOf(el) { return el.closest('[data-screen]') || document; }

  /* A control's current value: its own .value if it is a <select>, otherwise
     the value of whichever radio inside it is checked. */
  function controlValue(ctrl) {
    if (ctrl.tagName === 'SELECT') return ctrl.value;
    var checked = ctrl.querySelector('input:checked');
    return checked ? checked.value : null;
  }

  function applySwap(ctrl) {
    var group = ctrl.dataset.swapControl;
    var value = controlValue(ctrl);
    if (!group || !value) return;
    Array.prototype.forEach.call(
      scopeOf(ctrl).querySelectorAll('[data-swap="' + group + '"]'),
      function (el) {
        var text = el.dataset[value];
        if (text === undefined) return;
        // A chart swaps its numbers and redraws; everything else swaps its text.
        if (el.hasAttribute('data-chart')) {
          el.dataset.chart = text;
          chartify(el);
        } else {
          el.textContent = text;
        }
      }
    );
  }

  document.addEventListener('change', function (e) {
    var ctrl = e.target.closest('[data-swap-control]');
    if (ctrl) applySwap(ctrl);
  });

  /* Seed from the markup's own checked/selected state, so authors don't have to
     keep the visible text in sync with the data- attributes by hand. */
  Array.prototype.forEach.call(document.querySelectorAll('[data-swap-control]'), applySwap);

  /* ---------- control → canvas ----------
     Deliberately small. A mockup only needs the one or two controls that carry
     the design question to actually move; simulating the rest is how a
     prototype turns into a half-built feature. If something needs real
     computation, show a fixed realistic number instead. */

  /* <input data-mirror="heading"> → <h2 data-mirror-target="heading"> */
  function applyMirror(input) {
    var key = input.dataset.mirror;
    Array.prototype.forEach.call(
      scopeOf(input).querySelectorAll('[data-mirror-target="' + key + '"]'),
      function (el) {
        var text = input.value.trim() ? input.value : (el.dataset.mirrorEmpty || '');
        el.textContent = (el.dataset.mirrorPrefix || '') + text + (el.dataset.mirrorSuffix || '');
      }
    );
  }

  /* <input type="checkbox" data-reveals="caption"> → [data-reveal="caption"] */
  function applyReveal(input) {
    var key = input.dataset.reveals;
    Array.prototype.forEach.call(
      scopeOf(input).querySelectorAll('[data-reveal="' + key + '"]'),
      function (el) { el.classList.toggle('wpp-hidden', !input.checked); }
    );
  }

  document.addEventListener('input', function (e) {
    if (e.target.dataset && e.target.dataset.mirror) applyMirror(e.target);
  });
  document.addEventListener('change', function (e) {
    if (!e.target.dataset) return;
    if (e.target.dataset.mirror) applyMirror(e.target);
    if (e.target.dataset.reveals) applyReveal(e.target);
  });
  Array.prototype.forEach.call(document.querySelectorAll('[data-mirror]'), applyMirror);
  Array.prototype.forEach.call(document.querySelectorAll('[data-reveals]'), applyReveal);

  /* ---------- viewport preview ---------- */
  document.addEventListener('click', function (e) {
    var btn = e.target.closest('[data-viewport]');
    if (!btn) return;
    var scope = scopeOf(btn);
    var target = scope.querySelector('[data-viewport-target]')
      || scope.querySelector('.interface-interface-skeleton__content, .wpadmin7-content, .wrap');
    if (target) {
      target.classList.remove('wpp-vp-tablet', 'wpp-vp-mobile');
      if (btn.dataset.viewport !== 'desktop') target.classList.add('wpp-vp-' + btn.dataset.viewport);
    }
    Array.prototype.forEach.call(scope.querySelectorAll('[data-viewport]'), function (o) {
      o.classList.toggle('is-pressed', o === btn);
    });
  });

  /* ---------- charts ---------- */
  function chartify(el) {
    var vals = [];
    (el.dataset.chart || '').split(',').forEach(function (s) {
      var n = parseFloat(s);
      if (!isNaN(n)) vals.push(n);
    });
    if (vals.length < 2) return;

    var type = el.dataset.chartType || 'area';
    var labels = el.dataset.chartLabels ? el.dataset.chartLabels.split(',') : null;
    var suffix = el.dataset.chartSuffix || '';
    var showVals = el.hasAttribute('data-chart-values');
    var min = Math.min.apply(null, vals);
    var max = Math.max.apply(null, vals);
    var span = (max - min) || 1;
    var head = showVals ? 24 : 8;               // % kept clear at the top for value labels
    var norm = function (v) { return (v - min) / span; };
    var y = function (v) { return head + (1 - norm(v)) * (100 - head - 6); };
    var x = function (i) { return (i / (vals.length - 1)) * 100; };

    el.classList.add('wpp-chart', 'is-' + type);
    if (el.dataset.chartHeight) el.style.setProperty('--wpp-chart-h', parseInt(el.dataset.chartHeight, 10) + 'px');

    var plot = document.createElement('div');
    plot.className = 'wpp-chart__plot';

    if (type === 'bars') {
      vals.forEach(function (v) {
        var bar = document.createElement('i');
        bar.className = 'wpp-chart__bar';
        bar.style.height = (18 + norm(v) * 82) + '%';
        if (showVals) bar.setAttribute('data-v', v + suffix);
        plot.appendChild(bar);
      });
    } else {
      // preserveAspectRatio="none" + non-scaling-stroke: the shape stretches to
      // whatever width the block is, the line stays 2px.
      var pts = vals.map(function (v, i) { return x(i) + ',' + y(v); }).join(' ');
      var ns = 'http://www.w3.org/2000/svg';
      var svg = document.createElementNS(ns, 'svg');
      svg.setAttribute('viewBox', '0 0 100 100');
      svg.setAttribute('preserveAspectRatio', 'none');
      if (type === 'area') {
        var fill = document.createElementNS(ns, 'polygon');
        fill.setAttribute('points', '0,100 ' + pts + ' 100,100');
        fill.setAttribute('class', 'wpp-chart__fill');
        svg.appendChild(fill);
      }
      var line = document.createElementNS(ns, 'polyline');
      line.setAttribute('points', pts);
      line.setAttribute('class', 'wpp-chart__line');
      line.setAttribute('vector-effect', 'non-scaling-stroke');
      svg.appendChild(line);
      plot.appendChild(svg);

      // Dots and value labels are HTML, not SVG — SVG circles and text would be
      // stretched by preserveAspectRatio="none" along with the line.
      vals.forEach(function (v, i) {
        var dot = document.createElement('i');
        dot.className = 'wpp-chart__dot';
        dot.style.left = x(i) + '%';
        dot.style.top = y(v) + '%';
        plot.appendChild(dot);
        if (showVals) {
          var lab = document.createElement('b');
          lab.className = 'wpp-chart__val';
          lab.style.left = x(i) + '%';
          lab.style.top = y(v) + '%';
          lab.textContent = v + suffix;
          plot.appendChild(lab);
        }
      });
    }

    el.textContent = '';
    el.appendChild(plot);

    if (labels) {
      var row = document.createElement('div');
      row.className = 'wpp-chart__labels';
      // bars sit in a flex row, so their centres are offset half a slot from the
      // evenly-spaced points a line chart uses
      var xLabel = type === 'bars'
        ? function (i) { return ((i + 0.5) / vals.length) * 100; }
        : x;
      labels.forEach(function (t, i) {
        var s = document.createElement('span');
        s.style.left = xLabel(i) + '%';
        s.textContent = t.trim();
        row.appendChild(s);
      });
      el.appendChild(row);
    }
  }
  Array.prototype.forEach.call(document.querySelectorAll('[data-chart]'), chartify);

  /* Any click can change layout (tabs, panels) — reposition note bubbles */
  document.addEventListener('click', function () {
    if (document.body.classList.contains('wpp-notes-on')) requestAnimationFrame(drawNotes);
  });

  /* Mockup forms never really submit — a reload would reset all state */
  document.addEventListener('submit', function (e) { e.preventDefault(); });
})();
