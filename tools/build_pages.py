"""Render the static site from tools/site_content.py.

    python tools/build_pages.py

Writes web/index.html, one page per tool, a /guides/ section, plus
robots.txt, sitemap.xml, 404.html and _headers.

Edit copy in tools/site_content.py, not here.
"""

from __future__ import annotations

import hashlib
import json
import re
from pathlib import Path

import site_content as C

OUT = Path(__file__).resolve().parents[1] / "web"
VENDOR = ["pdf-lib.min.js", "pdf.min.js", "pdf.worker.min.js", "jszip.min.js"]

# --------------------------------------------------------------------------
# Cache busting. _headers gives /assets/* a one-year immutable cache, which is
# only safe if a changed file gets a new URL — so every asset reference carries
# ?v=<content hash>.
# --------------------------------------------------------------------------


def asset_version(rel_path: str) -> str:
    path = OUT / rel_path
    if not path.exists():
        raise SystemExit(f"asset missing, cannot hash it: {rel_path}")
    return hashlib.sha256(path.read_bytes()).hexdigest()[:10]


VER = {name: asset_version(f"assets/{name}")
       for name in ("styles.css", "app.js", "engine.js", "hero.js", "theme.js")}

THEME_BUTTON = (
    '<button id="theme-toggle" class="theme-btn" type="button" aria-label="Switch to light mode">'
    '<svg class="i-sun" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" '
    'stroke-linecap="round" aria-hidden="true"><circle cx="8" cy="8" r="3.2"/>'
    '<path d="M8 1v1.8M8 13.2V15M1 8h1.8M13.2 8H15M3.2 3.2l1.3 1.3M11.5 11.5l1.3 1.3'
    'M12.8 3.2l-1.3 1.3M4.5 11.5l-1.3 1.3"/></svg>'
    '<svg class="i-moon" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" '
    'stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">'
    '<path d="M13.5 9.6A5.6 5.6 0 0 1 6.4 2.5a5.7 5.7 0 1 0 7.1 7.1z"/></svg>'
    "</button>"
)

# Runs before the stylesheet, so the right theme is on <html> before anything
# paints. Left to theme.js — which loads at the end of the body — the dark theme
# would flash on every single page view.
THEME_BOOT = (
    "<script>(function(){try{var s=localStorage.getItem(\"pdfnest-theme\");"
    "document.documentElement.setAttribute(\"data-theme\","
    "(s===\"light\"||s===\"dark\")?s:(window.matchMedia(\"(prefers-color-scheme: light)\").matches?"
    "\"light\":\"dark\"));}catch(e){}})();</script>"
)

# Line icons, 16x16, stroked with currentColor. Inline rather than an icon font or
# a sprite request: seven small SVGs cost a couple of hundred bytes and add zero
# network round trips.
_ICON_ATTRS = ('viewBox="0 0 16 16" fill="none" stroke="currentColor" '
               'stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"')
ICONS = {
    "merge-pdf": '<path d="M8 2v7"/><path d="M5 6l3 3 3-3"/><path d="M3 12h10v2H3z"/>',
    "split-pdf": '<path d="M3 2h10v3H3z"/><path d="M5 5v4"/><path d="M3 8.5l2 2 2-2"/>'
                 '<path d="M11 5v4"/><path d="M9 8.5l2 2 2-2"/>',
    "organize-pdf": '<path d="M2 2h5v5H2zM9 2h5v5H9zM2 9h5v5H2zM9 9h5v5H9z"/>',
    "compress-pdf": '<path d="M8 2v5"/><path d="M6 5l2 2 2-2"/><path d="M8 14v-5"/>'
                    '<path d="M6 11l2-2 2 2"/>',
    "pdf-to-images": '<path d="M3 2h6l4 4v8H3z"/><circle cx="6.5" cy="9.5" r="1.2"/>'
                     '<path d="M4.5 13l2.5-2.5 2 2L11 10l2 2"/>',
    "images-to-pdf": '<path d="M2 3h7v7H2z"/><circle cx="4.5" cy="5.5" r="1"/>'
                     '<path d="M2.5 9.5l2-2 1.5 1.5L8 7l1 2"/><path d="M11 4l3-1v10l-3-1z"/>',
    "rotate-pdf": '<path d="M13.5 8a5.5 5.5 0 1 1-1.9-4.2"/><path d="M13.5 2v3h-3"/>',
    "edit-pdf": '<path d="M3 13v-2.2L10.8 3a1.2 1.2 0 0 1 1.7 0l.9.9a1.2 1.2 0 0 1 0 1.7L5.6 13z"/>'
                '<path d="M9.6 4.2l2.2 2.2"/>',
}
ICON_CHECK = ('<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2" '
              'stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">'
              '<path d="M2.5 8.5l3.5 3.5L13.5 4.5"/></svg>')
VER.update({name: asset_version(f"assets/vendor/{name}") for name in VENDOR})

TOOLS_BY_SLUG = {t["slug"]: t for t in C.TOOLS}
GUIDES_BY_SLUG = {g["slug"]: g for g in C.GUIDES}
TOOL_ORDER = ["merge-pdf", "split-pdf", "organize-pdf", "edit-pdf", "compress-pdf",
              "pdf-to-images", "images-to-pdf", "rotate-pdf"]

# The header carries only the tools people arrive looking for; the footer links
# every one of them. `opt` links are the ones the mobile rule drops, so the bar
# still fits beside the logo on a 375px screen.
NAV_TOOLS = [("merge-pdf", "Merge"), ("split-pdf", "Split"), ("edit-pdf", "Edit"),
             ("compress-pdf", "Compress"), ("organize-pdf", "Organise")]


def page_url(path: str) -> str:
    return C.SITE_URL + path


def esc(text: str) -> str:
    return (
        str(text)
        .replace("&", "&amp;")
        .replace("<", "&lt;")
        .replace(">", "&gt;")
        .replace('"', "&quot;")
    )


def brand(base: str) -> str:
    return f'<a class="brand" href="{base}index.html">{C.BRAND_HTML}</a>'


def nav(base: str) -> str:
    """Header links, drawn from NAV_TOOLS.

    The last entry is classed `opt` so the narrow-screen rule can drop it — the
    mobile bar then shows the same four links it showed before this tool existed,
    which is a measured fit at 375px rather than a guess.
    """
    links = []
    for i, (slug, label) in enumerate(NAV_TOOLS):
        opt = ' class="opt"' if i == len(NAV_TOOLS) - 1 else ""
        links.append(f'    <a{opt} href="{base}{slug}/index.html">{label}</a>')
    links.append(f'    <a class="opt" href="{base}guides/index.html">Guides</a>')
    links.append(f'    <a class="opt" href="{base}index.html">All tools</a>')
    return '<nav class="site">\n' + "\n".join(links) + "\n  </nav>"


def head(
    title: str,
    desc: str,
    path: str,
    base: str,
    jsonld: list | None = None,
    robots: str = "index, follow, max-image-preview:large, max-snippet:-1",
) -> str:
    canonical = page_url(path)
    blocks = "\n".join(
        f'<script type="application/ld+json">{json.dumps(b, separators=(",", ":"), ensure_ascii=False)}</script>'
        for b in (jsonld or [])
    )
    return f"""<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>{esc(title)}</title>
<meta name="description" content="{esc(desc)}" />
<meta name="robots" content="{robots}" />
<!-- Google Search Console ownership. Also verified via /googlec02981040a625d72.html -->
<meta name="google-site-verification" content="MPTXUatnEBuKl6VfHohWkZ9-8ZU2jeUbbdv55yPHZaw" />
<link rel="canonical" href="{canonical}" />
<link rel="icon" href="{base}favicon.svg" type="image/svg+xml" />
<link rel="apple-touch-icon" href="{base}apple-touch-icon.png" />
<meta name="theme-color" content="#0b0f14" />
<meta property="og:type" content="website" />
<meta property="og:site_name" content="{esc(C.SITE_NAME)}" />
<meta property="og:locale" content="en" />
<meta property="og:title" content="{esc(title)}" />
<meta property="og:description" content="{esc(desc)}" />
<meta property="og:url" content="{canonical}" />
<meta property="og:image" content="{page_url("/og-image.png")}" />
<meta property="og:image:width" content="1500" />
<meta property="og:image:height" content="788" />
<meta property="og:image:alt" content="{esc(C.TAGLINE)}" />
<meta name="twitter:card" content="summary_large_image" />
<meta name="twitter:title" content="{esc(title)}" />
<meta name="twitter:description" content="{esc(desc)}" />
<meta name="twitter:image" content="{page_url("/og-image.png")}" />
{THEME_BOOT}
<link rel="stylesheet" href="{base}assets/styles.css?v={VER['styles.css']}" />
{blocks}
</head>
<body>
<header class="site"><div class="wrap">
  {brand(base)}
  {nav(base)}
  {THEME_BUTTON}
</div></header>
"""


def footer(base: str, scripts: str = "", engine: bool = True) -> str:
    """`engine=False` omits the PDF engine and the tool UI entirely.

    The home page runs no tool, so shipping engine.js and app.js to it was pure
    waste — and those two files now carry the page organiser and the annotation
    layer, so they are the largest thing on the critical path. The measured cost
    of getting this wrong was 14 KB of script on a page that never calls either.
    """
    tool_links = " · ".join(
        f'<a href="{base}{s}/index.html">{TOOLS_BY_SLUG[s]["nav"]}</a>' for s in TOOL_ORDER
    )
    guide_links = " · ".join(
        f'<a href="{base}guides/{g["slug"]}/index.html">{g["nav"]}</a>' for g in C.GUIDES
    )
    assets = {
        "pdf-lib": f"{base}assets/vendor/pdf-lib.min.js?v={VER['pdf-lib.min.js']}",
        "pdfjs": f"{base}assets/vendor/pdf.min.js?v={VER['pdf.min.js']}",
        "jszip": f"{base}assets/vendor/jszip.min.js?v={VER['jszip.min.js']}",
    }
    engine_block = (
        "<script>\n"
        f'  window.PDFSTUDIO_BASE = "{base}";\n'
        f'  window.PDFSTUDIO_WORKER_V = "{VER["pdf.worker.min.js"]}";\n'
        f'  window.PDFSTUDIO_ASSETS = {json.dumps(assets, separators=(",", ":"))};\n'
        "</script>\n"
        f'<script src="{base}assets/engine.js?v={VER["engine.js"]}"></script>\n'
        f'<script src="{base}assets/app.js?v={VER["app.js"]}"></script>\n'
    ) if engine else ""

    return f"""<footer class="site"><div class="wrap">
  <div>
    <p style="margin:0 0 6px">Files never leave your device. No upload, no account, no watermark.</p>
    <p style="margin:0">{tool_links}</p>
    <p style="margin:4px 0 0">{guide_links}</p>
    <p style="margin:4px 0 0"><a href="{base}about/index.html">About</a> ·
      <a href="{base}privacy/index.html">Privacy</a></p>
  </div>
  <span>© <span id="year"></span> {esc(C.SITE_NAME)}</span>
</div></footer>
{engine_block}{scripts}<script src="{base}assets/theme.js?v={VER['theme.js']}"></script>

</body>
</html>
"""


def breadcrumb(items: list[tuple[str, str]]) -> dict:
    return {
        "@context": "https://schema.org",
        "@type": "BreadcrumbList",
        "itemListElement": [
            {"@type": "ListItem", "position": i + 1, "name": name, "item": page_url(path) if path else None}
            for i, (name, path) in enumerate(items)
        ],
    }


def faq_schema(faq: list[tuple[str, str]]) -> dict:
    return {
        "@context": "https://schema.org",
        "@type": "FAQPage",
        "mainEntity": [
            {"@type": "Question", "name": q, "acceptedAnswer": {"@type": "Answer", "text": a}}
            for q, a in faq
        ],
    }


def sections_html(sections: list) -> str:
    out = []
    for heading, paras in sections:
        out.append(f"  <h2>{heading}</h2>")
        for p in paras:
            out.append(f"  <p>{p}</p>")
    return "\n".join(out)


def faq_html(faq: list[tuple[str, str]]) -> str:
    return "\n".join(
        f'  <details><summary>{q}</summary><p>{a}</p></details>' for q, a in faq
    )


def tool_card(slug: str, base: str = "") -> str:
    t = TOOLS_BY_SLUG[slug]
    icon = ICONS.get(slug, "")
    ico = f'<span class="ico"><svg {_ICON_ATTRS}>{icon}</svg></span>' if icon else ""
    return (f'<a class="card with-ico" href="{base}{slug}/index.html">{ico}'
            f'<span><h3>{t["h1"]}</h3><p>{t["card"]}</p></span></a>')


def guide_card(slug: str, base: str = "") -> str:
    g = GUIDES_BY_SLUG[slug]
    return f'<a class="card" href="{base}guides/{slug}/index.html"><h3>{g["h1"]}</h3><p>{g["card"]}</p></a>'


def ad_slot(where: str) -> str:
    """Reserved advertising space.

    The box exists before any ad does, at a fixed height, so that adding a real
    ad later cannot push the page around — a layout shift is a Cumulative Layout
    Shift penalty, and CLS is one of the three Core Web Vitals.
    """
    return (f'<div class="ad" data-ad-slot="{where}">Advertisement'
            f'<span>Reserved space — an ad here will not shift the page</span></div>')


def tool_ui(slug: str) -> str:
    t = TOOLS_BY_SLUG[slug]
    noun = "files" if slug in ("merge-pdf", "images-to-pdf") else "PDF"
    return f"""  <div class="panel">
    <div class="drop" id="drop">
      <strong>Drop your {noun} here</strong>
      <span class="hint" id="drop-hint">or click to browse — processed locally, never uploaded</span>
      <input type="file" id="file-input" />
    </div>
    <div class="files" id="file-list"></div>
    <div class="workspace" id="workspace"></div>
    <div class="row" id="controls"></div>
    <div class="row">
      <button id="run" type="button" disabled>Process</button>
      <button id="clear" class="ghost" type="button">Clear</button>
    </div>
    <div class="bar" id="progress"><i></i></div>
    <div class="msg" id="msg"></div>
  </div>"""


# --------------------------------------------------------------------------
# Tool pages
# --------------------------------------------------------------------------

for tool in C.TOOLS:
    slug = tool["slug"]
    other = "\n      ".join(tool_card(s, "../") for s in TOOL_ORDER if s != slug)
    related = ""
    if tool.get("guides"):
        cards = "\n      ".join(guide_card(g, "../") for g in tool["guides"])
        related = f"""
  <h2>Related guides</h2>
  <div class="grid">
      {cards}
  </div>
"""

    schema = [
        {
            "@context": "https://schema.org",
            "@type": "SoftwareApplication",
            "name": f'{tool["h1"]} — {C.SITE_NAME}',
            "url": page_url(f"/{slug}/"),
            "applicationCategory": "UtilitiesApplication",
            "operatingSystem": "Any device with a modern web browser",
            "browserRequirements": "Requires JavaScript. No account, no plugin.",
            "offers": {"@type": "Offer", "price": "0", "priceCurrency": "USD"},
            "description": tool["desc"],
            "featureList": tool["secondary"],
            "isAccessibleForFree": True,
        },
        {
            "@context": "https://schema.org",
            "@type": "HowTo",
            "name": tool["h1"],
            "description": tool["lede"],
            "totalTime": "PT1M",
            "tool": [{"@type": "HowToTool", "name": "A web browser"}],
            "step": [
                {"@type": "HowToStep", "position": i + 1, "name": h, "text": body}
                for i, (h, body) in enumerate(tool["steps"])
            ],
        },
        faq_schema(tool["faq"]),
        breadcrumb([("Home", "/"), (tool["nav"], f"/{slug}/")]),
    ]

    html = head(tool["title"], tool["desc"], f"/{slug}/", "../", schema)
    html += f"""<main><div class="wrap">
  <nav class="crumbs"><a href="../index.html">Home</a> › <span>{tool["nav"]}</span></nav>
  <h1>{tool["h1"]}</h1>
  <span class="pill">Runs on your device — nothing is uploaded</span>
  <p class="lede">{tool["lede"]}</p>

{tool_ui(slug)}

  <h2>How it works</h2>
  <ol class="steps">
{chr(10).join(f'    <li><strong>{h}</strong>{b}</li>' for h, b in tool["steps"])}
  </ol>

{sections_html(tool["sections"])}

  <h2>Questions</h2>
{faq_html(tool["faq"])}
{related}
  <h2>Other tools</h2>
  <div class="grid">
      {other}
  </div>
</div></main>
"""
    html += footer("../")
    html += f'<script>PDFStudioInit("{slug}");</script>\n'
    target = OUT / slug / "index.html"
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_text(html, encoding="utf-8")
    print(f"wrote {target.relative_to(OUT.parent)}")

# --------------------------------------------------------------------------
# Guide pages
# --------------------------------------------------------------------------

for guide in C.GUIDES:
    slug = guide["slug"]
    tool = TOOLS_BY_SLUG[guide["tool"]]
    schema = [
        {
            "@context": "https://schema.org",
            "@type": "Article",
            "headline": guide["h1"],
            "description": guide["desc"],
            "inLanguage": "en",
            "mainEntityOfPage": page_url(f"/guides/{slug}/"),
            "author": {"@type": "Organization", "name": C.SITE_NAME, "url": C.SITE_URL},
            "publisher": {"@type": "Organization", "name": C.SITE_NAME, "url": C.SITE_URL},
        },
        faq_schema(guide["faq"]),
        breadcrumb([("Home", "/"), ("Guides", "/guides/"), (guide["nav"], f"/guides/{slug}/")]),
    ]
    html = head(guide["title"], guide["desc"], f"/guides/{slug}/", "../../", schema)
    html += f"""<main><div class="wrap">
  <nav class="crumbs"><a href="../../index.html">Home</a> › <a href="../index.html">Guides</a> › <span>{guide["nav"]}</span></nav>
  <h1>{guide["h1"]}</h1>
  <p class="lede">{guide["lede"]}</p>

{sections_html(guide["sections"])}

  <div class="cta">
    <h2>Do it now, free</h2>
    <p>{tool["lede"]}</p>
    <p><a class="button" href="../../{guide["tool"]}/index.html">{tool["h1"]} →</a></p>
    <p class="hint">Runs in your browser. Nothing is uploaded.</p>
  </div>

  <h2>Questions</h2>
{faq_html(guide["faq"])}

  <h2>All tools</h2>
  <div class="grid">
      {chr(10).join(tool_card(s, "../../") for s in TOOL_ORDER)}
  </div>
</div></main>
"""
    html += footer("../../")
    html += '<script>document.getElementById("year").textContent = new Date().getFullYear();</script>\n'
    target = OUT / "guides" / slug / "index.html"
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_text(html, encoding="utf-8")
    print(f"wrote {target.relative_to(OUT.parent)}")

# --------------------------------------------------------------------------
# Guides index
# --------------------------------------------------------------------------

gi_schema = [
    {
        "@context": "https://schema.org",
        "@type": "CollectionPage",
        "name": f"PDF guides — {C.SITE_NAME}",
        "url": page_url("/guides/"),
        "hasPart": [
            {"@type": "Article", "headline": g["h1"], "url": page_url(f"/guides/{g['slug']}/")}
            for g in C.GUIDES
        ],
    },
    breadcrumb([("Home", "/"), ("Guides", "/guides/")]),
]
guides_index = head(
    f"PDF Guides — Practical Answers to Common PDF Problems | {C.SITE_NAME}",
    "Straight answers about PDF file size, merging on phones, and the trade-offs behind compression. Written to be useful, not to fill space.",
    "/guides/", "../", gi_schema,
)
guides_index += f"""<main><div class="wrap">
  <nav class="crumbs"><a href="../index.html">Home</a> › <span>Guides</span></nav>
  <h1>PDF guides</h1>
  <p class="lede">Longer answers to the questions that come up again and again — explained with the trade-offs included, so you can make the call yourself.</p>
  <div class="grid">
      {chr(10).join(guide_card(g["slug"], "../") for g in C.GUIDES)}
  </div>
  <h2>Tools</h2>
  <p class="lede">Every tool runs entirely in your browser — nothing is uploaded, there is no account, and there are no daily limits.</p>
  <div class="grid">
      {chr(10).join(tool_card(s, "../") for s in TOOL_ORDER)}
  </div>
</div></main>
"""
guides_index += footer("../")
guides_index += '<script>document.getElementById("year").textContent = new Date().getFullYear();</script>\n'
(OUT / "guides" / "index.html").write_text(guides_index, encoding="utf-8")
print("wrote web/guides/index.html")

# --------------------------------------------------------------------------
# Home
# --------------------------------------------------------------------------

# --------------------------------------------------------------------------
# Privacy policy
#
# Required before any advertising can be approved — and worth writing honestly
# regardless, because a site whose whole pitch is "your files never leave your
# device" should be specific about the little it does see.
# --------------------------------------------------------------------------

privacy = head(
    f"Privacy Policy — {C.SITE_NAME}",
    "How PDF Nest handles your documents, what the hosting layer logs, and what happens if advertising is ever enabled. No accounts, no analytics, no cookies.",
    "/privacy/", "../",
    [breadcrumb([("Home", "/"), ("Privacy", "/privacy/")])],
)
privacy += f"""<main><div class="wrap">
  <nav class="crumbs"><a href="../index.html">Home</a> › <span>Privacy</span></nav>
  <h1>Privacy policy</h1>
  <p class="lede">The short version: your documents are processed inside your own browser and are
  never transmitted to us, because there is no server here for them to be transmitted to. This site
  has no accounts, sets no cookies, and runs no analytics.</p>
  <p class="hint">Last updated: October 2026.</p>

  <h2>Your documents</h2>
  <p>When you choose a file, your browser reads it from your disk and the processing happens on your
  own machine, in the page you already have open. There is no upload step. Nothing about the file —
  its contents, its name, its size — is sent anywhere by this site.</p>
  <p>You do not have to take that on trust. Open your browser's developer tools, switch to the
  Network tab, and process a document. You will see no request carrying your file. You can also load
  the page, disconnect from the internet entirely, and the tools will still work — which they could
  not do if they depended on a server.</p>
  <p>The libraries that do the work are served from this site rather than from a third-party content
  network, so there is no external request during processing either.</p>

  <h2>What this site does not do</h2>
  <ul class="checks">
    <li>No accounts, no sign-up, and no email address is collected.</li>
    <li>No analytics, no telemetry, and no session recording.</li>
    <li>No cookies at all, and no local storage for anything except the theme you pick.</li>
    <li>No advertising or third-party scripts are loaded.</li>
    <li>No fingerprinting, and no attempt to identify you across sites.</li>
    <li>No server-side copy of your documents exists at any point, so there is nothing to delete.</li>
  </ul>
  <p>Exactly one thing is stored on your device: whether you chose the light or dark theme. It is a
  single word in your browser's local storage, it exists so the site does not flash the wrong colours
  when you come back, it never leaves your device, and clearing your browser data erases it. If you
  never touch the theme switch, nothing is stored at all.</p>

  <h2>What the hosting layer sees</h2>
  <p>Like any website, this one is served by a hosting provider — Cloudflare Pages. When your browser
  requests a page, that provider processes the request and may record standard technical information
  such as your IP address, your browser's user agent, and the page requested, for security and
  traffic purposes. This is ordinary web server behaviour and applies to every site you visit,
  including this one. It does not include the contents of any document you process, because those
  never reach the network at all. Cloudflare's own privacy policy governs what they hold.</p>

  <h2>Advertising</h2>
  <p>Advertising is <strong>not currently enabled</strong> on this site. A reserved space may appear
  on some pages to keep the layout stable, but it serves no advertisement and loads no code.</p>
  <p>If advertising is enabled in future, this section will be updated before that happens, and it
  will state plainly that third-party advertising vendors may set cookies or similar identifiers in
  order to select and measure ads, that this involves sharing limited technical data with those
  vendors, and how to opt out — including through your browser's cookie controls and any
  region-specific consent notice that would be shown to you first. Enabling ads would not change how
  your documents are handled: they would still never leave your device.</p>

  <h2>Children</h2>
  <p>This site is a general-purpose document utility, is not directed at children, and collects no
  personal information from anyone.</p>

  <h2>Changes to this policy</h2>
  <p>If anything here changes, the date at the top of this page changes with it. Material changes —
  in particular anything that would alter how your documents are handled — will be described here
  rather than made quietly.</p>

  <h2>Contact</h2>
  <p>This site is run by one independent developer. There is no mailbox attached to it yet — and
  rather than print a placeholder address, this section says so. A contact channel will be added
  here before this site begins running advertising or accepting payments, both of which would
  require one. Who is behind the site, and the limits of the tools, are set out on the
  <a href="../about/index.html">about page</a>.</p>

  <h2>The tools</h2>
  <div class="grid">
      {chr(10).join(tool_card(s, "../") for s in TOOL_ORDER)}
  </div>
</div></main>
"""
privacy += footer("../")
privacy += '<script>document.getElementById("year").textContent = new Date().getFullYear();</script>\n'
(OUT / "privacy").mkdir(parents=True, exist_ok=True)
(OUT / "privacy" / "index.html").write_text(privacy, encoding="utf-8")
print("wrote web/privacy/index.html")

# --------------------------------------------------------------------------
# About
#
# The page a search engine and a cautious visitor both look for, and the only
# place on the site that says who is behind it. Two rules here, both deliberate:
# nothing on it can be a claim I cannot back up (no invented team, no invented
# address, no awards), and it repeats the limits of the tools rather than
# leaving them to be discovered. A trust page that oversells is worth less than
# no trust page at all.
# --------------------------------------------------------------------------

ABOUT_FAQ = [
    ("Is PDF Nest really free?",
     "Yes, and there is no paid tier to be pushed towards later for the tools you see — no daily limit, no queue, no file-size upgrade, and no watermark that a subscription removes. There is no server in the middle and therefore no running cost to recover, which is the whole reason it can work this way."),
    ("How can I be sure my file is not being uploaded?",
     "Do not take the claim on trust; test it. Open your browser's developer tools, switch to the Network tab, and watch it while you process a document — you will see no request carrying your file. Then try disconnecting from the internet after the page has loaded: the tools keep working, which they could not do if they depended on a server. Both checks take about a minute."),
    ("Who is behind it?",
     "One independent developer, working on this alongside client work. It is not a company, there is no team, and there is no funding behind it — which is worth knowing when you weigh the promises made on this site."),
    ("Why is there no contact email address?",
     "Because there is no mailbox attached to the site yet, and printing a placeholder address would be worse than saying so. One will be added here before the site starts running advertising or taking payments, both of which need a working contact route."),
]

about_schema = [
    {
        "@context": "https://schema.org",
        "@type": "AboutPage",
        "name": f"About {C.SITE_NAME}",
        "url": page_url("/about/"),
        "description": "Who runs PDF Nest, how the tools work without a server, and what they deliberately do not do.",
        "mainEntity": {
            "@type": "Organization",
            "name": C.SITE_NAME,
            "url": C.SITE_URL,
            "description": "Browser-based PDF tools: merge, split, organise, edit, compress, convert and rotate. Documents are processed on the visitor's own device and are never uploaded.",
            "foundingDate": "2026",
        },
    },
    faq_schema(ABOUT_FAQ),
    breadcrumb([("Home", "/"), ("About", "/about/")]),
]

about = head(
    f"About {C.SITE_NAME} — Who Runs It, and What It Does Not Do",
    "Who runs PDF Nest, why the tools run in your browser instead of on a server, how the site is paid for, and the things it deliberately cannot do.",
    "/about/", "../", about_schema,
)
about += f"""<main><div class="wrap">
  <nav class="crumbs"><a href="../index.html">Home</a> › <span>About</span></nav>
  <h1>About {esc(C.SITE_NAME)}</h1>
  <p class="lede">{esc(C.SITE_NAME)} is a small set of PDF tools that run inside your browser. There is no
  server holding your documents, no account to create, and no step at which your file travels anywhere.</p>

  <h2>Why this exists</h2>
  <p>Most online PDF tools work by uploading your document to a server, processing it there, and deleting
  it after some interval you cannot verify. For a shopping list that is fine. For a signed contract, a
  medical letter, an identity document or a client's accounts, it means handing a copy of something
  sensitive to a stranger's computer and taking the deletion promise on faith.</p>
  <p>That trade stopped being necessary. A browser can read a file from disk, do the work in memory and
  hand the result straight back, which is what every tool on this site does. The honest cost of working
  this way is that the ceiling is your own machine rather than a data centre, and that some jobs simply
  cannot be done at all — see the list further down, which is there so you find the limits before you
  need them rather than after.</p>

  <h2>What runs, and where</h2>
  <p>The site is plain HTML, CSS and JavaScript, built around two well-established open-source libraries:
  <strong>pdf-lib</strong> for reading and writing PDFs, and <strong>pdf.js</strong> for drawing pages.
  Both are served from this site rather than from a third-party content network, so processing a document
  makes no external request of any kind.</p>
  <p>There is no analytics, no telemetry, no session recording, no cookie and no account. One thing is
  stored on your device: whether you chose the light or dark theme, as a single word in local storage that
  never leaves it. The <a href="../privacy/index.html">privacy page</a> sets all of this out in more detail,
  including what the hosting layer unavoidably sees.</p>

  <h2>Who runs it</h2>
  <p>One independent developer, working on this alongside client work. Not a company, no team, no funding.
  That is worth stating plainly, because it tells you how to weigh everything else on this page: there is
  no support desk, no account manager and no roadmap driven by investors.</p>

  <h2>How it is funded</h2>
  <p>It costs almost nothing to run, because there is no server doing the work — which is why there is no
  paid tier for the tools you see and no reason to invent one. Advertising may be enabled on the free
  pages at some point, and if it is, the privacy page will describe it before it happens rather than after.</p>
  <p>A paid server version is planned for the jobs a browser genuinely cannot do: very large documents,
  batch processing and an API. It would sit alongside these tools, not replace them.</p>

  <h2>What it deliberately does not do</h2>
  <ul class="checks">
    <li><strong>Change words that are already on the page.</strong> A PDF stores positioned drawing
    instructions rather than paragraphs, and its fonts usually hold only the characters already in use, so
    rewriting existing text reliably is a different and much harder problem than adding to it. The editor
    adds text, signatures, white-out, watermarks and page numbers; it does not rewrite. Edit the document
    in whatever produced it and export it again.</li>
    <li><strong>Convert PDF to Word or Excel.</strong> This needs a full document-layout engine, of the kind
    that runs on a server, and a browser is the wrong place to attempt it convincingly.</li>
    <li><strong>Unlock password-protected files.</strong> A document that needs a password to open cannot be
    read without it. That is the point of the password.</li>
    <li><strong>Sign with a certificate.</strong> A visual signature shows intent. It does not prove the
    document has not changed since, and it is not the certificate-based kind some portals require.</li>
    <li><strong>Add its own watermark, or charge to remove one.</strong> The only watermark in your file is
    the one you type.</li>
    <li><strong>Redact.</strong> A white-out box hides what is underneath; it does not remove it from the
    file. Anything that has to be genuinely gone should be removed in the application that produced the
    document.</li>
  </ul>

  <h2>Contact</h2>
  <p>There is no mailbox attached to the site yet, and rather than print a placeholder address this section
  says so. One will be added here before the site begins running advertising or accepting payments, both of
  which need a working contact route.</p>

  <h2>Questions</h2>
{faq_html(ABOUT_FAQ)}

  <h2>The tools</h2>
  <div class="grid">
      {chr(10).join(tool_card(s, "../") for s in TOOL_ORDER)}
  </div>
</div></main>
"""
about += footer("../")
about += '<script>document.getElementById("year").textContent = new Date().getFullYear();</script>\n'
(OUT / "about").mkdir(parents=True, exist_ok=True)
(OUT / "about" / "index.html").write_text(about, encoding="utf-8")
print("wrote web/about/index.html")

# --------------------------------------------------------------------------
# Home
# --------------------------------------------------------------------------

HOME_FAQ = [
    ("Is it really free, with no catch?", "Yes. There is no server and therefore no running cost to cover, so there are no daily limits, no watermarks and no forced signup. Everything runs on the machine you are already using."),
    ("Are my documents private?", "They never leave your device. There is no upload step at all — you can open your browser's network tab and watch that nothing is sent while a file is processed."),
    ("Does it work offline?", "Once the page has loaded, yes. The processing libraries are served from this site itself rather than a third-party CDN, so no external request is needed during processing."),
    ("What is the file size limit?", "Your device's memory. Documents up to roughly 150 MB are comfortable on a typical laptop; very large files need a bigger machine rather than a paid plan."),
    ("Do I need to install anything?", "No. Everything runs in the browser, so there is no app, no extension and no plugin to install."),
]

home_schema = [
    {
        "@context": "https://schema.org",
        "@type": "WebSite",
        "name": C.SITE_NAME,
        "url": C.SITE_URL,
        "description": C.TAGLINE,
        "inLanguage": "en",
    },
    {
        "@context": "https://schema.org",
        "@type": "Organization",
        "name": C.SITE_NAME,
        "url": C.SITE_URL,
        "logo": page_url("/favicon.svg"),
    },
    {
        "@context": "https://schema.org",
        "@type": "ItemList",
        "name": "PDF tools",
        "itemListElement": [
            {"@type": "ListItem", "position": i + 1, "name": TOOLS_BY_SLUG[s]["h1"],
             "url": page_url(f"/{s}/")}
            for i, s in enumerate(TOOL_ORDER)
        ],
    },
    faq_schema(HOME_FAQ),
]

home = head(
    f"{C.SITE_NAME} — Free PDF Tools That Never Upload Your Files",
    "Merge, split, compress, rotate and convert PDFs without uploading them anywhere. Free, instant, no signup and no watermark — everything happens in your browser.",
    "/", "", home_schema,
)
_marquee_items = "".join(f'<li>{TOOLS_BY_SLUG[s]["h1"]}</li>' for s in TOOL_ORDER)

home += f"""<main>
<section class="hero">
  <canvas id="hero-canvas" aria-hidden="true"></canvas>
  <div class="wrap">
    <div>
      <h1 class="rise-lcp">PDF tools that never upload your files</h1>
      <p class="sub rise rise-2">
        Merge, split, organise, compress, rotate and convert. Free and unlimited, because there is
        no server for your documents to travel to — the work happens in the tab you already have open.
      </p>
      <div class="cta rise rise-3">
        <a class="btn" href="#tools">Browse the tools</a>
        <a class="btn ghost" href="#why">How is that possible?</a>
      </div>
      <ul class="checks rise rise-4">
        <li>{ICON_CHECK}<span>No upload step at all — open your browser's network tab and watch while it works</span></li>
        <li>{ICON_CHECK}<span>Keeps working with the connection switched off, once the page has loaded</span></li>
        <li>{ICON_CHECK}<span>No account, no watermark, no daily limit, no file size tier to buy past</span></li>
      </ul>
    </div>
    <div class="mock rise rise-5" aria-hidden="true">
      <div class="bar"><i></i><i></i><i></i><span>your-browser</span></div>
      <div class="head"><em>Network activity</em><span class="pill-ok">0 bytes uploaded</span></div>
      <div class="row"><b>statement.pdf</b> 2.41 MB, read from disk <span class="ok">done</span></div>
      <div class="row"><b>merged.pdf</b> 2.41 MB, written by you <span class="ok">done</span></div>
      <div class="row">POST /upload <span class="ok">never called</span></div>
      <div class="row">requests to this site while working <span class="ok">0</span></div>
    </div>
  </div>
</section>

<section class="strip">
  <div class="wrap">
    <p class="cap">Seven tools · one tab · nothing leaves your device</p>
    <div class="marquee">
      <div class="track">
        <ul>{_marquee_items}</ul>
        <ul aria-hidden="true">{_marquee_items}</ul>
      </div>
    </div>
  </div>
</section>

<div class="wrap" id="tools">
  <h2>Pick a tool</h2>
  <div class="grid">
      {chr(10).join(tool_card(s) for s in TOOL_ORDER)}
  </div>

  {ad_slot("under-tools")}

  <h2 id="why">Why this is different</h2>
  <p class="lede">
    Most free PDF sites upload your file to a server, process it there and delete it later. That means
    waiting for an upload, trusting a stranger with a contract or a payslip, and hoping the deletion
    promise is true. Here the file never leaves the tab it was opened in. You can load the page, go
    offline, and everything still works.
  </p>
  <p class="lede">
    It is also why these tools are free with no daily quota: there is no server to pay for. No GPU,
    no cloud bills, and no ad-funded limit on how many documents you may process.
  </p>

  <h2>What that means in practice</h2>
  <div class="tablewrap">
  <table class="compare">
    <tr><th></th><th>Server-based tools</th><th>{esc(C.SITE_NAME)}</th></tr>
    <tr><td>Your file</td><td>Uploaded to a server, deleted later</td><td>Never leaves your device</td></tr>
    <tr><td>Waiting</td><td>Upload, queue, process, download</td><td>Processing starts immediately</td></tr>
    <tr><td>Offline</td><td>Impossible</td><td>Works after the page loads</td></tr>
    <tr><td>Daily quota</td><td>Usually capped on the free tier</td><td>No limit</td></tr>
    <tr><td>Watermarks</td><td>Common on free tiers</td><td>None</td></tr>
    <tr><td>Very large files</td><td>Handled server-side</td><td>Limited by your device memory</td></tr>
  </table>
  </div>

  <h2>Guides</h2>
  <div class="grid">
      {chr(10).join(guide_card(g["slug"]) for g in C.GUIDES)}
  </div>

  <h2>Questions</h2>
{faq_html(HOME_FAQ)}

  <div class="pro">
    <h2>When you need more than a browser can do</h2>
    <p class="hint">Everything above is free and unlimited. A server version is useful only for jobs that are
    genuinely too big for a single browser tab:</p>
    <div class="tablewrap">
    <table class="simple">
      <tr><th>Job</th><th>Free (this site)</th><th>Server version</th></tr>
      <tr><td>File size</td><td>Comfortable to ~150 MB</td><td>Up to 2 GB</td></tr>
      <tr><td>Batch processing</td><td>One document at a time</td><td>Hundreds of files in a queue</td></tr>
      <tr><td>Automation</td><td>Manual, in the browser</td><td>REST API for scripts and pipelines</td></tr>
      <tr><td>Compression</td><td>Good</td><td>Better — server CPU is not shared with your laptop</td></tr>
    </table>
    </div>
  </div>

  {ad_slot("before-footer")}
</div></main>
"""
home += footer("", f'<script src="assets/hero.js?v={VER["hero.js"]}"></script>\n', engine=False)
home += '<script>document.getElementById("year").textContent = new Date().getFullYear();</script>\n'
(OUT / "index.html").write_text(home, encoding="utf-8")
print("wrote web/index.html")

# --------------------------------------------------------------------------
# sitemap.xml, robots.txt, 404.html, _headers
# --------------------------------------------------------------------------

paths = ([("/", "1.0")] + [(f"/{s}/", "0.9") for s in TOOL_ORDER]
         + [("/guides/", "0.6"), ("/about/", "0.5"), ("/privacy/", "0.2")])
paths += [(f"/guides/{g['slug']}/", "0.6") for g in C.GUIDES]

sitemap = '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n'
for path, prio in paths:
    sitemap += f"  <url><loc>{page_url(path)}</loc><priority>{prio}</priority></url>\n"
sitemap += "</urlset>\n"
(OUT / "sitemap.xml").write_text(sitemap, encoding="utf-8")

(OUT / "robots.txt").write_text(
    f"User-agent: *\nAllow: /\n\nSitemap: {C.SITE_URL}/sitemap.xml\n",
    encoding="utf-8",
)

# IndexNow ownership key, served at the root of the host. Written as bytes with no
# trailing newline on purpose: the protocol wants the file to contain the key, and
# a stray line ending is the usual reason verification fails. See
# tools/ping_indexnow.py, which submits the sitemap's URLs to Bing and Yandex.
(OUT / f"{C.INDEXNOW_KEY}.txt").write_bytes(C.INDEXNOW_KEY.encode("utf-8"))
print(f"wrote {(OUT / (C.INDEXNOW_KEY + '.txt')).relative_to(OUT.parent)}")

# --------------------------------------------------------------------------
# Google Search Console ownership file.
#
# Google re-checks this periodically and the property LOSES verification if it
# ever disappears, so it is generated here rather than being a loose file that a
# rebuild could drop. The bytes must stay exactly as Google issued them —
# 53 bytes, no trailing newline.
# --------------------------------------------------------------------------
GSC_VERIFY_FILE = "googlec02981040a625d72.html"
GSC_VERIFY_BODY = b"google-site-verification: googlec02981040a625d72.html"

(OUT / GSC_VERIFY_FILE).write_bytes(GSC_VERIFY_BODY)
assert (OUT / GSC_VERIFY_FILE).read_bytes() == GSC_VERIFY_BODY, "verification file was altered"

notfound = head(
    f"Page not found — {C.SITE_NAME}",
    "That page does not exist. These tools do.",
    "/404.html", "", [], robots="noindex, follow",
)
notfound += f"""<main><div class="wrap">
  <h1>That page does not exist</h1>
  <p class="lede">The link may be out of date. These all work:</p>
  <div class="grid">
      {chr(10).join(tool_card(s) for s in TOOL_ORDER)}
  </div>
</div></main>
"""
notfound += footer("")
notfound += '<script>document.getElementById("year").textContent = new Date().getFullYear();</script>\n'
(OUT / "404.html").write_text(notfound, encoding="utf-8")

(OUT / "_headers").write_text(
    """/assets/*
  Cache-Control: public, max-age=31536000, immutable

/*
  X-Content-Type-Options: nosniff
  Referrer-Policy: strict-origin-when-cross-origin
  X-Frame-Options: SAMEORIGIN
""",
    encoding="utf-8",
)

print("wrote web/sitemap.xml, web/robots.txt, web/404.html, web/_headers")
print(f"\n{len(C.TOOLS)} tool pages, {len(C.GUIDES)} guides, 1 guides index, 1 home. "
      f"{len(paths)} URLs in the sitemap.")
