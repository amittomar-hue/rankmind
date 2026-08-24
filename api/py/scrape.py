from http.server import BaseHTTPRequestHandler
from urllib.parse import urlparse, urljoin, parse_qs
import json
import requests
from bs4 import BeautifulSoup

HEADERS = {
    "User-Agent": "Mozilla/5.0 (compatible; RankMind/1.0; +https://rankmind.app)",
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
}
TIMEOUT = 15


def get_sitemap_urls(base_url):
    parsed = urlparse(base_url)
    origin = f"{parsed.scheme}://{parsed.netloc}"
    urls = set()

    candidates = [
        f"{origin}/sitemap.xml",
        f"{origin}/sitemap_index.xml",
        f"{origin}/sitemap-index.xml",
        f"{origin}/wp-sitemap.xml",
        f"{origin}/post-sitemap.xml",
        f"{origin}/page-sitemap.xml",
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
        parse_sitemap(c)

    # Fallback: scrape homepage hrefs
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

    result = sorted(urls)
    if origin not in result:
        result.insert(0, origin)
    return result


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
            urls = get_sitemap_urls(domain)
            self.send_response(200)
            self.send_header("Content-Type", "application/json")
            self.end_headers()
            self.wfile.write(json.dumps({"urls": urls, "count": len(urls)}).encode())
        except Exception as e:
            self.send_response(500)
            self.send_header("Content-Type", "application/json")
            self.end_headers()
            self.wfile.write(json.dumps({"error": str(e)}).encode())

    def log_message(self, format, *args):
        pass
