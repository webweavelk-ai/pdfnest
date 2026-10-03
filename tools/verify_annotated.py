"""Verify an annotated PDF with PyMuPDF — a different library from the one that wrote it.

    node tools/test_engine.js          # writes tools/fixtures/out-annotated.pdf
    python tools/verify_annotated.py   # checks it independently

pdf-lib can write content but cannot read text back out, so the Node suite can
only assert that annotatePdf did not crash and did not lose pages. This script
opens the same file with PyMuPDF and checks that the text, images, boxes and page
numbers are actually present, actually on the right pages, and actually near the
coordinates they were asked for. If my coordinate maths were wrong, this would
catch it and the Node suite would not.

It also checks the honest limitation: a white-out box does NOT remove the text
underneath it, and this script proves it rather than leaving it as a claim.
"""

from __future__ import annotations

import sys
from pathlib import Path

import fitz

FIX = Path(__file__).resolve().parent / "fixtures"
TARGET = FIX / "out-annotated.pdf"

if not TARGET.exists():
    sys.exit(f"missing {TARGET} — run: node tools/test_engine.js")

failures = 0
checks = 0


def check(label: str, ok: bool, detail: str = "") -> None:
    global failures, checks
    checks += 1
    if not ok:
        failures += 1
    print(f"{'PASS  ' if ok else 'FAIL  '}{label}" + (f"  -> {detail}" if detail else ""))


doc = fitz.open(TARGET)
check("opens as a PDF with 3 pages", doc.page_count == 3, f"{doc.page_count} pages")
W, H = doc[0].rect.width, doc[0].rect.height
print(f"      page box {W:.0f} x {H:.0f} pt")
print()

# ------------------------------------------------------------------ text items

hits = doc[0].search_for("APPROVED BY TEST")
check("the placed text is present on page 1", len(hits) == 1, f"{len(hits)} match(es)")
if hits:
    r = hits[0]
    # Was asked for x=60, y=140 measured from the top, at 18pt.
    check("it landed near the requested position",
          50 <= r.x0 <= 80 and 118 <= r.y0 <= 175,
          f"asked x=60 y=140 -> found x={r.x0:.1f} y={r.y0:.1f}")

p2 = doc[1].get_text()
check("the two-line text box kept both lines", "line one" in p2 and "line two" in p2,
      "line one" in p2 and "line two" in p2)
l1 = doc[1].search_for("line one")
l2 = doc[1].search_for("line two")
if l1 and l2:
    gap = l2[0].y0 - l1[0].y0
    check("the second line sits below the first", gap > 0, f"gap {gap:.1f} pt for 12pt text")

# --------------------------------------------------------------- page numbers

nums = []
for i in range(3):
    found = doc[i].search_for(f"{i + 1} / 3")
    nums.append(bool(found))
check("page numbers appear on all 3 pages", all(nums), f"{nums}")

# -------------------------------------------------------------------- watermark

wm = [bool(doc[i].search_for("DRAFT")) for i in range(3)]
check("the watermark appears on all 3 pages", all(wm), f"{wm}")

# ----------------------------------------------------------------------- images

imgs = doc[2].get_images(full=True)
check("the stamp image is embedded on page 3", len(imgs) == 1, f"{len(imgs)} image(s)")
if imgs:
    info = doc.extract_image(imgs[0][0])
    check("the embedded image is a valid PNG", info["ext"] == "png",
          f"ext={info['ext']} {info['width']}x{info['height']}")

# ------------------------------------------------------------------ white-out box

# PyMuPDF reports everything in its own top-left origin frame, which is the same
# frame the annotator is given its coordinates in — so the box asked for at
# x=220, y=300 (180x40 pt from the top) should come back at roughly y0=300.
candidates = []
box = None
for d in doc[0].get_drawings():
    r = d["rect"]
    if abs(r.x0 - 220) < 6 and abs(r.y0 - 300) < 8 and abs(r.width - 180) < 6:
        candidates.append((d.get("fill"), r))
        if d.get("fill"):
            box = (d.get("fill"), r)
            break
check("the white-out box was drawn at the requested spot", box is not None,
      (f"fill={box[0]} rect=({box[1].x0:.0f},{box[1].y0:.0f},{box[1].width:.0f}x{box[1].height:.0f})"
       if box else f"no matching drawing; candidates={[(c[0], (round(c[1].x0), round(c[1].y0))) for c in candidates]}"))
if box:
    check("the box is the requested size", abs(box[1].width - 180) < 4 and abs(box[1].height - 40) < 4,
          f"{box[1].width:.0f} x {box[1].height:.0f} pt, asked 180 x 40")

# ------------------------------------------------- the honest limitation, proven

under = doc[0].get_text("words")
covered = [w for w in under if 220 <= w[0] <= 400 and 300 <= w[1] <= 340]
check("text UNDER the white-out box is still extractable (it is hidden, not removed)",
      len(covered) > 0,
      f"{len(covered)} word(s) still readable under the box, e.g. "
      + (" ".join(w[4] for w in covered[:6]) if covered else "none"))

# -------------------------------------------------- original content is intact

kept = doc[0].search_for("Quarterly Report")
check("the original document text was not damaged", len(kept) > 0,
      f"{len(kept)} match(es) for the original heading")

print()
print("=" * 58)
print(f"{checks - failures}/{checks} checks passed")
if failures:
    print(f"{failures} FAILED")
    sys.exit(1)
print("All annotation checks passed.")
