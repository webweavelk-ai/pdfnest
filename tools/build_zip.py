"""Package web/ into a deploy-ready zip for Cloudflare Pages.

    python tools/build_zip.py

Windows' Compress-Archive writes backslash entry names ("assets\\app.js"), which
some extractors treat as literal filenames rather than folders. Python's zipfile
always writes forward slashes, so the archive is portable.
"""

from __future__ import annotations

import sys
import zipfile
from pathlib import Path

import site_content as C

ROOT = Path(__file__).resolve().parents[1]
WEB = ROOT / "web"
OUT = ROOT / "pdfnest-site.zip"

# Files that must exist at the root of the archive for Pages to serve the site.
# The IndexNow key file is in the list because a key that does not ship is a key
# the search engines cannot verify, and the failure would be silent.
REQUIRED_AT_ROOT = {"index.html", "404.html", "robots.txt", "sitemap.xml", "_headers",
                    f"{C.INDEXNOW_KEY}.txt"}

SKIP = {"_zipstage"}

if not WEB.is_dir():
    sys.exit(f"web/ not found at {WEB}")

files = [
    p for p in sorted(WEB.rglob("*"))
    if p.is_file() and not any(part in SKIP for part in p.relative_to(WEB).parts)
]

if OUT.exists():
    OUT.unlink()

with zipfile.ZipFile(OUT, "w", zipfile.ZIP_DEFLATED) as zf:
    for path in files:
        zf.write(path, arcname=path.relative_to(WEB).as_posix())

with zipfile.ZipFile(OUT) as zf:
    names = zf.namelist()

backslashes = [n for n in names if "\\" in n]
roots = {n for n in names if "/" not in n}

print(f"{OUT.name}  {OUT.stat().st_size / 1024:.0f} KB  ({len(names)} entries)")
for n in names:
    if "/" not in n:
        print("  " + n)
print(f"  + {len(names) - len(roots)} files under assets/ and the tool folders")

errors = []
if backslashes:
    errors.append(f"backslash entry names present: {backslashes[:3]}")
missing = REQUIRED_AT_ROOT - roots
if missing:
    errors.append(f"missing at archive root: {sorted(missing)}")
if not any(n.startswith("assets/vendor/pdf-lib.min.js") for n in names):
    errors.append("vendor bundle is not inside the archive")

if errors:
    print("\nFAILED:")
    for e in errors:
        print("  " + e)
    sys.exit(1)

print("\nOK — forward-slash paths, root-level index.html, vendor bundle included.")
print("Upload this zip (or drag the web/ folder) at: Workers & Pages -> pdfnest -> Create new deployment")
