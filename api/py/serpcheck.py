from http.server import BaseHTTPRequestHandler
from urllib.parse import urlparse, parse_qs, unquote
import json
import os
import requests
from bs4 import BeautifulSoup
import re

HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
    "Accept-Language": "en-US,en;q=0.9",
    "Accept-Encoding": "gzip, deflate, br",
    "Connection": "keep-alive",
    "Upgrade-Insecure-Requests": "1",
    "Sec-Fetch-Dest": "document",
    "Sec-Fetch-Mode": "navigate",
    "Sec-Fetch-Site": "none",
}
TIMEOUT = 20

COUNTRY_MAP = {
    "us": "US", "usa": "US", "united states": "US",
    "uk": "GB", "gb": "GB", "united kingdom": "GB",
    "ca": "CA", "canada": "CA",
    "au": "AU", "australia": "AU",
    "in": "IN", "india": "IN",
    "de": "DE", "germany": "DE",
    "fr": "FR", "france": "FR",
}

GOOGLE_API_KEY = os.environ.get("GOOGLE_API_KEY", "").strip()
GOOGLE_CSE_ID = os.environ.get("GOOGLE_CSE_ID", "").strip()
BRAVE_API_KEY = os.environ.get("BRAVE_API_KEY", "").strip()


def extract_domain(url: str) -> str:
    try:
        return urlparse(url).netloc.replace("www.", "")
    except Exception:
        return url


def scrape_google(keyword: str, country: str = "US") -> tuple:
    """Google Custom Search JSON API — official, reliable from cloud IPs.
    Returns (results_list, error_string)."""
    if not GOOGLE_API_KEY:
        return [], "GOOGLE_API_KEY not set"
    if not GOOGLE_CSE_ID:
        return [], "GOOGLE_CSE_ID not set"

    cc = COUNTRY_MAP.get(country.lower().strip(), "US").lower()
    params = {
        "key": GOOGLE_API_KEY,
        "cx": GOOGLE_CSE_ID,
        "q": keyword,
        "num": 10,
        "gl": cc,
        "hl": "en",
    }

    try:
        resp = requests.get(
            "https://www.googleapis.com/customsearch/v1",
            params=params,
            timeout=TIMEOUT,
        )
        if resp.status_code != 200:
            body = resp.text[:300]
            return [], f"Google API HTTP {resp.status_code}: {body}"
        data = resp.json()
    except Exception as e:
        return [], f"Google API request error: {e}"

    if "error" in data:
        return [], f"Google API error: {data['error'].get('message', str(data['error']))}"

    results = []
    for i, item in enumerate(data.get("items", []), 1):
        page_url = item.get("link", "")
        domain = extract_domain(page_url)
        if not domain:
            continue
        results.append({
            "pos": i,
            "url": page_url,
            "domain": domain,
            "title": item.get("title", ""),
            "snippet": item.get("snippet", "").replace("\n", " ").strip(),
        })

    return results, ""


def scrape_bing(keyword: str, country: str = "US") -> list:
    cc = COUNTRY_MAP.get(country.lower().strip(), "US")
    url = f"https://www.bing.com/search?q={requests.utils.quote(keyword)}&cc={cc}&setlang=en-US&count=10&form=QBLH"

    session = requests.Session()
    # Bypass Bing consent / region gate cookies
    session.cookies.set("SRCHHPGUSR", "ADLT=DEMOTE&NRSLT=10&AS=1", domain=".bing.com")
    session.cookies.set("MSCC", "NR", domain=".bing.com")
    session.cookies.set("_EDGE_V", "1", domain=".bing.com")
    session.cookies.set("MUID", "1A2B3C4D5E6F7A8B9C0D1E2F3A4B5C6D", domain=".bing.com")

    bing_headers = {**HEADERS,
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36 Edg/124.0.0.0",
        "Referer": "https://www.bing.com/",
        "Host": "www.bing.com",
    }

    try:
        resp = session.get(url, headers=bing_headers, timeout=TIMEOUT)
        if resp.status_code != 200:
            return []
    except Exception:
        return []

    soup = BeautifulSoup(resp.content, "lxml")
    results = []
    pos = 1

    for li in soup.find_all("li", class_="b_algo"):
        if pos > 10:
            break

        h2 = li.find("h2")
        if not h2:
            continue
        a = h2.find("a", href=True)
        if not a:
            continue

        title = a.get_text(strip=True)
        href = a["href"]
        if not href.startswith("http"):
            continue

        domain = extract_domain(href)
        if not domain or "bing.com" in domain or "microsoft.com" in domain:
            continue

        snippet = ""
        caption = li.find("div", class_="b_caption")
        if caption:
            p = caption.find("p")
            if p:
                snippet = p.get_text(strip=True)
        if not snippet:
            snippet_div = li.find(class_=re.compile(r"b_snippet|snippet"))
            if snippet_div:
                snippet = snippet_div.get_text(strip=True)

        results.append({
            "pos": pos,
            "url": href,
            "domain": domain,
            "title": title,
            "snippet": snippet,
        })
        pos += 1

    return results


def scrape_brave(keyword: str, country: str = "US") -> tuple:
    """Brave Search API — free tier, reliable from cloud IPs, no CSE needed."""
    if not BRAVE_API_KEY:
        return [], "BRAVE_API_KEY not set"

    cc = COUNTRY_MAP.get(country.lower().strip(), "US")
    try:
        resp = requests.get(
            "https://api.search.brave.com/res/v1/web/search",
            params={"q": keyword, "count": 10, "country": cc, "search_lang": "en"},
            headers={"Accept": "application/json", "X-Subscription-Token": BRAVE_API_KEY},
            timeout=TIMEOUT,
        )
        if resp.status_code != 200:
            return [], f"Brave API HTTP {resp.status_code}: {resp.text[:200]}"
        data = resp.json()
    except Exception as e:
        return [], f"Brave API error: {e}"

    results = []
    for i, item in enumerate(data.get("web", {}).get("results", []), 1):
        page_url = item.get("url", "")
        domain = extract_domain(page_url)
        if not domain:
            continue
        results.append({
            "pos": i,
            "url": page_url,
            "domain": domain,
            "title": item.get("title", ""),
            "snippet": item.get("description", "").strip(),
        })

    return results, ""


def scrape_ddg_fallback(keyword: str) -> list:
    """DuckDuckGo fallback — may be blocked from cloud IPs."""
    url = f"https://html.duckduckgo.com/html/?q={requests.utils.quote(keyword)}&kl=us-en"
    try:
        resp = requests.get(url, headers=HEADERS, timeout=TIMEOUT)
        if resp.status_code != 200:
            return []
    except Exception:
        return []

    soup = BeautifulSoup(resp.content, "lxml")
    results = []
    pos = 1

    for div in soup.find_all("div", class_=re.compile(r"^result\b")):
        if pos > 10:
            break
        if div.get("class") and any("ad" in c.lower() for c in div.get("class", [])):
            continue
        title_tag = div.find("a", class_=re.compile(r"result__a"))
        if not title_tag:
            continue
        title = title_tag.get_text(strip=True)
        raw_href = title_tag.get("href", "")
        if "uddg=" in raw_href:
            m = re.search(r"uddg=([^&]+)", raw_href)
            page_url = unquote(m.group(1)) if m else raw_href
        elif raw_href.startswith("http"):
            page_url = raw_href
        else:
            continue
        domain = extract_domain(page_url)
        if not domain or "duckduckgo.com" in domain:
            continue
        snippet_tag = div.find(class_=re.compile(r"result__snippet"))
        snippet = snippet_tag.get_text(strip=True) if snippet_tag else ""
        results.append({"pos": pos, "url": page_url, "domain": domain, "title": title, "snippet": snippet})
        pos += 1

    return results


class handler(BaseHTTPRequestHandler):
    def do_GET(self):
        parsed = urlparse(self.path)
        qs = parse_qs(parsed.query)
        keyword = (qs.get("keyword") or qs.get("kw") or [""])[0].strip()
        location = (qs.get("location") or qs.get("geo") or ["us"])[0].strip()

        if not keyword:
            self.send_response(400)
            self.send_header("Content-Type", "application/json")
            self.end_headers()
            self.wfile.write(json.dumps({"error": "keyword required"}).encode())
            return

        try:
            debug = {}

            # 1. Google Custom Search API (most accurate, needs CSE ID)
            results, google_err = scrape_google(keyword, location)
            source = "google"
            if google_err:
                debug["google_error"] = google_err

            # 2. Brave Search API (free, reliable from cloud IPs)
            if not results:
                results, brave_err = scrape_brave(keyword, location)
                source = "brave"
                if brave_err:
                    debug["brave_error"] = brave_err

            # 3. Bing HTML scraping
            if not results:
                results = scrape_bing(keyword, location)
                source = "bing"
                if not results:
                    debug["bing_empty"] = True

            # 4. DuckDuckGo last resort (often blocked from cloud IPs)
            if not results:
                results = scrape_ddg_fallback(keyword)
                source = "duckduckgo"

            output = {
                "scraped": len(results) > 0,
                "results": results,
                "count": len(results),
                "source": source,
                "debug": debug,
            }
            self.send_response(200)
            self.send_header("Content-Type", "application/json")
            self.end_headers()
            self.wfile.write(json.dumps(output).encode())
        except Exception as e:
            self.send_response(500)
            self.send_header("Content-Type", "application/json")
            self.end_headers()
            self.wfile.write(json.dumps({"error": str(e), "scraped": False, "results": []}).encode())

    def log_message(self, format, *args):
        pass
