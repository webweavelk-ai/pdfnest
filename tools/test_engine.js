/* Runs the client-side engine in Node.
 *
 *     python tools/make_fixtures.py     # once, to create the samples
 *     node tools/test_engine.js
 *
 * Covers every engine path that does not need a canvas: parseRanges, merge,
 * split, rotate, light compression, images-to-PDF and page counting.
 * The two canvas-based paths (pdf-to-images, strong compression) are covered
 * by web/tests.html in a real browser.
 */

const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..");
const VENDOR = path.join(ROOT, "web", "assets", "vendor");
const FIX = path.join(__dirname, "fixtures");

globalThis.PDFLib = require(path.join(VENDOR, "pdf-lib.min.js"));
globalThis.JSZip = require(path.join(VENDOR, "jszip.min.js"));
require(path.join(ROOT, "web", "assets", "engine.js"));

const E = globalThis.PDFStudioEngine;
const { PDFDocument } = globalThis.PDFLib;

let failures = 0;

function check(label, ok, detail) {
  if (ok) {
    console.log("  PASS  " + label);
  } else {
    failures++;
    console.log("  FAIL  " + label + (detail ? "  -> " + detail : ""));
  }
}

function fileLike(relPath) {
  const name = path.basename(relPath);
  return {
    name,
    size: fs.statSync(relPath).size,
    async arrayBuffer() {
      const buf = fs.readFileSync(relPath);
      return buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);
    }
  };
}

async function pageCountOf(bytes) {
  const doc = await PDFDocument.load(new Uint8Array(bytes), { ignoreEncryption: true });
  return doc.getPageCount();
}

async function zipNames(bytes) {
  const zip = await globalThis.JSZip.loadAsync(Buffer.from(bytes));
  return Object.keys(zip.files).sort();
}

(async function main() {
  const a = fileLike(path.join(FIX, "a.pdf"));
  const b = fileLike(path.join(FIX, "b.pdf"));
  const png = fileLike(path.join(FIX, "img.png"));
  const jpg = fileLike(path.join(FIX, "img.jpg"));

  console.log("\nparseRanges");
  check("1-3,5,8-10 -> 7 pages", JSON.stringify(E.parseRanges("1-3,5,8-10", 12)) === "[0,1,2,4,7,8,9]",
    JSON.stringify(E.parseRanges("1-3,5,8-10", 12)));
  check("reverse range 9-6", JSON.stringify(E.parseRanges("9-6", 12)) === "[8,7,6,5]",
    JSON.stringify(E.parseRanges("9-6", 12)));
  check("clamps past the end", JSON.stringify(E.parseRanges("99", 3)) === "[2]");
  check("open range 2- means to the end", JSON.stringify(E.parseRanges("2-", 4)) === "[1,2,3]");
  let threw = false;
  try { E.parseRanges("abc", 5); } catch (e) { threw = true; }
  check("rejects garbage", threw);

  console.log("\nmerge");
  const merged = await E.mergePdfs([a, b]);
  check("merged is a PDF", Buffer.from(merged.slice(0, 5)).toString() === "%PDF-");
  check("merged has 3 pages", (await pageCountOf(merged)) === 3, String(await pageCountOf(merged)));

  console.log("\nsplit");
  const splitAll = await E.splitPdf(b, E.allPages(2));
  const names = await zipNames(splitAll);
  check("split produced 2 entries", names.length === 2, JSON.stringify(names));
  check("entries named per page", names.join(",") === "b_p001.pdf,b_p002.pdf", JSON.stringify(names));

  const zip = await globalThis.JSZip.loadAsync(Buffer.from(splitAll));
  const firstPage = await zip.files["b_p001.pdf"].async("uint8array");
  check("split page is a valid single-page PDF",
    (await pageCountOf(firstPage)) === 1, "pages=" + (await pageCountOf(firstPage)));
  check("split page keeps the PDF magic", Buffer.from(firstPage.slice(0, 5)).toString() === "%PDF-");

  console.log("\nrotate");
  const rotatedAll = await E.rotatePdf(b, 90, null);
  const rotDoc = await PDFDocument.load(new Uint8Array(rotatedAll));
  check("all pages rotated to 90", rotDoc.getPages().every((p) => p.getRotation().angle === 90),
    rotDoc.getPages().map((p) => p.getRotation().angle).join(","));

  const rotatedOne = await E.rotatePdf(b, 90, [1]);
  const rotOne = await PDFDocument.load(new Uint8Array(rotatedOne));
  const angles = rotOne.getPages().map((p) => p.getRotation().angle);
  check("only page 2 rotated", angles[0] === 0 && angles[1] === 90, angles.join(","));

  const rotatedTwice = await E.rotatePdf(b, 270, [1]);
  const rotTwice = await PDFDocument.load(new Uint8Array(rotatedTwice));
  check("270 cancels a 90 rotation", rotTwice.getPages()[1].getRotation().angle === 270);

  console.log("\nimages-to-pdf");
  const fromImages = await E.imagesToPdf([png, jpg]);
  check("images.pdf is a PDF", Buffer.from(fromImages.slice(0, 5)).toString() === "%PDF-");
  check("one page per image (2)", (await pageCountOf(fromImages)) === 2, String(await pageCountOf(fromImages)));

  console.log("\ncompress (light)");
  const comp = await E.compressPdf(a, "light");
  check("returns the documented shape",
    comp && comp.bytes && typeof comp.reduced === "boolean" && typeof comp.before === "number" && typeof comp.after === "number",
    JSON.stringify(Object.keys(comp || {})));
  check("bytes are a PDF", Buffer.from(comp.bytes.slice(0, 5)).toString() === "%PDF-");
  check("never larger than the original", comp.bytes.length <= comp.before,
    comp.bytes.length + " vs " + comp.before);
  check("reports reduced=false when it cannot win", comp.reduced === (comp.bytes.length < comp.before),
    "reduced=" + comp.reduced);

  /* ------------------------------------------------------------ organize
   *
   * order.pdf has three pages of different sizes (400, 500, 600 square), so the
   * page ORDER is verifiable by reading the page boxes back. A PDF carries no
   * page numbers, so without differently sized pages an order bug would be
   * invisible to a test.
   */
  console.log("\norganize-pdf");
  const order = fileLike(path.join(FIX, "order.pdf"));

  async function widthsOf(bytes) {
    const doc = await PDFDocument.load(new Uint8Array(bytes), { ignoreEncryption: true });
    return doc.getPages().map((p) => Math.round(p.getWidth()));
  }

  const reversed = await E.organizePdf(order, [
    { index: 2, rotate: 0 }, { index: 0, rotate: 0 }, { index: 1, rotate: 0 }
  ]);
  check("reorders pages", JSON.stringify(await widthsOf(reversed)) === JSON.stringify([600, 400, 500]),
    JSON.stringify(await widthsOf(reversed)));

  const dropped = await E.organizePdf(order, [{ index: 0, rotate: 0 }, { index: 2, rotate: 0 }]);
  check("deletes a page (3 -> 2)", (await pageCountOf(dropped)) === 2, String(await pageCountOf(dropped)));
  check("keeps the surviving pages in order",
    JSON.stringify(await widthsOf(dropped)) === JSON.stringify([400, 600]),
    JSON.stringify(await widthsOf(dropped)));

  const duped = await E.organizePdf(order, [
    { index: 1, rotate: 0 }, { index: 1, rotate: 0 }, { index: 0, rotate: 0 }, { index: 2, rotate: 0 }
  ]);
  check("duplicates a page (3 -> 4)", (await pageCountOf(duped)) === 4, String(await pageCountOf(duped)));
  check("the duplicate sits where it was placed",
    JSON.stringify(await widthsOf(duped)) === JSON.stringify([500, 500, 400, 600]),
    JSON.stringify(await widthsOf(duped)));

  const turned = await E.organizePdf(order, [{ index: 0, rotate: 0 }, { index: 1, rotate: 90 }]);
  const turnedDoc = await PDFDocument.load(new Uint8Array(turned));
  check("applies rotation to the chosen entry only",
    JSON.stringify(turnedDoc.getPages().map((p) => p.getRotation().angle)) === JSON.stringify([0, 90]),
    JSON.stringify(turnedDoc.getPages().map((p) => p.getRotation().angle)));

  const stacked = await E.organizePdf(order, [
    { index: 0, rotate: 0 }, { index: 0, rotate: 90 }, { index: 0, rotate: 180 }, { index: 0, rotate: 270 }
  ]);
  const stackedDoc = await PDFDocument.load(new Uint8Array(stacked));
  check("the same page can appear at four rotations",
    JSON.stringify(stackedDoc.getPages().map((p) => p.getRotation().angle)) === JSON.stringify([0, 90, 180, 270]),
    JSON.stringify(stackedDoc.getPages().map((p) => p.getRotation().angle)));

  let emptyErr = "";
  try { await E.organizePdf(order, []); } catch (e) { emptyErr = e.message; }
  check("refuses an empty plan", /at least one page/i.test(emptyErr), emptyErr);

  let rangeErr = "";
  try { await E.organizePdf(order, [{ index: 7, rotate: 0 }]); } catch (e) { rangeErr = e.message; }
  check("refuses a page that does not exist", /does not exist/i.test(rangeErr), rangeErr);

  /* ------------------------------------------------------------ annotate
   *
   * pdf-lib can write content but cannot read text back, so these checks are
   * deliberately structural: page count, size growth, and the error paths. The
   * actual rendered result is verified independently by
   * tools/verify_annotated.py, which reads the same output with PyMuPDF — a
   * different library — so the check does not just confirm my own assumptions.
   */
  console.log("\nannotate-pdf");
  const report = fileLike(path.join(FIX, "report.pdf"));
  const pngBytes = fs.readFileSync(path.join(FIX, "img.png"));

  const beforePages = await pageCountOf(new Uint8Array(await report.arrayBuffer()));

  const annotated = await E.annotatePdf(report, {
    items: [
      { kind: "text", page: 0, x: 60, y: 140, size: 18, font: "Helvetica-Bold",
        color: "#1a3d7c", text: "APPROVED BY TEST" },
      { kind: "text", page: 1, x: 60, y: 400, size: 12, font: "Times-Roman",
        color: "#000000", text: "line one\nline two" },
      { kind: "image", page: 2, x: 300, y: 520, w: 120, h: 90,
        key: "sig", bytes: pngBytes, mime: "image/png" },
      { kind: "rect", page: 0, x: 220, y: 300, w: 180, h: 40, color: "#ffffff" }
    ],
    watermark: { text: "DRAFT", size: 60, color: "#ff0000", opacity: 0.2, rotate: -30 },
    pageNumbers: { position: "bottom-center", format: "n / total", size: 9, start: 1 }
  });
  fs.writeFileSync(path.join(FIX, "out-annotated.pdf"), annotated);

  check("adding annotations keeps the page count", (await pageCountOf(annotated)) === beforePages,
    beforePages + " -> " + (await pageCountOf(annotated)));
  check("the output is a real PDF", Buffer.from(annotated.slice(0, 5)).toString() === "%PDF-",
    Buffer.from(annotated.slice(0, 5)).toString());
  check("annotations add content to the file", annotated.length > report.size,
    report.size + " -> " + annotated.length + " bytes");

  const wmOnly = await E.annotatePdf(report, { watermark: { text: "CONFIDENTIAL" } });
  check("a watermark on its own is accepted", (await pageCountOf(wmOnly)) === beforePages,
    String(await pageCountOf(wmOnly)));

  const pnOnly = await E.annotatePdf(report, { pageNumbers: { position: "bottom-right" } });
  check("page numbers on their own are accepted", (await pageCountOf(pnOnly)) === beforePages,
    String(await pageCountOf(pnOnly)));

  let scriptErr = "";
  try {
    await E.annotatePdf(report, { items: [{ kind: "text", page: 0, x: 10, y: 10, text: "ආයුබෝවන්" }] });
  } catch (e) { scriptErr = e.message; }
  check("refuses characters the standard fonts cannot show", /cannot display/i.test(scriptErr),
    scriptErr.slice(0, 80));

  let pageErr = "";
  try {
    await E.annotatePdf(report, { items: [{ kind: "text", page: 9, x: 10, y: 10, text: "hi" }] });
  } catch (e) { pageErr = e.message; }
  check("refuses an annotation on a page that does not exist", /does not exist/i.test(pageErr),
    pageErr.slice(0, 60));

  let kindErr = "";
  try {
    await E.annotatePdf(report, { items: [{ kind: "circle", page: 0 }] });
  } catch (e) { kindErr = e.message; }
  check("refuses an unknown annotation type", /Unknown annotation type/i.test(kindErr),
    kindErr.slice(0, 60));

  console.log("\n" + "=".repeat(58));
  if (failures) {
    console.log(failures + " FAILED");
    process.exit(1);
  }
  console.log("All engine checks passed.");
})();
