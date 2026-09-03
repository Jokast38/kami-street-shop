"""
Scrape complet de la catégorie "Accessoires" (+ sous-catégories) du site
partenaire iMooving (PrestaShop), pour préparer leur import dans WooCommerce.

Pour chaque produit on récupère :
- nom, description longue (HTML), description courte, référence/SKU, marque
- catégorie(s) / sous-catégorie(s) d'origine
- prix, disponibilité
- toutes les images (URL "large_default")
- variations (attributs de type Couleur/Taille etc.) avec prix/réf/EAN/images
  par variante, si le produit en a
- info bundle/pack (produit composé d'autres produits), si applicable

Le detail de chaque fiche produit est extrait depuis le JSON embarqué par le
thème PrestaShop dans l'attribut data-product de l'onglet "Détails du produit"
(bien plus fiable qu'un parsing du HTML affiché). Les variantes additionnelles
sont récupérées via l'action AJAX "Refresh" du thème (même mécanisme que le
sélecteur de couleur/taille sur la fiche produit).

Résultat : data/scraped_imooving_products.json (fichier de staging, à valider
avant tout import réel dans WooCommerce via import_imooving_to_woocommerce.py)

Usage:
    cd backend
    python -m scripts.scrape_imooving
"""
import asyncio
import html
import json
import re
from itertools import product as iter_product
from pathlib import Path
from urllib.parse import urljoin

import httpx
from bs4 import BeautifulSoup

BASE_URL = "https://www.imooving.com"
ROOT_CATEGORY_URL = f"{BASE_URL}/16-accessoires"

# Sous-catégories connues du menu "Accessoires" (menu JS non présent dans le
# HTML statique de la page catégorie -> liste fournie manuellement).
SUBCATEGORIES = [
    {"name": "Antivol", "url": f"{BASE_URL}/47-cadenas"},
    {"name": "Casques", "url": f"{BASE_URL}/44-casques"},
    {"name": "Pompes", "url": f"{BASE_URL}/49-pompes"},
    {"name": "Sacs et Sacoches", "url": f"{BASE_URL}/55-sacs-et-sacoches"},
    {"name": "Support smartphone", "url": f"{BASE_URL}/45-support-smartphone"},
]

OUT_DIR = Path(__file__).resolve().parent.parent / "data"
OUT_DIR.mkdir(exist_ok=True)
LISTING_FILE = OUT_DIR / "scraped_imooving_listing.json"
OUT_FILE = OUT_DIR / "scraped_imooving_products.json"

HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
                  "(KHTML, like Gecko) Chrome/124.0 Safari/537.36",
    "Accept-Language": "fr-FR,fr;q=0.9",
}
AJAX_HEADERS = {**HEADERS, "X-Requested-With": "XMLHttpRequest"}


def parse_price(text: str) -> float | None:
    if not text:
        return None
    cleaned = text.replace("\xa0", " ").replace("€", "").strip()
    cleaned = cleaned.replace(" ", "").replace(",", ".")
    try:
        return float(cleaned)
    except ValueError:
        return None


def parse_listing_products(soup: BeautifulSoup) -> list[dict]:
    products = []
    for article in soup.select("article.js-product-miniature"):
        product_id = article.get("data-id-product")
        name_tag = article.select_one("h3 a.product_name")
        link_tag = name_tag or article.select_one("a.product-thumbnail")
        url = urljoin(BASE_URL, link_tag["href"]) if link_tag and link_tag.get("href") else None
        if not product_id or not url:
            continue
        products.append({"source_id": product_id, "url": url})
    return products


def find_next_page_url(soup: BeautifulSoup) -> str | None:
    next_link = soup.select_one("a.next, a[rel='next']")
    if next_link and next_link.get("href"):
        return urljoin(BASE_URL, next_link["href"])
    return None


async def scrape_category_listing(client: httpx.AsyncClient, name: str, url: str) -> list[dict]:
    all_products = []
    page_url = url
    page_num = 1
    while page_url:
        r = await client.get(page_url, headers=HEADERS, timeout=30, follow_redirects=True)
        r.raise_for_status()
        soup = BeautifulSoup(r.text, "lxml")
        page_products = parse_listing_products(soup)
        for p in page_products:
            p["category"] = name
        all_products.extend(page_products)
        print(f"  [{name}] page {page_num}: {len(page_products)} produits")
        page_url = find_next_page_url(soup)
        page_num += 1
        if page_num > 50:
            break
    return all_products


def extract_product_json(page_text: str) -> dict | None:
    m = re.search(r'data-product="([^"]*)"', page_text)
    if not m:
        return None
    return json.loads(html.unescape(m.group(1)))


def clean_product_record(p: dict) -> dict:
    images = [img["bySize"]["large_default"]["url"] for img in p.get("images", []) if img.get("bySize", {}).get("large_default")]
    attributes = {}
    for a in (p.get("attributes") or {}).values():
        group = a.get("public_group") or a.get("group")
        if group:
            attributes[group] = a.get("name")
    reference = p.get("reference") or ""
    if not reference:
        # pour une combinaison, la référence se trouve dans le détail de l'attribut
        for a in (p.get("attributes") or {}).values():
            if a.get("reference"):
                reference = a["reference"]
                break
    ean13 = None
    for a in (p.get("attributes") or {}).values():
        if a.get("ean13"):
            ean13 = a["ean13"]
            break
    return {
        "source_id": p.get("id_product"),
        "id_product_attribute": p.get("id_product_attribute"),
        "name": p.get("name"),
        "reference": reference,
        "ean13": ean13,
        "attributes": attributes,
        "brand": p.get("manufacturer_name"),
        "price": p.get("price_amount"),
        "description": p.get("description"),
        "description_short": p.get("description_short"),
        "availability": p.get("availability"),
        "images": images,
        "features": [
            {"name": f.get("name"), "value": f.get("value")}
            for f in p.get("features", [])
        ],
        "pack": bool(p.get("pack")),
        "pack_items": p.get("packItems") or [],
        "url": p.get("link"),
    }


async def fetch_combination(client: httpx.AsyncClient, product_url: str, id_product: str, group_selection: dict) -> dict | None:
    """group_selection: {id_attribute_group: id_attribute}"""
    params = {"action": "Refresh", "ajax": "1", "id_product": id_product}
    for group_id, attr_id in group_selection.items():
        params[f"group[{group_id}]"] = attr_id
    r = await client.get(product_url, headers=AJAX_HEADERS, params=params, timeout=30, follow_redirects=True)
    r.raise_for_status()
    data = r.json()
    details_html = data.get("product_details", "")
    m = re.search(r'data-product="([^"]*)"', details_html)
    if not m:
        return None
    return json.loads(html.unescape(m.group(1)))


async def scrape_product_detail(client: httpx.AsyncClient, url: str, category: str) -> dict | None:
    r = await client.get(url, headers=HEADERS, timeout=30, follow_redirects=True)
    if r.status_code != 200:
        print(f"  ! {url} -> HTTP {r.status_code}")
        return None
    soup = BeautifulSoup(r.text, "lxml")
    base_json = extract_product_json(r.text)
    if not base_json:
        print(f"  ! pas de data-product trouvé sur {url}")
        return None

    record = clean_product_record(base_json)
    record["categories"] = [category]

    # EAN13 : présent dans le bloc "Références spécifiques" du tab-pane, pas
    # toujours accessible autrement -> on va le chercher dans le HTML si absent.
    if not record["ean13"]:
        ean_tag = soup.find("dt", string=re.compile("EAN-13"))
        if ean_tag:
            dd = ean_tag.find_next_sibling("dd")
            if dd:
                record["ean13"] = dd.get_text(strip=True)
    if not record["reference"]:
        ref_tag = soup.select_one(".product-reference span[itemprop='sku']")
        if ref_tag:
            record["reference"] = ref_tag.get_text(strip=True)

    # Variations (attributs Couleur / Taille etc.)
    variants_container = soup.select_one(".product-variants.js-product-variants")
    variations = []
    if variants_container:
        selects = variants_container.select("select[data-product-attribute]")
        groups = {}  # group_id -> list of (attr_id, label)
        for sel in selects:
            group_id = sel.get("data-product-attribute")
            options = []
            for opt in sel.select("option"):
                val = opt.get("value")
                if val:
                    options.append(val)
            if group_id and options:
                groups[group_id] = options

        if groups:
            product_id = base_json.get("id_product")
            group_ids = list(groups.keys())
            combos = list(iter_product(*[groups[g] for g in group_ids]))
            for combo in combos:
                selection = dict(zip(group_ids, combo))
                try:
                    combo_json = await fetch_combination(client, url, str(product_id), selection)
                except Exception as e:
                    print(f"    ! combinaison {selection} échouée : {e}")
                    continue
                if not combo_json:
                    continue
                variations.append(clean_product_record(combo_json))

    record["variations"] = variations
    return record


async def main():
    async with httpx.AsyncClient() as client:
        all_listing = []
        print("Scraping listing catégorie principale : Accessoires")
        all_listing.extend(await scrape_category_listing(client, "Accessoires", ROOT_CATEGORY_URL))

        for sc in SUBCATEGORIES:
            print(f"Scraping listing sous-catégorie : {sc['name']}")
            all_listing.extend(await scrape_category_listing(client, sc["name"], sc["url"]))

        # dédoublonnage par (source_id, catégories fusionnées)
        by_id = {}
        for p in all_listing:
            pid = p["source_id"]
            if pid not in by_id:
                by_id[pid] = {"source_id": pid, "url": p["url"], "categories": [p["category"]]}
            elif p["category"] not in by_id[pid]["categories"]:
                by_id[pid]["categories"].append(p["category"])

        LISTING_FILE.write_text(json.dumps(list(by_id.values()), ensure_ascii=False, indent=2), encoding="utf-8")
        print(f"\n{len(by_id)} produits uniques trouvés. Scraping des fiches détaillées...\n")

        detailed = []
        for i, p in enumerate(by_id.values(), 1):
            print(f"[{i}/{len(by_id)}] {p['url']}")
            record = await scrape_product_detail(client, p["url"], p["categories"][0])
            if record:
                record["categories"] = p["categories"]
                detailed.append(record)

    OUT_FILE.write_text(json.dumps(detailed, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"\nOK: {len(detailed)} fiches produits écrites dans {OUT_FILE}")


if __name__ == "__main__":
    asyncio.run(main())
