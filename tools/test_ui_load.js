/* Loads web/assets/app.js in Node with a minimal DOM stub and checks that it
 * gets all the way to defining its entry point.
 *
 *     node tools/test_ui_load.js
 *
 * WHY THIS EXISTS. app.js is one IIFE shared by all eight tool pages. A single
 * undefined identifier anywhere in it — a typo'd function name in the TOOLS
 * table, say — throws a ReferenceError while that table is being evaluated, so
 * the IIFE never reaches `window.PDFStudioInit = ...`. Every tool page then
 * loads, renders and silently does nothing: no drop handler, no Process button,
 * no error a visitor could see. That is a whole-site outage from one wrong
 * character, and it is invisible to `node --check` because the file is
 * perfectly valid JavaScript.
 *
 * This test does not try to run the tools. It only asks: does the file finish
 * loading, and does every page in web/ have a tool to wire itself to?
 */

const fs = require("fs");
const path = require("path");
const vm = require("vm");

const ROOT = path.join(__dirname, "..");
const WEB = path.join(ROOT, "web");

let failures = 0;
function check(label, ok, detail) {
  if (ok) {
    console.log("  PASS  " + label);
  } else {
    failures++;
    console.log("  FAIL  " + label + (detail ? "  -> " + detail : ""));
  }
}

// ------------------------------------------------------------------ DOM stub
//
// Deliberately inert: nothing here behaves like a browser. The point is to let
// the module finish its top-level pass without touching a real document.

const noop = () => {};
function stubEl() {
  return {
    style: {}, dataset: {}, hidden: false, textContent: "", innerHTML: "", value: "",
    classList: { add: noop, remove: noop, toggle: noop, contains: () => false },
    appendChild: noop, removeChild: noop, remove: noop, addEventListener: noop,
    setAttribute: noop, getAttribute: () => null, hasAttribute: () => false,
    querySelector: () => null, querySelectorAll: () => [], closest: () => null,
    getBoundingClientRect: () => ({ left: 0, top: 0, width: 0, height: 0 })
  };
}

const document_ = {
  readyState: "complete",
  body: stubEl(),
  documentElement: { setAttribute: noop, scrollWidth: 0, clientWidth: 0 },
  getElementById: () => null,
  querySelector: () => null,
  querySelectorAll: () => [],
  createElement: stubEl,
  addEventListener: noop
};

const window_ = {
  devicePixelRatio: 1,
  innerWidth: 1280,
  addEventListener: noop,
  removeEventListener: noop,
  matchMedia: () => ({ matches: false, addEventListener: noop }),
  localStorage: { getItem: () => null, setItem: noop, removeItem: noop },
  PDFStudioEngine: { configure: noop },
  PDFSTUDIO_ASSETS: {},
  PDFSTUDIO_BASE: "",
  PDFSTUDIO_WORKER_V: "",
  setTimeout: setTimeout, clearTimeout: clearTimeout,
  setInterval: setInterval, clearInterval: clearInterval,
  console: console, Promise: Promise, URL: URL, Date: Date, Math: Math, JSON: JSON,
  Blob: function () {}, File: function () {}, Image: function () {},
  DragEvent: function () {}, PointerEvent: function () {}, Event: function () {}
};
window_.window = window_;
window_.self = window_;
window_.document = document_;
window_.globalThis = window_;

const source = fs.readFileSync(path.join(WEB, "assets", "app.js"), "utf8");

console.log("\napp.js loads at all");
let loaded = true;
try {
  vm.runInContext(source, vm.createContext(window_), { filename: "app.js" });
} catch (err) {
  loaded = false;
  check("app.js finishes loading", false, (err && err.message) + " (line " + (err && err.lineNumber) + ")");
}
if (loaded) check("app.js finishes loading", true);

// Every tool page calls PDFStudioInit("<slug>") in an inline script at the end
// of its body. If that slug is not a key in the registry, the call returns
// early and the page is dead — so compare the two sets.
if (loaded) {
  console.log("\nregistry matches the pages that use it");

  const registry = window_.PDFStudioTools || {};
  const pages = fs.readdirSync(WEB, { withFileTypes: true })
    .filter((e) => e.isDirectory())
    .map((e) => path.join(WEB, e.name, "index.html"))
    .filter((p) => fs.existsSync(p));

  const declared = new Set();
  for (const p of pages) {
    const html = fs.readFileSync(p, "utf8");
    const m = html.match(/PDFStudioInit\("([a-z0-9-]+)"\)/);
    if (m) declared.add(m[1]);
  }

  const missing = [...declared].filter((s) => !registry[s]);
  check("every page's tool exists in the registry", missing.length === 0,
    missing.length ? "missing: " + missing.join(", ") : declared.size + " pages checked");

  const unused = Object.keys(registry).filter((s) => !declared.has(s));
  check("no tool is registered without a page", unused.length === 0,
    unused.length ? "unused: " + unused.join(", ") : Object.keys(registry).length + " tools registered");

  const KNOWN_LIBS = new Set(["pdf-lib", "pdfjs", "jszip"]);
  const problems = [];
  for (const [slug, t] of Object.entries(registry)) {
    if (typeof t.run !== "function") problems.push(slug + ": no run()");
    if (typeof t.accept !== "string") problems.push(slug + ": no accept");
    if (!Array.isArray(t.libs)) problems.push(slug + ": no libs array");
    else if (t.libs.some((l) => !KNOWN_LIBS.has(l))) problems.push(slug + ": unknown lib");
    if (t.multiple && typeof t.minFiles !== "number") problems.push(slug + ": multiple but no minFiles");
  }
  check("every entry satisfies the tool contract", problems.length === 0,
    problems.join("; ") || Object.keys(registry).length + " entries");

  // A ReferenceError here means a name that does not exist — the exact fault
  // that takes the whole file down. A TypeError is just the stub being a stub,
  // so it is ignored rather than reported as a failure.
  console.log("\ntool callbacks resolve their identifiers");
  const refErrors = [];
  for (const [slug, t] of Object.entries(registry)) {
    for (const fn of ["reset", "controls"]) {
      if (typeof t[fn] !== "function") continue;
      try {
        if (fn === "controls") t[fn](stubEl());
        else t[fn]();
      } catch (err) {
        if (err instanceof ReferenceError) refErrors.push(slug + "." + fn + ": " + err.message);
      }
    }
  }
  check("no undefined identifiers in reset()/controls()", refErrors.length === 0, refErrors.join("; "));

  console.log("\nentry point");
  check("window.PDFStudioInit is a function", typeof window_.PDFStudioInit === "function",
    typeof window_.PDFStudioInit);
}

console.log("\n" + "=".repeat(58));
if (failures) {
  console.log(failures + " FAILED");
  process.exit(1);
}
console.log("UI load checks passed.");
