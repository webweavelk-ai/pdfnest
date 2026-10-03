"""Check that every local asset and internal link in web/ actually resolves.

    python tools/check_links.py

Catches the classic deployment failures: a missing vendor file, a stylesheet
path that is wrong from a subdirectory, a link to a page that was never built.
"""

from __future__ import annotations

import re
import sys
from pathlib import Path

WEB = Path(__file__).resolve().parents[1] / "web"
ATTR = re.compile(r'(?:src|href)="([^"]+)"')
# Drop inline <script> bodies but keep the opening tag, so a src="..." on the tag
# is still checked while JS string literals (which look like src="..." too) are not.
INLINE_JS = re.compile(r"(<script\b[^>]*>)(.*?)(</script>)", re.S | re.I)

missing: list[str] = []
checked = 0
pages = sorted(WEB.rglob("*.html"))

for page in pages:
    base = page.parent
    source = page.read_text(encoding="utf-8")
    source = INLINE_JS.sub(lambda m: m.group(1) + m.group(3), source)
    for ref in ATTR.findall(source):
        if ref.startswith(("http://", "https://", "mailto:", "#", "data:")):
            continue
        clean = ref.split("#")[0].split("?")[0]
        # A leading "/" is site-root-relative, not filesystem-absolute.
        target = (WEB / clean.lstrip("/") if clean.startswith("/") else base / clean).resolve()
        checked += 1
        if not target.exists():
            missing.append(f"{page.relative_to(WEB)}  ->  {ref}")

print(f"Scanned {len(pages)} pages, {checked} local references.")

if missing:
    print(f"\n{len(missing)} BROKEN reference(s):")
    for m in missing:
        print("  " + m)
    sys.exit(1)

# A quick sanity check that the vendor bundle is complete and non-trivial.
vendor = WEB / "assets" / "vendor"
required = {"pdf-lib.min.js": 300_000, "pdf.min.js": 200_000, "pdf.worker.min.js": 500_000, "jszip.min.js": 50_000}
problems = []
for name, minimum in required.items():
    f = vendor / name
    if not f.exists():
        problems.append(f"missing {name}")
    elif f.stat().st_size < minimum:
        problems.append(f"{name} looks truncated ({f.stat().st_size} bytes, expected > {minimum})")

for required_file in ("sitemap.xml", "robots.txt", "404.html", "_headers"):
    if not (WEB / required_file).exists():
        problems.append(f"missing {required_file}")

if problems:
    print("\nVendor / support file problems:")
    for p in problems:
        print("  " + p)
    sys.exit(1)

print("All local references resolve and the vendor bundle is complete.")
