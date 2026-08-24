"""
Real ad platform detection via tracking pixel + GTM container inspection.
1. Fetches domain homepage HTML
2. Also fetches any GTM container JS (where most pixels live)
3. Checks all three: Google Ads, Meta Pixel, LinkedIn Insight Tag
"""
from http.server import BaseHTTPRequestHandler
from urllib.parse import urlparse, parse_qs
import json
import re
import requests
from bs4 import BeautifulSoup

UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36"
TIMEOUT = 12

BROWSER_HEADERS = {
    "User-Agent": UA,
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "Accept-Language": "en-US,en;q=0.9",
    "Accept-Encoding": "gzip, deflate, br",
    "Connection": "keep-alive",
    "Upgrade-Insecure-Requests": "1",
    "Sec-Fetch-Dest": "document",
    "Sec-Fetch-Mode": "navigate",
    "Sec-Fetch-Site": "none",
    "Cache-Control": "max-age=0",
}

# Patterns to find in raw HTML or GTM container JS
PIXEL_PATTERNS = {
    "google": [
        r"googletagmanager\.com/gtag",
        r"google\.com/pagead",
        r"googleadservices\.com",
        r"gtag\(['\"]config['\"],\s*['\"]AW-",   # Google Ads conversion ID
        r"adsbygoogle",
        r"google_conversion",
        r"['\"]AW-\d{8,}['\"]",                  # Any AW- ID (Google Ads)
    ],
    "meta": [
        r"connect\.facebook\.net",               # Facebook SDK / Pixel JS
        r"facebook\.com/tr\b",                   # Pixel event ping
        r"\bfbq\s*[=(]",                         # fbq() function
        r"_fbq\b",
        r"meta\.com/tr\b",
        r"facebook-pixel",                       # GTM tag type name
        r"['\"]pixelId['\"]",                    # GTM Facebook Pixel config key
        r"['\"]FB_PIXEL['\"]",
        r"fbevents\.js",
        r"px\.ads\.linkedin",                    # sometimes confused — keep separate
    ],
    "linkedin": [
        r"snap\.licdn\.com",                     # LinkedIn Insight CDN
        r"linkedin\.com/insight",
        r"linkedin\.com/pb/",
        r"_linkedin_partner_id",
        r"linkedin-insight",                     # GTM tag type name
        r"linkedin_partner",
        r"li\.lms-analytics",
        r"licdn\.com",
        r"ads\.linkedin",
    ],
}

def check_source(text, platform):
    return any(re.search(p, text, re.I) for p in PIXEL_PATTERNS[platform])

def detect_pixels(domain):
    found = {p: False for p in PIXEL_PATTERNS}
    checked = False
    error = None
    gtm_ids = []

    # ── Step 1: fetch homepage ──────────────────────────────────────────
    try:
        r = requests.get(
            f"https://{domain}/",
            headers=BROWSER_HEADERS,
            timeout=TIMEOUT,
            allow_redirects=True,
        )
        html = r.text
        checked = True

        for p in PIXEL_PATTERNS:
            if check_source(html, p):
                found[p] = True

        # noscript fallback pixels (often included even when loaded via GTM)
        soup = BeautifulSoup(html, "html.parser")
        ns_text = " ".join(t.get_text(" ") for t in soup.find_all("noscript"))
        for p in PIXEL_PATTERNS:
            if not found[p] and check_source(ns_text, p):
                found[p] = True

        # collect all GTM container IDs on the page
        gtm_ids = list(dict.fromkeys(re.findall(r"GTM-[A-Z0-9]+", html)))

    except Exception as e:
        error = str(e)[:100]

    # ── Step 2: fetch each GTM container and scan for ALL platforms ─────
    # (Most pixels live inside GTM, not in the raw HTML)
    for gid in gtm_ids[:3]:
        try:
            resp = requests.get(
                f"https://www.googletagmanager.com/gtm.js?id={gid}",
                headers={"User-Agent": UA, "Referer": f"https://{domain}/"},
                timeout=10,
            )
            js = resp.text
            for p in PIXEL_PATTERNS:
                if not found[p] and check_source(js, p):
                    found[p] = True
            # Extra broad GTM checks
            if not found["meta"] and re.search(r"facebook|meta.pixel|fbpixel", js, re.I):
                found["meta"] = True
            if not found["linkedin"] and re.search(r"linkedin|licdn|insight.tag", js, re.I):
                found["linkedin"] = True
            if not found["google"] and re.search(r"AW-\d{7}", js):
                found["google"] = True
            checked = True
        except Exception:
            continue

    return {
        "scraped": checked,
        "error": error,
        "gtm_found": len(gtm_ids) > 0,
        "gtm_ids": gtm_ids,
        "platforms": {
            p: {"pixel": found[p], "scraped": checked}
            for p in PIXEL_PATTERNS
        },
    }


class handler(BaseHTTPRequestHandler):
    def do_GET(self):
        qs = parse_qs(urlparse(self.path).query)
        domain = (qs.get("domain", [""])[0]).strip()
        domain = re.sub(r"^https?://", "", domain)
        domain = re.sub(r"^www\.", "", domain)
        domain = domain.split("/")[0]

        if not domain:
            self.send_response(400)
            self.end_headers()
            self.wfile.write(json.dumps({"error": "No domain"}).encode())
            return

        result = detect_pixels(domain)
        result["domain"] = domain

        self.send_response(200)
        self.send_header("Content-Type", "application/json")
        self.send_header("Access-Control-Allow-Origin", "*")
        self.end_headers()
        self.wfile.write(json.dumps(result).encode())

    def log_message(self, *args):
        pass
