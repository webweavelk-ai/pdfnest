"""All site copy in one place.

`build_pages.py` renders this into HTML. Edit the strings here, then run
`python tools/build_pages.py` and redeploy.

Keyword notes
-------------
Search volume and difficulty are deliberately NOT recorded anywhere in this file.
No keyword data source (Semrush / Ahrefs / DataForSEO / Moz / Google Ads) is
configured, so those numbers were never measured — and inventing them would be
worse than omitting them. What each page does carry is a **primary keyword**, the
**secondary variants** it also answers, and the **intent** it targets. One primary
keyword per page, so two pages never compete for the same query.

Intent is the part that can be reasoned about honestly from the query wording
alone: "merge pdf" is transactional (someone wants the job done now), while
"how to merge pdf files" is informational (someone wants to learn). Transactional
queries belong on tool pages, informational ones on /guides/ pages.
"""

from __future__ import annotations

SITE_URL = "https://pdfnest.pages.dev"
SITE_NAME = "PDF Nest"
BRAND_HTML = "PDF <span>Nest</span>"
TAGLINE = "Free PDF tools that never upload your files"

# IndexNow: proves we own the host, so Bing, Yandex and the engines that share
# their index can be told about a URL the moment it exists instead of waiting to
# be crawled. The key is written to web/<key>.txt by build_pages.py and posted by
# tools/ping_indexnow.py. It is public by design — it is not a secret, it is a
# claim of ownership, so it lives here with the rest of the site's constants.
# Google does not participate in IndexNow; nothing here affects Google.
INDEXNOW_KEY = "8f3c1d94a6b27e50fd6714c2ab90e38d"

# --------------------------------------------------------------------------
# Tool pages — transactional intent. Each has exactly one primary keyword.
# --------------------------------------------------------------------------

TOOLS = [
    {
        "slug": "merge-pdf",
        "nav": "Merge PDF",
        "card": "Combine several PDFs into one file, in the order you choose.",
        "h1": "Merge PDF files",
        "primary": "merge pdf",
        "secondary": ["combine pdf files", "join pdf files", "merge pdf online free", "merge multiple pdfs"],
        "title": "Merge PDF Files Online — Free, Fast, No Upload Needed",
        "desc": "Combine several PDF files into one document in your browser. No upload, no signup, no watermark, no page limit. Works offline once the page has loaded.",
        "lede": "Drop two or more PDFs and get a single document back, with the pages in exactly the order you arranged them. The merging happens on your own device, so your files never travel to a server.",
        "steps": [
            ("Add your PDFs", "Drag the files onto the box, or click it to browse. Add them one at a time or all at once."),
            ("Fix the order", "Files merge top to bottom. Remove any file with the remove button if you picked the wrong one."),
            ("Merge and download", "Press Process. The merged PDF downloads straight from your browser — usually in well under a second."),
        ],
        "sections": [
            ("What merging does and does not change", [
                "Pages are copied across as vector data, so text stays selectable, images keep their original resolution and file sizes stay close to the sum of the inputs. Bookmarks, internal links and annotations are preserved. Interactive form fields keep their values only where field names do not clash between documents — if two PDFs both contain a field called \"Name\", the second document's value is dropped.",
            ]),
            ("When to merge rather than keep files separate", [
                "Merging is the right move for anything you will submit as a unit: a signed contract with its annexes, an expenses claim with receipts behind it, a portfolio where each project is a chapter, or a scanned set of pages that a scanner produced as twenty separate files. It is the wrong move when the documents have different audiences or different retention rules — merge those only at the moment you send them.",
                "If you need only some of the pages from each document, split first and merge second. The Split tool extracts the pages you list, and the Merge tool then puts them in your chosen order.",
            ]),
            ("Merging a lot of files at once", [
                "There is no fixed limit on how many PDFs you can merge — the ceiling is your own device's memory. A few dozen normal documents is comfortable on a laptop. If you are merging hundreds of scanned files, do it in batches of twenty to fifty and merge the results afterwards.",
            ]),
        ],
        "faq": [
            ("Are my files uploaded anywhere?", "No. There is no server involved. Your browser reads the files, joins them in memory and hands you the result. You can disconnect from the internet after the page has loaded and it will still work — you can verify this in your browser's network tab while a merge runs."),
            ("Is there a limit on how many PDFs I can merge?", "No fixed limit. The practical ceiling is your device memory, and batches up to a few dozen normal documents are fine."),
            ("Do bookmarks and form fields survive the merge?", "Page content, links and annotations are preserved. Interactive form fields keep their values only where the field names do not clash between documents."),
            ("Can I merge password-protected PDFs?", "Files with an open password must be unlocked first, because they cannot be read without it. Owner-password files that only restrict editing are processed normally."),
            ("Can I change the page order after merging?", "Not in this tool — the merge is a one-shot operation. Arrange the file order before pressing Process, or merge again from the originals. If you only need to reorder pages within one document, split it, then merge the resulting pages back in the order you want."),
            ("Does merging reduce quality?", "No. Pages are copied as-is rather than rendered and re-encoded, so there is no loss of resolution or text quality."),
        ],
        "guides": ["merge-pdf-on-iphone-android-windows"],
    },
    {
        "slug": "split-pdf",
        "nav": "Split PDF",
        "card": "Break one PDF into separate files, or pull out only the pages you need.",
        "h1": "Split PDF files",
        "primary": "split pdf",
        "secondary": ["extract pages from pdf", "separate pdf pages", "pdf page extractor", "split pdf into multiple files"],
        "title": "Split PDF Online — Extract Pages Free, Right in Your Browser",
        "desc": "Split a PDF into separate pages or extract exactly the page ranges you type. Runs entirely in your browser — nothing is uploaded, no signup, no watermark.",
        "lede": "Turn a long PDF into individual files, or pull out just the pages you need. Everything is extracted on your device and delivered as a ZIP.",
        "steps": [
            ("Add the PDF", "Drop the document you want to split. Only one file is needed."),
            ("Choose what to extract", "Every page produces one PDF per page. Or pick ranges and type them like 1-3,5,8-10."),
            ("Download the ZIP", "You get a ZIP containing one PDF per page or per range, named after the original file."),
        ],
        "sections": [
            ("Page range syntax", [
                "Ranges are typed with commas and hyphens. 1-3,5,8-10 gives you pages 1, 2, 3, 5, 8, 9 and 10. A range may also run backwards — 9-6 gives you 9, 8, 7, 6 in that order. Leaving one side open means \"to the start\" or \"to the end\": 2- is page 2 onwards, and -5 is the first five pages. Each range becomes its own PDF in the ZIP, so 1-10,11-20,21-30 produces three files of ten pages each rather than thirty single-page files.",
            ]),
            ("Extracting pages versus splitting everything", [
                "Choosing \"every page\" is what you want when you are breaking a scan into individual documents, or when you need to attach one specific page to an email. Choosing custom ranges is better when the document has logical sections — a report with chapters, a contract with appendices, or a proof-of-payment that lives on page 4 of a bank statement.",
                "If your goal is to remove pages rather than keep them, list everything except the pages you want to drop. To keep pages 1, 2 and 6 to the end of a twelve-page file, type 1,2,6-12 and merge the result.",
            ]),
            ("What the output looks like", [
                "Every file is named after the original document with its page number appended, so sample.pdf becomes sample_p001.pdf and so on. Page numbers are padded to three digits so that a ZIP listing sorts in the right order. Nothing is re-encoded, so the split files are exact copies of the original pages at full quality.",
            ]),
        ],
        "faq": [
            ("What page range syntax works?", "Use commas and hyphens: 1-3,5,8-10 gives you pages 1, 2, 3, 5, 8, 9 and 10. Reverse ranges like 9-6 are allowed, and an open range such as 2- means page 2 to the end."),
            ("Can I split a PDF into files with several pages each?", "Yes — enter ranges such as 1-10,11-20,21-30 and each range becomes its own PDF in the ZIP."),
            ("Is there a page limit?", "No server-side limit. Very large documents are bounded only by your device's memory; a few hundred pages is comfortable on a modern machine."),
            ("Do the split files keep the original quality?", "Yes. Pages are copied across as vector data, so text stays selectable and images keep their original resolution."),
            ("Why does the download arrive as a ZIP?", "Because splitting nearly always produces more than one file. Bundling them in a ZIP means one download instead of dozens, and your browser does not have to ask for permission to save each one."),
            ("Can I split a password-protected PDF?", "Only after removing the open password, since the pages cannot be read without it. A document that merely restricts editing will split normally."),
        ],
        "guides": [],
    },
    {
        "slug": "compress-pdf",
        "nav": "Compress PDF",
        "card": "Cut file size for email and upload limits — three levels of compression.",
        "h1": "Compress PDF files",
        "primary": "compress pdf",
        "secondary": ["reduce pdf file size", "pdf compressor", "make pdf smaller", "compress pdf for email"],
        "title": "Compress PDF Online — Reduce File Size Free, No Upload",
        "desc": "Shrink a PDF for email and upload limits with three compression levels. Free, browser-based, no upload and no watermark. Text stays selectable where possible.",
        "lede": "Bring a PDF under an upload limit without sending it to anyone. Three levels let you choose between keeping text selectable and squeezing out the smallest possible file.",
        "steps": [
            ("Add the PDF", "Drop the oversized document onto the box."),
            ("Pick a level", "Light keeps text selectable. Recommended tries both approaches and keeps whichever is smaller. Strong gives the smallest file but turns each page into an image."),
            ("Download", "You are told exactly how much smaller the file got. If it could not be shrunk, you receive the original unchanged rather than a bigger file."),
        ],
        "sections": [
            ("Which compression level to choose", [
                "Start with Recommended. It re-saves the file with tighter internal structure first and only falls back to re-rendering the pages if that barely helped, so you usually keep selectable text and still get the size down.",
                "Use Light when the document is mostly text — a contract, a report, an invoice — and you need the words to stay searchable and selectable afterwards. Light is lossless: nothing about the pages changes, only how the file stores them internally.",
                "Use Strong when you are fighting a hard limit and the document only has to be legible. Each page is rendered to an image at 110 dpi and re-embedded as a JPEG, which can cut a scan to a fraction of its original size. The trade-off is real: text stops being selectable, searchable or copyable, and fine print may soften. Never use Strong on a document that someone has to read on screen at low zoom, and never on a file that must remain accessible to a screen reader.",
            ]),
            ("Why a PDF is large in the first place", [
                "Almost always images. A single A4 page scanned at 600 dpi as an uncompressed bitmap is around 50 MB on its own; the same page at 300 dpi as a JPEG is a few hundred kilobytes. Text, by contrast, is tiny — the entire text of a 300-page novel is well under a megabyte.",
                "That is why scanned documents shrink so dramatically and text documents barely move. If your PDF is mostly words and the compressor only shaved a few percent off, the file was already efficient and there is very little left to remove.",
            ]),
            ("Hitting a specific upload limit", [
                "If a portal enforces a limit such as 100 KB, 500 KB or 2 MB, start with Strong and check the reported result. If it is still too big, the cause is almost always image resolution that is far higher than the document needs. Converting the pages to images at a lower resolution is the reliable lever — for a text-only document, going below roughly 100 dpi starts to make the letters ragged.",
                "Remember that a PDF can also be split. Two files of 900 KB both fit under a 1 MB limit where one 1.8 MB file does not.",
            ]),
        ],
        "faq": [
            ("Which level should I choose?", "Start with Recommended. Use Light when the document is mostly text and you need it selectable, and Strong when you are fighting a hard size limit and can accept pages as images."),
            ("Why did my file barely change?", "Scanned and image-heavy documents compress well; PDFs that are already optimised, or that contain modern compressed streams, have almost nothing left to remove. The tool tells you honestly when that happens."),
            ("Does compressing reduce quality?", "Light and Recommended keep the original page content intact. Strong re-renders each page, which reduces image sharpness and makes text non-selectable."),
            ("Is there a file size limit?", "No artificial limit. Very large files depend on your device memory — around 150 MB is a sensible ceiling for most browsers."),
            ("Will compression remove my bookmarks or links?", "No. Structural re-saving preserves bookmarks, links and annotations. The Strong level replaces page content with images, so any links drawn on the page stop being clickable, but the document structure survives."),
            ("What is the smallest a PDF can get?", "For a text-only document, usually not much below what Light achieves — the content itself is already small. For scans, the floor is the size of the images you are willing to accept, which is why Strong can often get a scan below 10% of the original."),
        ],
        "guides": ["how-to-reduce-pdf-file-size"],
    },
]
TOOLS += [
    {
        "slug": "rotate-pdf",
        "nav": "Rotate",
        "card": "Fix sideways or upside-down scans, for all pages or a few.",
        "h1": "Rotate PDF pages",
        "primary": "rotate pdf",
        "secondary": ["turn pdf pages", "fix sideways pdf", "rotate pdf online", "rotate one page of a pdf"],
        "title": "Rotate PDF Online — Fix Sideways Pages Free, No Upload",
        "desc": "Rotate every page or just the pages you list, by 90, 180 or 270 degrees. Browser-based, free, lossless, and nothing is uploaded.",
        "lede": "Scanned a stack of paper upside down? Rotate the whole document, or only the pages that came out wrong, without touching the originals.",
        "steps": [
            ("Add the PDF", "Drop the file with the misaligned pages."),
            ("Choose the angle and pages", "90, 180 or 270 degrees, applied to every page or only to a list like 1,4,7."),
            ("Download", "The rotation is written into the page data, so every viewer and printer respects it."),
        ],
        "sections": [
            ("Why the fix survives every viewer", [
                "Rotation is stored as a flag on the page itself rather than by rewriting the page contents. That means the change is lossless — no image is re-rendered, no text is re-flowed — and it is respected by every viewer, printer and phone that opens the file afterwards. It also means the file gets smaller rather than larger, since only a few bytes change.",
                "The page's physical dimensions do not change. A portrait A4 page stays A4; only its viewing orientation is updated, which is exactly how PDF rotation is meant to work. This matters for printing: a rotated page goes to the printer in the orientation you see on screen.",
            ]),
            ("Fixing a mixed-up scan", [
                "The usual cause is a duplex scanner that fed a stack in the wrong order, producing a document where every second page is upside down. Type the even pages into the Pages field, apply 180 degrees, and the whole document reads correctly. You can also run the tool twice — once on 90 degrees, once on 270 — to confirm that the operation is fully reversible.",
                "For rotated phone photos that were embedded into a PDF, the same applies: the page flag is what viewers obey, so a 90 degree rotation will display correctly even though the embedded image data is untouched.",
            ]),
        ],
        "faq": [
            ("Does this change the page dimensions?", "No. The page box stays the same size and the viewing rotation flag changes instead. That is how PDF rotation is meant to work, and it keeps the file small."),
            ("Can I rotate only the pages that are sideways?", "Yes. Type the page numbers into the Pages field, for example 2,5,9-11. Leave it as all to rotate everything."),
            ("How do I undo a rotation?", "Rotate by 270 degrees to cancel a 90 degree rotation. The operation is lossless, so you can run it as many times as you like."),
            ("Will it work on scanned documents?", "Yes. Scanned pages are rotated just like vector pages, with no re-encoding and no quality loss."),
            ("Does rotation affect the text layer?", "No. Text stays selectable and searchable, because the underlying page content is untouched."),
        ],
        "guides": [],
    },
    {
        "slug": "pdf-to-images",
        "nav": "PDF to Images",
        "card": "Export every page as a PNG or JPG, delivered as a ZIP.",
        "h1": "Convert PDF to images",
        "primary": "pdf to image",
        "secondary": ["pdf to jpg", "pdf to png", "convert pdf to image", "pdf page to picture"],
        "title": "PDF to PNG or JPG — Free Online Converter, No Upload",
        "desc": "Convert each PDF page into a PNG or JPG image at up to 300 dpi. Runs in your browser — no upload, no signup, no watermark, no page limit.",
        "lede": "Turn pages into images for slides, thumbnails or previews. Choose the resolution you actually need instead of receiving a fixed output size.",
        "steps": [
            ("Add the PDF", "Drop the document you want to convert."),
            ("Choose format and resolution", "PNG for crisp lines and screenshots, JPG for photographs and smaller files. 96 dpi suits screens, 300 dpi suits print."),
            ("Download the ZIP", "Every page arrives as a separate image, numbered in page order."),
        ],
        "sections": [
            ("Choosing a resolution that makes sense", [
                "dpi here means the resolution the page is rendered at relative to its printed size. A 96 dpi render of an A4 page is about 794 by 1123 pixels, which is right for a web preview or a thumbnail. 150 dpi is the comfortable middle ground for documents you will read on screen or drop into a slide. 300 dpi produces roughly 2480 by 3508 pixels and is the usual requirement for anything going to print.",
                "Higher is not automatically better. A 300 dpi render of a 40-page report produces a ZIP of well over a hundred megabytes and takes noticeably longer, when 150 dpi would have looked identical on the screen you are viewing it on. Pick the resolution from where the image is going, not from a habit.",
            ]),
            ("PNG or JPG", [
                "PNG is lossless and keeps sharp edges, so it is the better choice for pages that are mostly text, tables, diagrams or screenshots. It also supports transparency, although a rendered page is filled with white because paper is white.",
                "JPG is much smaller for photographic content — scanned documents, brochures, pages with full-page images — because it discards detail the eye does not notice. The trade-off is ringing around sharp text. For a page of body text, JPG at 150 dpi will look visibly softer than PNG when you zoom in.",
            ]),
            ("What the output is useful for", [
                "Common uses are embedding a page in a slide deck or a Notion page, generating a thumbnail for a file listing, sending a single page to someone over a messaging app that mangles PDFs, publishing a preview of a document you do not want to distribute in full, and feeding pages into OCR or image tools that do not accept PDFs.",
                "If you only need one page, split the PDF first with the Split tool, then convert that single page — the conversion itself always exports the whole document so that the file naming stays predictable.",
            ]),
        ],
        "faq": [
            ("PNG or JPG — which should I pick?", "PNG is lossless and best for text, diagrams and screenshots. JPG produces much smaller files and is a better fit for scans and photographs."),
            ("What resolution do I need?", "96 dpi is fine for on-screen previews, 150 dpi covers most documents, and 300 dpi is the usual requirement for print."),
            ("Can I convert just one page?", "The tool exports every page, which keeps the naming predictable. Split the PDF first to get a single page, or delete the images you do not need from the ZIP afterwards."),
            ("Are the images watermarked?", "No. There are no watermarks and no branding on any output."),
            ("Will the images keep their quality?", "Pages are rendered directly from the PDF at the resolution you select, so quality is determined by your choice of dpi rather than by any additional re-compression."),
            ("Why is my ZIP so large?", "Because resolution multiplies fast. Doubling the dpi quadruples the number of pixels. A 40-page document at 300 dpi is genuinely a very large download — 150 dpi is usually the better trade."),
        ],
        "guides": [],
    },
    {
        "slug": "images-to-pdf",
        "nav": "Images to PDF",
        "card": "Turn JPG, PNG or WEBP images into a single PDF document.",
        "h1": "Convert images to PDF",
        "primary": "images to pdf",
        "secondary": ["jpg to pdf", "png to pdf", "combine photos into pdf", "photo to pdf converter"],
        "title": "Images to PDF — JPG, PNG, WEBP to PDF Free, No Upload",
        "desc": "Combine JPG, PNG and WEBP images into one PDF. Browser-based, free, no upload and no watermark. Each image becomes one full page.",
        "lede": "Turn a folder of photos or scans into a single tidy PDF. Each image becomes one page, sized to match the image itself.",
        "steps": [
            ("Add your images", "Drop JPG, PNG or WEBP files. They are added in the order you pick them."),
            ("Check the order", "Pages follow the list order. Remove anything you added by mistake."),
            ("Create the PDF", "One page per image is created, sized to the image dimensions in points."),
        ],
        "sections": [
            ("How page size is decided", [
                "Each image becomes its own page, sized to the image's own proportions and scaled from pixels to PDF points at 72 points per inch. Nothing is cropped, nothing is letterboxed onto an A4 sheet, and no white margin is added. That keeps receipts, tickets, screenshots and phone photos at their natural aspect ratio.",
                "The practical consequence is that a mixed set produces mixed page sizes within one document. Most viewers and printers handle that without complaint, but if you need every page to be A4 — for example when submitting to a portal that enforces a paper size — convert the images to A4 in an image editor first, since this tool deliberately does not invent margins or padding.",
            ]),
            ("Making a document out of photos", [
                "The far and away most common use is turning phone photos of paperwork into a single PDF: a stack of receipts for expenses, pages of a signed form, a passport, a handwritten inventory, or a whiteboard after a workshop. Photograph each item straight-on with even lighting, crop any desk visible around the edges, then add them here in the order you want.",
                "Because WEBP, GIF and BMP cannot be embedded into a PDF directly, those formats are drawn onto a canvas and re-encoded as JPEG automatically. That is lossless for nothing, but it is the only way to get a format the PDF specification actually supports.",
            ]),
            ("Keeping the file small", [
                "A PDF made from photos is as large as the photos themselves. A modern phone camera produces 3 to 6 MB per shot, so forty photos make a 150 MB PDF that no email service will accept. Either choose a smaller export size in your phone's camera settings, resize the images before adding them, or run the finished PDF through the Compress tool and pick the Strong level.",
            ]),
        ],
        "faq": [
            ("Which formats are supported?", "JPG, PNG and WEBP natively. Other formats the browser can decode, such as GIF and BMP, are converted to JPEG automatically."),
            ("Can I change the page size or add margins?", "Pages are created at the exact pixel dimensions of each image, with no added margins or padding. That keeps scans and receipts predictable when printing."),
            ("Is there a limit on the number of images?", "No fixed limit. Large photo sets depend on your device memory, so a few hundred images at phone resolution is a reasonable ceiling."),
            ("Will my iPhone HEIC photos work?", "Safari can decode HEIC, so the automatic JPEG conversion handles them there. If your browser cannot decode HEIC, export the photos as JPG first."),
            ("Does the image quality change?", "JPG and PNG images are embedded as-is with no re-encoding. Only formats the PDF format cannot hold — WEBP, GIF, BMP — are converted, and those go through a canvas as high-quality JPEG."),
            ("Can I rotate an image before adding it?", "Rotate it in your phone's or computer's photo viewer first. The tool deliberately does not re-encode the images it embeds, so rotation is not offered here — use the Rotate PDF tool afterwards instead if the finished document needs it."),
        ],
        "guides": [],
    },
]

# --------------------------------------------------------------------------
# Guide pages — informational intent. These target "how do I..." queries and
# link down to the matching tool page, so the two never compete for the same
# keyword.
# --------------------------------------------------------------------------

GUIDES = [
    {
        "slug": "how-to-reduce-pdf-file-size",
        "nav": "Reduce PDF size",
        "card": "Why PDFs get big, and five ways to make one small enough to send.",
        "h1": "How to reduce a PDF file size",
        "primary": "how to reduce pdf file size",
        "secondary": ["pdf too large to email", "make pdf smaller", "pdf file size limit"],
        "title": "How to Reduce PDF File Size — 5 Ways, and Which to Use",
        "desc": "Why PDFs get large, five ways to shrink one, and how to hit an exact upload limit. Honest trade-offs on quality, text selectability and accessibility.",
        "lede": "A PDF that will not attach to an email, or that a portal rejects for being over the limit, is one of the most predictable problems in office work. Here is what actually makes a PDF large, and what genuinely works.",
        "tool": "compress-pdf",
        "sections": [
            ("The one thing that makes a PDF large", [
                "Images. A single A4 page scanned at 600 dpi as an uncompressed bitmap is roughly 50 MB. The same page rendered at 300 dpi as a JPEG is a few hundred kilobytes. The entire text of a 300-page novel, by contrast, is well under a megabyte — text costs almost nothing, which is why a long text-only report can be smaller than a two-page photo scan.",
                "So before doing anything, work out which kind of file you have. If it is mostly words, no amount of compression will help much, and the honest answer is that it is already close to as small as it gets. If it came from a scanner or a phone camera, there is usually a great deal of weight to remove.",
            ]),
            ("Five ways to shrink a PDF, in order of how much they help", [
                "1. Re-render the pages as images. This is the big hammer. Each page is drawn at a chosen resolution and re-embedded as a JPEG, which discards the original image data entirely. A 40 MB scan routinely lands between 1 and 4 MB. The cost is that text stops being selectable, searchable and readable by a screen reader, and fine print softens. Use it for documents that only need to look right.",
                "2. Downsample the images without re-rendering the pages. This keeps text as text and reduces only the image resolution, which is what most desktop tools mean by \"compress\". It is the best balance when the document mixes text and photos.",
                "3. Re-save with tighter internal structure. Lossless, invisible, and worth doing first because it costs nothing. It removes duplicate objects, unused resources and metadata, and re-packs the file's internal streams. On an already-efficient file the gain is a few percent; on a file exported from an old application it can be substantial.",
                "4. Remove what you do not need to send. Delete the blank pages, the appendix nobody reads, the embedded fonts for languages the document does not use. Splitting a 2 MB file into two 1 MB files is often the real answer when the limit is 1 MB.",
                "5. Convert the images before they ever reach the PDF. If you are building the document yourself, export the images at the size they will be displayed rather than the size they were photographed. This prevents the problem instead of fixing it.",
            ]),
            ("Hitting an exact limit", [
                "Portals usually enforce a round number — 100 KB, 500 KB, 2 MB, 5 MB. Work backwards from it. If a scan must come in under 500 KB and it is currently 30 MB, the Strong level will get you there and stay legible. If a text-only document must come in under 100 KB and it is 300 KB, compression may not be enough, and splitting it, or removing embedded fonts and images, is the more honest route.",
                "One warning worth taking seriously: re-rendering a document to images makes it unusable for anyone relying on a screen reader, and makes it impossible to search, copy a reference number or fill in a field. If the document has to stay accessible — anything legal, medical, governmental or academic — keep the text as text and accept a larger file.",
            ]),
            ("How to check whether it worked", [
                "Any honest compressor tells you the before and after size, and this one does. If a tool claims success without showing you numbers, you cannot tell whether it did anything at all. It is also worth opening the result to confirm the pages still read correctly, especially after the aggressive level — an over-compressed page is easy to spot at a normal zoom, and much harder to spot in a thumbnail.",
            ]),
        ],
        "faq": [
            ("Why can a 200-page text report be smaller than a 2-page scan?", "Because text is stored as characters and font references, while a scan is stored as an image of the page. A two-page colour scan at high resolution contains far more raw data than 200 pages of words."),
            ("Does compressing a PDF make the text blurry?", "Only if the pages are re-rendered as images. Lossless re-saving and image downsampling leave text perfectly sharp and selectable."),
            ("What is the best setting for emailing a PDF?", "Aim for under 10 MB, which every major provider accepts. For scans that usually means the middle compression level; for text documents, a lossless re-save is normally enough."),
            ("Can I compress a PDF without losing quality at all?", "You can avoid quality loss, but then the reduction is limited to removing redundant internal data. On a file that was already saved efficiently there may be almost nothing to gain."),
            ("Will compressing remove the password on my PDF?", "No. Compression and encryption are separate concerns. A document that is password-protected to open must be unlocked before it can be processed at all."),
        ],
    },
    {
        "slug": "merge-pdf-on-iphone-android-windows",
        "nav": "Merge on any device",
        "card": "How to combine PDFs on a phone, tablet or desktop — without an app.",
        "h1": "How to merge PDF files on iPhone, Android and Windows",
        "primary": "how to merge pdf files",
        "secondary": ["merge pdf on iphone", "merge pdf on android", "combine pdf files on windows"],
        "title": "How to Merge PDF Files on iPhone, Android and Windows",
        "desc": "Combine PDFs on any device without installing an app. Step-by-step for iPhone, Android, Windows, macOS and Chromebook, plus why browser tools avoid the usual pitfalls.",
        "lede": "Merging PDFs should not require a desktop application, a subscription, or uploading a contract to a stranger's server. On any modern device you already have everything you need.",
        "tool": "merge-pdf",
        "sections": [
            ("The general recipe, on every platform", [
                "Open the merge tool in your browser, tap or click the drop area, and select the PDFs you want to combine. Order matters — files are merged in the order you added them, so add them in the sequence you want the final document to read. Then press Process and the merged file arrives as a normal download.",
                "The important difference from most online tools is that nothing is uploaded. The browser reads the files from your device, joins them in memory, and hands the result straight back. That is why there is no queue, no waiting for an upload to finish, and no reason to wonder how long a copy sits on someone else's server.",
            ]),
            ("iPhone and iPad", [
                "In Safari or Chrome, tap the drop area and choose Browse, then pick the PDFs from the Files app. Files stored in iCloud Drive or On My iPhone are both selectable. Because iOS downloads land in the Downloads folder in Files, the merged document is easy to find afterwards, and you can share it straight to Mail, Messages or WhatsApp from there.",
                "If your PDFs are inside another app — a scanned document in Notes, a boarding pass in Wallet — share it to Files first, then add it here. The tool needs to be able to read the file, which means it has to live somewhere the browser can reach.",
            ]),
            ("Android", [
                "Chrome on Android opens the same picker, with Files, Downloads and Google Drive as sources. Long-press to select several files at once, which is much faster than adding them one at a time.",
                "Android's share sheet does not know about browser-based tools, so start from the browser rather than trying to share a PDF into it. Downloads land in the Downloads folder and appear in the notification shade when the merge finishes.",
            ]),
            ("Windows, macOS and Chromebook", [
                "On a desktop this is by far the fastest path: open the tool, drag the files from File Explorer or Finder into the drop area, and click Process. Dragging several files at once is supported, and the list order is the merge order, so you can see exactly what you are about to produce before committing.",
                "On Windows, the Files app and File Explorer both let you select multiple PDFs with Ctrl+click before dragging. On macOS, Command+click does the same in Finder. On a Chromebook, the Files app can drag multiple items into the browser window as well.",
            ]),
            ("What to check before you send it", [
                "Open the merged file and page through it. Two things go wrong most often: the files were added in the wrong order, and one of the source PDFs was itself a scan that came out upside down. The second is easy to fix with the rotate tool, which can rotate every page in a document or only the numbered ones that need it.",
                "If the merged file is too large to attach, compress it rather than splitting it back up — unless the limit is very tight, in which case two smaller files are the more reliable answer.",
            ]),
        ],
        "faq": [
            ("Do I need to install an app?", "No. Any modern browser on any device can do this, and all the processing happens locally, so there is nothing to install and no account to create."),
            ("Does it work on an iPhone?", "Yes. Safari handles it, and the merged file lands in your Files app where you can share it onward."),
            ("Can I merge PDFs on a phone without Wi-Fi?", "Once the page has loaded, yes. The processing happens on the device, so the connection is only needed to load the page itself."),
            ("Is there a limit on how many files I can combine?", "No fixed limit — it depends on the device's memory rather than on any cap in the tool. Combining twenty or thirty normal PDFs on a phone is realistic."),
            ("Why do some tools ask me to upload my files?", "Because they process on a server. That means your document travels over the network, is stored temporarily somewhere you cannot see, and is deleted on a promise you cannot verify. Browser-based processing avoids all of that."),
        ],
    },
]

# --------------------------------------------------------------------------
# Added later: page organiser. Transactional intent, same rules — one primary
# keyword, and it links to the split/merge/rotate tools rather than competing
# with them for the same query.
# --------------------------------------------------------------------------

TOOLS.append({
    "slug": "organize-pdf",
    "nav": "Organise pages",
    "card": "Delete, reorder, rotate and duplicate pages in a visual grid.",
    "h1": "Delete, reorder and rotate PDF pages",
    "primary": "delete pages from pdf",
    "secondary": ["organize pdf", "reorder pdf pages", "remove pages from pdf", "rearrange pdf pages"],
    "title": "Delete Pages From PDF — Reorder, Rotate & Organise Free",
    "desc": "Delete, reorder, rotate and duplicate PDF pages in a visual thumbnail grid. Free, runs in your browser, nothing is uploaded, no signup and no watermark.",
    "lede": "See every page laid out as a thumbnail, then rearrange the document: remove the ones you do not need, put them in a better order, turn the pages that came out sideways, or repeat one. The order you see is the order you get.",
    "steps": [
        ("Add your PDF", "Drop the document. Every page is drawn as a thumbnail, so you can see what you are rearranging rather than working blind."),
        ("Edit the pages", "Use the buttons on a page to move it earlier or later, rotate it a quarter turn, duplicate it or delete it. Tick several pages to act on them together, or use Select all. Undo all puts everything back."),
        ("Process", "The pages are assembled in the order shown and offered as a new download. Your original file on disk is never touched."),
    ],
    "sections": [
        ("How the output is built", [
            "The tool keeps your edits as a list — which source page goes where, and how far it is turned — and only builds a new PDF when you press Process. Pages are copied across as vector data rather than rendered, so this is lossless: text stays selectable and searchable, images keep their full resolution, and links and annotations survive. The only thing that changes is which pages are present and in what order.",
            "Because nothing is written until you press Process, rearranging is free to undo. Undo all restores the document exactly as it was loaded, and the file on your disk is only ever read, never written. Whatever you download is a new file, so if the result is not what you wanted you can simply ignore it and your original is still there.",
        ]),
        ("What this does not do: change the words on a page", [
            "This is a page-level tool. It changes which pages are in the document and how they are arranged — it does not rewrite the text or images inside them. That distinction matters, because \"edit PDF\" covers two very different jobs and only one of them is realistic to do in a browser.",
            "Editing existing text is genuinely hard rather than merely tedious. A PDF does not store paragraphs or lines; it stores drawing instructions that place each run of glyphs at an absolute position, using fonts that usually contain only the characters the document already used. Adding a letter therefore often requires embedding a different font, which changes how the document looks, and adding or removing words does not reflow the paragraph because there is no paragraph to reflow. Even desktop editors struggle with this, which is why edited PDFs so often come back looking subtly wrong.",
            "So if you need the text changed, this tool will not do it and neither will an honest browser tool. What it will do reliably is give you the right pages, in the right order, the right way up — which is what most people actually set out to fix.",
        ]),
        ("Jobs people use this for", [
            "Removing the pages you should not be sending: a cover sheet with an internal note on it, a blank reverse side from a duplex scan, the last page of terms you were not meant to include, or the page of another client that the scanner picked up.",
            "Fixing the order: scanners regularly return a stack with every second page upside down, or with sheets in the wrong sequence after a double feed. Rotating and moving pages here repairs that without re-scanning anything. The same goes for putting a signed signature page at the front, or moving an appendix behind the section it belongs to.",
            "Repeating a page: a form that two people have to sign, or a cover page you want to use again later in the document. Duplicate puts a copy straight after the original, and the copy can then be moved anywhere or rotated independently.",
        ]),
    ],
    "faq": [
        ("Can I get a deleted page back?", "Yes. Nothing is written until you press Process, and Undo all restores the document exactly as it was loaded — order, rotations and all. Even after downloading, your original file has not been changed."),
        ("Does rearranging reduce quality?", "No. Pages are copied as vector data, not re-rendered, so text stays selectable and images keep their original resolution."),
        ("Can I rotate just one page?", "Yes. Each page has its own rotate button, and it turns a quarter turn at a time. To turn several at once, tick them and use the Rotate button in the toolbar."),
        ("How do I remove blank pages?", "Tick the blank pages and delete them. The tool deliberately does not try to detect blank pages for you — a page that looks empty on screen can still contain a scanned background or a stamp, and silently dropping it would be worse than asking you to pick."),
        ("Is there a limit on the number of pages?", "No fixed limit — the ceiling is your device's memory. Long documents take longer to draw as thumbnails, and above roughly 150 pages the grid takes a few seconds to fill in."),
        ("Can I edit the text on a page?", "No, and it is worth being straight about why. A PDF stores positioned drawing instructions, not paragraphs, and its fonts usually contain only the characters already used — so editing text reliably is a different and much harder problem than rearranging pages. Use this tool to get the right pages in the right order, and edit the text in the application that made the document."),
        ("Can I add a blank page?", "Not yet. Duplicating an existing blank page is the current workaround, and inserting a new blank page is a small addition for later."),
    ],
    "guides": ["how-to-delete-a-page-from-a-pdf"],
})

# --------------------------------------------------------------------------
# Added later: a guide that feeds the annotation editor.
#
# It answers the question people actually type ("how to sign a pdf") and then
# hands them the tool. The section about what a visual signature does and does
# not prove is the part that makes this page worth reading rather than one more
# page of instructions — and it is the honest answer, not the flattering one.
# --------------------------------------------------------------------------

GUIDES.append({
    "slug": "how-to-sign-a-pdf",
    "nav": "Sign a PDF",
    "card": "Sign a PDF on a phone or laptop without printing it — and what that signature actually proves.",
    "h1": "How to sign a PDF without printing it",
    "primary": "how to sign a pdf",
    "secondary": ["add signature to pdf", "sign pdf on phone", "sign pdf online free"],
    "title": "How to Sign a PDF Without Printing It — Free, on Phone or Laptop",
    "desc": "Three ways to sign a PDF, how to make a signature image that looks right, and an honest account of what a visual signature does and does not prove.",
    "lede": "Printing a document, signing it, scanning it and emailing it back is a lot of work for a mark that fits in a stamp-sized space. There are three ways to do it on the device you are holding, and they are not equally good.",
    "tool": "edit-pdf",
    "sections": [
        ("Three ways to sign, and which one the paperwork needs", [
            "Typing your name is the fastest. Add a text box on the signature line, choose a face that looks like handwriting — Times-Italic or Helvetica-Oblique both read as deliberate rather than accidental — and size it to the line. It is legible, it is obviously a decision rather than a forgery, and it is what most internal paperwork actually wants.",
            "Placing a picture of your signature is the one that looks like you signed it. You sign once, keep the image, and reuse it for years. It is also what a scanned document looks like, so nobody receiving it will find it strange.",
            "The third kind is different in nature: a certificate-based digital signature, where a cryptographic key proves both that the document has not changed since it was signed and who signed it. Some government portals, courts and regulated industries require exactly that, and no amount of careful image placement will satisfy them. If a form says \"digitally signed\" or names a standard such as PAdES or eIDAS, it means this third kind, and you need the tool your institution provides rather than this one. For everything else — a rental agreement, a permission slip, an offer letter, a contractor's timesheet — a visual signature is what is being asked for.",
        ]),
        ("Making a signature image that looks right", [
            "Sign a blank sheet of plain white paper in black ink, filling a space about as wide as your hand. Then photograph it straight on, from directly above rather than at an angle, in even daylight or a well-lit room without a lamp casting a shadow across the paper. An angled or shadowed shot is the reason most pasted signatures look pasted.",
            "Trim the picture tightly around the strokes — no paper edges, no desk, no fingertips. A PNG with a transparent background is the cleanest result, because the white paper disappears and only the ink remains; a JPG works too as long as the paper around the signature is genuinely white, but it will show as a faint rectangle if it was photographed in warm indoor light. Then place it on the line and use the width field to match the space, since a signature stretched to fill the whole margin looks wrong immediately.",
            "A word of warning about reusing that image: an image of your signature is worth having, and it is also worth stealing. Keep it in a folder you would be comfortable losing, and treat any document carrying it the way you would treat a signed paper copy.",
        ]),
        ("Signing on a phone", [
            "It works, and the difference from a laptop is precision. Open the tool in the browser, drop the PDF in, and zoom to 150% before placing anything — at fit-to-width on a phone the signature line is a few millimetres tall and you will not land on it. Tap the page where the signature belongs, then drag the corners until it sits on the line, and use the width field rather than trying to resize by eye.",
            "If the document has several pages, use the page arrows and the element list to check each one. The most common mistake on a phone is signing page 1 of a ten-page agreement and assuming it applied everywhere: a placed element belongs to the page you placed it on, which is exactly what you want for a signature line and exactly what you must remember for a stamp.",
        ]),
        ("What a visual signature does and does not prove — and what to check", [
            "It proves intent, not identity. A visual signature says \"I, the person who sent this, agreed to this document\". It does not lock the document: anyone with a PDF editor can add a page or change a number and the signature will still be sitting there looking perfectly valid. If a document is worth signing, it is usually worth sending in a way that cannot be quietly altered afterwards — and for anything where that risk is real, that is the argument for the certificate-based kind described above.",
            "Before you send it, open the result and check three things: that the signature is on the correct line and not overlapping the text beneath it, that the page count is unchanged, and that any white-out box you used is covering something you were entitled to cover. A white-out box hides what is underneath on screen and in print, but the original text is still inside the file and can still be extracted — so it is fine for an obsolete address line and completely wrong for anything confidential. If something has to be genuinely gone, remove the page instead.",
        ]),
    ],
    "faq": [
        ("Is a typed or pasted signature legally valid?", "In many countries and for most everyday agreements, an electronic signature — including a typed or pasted one — is accepted, but the rules vary by jurisdiction and by what the recipient will accept. This is not legal advice, and for anything with real consequences, check what the other side requires before you sign. What this tool produces is a visual signature: it shows your intent, but it carries no certificate and cannot prove the document has not changed since."),
        ("The form has a proper signature field. Can this fill it?", "No. A signature field in a PDF form is an interactive object with its own name and rules, and filling those is a different job from drawing on a page. You can place an image of your signature over the field so it looks right, which is what most recipients will accept, but if the form is validated by software that checks the field itself, it will still read as empty."),
        ("Can I sign on an iPhone or Android?", "Yes. Open the page in the browser, add the PDF, zoom in to about 150%, then tap the page where the signature belongs and drag it onto the line. No app is needed, and the file never leaves the phone."),
        ("Does signing change the document I started with?", "No. Your original file is only ever read. A new document is built with your signature on top and offered as a download, so you can sign again, change the size, or throw the result away and start over as many times as you like."),
        ("Can I remove a signature I placed?", "Yes — click it on the page and remove it, or delete it from the element list. Nothing is written into a document until you press Process, so undoing costs nothing. Once you have downloaded the signed file, removing the signature means going back to the original unsigned document and starting again, because the download is a finished file of its own."),
    ],
})

# --------------------------------------------------------------------------
# Added later: a guide that feeds the page organiser.
#
# 'How do I delete a page' is the most-asked page-level question there is, and
# the useful half of the answer is not how — it is what else moves when a page
# goes. A page is an entry in a table that other things point at, so this says
# plainly what breaks, what survives, and when deleting is the wrong tool.
# --------------------------------------------------------------------------

GUIDES.append({
    "slug": "how-to-delete-a-page-from-a-pdf",
    "nav": "Delete PDF pages",
    "card": "Remove a page or a whole section — and what else changes when it goes.",
    "h1": "How to delete a page from a PDF",
    "primary": "how to delete a page from a pdf",
    "secondary": ["remove pages from pdf", "delete a blank page from a pdf",
                  "remove a page from a pdf online", "delete pages from a pdf free"],
    "title": "How to Delete a Page From a PDF — Free, Lossless, Nothing Uploaded",
    "desc": "Remove one page or a whole section from a PDF, and see what happens to page numbers, bookmarks and links afterwards. Deleting is not the same as covering up.",
    "lede": "Deleting a page is the simplest thing you can ask a PDF to do, and it is quick. The part worth knowing is what else moves when a page disappears, because the pages that remain are not the only thing a document keeps track of.",
    "tool": "organize-pdf",
    "sections": [
        ("Why a PDF has almost nothing to delete", [
            "A PDF is not a document in the way a Word file is. It is a list of page objects, plus a table saying which pages exist and in what order. Deleting a page does not cut text out of a flow — it removes one entry from that table and leaves every other page exactly as it was.",
            "That is why deleting is instant and lossless: text on the remaining pages stays selectable, images keep their original resolution, and nothing is re-flowed or re-rendered. It is also why deleting a page is a genuinely different operation from covering one up.",
        ]),
        ("What else changes when a page goes", [
            "The pages themselves are untouched, but three things around them are not. First, anything that pointed at the removed page now points at nothing: a bookmark to 'Chapter 3' goes nowhere, and a link on page 2 that jumped to page 9 stops working if page 9 is the one you deleted.",
            "Second, any page number printed on the page is now wrong. A footer reading 'Page 7 of 12' cannot know the document is now eleven pages, because it was drawn as words rather than as a live field. The same goes for 'see page 9' in the body text, and for a table of contents.",
            "Third, the total shifts. If a document was numbered 1 to 12 and you delete page 4, the old page 5 becomes page 4 in every sense except the number printed on it. Everything still opens and prints correctly — it just says the wrong thing.",
            "What survives untouched: the remaining pages' content, the document's metadata and its text layer. If the numbering has to match again, that is a separate job — either re-export from whatever produced the document, or stamp a new set of numbers over the top.",
        ]),
        ("Delete, or cover it up? They are not the same thing", [
            "If the reason you are deleting a page is that it contains something you should not be sending — a second account on a bank statement, a page of notes meant for someone else, an old address — then deleting is the right answer and covering up is not. A white-out box drawn over text hides it from the eye, but the original characters are still in the file, still selectable and still extractable by anyone who opens it in the right tool. Covering up is for tidying a form, not for removing information.",
            "Deleting, by contrast, means the page is not in the file you send. Nothing survives to be extracted, because nothing was copied across.",
            "The one thing deletion cannot do is reach into a page that stays. If a single page carries both something you need and something you do not, deleting the page loses both — split the document instead, keep the part you want, and delete the rest.",
        ]),
        ("Before you press Process", [
            "Three checks take ten seconds and save the occasional embarrassing email. Does the document carry its own printed page numbers or a contents page? If it does, they will be wrong from the point of deletion onwards, and that is worth knowing before you send it rather than after.",
            "Is there another copy of the same file anywhere — an attachment you sent earlier, a folder on another machine, a version in your email? Deleting a page from the file in front of you does not touch those, and the usual reason a 'deleted' page turns up again is that a second copy existed.",
            "And keep the original until the result is checked. The new file is a separate download, so the decision is reversible for exactly as long as you keep the file you started with.",
        ]),
    ],
    "faq": [
        ("Is deleting a page permanent?", "In the file you download, yes — the page is no longer referenced, so its content is not in that document. The original you started with is only ever read, never modified, so nothing is lost until you delete the original yourself. That is why the sensible order is: keep the original, check the result, and only then tidy up."),
        ("Can I delete several pages at once?", "Yes. Pages are ticked in the grid and removed together, in the order you chose. Removing a run of pages is just the same operation repeated, and the order of everything that remains is preserved."),
        ("Will deleting a page make the file smaller?", "Usually a little, and often less than you expect: the page's own text and images go with it, but an image shared by two pages stays because the other page still needs it. If file size is the actual problem, compression is the right tool rather than deleting pages you still want."),
        ("Can I delete a page from a password-protected PDF?", "Not while it is locked — the pages cannot be read without the open password, so it has to be unlocked first. A document that only restricts editing is not a problem."),
        ("I deleted the wrong page. Can I put it back?", "Not in the same file, but you do not need to. The original is untouched, so take that page from the original and merge it back in with the merge tool. The result is the document you started with."),
    ],
})

# --------------------------------------------------------------------------
# Added later: the annotation editor.
#
# Deliberately NOT called a text editor anywhere in the copy. A PDF stores
# positioned drawing instructions rather than paragraphs, so rewriting existing
# words is a genuinely different problem from adding new content on top — and a
# page that promises "edit the text" and then cannot would be the one dishonest
# thing this site could do. It targets "edit pdf" because that is what people
# search, and then answers the query precisely in the first section.
# --------------------------------------------------------------------------

TOOLS.append({
    "slug": "edit-pdf",
    "nav": "Edit",
    "card": "Add text, a signature, white-out, a watermark or page numbers.",
    "h1": "Edit PDF files",
    "primary": "edit pdf",
    "secondary": ["add text to pdf", "sign pdf free", "add signature to pdf",
                  "white out pdf", "add watermark to pdf", "write on a pdf"],
    "title": "Edit PDF Online — Add Text, Sign & White Out, Free, No Upload",
    "desc": "Add text boxes, a signature or image, white-out, a watermark and page numbers to any PDF, in your browser. Free, no upload, no signup and no forced watermark.",
    "lede": "Click where you want something to go and type, drop in a picture of your signature, cover a line you should not be sending, then stamp page numbers across the document. It is layered onto your file rather than rewriting it, and your file never leaves the tab.",
    "steps": [
        ("Add the PDF", "Drop the document. The page is drawn at full width so you place things where you mean to, and you can zoom in for fine work."),
        ("Add what you need", "Pick text, image or white-out from the bar and click the page where it belongs. Drag anything to move it, and choose watermark or page numbering if you want them."),
        ("Process", "A new file is built with your additions on top. Nothing already in the document is rewritten, so its text stays selectable and its images keep their resolution."),
    ],
    "sections": [
        ("What this editor does, and the one thing it will not", [
            "Everything you add here is drawn as a new layer over the existing pages: text boxes, an image such as a signature, filled boxes, a watermark, page numbers. The original page content is never rewritten, which is exactly why this works reliably and why the output is lossless — text you did not touch stays selectable and searchable, and images keep the resolution they came in with.",
            "The thing it will not do is change the words that are already on the page. That is not a limitation of effort but of the format. A PDF has no paragraphs or lines; it stores drawing instructions that place each run of glyphs at an absolute position, in fonts that usually contain only the characters the document already used. Adding a letter can mean embedding a whole different font, and deleting a word does not pull the rest of the sentence across, because there is no sentence to reflow — which is why edited PDFs so often come back looking subtly wrong even from desktop software. If the existing text has to change, edit the document in whatever produced it and export again; then use this page to sign, stamp or annotate the result.",
        ]),
        ("Signing, and filling in a document", [
            "There are two ways to sign here, and both are ordinary visual signatures rather than certificate-based digital signatures — which is what the great majority of paperwork actually asks for. If a counter or a portal specifically demands a cryptographically signed document, this is not that, and it will not be.",
            "Typing your name is the quick route: add a text box, pick a script-like face such as Times-Italic, and place it on the signature line. It is legible, obviously deliberate, and fine for internal paperwork. For something that should look like your hand, sign a piece of plain white paper in black ink, photograph it straight on in even light without a shadow across it, and upload that image. A PNG with a transparent background gives the cleanest result, because the paper around the strokes disappears. Then drag it onto the line and use the width field to size it to match the document.",
            "Filling in a form works the same way: add a text box on each blank, type the value, and place it. If the blank sits on top of a dotted line that makes your typing hard to read, put a white-out box over the line first and your text on top of that. It is two steps instead of one, and the result looks like it was typed into the form.",
        ]),
        ("White-out, watermarks and page numbers", [
            "The white-out box is honest about what it is: a filled rectangle drawn over whatever is underneath. The content it covers is hidden on screen and in print, but it is still present in the file and still extractable, so it is the wrong tool for redacting anything sensitive. If something must genuinely be gone, remove the page with the Organise tool, or take the information out in the application that produced the document and export it again. Covering a stray line of an old address before you send a form is a fair use; covering an account number and calling it redaction is not.",
            "The watermark is the one you type and nothing else — there is no vendor stamp added anywhere in this tool, and no account upgrade that removes one. Set the wording, size, colour and opacity, and it is drawn on every page: the usual uses are DRAFT, CONFIDENTIAL or COPY before a document goes out, or a client's name across a set of proofs so a leaked copy can be traced to who received it.",
            "Page numbers are stamped on every page and counted from the number you choose, in one of three formats — 3, 3 / 12, or Page 3 of 12 — at the bottom left, centre or right. Because they go on every page, a cover sheet that should not carry a number needs a two-step: number the body of the document, then merge the unnumbered cover in front of it with the Merge tool. The start number is there for the same reason in reverse: continuing a document that already ran to page 40 means starting this one at 41.",
        ]),
    ],
    "faq": [
        ("Can I change the words that are already on the page?", "No, and it is worth saying plainly rather than burying it. A PDF stores positioned drawing instructions rather than paragraphs, and its fonts usually hold only the characters already in use, so rewriting existing text reliably is a different and much harder problem than adding to it. Additions — text, signature, white-out, watermark, page numbers — are what this tool does, and it does them without disturbing anything else. To change the wording, edit the document in whatever created it and export it again."),
        ("Can I sign a PDF here?", "Yes, two ways: type your name in a text box, or upload a photo or scan of your signature and drag it onto the line. Both produce a visual signature. Neither is a certificate-based digital signature, so if a portal explicitly demands a cryptographically signed document, this is not a substitute for it."),
        ("Can a white-out box be used to hide confidential information?", "No — and please do not. It paints a filled rectangle over the area, which hides it on screen and in print, but the original text is still inside the file and can still be extracted or copied. To genuinely remove something, delete that page with the Organise tool, or remove the information in the application that produced the document and export it again."),
        ("Can I type in Sinhala, Tamil, Chinese or Arabic?", "Not yet. The standard PDF fonts cover Latin characters only, so text using other scripts would need a font file embedded in the document, which this tool does not do. If you type one of those characters the tool will tell you before it builds anything, rather than quietly dropping it. Watermarks and page numbers use Latin digits and are unaffected."),
        ("Can I zoom in to place something precisely?", "Yes. The zoom control offers fit-to-width plus 100%, 150% and 200%, and the page scrolls inside its own box at those levels. Placing a signature line accurately on a phone is much easier at 150% than at fit-to-width."),
        ("Does editing change my original file?", "No. Your file on disk is only ever read. A new document is built in memory and offered as a download, so the original is untouched and you can try again as many times as you like."),
        ("Can I remove something I added?", "Yes. Click it on the page and press the remove button, or select it in the list below the page — nothing is written into a document until you press Process, so undoing costs nothing."),
    ],
    "guides": [],
})
