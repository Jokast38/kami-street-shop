"""
Importe les produits scrapés depuis iMooving (data/scraped_imooving_products.json,
généré par scrape_imooving.py) dans WooCommerce, sous la catégorie "Accessoires"
existante (avec sous-catégories créées automatiquement si besoin).

Par sécurité, ce script tourne par défaut en mode --dry-run : il affiche ce
qu'il ferait sans rien écrire dans WooCommerce. Ajouter --execute pour créer
réellement les produits.

Les produits déjà présents (même SKU/référence) sont ignorés.

Usage:
    cd backend
    python -m scripts.import_imooving_to_woocommerce            # dry-run
    python -m scripts.import_imooving_to_woocommerce --execute   # import réel
"""
import argparse
import asyncio
import json
import os
from pathlib import Path
from urllib.parse import urlparse

import httpx
from dotenv import load_dotenv

ROOT = Path(__file__).resolve().parent.parent
load_dotenv(ROOT / ".env")

WOO_KEY = os.environ["WOOCOMMERCE_KEY_K"]
WOO_SECRET = os.environ["WOOCOMMERCE_SECRET_K"]
WP_SITE = os.environ["WORDPRESS_SITE_K"].strip().removeprefix("https://").removeprefix("http://").rstrip("/")
WP_USER = os.environ["WORDPRESS_USER"]
WP_APP_PASSWORD = os.environ["WORDPRESS_APP_PASSWORD_K"]

DATA_FILE = ROOT / "data" / "scraped_imooving_products.json"

SCRAPE_HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
                  "(KHTML, like Gecko) Chrome/124.0 Safari/537.36",
    "Accept-Language": "fr-FR,fr;q=0.9",
}

PARENT_CATEGORY_ID = 195  # "Accessoires" existant dans WooCommerce

# Sous-catégorie source -> nom de catégorie WooCommerce à créer/retrouver sous Accessoires.
# Les produits classés uniquement dans "Accessoires" (catégorie racine du site source)
# restent directement dans la catégorie Accessoires, sans sous-catégorie.
CATEGORY_MAP = {
    "Antivol": "Antivols",
    "Casques": "Casques",
    "Pompes": "Pompes",
    "Sacs et Sacoches": "Sacs et Sacoches",
    "Support smartphone": "Support smartphone",
}

SKU_PREFIX = "IMV-"


async def woo_get(client: httpx.AsyncClient, path: str, params: dict = None):
    url = f"https://{WP_SITE}/wp-json/wc/v3/{path}"
    r = await client.get(url, params=params or {})
    r.raise_for_status()
    return r.json()


async def woo_post(client: httpx.AsyncClient, path: str, payload: dict):
    url = f"https://{WP_SITE}/wp-json/wc/v3/{path}"
    r = await client.post(url, json=payload)
    r.raise_for_status()
    return r.json()


async def get_or_create_category(client: httpx.AsyncClient, name: str, parent_id: int, cache: dict, dry_run: bool) -> int:
    if name in cache:
        return cache[name]
    existing = await woo_get(client, "products/categories", {"search": name, "per_page": 100})
    for c in existing:
        if c["name"].strip().lower() == name.strip().lower() and c.get("parent") == parent_id:
            cache[name] = c["id"]
            return c["id"]
    if dry_run:
        print(f"  [DRY-RUN] créerait la catégorie '{name}' (parent={parent_id})")
        cache[name] = -1  # placeholder
        return -1
    created = await woo_post(client, "products/categories", {"name": name, "parent": parent_id})
    cache[name] = created["id"]
    print(f"  Catégorie créée : {name} (id={created['id']})")
    return created["id"]


async def sku_exists(client: httpx.AsyncClient, sku: str) -> bool:
    if not sku:
        return False
    results = await woo_get(client, "products", {"sku": sku})
    return len(results) > 0


async def upload_image_to_wp(scrape_client: httpx.AsyncClient, wp_client: httpx.AsyncClient, url: str, cache: dict[str, int]) -> int | None:
    """Télécharge une image depuis le site source puis l'envoie dans la médiathèque
    WordPress ; retourne l'id media WordPress (réutilisable tel quel dans WooCommerce
    via {"id": ...}, sans que WooCommerce ait besoin de re-télécharger l'image lui-même)."""
    if url in cache:
        return cache[url]

    for attempt in range(4):
        try:
            r = await scrape_client.get(url, headers=SCRAPE_HEADERS, timeout=30, follow_redirects=True)
            if r.status_code == 200:
                break
        except httpx.HTTPError:
            pass
        await asyncio.sleep(2 * (attempt + 1))
    else:
        print(f"    ! téléchargement impossible : {url}")
        return None

    filename = Path(urlparse(url).path).name or "image.jpg"
    content_type = r.headers.get("content-type", "image/jpeg")

    for attempt in range(3):
        try:
            wr = await wp_client.post(
                f"https://{WP_SITE}/wp-json/wp/v2/media",
                content=r.content,
                headers={
                    "Content-Type": content_type,
                    "Content-Disposition": f'attachment; filename="{filename}"',
                },
                auth=(WP_USER, WP_APP_PASSWORD),
                timeout=60,
            )
            if wr.status_code in (200, 201):
                media_id = wr.json()["id"]
                cache[url] = media_id
                return media_id
            if wr.status_code == 429:
                await asyncio.sleep(3 * (attempt + 1))
                continue
            print(f"    ! upload WP media échoué ({wr.status_code}) : {wr.text[:200]}")
            return None
        except httpx.HTTPError as e:
            print(f"    ! upload WP media erreur réseau : {e}")
            await asyncio.sleep(2)
    return None


async def build_images(scrape_client: httpx.AsyncClient, wp_client: httpx.AsyncClient, urls: list[str], cache: dict[str, int]) -> list[dict]:
    images = []
    for u in urls:
        if not u:
            continue
        print(f"    image: {u}", flush=True)
        media_id = await upload_image_to_wp(scrape_client, wp_client, u, cache)
        if media_id:
            images.append({"id": media_id})
    return images


def build_product_payload(p: dict, category_ids: list[int], images: list[dict]) -> dict:
    sku = f"{SKU_PREFIX}{p['reference']}" if p.get("reference") else f"{SKU_PREFIX}{p['source_id']}"
    payload = {
        "name": p["name"],
        "type": "variable" if p.get("variations") else "simple",
        "sku": sku,
        "description": p.get("description") or "",
        "short_description": p.get("description_short") or "",
        "regular_price": str(p["price"]) if p.get("price") is not None else "0",
        "categories": [{"id": cid} for cid in category_ids],
        "images": images,
        "manage_stock": False,
        "meta_data": [
            {"key": "_imooving_source_url", "value": p.get("url") or ""},
            {"key": "_imooving_source_id", "value": str(p.get("source_id") or "")},
            {"key": "_imooving_brand", "value": p.get("brand") or ""},
        ],
    }

    if p.get("variations"):
        attr_groups: dict[str, set] = {}
        for v in p["variations"]:
            for group, value in v.get("attributes", {}).items():
                attr_groups.setdefault(group, set()).add(value)
        payload["attributes"] = [
            {
                "name": group,
                "options": sorted(values),
                "variation": True,
                "visible": True,
            }
            for group, values in attr_groups.items()
        ]
    return payload


def build_variation_payload(v: dict, image: dict | None) -> dict:
    payload = {
        "regular_price": str(v["price"]) if v.get("price") is not None else "0",
        "sku": f"{SKU_PREFIX}{v['reference']}" if v.get("reference") else None,
        "attributes": [
            {"name": group, "option": value}
            for group, value in v.get("attributes", {}).items()
        ],
    }
    if image:
        payload["image"] = image
    return payload


async def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--execute", action="store_true", help="Exécute réellement l'import (par défaut : dry-run)")
    args = parser.parse_args()
    dry_run = not args.execute

    products = json.loads(DATA_FILE.read_text(encoding="utf-8"))
    print(f"{len(products)} produits à traiter. Mode : {'DRY-RUN (aucune écriture)' if dry_run else 'EXECUTE (écriture réelle)'}\n")

    category_cache: dict[str, int] = {}
    image_cache: dict[str, int] = {}
    created, skipped, errors = 0, 0, 0

    async with httpx.AsyncClient(timeout=60, auth=(WOO_KEY, WOO_SECRET), follow_redirects=True) as client, \
               httpx.AsyncClient(timeout=30) as scrape_client, \
               httpx.AsyncClient(timeout=60) as wp_client:
        for i, p in enumerate(products, 1):
            sku = f"{SKU_PREFIX}{p['reference']}" if p.get("reference") else f"{SKU_PREFIX}{p['source_id']}"
            print(f"[{i}/{len(products)}] {p['name']} (sku={sku})")

            if not dry_run and await sku_exists(client, sku):
                print("  -> déjà présent, ignoré")
                skipped += 1
                continue

            category_ids = []
            for src_cat in p["categories"]:
                if src_cat == "Accessoires":
                    category_ids.append(PARENT_CATEGORY_ID)
                    continue
                target_name = CATEGORY_MAP.get(src_cat, src_cat)
                cid = await get_or_create_category(client, target_name, PARENT_CATEGORY_ID, category_cache, dry_run)
                if cid and cid != -1:
                    category_ids.append(cid)
            if not category_ids:
                category_ids = [PARENT_CATEGORY_ID]

            if dry_run:
                print(f"  [DRY-RUN] créerait produit type={'variable' if p.get('variations') else 'simple'} "
                      f"prix={p.get('price')}€ images={len(p.get('images', []))} categories={category_ids} "
                      f"variations={len(p.get('variations', []))}")
                created += 1
                continue

            images = await build_images(scrape_client, wp_client, p.get("images", []), image_cache)
            payload = build_product_payload(p, category_ids, images)

            try:
                new_product = await woo_post(client, "products", payload)
                print(f"  -> créé (id={new_product['id']}, {len(images)} image(s))")
                created += 1

                for v in p.get("variations", []):
                    var_image = None
                    if v.get("images"):
                        media_id = await upload_image_to_wp(scrape_client, wp_client, v["images"][0], image_cache)
                        if media_id:
                            var_image = {"id": media_id}
                    var_payload = build_variation_payload(v, var_image)
                    await woo_post(client, f"products/{new_product['id']}/variations", var_payload)
                if p.get("variations"):
                    print(f"    {len(p['variations'])} variation(s) créée(s)")
            except httpx.HTTPStatusError as e:
                print(f"  ! erreur : {e.response.status_code} {e.response.text[:300]}")
                errors += 1

    print(f"\nRésumé : {created} créés, {skipped} ignorés (déjà présents), {errors} erreurs")
    if dry_run:
        print("\nCeci était un DRY-RUN. Relancez avec --execute pour importer réellement.")


if __name__ == "__main__":
    asyncio.run(main())
