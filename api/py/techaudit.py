from http.server import BaseHTTPRequestHandler
from urllib.parse import urlparse, urljoin, parse_qs
import json
import os
import requests
from bs4 import BeautifulSoup
from concurrent.futures import ThreadPoolExecutor, as_completed
import re

HEADERS = {
    "User-Agent": "Mozilla/5.0 (compatible; RankMind/1.0; +https://rankmind.app)",
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
}
TIMEOUT = 15
GOOGLE_API_KEY = os.environ.get("GOOGLE_API_KEY", "")


def get_pagespeed(url: str, strategy: str = "mobile") -> dict:
    """Fetch real Core Web Vitals from Google PageSpeed Insights API."""
    if not GOOGLE_API_KEY:
        return {}
    try:
        api_url = (
            "https://www.googleapis.com/pagespeedonline/v5/runPagespeed"
            f"?url={requests.utils.quote(url, safe='')}"
            f"&strategy={strategy}"
            f"&key={GOOGLE_API_KEY}"
        )
        r = requests.get(api_url, timeout=25)
        if r.status_code != 200:
            return {}
        data = r.json()
        lh = data.get("lighthouseResult", {})
        cats = lh.get("categories", {})
        audits = lh.get("audits", {})

        def score(cat_key):
            s = cats.get(cat_key, {}).get("score")
            return round(s * 100) if s is not None else None

        def audit_val(audit_key):
            a = audits.get(audit_key, {})
            return a.get("displayValue", "")

        def audit_num(audit_key):
            a = audits.get(audit_key, {})
            return a.get("numericValue")

        return {
            "performance": score("performance"),
            "accessibility": score("accessibility"),
            "seo": score("seo"),
            "best_practices": score("best-practices"),
            "lcp": audit_val("largest-contentful-paint"),
            "cls": audit_val("cumulative-layout-shift"),
            "fcp": audit_val("first-contentful-paint"),
            "tbt": audit_val("total-blocking-time"),
            "speed_index": audit_val("speed-index"),
            "lcp_ms": audit_num("largest-contentful-paint"),
            "cls_score": audit_num("cumulative-layout-shift"),
            "fcp_ms": audit_num("first-contentful-paint"),
            "tbt_ms": audit_num("total-blocking-time"),
        }
    except Exception:
        return {}


def get_sitemap_urls(base_url, limit=15):
    parsed = urlparse(base_url)
    origin = f"{parsed.scheme}://{parsed.netloc}"
    urls = set()

    candidates = [
        f"{origin}/robots.txt",
        f"{origin}/sitemap.xml",
        f"{origin}/sitemap_index.xml",
        f"{origin}/sitemap-index.xml",
        f"{origin}/wp-sitemap.xml",
    ]

    # Try robots.txt for sitemap pointer
    try:
        r = requests.get(f"{origin}/robots.txt", headers=HEADERS, timeout=TIMEOUT)
        for line in r.text.splitlines():
            if line.lower().startswith("sitemap:"):
                sitemap_url = line.split(":", 1)[1].strip()
                candidates.insert(0, sitemap_url)
    except Exception:
        pass

    seen_sitemaps = set()
    def parse_sitemap(url):
        if url in seen_sitemaps:
            return
        seen_sitemaps.add(url)
        try:
            r = requests.get(url, headers=HEADERS, timeout=TIMEOUT)
            if r.status_code != 200:
                return
            soup = BeautifulSoup(r.content, "lxml-xml")
            # Sitemap index
            for loc in soup.find_all("sitemap"):
                child = loc.find("loc")
                if child:
                    parse_sitemap(child.text.strip())
            # URL set
            for loc in soup.find_all("url"):
                l = loc.find("loc")
                if l:
                    urls.add(l.text.strip())
        except Exception:
            pass

    for c in candidates:
        if len(urls) >= limit:
            break
        parse_sitemap(c)

    # Fallback: homepage hrefs
    if not urls:
        try:
            r = requests.get(origin, headers=HEADERS, timeout=TIMEOUT)
            soup = BeautifulSoup(r.content, "lxml")
            for a in soup.find_all("a", href=True):
                href = urljoin(origin, a["href"])
                if href.startswith(origin):
                    urls.add(href)
        except Exception:
            pass

    result = list(urls)[:limit]
    if origin not in result:
        result.insert(0, origin)
    return result[:limit]


def fetch_and_parse(url):
    try:
        r = requests.get(url, headers=HEADERS, timeout=TIMEOUT, allow_redirects=True)
        status = r.status_code
        final_url = r.url
        soup = BeautifulSoup(r.content, "lxml")

        title_tag = soup.find("title")
        title = title_tag.get_text(strip=True) if title_tag else ""
        title_len = len(title)

        meta_desc = ""
        meta_tag = soup.find("meta", attrs={"name": re.compile(r"^description$", re.I)})
        if meta_tag:
            meta_desc = meta_tag.get("content", "")
        meta_len = len(meta_desc)

        robots_tag = soup.find("meta", attrs={"name": re.compile(r"^robots$", re.I)})
        robots_content = robots_tag.get("content", "").lower() if robots_tag else ""
        noindex = "noindex" in robots_content

        canonical_tag = soup.find("link", rel=re.compile(r"canonical", re.I))
        canonical = canonical_tag.get("href", "") if canonical_tag else ""

        h1s = [h.get_text(strip=True) for h in soup.find_all("h1")]
        h1 = h1s[0] if h1s else ""

        words = len(re.findall(r"\w+", soup.get_text()))

        imgs = soup.find_all("img")
        imgs_no_alt = sum(1 for img in imgs if not img.get("alt", "").strip())

        schema_types = []
        for s in soup.find_all("script", type="application/ld+json"):
            try:
                data = json.loads(s.string or "")
                t = data.get("@type", "")
                if t:
                    schema_types.append(t if isinstance(t, str) else str(t))
            except Exception:
                pass

        return {
            "url": url,
            "finalUrl": final_url,
            "status": status,
            "title": title,
            "titleLength": title_len,
            "metaDesc": meta_desc,
            "metaDescLength": meta_len,
            "noindex": noindex,
            "canonical": canonical,
            "h1": h1,
            "h1Count": len(h1s),
            "wordCount": words,
            "imgsWithoutAlt": imgs_no_alt,
            "schemaTypes": schema_types,
            "missing_title": title_len == 0,
            "short_title": 0 < title_len < 30,
            "long_title": title_len > 60,
            "missing_meta": meta_len == 0,
            "short_meta": 0 < meta_len < 70,
            "missing_h1": len(h1s) == 0,
            "multiple_h1": len(h1s) > 1,
            "thin_content": words < 300,
            "error": None,
        }
    except Exception as e:
        return {"url": url, "error": str(e), "status": 0}


class handler(BaseHTTPRequestHandler):
    def do_GET(self):
        parsed = urlparse(self.path)
        qs = parse_qs(parsed.query)
        domain = (qs.get("domain") or qs.get("url") or [""])[0].strip()

        if not domain:
            self.send_response(400)
            self.send_header("Content-Type", "application/json")
            self.end_headers()
            self.wfile.write(json.dumps({"error": "domain required"}).encode())
            return

        if not domain.startswith("http"):
            domain = "https://" + domain

        try:
            urls = get_sitemap_urls(domain, 15)
            to_check = urls[:12]
            homepage = urls[0] if urls else domain

            pages = []
            pagespeed_mobile = {}
            pagespeed_desktop = {}
            with ThreadPoolExecutor(max_workers=8) as ex:
                page_futures = {ex.submit(fetch_and_parse, u): u for u in to_check}
                ps_mobile_f = ex.submit(get_pagespeed, homepage, "mobile")
                ps_desktop_f = ex.submit(get_pagespeed, homepage, "desktop")
                for f in as_completed(page_futures):
                    pages.append(f.result())
                pagespeed_mobile = ps_mobile_f.result()
                pagespeed_desktop = ps_desktop_f.result()

            ok = sum(1 for p in pages if p.get("status") == 200)
            redirects = sum(1 for p in pages if p.get("status") in (301, 302, 307, 308))
            errors = sum(1 for p in pages if p.get("error") or (p.get("status", 0) >= 400))
            missing_title = sum(1 for p in pages if p.get("missing_title"))
            short_title = sum(1 for p in pages if p.get("short_title"))
            long_title = sum(1 for p in pages if p.get("long_title"))
            missing_meta = sum(1 for p in pages if p.get("missing_meta"))
            short_meta = sum(1 for p in pages if p.get("short_meta"))
            missing_h1 = sum(1 for p in pages if p.get("missing_h1"))
            multiple_h1 = sum(1 for p in pages if p.get("multiple_h1"))
            imgs_no_alt = sum(p.get("imgsWithoutAlt", 0) for p in pages)
            noindex_pages = sum(1 for p in pages if p.get("noindex"))
            no_canonical = sum(1 for p in pages if not p.get("canonical"))
            thin_content = sum(1 for p in pages if p.get("thin_content"))

            result = {
                "scraped": True,
                "urls_checked": len(pages),
                "summary": {
                    "total": len(pages),
                    "ok": ok,
                    "redirects": redirects,
                    "errors": errors,
                    "missing_title": missing_title,
                    "short_title": short_title,
                    "long_title": long_title,
                    "missing_meta": missing_meta,
                    "short_meta": short_meta,
                    "missing_h1": missing_h1,
                    "multiple_h1": multiple_h1,
                    "imgs_no_alt": imgs_no_alt,
                    "noindex_pages": noindex_pages,
                    "no_canonical": no_canonical,
                    "thin_content": thin_content,
                },
                "pages": pages,
                "pagespeed": {
                    "mobile": pagespeed_mobile,
                    "desktop": pagespeed_desktop,
                    "source": "google_pagespeed_insights" if pagespeed_mobile else "unavailable",
                },
            }

            self.send_response(200)
            self.send_header("Content-Type", "application/json")
            self.end_headers()
            self.wfile.write(json.dumps(result).encode())
        except Exception as e:
            self.send_response(500)
            self.send_header("Content-Type", "application/json")
            self.end_headers()
            self.wfile.write(json.dumps({"error": str(e)}).encode())

    def log_message(self, format, *args):
        pass
