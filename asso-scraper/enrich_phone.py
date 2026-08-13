import re
import csv
import time
import requests
from urllib.parse import urljoin, urlparse
from bs4 import BeautifulSoup

HEADERS = {"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)"}
IN_FILE = "leads_senacs_idf.csv"
OUT_FILE = "leads_senacs_idf_avec_tel.csv"

# French phone number patterns: 0X XX XX XX XX, +33 X XX XX XX XX, with various separators
PHONE_RE = re.compile(
    r"(?:(?:\+33|0033)[\s.\-]?[1-9](?:[\s.\-]?\d{2}){4}|0[1-9](?:[\s.\-]?\d{2}){4})"
)

CONTACT_PATHS = ["", "/contact", "/contact-nous", "/mentions-legales"]


def normalize_url(raw):
    raw = raw.strip()
    if not raw:
        return None
    if not raw.lower().startswith("http"):
        raw = "http://" + raw
    parsed = urlparse(raw)
    if not parsed.netloc:
        return None
    return f"{parsed.scheme}://{parsed.netloc}"


def clean_phone(raw):
    digits = re.sub(r"[^\d+]", "", raw)
    if digits.startswith("0033"):
        digits = "+33" + digits[4:]
    if digits.startswith("+33"):
        rest = digits[3:]
    elif digits.startswith("0"):
        rest = digits[1:]
    else:
        return None
    if len(rest) != 9:
        return None
    return "0" + rest


def find_phone_on_site(base_url, timeout=5):
    tried = set()
    for path in CONTACT_PATHS:
        url = base_url + path
        if url in tried:
            continue
        tried.add(url)
        try:
            resp = requests.get(url, headers=HEADERS, timeout=timeout)
        except requests.RequestException:
            continue
        if resp.status_code != 200:
            continue
        resp.encoding = resp.apparent_encoding
        soup = BeautifulSoup(resp.text, "html.parser")

        # tel: links first (most reliable)
        tel_link = soup.select_one('a[href^="tel:"]')
        if tel_link:
            candidate = clean_phone(tel_link["href"].replace("tel:", ""))
            if candidate:
                return candidate

        text = soup.get_text(" ", strip=True)
        m = PHONE_RE.search(text)
        if m:
            candidate = clean_phone(m.group(0))
            if candidate:
                return candidate
    return None


def main():
    rows = list(csv.DictReader(open(IN_FILE, encoding="utf-8-sig")))
    fieldnames = list(rows[0].keys()) + ["telephone"]

    found = 0
    for i, row in enumerate(rows, 1):
        base = normalize_url(row.get("site_web", ""))
        phone = ""
        if base:
            try:
                phone = find_phone_on_site(base) or ""
            except Exception:
                phone = ""
        row["telephone"] = phone
        if phone:
            found += 1
        if i % 25 == 0 or i == len(rows):
            print(f"{i}/{len(rows)} traites, {found} telephones trouves")
        time.sleep(0.3)

    with open(OUT_FILE, "w", newline="", encoding="utf-8-sig") as f:
        writer = csv.DictWriter(f, fieldnames=fieldnames)
        writer.writeheader()
        writer.writerows(rows)

    print(f"\nTermine: {found}/{len(rows)} telephones trouves -> {OUT_FILE}")


if __name__ == "__main__":
    main()
