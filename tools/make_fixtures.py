"""Create the sample files used by tools/test_engine.js.

    python tools/make_fixtures.py

Writes tools/fixtures/{a.pdf, b.pdf, img.png, img.jpg}.
"""

from pathlib import Path

import fitz

OUT = Path(__file__).resolve().parent / "fixtures"
OUT.mkdir(parents=True, exist_ok=True)


def make_pdf(name: str, pages: int) -> None:
    doc = fitz.open()
    for i in range(pages):
        page = doc.new_page()
        page.insert_text((72, 96), f"{name} page {i + 1}", fontsize=22)
        page.draw_rect(fitz.Rect(72, 140, 320, 260), color=(0, 0.4, 0.9), width=2)
    doc.save(OUT / name)
    doc.close()
    print("wrote", OUT / name)


def make_image(ext: str) -> None:
    doc = fitz.open()
    page = doc.new_page(width=200, height=140)
    page.draw_rect(fitz.Rect(10, 10, 190, 130), color=(0.9, 0.2, 0.3), fill=(1, 0.92, 0.94))
    pix = page.get_pixmap(dpi=96)
    target = OUT / f"img.{ext}"
    target.write_bytes(pix.tobytes("jpeg" if ext == "jpg" else "png"))
    doc.close()
    print("wrote", target)


def make_report(name: str, pages: int) -> None:
    """A realistic text document — the case where lossless compression has almost
    nothing left to remove."""
    doc = fitz.open()
    for i in range(pages):
        page = doc.new_page()
        page.insert_text((72, 90), f"Quarterly Report - Section {i + 1}", fontsize=20)
        line = ("This page exists so the tools can be exercised on a document that is mostly "
                "text, which is the case where lossless compression has very little to remove.")
        y = 130
        for _ in range(30):
            page.insert_text((72, y), line[:96], fontsize=9)
            y += 13
        page.draw_line(fitz.Point(72, y + 10), fitz.Point(523, y + 10), color=(0.6, 0.6, 0.6))
    doc.save(OUT / name)
    doc.close()
    print("wrote", OUT / name)


def noise_png(w: int, h: int, seed: int) -> bytes:
    """A PNG of pure random noise, built by hand.

    Random noise is incompressible, so the PNG stays around w*h*3 bytes — which is
    what makes the resulting PDF a fair, genuinely large test for compression.
    Written directly with zlib/struct because this PyMuPDF build will not accept
    raw samples in its Pixmap constructor.
    """
    import random
    import struct
    import zlib

    rnd = random.Random(seed)
    raw = bytearray()
    for _ in range(h):
        raw.append(0)  # PNG filter type 0 (None) for each scanline
        raw += rnd.randbytes(w * 3)

    def chunk(tag: bytes, data: bytes) -> bytes:
        return (struct.pack(">I", len(data)) + tag + data
                + struct.pack(">I", zlib.crc32(tag + data) & 0xFFFFFFFF))

    ihdr = struct.pack(">IIBBBBB", w, h, 8, 2, 0, 0, 0)  # 8-bit truecolour RGB
    return (b"\x89PNG\r\n\x1a\n" + chunk(b"IHDR", ihdr)
            + chunk(b"IDAT", zlib.compress(bytes(raw), 6)) + chunk(b"IEND", b""))


def make_scan(name: str, pages: int) -> None:
    """An image-heavy 'scan' — the case where compression has something to win."""
    doc = fitz.open()
    for i in range(pages):
        page = doc.new_page()
        page.insert_image(page.rect, stream=noise_png(1200, 900, 100 + i))
    doc.save(OUT / name)
    doc.close()
    print("wrote", OUT / name)


def make_order(name: str) -> None:
    """Three square pages of DIFFERENT sizes.

    The page organiser has to be provably correct about order, and a PDF has no
    page numbers to read back. Different page boxes give the test something
    measurable: reorder the pages and the widths should follow.
    """
    doc = fitz.open()
    for side in (400, 500, 600):
        page = doc.new_page(width=side, height=side)
        page.insert_text((40, 60), f"{side} x {side}", fontsize=18)
    doc.save(OUT / name)
    doc.close()
    print("wrote", OUT / name)


make_pdf("a.pdf", 1)
make_pdf("b.pdf", 2)
make_report("report.pdf", 3)
make_order("order.pdf")
make_scan("scan.pdf", 2)
make_image("png")
make_image("jpg")

for f in sorted(OUT.iterdir()):
    print(f"  {f.name:14} {f.stat().st_size:>9,} bytes")
print("fixtures ready")
