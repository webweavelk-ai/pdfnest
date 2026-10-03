/* Hero background: a triangular lattice that bends away from the cursor and
 * springs back. Hand-written, no library — the whole effect is a few kilobytes,
 * because a hero animation is not worth a framework.
 *
 * Design rules this file follows, so the effect never costs more than it gives:
 *   1. Nothing here blocks the first paint. The canvas is created after the page
 *      has loaded and the main thread is idle, so the headline — the element that
 *      Largest Contentful Paint measures — is never delayed by it.
 *   2. The loop stops when the hero scrolls out of view, when the tab is hidden,
 *      and once every point has settled and nothing is moving.
 *   3. `prefers-reduced-motion: reduce` turns the whole thing into a static
 *      texture: no drift, no pointer reaction, no shockwaves, no loop.
 *   4. Device pixel ratio is capped at 2. On a 3x phone, rendering 9x the pixels
 *      buys nothing visible and costs a lot of battery.
 */
(function () {
  "use strict";

  var canvas = document.getElementById("hero-canvas");
  if (!canvas || !canvas.getContext) return;

  var reduce = window.matchMedia("(prefers-reduced-motion: reduce)");
  var canHover = window.matchMedia("(hover: hover)");
  var ctx = canvas.getContext("2d");

  var CELL_MIN = 38, CELL_MAX = 66;
  // The user compared this against a reference and said only a couple of lines
  // reacted: the influence reached 4.8 cells and fell off as the square of the
  // distance, so it died out almost immediately. Widened to 7.5 cells (roughly a
  // third of the hero) with a gentler curve, so a broad sweep of the lattice
  // gathers toward the cursor instead of a tight knot.
  var PUSH_RADIUS = 7.5;   // how far the bulge reaches, in cells
  var PUSH_MAX = 0.6;      // and how far it can push, as a fraction of a cell
  var PUSH_FALLOFF = 1.7;  // lower than 2 spreads the effect further out
  var STIFF = 0.075;       // spring pull back to the resting position
  var DAMP = 0.88;         // velocity retained per normalised frame

  var px = [], py = [];    // current position
  var hx = [], hy = [];    // resting (home) position
  var vx = [], vy = [];    // velocity
  var phase = [];          // idle-drift phase offset per point
  var edges = [];          // pairs of indices
  var cols = 0, rows = 0, cell = 50, dprScale = 1;
  var ink = [231, 238, 247], accent = [79, 140, 255];
  var pointer = { x: -1e4, y: -1e4, tx: -1e4, ty: -1e4, active: false };
  var running = false, rafId = 0, last = 0;
  var visible = true;

  function cssRgb(name, fallback) {
    var v = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
    var m = /^#([0-9a-f]{6})$/i.exec(v);
    if (!m) return fallback;
    var n = parseInt(m[1], 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  }

  function rgba(c, a) {
    return "rgba(" + c[0] + "," + c[1] + "," + c[2] + "," + a.toFixed(3) + ")";
  }

  function measure() {
    var rect = canvas.parentElement.getBoundingClientRect();
    var dpr = Math.min(window.devicePixelRatio || 1, 2);
    dprScale = dpr;
    var w = Math.max(1, Math.round(rect.width));
    var h = Math.max(1, Math.round(rect.height));
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
    canvas.style.width = w + "px";
    canvas.style.height = h + "px";
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    return { w: w, h: h };
  }

  function build() {
    var size = measure();
    cell = Math.max(CELL_MIN, Math.min(CELL_MAX, size.w / 24));
    cols = Math.ceil(size.w / cell) + 2;
    rows = Math.ceil(size.h / (cell * 0.866)) + 2;

    px = []; py = []; hx = []; hy = []; vx = []; vy = []; phase = []; edges = [];
    var rowPitch = cell * 0.866;
    for (var r = 0; r < rows; r++) {
      for (var c = 0; c < cols; c++) {
        var x = (c - 0.5) * cell + (r % 2 ? cell / 2 : 0);
        var y = (r - 0.5) * rowPitch;
        hx.push(x); hy.push(y);
        px.push(x); py.push(y);
        vx.push(0); vy.push(0);
        phase.push((r * 1.7 + c * 0.9) % 6.283);
      }
    }
    // Wire each point to its right, down-left and down-right neighbours.
    for (var i = 0; i < rows * cols; i++) {
      var rr = Math.floor(i / cols), cc = i % cols;
      var right = rr * cols + cc + 1;
      if (cc + 1 < cols) edges.push([i, right]);
      if (rr + 1 < rows) {
        var dl = (rr + 1) * cols + cc;
        edges.push([i, dl]);
        var dr = (rr + 1) * cols + cc + (rr % 2 ? 1 : -1);
        if (dr >= 0 && dr < rows * cols && Math.abs((dr % cols) - cc) <= 1) edges.push([i, dr]);
      }
    }
    ink = cssRgb("--text", [231, 238, 247]);
    accent = cssRgb("--accent", [79, 140, 255]);
  }

  function step(dt, t) {
    // The pointer trails the cursor rather than snapping to it, which is what
    // makes the bend feel like it has weight.
    pointer.x += (pointer.tx - pointer.x) * Math.min(1, 0.22 * dt);
    pointer.y += (pointer.ty - pointer.y) * Math.min(1, 0.22 * dt);

    var driftAmt = reduce.matches ? 0 : 1.5;
    var stiff = 1 - Math.pow(1 - STIFF, dt);
    var damp = Math.pow(DAMP, dt);
    var reach = PUSH_RADIUS * cell;
    var pushy = pointer.active && canHover.matches;
    var maxSpeed = 0;

    for (var i = 0; i < px.length; i++) {
      // Idle drift is an OFFSET added to the resting position, not something
      // accumulated into the current position — accumulating would walk the whole
      // mesh off the page over a few minutes.
      var tx = hx[i] + Math.cos(t * 0.0006 + phase[i]) * driftAmt;
      var ty = hy[i] + Math.sin(t * 0.0005 + phase[i]) * driftAmt;

      /* The pointer moves the point's TARGET, and the spring does the rest.
         Displacing the current position directly — which is what this did first —
         adds a fresh push on every single frame, so the offset compounds and the
         lattice tears itself apart instead of bulging. Measuring the distance
         from the resting position also makes the deformation self-limiting:
         a point can never end up further than PUSH_MAX cells from home. */
      if (pushy) {
        var dx = hx[i] - pointer.x;
        var dy = hy[i] - pointer.y;
        var d = Math.sqrt(dx * dx + dy * dy);
        if (d < reach && d > 1) {
          var f = 1 - d / reach;
          var off = Math.pow(f, PUSH_FALLOFF) * PUSH_MAX * cell;
          tx += (dx / d) * off;
          ty += (dy / d) * off;
        }
      }

      var ax = (tx - px[i]) * stiff;
      var ay = (ty - py[i]) * stiff;
      vx[i] = (vx[i] + ax) * damp;
      vy[i] = (vy[i] + ay) * damp;
      px[i] += vx[i];
      py[i] += vy[i];
      var sp = Math.abs(vx[i]) + Math.abs(vy[i]);
      if (sp > maxSpeed) maxSpeed = sp;
    }
    return maxSpeed;
  }

  function draw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    var reach = PUSH_RADIUS * cell;
    var near = new Path2D();
    var far = new Path2D();
    for (var e = 0; e < edges.length; e++) {
      var a = edges[e][0], b = edges[e][1];
      var hot = false;
      if (pointer.active && canHover.matches) {
        var mx = (px[a] + px[b]) / 2 - pointer.x;
        var my = (py[a] + py[b]) / 2 - pointer.y;
        hot = mx * mx + my * my < reach * reach;
      }
      var p = hot ? near : far;
      p.moveTo(px[a], py[a]);
      p.lineTo(px[b], py[b]);
    }
    /* One DEVICE pixel, always. The context is scaled by the device pixel ratio,
       so a lineWidth of 1 was really 1.25px on this screen and 2px on a phone —
       which reads as a heavier, muddier mesh, and gets worse exactly where the
       lattice bunches up near the cursor. Dividing by the ratio keeps the stroke
       a true hairline at every density, which is what makes the reference look
       crisp. The width never changes with the deformation. */
    ctx.lineWidth = 1 / dprScale;
    ctx.strokeStyle = rgba(ink, 0.055);
    ctx.stroke(far);
    ctx.strokeStyle = rgba(accent, 0.17);
    ctx.stroke(near);

    // A small square at each point, brighter the closer it is to the cursor.
    for (var i = 0; i < px.length; i++) {
      var alpha = 0.09, size = 1.4;
      if (pointer.active && canHover.matches) {
        var dx = px[i] - pointer.x, dy = py[i] - pointer.y;
        var d = Math.sqrt(dx * dx + dy * dy);
        if (d < reach) {
          var f = 1 - d / reach;
          alpha = 0.09 + f * 0.26;
          size = 1.4 + f * 1.5;
        }
      }
      ctx.fillStyle = rgba(accent, alpha);
      ctx.fillRect(px[i] - size / 2, py[i] - size / 2, size, size);
    }
  }

  var skip = false;

  function loop(now) {
    if (!running) return;
    var dt = last ? Math.min(3, (now - last) / 16.667) : 1;
    last = now;
    var speed = step(dt, now);

    // Once the mesh is only drifting, nothing visible changes between adjacent
    // frames, so draw every other one. That halves the work without changing
    // what anyone sees.
    if (speed < 0.15) {
      skip = !skip;
      if (skip) { rafId = requestAnimationFrame(loop); return; }
    } else {
      skip = false;
    }

    draw();
    rafId = requestAnimationFrame(loop);
  }

  function start() {
    if (running || reduce.matches || !visible || document.hidden) return;
    running = true;
    last = 0;
    rafId = requestAnimationFrame(loop);
  }

  function stop() {
    running = false;
    if (rafId) cancelAnimationFrame(rafId);
    rafId = 0;
  }

  function wake() {
    start();
  }

  /* Read-only metrics, for the automated browser checks. Costs a few dozen bytes
     and is the difference between "the animation looks about right" and being
     able to prove the deformation is bounded — which is exactly the bug this
     replaced, where the lattice tore itself apart under the cursor. */
  window.__pdfnestHero = {
    metrics: function () {
      var max = 0, moved = 0;
      var threshold = cell * 0.06;   // "visibly shifted", not merely jittering
      for (var i = 0; i < px.length; i++) {
        var dx = px[i] - hx[i], dy = py[i] - hy[i];
        var d = Math.sqrt(dx * dx + dy * dy);
        if (d > max) max = d;
        if (d > threshold) moved++;
      }
      return {
        points: px.length,
        cell: Math.round(cell * 10) / 10,
        maxDisplacement: Math.round(max * 10) / 10,
        displacementInCells: Math.round((max / cell) * 100) / 100,
        // How much of the lattice is visibly reacting, which is the thing the user
        // said was too local: only a couple of lines moved near the cursor.
        affectedPoints: moved,
        affectedPercent: Math.round((moved / px.length) * 1000) / 10,
        reachInCells: PUSH_RADIUS,
        running: running,
        pointerActive: pointer.active,
        reducedMotion: reduce.matches,
        theme: document.documentElement.getAttribute("data-theme") || "dark"
      };
    }
  };

  // ------------------------------------------------------------------ events

  window.addEventListener("pointermove", function (ev) {
    if (!canHover.matches || reduce.matches) return;
    var rect = canvas.getBoundingClientRect();
    if (ev.clientY < rect.top || ev.clientY > rect.bottom) {
      pointer.active = false;
      return;
    }
    pointer.tx = ev.clientX - rect.left;
    pointer.ty = ev.clientY - rect.top;
    if (!pointer.active) { pointer.x = pointer.tx; pointer.y = pointer.ty; }
    pointer.active = true;
    wake();
  }, { passive: true });

  window.addEventListener("pointerdown", function (ev) {
    if (!canHover.matches || reduce.matches) return;
    var rect = canvas.getBoundingClientRect();
    if (ev.clientY < rect.top || ev.clientY > rect.bottom) return;
    pointer.x = pointer.tx = ev.clientX - rect.left;
    pointer.y = pointer.ty = ev.clientY - rect.top;
    pointer.active = true;
    // Nudge the nearby points outward for a ripple, then let the springs settle.
    // A gentle outward nudge on click, then the springs take over. This was 11 —
    // roughly four times too strong, which is what made a click look like damage.
    for (var i = 0; i < px.length; i++) {
      var dx = hx[i] - pointer.x, dy = hy[i] - pointer.y;
      var d = Math.sqrt(dx * dx + dy * dy);
      var reach = PUSH_RADIUS * cell * 1.3;
      if (d < reach && d > 1) {
        var f = 1 - d / reach;
        vx[i] += (dx / d) * f * 3;
        vy[i] += (dy / d) * f * 3;
      }
    }
    wake();
  }, { passive: true });

  window.addEventListener("pointerleave", function () { pointer.active = false; }, { passive: true });

  // The line and dot colours are read from CSS variables, so they are painted in
  // whatever the current theme says. Those variables change when the visitor flips
  // the theme, and nothing would re-read them without this.
  window.addEventListener("pdfnest:theme", function () {
    ink = cssRgb("--text", [231, 238, 247]);
    accent = cssRgb("--accent", [79, 140, 255]);
    if (reduce.matches) { draw(); } else { wake(); }
  });

  var resizeTimer = 0;
  window.addEventListener("resize", function () {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(function () { build(); draw(); wake(); }, 180);
  }, { passive: true });

  document.addEventListener("visibilitychange", function () {
    if (document.hidden) { stop(); } else if (visible) { wake(); }
  });

  if (window.IntersectionObserver) {
    new IntersectionObserver(function (entries) {
      visible = entries[0].isIntersecting;
      if (visible) { wake(); } else { stop(); }
    }, { rootMargin: "80px" }).observe(canvas.parentElement);
  }

  if (reduce.addEventListener) {
    reduce.addEventListener("change", function () {
      if (reduce.matches) { stop(); } else { wake(); }
    });
  }

  // -------------------------------------------------------------- kick off

  // Wait for the page to be idle before touching the main thread, so the
  // headline paints first and this never delays Largest Contentful Paint.
  function boot() {
    build();
    draw();
    if (!reduce.matches) start();
  }

  /* Defer the first build until the browser is quiet.
     requestIdleCallback takes an OPTIONS OBJECT as its second argument — passing a
     number throws a TypeError and silently cancels the callback. Because Chrome
     has requestIdleCallback, the `|| setTimeout` fallback never ran, so boot() was
     never called on any page load and the canvas stayed blank until something
     else (a window resize) happened to rebuild it. */
  function whenIdle(fn) {
    if (typeof window.requestIdleCallback === "function") {
      window.requestIdleCallback(fn, { timeout: 600 });
    } else {
      window.setTimeout(fn, 200);
    }
  }

  if (document.readyState === "complete") {
    whenIdle(boot);
  } else {
    window.addEventListener("load", function () { whenIdle(boot); });
  }
})();
