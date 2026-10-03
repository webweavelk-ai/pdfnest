/* Run every tool on real files and print what actually came out.
 *
 *     python tools/make_fixtures.py     # once, to create the samples
 *     node tools/demo_run.js
 *
 * This is a demonstration, not a pass/fail suite (that is test_engine.js). It
 * reports measured inputs, outputs and timings so the numbers can be checked by
 * eye. The two canvas-based paths need a real browser canvas and are therefore
 * exercised by web/tests.html instead — this script says so rather than
 * pretending to cover them.
 */

const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..");
const FIX = path.join(__dirname, "fixtures");

globalThis.window = globalThis;
globalThis.PDFLib = require(path.join(ROOT, "web", "assets", "vendor", "pdf-lib.min.js"));
globalThis.JSZip = require(path.join(ROOT, "web", "assets", "vendor", "jszip.min.js"));
require(path.join(ROOT, "web", "assets", "engine.js"));
const E = globalThis.PDFStudioEngine;

const kb = (n) => (n / 1024).toFixed(n < 1024 * 100 ? 1 : 0) + " KB";
const mb = (n) => (n / 1048576).toFixed(2) + " MB";
const size = (n) => (n >= 1048576 ? mb(n) : kb(n));

function fileLike(name) {
    const buf = fs.readFileSync(path.join(FIX, name));
    return {
        name,
        size: buf.length,
        arrayBuffer: async () => buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength)
    };
}

const rows = [];
function row(tool, input, output, extra) {
    rows.push({ tool, input, output, extra });
}

async function timed(fn) {
    const t0 = performance.now();
    const value = await fn();
    return { value, ms: Math.round(performance.now() - t0) };
}

async function main() {
    console.log("PDF Nest — tool demonstration on real files");
    console.log("fixtures: " + FIX);
    console.log("engine:   web/assets/engine.js (the same file the live site uses)");
    console.log("");

    // 1 — merge two documents into one
    {
        const files = [fileLike("report.pdf"), fileLike("scan.pdf")];
        const inBytes = files.reduce((n, f) => n + f.size, 0);
        const { value, ms } = await timed(() => E.mergePdfs(files));
        const pages = await E.pageCount(value);
        row("1. Merge PDF", "report.pdf (3 pages) + scan.pdf (2 pages) = " + size(inBytes),
            "merged.pdf, " + pages + " pages, " + size(value.length), ms + " ms");
    }

    // 2 — split every page out
    {
        const f = fileLike("report.pdf");
        const n = await E.pageCount(new Uint8Array(await f.arrayBuffer()));
        const idx = E.allPages(n);
        const { value, ms } = await timed(() => E.splitPdf(f, idx));
        const zip = await globalThis.JSZip.loadAsync(value);
        row("2. Split — every page", "report.pdf, " + n + " pages",
            "zip, " + Object.keys(zip.files).length + " PDFs (" + Object.keys(zip.files).join(", ") + ")",
            ms + " ms");
    }

    // 3 — extract only some pages
    {
        const f = fileLike("report.pdf");
        const idx = E.parseRanges("1,3", 3);
        const { value, ms } = await timed(() => E.splitPdf(f, idx));
        const zip = await globalThis.JSZip.loadAsync(value);
        row("3. Split — pages 1,3", 'range typed as "1,3"',
            "zip, " + Object.keys(zip.files).length + " PDFs (" + Object.keys(zip.files).join(", ") + ")",
            ms + " ms");
    }

    // 4 — rotate every page
    {
        const f = fileLike("scan.pdf");
        const { value, ms } = await timed(() => E.rotatePdf(f, 90, null));
        const doc = await globalThis.PDFLib.PDFDocument.load(value);
        const angles = doc.getPages().map((p) => p.getRotation().angle);
        row("4. Rotate 90° — all pages", "scan.pdf (" + size(f.size) + ")",
            "rotated.pdf, page angles [" + angles.join(", ") + "]", ms + " ms");
    }

    // 5 — rotate one page only
    {
        const f = fileLike("report.pdf");
        const { value, ms } = await timed(() => E.rotatePdf(f, 180, [1]));
        const doc = await globalThis.PDFLib.PDFDocument.load(value);
        const angles = doc.getPages().map((p) => p.getRotation().angle);
        row("5. Rotate 180° — page 2 only", "report.pdf, 3 pages",
            "rotated.pdf, page angles [" + angles.join(", ") + "]", ms + " ms");
    }

    // 6 — lossless compression on an image-heavy scan
    {
        const f = fileLike("scan.pdf");
        const { value: r, ms } = await timed(() => E.compressPdf(f, "light"));
        row("6. Compress — light", "scan.pdf, " + size(f.size),
            size(r.bytes.length) + (r.reduced ? " (" + Math.round((1 - r.after / r.before) * 100) + "% smaller)" : " (already minimal, original returned)"),
            ms + " ms");
    }

    // 7 — images into a PDF
    {
        const files = [fileLike("img.png"), fileLike("img.jpg")];
        const { value, ms } = await timed(() => E.imagesToPdf(files));
        const pages = await E.pageCount(value);
        row("7. Images to PDF", "img.png (654 B) + img.jpg (4.1 KB)",
            "images.pdf, " + pages + " pages, " + size(value.length), ms + " ms");
    }

    const w = [24, 40, 62, 12];
    const line = "-".repeat(w.reduce((a, b) => a + b, 0) + 9);
    console.log("TOOL".padEnd(w[0]) + " INPUT".padEnd(w[1]) + " OUTPUT".padEnd(w[2]) + " TIME");
    console.log(line);
    for (const r of rows) {
        console.log(r.tool.padEnd(w[0]) + " " + r.input.padEnd(w[1]) + " " + r.output.padEnd(w[2]) + " " + r.extra);
    }
    console.log(line);
    console.log("");
    console.log("Everything above ran in this Node process, using the identical engine file");
    console.log("that the browser loads. Two further behaviours need a real browser canvas and");
    console.log("are covered by web/tests.html instead:");
    console.log("  - PDF to images (renders pages at a chosen dpi)");
    console.log("  - Compress 'recommended' / 'strong' (re-renders pages as JPEG)");
    console.log("");
    console.log("Not covered anywhere, and worth knowing: no tool here deletes pages.");
    console.log("To drop pages you split out the ones you want and merge them back.");
}

main().catch((e) => {
    console.error("DEMO FAILED:", e && e.message ? e.message : e);
    process.exit(1);
});
