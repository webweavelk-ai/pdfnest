/* End-to-end check for the annotation editor (tool 8), run against the real
 * deployed page.
 *
 * HOW TO RUN: this file must execute in the PAGE's own JavaScript world, because
 * it reaches for window.PDFLib, window.pdfjsLib and window.PDFStudioEditor. A
 * console/debugger evaluate may run in an isolated world where none of those
 * exist, so inject it as a script element instead:
 *
 *   node -e "const fs=require('fs');const s=fs.readFileSync('tools/editor_e2e.js','utf8');fs.writeFileSync('tools/_e2e_inject.js','(function(){var e=document.createElement(\"script\");e.textContent=' + JSON.stringify(s) + ';document.head.appendChild(e);return \"injected\";})()')"
 *
 * then evaluate tools/_e2e_inject.js and poll for #__e2e_out.
 *
 * It writes its full result into a <pre id="__e2e_out"> in the page (readable
 * from either world, and visible in a screenshot) and also returns it, so an
 * awaiting evaluate works too.
 *
 * It drives the actual UI — drag-and-drop, clicks on the rendered page, the
 * property panel, the Process button — rather than calling the engine directly,
 * because the interesting failure modes (device pixel ratio, the media box
 * origin, page rotation, zoom) live in the layer between the pointer and the
 * PDF, not in the engine.
 *
 * The download is intercepted: URL.createObjectURL captures the produced Blob
 * and HTMLAnchorElement.click is neutered, so nothing lands in Downloads and
 * the bytes can be read back and rendered for measurement.
 */
(async () => {
  const out = { page: location.href, checks: [], notes: {}, errors: [] };
  const add = (name, ok, detail) =>
    out.checks.push({ name, ok: !!ok, detail: detail === undefined || detail === null ? null : String(detail) });
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  let published = false;
  const WATCHDOG_MS = 150000;
  const waitFor = async (fn, ms = 20000, step = 120) => {
    const t0 = Date.now();
    while (Date.now() - t0 < ms) {
      try { const v = fn(); if (v) return v; } catch (e) { /* keep polling */ }
      await sleep(step);
    }
    return null;
  };
  window.addEventListener("error", (e) => out.errors.push("error: " + e.message));
  window.addEventListener("unhandledrejection", (e) => out.errors.push("rejection: " + e.reason));

  const $ = (id) => document.getElementById(id);
  const overlay = () => $("ed-overlay");
  const S = () => window.PDFStudioEditor.state;

  // A running commentary in the DOM. If the run ever hangs, the last line here
  // says where — which is the difference between a diagnosable failure and
  // "nothing happened".
  function progress(text) {
    let p = $("__e2e_progress");
    if (!p) {
      p = document.createElement("pre");
      p.id = "__e2e_progress";
      p.style.cssText = "font:12px ui-monospace,monospace;background:#1b2431;color:#a7f3d0;" +
        "padding:10px;border-radius:8px;white-space:pre-wrap";
      document.body.appendChild(p);
    }
    p.textContent += text + "\n";
    window.__e2eStep = text;
  }

  // pdf.js promises have no timeout of their own. Racing them means a stall
  // becomes a reported failure instead of a run that never ends.
  const withTimeout = (p, ms, label) => Promise.race([p, new Promise((_, rej) =>
    setTimeout(() => rej(new Error("timed out after " + ms + "ms: " + label)), ms))]);

  // ---------------------------------------------------------------- helpers

  let captured = null;
  const realCreate = URL.createObjectURL.bind(URL);
  URL.createObjectURL = function (b) {
    if (b instanceof Blob && b.type === "application/pdf") captured = b;
    return realCreate(b);
  };
  HTMLAnchorElement.prototype.click = function () { /* swallow the download */ };

  async function makeFile(opts) {
    const size = opts.size || [400, 400];
    const doc = await PDFLib.PDFDocument.create();
    for (let i = 0; i < (opts.pages || 1); i++) {
      const p = doc.addPage(size);
      p.drawText("ORIGINAL " + (i + 1), { x: 40, y: size[1] - 60, size: 18, color: PDFLib.rgb(0, 0, 0) });
      if (opts.rotate) p.setRotation(PDFLib.degrees(opts.rotate));
    }
    return new File([await doc.save()], "probe.pdf", { type: "application/pdf" });
  }

  async function dropFile(file) {
    const dt = new DataTransfer();
    dt.items.add(file);
    $("drop").dispatchEvent(new DragEvent("drop", { bubbles: true, cancelable: true, dataTransfer: dt }));
    // Wait for the PAGE to be drawn, not merely for the document to be open. The
    // editor has no coordinate system until the first render lands, so clicking
    // sooner is the same race a person could hit by dropping and clicking fast.
    return waitFor(() => S().doc && S().doc.numPages && overlay() && S().vp !== null, 30000);
  }

  function pointer(type, r, fx, fy, id) {
    return new PointerEvent(type, {
      bubbles: true, cancelable: true, pointerId: id || 1, pointerType: "mouse",
      isPrimary: true, button: 0, buttons: 1,
      clientX: r.left + r.width * fx, clientY: r.top + r.height * fy
    });
  }
  function stageClick(fx, fy) {
    const r = overlay().getBoundingClientRect();
    overlay().dispatchEvent(pointer("pointerdown", r, fx, fy));
    overlay().dispatchEvent(pointer("pointerup", r, fx, fy));
    return { w: r.width, h: r.height };
  }
  function stageDrag(fx0, fy0, fx1, fy1) {
    const r = overlay().getBoundingClientRect();
    overlay().dispatchEvent(pointer("pointerdown", r, fx0, fy0, 2));
    overlay().dispatchEvent(pointer("pointermove", r, fx1, fy1, 2));
    overlay().dispatchEvent(pointer("pointerup", r, fx1, fy1, 2));
  }
  const arm = (kind) => document.querySelector('[data-ed="' + kind + '"]').click();
  function setProp(k, v) {
    const el = document.querySelector('[data-scope="item"][data-k="' + k + '"]');
    if (!el) return false;
    el.value = v;
    el.dispatchEvent(new Event("input", { bubbles: true }));
    return true;
  }
  async function process() {
    captured = null;
    const msg = $("msg");
    msg.className = "msg";
    $("run").click();
    return waitFor(() => (msg.className.indexOf("ok") >= 0 || msg.className.indexOf("err") >= 0) ? msg : null, 40000);
  }

  // Measuring the OUTPUT goes through the site's own render path rather than
  // calling pdf.js directly: openForRendering + renderPage are the two functions
  // the editor itself uses on every drop, so if they work for the preview they
  // work here, and a failure means something real rather than a second, subtly
  // different way of driving pdf.js.
  const E = window.PDFStudioEngine;

  async function render(bytes, scale) {
    const file = new File([bytes], "output.pdf", { type: "application/pdf" });
    const doc = await withTimeout(E.openForRendering(file), 30000, "openForRendering the output");
    const canvas = await withTimeout(E.renderPage(doc, 1, scale), 30000, "renderPage the output");
    return {
      w: canvas.width, h: canvas.height,
      data: canvas.getContext("2d").getImageData(0, 0, canvas.width, canvas.height).data
    };
  }

  // Fallback measurement: feed the output back into the editor and read the
  // page the editor draws. This is the render path the visitor actually uses, so
  // if a preview of a document can be seen at all, this can measure it. Nearest
  // neighbour scaling keeps the ink at full strength, and the result is exactly
  // one pixel per PDF point, which is what the ink checks compare against.
  async function measureViaEditor(bytes) {
    if (!await dropFile(new File([bytes], "measure.pdf", { type: "application/pdf" }))) {
      throw new Error("the editor did not finish drawing the output");
    }
    await sleep(300);
    const src = $("ed-canvas");
    if (!src || src.width < 2 || src.height < 2) throw new Error("the preview canvas was not drawn");
    const meta = S().meta[0];
    const out = document.createElement("canvas");
    out.width = Math.round(meta.w);
    out.height = Math.round(meta.h);
    const octx = out.getContext("2d");
    octx.imageSmoothingEnabled = false;
    octx.fillStyle = "#fff";
    octx.fillRect(0, 0, out.width, out.height);
    octx.drawImage(src, 0, 0, out.width, out.height);
    return { w: out.width, h: out.height, data: octx.getImageData(0, 0, out.width, out.height).data };
  }

  // Isolated so one stalled measurement cannot take the rest of the run with it.
  // The editor's own render is tried first because it is the path a visitor
  // exercises; a direct pdf.js render is the fallback, not the default.
  async function tryRender(bytes, scale, label) {
    try {
      return await measureViaEditor(bytes);
    } catch (err) {
      progress("editor-canvas measurement failed (" + label + "): " + ((err && err.message) || err) +
        " — falling back to a direct pdf.js render");
      try {
        return await render(bytes, scale);
      } catch (err2) {
        add("measure the output (" + label + ")", false,
          (err && err.message) + " / pdf.js: " + ((err2 && err2.message) || err2));
        return null;
      }
    }
  }
  function ink(r, test) {
    let n = 0, left = 1e9, top = 1e9, right = -1, bottom = -1;
    let sL = 0, nL = 0, sR = 0, nR = 0;
    for (let y = 0; y < r.h; y++) {
      for (let x = 0; x < r.w; x++) {
        const i = (y * r.w + x) * 4;
        if (!test(r.data, i)) continue;
        n++;
        if (x < left) left = x;
        if (x > right) right = x;
        if (y < top) top = y;
        if (y > bottom) bottom = y;
        if (x < r.w / 3) { sL += y; nL++; } else if (x > (2 * r.w) / 3) { sR += y; nR++; }
      }
    }
    return {
      count: n, left: left === 1e9 ? null : left, top: top === 1e9 ? null : top,
      right: right < 0 ? null : right, bottom: bottom < 0 ? null : bottom,
      meanYLeft: nL ? Math.round((sL / nL) * 10) / 10 : null,
      meanYRight: nR ? Math.round((sR / nR) * 10) / 10 : null
    };
  }
  const isRed = (d, i) => d[i] > 140 && d[i + 1] < 90 && d[i + 2] < 90;
  const isBlue = (d, i) => d[i] < 90 && d[i + 1] < 90 && d[i + 2] > 140;
  const isGreen = (d, i) => d[i] < 110 && d[i + 1] > 110 && d[i + 2] < 110;
  const isBlack = (d, i) => d[i] < 110 && d[i + 1] < 110 && d[i + 2] < 110;

  async function pageText(bytes) {
    const file = new File([bytes], "output.pdf", { type: "application/pdf" });
    const doc = await withTimeout(E.openForRendering(file), 30000, "open the output for text");
    const pg = await withTimeout(doc.getPage(1), 20000, "getPage of the output");
    const tc = await withTimeout(pg.getTextContent(), 20000, "getTextContent of the output");
    return tc.items.map((i) => i.str).join(" ");
  }

  async function tryText(bytes, label) {
    try {
      return await pageText(bytes);
    } catch (err) {
      add("read the output's text back (" + label + ")", false, (err && err.message) || String(err));
      return null;
    }
  }

  // ------------------------------------------------------------------ start

  try {
    // An inline <script> appended to the document can be executed by the parser
    // BETWEEN the page's own end-of-body scripts — while it is stalled fetching
    // engine.js, say — so an injected test can start before app.js has attached
    // anything. Waiting for the load event removes that race entirely; without
    // it the run fails with "PDFLib is not defined" for no useful reason.
    if (document.readyState !== "complete") {
      await new Promise((r) => window.addEventListener("load", r, { once: true }));
    }
    await sleep(500);

    if (!$("drop")) { add("the editor page exposes its drop zone", false, location.href); return out; }

    // Where did this run, and did the page's own code get as far as wiring the
    // tool up? Without this the whole run is unreadable when it fails early.
    const resources = performance.getEntriesByType("resource").map((r) => r.name);
    out.notes.env = {
      href: location.href,
      hasDropZone: !!$("drop"),
      typeofAssets: typeof window.PDFSTUDIO_ASSETS,
      typeofInit: typeof window.PDFStudioInit,
      typeofEngine: typeof window.PDFStudioEngine,
      typeofEditor: typeof window.PDFStudioEditor,
      typeofPdfLib: typeof window.PDFLib,
      typeofPdfjs: typeof window.pdfjsLib,
      pdfLibRequestsAtStart: resources.filter((n) => n.indexOf("pdf-lib") >= 0).length
    };

    // Arming the lazy loader: the tool starts fetching the vendor bundles on the
    // first sign of intent. Retry until the page's own handler actually answers,
    // so a slow start cannot look like a broken feature.
    let armed = false;
    for (let i = 0; i < 40 && !armed; i++) {
      $("drop").dispatchEvent(new DragEvent("dragenter", { bubbles: true, cancelable: true }));
      $("drop").dispatchEvent(new DragEvent("dragover", { bubbles: true, cancelable: true }));
      armed = $("drop").classList.contains("over");
      $("drop").classList.remove("over");
      if (!armed) await sleep(250);
    }
    out.notes.env.intentHandlerRan = armed;

    const libs = await waitFor(() => window.PDFLib && window.pdfjsLib, 60000);
    out.notes.env.pdfLibRequestsAfterIntent =
      performance.getEntriesByType("resource").filter((n) => n.name.indexOf("pdf-lib") >= 0).length;
    add("the page's own code is running and the tool wired itself up",
      out.notes.env.typeofInit === "function" && out.notes.env.typeofEngine === "object" && armed,
      JSON.stringify(out.notes.env));
    add("vendor libraries load on intent", !!libs,
      "PDFLib=" + typeof window.PDFLib + " pdfjsLib=" + typeof window.pdfjsLib);
    add("the test surface is exported", !!window.PDFStudioEditor);
    progress("env: " + JSON.stringify(out.notes.env));

    // ---- A: geometry on an unrotated page ----
    progress("A: drop a 400x400 page");
    await dropFile(await makeFile({ pages: 1, size: [400, 400] }));
    add("the dropped document opens in the editor", S().doc && S().doc.numPages === 1,
      "numPages=" + (S().doc && S().doc.numPages));
    let r = overlay().getBoundingClientRect();
    add("the page is drawn at a usable size", r.height > 120, Math.round(r.width) + "x" + Math.round(r.height) + " px");
    add("a click has a coordinate system to land in", S().vp !== null,
      "viewport " + (S().vp ? "ready at scale " + S().scale : "missing"));
    out.notes.zoomScale = S().scale;

    arm("text");
    stageClick(0.5, 0.5);
    let it = S().items[0];
    add("click at the page centre records PDF point 200,200",
      it && Math.abs(it.x - 200) < 1.5 && Math.abs(it.y - 200) < 1.5,
      it ? "x=" + it.x.toFixed(2) + " y=" + it.y.toFixed(2) + " (expected 200,200)" : "no element was created");

    arm("text");
    stageClick(0.25, 0.75);
    it = S().items[1];
    add("click at 25%/75% records PDF point 100,300",
      it && Math.abs(it.x - 100) < 1.5 && Math.abs(it.y - 300) < 1.5,
      it ? "x=" + it.x.toFixed(2) + " y=" + it.y.toFixed(2) + " (expected 100,300)" : "no element was created");

    // ---- B: a page stored rotated ----
    progress("B: drop a page stored rotated 90");
    await dropFile(await makeFile({ pages: 1, size: [400, 600], rotate: 90 }));
    r = overlay().getBoundingClientRect();
    add("a rotated page is drawn with width and height swapped", r.width > r.height,
      Math.round(r.width) + "x" + Math.round(r.height) + " px");
    arm("text");
    stageClick(0.5, 0.5);
    it = S().items[0];
    add("clicking the centre of a rotated page records the unrotated centre 200,300",
      it && Math.abs(it.x - 200) < 2 && Math.abs(it.y - 300) < 2,
      it ? "x=" + it.x.toFixed(2) + " y=" + it.y.toFixed(2) + " (expected 200,300)" : "no element was created");

    // ---- C: text placement survives into the written file ----
    progress("C: place text and Process");
    await dropFile(await makeFile({ pages: 1, size: [400, 400] }));
    const inputSize = S().file.size;
    arm("text");
    stageClick(0.25, 0.25);
    const panelWorked = setProp("text", "HHHH") && setProp("size", "24") && setProp("color", "#ff0000");
    it = S().items[0];
    add("the property panel edits the placed element",
      panelWorked && it.text === "HHHH" && it.color === "#ff0000" && it.size === 24,
      it ? JSON.stringify({ text: it.text, color: it.color, size: it.size }) : "no element");

    let msg = await process();
    add("Process reports success", msg && msg.className.indexOf("ok") >= 0, msg ? msg.textContent.slice(0, 80) : "no message");
    add("a PDF came out", !!captured, captured ? captured.size + " bytes, input " + inputSize : "nothing captured");

    if (captured) {
      const bytes = new Uint8Array(await captured.arrayBuffer());
      const doc = await PDFLib.PDFDocument.load(bytes, { ignoreEncryption: true });
      const size = doc.getPage(0).getSize();
      add("the edited file still has one page", doc.getPageCount() === 1, doc.getPageCount());
      add("the edited file keeps the page size", Math.abs(size.width - 400) < 1 && Math.abs(size.height - 400) < 1,
        Math.round(size.width) + "x" + Math.round(size.height));
      const img = await tryRender(bytes, 1, "red text");
      if (img) {
        const red = ink(img, isRed);
        out.notes.redText = red;
        add("the placed text is visible in the output", red.count > 20, red.count + " red pixels");
        add("it lands where it was placed (100,100, +/- 8pt)",
          red.left !== null && Math.abs(red.left - 100) < 8 && Math.abs(red.top - 100) < 8,
          "ink box left=" + red.left + " top=" + red.top + " (expected about 100,100)");
      }
      const text = await tryText(bytes, "original text still there");
      if (text !== null) {
        add("the page's original text is untouched", text.indexOf("ORIGINAL 1") >= 0, JSON.stringify(text.slice(0, 40)));
      }
    }

    // ---- D: the watermark preview must lean the same way as the file ----
    progress("D: watermark direction");
    await dropFile(await makeFile({ pages: 1, size: [400, 400] }));
    S().wm.on = true;
    S().wm.text = "DIRECTION";
    S().wm.size = 56;
    S().wm.color = "#0000ff";
    S().wm.opacity = 0.7;
    S().wm.rotate = -30;
    try {
      await withTimeout(window.PDFStudioEditor.render(), 30000, "repaint the preview with the watermark");
    } catch (err) {
      progress("preview repaint did not finish: " + ((err && err.message) || err));
    }
    const wmEl = document.querySelector(".ed-wm");
    const tf = wmEl ? getComputedStyle(wmEl).transform : null;
    const mm = tf && tf.match(/matrix\(([^)]+)\)/);
    const cssAngle = mm ? Math.round((Math.atan2(+mm[1].split(",")[1], +mm[1].split(",")[0]) * 180) / Math.PI) : null;
    msg = await process();
    add("the watermark alone is accepted by Process", msg && msg.className.indexOf("ok") >= 0,
      msg ? msg.textContent.slice(0, 80) : "no message");
    if (captured) {
      const img = await tryRender(new Uint8Array(await captured.arrayBuffer()), 1, "watermark");
      if (img) {
        const blue = ink(img, isBlue);
        out.notes.watermark = {
          previewTransform: tf, previewCssAngleDeg: cssAngle,
          writtenInkPixels: blue.count, meanYLeft: blue.meanYLeft, meanYRight: blue.meanYRight,
          writtenDescendsToTheRight: blue.meanYLeft !== null && blue.meanYRight !== null
            ? blue.meanYRight > blue.meanYLeft : null,
          previewDescendsToTheRight: cssAngle === null ? null : cssAngle > 0
        };
        add("the watermark is drawn on the page", blue.count > 100, blue.count + " blue pixels");
        add("the preview and the written file lean the same way",
          out.notes.watermark.previewDescendsToTheRight !== null &&
          out.notes.watermark.writtenDescendsToTheRight === out.notes.watermark.previewDescendsToTheRight,
          JSON.stringify({ preview: out.notes.watermark.previewDescendsToTheRight, written: out.notes.watermark.writtenDescendsToTheRight }));
      }
    }

    // ---- E: page numbers on every page ----
    progress("E: page numbers");
    await dropFile(await makeFile({ pages: 2, size: [400, 400] }));
    S().pn.on = true;
    S().pn.color = "#00aa00";
    S().pn.pos = "bottom-center";
    S().pn.format = "n / total";
    msg = await process();
    add("page numbers alone are accepted by Process", msg && msg.className.indexOf("ok") >= 0,
      msg ? msg.textContent.slice(0, 80) : "no message");
    if (captured) {
      const img = await tryRender(new Uint8Array(await captured.arrayBuffer()), 1, "page numbers");
      if (img) {
        const green = ink(img, isGreen);
        out.notes.pageNumberInk = green;
        add("a page number is drawn near the bottom of the page",
          green.count > 10 && green.bottom !== null && green.bottom > img.h - 70,
          "ink box=" + JSON.stringify(green));
      }
    }

    // ---- F: white-out, and the honest claim that it hides rather than removes ----
    progress("F: white-out box");
    await dropFile(await makeFile({ pages: 1, size: [400, 400] }));
    arm("white");
    stageDrag(0.06, 0.04, 0.62, 0.24);
    const rect = S().items[0];
    add("a dragged white-out box is created with the dragged rectangle",
      rect && rect.kind === "rect" && Math.abs(rect.x - 24) < 3 && Math.abs(rect.w - 224) < 4,
      rect ? "x=" + rect.x.toFixed(0) + " y=" + rect.y.toFixed(0) + " w=" + rect.w.toFixed(0) + " h=" + rect.h.toFixed(0) : "no element created");
    msg = await process();
    if (captured) {
      const bytes = new Uint8Array(await captured.arrayBuffer());
      const img = await tryRender(bytes, 1, "white-out");
      if (img) {
        const black = ink(img, isBlack);
        out.notes.afterWhiteOut = black;
        add("the covered text is hidden in the rendered output", black.left === null || black.left > 240,
          "remaining dark ink box=" + JSON.stringify(black));
      }
      const text = await tryText(bytes, "white-out honesty");
      if (text !== null) {
        add("...but the original text is still inside the file (so it is not redaction)",
          text.indexOf("ORIGINAL 1") >= 0, JSON.stringify(text.slice(0, 40)));
      }
    }

    // ---- G: a character the standard fonts cannot write ----
    progress("G: a character the fonts cannot write");
    await dropFile(await makeFile({ pages: 1, size: [400, 400] }));
    arm("text");
    stageClick(0.3, 0.3);
    setProp("text", "ආයුබෝවන්");
    const warn = $("ed-warn");
    add("typing a non-Latin character warns in the panel first",
      warn.className.indexOf("on") >= 0, warn.textContent.slice(0, 70));
    msg = await process();
    add("Process refuses rather than writing a broken file",
      msg && msg.className.indexOf("err") >= 0 && !captured, msg ? msg.textContent.slice(0, 90) : "no message");

    // ---- H: empty state ----
    progress("H: nothing placed");
    await dropFile(await makeFile({ pages: 1, size: [400, 400] }));
    msg = await process();
    add("Process with nothing placed says so instead of writing a file",
      msg && msg.className.indexOf("err") >= 0 && !captured, msg ? msg.textContent.slice(0, 90) : "no message");

    // ---- J: two renders must never share one canvas ----
    //
    // Clicking the page arrows twice quickly used to start a second pdf.js render
    // on #ed-canvas while the first was still running, which pdf.js rejects with
    // "Cannot use the same canvas during multiple render() operations".
    progress("J: rapid page switching");
    await dropFile(await makeFile({ pages: 3, size: [400, 400] }));
    const warnBefore = ($("ed-warn") || {}).textContent || "";
    for (let i = 0; i < 4; i++) {
      document.querySelector('[data-pg="1"]').click();
      document.querySelector('[data-pg="-1"]').click();
    }
    await sleep(1500);
    add("rapid page switching raises no render error",
      (($("ed-warn") || {}).textContent || "") === warnBefore,
      JSON.stringify(($("ed-warn") || {}).textContent || ""));
    add("the page is still drawn after rapid switching",
      !!$("ed-canvas") && $("ed-canvas").width > 100 && S().vp !== null,
      $("ed-canvas") ? $("ed-canvas").width + "x" + $("ed-canvas").height : "no canvas");

    // ---- I: narrow layout, measured in same-origin iframes ----
    progress("I: narrow layouts");
    async function narrow(width, path) {
      const f = document.createElement("iframe");
      f.style.cssText = "width:" + width + "px;height:900px;border:0;position:fixed;left:-9999px;top:0";
      f.src = path;
      document.body.appendChild(f);
      await withTimeout(
        new Promise((res) => f.addEventListener("load", res, { once: true })),
        20000, "iframe load of " + path);
      await sleep(500);
      const d = f.contentDocument, w = f.contentWindow;
      const res = {
        innerWidth: w.innerWidth,
        scrollWidth: d.documentElement.scrollWidth,
        clientWidth: d.documentElement.clientWidth,
        headerHeight: Math.round(d.querySelector("header.site").getBoundingClientRect().height),
        visibleNavLinks: d.querySelectorAll("nav.site a:not(.opt)").length
      };
      f.remove();
      return res;
    }
    out.notes.narrow = {};
    for (const w of [375, 390]) {
      out.notes.narrow["edit-pdf@" + w] = await narrow(w, "/edit-pdf/");
      out.notes.narrow["home@" + w] = await narrow(w, "/");
    }
    Object.keys(out.notes.narrow).forEach((k) => {
      const n = out.notes.narrow[k];
      add("no horizontal overflow at " + k.split("@")[1] + "px on " + k.split("@")[0],
        n.scrollWidth <= n.clientWidth + 1,
        "scrollWidth=" + n.scrollWidth + " clientWidth=" + n.clientWidth);
      add("header stays a single row at " + k.split("@")[1] + "px on " + k.split("@")[0],
        n.headerHeight <= 72, "header " + n.headerHeight + "px, " + n.visibleNavLinks + " nav links");
    });
  } catch (err) {
    add("the run finished without throwing", false, (err && err.message) || String(err));
    out.fatal = (err && err.stack) || String(err);
  }

  // Publish into the DOM as well as returning: a debugger evaluate can run in an
  // isolated world, where the returned object never reaches the caller, but the
  // DOM is shared and a screenshot shows this too. Guarded by `published` so the
  // watchdog below can publish a partial result without being overwritten.
  function publish(why) {
    if (published) return;
    published = true;
    out.complete = why === "complete";
    out.publishedBecause = why;
    out.failed = out.checks.filter((c) => !c.ok).length;
    out.passed = out.checks.length - out.failed;
    try {
      window.__e2eResult = out;
      const pre = document.createElement("pre");
      pre.id = "__e2e_out";
      pre.style.cssText = "white-space:pre-wrap;word-break:break-word;font:12px ui-monospace," +
        "SFMono-Regular,Menlo,Consolas,monospace;background:#111;color:#eee;padding:14px;" +
        "border-radius:8px;margin:16px 0";
      pre.textContent = "E2E RESULT: " + out.passed + " passed / " + out.failed + " failed (" + why + ")\n" +
        JSON.stringify(out, null, 2);
      document.body.appendChild(pre);
      document.title = "E2E " + out.passed + "/" + out.failed;
    } catch (e) { /* reporting must never be the thing that fails */ }
  }

  // Hard stop. Every await in here is bounded, but if one is not, this makes the
  // run produce a readable partial result rather than nothing at all.
  setTimeout(() => publish("watchdog"), WATCHDOG_MS);
  publish("complete");
  return out;
})();
