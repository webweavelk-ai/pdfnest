/* PDF Nest UI — wires the page to the client-side engine in engine.js.
 *
 * Nothing here talks to a network for your documents. Files are read with the
 * File API, handed to PDFStudioEngine, and the result is offered as a download.
 *
 * The three vendor libraries are ~950 KB combined. Loading them on every page
 * view would destroy Largest Contentful Paint on a phone, so they are injected
 * only when the visitor actually touches a tool — and the fetch starts on the
 * first click or drop, so it is usually finished before they press Process.
 */
(function () {
  "use strict";

  var E = window.PDFStudioEngine;
  var ASSETS = window.PDFSTUDIO_ASSETS || {};
  var SOFT_LIMIT_MB = 150; // browser memory guard, not a paywall

  E.configure({
    base: window.PDFSTUDIO_BASE || "",
    workerVersion: window.PDFSTUDIO_WORKER_V || ""
  });

  // ------------------------------------------------------------ lazy loading

  var loading = {};

  function ensureLibs(names) {
    return Promise.all((names || []).map(function (name) {
      if (loading[name]) return loading[name];
      loading[name] = new Promise(function (resolve, reject) {
        var src = ASSETS[name];
        if (!src) { reject(new Error("No asset URL configured for " + name)); return; }
        var s = document.createElement("script");
        s.src = src;
        s.async = false;
        s.onload = function () { resolve(name); };
        s.onerror = function () {
          delete loading[name]; // let a later attempt retry
          reject(new Error("Could not load " + name + ". Check your connection and try again."));
        };
        document.head.appendChild(s);
      });
      return loading[name];
    }));
  }

  // ------------------------------------------------------------------- tools

  var TOOLS = {
    "merge-pdf": {
      accept: "application/pdf", multiple: true, minFiles: 2,
      libs: ["pdf-lib"],
      run: function (files, opts, progress) {
        return ensureLibs(this.libs).then(function () {
          return E.mergePdfs(files, progress);
        }).then(function (bytes) {
          return { bytes: bytes, name: "merged.pdf", type: "application/pdf" };
        });
      }
    },

    "split-pdf": {
      accept: "application/pdf", multiple: false, minFiles: 1,
      libs: ["pdf-lib", "jszip"],
      controls: function (host) {
        host.innerHTML =
          '<label class="field">Pages<select id="op-mode">' +
          '<option value="all">Every page (separate PDFs)</option>' +
          '<option value="ranges">Only these ranges</option></select></label>' +
          '<label class="field" id="wrap-ranges" style="display:none">Ranges' +
          '<input type="text" id="op-ranges" placeholder="e.g. 1-3,5,8-10" /></label>';
        var mode = document.getElementById("op-mode");
        mode.onchange = function () {
          document.getElementById("wrap-ranges").style.display = mode.value === "ranges" ? "flex" : "none";
        };
      },
      run: function (files, opts, progress) {
        return ensureLibs(this.libs).then(function () {
          return files[0].arrayBuffer().then(E.copyOf).then(E.pageCount);
        }).then(function (total) {
          var idx = opts.mode === "ranges" ? E.parseRanges(opts.ranges, total) : E.allPages(total);
          return E.splitPdf(files[0], idx, progress);
        }).then(function (bytes) {
          return {
            bytes: bytes, name: E.stemOf(files[0].name) + "_split.zip", type: "application/zip"
          };
        });
      }
    },

    "compress-pdf": {
      accept: "application/pdf", multiple: false, minFiles: 1,
      libs: ["pdf-lib", "pdfjs"],
      controls: function (host) {
        host.innerHTML = '<label class="field">Level<select id="op-level">' +
          '<option value="recommended">Recommended</option>' +
          '<option value="light">Light — keeps text selectable</option>' +
          '<option value="strong">Strong — smallest file, text becomes an image</option>' +
          '</select></label>';
      },
      run: function (files, opts, progress) {
        return ensureLibs(this.libs).then(function () {
          return E.compressPdf(files[0], opts.level || "recommended", progress);
        }).then(function (r) {
          return {
            bytes: r.bytes, name: E.stemOf(files[0].name) + "_compressed.pdf",
            type: "application/pdf",
            reduced: r.reduced, before: r.before, after: r.after
          };
        });
      }
    },

    "rotate-pdf": {
      accept: "application/pdf", multiple: false, minFiles: 1,
      libs: ["pdf-lib"],
      controls: function (host) {
        host.innerHTML = '<label class="field">Rotation<select id="op-angle">' +
          '<option value="90">90° clockwise</option><option value="180">180°</option>' +
          '<option value="270">270° clockwise</option></select></label>' +
          '<label class="field">Pages<input type="text" id="op-pages" placeholder="all" /></label>';
      },
      run: function (files, opts) {
        return ensureLibs(this.libs).then(function () {
          return files[0].arrayBuffer().then(E.copyOf).then(E.pageCount);
        }).then(function (total) {
          var spec = String(opts.pages || "").trim().toLowerCase();
          var idx = spec === "" || spec === "all" ? null : E.parseRanges(spec, total);
          return E.rotatePdf(files[0], parseInt(opts.angle, 10), idx);
        }).then(function (bytes) {
          return {
            bytes: bytes, name: E.stemOf(files[0].name) + "_rotated.pdf", type: "application/pdf"
          };
        });
      }
    },

    "pdf-to-images": {
      accept: "application/pdf", multiple: false, minFiles: 1,
      libs: ["pdfjs", "jszip"],
      controls: function (host) {
        host.innerHTML = '<label class="field">Format<select id="op-fmt">' +
          '<option value="png">PNG</option><option value="jpg">JPG</option></select></label>' +
          '<label class="field">Quality<select id="op-dpi">' +
          '<option value="96">96 dpi — screen</option><option value="150" selected>150 dpi — standard</option>' +
          '<option value="200">200 dpi — print</option><option value="300">300 dpi — high</option>' +
          '</select></label>';
      },
      run: function (files, opts, progress) {
        var fmt = opts.fmt === "jpg" ? "jpg" : "png";
        return ensureLibs(this.libs).then(function () {
          return E.pdfToImages(files[0], fmt, parseInt(opts.dpi, 10) || 150, progress);
        }).then(function (bytes) {
          return {
            bytes: bytes, name: E.stemOf(files[0].name) + "_images.zip", type: "application/zip"
          };
        });
      }
    },

    "images-to-pdf": {
      accept: "image/*", multiple: true, minFiles: 1,
      libs: ["pdf-lib"],
      run: function (files, opts, progress) {
        return ensureLibs(this.libs).then(function () {
          return E.imagesToPdf(files, progress);
        }).then(function (bytes) {
          return { bytes: bytes, name: "images.pdf", type: "application/pdf" };
        });
      }
    },

    "edit-pdf": {
      accept: "application/pdf", multiple: false, minFiles: 1,
      libs: ["pdf-lib", "pdfjs"],
      hideList: true,          // the page canvas and the element list replace it
      afterAdd: function (files) { return editorBuild(files[0]); },
      reset: editorReset,
      run: function (files) {
        return ensureLibs(this.libs).then(function () {
          var spec = edBuildSpec();
          if (!spec) {
            throw new Error("Nothing to add yet. Place some text, an image or a white-out box, " +
              "or switch on the watermark or page numbers, then press Process again.");
          }
          return E.annotatePdf(files[0], spec);
        }).then(function (bytes) {
          return {
            bytes: bytes, name: E.stemOf(files[0].name) + "_edited.pdf", type: "application/pdf"
          };
        });
      }
    },

    "organize-pdf": {
      accept: "application/pdf", multiple: false, minFiles: 1,
      libs: ["pdf-lib", "pdfjs"],
      hideList: true,          // the thumbnail grid replaces the file list
      afterAdd: function (files) { return organizeBuild(files[0]); },
      reset: organizeReset,
      run: function (files) {
        return ensureLibs(this.libs).then(function () {
          return E.organizePdf(files[0], plan.map(function (e) {
            return { index: e.index, rotate: e.rotate };
          }));
        }).then(function (bytes) {
          return {
            bytes: bytes,
            name: E.stemOf(files[0].name) + "_organized.pdf",
            type: "application/pdf"
          };
        });
      }
    }
  };

  // ------------------------------------------------------------------ the UI

  var state = { id: null, files: [], warmed: false };
  var $ = function (id) { return document.getElementById(id); };

  /** Human-readable size. Small files reported as "0.00 MB" told the user
   *  nothing, which is exactly the sort of detail a test catches and a glance
   *  does not. */
  function fmtSize(n) {
    return n >= 1048576
      ? (n / 1048576).toFixed(2) + " MB"
      : Math.max(1, Math.round(n / 1024)) + " KB";
  }

  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }

  function startLoading() {
    var t = TOOLS[state.id];
    if (!t || state.warmed) return;
    state.warmed = true;
    ensureLibs(t.libs).catch(function () { /* surfaced on Process */ });
  }

  function renderFiles() {
    var t = TOOLS[state.id];
    $("file-list").innerHTML = t.hideList ? "" : state.files.map(function (f, i) {
      return '<div class="item"><span>' + escapeHtml(f.name) + '</span>' +
        '<span class="hint">' + fmtSize(f.size) + ' ' +
        '<button class="link" type="button" data-rm="' + i + '">remove</button></span></div>';
    }).join("");
    Array.prototype.forEach.call(document.querySelectorAll("[data-rm]"), function (b) {
      b.onclick = function () {
        state.files.splice(parseInt(b.getAttribute("data-rm"), 10), 1);
        renderFiles();
      };
    });
    $("run").disabled = state.files.length < (t.minFiles || 1);
  }

  function say(kind, text) {
    var m = $("msg");
    m.className = "msg " + kind;
    m.textContent = text;
  }

  function clearMsg() { $("msg").className = "msg"; }

  function setProgress(done, total) {
    var bar = $("progress");
    if (!bar) return;
    bar.classList.add("on");
    bar.firstElementChild.style.width = (total ? Math.round((done / total) * 100) : 0) + "%";
  }

  function addFiles(list) {
    var t = TOOLS[state.id];
    var picked = Array.prototype.slice.call(list);
    state.files = t.multiple ? state.files.concat(picked) : picked.slice(0, 1);
    var mb = state.files.reduce(function (n, f) { return n + f.size; }, 0) / 1048576;
    if (mb > SOFT_LIMIT_MB) {
      say("err", "That is " + mb.toFixed(0) + " MB in total. Browsers run out of memory above roughly " +
        SOFT_LIMIT_MB + " MB — try fewer or smaller files.");
    } else {
      clearMsg();
    }
    renderFiles();
    if (t.afterAdd) t.afterAdd(state.files);
  }

  function readOptions() {
    var get = function (id) { var el = $(id); return el ? el.value : ""; };
    return {
      mode: get("op-mode"), ranges: get("op-ranges"), level: get("op-level"),
      angle: get("op-angle"), pages: get("op-pages"), fmt: get("op-fmt"), dpi: get("op-dpi")
    };
  }

  function download(blob, filename) {
    var url = URL.createObjectURL(blob);
    var a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(function () { URL.revokeObjectURL(url); }, 30000);
  }

  async function run() {
    var t = TOOLS[state.id];
    var files = t.multiple ? state.files : state.files.slice(0, 1);
    $("run").disabled = true;
    $("progress").classList.remove("on");
    clearMsg();
    say("info", "Working… this runs on your device, nothing is uploaded.");

    var started = performance.now();
    try {
      var out = await t.run(files, readOptions(), setProgress);
      var blob = new Blob([out.bytes], { type: out.type });
      var ms = Math.round(performance.now() - started);

      if (out.reduced === false) {
        say("info", "Already optimised — this file could not get smaller, so you get the original back (" + ms + " ms).");
      } else if (out.before) {
        var cut = Math.round((1 - out.after / out.before) * 100);
        say("ok", "Done in " + ms + " ms — " + fmtSize(out.before) + " → " +
          fmtSize(out.after) + " (" + cut + "% smaller).");
      } else {
        say("ok", "Done in " + ms + " ms — " + fmtSize(blob.size) + ".");
      }
      download(blob, out.name);
    } catch (err) {
      say("err", (err && err.message) ? err.message : String(err));
    } finally {
      $("run").disabled = false;
      $("progress").classList.remove("on");
    }
  }

  // -------------------------------------------------- page organiser (tool 7)
  //
  // The plan is the output order. Nothing touches the original document until
  // Process: every button here only rearranges this array, so undoing is free.

  var plan = [];         // [{ uid, index, rotate }] — index is the SOURCE page
  var original = [];     // the plan as loaded, for "Undo all"
  var selected = {};     // uid -> true
  var thumbCache = {};   // "index:rotate" -> canvas, so reordering never re-renders
  var renderDoc = null;  // the open pdf.js document
  var uidSeq = 0;
  var THUMB_SCALE = 0.3;
  var renderToken = 0;   // bumped to abandon a thumbnail pass whose plan is stale

  function organizeReset() {
    plan = []; original = []; selected = {}; thumbCache = {};
    renderDoc = null; uidSeq = 0; renderToken++;
    var ws = $("workspace");
    if (ws) { ws.innerHTML = ""; ws.classList.remove("on"); }
  }

  async function thumbFor(index, rotate) {
    var key = index + ":" + rotate;
    if (thumbCache[key]) return thumbCache[key];
    var base = await E.renderPage(renderDoc, index + 1, THUMB_SCALE);
    if (rotate) {
      // Draw the page rotated rather than rotating it with CSS, so the thumbnail
      // is exactly what the output page will look like.
      var swap = rotate % 180 !== 0;
      var out = document.createElement("canvas");
      out.width = swap ? base.height : base.width;
      out.height = swap ? base.width : base.height;
      var ctx = out.getContext("2d");
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, out.width, out.height);
      ctx.translate(out.width / 2, out.height / 2);
      ctx.rotate(rotate * Math.PI / 180);
      ctx.drawImage(base, -base.width / 2, -base.height / 2);
      base = out;
    }
    thumbCache[key] = base;
    return base;
  }

  function placeThumb(box, src) {
    // A canvas node cannot be in two places at once, so copy the pixels. Cheap,
    // and it means a duplicated page can show the same cached bitmap twice.
    var c = document.createElement("canvas");
    c.width = src.width;
    c.height = src.height;
    c.getContext("2d").drawImage(src, 0, 0);
    box.innerHTML = "";
    box.appendChild(c);
  }

  async function organizeBuild(file) {
    var ws = $("workspace");
    if (!ws) return;
    organizeReset();
    ws.classList.add("on");
    ws.innerHTML = '<p class="hint">Reading the document…</p>';
    try {
      renderDoc = await E.openForRendering(file);
      for (var i = 0; i < renderDoc.numPages; i++) {
        plan.push({ uid: ++uidSeq, index: i, rotate: 0 });
      }
      original = plan.map(function (e) { return { uid: e.uid, index: e.index, rotate: 0 }; });
      if (renderDoc.numPages > 150) {
        say("info", renderDoc.numPages + " pages — thumbnails may take a moment to draw.");
      }
      await renderPlan();
    } catch (err) {
      ws.innerHTML = '<p class="msg err">' + escapeHtml(err.message || String(err)) + "</p>";
    }
  }

  async function renderPlan() {
    var ws = $("workspace");
    if (!ws) return;
    var my = ++renderToken;
    var selCount = plan.filter(function (e) { return selected[e.uid]; }).length;
    var dis = selCount ? "" : " disabled";

    ws.innerHTML =
      '<div class="pagebar">' +
        '<span class="count">' + plan.length + ' page' + (plan.length === 1 ? "" : "s") +
          (selCount ? " · " + selCount + " selected" : "") + '</span>' +
        '<button type="button" data-act="selall">Select all</button>' +
        '<button type="button" data-act="selnone"' + dis + '>Clear selection</button>' +
        '<button type="button" data-act="rot"' + dis + '>Rotate</button>' +
        '<button type="button" data-act="dup"' + dis + '>Duplicate</button>' +
        '<button type="button" data-act="del"' + dis + '>Delete</button>' +
        '<button type="button" class="ghost" data-act="undo">Undo all</button>' +
      '</div>' +
      '<p class="hint">Tick pages to act on several at once, or use the buttons on each page. ' +
      'The order shown is the order in the finished file.</p>' +
      '<div class="pgrid" id="pgrid"></div>';

    var grid = $("pgrid");
    plan.forEach(function (e, i) {
      var card = document.createElement("div");
      card.className = "pcard" + (selected[e.uid] ? " sel" : "");
      card.setAttribute("data-uid", e.uid);
      card.innerHTML =
        '<label class="chk"><input type="checkbox"' + (selected[e.uid] ? " checked" : "") +
          ' aria-label="Select page ' + (i + 1) + '" /><span>' + (i + 1) + '</span></label>' +
        '<div class="thumb"></div>' +
        (e.rotate ? '<span class="rot">' + e.rotate + '°</span>' : "") +
        '<div class="pacts">' +
          '<button type="button" data-mv="-1" title="Move earlier" aria-label="Move page ' + (i + 1) + ' earlier"' +
            (i === 0 ? " disabled" : "") + '>◀</button>' +
          '<button type="button" data-mv="1" title="Move later" aria-label="Move page ' + (i + 1) + ' later"' +
            (i === plan.length - 1 ? " disabled" : "") + '>▶</button>' +
          '<button type="button" data-rot="1" title="Rotate 90° clockwise" aria-label="Rotate page ' + (i + 1) + '">↻</button>' +
          '<button type="button" data-dup="1" title="Duplicate" aria-label="Duplicate page ' + (i + 1) + '">⧉</button>' +
          '<button type="button" data-del="1" title="Delete" aria-label="Delete page ' + (i + 1) + '">✕</button>' +
        '</div>';
      grid.appendChild(card);
    });
    wirePlan();

    for (var j = 0; j < plan.length; j++) {
      if (my !== renderToken) return; // the plan changed; a newer pass owns the DOM
      var entry = plan[j];
      var canvas = await thumbFor(entry.index, entry.rotate);
      if (my !== renderToken) return;
      var card2 = grid.children[j];
      var box = card2 && card2.querySelector(".thumb");
      if (box) placeThumb(box, canvas);
    }
  }

  function wirePlan() {
    var grid = $("pgrid");
    Array.prototype.forEach.call(grid.querySelectorAll(".pcard"), function (card) {
      var uid = parseInt(card.getAttribute("data-uid"), 10);
      card.querySelector('input[type="checkbox"]').onchange = function (ev) {
        if (ev.target.checked) { selected[uid] = true; } else { delete selected[uid]; }
        renderPlan();
      };
      card.querySelector('[data-mv="-1"]').onclick = function () { moveEntry(uid, -1); };
      card.querySelector('[data-mv="1"]').onclick = function () { moveEntry(uid, 1); };
      card.querySelector("[data-rot]").onclick = function () {
        var e = plan.filter(function (x) { return x.uid === uid; })[0];
        if (e) { e.rotate = (e.rotate + 90) % 360; renderPlan(); }
      };
      card.querySelector("[data-dup]").onclick = function () { duplicateAfter([uid]); };
      card.querySelector("[data-del]").onclick = function () { deleteEntries([uid]); };
    });
    Array.prototype.forEach.call(document.querySelectorAll("[data-act]"), function (b) {
      b.onclick = function () { bulk(b.getAttribute("data-act")); };
    });
  }

  function indexOfUid(uid) {
    for (var i = 0; i < plan.length; i++) if (plan[i].uid === uid) return i;
    return -1;
  }

  function moveEntry(uid, delta) {
    var i = indexOfUid(uid);
    var j = i + delta;
    if (i < 0 || j < 0 || j >= plan.length) return;
    var tmp = plan[i];
    plan[i] = plan[j];
    plan[j] = tmp;
    renderPlan();
  }

  function duplicateAfter(uids) {
    var out = [];
    plan.forEach(function (e) {
      out.push(e);
      if (uids.indexOf(e.uid) !== -1) {
        out.push({ uid: ++uidSeq, index: e.index, rotate: e.rotate });
      }
    });
    plan = out;
    selected = {};
    renderPlan();
  }

  function deleteEntries(uids) {
    if (uids.length >= plan.length) {
      say("err", "At least one page has to stay in the document.");
      return;
    }
    plan = plan.filter(function (e) { return uids.indexOf(e.uid) === -1; });
    selected = {};
    renderPlan();
  }

  function bulk(act) {
    var sel = plan.filter(function (e) { return selected[e.uid]; }).map(function (e) { return e.uid; });

    if (act === "selall") { plan.forEach(function (e) { selected[e.uid] = true; }); return renderPlan(); }
    if (act === "selnone") { selected = {}; return renderPlan(); }
    if (act === "undo") {
      plan = original.map(function (e) { return { uid: e.uid, index: e.index, rotate: 0 }; });
      selected = {};
      return renderPlan();
    }
    if (!sel.length) return;
    if (act === "rot") {
      plan.forEach(function (e) { if (selected[e.uid]) e.rotate = (e.rotate + 90) % 360; });
      return renderPlan();
    }
    if (act === "dup") return duplicateAfter(sel);
    if (act === "del") return deleteEntries(sel);
  }

  // ------------------------------------------------- annotation editor (tool 8)
  //
  // The placed elements are the state; the page overlay is only a view of them.
  // Every element is stored in PDF points with the origin at the TOP-LEFT of the
  // page, which is the convention PDFStudioEngine.annotatePdf takes, so nothing
  // has to be converted on the way out — only on the way in, and once.
  //
  // Pointer positions are converted with pdf.js's own viewport maths rather than
  // by hand. viewport.convertToPdfPoint() already accounts for the render scale,
  // the media box origin and the page's /Rotate flag, which is the difference
  // between a rotated page placing text under the cursor and placing it in the
  // wrong corner.

  var ed = {
    doc: null, file: null, pages: [], meta: [],
    page: 0, items: [], sel: null, mode: null, panel: null,
    img: null, zoom: "fit", vp: null, scale: 1, seq: 0, token: 0,
    wm: { on: false, text: "DRAFT", size: 56, color: "#c0392b", opacity: 0.2, rotate: -30 },
    pn: { on: false, pos: "bottom-center", format: "n / total", size: 10, color: "#444444", start: 1 }
  };

  // The faces pdf-lib can embed, mapped onto the closest CSS stack so the
  // preview and the output disagree as little as possible.
  var ED_FONTS = ["Helvetica", "Helvetica-Bold", "Helvetica-Oblique", "Helvetica-BoldOblique",
    "Times-Roman", "Times-Bold", "Times-Italic", "Times-BoldItalic", "Courier", "Courier-Bold"];

  function edCssFont(name) {
    return {
      style: /-Oblique|Italic/.test(name) ? "italic" : "normal",
      weight: /Bold/.test(name) ? "700" : "400",
      family: /Times/.test(name) ? "Georgia, 'Times New Roman', Times, serif"
        : /Courier/.test(name) ? "'Courier New', Courier, monospace"
          : "Helvetica, Arial, sans-serif"
    };
  }

  function findItem(id) {
    for (var i = 0; i < ed.items.length; i++) if (ed.items[i].id === id) return ed.items[i];
    return null;
  }

  function edWarn(msg) {
    var el = $("ed-warn");
    if (el) { el.textContent = msg || ""; el.className = msg ? "ed-warn on" : "ed-warn"; }
  }

  /** Page geometry and the pdf.js page proxy, fetched once per page and cached. */
  async function edLoadMeta(i) {
    if (ed.meta[i]) return ed.meta[i];
    if (!ed.pages[i]) ed.pages[i] = await ed.doc.getPage(i + 1);
    var p = ed.pages[i];
    var v = p.view;                      // [x0, y0, x1, y1], unrotated, PDF points
    var base = p.getViewport({ scale: 1 });
    ed.meta[i] = {
      page: p, view: v,
      w: v[2] - v[0], h: v[3] - v[1],
      vw: base.width, vh: base.height    // at scale 1, page rotation already applied
    };
    return ed.meta[i];
  }

  /** Viewport pixels -> PDF points, top-origin. The inverse of edToView().
   *
   *  Returns null before the first page has been drawn. There is a real window
   *  between dropping a document and the first render finishing, and a click in
   *  that window has no coordinate system to land in yet — so every caller
   *  checks for null instead of dereferencing a viewport that does not exist. */
  function edToPdf(vx, vy) {
    var m = ed.meta[ed.page];
    if (!ed.vp || !m) return null;
    var p = ed.vp.convertToPdfPoint(vx, vy);
    return { x: p[0], y: m.view[3] - p[1] };
  }

  /** PDF points, top-origin -> viewport pixels. */
  function edToView(x, y) {
    var m = ed.meta[ed.page];
    if (!ed.vp || !m) return [0, 0];
    return ed.vp.convertToViewportPoint(x, m.view[3] - y);
  }

  function editorReset() {
    ed.items.forEach(function (it) { if (it._url) URL.revokeObjectURL(it._url); });
    if (ed.img && ed.img.url) URL.revokeObjectURL(ed.img.url);
    var ws = $("workspace");
    if (ws) { ws.innerHTML = ""; ws.classList.remove("on"); }
    ed.doc = null; ed.file = null; ed.pages = []; ed.meta = [];
    ed.page = 0; ed.items = []; ed.sel = null; ed.mode = null; ed.panel = null;
    ed.img = null; ed.zoom = "fit"; ed.vp = null; ed.scale = 1; ed.seq = 0;
    edWant++;   // anything already queued belongs to the document we just dropped
  }

  async function editorBuild(file) {
    var ws = $("workspace");
    if (!ws) return;
    editorReset();
    ed.file = file;
    ws.classList.add("on");
    ws.innerHTML = '<p class="hint">Reading the document…</p>';
    try {
      ed.doc = await E.openForRendering(file);
      await edLoadMeta(0);
      edShell();
      await edRender();
      renderEdProps();
      renderEdItems();
      updateEdBar();
    } catch (err) {
      ws.innerHTML = '<p class="msg err">' + escapeHtml(err.message || String(err)) + "</p>";
    }
  }

  function edShell() {
    $("workspace").innerHTML =
      '<div class="ed" id="ed-root">' +
        '<div class="ed-bar">' +
          '<button type="button" class="ed-t" data-ed="text"><b>A</b><em>Text</em></button>' +
          '<button type="button" class="ed-t" data-ed="image"><b>▣</b><em>Signature or image</em></button>' +
          '<button type="button" class="ed-t" data-ed="image-again" hidden><b>▣</b><em>Place it again</em></button>' +
          '<button type="button" class="ed-t" data-ed="white"><b>▭</b><em>White-out</em></button>' +
          '<button type="button" class="ed-t" data-ed="wm"><b>W</b><em>Watermark</em></button>' +
          '<button type="button" class="ed-t" data-ed="pn"><b>#</b><em>Page numbers</em></button>' +
        '</div>' +
        '<p class="ed-hint" id="ed-hint"></p>' +
        '<div class="ed-props" id="ed-props"></div>' +
        '<div class="ed-warn" id="ed-warn"></div>' +
        '<div class="ed-stage" id="ed-stage">' +
          '<div class="ed-inner" id="ed-inner">' +
            '<canvas id="ed-canvas"></canvas>' +
            '<div class="ed-overlay" id="ed-overlay"></div>' +
          '</div>' +
        '</div>' +
        '<div class="ed-nav">' +
          '<button type="button" class="ghost" data-pg="-1" aria-label="Previous page">◀</button>' +
          '<span id="ed-pageno"></span>' +
          '<button type="button" class="ghost" data-pg="1" aria-label="Next page">▶</button>' +
          '<label class="field ed-zoom">Zoom<select id="ed-zoom">' +
            '<option value="fit">Fit width</option><option value="100">100%</option>' +
            '<option value="150">150%</option><option value="200">200%</option></select></label>' +
          '<span class="hint" id="ed-status"></span>' +
        '</div>' +
        '<div class="ed-items" id="ed-items"></div>' +
        '<input type="file" id="ed-img" accept="image/png,image/jpeg" />' +
      '</div>';

    var root = $("ed-root");
    root.addEventListener("click", onEdClick);
    root.addEventListener("input", onEdInput);
    root.addEventListener("change", function (e) {
      if (e.target && e.target.id === "ed-zoom") {
        ed.zoom = e.target.value;
        edRender().catch(function (err) { edWarn(err && err.message ? err.message : String(err)); });
      }
    });
    var ov = $("ed-overlay");
    ov.addEventListener("pointerdown", onEdDown);
    ov.addEventListener("pointermove", onEdMove);
    ov.addEventListener("pointerup", onEdUp);
    ov.addEventListener("pointercancel", onEdUp);
    $("ed-img").addEventListener("change", function (e) {
      var f = e.target.files && e.target.files[0];
      e.target.value = "";
      if (f) edLoadImage(f);
    });
  }

  /** Load a signature / stamp picture and arm placement mode. */
  async function edLoadImage(file) {
    if (!/^image\/(png|jpe?g)$/i.test(file.type)) {
      edWarn("An image stamp has to be a PNG or a JPG.");
      return;
    }
    try {
      var bytes = new Uint8Array(await file.arrayBuffer());
      var url = URL.createObjectURL(new Blob([bytes], { type: file.type }));
      var probe = new Image();
      var nat = await new Promise(function (resolve, reject) {
        probe.onload = function () { resolve({ w: probe.naturalWidth, h: probe.naturalHeight }); };
        probe.onerror = function () { reject(new Error("That image could not be read.")); };
        probe.src = url;
      });
      if (ed.img && ed.img.url) URL.revokeObjectURL(ed.img.url);
      ed.img = {
        bytes: bytes, mime: /jpe?g/i.test(file.type) ? "image/jpeg" : "image/png",
        url: url, w: nat.w, h: nat.h, key: "edimg" + (++ed.seq)
      };
      ed.mode = "image";
      ed.panel = null; ed.sel = null;
      edWarn("");
      updateEdBar(); renderEdProps(); paintOverlay();
    } catch (err) {
      edWarn(err.message || String(err));
    }
  }

  /**
   * Draw the current page, then rebuild the overlay on top of it.
   *
   * Renders are QUEUED rather than started on demand. pdf.js refuses to begin a
   * render on a canvas that already has one active — "Cannot use the same canvas
   * during multiple render() operations" — and that is reachable from the UI, not
   * just from a test: dropping a second document, or pressing the page arrows
   * twice quickly, asks for a render while the previous one is still running.
   * Joining a queue means #ed-canvas is only ever painted by one render at a
   * time, and a request that has already been superseded drops out before it
   * starts, so rapid clicking costs nothing.
   */
  var edWant = 0;
  var edRenderQueue = Promise.resolve();

  function edRender() {
    var mine = ++edWant;
    var next = edRenderQueue.then(function () {
      if (mine !== edWant) return null; // a newer request is already queued
      return edRenderOnce(mine);
    }, function () {
      return null;                      // a previous failure must not block this
    });
    edRenderQueue = next.then(function () {}, function () {});
    return next;
  }

  async function edRenderOnce(my) {
    var stage = $("ed-stage"), inner = $("ed-inner"), canvas = $("ed-canvas");
    if (!stage || !canvas) return;
    var m = await edLoadMeta(ed.page);
    if (my !== edWant) return;

    var avail = Math.max(140, stage.clientWidth - 24);
    var scale = ed.zoom === "fit"
      ? Math.min(1.6, Math.max(0.15, avail / m.vw))
      : Math.max(0.2, parseFloat(ed.zoom) / 100);
    var vp = m.page.getViewport({ scale: scale });
    var dpr = Math.min(2.5, window.devicePixelRatio || 1);

    canvas.width = Math.max(1, Math.round(vp.width * dpr));
    canvas.height = Math.max(1, Math.round(vp.height * dpr));
    canvas.style.width = vp.width + "px";
    canvas.style.height = vp.height + "px";
    inner.style.width = vp.width + "px";
    inner.style.height = vp.height + "px";

    ed.vp = vp;
    ed.scale = scale;
    paintOverlay();
    updateEdBar();

    var ctx = canvas.getContext("2d");
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, vp.width, vp.height);
    await m.page.render({ canvasContext: ctx, viewport: vp }).promise;
  }

  // ------------------------------------------------------------ the overlay

  function paintOverlay() {
    var ov = $("ed-overlay");
    if (!ov || !ed.vp || !ed.meta[ed.page]) return;
    ov.innerHTML = "";
    ed.items.forEach(function (it) {
      if (it.page === ed.page) ov.appendChild(edItemEl(it));
    });
    if (ed.wm.on && String(ed.wm.text).trim()) ov.appendChild(edWmEl());
    if (ed.pn.on) ov.appendChild(edPnEl());
    ov.classList.toggle("placing", !!ed.mode);
  }

  function edItemEl(it) {
    var el = document.createElement("div");
    el.className = "ed-el ed-" + it.kind + (ed.sel === it.id ? " sel" : "");
    el.setAttribute("data-id", it.id);
    var at = edToView(it.x, it.y);
    el.style.left = at[0] + "px";
    el.style.top = at[1] + "px";

    if (it.kind === "text") {
      var f = edCssFont(it.font);
      var px = it.size * ed.scale;
      el.style.font = [f.style, f.weight, px + "px/" + (px * 1.25) + "px", f.family].join(" ");
      // The engine puts the baseline ASCENT*size below the element's top; a CSS
      // line box sits a little lower than that, so lift it back by the
      // difference. Sub-pixel, but it is why the preview lines up with the PDF.
      el.style.transform = "translateY(-0.13em)";
      el.style.color = it.color;
      el.textContent = it.text;
    } else {
      el.style.width = Math.max(4, it.w * ed.scale) + "px";
      el.style.height = Math.max(4, it.h * ed.scale) + "px";
      if (it.kind === "image" && it._url) {
        var im = document.createElement("img");
        im.src = it._url;
        im.alt = "";
        im.draggable = false;
        el.appendChild(im);
      }
      var grip = document.createElement("span");
      grip.className = "ed-h";
      el.appendChild(grip);
    }
    return el;
  }

  function edWmEl() {
    var el = document.createElement("div");
    el.className = "ed-el ed-wm";
    el.textContent = ed.wm.text;
    el.style.fontSize = (ed.wm.size * ed.scale) + "px";
    el.style.color = ed.wm.color;
    el.style.opacity = String(Math.max(0.05, Math.min(1, Number(ed.wm.opacity) || 0.2)));
    // CSS rotates clockwise, PDF rotates anticlockwise, hence the sign flip.
    el.style.transform = "translate(-50%,-50%) rotate(" + (-Number(ed.wm.rotate)) + "deg)";
    el.style.left = "50%";
    el.style.top = "50%";
    return el;
  }

  function edPnLabel(i) {
    var total = ed.doc.numPages + ed.pn.start - 1;
    var n = i + ed.pn.start;
    if (ed.pn.format === "n") return String(n);
    if (ed.pn.format === "page-n-of-total") return "Page " + n + " of " + total;
    return n + " / " + total;
  }

  function edPnEl() {
    var el = document.createElement("div");
    el.className = "ed-el ed-pn";
    el.textContent = edPnLabel(ed.page);
    el.style.fontSize = (ed.pn.size * ed.scale) + "px";
    el.style.color = ed.pn.color;
    var off = (28 * ed.scale) + "px";
    el.style.bottom = off;
    if (ed.pn.pos === "bottom-left") { el.style.left = off; }
    else if (ed.pn.pos === "bottom-right") { el.style.right = off; }
    else { el.style.left = "0"; el.style.right = "0"; el.style.textAlign = "center"; }
    return el;
  }

  // --------------------------------------------------------- placing / moving

  var edGesture = null;

  function edPoint(e) {
    var r = $("ed-overlay").getBoundingClientRect();
    return { vx: e.clientX - r.left, vy: e.clientY - r.top };
  }

  function edClamp(it) {
    var m = ed.meta[it.page];
    if (!m) return;
    if (it.kind === "text") {
      it.x = Math.max(0, Math.min(it.x, m.w - 6));
      it.y = Math.max(0, Math.min(it.y, m.h - 6));
    } else {
      it.w = Math.max(6, Math.min(it.w, m.w));
      it.h = Math.max(6, Math.min(it.h, m.h));
      it.x = Math.max(0, Math.min(it.x, m.w - it.w));
      it.y = Math.max(0, Math.min(it.y, m.h - it.h));
    }
  }

  function edAddItem(kind, x, y) {
    var it = { id: ++ed.seq, kind: kind, page: ed.page, x: x, y: y };
    if (kind === "text") {
      it.text = "Text"; it.size = 16; it.font = "Helvetica"; it.color = "#111111";
    } else if (kind === "rect") {
      it.color = "#ffffff";
    }
    ed.items.push(it);
    ed.sel = it.id;
    return it;
  }

  function onEdDown(e) {
    if (e.button !== undefined && e.button !== 0) return;
    if (!ed.vp) return;   // the page is still being drawn; there is nothing to click on yet
    var el = e.target.closest ? e.target.closest(".ed-el") : null;
    var id = el && el.getAttribute("data-id") ? parseInt(el.getAttribute("data-id"), 10) : 0;
    var handle = !!(e.target.classList && e.target.classList.contains("ed-h"));

    if (id && handle) return edBeginResize(e, id, el);
    if (!ed.mode && id) return edBeginMove(e, id, el);
    if (ed.mode === "white") return edBeginDraw(e);
    if (ed.mode === "text") return edPlaceText(e);
    if (ed.mode === "image") return edPlaceImage(e);
    if (ed.sel !== null) { ed.sel = null; renderEdProps(); paintOverlay(); }
  }

  function edCapture(e) {
    try { $("ed-overlay").setPointerCapture(e.pointerId); } catch (err) { /* pointer events still bubble */ }
    e.preventDefault();
  }

  function edPlaceText(e) {
    var p = edPoint(e);
    var at = edToPdf(p.vx, p.vy);
    if (!at) return;
    var it = edAddItem("text", at.x, at.y);
    edClamp(it);
    ed.mode = null;
    edWarn("");
    updateEdBar(); renderEdProps(); paintOverlay(); renderEdItems();
    var inp = $("ed-text");
    if (inp) { inp.focus(); inp.select(); }
  }

  function edPlaceImage(e) {
    if (!ed.img) { ed.mode = null; updateEdBar(); return; }
    var m = ed.meta[ed.page];
    if (!m) return;
    var p = edPoint(e);
    var at = edToPdf(p.vx, p.vy);
    if (!at) return;
    var w = Math.min(m.w * 0.3, 220);
    var it = edAddItem("image", at.x, at.y);
    it.w = w;
    it.h = w * (ed.img.h / ed.img.w);
    it.ar = ed.img.w / ed.img.h;
    it.key = ed.img.key;
    it.bytes = ed.img.bytes;
    it.mime = ed.img.mime;
    it._url = ed.img.url;
    edClamp(it);
    ed.mode = null;
    edWarn("");
    updateEdBar(); renderEdProps(); paintOverlay(); renderEdItems();
  }

  function edBeginDraw(e) {
    var p = edPoint(e);
    var at = edToPdf(p.vx, p.vy);
    if (!at) return;
    var ghost = document.createElement("div");
    ghost.className = "ed-el ed-ghost";
    $("ed-overlay").appendChild(ghost);
    edGesture = { mode: "draw", x0: at.x, y0: at.y, ghost: ghost };
    edCapture(e);
  }

  function edBeginMove(e, id, el) {
    var it = findItem(id);
    if (!it) return;
    ed.sel = id;
    var p = edPoint(e);
    var at = edToPdf(p.vx, p.vy);
    if (!at) return;
    edGesture = { mode: "move", id: id, dx: it.x - at.x, dy: it.y - at.y, el: el };
    renderEdProps(); renderEdItems();
    paintOverlay();
    el = $("ed-overlay").querySelector('.ed-el[data-id="' + id + '"]');
    edGesture.el = el;
    edCapture(e);
  }

  function edBeginResize(e, id, el) {
    var it = findItem(id);
    if (!it) return;
    edGesture = { mode: "size", id: id, el: el, ar: it.w / Math.max(1, it.h), ox: it.x, oy: it.y };
    edCapture(e);
  }

  function onEdMove(e) {
    if (!edGesture) return;
    e.preventDefault();
    var p = edPoint(e);
    var at = edToPdf(p.vx, p.vy);
    if (!at) return;
    var it = findItem(edGesture.id);

    if (edGesture.mode === "draw") {
      var x = Math.min(edGesture.x0, at.x);
      var y = Math.min(edGesture.y0, at.y);
      var w = Math.abs(at.x - edGesture.x0);
      var h = Math.abs(at.y - edGesture.y0);
      var q = edToView(x, y);
      var g = edGesture.ghost;
      g.style.left = q[0] + "px";
      g.style.top = q[1] + "px";
      g.style.width = (w * ed.scale) + "px";
      g.style.height = (h * ed.scale) + "px";
      return;
    }
    if (!it || !edGesture.el) return;

    if (edGesture.mode === "move") {
      it.x = at.x + edGesture.dx;
      it.y = at.y + edGesture.dy;
    } else {
      if (it.kind === "image") {
        it.w = Math.max(8, at.x - edGesture.ox);
        it.h = it.w / (edGesture.ar || 1);
      } else {
        it.w = Math.max(8, at.x - edGesture.ox);
        it.h = Math.max(8, at.y - edGesture.oy);
      }
    }
    edClamp(it);
    var v = edToView(it.x, it.y);
    edGesture.el.style.left = v[0] + "px";
    edGesture.el.style.top = v[1] + "px";
    if (it.kind !== "text") {
      edGesture.el.style.width = Math.max(4, it.w * ed.scale) + "px";
      edGesture.el.style.height = Math.max(4, it.h * ed.scale) + "px";
    }
  }

  function onEdUp(e) {
    if (!edGesture) return;
    var g = edGesture;
    edGesture = null;
    try { $("ed-overlay").releasePointerCapture(e.pointerId); } catch (err) { /* already released */ }

    if (g.mode === "draw") {
      if (g.ghost && g.ghost.parentNode) g.ghost.parentNode.removeChild(g.ghost);
      var p = edPoint(e);
      var at = edToPdf(p.vx, p.vy);
      var x = Math.min(g.x0, at.x), y = Math.min(g.y0, at.y);
      var w = Math.abs(at.x - g.x0), h = Math.abs(at.y - g.y0);
      if (w >= 6 && h >= 4) {
        var it = edAddItem("rect", x, y);
        it.w = w; it.h = h;
        edClamp(it);
        ed.mode = null;
        edWarn("");
      }
      updateEdBar(); renderEdProps(); paintOverlay(); renderEdItems();
      return;
    }
    if (g.mode === "move") { renderEdProps(); renderEdItems(); paintOverlay(); }
    else { renderEdProps(); paintOverlay(); }
  }

  // ------------------------------------------------------------------ panels

  function onEdClick(e) {
    var b = e.target.closest ? e.target.closest("[data-ed],[data-pg],[data-del],[data-rm],[data-go]") : null;
    if (!b) return;
    if (b.hasAttribute("data-del")) {
      var d = b.getAttribute("data-del");
      var target = d ? parseInt(d, 10) : ed.sel;
      if (target !== null) removeEdItem(target);
      return;
    }
    if (b.hasAttribute("data-rm")) return removeEdItem(parseInt(b.getAttribute("data-rm"), 10));
    if (b.hasAttribute("data-go")) return edGoPage(parseInt(b.getAttribute("data-go"), 10));
    if (b.hasAttribute("data-pg")) return edGoPage(ed.page + parseInt(b.getAttribute("data-pg"), 10));

    var k = b.getAttribute("data-ed");
    if (k === "image") { $("ed-img").click(); return; }
    if (k === "image-again") {
      if (!ed.img) return;
      ed.mode = ed.mode === "image" ? null : "image";
      ed.panel = null; ed.sel = null;
    } else if (k === "text" || k === "white") {
      ed.mode = ed.mode === k ? null : k;
      ed.panel = null; ed.sel = null;
    } else if (k === "wm" || k === "pn") {
      ed.panel = ed.panel === k ? null : k;
      ed.mode = null; ed.sel = null;
    }
    edWarn(""); updateEdBar(); renderEdProps(); paintOverlay();
  }

  function removeEdItem(id) {
    ed.items = ed.items.filter(function (it) { return it.id !== id; });
    if (ed.sel === id) ed.sel = null;
    edWarn(""); updateEdBar(); renderEdProps(); paintOverlay(); renderEdItems();
  }

  function edGoPage(i) {
    if (i < 0 || i >= ed.doc.numPages) return;
    ed.page = i;
    ed.sel = null;
    edGesture = null;
    edRender().then(function () {
      renderEdProps();
      renderEdItems();
    }).catch(function (err) {
      edWarn(err && err.message ? err.message : String(err));
    });
  }

  function onEdInput(e) {
    var el = e.target;
    var k = el.getAttribute("data-k");
    if (!k) return;
    var scope = el.getAttribute("data-scope") || "item";
    var v = el.type === "checkbox" ? el.checked : el.value;
    if (el.type === "number" || el.type === "range") {
      v = Number(v);
      if (!isFinite(v)) v = 0;
      var lo = parseFloat(el.getAttribute("min"));
      var hi = parseFloat(el.getAttribute("max"));
      if (!isNaN(lo)) v = Math.max(lo, v);
      if (!isNaN(hi)) v = Math.min(hi, v);
    }

    if (scope === "wm") {
      ed.wm[k] = v;
    } else if (scope === "pn") {
      ed.pn[k] = v;
    } else {
      var it = findItem(ed.sel);
      if (!it) return;
      if (it.kind === "image" && k === "w") {
        it.w = Math.max(8, v);
        it.h = it.w / (it.ar || 1);
      } else {
        it[k] = v;
      }
      edClamp(it);
      if (k === "text") edCheckText(it);
    }
    paintOverlay();
    renderEdItems();
    updateEdBar();
  }

  /** The engine's fonts are Latin-only, and it refuses mid-write — so say so first. */
  function edCheckText(it) {
    var bad = "";
    for (var i = 0; i < it.text.length; i++) {
      if (it.text.charCodeAt(i) > 255) { bad = it.text.charAt(i); break; }
    }
    edWarn(bad
      ? 'The standard PDF fonts cover Latin characters only, so "' + bad + '" cannot be written. ' +
        "Remove it, or type that text in the application that made the document."
      : "");
  }

  function edField(label, inner) {
    return '<label class="field">' + label + inner + "</label>";
  }

  function edNum(scope, key, val, min, max, step) {
    return '<input type="number" data-scope="' + scope + '" data-k="' + key + '" value="' + val +
      '" min="' + min + '" max="' + max + '" step="' + (step || 1) + '" />';
  }

  function edColor(scope, key, val) {
    return '<input type="color" data-scope="' + scope + '" data-k="' + key + '" value="' + val + '" />';
  }

  function renderEdProps() {
    var host = $("ed-props");
    if (!host) return;
    var html = "";
    var it = ed.sel !== null ? findItem(ed.sel) : null;

    if (ed.panel === "wm") {
      html =
        '<p class="ed-ptitle">Watermark on every page</p>' +
        '<div class="row">' +
        '<label class="ed-check"><input type="checkbox" data-scope="wm" data-k="on"' +
          (ed.wm.on ? " checked" : "") + ' /> Add a watermark</label>' +
        edField("Text", '<input type="text" data-scope="wm" data-k="text" value="' + escapeHtml(ed.wm.text) + '" maxlength="40" />') +
        edField("Size", edNum("wm", "size", ed.wm.size, 8, 200)) +
        edField("Colour", edColor("wm", "color", ed.wm.color)) +
        edField("Angle", edNum("wm", "rotate", ed.wm.rotate, -90, 90)) +
        '</div>' +
        '<div class="row">' + edField("Opacity", '<input type="range" data-scope="wm" data-k="opacity" min="0.05" max="1" step="0.01" value="' + ed.wm.opacity + '" />') + "</div>";

    } else if (ed.panel === "pn") {
      html =
        '<p class="ed-ptitle">Page numbers</p>' +
        '<div class="row">' +
        '<label class="ed-check"><input type="checkbox" data-scope="pn" data-k="on"' +
          (ed.pn.on ? " checked" : "") + ' /> Number every page</label>' +
        edField("Position", '<select data-scope="pn" data-k="pos">' +
          ["bottom-left", "bottom-center", "bottom-right"].map(function (v) {
            var label = { "bottom-left": "Bottom left", "bottom-center": "Bottom centre", "bottom-right": "Bottom right" }[v];
            return '<option value="' + v + '"' + (ed.pn.pos === v ? " selected" : "") + ">" + label + "</option>";
          }).join("") + "</select>") +
        edField("Format", '<select data-scope="pn" data-k="format">' +
          [["n", "3"], ["n / total", "3 / 12"], ["page-n-of-total", "Page 3 of 12"]].map(function (o) {
            return '<option value="' + o[0] + '"' + (ed.pn.format === o[0] ? " selected" : "") + ">" + o[1] + "</option>";
          }).join("") + "</select>") +
        edField("Start at", edNum("pn", "start", ed.pn.start, 1, 9999)) +
        edField("Size", edNum("pn", "size", ed.pn.size, 6, 48)) +
        edField("Colour", edColor("pn", "color", ed.pn.color)) +
        '</div>' +
        '<p class="hint">Numbers go on every page, so a cover sheet that should not carry one needs the ' +
        'Merge tool afterwards. The start number is for continuing numbering from another document.</p>';

    } else if (it) {
      var head = '<p class="ed-ptitle">' + (it.kind === "text" ? "Text box" : it.kind === "image" ? "Image" : "White-out box") +
        ' <span class="hint">page ' + (it.page + 1) + " · left " + Math.round(it.x) + "pt · top " + Math.round(it.y) + "pt</span></p>";
      if (it.kind === "text") {
        html = head +
          '<div class="row">' +
          edField("Text", '<input type="text" id="ed-text" data-scope="item" data-k="text" value="' + escapeHtml(it.text) + '" />') +
          edField("Font", '<select data-scope="item" data-k="font">' +
            ED_FONTS.map(function (f) {
              return '<option value="' + f + '"' + (it.font === f ? " selected" : "") + ">" + f.replace(/-/g, " ") + "</option>";
            }).join("") + "</select>") +
          edField("Size", edNum("item", "size", it.size, 4, 144)) +
          edField("Colour", edColor("item", "color", it.color)) +
          "</div>";
      } else if (it.kind === "image") {
        html = head +
          '<div class="row">' +
          edField("Width", edNum("item", "w", Math.round(it.w), 8, 2000)) +
          edField("Height <span class=\"hint\">(kept in proportion)</span>", '<input type="text" value="' + Math.round(it.h) + ' pt" disabled />') +
          "</div>" +
          '<p class="hint">Drag the corner to resize, or drag the picture to move it.</p>';
      } else {
        html = head +
          '<div class="row">' +
          edField("Width", edNum("item", "w", Math.round(it.w), 6, 2000)) +
          edField("Height", edNum("item", "h", Math.round(it.h), 6, 2000)) +
          "</div>" +
          '<p class="hint">A white-out box only hides what is underneath — the original text is still ' +
          "inside the file, so do not use it to redact anything sensitive.</p>";
      }
      html += '<div class="row"><button type="button" class="ghost" data-del="' + it.id + '">Remove this element</button></div>';
    } else {
      html = '<p class="hint">Pick <strong>Text</strong>, <strong>Signature or image</strong> or ' +
        "<strong>White-out</strong> above, then click the page where it should go. Click anything you have " +
        "placed to change it, or use the watermark and page-number panels for the whole document.</p>";
    }
    host.innerHTML = html;
  }

  function renderEdItems() {
    var host = $("ed-items");
    if (!host || !ed.doc) return;
    if (!ed.items.length) {
      host.innerHTML = '<p class="hint">Nothing placed yet.</p>';
      return;
    }
    host.innerHTML = '<p class="ed-ptitle">Placed elements</p>' +
      ed.items.map(function (it) {
        var what = it.kind === "text" ? '"' + escapeHtml(String(it.text).slice(0, 40)) + '"'
          : it.kind === "image" ? "signature or image"
            : "white-out box";
        return '<div class="ed-row' + (ed.sel === it.id ? " sel" : "") + '">' +
          '<span class="ed-k">' + it.kind + "</span>" +
          '<span class="ed-d">' + what + "</span>" +
          '<button type="button" class="link" data-go="' + it.page + '">page ' + (it.page + 1) + "</button>" +
          '<button type="button" class="link" data-rm="' + it.id + '">remove</button>' +
          "</div>";
      }).join("");
  }

  function updateEdBar() {
    if (!ed.doc) return;
    Array.prototype.forEach.call(document.querySelectorAll("[data-ed]"), function (b) {
      var k = b.getAttribute("data-ed");
      b.classList.toggle("on",
        k === ed.mode || (k === "wm" && ed.panel === "wm") || (k === "pn" && ed.panel === "pn"));
    });
    var again = document.querySelector('[data-ed="image-again"]');
    if (again) again.hidden = !ed.img;

    var hint = $("ed-hint");
    if (hint) {
      hint.textContent = ed.mode === "text" ? "Click on the page to place a text box."
        : ed.mode === "image" ? "Click on the page where the image should go."
          : ed.mode === "white" ? "Drag a box over the part you want to cover."
            : "Click an element on the page to change it.";
    }
    var pno = $("ed-pageno");
    if (pno) {
      var on = ed.items.filter(function (it) { return it.page === ed.page; }).length;
      pno.textContent = "Page " + (ed.page + 1) + " of " + ed.doc.numPages +
        (on ? " · " + on + " here" : "");
    }
    var st = $("ed-status");
    if (st) {
      st.textContent = ed.items.length
        ? ed.items.length + (ed.items.length === 1 ? " element placed" : " elements placed")
        : "Nothing placed yet";
    }
    var prev = document.querySelector('[data-pg="-1"]');
    var next = document.querySelector('[data-pg="1"]');
    if (prev) prev.disabled = ed.page === 0;
    if (next) next.disabled = ed.page === ed.doc.numPages - 1;
  }

  /**
   * The one place the UI turns into an engine spec. Exported below so the
   * browser test page can check it without going through a download.
   *
   * A text box the visitor emptied is dropped rather than written as blank, and
   * a spec with nothing in it at all returns null so Process can say so.
   */
  function edBuildSpec() {
    var items = [];
    ed.items.forEach(function (it) {
      if (it.kind === "text") {
        if (!String(it.text).trim()) return;
        items.push({
          kind: "text", page: it.page, x: it.x, y: it.y, text: it.text,
          size: it.size, font: it.font, color: it.color
        });
      } else if (it.kind === "image") {
        items.push({
          kind: "image", page: it.page, x: it.x, y: it.y, w: it.w, h: it.h,
          key: it.key, bytes: it.bytes, mime: it.mime
        });
      } else {
        items.push({ kind: "rect", page: it.page, x: it.x, y: it.y, w: it.w, h: it.h, color: it.color });
      }
    });
    var wm = ed.wm.on && String(ed.wm.text).trim()
      ? { text: ed.wm.text, size: ed.wm.size, color: ed.wm.color, opacity: ed.wm.opacity, rotate: ed.wm.rotate }
      : null;
    var pn = ed.pn.on
      ? { position: ed.pn.pos, format: ed.pn.format, size: ed.pn.size, color: ed.pn.color, start: ed.pn.start }
      : null;
    if (!items.length && !wm && !pn) return null;
    return { items: items, watermark: wm, pageNumbers: pn };
  }

  // Backspace/Delete removes the selected element, Escape cancels the armed
  // tool. Bound once at load: it does nothing at all until a document is open.
  document.addEventListener("keydown", function (e) {
    if (!ed.doc) return;
    var t = e.target;
    var typing = t && (t.tagName === "INPUT" || t.tagName === "SELECT" || t.tagName === "TEXTAREA");
    if ((e.key === "Delete" || e.key === "Backspace") && ed.sel !== null && !typing) {
      e.preventDefault();
      removeEdItem(ed.sel);
    } else if (e.key === "Escape") {
      ed.mode = null; ed.panel = null;
      updateEdBar(); renderEdProps(); paintOverlay();
    }
  });

  var edResizeTimer = null;
  window.addEventListener("resize", function () {
    if (!ed.doc) return;
    clearTimeout(edResizeTimer);
    edResizeTimer = setTimeout(function () {
      if (ed.doc) edRender().catch(function () { /* a resize is not worth an error banner */ });
    }, 180);
  });

  // Exposed for tools/test_ui_load.js, which loads this file in Node and checks
  // that every page in web/ calling PDFStudioInit("<slug>") has a matching entry
  // here. A missing entry makes that page's Process button silently do nothing.
  window.PDFStudioTools = TOOLS;

  // A small, documented surface for the console and for the end-to-end test. It
  // holds no state of its own — everything here is the same object the UI drives.
  window.PDFStudioEditor = {
    state: ed,
    buildSpec: edBuildSpec,
    addItem: edAddItem,
    render: edRender,
    place: edPlaceText
  };

  window.PDFStudioInit = function (toolId) {
    var t = TOOLS[toolId];
    if (!t) return;
    state.id = toolId;
    if (t.reset) t.reset();
    if (t.controls) t.controls($("controls"));

    var input = $("file-input");
    input.accept = t.accept;
    input.multiple = !!t.multiple;
    var hint = $("drop-hint");
    if (hint && t.multiple) hint.textContent = "or click to browse — add one or several, nothing is uploaded";

    // Start fetching the libraries as soon as the visitor shows intent. This
    // overlaps the download with the time they spend picking a file.
    $("drop").onclick = function () { startLoading(); input.click(); };
    input.onchange = function () { addFiles(input.files); input.value = ""; };
    ["dragenter", "dragover"].forEach(function (ev) {
      $("drop").addEventListener(ev, function (e) {
        e.preventDefault();
        startLoading();
        $("drop").classList.add("over");
      });
    });
    ["dragleave", "drop"].forEach(function (ev) {
      $("drop").addEventListener(ev, function (e) { e.preventDefault(); $("drop").classList.remove("over"); });
    });
    $("drop").addEventListener("drop", function (e) {
      if (e.dataTransfer && e.dataTransfer.files) addFiles(e.dataTransfer.files);
    });
    $("run").onclick = run;
    $("clear").onclick = function () {
      state.files = [];
      if (t.reset) t.reset();
      renderFiles();
      clearMsg();
    };
    renderFiles();
  };
})();
