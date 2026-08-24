from http.server import BaseHTTPRequestHandler
from urllib.parse import urlparse, urljoin, parse_qs
import json
import requests
from bs4 import BeautifulSoup
import re

HEADERS = {
    "User-Agent": "Mozilla/5.0 (compatible; RankMind/1.0; +https://rankmind.app)",
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
}
TIMEOUT = 15


def parse_page(html, final_url, keyword=""):
    soup = BeautifulSoup(html, "lxml")
    kw = keyword.lower().strip()

    title_tag = soup.find("title")
    title = title_tag.get_text(strip=True) if title_tag else ""
    title_len = len(title)

    meta_desc = ""
    meta_tag = soup.find("meta", attrs={"name": re.compile(r"^description$", re.I)})
    if meta_tag:
        meta_desc = meta_tag.get("content", "")
    meta_len = len(meta_desc)

    robots_tag = soup.find("meta", attrs={"name": re.compile(r"^robots$", re.I)})
    robots_content = robots_tag.get("content", "") if robots_tag else ""
    noindex = "noindex" in robots_content.lower()

    canonical_tag = soup.find("link", rel=re.compile(r"canonical", re.I))
    canonical = canonical_tag.get("href", "") if canonical_tag else ""

    h1s = [h.get_text(strip=True) for h in soup.find_all("h1")]
    h1 = h1s[0] if h1s else ""
    h2s = [h.get_text(strip=True) for h in soup.find_all("h2")]

    body_text = soup.get_text(" ", strip=True)
    words = re.findall(r"\w+", body_text.lower())
    word_count = len(words)

    imgs = soup.find_all("img")
    img_count = len(imgs)
    imgs_without_alt = sum(1 for img in imgs if not img.get("alt", "").strip())

    # Absolute URLs of the images that are MISSING an alt tag (so users can fix the exact images)
    missing_alt_urls = []
    for img in imgs:
        if img.get("alt", "").strip():
            continue
        src = (img.get("src") or img.get("data-src") or img.get("data-lazy-src") or "").strip()
        if not src or src.startswith("data:"):
            continue
        missing_alt_urls.append(urljoin(final_url, src))
    missing_alt_urls = list(dict.fromkeys(missing_alt_urls))[:30]  # dedupe, cap

    parsed = urlparse(final_url)
    origin = f"{parsed.scheme}://{parsed.netloc}"
    internal_links = []
    external_links = []
    for a in soup.find_all("a", href=True):
        href = a["href"].strip()
        if href.startswith("#") or href.startswith("javascript"):
            continue
        full = urljoin(final_url, href)
        if urlparse(full).netloc == parsed.netloc:
            internal_links.append(full)
        else:
            external_links.append(full)

    schema_types = []
    for s in soup.find_all("script", type="application/ld+json"):
        try:
            data = json.loads(s.string or "")
            t = data.get("@type", "")
            if t:
                schema_types.append(t if isinstance(t, str) else str(t))
        except Exception:
            pass

    # Keyword placement
    kw_in_title = kw in title.lower() if kw else False
    kw_in_meta = kw in meta_desc.lower() if kw else False
    kw_in_h1 = kw in h1.lower() if kw else False
    kw_in_url = kw.replace(" ", "-") in final_url.lower() or kw.replace(" ", "_") in final_url.lower() or kw in final_url.lower() if kw else False
    kw_in_body = kw in body_text.lower() if kw else False

    first_100_words = " ".join(words[:100])
    kw_in_first100 = kw in first_100_words if kw else False

    kw_count = body_text.lower().count(kw) if kw else 0
    kw_density = round(kw_count / max(word_count, 1) * 100, 2) if kw else 0

    return {
        "title": title,
        "titleLength": title_len,
        "metaDesc": meta_desc,
        "metaDescLength": meta_len,
        "metaRobots": robots_content,
        "noindex": noindex,
        "canonical": canonical,
        "h1": h1,
        "h1Count": len(h1s),
        "h2s": h2s[:10],
        "wordCount": word_count,
        "imgCount": img_count,
        "imgsWithoutAlt": imgs_without_alt,
        "imgsMissingAltUrls": missing_alt_urls,
        "internalLinks": list(set(internal_links))[:20],
        "externalLinks": list(set(external_links))[:20],
        "schemaTypes": schema_types,
        "kwInTitle": kw_in_title,
        "kwInMeta": kw_in_meta,
        "kwInH1": kw_in_h1,
        "kwInUrl": kw_in_url,
        "kwInBody": kw_in_body,
        "kwInFirst100": kw_in_first100,
        "kwCount": kw_count,
        "kwDensity": kw_density,
    }


class handler(BaseHTTPRequestHandler):
    def do_GET(self):
        parsed = urlparse(self.path)
        qs = parse_qs(parsed.query)
        url = (qs.get("url") or [""])[0].strip()
        keyword = (qs.get("keyword") or qs.get("kw") or [""])[0].strip()

        if not url:
            self.send_response(400)
            self.send_header("Content-Type", "application/json")
            self.end_headers()
            self.wfile.write(json.dumps({"error": "url required"}).encode())
            return

        if not url.startswith("http"):
            url = "https://" + url

        try:
            r = requests.get(url, headers=HEADERS, timeout=TIMEOUT, allow_redirects=True)
            final_url = r.url
            status = r.status_code
            data = parse_page(r.content, final_url, keyword)
            data["scraped"] = True
            data["status"] = status
            data["finalUrl"] = final_url

            self.send_response(200)
            self.send_header("Content-Type", "application/json")
            self.end_headers()
            self.wfile.write(json.dumps(data).encode())
        except Exception as e:
            self.send_response(500)
            self.send_header("Content-Type", "application/json")
            self.end_headers()
            self.wfile.write(json.dumps({"error": str(e)}).encode())

    def log_message(self, format, *args):
        pass
