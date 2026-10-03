/* Reads the watermark back out of a WRITTEN file and reports which way it leans.
 *
 *     node tools/verify_watermark_geometry.js
 *
 * WHY. The editor previews the watermark with a CSS rotation; the engine writes
 * the real one with a pdf-lib rotation; and the two have opposite sign
 * conventions (CSS rotates clockwise, PDF rotates anticlockwise about a y-up
 * axis). If the preview leans one way and the file leans the other, the preview
 * is lying — and measuring rendered ink cannot settle it here, because that
 * needs a canvas render loop, which is exactly what stalls in a browser that is
 * not in the foreground.
 *
 * So this reads the geometry instead. Each page's content streams are resolved
 * through pdf-lib (a `stream ... endstream` regex misses them: binary image data
 * contains those bytes too), inflated, and scanned for the text matrix pdf-lib
 * emitted. In PDF user space the baseline runs along (a, b); the screen flips y,
 * so a negative b means the text descends to the right on screen — which is a CSS
 * rotation of +30deg, and is what the preview applies.
 *
 * Two details that cost real time to find, recorded so they are not rediscovered:
 *   - pdf-lib writes text as a HEX string (<444952...>) not a literal, so a
 *     search for the plain text finds nothing;
 *   - the matrix is emitted with `Tm`, not the `Td` the PDF spec examples use.
 */

const fs = require("fs");
const path = require("path");
const zlib = require("zlib");

const ROOT = path.join(__dirname, "..");
const VENDOR = path.join(ROOT, "web", "assets", "vendor");
const FIX = path.join(__dirname, "fixtures");

globalThis.PDFLib = require(path.join(VENDOR, "pdf-lib.min.js"));
require(path.join(ROOT, "web", "assets", "engine.js"));

const E = globalThis.PDFStudioEngine;
const { PDFDocument, PDFName } = globalThis.PDFLib;

let failures = 0;
function check(label, ok, detail) {
  console.log((ok ? "  PASS  " : "  FAIL  ") + label + (detail ? "  -> " + detail : ""));
  if (!ok) failures++;
}

function fileLike(relPath) {
  return {
    name: path.basename(relPath),
    size: fs.statSync(relPath).size,
    async arrayBuffer() {
      const buf = fs.readFileSync(relPath);
      return buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);
    }
  };
}

/** Decoded content streams of a page, in the order the viewer applies them. */
function pageStreams(doc, pageIndex) {
  const resolved = doc.context.lookup(doc.getPage(pageIndex).node.Contents());
  const refs = resolved && resolved.array ? resolved.array : [resolved];
  const out = [];
  for (const ref of refs) {
    const stream = doc.context.lookup(ref);
    if (!stream) continue;
    const raw = stream.contents || stream.bytes;
    if (!raw) continue;
    const bytes = Buffer.from(raw);
    let text = bytes.toString("latin1");
    let filter = "none";
    for (const [name, fn] of [["FlateDecode", zlib.inflateSync], ["FlateDecode(raw)", zlib.inflateRawSync]]) {
      try { text = fn(bytes).toString("latin1"); filter = name; break; } catch (e) { /* not this filter */ }
    }
    out.push({ text, filter, raw: bytes.length });
  }
  return out;
}

/**
 * Every text run in a stream, with the matrix it was drawn under.
 * pdf-lib writes:  ... 0.866 -0.5 0.5 0.866 x y Tm <hex> Tj
 */
function textRuns(stream) {
  const re = new RegExp(
    "([-\\d.]+)\\s+([-\\d.]+)\\s+([-\\d.]+)\\s+([-\\d.]+)\\s+([-\\d.]+)\\s+([-\\d.]+)\\s+Tm\\s*" +
    "(?:\\(((?:\\\\.|[^)\\\\])*)\\)|<([0-9A-Fa-f\\s]*)>)\\s*Tj", "g");
  const runs = [];
  let m;
  while ((m = re.exec(stream))) {
    const hex = m[8];
    const text = hex === undefined
      ? m[7].replace(/\\([()\\])/g, "$1")
      : Buffer.from(hex.replace(/\s+/g, ""), "hex").toString("latin1");
    runs.push({ a: +m[1], b: +m[2], c: +m[3], d: +m[4], x: +m[5], y: +m[6], text });
  }
  return runs;
}

(async function main() {
  const src = fileLike(path.join(FIX, "report.pdf"));

  console.log("\nwatermark geometry, read back from the written file");

  // -30 is the editor's default, and the one the preview has to agree with.
  const bytes = await E.annotatePdf(src, {
    watermark: { text: "DIRECTION", size: 56, color: "#0000ff", opacity: 0.7, rotate: -30 }
  });
  const doc = await PDFDocument.load(bytes, { ignoreEncryption: true });

  check("the output still has the original page count", doc.getPageCount() === 3, doc.getPageCount());

  const streams = pageStreams(doc, 0);
  check("page 1 has readable content streams", streams.length > 0, streams.length + " stream(s)");

  let run = null;
  for (const s of streams) {
    const found = textRuns(s.text).find((t) => t.text.indexOf("DIRECTION") >= 0);
    if (found) { run = found; break; }
  }
  check("the watermark is drawn on page 1", !!run,
    run ? "matrix a=" + run.a + " b=" + run.b : "not found in any content stream");

  if (run) {
    console.log("  INFO  text drawn with matrix [" + [run.a, run.b, run.c, run.d, run.x, run.y].join(" ") + "]");
    // Screen y runs the other way to PDF y, so the on-screen baseline direction is
    // (a, -b). Negative b therefore means the right-hand end sits lower.
    const descendsToTheRight = run.b < 0;
    const cssEquivalent = Math.round((Math.atan2(-run.b, run.a) * 180) / Math.PI);
    console.log("  INFO  on screen it " + (descendsToTheRight ? "descends" : "ascends") +
      " to the right; equivalent CSS rotation " + cssEquivalent + "deg");
    console.log("  INFO  the preview applies rotate(" + 30 + "deg) for rotate:-30 (see edWmEl)");

    check("a rotate:-30 watermark descends to the right on screen", descendsToTheRight, "b=" + run.b);
    check("the CSS equivalent is +30deg, which is what the preview applies",
      cssEquivalent === 30, cssEquivalent + "deg");
  }

  // The same page must carry the same watermark: a per-page bug would be
  // invisible if only page 1 were inspected.
  let pagesWithWatermark = 0;
  for (let p = 0; p < doc.getPageCount(); p++) {
    const hit = pageStreams(doc, p).some((s) => textRuns(s.text).some((t) => t.text.indexOf("DIRECTION") >= 0));
    if (hit) pagesWithWatermark++;
  }
  check("every page carries it", pagesWithWatermark === doc.getPageCount(),
    pagesWithWatermark + " of " + doc.getPageCount());

  console.log("\n" + "=".repeat(58));
  if (failures) {
    console.log(failures + " FAILED");
    process.exit(1);
  }
  console.log("Watermark geometry verified against the written file.");
})();
