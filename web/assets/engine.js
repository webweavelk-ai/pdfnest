/* PDF Studio engine — every conversion, pure and dependency-injected.
 *
 * No DOM assumptions except inside the two canvas-based functions
 * (pdfToImages and the rasteriser used by compressPdf), which need a real
 * browser. Everything else runs anywhere pdf-lib can, which is why
 * tools/test_engine.js can exercise it in Node.
 *
 * Globals expected from the vendor scripts: PDFLib, pdfjsLib, JSZip.
 */
(function (root) {
  "use strict";

  var cfg = { base: "", workerVersion: "" };

  function configure(opts) {
    cfg.base = (opts && opts.base) || "";
    // Cache-busting hash for the pdf.js worker. _headers serves /assets/* as
    // immutable for a year, so the worker URL has to change when the file does.
    cfg.workerVersion = (opts && opts.workerVersion) || "";
    pdfjsReady = false;
  }

  function vendor(file) {
    return cfg.base + "assets/vendor/" + file;
  }

  var pdfjsReady = false;
  function initPdfjs() {
    if (pdfjsReady) return;
    if (!root.pdfjsLib) throw new Error("pdf.js is not loaded (assets/vendor/pdf.min.js)");
    var worker = vendor("pdf.worker.min.js");
    if (cfg.workerVersion) worker += "?v=" + cfg.workerVersion;
    root.pdfjsLib.GlobalWorkerOptions.workerSrc = worker;
    pdfjsReady = true;
  }

  // ---------------------------------------------------------------- helpers

  function copyOf(bytes) {
    // pdf.js takes ownership of the buffer it is handed, so always pass a copy.
    return new Uint8Array(bytes);
  }

  function stemOf(name) {
    return String(name || "document").replace(/\.[^.]+$/, "") || "document";
  }

  function pad(n, width) {
    var s = String(n);
    while (s.length < width) s = "0" + s;
    return s;
  }

  async function loadPdf(bytes) {
    return root.PDFLib.PDFDocument.load(copyOf(bytes), {
      ignoreEncryption: true,
      updateMetadata: false
    });
  }

  /** "1-3,5,8-10" -> [0,1,2,4,7,8,9] (0-based), clamped to the page count. */
  function parseRanges(spec, total) {
    var out = [];
    String(spec == null ? "" : spec).split(/[,\s]+/).forEach(function (chunk) {
      if (!chunk) return;
      if (chunk.indexOf("-") > -1) {
        var parts = chunk.split("-");
        var a = parts[0].trim();
        var b = (parts[1] || "").trim();
        var start = a === "" ? 1 : parseInt(a, 10);
        var end = b === "" ? total : parseInt(b, 10);
        if (isNaN(start) || isNaN(end)) throw new Error("Bad page range: " + chunk);
        start = Math.max(1, Math.min(start, total));
        end = Math.max(1, Math.min(end, total));
        var step = end >= start ? 1 : -1;
        for (var p = start; step > 0 ? p <= end : p >= end; p += step) out.push(p - 1);
      } else {
        var n = parseInt(chunk, 10);
        if (isNaN(n)) throw new Error("Bad page number: " + chunk);
        out.push(Math.max(1, Math.min(n, total)) - 1);
      }
    });
    if (!out.length) throw new Error("No valid pages selected.");
    return out;
  }

  function allPages(total) {
    var out = [];
    for (var i = 0; i < total; i++) out.push(i);
    return out;
  }

  // ------------------------------------------------------------- operations

  /** Page count without doing any work on the content. */
  async function pageCount(bytes) {
    var doc = await loadPdf(bytes);
    return doc.getPageCount();
  }

  /** Merge PDFs in order. Returns Uint8Array. */
  async function mergePdfs(files, onProgress) {
    var out = await root.PDFLib.PDFDocument.create();
    for (var i = 0; i < files.length; i++) {
      var src = await loadPdf(await files[i].arrayBuffer());
      var copied = await out.copyPages(src, src.getPageIndices());
      copied.forEach(function (p) { out.addPage(p); });
      if (onProgress) onProgress(i + 1, files.length);
    }
    return out.save({ useObjectStreams: true });
  }

  /** One PDF per selected page, packaged as a ZIP. Returns Uint8Array. */
  async function splitPdf(file, indices, onProgress) {
    var src = await loadPdf(await file.arrayBuffer());
    var zip = new root.JSZip();
    var stem = stemOf(file.name);
    for (var i = 0; i < indices.length; i++) {
      var doc = await root.PDFLib.PDFDocument.create();
      var copied = await doc.copyPages(src, [indices[i]]);
      doc.addPage(copied[0]);
      zip.file(stem + "_p" + pad(indices[i] + 1, 3) + ".pdf", await doc.save({ useObjectStreams: true }));
      if (onProgress) onProgress(i + 1, indices.length);
    }
    return zip.generateAsync({ type: "uint8array", compression: "DEFLATE" });
  }

  /** Rotate all or selected pages. Returns Uint8Array. */
  async function rotatePdf(file, angle, indices) {
    var doc = await loadPdf(await file.arrayBuffer());
    var pages = doc.getPages();
    (indices || allPages(pages.length)).forEach(function (i) {
      var page = pages[i];
      if (!page) return;
      var next = ((page.getRotation().angle + angle) % 360 + 360) % 360;
      page.setRotation(root.PDFLib.degrees(next));
    });
    return doc.save({ useObjectStreams: true });
  }

  /** Each page as PNG/JPG, packaged as a ZIP. Returns Uint8Array. */
  async function pdfToImages(file, fmt, dpi, onProgress) {
    initPdfjs();
    var pdf = await root.pdfjsLib.getDocument({ data: copyOf(await file.arrayBuffer()) }).promise;
    var scale = dpi / 72;
    var mime = fmt === "jpg" ? "image/jpeg" : "image/png";
    var zip = new root.JSZip();
    var stem = stemOf(file.name);

    for (var i = 1; i <= pdf.numPages; i++) {
      var page = await pdf.getPage(i);
      var viewport = page.getViewport({ scale: scale });
      var canvas = document.createElement("canvas");
      canvas.width = Math.max(1, Math.ceil(viewport.width));
      canvas.height = Math.max(1, Math.ceil(viewport.height));
      var ctx = canvas.getContext("2d");
      ctx.fillStyle = "#ffffff"; // JPEG has no alpha channel
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      await page.render({ canvasContext: ctx, viewport: viewport }).promise;

      var blob = await new Promise(function (res) { canvas.toBlob(res, mime, 0.92); });
      zip.file(stem + "_page" + pad(i, 3) + "." + fmt, blob);
      canvas.width = canvas.height = 0; // release the backing store
      if (onProgress) onProgress(i, pdf.numPages);
    }
    return zip.generateAsync({ type: "uint8array", compression: "DEFLATE" });
  }

  /** Images (any browser-decodable format) into one PDF. Returns Uint8Array. */
  async function imagesToPdf(files, onProgress) {
    var out = await root.PDFLib.PDFDocument.create();
    for (var i = 0; i < files.length; i++) {
      var f = files[i];
      var bytes = new Uint8Array(await f.arrayBuffer());
      var name = String(f.name || "").toLowerCase();
      var img;

      if (name.endsWith(".png")) {
        img = await out.embedPng(bytes);
      } else if (name.endsWith(".jpg") || name.endsWith(".jpeg")) {
        img = await out.embedJpg(bytes);
      } else {
        var bitmap;
        try {
          bitmap = await root.createImageBitmap(new root.Blob([bytes]));
        } catch (e) {
          throw new Error(f.name + ": this format cannot be read in your browser. Use JPG or PNG.");
        }
        var c = document.createElement("canvas");
        c.width = bitmap.width;
        c.height = bitmap.height;
        var cx = c.getContext("2d");
        cx.fillStyle = "#ffffff";
        cx.fillRect(0, 0, c.width, c.height);
        cx.drawImage(bitmap, 0, 0);
        var jpeg = await new Promise(function (res) { c.toBlob(res, "image/jpeg", 0.92); });
        img = await out.embedJpg(new Uint8Array(await jpeg.arrayBuffer()));
        if (bitmap.close) bitmap.close();
        c.width = c.height = 0;
      }

      var page = out.addPage([img.width, img.height]);
      page.drawImage(img, { x: 0, y: 0, width: img.width, height: img.height });
      if (onProgress) onProgress(i + 1, files.length);
    }
    return out.save({ useObjectStreams: true });
  }

  /** Rebuild every page as a JPEG — the real size win. Returns Uint8Array. */
  async function rasterise(bytes, dpi, quality, onProgress) {
    initPdfjs();
    var src = await root.pdfjsLib.getDocument({ data: copyOf(bytes) }).promise;
    var out = await root.PDFLib.PDFDocument.create();
    var scale = dpi / 72;

    for (var i = 1; i <= src.numPages; i++) {
      var page = await src.getPage(i);
      var box = page.getViewport({ scale: 1 });     // page size in PDF points
      var render = page.getViewport({ scale: scale });
      var canvas = document.createElement("canvas");
      canvas.width = Math.max(1, Math.ceil(render.width));
      canvas.height = Math.max(1, Math.ceil(render.height));
      var ctx = canvas.getContext("2d");
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      await page.render({ canvasContext: ctx, viewport: render }).promise;

      var blob = await new Promise(function (res) { canvas.toBlob(res, "image/jpeg", quality); });
      var jpg = await out.embedJpg(new Uint8Array(await blob.arrayBuffer()));
      var target = out.addPage([box.width, box.height]);
      target.drawImage(jpg, { x: 0, y: 0, width: box.width, height: box.height });
      canvas.width = canvas.height = 0;
      if (onProgress) onProgress(i, src.numPages);
    }
    return out.save({ useObjectStreams: true });
  }

  /**
   * Compression that never lies about the result.
   *   light       structural re-save only — text stays selectable
   *   recommended structural first, rasterise only if that barely helped
   *   strong      always rasterise at low dpi/quality — smallest file
   * If nothing beats the original, the original is returned with reduced:false.
   */
  async function compressPdf(file, level, onProgress) {
    var original = new Uint8Array(await file.arrayBuffer());
    var light = await (await loadPdf(original)).save({ useObjectStreams: true });
    var best = light;

    if (level !== "light" && (level === "strong" || best.length >= original.length * 0.95)) {
      var raster = await rasterise(original, level === "strong" ? 110 : 150, level === "strong" ? 0.68 : 0.82, onProgress);
      if (raster.length < best.length) best = raster;
    }

    if (best.length >= original.length) {
      return { bytes: original, reduced: false, before: original.length, after: original.length };
    }
    return { bytes: best, reduced: true, before: original.length, after: best.length };
  }

  // ------------------------------------------------------------ annotations

  /**
   * How far a capital letter sits above the text baseline, as a fraction of the
   * font size. Used to convert between "distance from the top of the page" (what
   * the preview needs) and a baseline (what pdf-lib draws to). Exact metrics
   * would need the font program; 0.72 is close for the standard Latin faces and
   * keeps the preview and the output aligned to well under a millimetre.
   */
  var ASCENT = 0.72;

  function hexToRgb(hex, fallback) {
    var m = /^#?([0-9a-f]{6})$/i.exec(String(hex || "").trim());
    if (!m) return fallback || { red: 0, green: 0, blue: 0, toHex: null };
    var n = parseInt(m[1], 16);
    var out = { red: ((n >> 16) & 255) / 255, green: ((n >> 8) & 255) / 255, blue: (n & 255) / 255 };
    out.toHex = m[1];
    return out;
  }

  /**
   * pdf-lib's standard fonts are Latin-only (WinAnsi). Failing on a character
   * that cannot be encoded would otherwise surface as an obscure error partway
   * through writing the document, so it is checked up front and explained.
   */
  function assertEncodable(text, fontName) {
    for (var i = 0; i < text.length; i++) {
      if (text.charCodeAt(i) > 255) {
        throw new Error(
          'The font "' + fontName + '" cannot display "' + text.charAt(i) + '". ' +
          "The standard PDF fonts cover Latin characters only \u2014 Sinhala, Tamil, " +
          "Chinese, Arabic and emoji would need an embedded font file, which is not " +
          "supported yet. Use Latin text for now."
        );
      }
    }
  }

  /**
   * Add a layer of new content on top of an existing PDF: text boxes, image
   * stamps, filled boxes, a watermark and page numbers.
   *
   * This never rewrites the existing page content, which is why it is reliable —
   * there is no need to understand the original text, fonts or layout. It also
   * means a "white-out" box only hides what is underneath visually: the original
   * text is still in the file and still extractable.
   *
   * Coordinates: x is measured from the left edge, y from the TOP edge, both in
   * PDF points, because that is what the preview positions elements with. The one
   * conversion to PDF's bottom-left origin happens in fromTop() below.
   */
  async function annotatePdf(file, spec) {
    var P = root.PDFLib;
    spec = spec || {};
    var doc = await loadPdf(await file.arrayBuffer());
    var pages = doc.getPages();
    var fonts = {};
    var images = {};

    async function fontFor(name) {
      var F = P.StandardFonts;
      var map = {
        "Helvetica": F.Helvetica, "Helvetica-Bold": F.HelveticaBold,
        "Helvetica-Oblique": F.HelveticaOblique, "Helvetica-BoldOblique": F.HelveticaBoldOblique,
        "Times-Roman": F.TimesRoman, "Times-Bold": F.TimesRomanBold,
        "Times-Italic": F.TimesRomanItalic, "Times-BoldItalic": F.TimesRomanBoldItalic,
        "Courier": F.Courier, "Courier-Bold": F.CourierBold
      };
      if (!map[name]) throw new Error('Unknown font "' + name + '".');
      if (!fonts[name]) fonts[name] = await doc.embedFont(map[name]);
      return fonts[name];
    }

    async function imageFor(item) {
      if (images[item.key]) return images[item.key];
      var data = new Uint8Array(item.bytes);
      var mime = String(item.mime || "").toLowerCase();
      var img;
      if (mime === "image/png") img = await doc.embedPng(data);
      else if (mime === "image/jpeg" || mime === "image/jpg") img = await doc.embedJpg(data);
      else throw new Error("Stamps have to be PNG or JPG images.");
      images[item.key] = img;
      return img;
    }

    function fromTop(page, y) {
      return page.getHeight() - y;
    }

    function pageAt(n) {
      if (!Number.isInteger(n) || n < 0 || n >= pages.length) {
        throw new Error("Annotation targets page " + (n + 1) + ", which does not exist.");
      }
      return pages[n];
    }

    // --- items the user placed by hand -------------------------------------
    for (var i = 0; i < (spec.items || []).length; i++) {
      var it = spec.items[i];
      var page = pageAt(it.page);

      if (it.kind === "text") {
        var fname = it.font || "Helvetica";
        var size = Number(it.size) || 12;
        assertEncodable(it.text || "", fname);
        var f = await fontFor(fname);
        var opts = {
          x: it.x,
          y: fromTop(page, it.y + ASCENT * size),
          size: size,
          font: f,
          color: P.rgb(hexToRgb(it.color).red, hexToRgb(it.color).green, hexToRgb(it.color).blue)
        };
        if (it.opacity !== undefined && it.opacity < 1) opts.opacity = it.opacity;
        (String(it.text || "").split("\n")).forEach(function (line, k) {
          page.drawText(line, Object.assign({}, opts, { y: opts.y - k * size * 1.25 }));
        });

      } else if (it.kind === "image") {
        var img = await imageFor(it);
        var iopts = {
          x: it.x, y: fromTop(page, it.y + it.h), width: it.w, height: it.h
        };
        if (it.opacity !== undefined && it.opacity < 1) iopts.opacity = it.opacity;
        page.drawImage(img, iopts);

      } else if (it.kind === "rect") {
        var c = hexToRgb(it.color, hexToRgb("#ffffff"));
        var ropts = {
          x: it.x, y: fromTop(page, it.y + it.h),
          width: it.w, height: it.h,
          color: P.rgb(c.red, c.green, c.blue)
        };
        if (it.opacity !== undefined && it.opacity < 1) ropts.opacity = it.opacity;
        page.drawRectangle(ropts);

      } else {
        throw new Error('Unknown annotation type "' + it.kind + '".');
      }
    }

    // --- watermark, drawn on every page -----------------------------------
    if (spec.watermark && spec.watermark.text) {
      var wm = spec.watermark;
      assertEncodable(wm.text, wm.font || "Helvetica-Bold");
      var wfont = await fontFor(wm.font || "Helvetica-Bold");
      var wsize = Number(wm.size) || 48;
      var wcolor = hexToRgb(wm.color || "#ff0000");
      var wrot = Number(wm.rotate === undefined ? -30 : wm.rotate);
      for (var p = 0; p < pages.length; p++) {
        var pg = pages[p];
        var tw = wfont.widthOfTextAtSize(wm.text, wsize);
        var cx = pg.getWidth() / 2;
        var cy = pg.getHeight() / 2;
        var rad = (wrot * Math.PI) / 180;
        // Shift the anchor so the rotated text still lands centred on the page.
        var ax = cx - (tw / 2) * Math.cos(rad) + (wsize * 0.35) * Math.sin(rad);
        var ay = cy - (tw / 2) * Math.sin(rad) - (wsize * 0.35) * Math.cos(rad);
        pg.drawText(wm.text, {
          x: ax, y: ay, size: wsize, font: wfont,
          color: P.rgb(wcolor.red, wcolor.green, wcolor.blue),
          rotate: P.degrees(wrot),
          opacity: wm.opacity === undefined ? 0.25 : wm.opacity
        });
      }
    }

    // --- page numbers -----------------------------------------------------
    if (spec.pageNumbers) {
      var pn = spec.pageNumbers;
      var pfont = await fontFor(pn.font || "Helvetica");
      var psize = Number(pn.size) || 10;
      var pcolor = hexToRgb(pn.color || "#444444");
      var margin = Number(pn.margin === undefined ? 28 : pn.margin);
      var start = Number(pn.start) || 1;
      for (var q = 0; q < pages.length; q++) {
        var page2 = pages[q];
        var label;
        var n = q + start;
        if (pn.format === "n") label = String(n);
        else if (pn.format === "page-n-of-total") label = "Page " + n + " of " + (pages.length + start - 1);
        else label = n + " / " + (pages.length + start - 1);
        var tw2 = pfont.widthOfTextAtSize(label, psize);
        var x2;
        if (pn.position === "bottom-left") x2 = margin;
        else if (pn.position === "bottom-right") x2 = page2.getWidth() - margin - tw2;
        else x2 = (page2.getWidth() - tw2) / 2;
        page2.drawText(label, {
          x: x2, y: margin, size: psize, font: pfont,
          color: P.rgb(pcolor.red, pcolor.green, pcolor.blue)
        });
      }
    }

    return doc.save({ useObjectStreams: true });
  }

  // ------------------------------------------------------- page organiser

  /**
   * Open a PDF with pdf.js and keep the document open, so thumbnails can be
   * rendered page by page without re-parsing the file each time.
   * Canvas-based: needs a browser.
   */
  async function openForRendering(file) {
    initPdfjs();
    return root.pdfjsLib.getDocument({ data: copyOf(await file.arrayBuffer()) }).promise;
  }

  /** Render one page of an already-open pdf.js document to a canvas. */
  async function renderPage(doc, pageNumber, scale) {
    var page = await doc.getPage(pageNumber);
    var viewport = page.getViewport({ scale: scale });
    var canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.ceil(viewport.width));
    canvas.height = Math.max(1, Math.ceil(viewport.height));
    var ctx = canvas.getContext("2d");
    ctx.fillStyle = "#ffffff"; // pages are paper, and this keeps PNG output opaque
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    await page.render({ canvasContext: ctx, viewport: viewport }).promise;
    return canvas;
  }

  /**
   * Build a new PDF from an explicit page plan.
   *
   * `plan` is the output order: [{ index: 0, rotate: 0 }, { index: 2, rotate: 90 }].
   * `index` is the 0-based page number in the source document, and the same index
   * may appear more than once (that is how duplication works). `rotate` is an
   * extra rotation applied on top of whatever the page already had.
   *
   * Nothing about the page content is rewritten, so this is lossless — text stays
   * selectable and images keep their resolution.
   */
  async function organizePdf(file, plan) {
    if (!plan || !plan.length) throw new Error("No pages left — at least one page is required.");
    var src = await loadPdf(await file.arrayBuffer());
    var total = src.getPageCount();

    var indices = plan.map(function (entry) {
      var i = entry.index;
      if (!Number.isInteger(i) || i < 0 || i >= total) {
        throw new Error("Page " + (i + 1) + " does not exist in this document.");
      }
      return i;
    });

    var out = await root.PDFLib.PDFDocument.create();
    var copied = await out.copyPages(src, indices);
    copied.forEach(function (page, i) {
      var extra = plan[i].rotate || 0;
      if (extra) {
        var next = ((page.getRotation().angle + extra) % 360 + 360) % 360;
        page.setRotation(root.PDFLib.degrees(next));
      }
      out.addPage(page);
    });
    return out.save({ useObjectStreams: true });
  }

  root.PDFStudioEngine = {
    configure: configure,
    annotatePdf: annotatePdf,
    ASCENT: ASCENT,
    organizePdf: organizePdf,
    openForRendering: openForRendering,
    renderPage: renderPage,
    vendor: vendor,
    stemOf: stemOf,
    pad: pad,
    copyOf: copyOf,
    parseRanges: parseRanges,
    allPages: allPages,
    pageCount: pageCount,
    mergePdfs: mergePdfs,
    splitPdf: splitPdf,
    rotatePdf: rotatePdf,
    pdfToImages: pdfToImages,
    imagesToPdf: imagesToPdf,
    compressPdf: compressPdf,
    rasterise: rasterise
  };
})(typeof window !== "undefined" ? window : globalThis);
