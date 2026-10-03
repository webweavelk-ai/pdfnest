"""Build tools/_e2e_inject.js — the bootstrap that runs the editor E2E test.

    python tools/make_e2e_inject.py

`tools/editor_e2e.js` has to execute inside the page's own JavaScript world,
because it reaches for window.PDFLib, window.pdfjsLib and window.PDFStudioEditor.
A debugger/console evaluate may run in an isolated world where none of those
exist, which is exactly how the first run failed. A <script> element appended to
the document always executes in the page world, so this wraps the test source in
one and leaves it to be evaluated.

Written as a generator rather than a shell one-liner on purpose: passing a 17 KB
JavaScript source through `node -e "..."` on PowerShell 5.1 mangles the inner
quotes (and dropped a byte-exact copy the first time). json.dumps produces a
valid JavaScript string literal, so nothing has to be escaped by hand.
"""

from __future__ import annotations

import json
from pathlib import Path

HERE = Path(__file__).resolve().parent
SOURCE = HERE / "editor_e2e.js"
TARGET = HERE / "_e2e_inject.js"

src = SOURCE.read_text(encoding="utf-8")
bootstrap = (
    "(function(){var e=document.createElement('script');e.textContent="
    + json.dumps(src)
    + ";document.head.appendChild(e);return 'injected';})()"
)
TARGET.write_text(bootstrap, encoding="utf-8")
print(f"wrote {TARGET.name} ({len(bootstrap):,} bytes) from {SOURCE.name} ({len(src):,} bytes)")
