from http.server import BaseHTTPRequestHandler
from urllib.parse import urlparse, urljoin, parse_qs
import json
import requests
from bs4 import BeautifulSoup
from concurrent.futures import ThreadPoolExecutor, as_completed
import re

HEADERS = {
    "User-Agent": "Mozilla/5.0 (compatible; RankMind/1.0; +https://rankmind.app)",
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
}
TIMEOUT = 10


def get_sitemap_urls(base_url, limit=40):
    parsed = urlparse(base_url)
    origin = f"{parsed.scheme}://{parsed.netloc}"
    urls = set()

    candidates = [
        f"{origin}/sitemap.xml",
        f"{origin}/sitemap_index.xml",
        f"{origin}/sitemap-index.xml",
        f"{origin}/wp-sitemap.xml",
    ]

    try:
        r = requests.get(f"{origin}/robots.txt", headers=HEADERS, timeout=TIMEOUT)
        for line in r.text.splitlines():
            if line.lower().startswith("sitemap:"):
                sitemap_url = line.split(":", 1)[1].strip()
                candidates.insert(0, sitemap_url)
    except Exception:
        pass

    seen = set()
    def parse_sitemap(url):
        if url in seen:
            return
        seen.add(url)
        try:
            r = requests.get(url, headers=HEADERS, timeout=TIMEOUT)
            if r.status_code != 200:
                return
            soup = BeautifulSoup(r.content, "lxml-xml")
            for loc in soup.find_all("sitemap"):
                child = loc.find("loc")
                if child:
                    parse_sitemap(child.text.strip())
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


def check_status(url):
    try:
        r = requests.head(url, headers=HEADERS, timeout=TIMEOUT, allow_redirects=False)
        status = r.status_code
        redirect_url = None
        if status in (301, 302, 307, 308):
            redirect_url = r.headers.get("Location", "")
        return {"url": url, "status": status, "redirectUrl": redirect_url, "error": None}
    except Exception as e:
        return {"url": url, "status": 0, "redirectUrl": None, "error": str(e)}


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
            urls = get_sitemap_urls(domain, 40)
            to_check = urls[:35]

            results = []
            with ThreadPoolExecutor(max_workers=10) as ex:
                futures = {ex.submit(check_status, u): u for u in to_check}
                for f in as_completed(futures):
                    results.append(f.result())

            ok = [r for r in results if r["status"] == 200]
            redirected = [r for r in results if r["status"] in (301, 302, 307, 308)]
            broken = [r for r in results if r["error"] or r["status"] in (404, 410) or (r["status"] >= 400 and r["status"] not in (301, 302, 307, 308))]
            server_error = [r for r in results if r["status"] >= 500]

            output = {
                "scraped": True,
                "summary": {
                    "total": len(results),
                    "ok": len(ok),
                    "redirected": len(redirected),
                    "broken": len(broken),
                    "server_error": len(server_error),
                },
                "results": results,
                "broken": broken,
                "redirected": redirected,
            }

            self.send_response(200)
            self.send_header("Content-Type", "application/json")
            self.end_headers()
            self.wfile.write(json.dumps(output).encode())
        except Exception as e:
            self.send_response(500)
            self.send_header("Content-Type", "application/json")
            self.end_headers()
            self.wfile.write(json.dumps({"error": str(e)}).encode())

    def log_message(self, format, *args):
        pass
