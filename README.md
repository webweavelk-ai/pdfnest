# PDF Nest

**Live site: https://pdfnest.pages.dev**

Free PDF tools that run entirely inside the browser. No upload, no account, no
signup, and no vendor watermark.

---

## What it is

Eight tools, each its own page, each doing one thing:

| Tool | What it does |
|---|---|
| **Merge** | Combine several PDFs into one, in the order you choose |
| **Split** | Break a PDF into separate files, or extract page ranges like `1-3,5,8-10` |
| **Organise** | Delete, reorder, rotate and duplicate pages in a thumbnail grid |
| **Edit** | Add text boxes, a signature/image, white-out boxes, a watermark and page numbers |
| **Compress** | Three levels, from lossless re-saving to re-rendering pages as images |
| **PDF → Images** | Export each page as PNG or JPG at 96–300 dpi, delivered as a ZIP |
| **Images → PDF** | Turn JPG, PNG or WEBP files into a single document |
| **Rotate** | Fix sideways or upside-down scans, all pages or a few |

## The claim worth checking

Every page says "nothing is uploaded". That is not marketing — there is no
server involved at all. Two ways to verify it yourself:

1. Open your browser's network tab, then run any conversion. No request carries
   your file.
2. Load a page, disconnect from the internet, and keep using the tool. It still
   works.

The vendor libraries are served from this site rather than a third-party CDN, so
there are no external requests during processing either.

## What it deliberately does not do

Saying this up front saves everyone time:

- **It cannot change words already on a page.** The editor adds a layer on top —
  text boxes, images, white-out, watermarks, page numbers. A PDF stores
  positioned drawing instructions rather than paragraphs, and its fonts usually
  contain only the characters the document already used, so rewriting existing
  text is a different and much harder problem.
- **A white-out box hides, it does not redact.** The original characters remain
  in the file and are still extractable. Deleting the page is the honest way to
  remove something.
- **No PDF → Word/Excel.** That needs a conversion engine that cannot run in a
  browser, so it is a deliberate omission rather than a missing feature.
- **No unlocking of password-protected files**, and no certificate-based digital
  signing.
- **Text is Latin-only** in the editor's standard fonts. Sinhala, Tamil, Chinese,
  Arabic and emoji would need an embedded font file.

## Tech

Plain HTML, CSS and JavaScript — no framework, no build step in the browser, no
tracking. Three open-source libraries, loaded lazily only when a visitor actually
touches a tool, so they never affect first paint:

- [pdf-lib](https://github.com/Hopding/pdf-lib) — document structure, merging, page operations, annotations
- [pdf.js](https://github.com/mozilla/pdf.js) — rendering pages for thumbnails and image export
- [JSZip](https://stuk.github.io/jszip/) — bundling multi-file output

The site is static: `web/` is deployed as-is to Cloudflare Pages. Hosting costs
nothing, which is why the tools can stay free.

## Repo layout

```
web/                the deployed site
  index.html        home page
  <tool>/index.html one page per tool
  guides/           longer "how do I..." articles
  about/            who runs it and what it does not do
  privacy/          what is (not) collected
  assets/           stylesheet, engine, UI, hero animation, vendor libs
  sitemap.xml       generated
tools/              the generator and the tests
  site_content.py   all page copy in one place
  build_pages.py    renders web/ from site_content.py
  make_fixtures.py  sample PDFs and images for the tests
  test_engine.js    engine tests, run in Node
  test_ui_load.js   loads the UI in Node and checks the tool registry
  check_links.py    every local href/src resolves
  build_zip.py      packages web/ for deployment
  ping_indexnow.py  submits the sitemap to Bing/Yandex
```

`web/` is generated — edit `tools/site_content.py` (copy) or
`tools/build_pages.py` (layout) and re-run the build.

## Running it locally

```bash
python tools/make_fixtures.py      # sample files for the tests
node tools/test_engine.js          # engine: parse, merge, split, rotate, images, annotate
node tools/test_ui_load.js         # the UI file loads and its tool registry matches the pages
python tools/build_pages.py        # regenerate web/ from site_content.py
python tools/check_links.py        # every local reference resolves
```

Requires Python 3 and Node. No package installs — pdf-lib and pdf.js are vendored.

## Licence

Published so it can be read. No licence is granted for reuse, and the name and
branding belong to the site's author.
