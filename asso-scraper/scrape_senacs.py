import re
import time
import csv
import requests
from bs4 import BeautifulSoup

HEADERS = {"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)"}
BASE = "https://www.senacs.fr/structure/{type_}?departement=&region=11&name=&ville=&page={page}"

TYPES = {
    "csx": "Centre social",
    "evs": "Espace de vie sociale",
}


def parse_page(html):
    soup = BeautifulSoup(html, "html.parser")
    rows = soup.select("table.table tbody tr")
    if not rows:
        return []

    # map modal id -> (name, city, postal)
    listing = []
    for tr in rows:
        a = tr.select_one("td a")
        if not a:
            continue
        modal_target = a.get("data-bs-target", "").lstrip("#")
        name = a.get_text(strip=True)
        city_td = tr.select("td")[1] if len(tr.select("td")) > 1 else None
        postal = ""
        city = ""
        if city_td is not None:
            spans = city_td.find_all("span")
            if len(spans) >= 2:
                postal = spans[0].get_text(strip=True)
                city = spans[1].get_text(strip=True)
        listing.append({"modal_id": modal_target, "nom": name, "code_postal": postal, "ville": city})

    modals = {}
    for div in soup.select("div.modalStructure"):
        modal_id = div.get("id", "")
        address_tag = div.select_one("address")
        adresse = ""
        if address_tag:
            adresse = " ".join(address_tag.stripped_strings)

        text_block = ""
        card = div.select_one(".action-card address")
        # get the <p> right after <address> containing email/site/siret
        info_p = None
        if address_tag:
            info_p = address_tag.find_next_sibling("p")
        email = ""
        site = ""
        siret = ""
        if info_p:
            full_text = info_p.get_text("\n", strip=True)
            m = re.search(r"Adresse mail contact\s*:\s*(.*?)(?=Site internet|Num[ée]ro SIRET|$)", full_text, re.S)
            if m:
                email = m.group(1).strip()
            m = re.search(r"Site internet\s*:\s*(.*?)(?=Num[ée]ro SIRET|$)", full_text, re.S)
            if m:
                site = m.group(1).strip()
            m = re.search(r"Num[ée]ro SIRET\s*:\s*(.*?)$", full_text, re.S)
            if m:
                siret = m.group(1).strip()

        modals[modal_id] = {"adresse": adresse, "email": email, "site_web": site, "siret": siret}

    results = []
    for item in listing:
        modal = modals.get(item["modal_id"], {})
        results.append({
            "nom": item["nom"],
            "code_postal": item["code_postal"],
            "ville": item["ville"],
            "adresse": modal.get("adresse", ""),
            "email": modal.get("email", ""),
            "site_web": modal.get("site_web", ""),
            "siret": modal.get("siret", ""),
        })
    return results


def scrape_type(type_key, type_label):
    all_rows = []
    page = 1
    while True:
        url = BASE.format(type_=type_key, page=page)
        resp = requests.get(url, headers=HEADERS, timeout=30)
        resp.raise_for_status()
        resp.encoding = "utf-8"
        rows = parse_page(resp.text)
        if not rows:
            break
        for r in rows:
            r["type_structure"] = type_label
        all_rows.extend(rows)
        print(f"[{type_key}] page {page}: {len(rows)} structures (total {len(all_rows)})")
        page += 1
        time.sleep(1.0)
    return all_rows


def main():
    all_results = []
    for key, label in TYPES.items():
        all_results.extend(scrape_type(key, label))

    fieldnames = ["type_structure", "nom", "code_postal", "ville", "adresse", "email", "site_web", "siret"]
    out_path = "leads_senacs_idf.csv"
    with open(out_path, "w", newline="", encoding="utf-8-sig") as f:
        writer = csv.DictWriter(f, fieldnames=fieldnames)
        writer.writeheader()
        writer.writerows(all_results)

    print(f"\nTotal: {len(all_results)} structures -> {out_path}")
    with_email = sum(1 for r in all_results if r["email"])
    print(f"Avec email: {with_email} ({with_email*100//max(len(all_results),1)}%)")


if __name__ == "__main__":
    main()
