"""Tell the IndexNow search engines that every URL in the sitemap exists.

    python tools/build_pages.py     # writes web/<key>.txt
    python tools/ping_indexnow.py   # only useful once the key file is LIVE

WHY. A brand new site has no history, no links and no crawl budget: search
engines find out about it whenever they next get round to it. IndexNow is an open
protocol where you push a URL list straight at the engine instead, and every
participating engine shares what it receives.

It does NOT include Google — Google does not participate, and nothing here will
speed up Google. This covers Bing, Yandex and the engines that syndicate their
results (DuckDuckGo among them).

The ping is only valid if the key file is already deployed: the engines fetch
https://<host>/<key>.txt and check that it contains the key. Pinging before the
key is live earns a 403, which is why the order above matters.
"""

from __future__ import annotations

import json
import re
import sys
import urllib.error
import urllib.request
from pathlib import Path
from urllib.parse import urlparse

import site_content as C

ROOT = Path(__file__).resolve().parents[1]
SITEMAP = ROOT / "web" / "sitemap.xml"

# The shared endpoint forwards to every participating engine. bing.com is listed
# as well so a failure of the shared endpoint is visible rather than silent.
ENDPOINTS = [
    "https://api.indexnow.org/indexnow",
    "https://www.bing.com/indexnow",
]

HOST = urlparse(C.SITE_URL).netloc
KEY_URL = f"{C.SITE_URL}/{C.INDEXNOW_KEY}.txt"


def sitemap_urls() -> list[str]:
    if not SITEMAP.is_file():
        sys.exit(f"no sitemap at {SITEMAP} — run python tools/build_pages.py first")
    xml = SITEMAP.read_text(encoding="utf-8")
    return re.findall(r"<loc>\s*(.*?)\s*</loc>", xml)


def ping(endpoint: str, payload: bytes) -> str:
    request = urllib.request.Request(
        endpoint,
        data=payload,
        headers={"Content-Type": "application/json; charset=utf-8"},
        method="POST",
    )
    try:
        with urllib.request.urlopen(request, timeout=30) as response:
            return f"{response.status} {response.reason}"
    except urllib.error.HTTPError as err:
        body = err.read().decode("utf-8", "replace").strip()[:200]
        return f"{err.code} {err.reason}" + (f" — {body}" if body else "")
    except Exception as err:  # DNS, TLS, timeout — reported, not swallowed
        return f"failed: {type(err).__name__}: {err}"


def main() -> int:
    urls = sitemap_urls()
    if not urls:
        sys.exit("the sitemap has no <loc> entries — nothing to submit")

    payload = json.dumps({
        "host": HOST,
        "key": C.INDEXNOW_KEY,
        "keyLocation": KEY_URL,
        "urlList": urls,
    }).encode("utf-8")

    print(f"host      {HOST}")
    print(f"key file  {KEY_URL}")
    print(f"urls      {len(urls)}")
    for endpoint in ENDPOINTS:
        print(f"  {endpoint} -> {ping(endpoint, payload)}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
