/* Light / dark theme.
 *
 * The initial choice is NOT applied here. A tiny inline script in <head> sets
 * data-theme before the stylesheet loads, because doing it from this file — which
 * loads at the end of the body — would paint the dark theme first and then swap,
 * and a flash of the wrong colours on every page view is worse than having no
 * toggle at all. This file only handles what happens after that.
 */
(function () {
  "use strict";

  var root = document.documentElement;
  var STORE = "pdfnest-theme";

  function stored() {
    try {
      var v = localStorage.getItem(STORE);
      return (v === "light" || v === "dark") ? v : null;
    } catch (e) {
      return null; // private mode, disabled storage — fall back to the system
    }
  }

  function isLight() { return root.getAttribute("data-theme") === "light"; }

  function syncChrome() {
    var meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute("content", isLight() ? "#f6f8fb" : "#0b0f14");
    var btn = document.getElementById("theme-toggle");
    if (btn) {
      btn.setAttribute("aria-label", isLight() ? "Switch to dark mode" : "Switch to light mode");
      btn.setAttribute("title", isLight() ? "Switch to dark mode" : "Switch to light mode");
    }
  }

  function apply(theme, remember) {
    root.setAttribute("data-theme", theme);
    if (remember) { try { localStorage.setItem(STORE, theme); } catch (e) {} }
    syncChrome();
    // The hero canvas caches the colours it reads from CSS variables, so it has to
    // be told that they changed.
    window.dispatchEvent(new CustomEvent("pdfnest:theme", { detail: { theme: theme } }));
  }

  syncChrome();

  var btn = document.getElementById("theme-toggle");
  if (btn) {
    btn.addEventListener("click", function () { apply(isLight() ? "dark" : "light", true); });
  }

  // Keep following the operating system until the visitor chooses for themselves.
  var mq = window.matchMedia("(prefers-color-scheme: light)");
  if (mq.addEventListener) {
    mq.addEventListener("change", function (ev) {
      if (!stored()) apply(ev.matches ? "light" : "dark", false);
    });
  }
})();
