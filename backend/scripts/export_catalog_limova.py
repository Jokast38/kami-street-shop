"""
Export léger du catalogue produits (WooCommerce, produits publiés uniquement)
au format attendu par les agents Limova (chat web + WhatsApp) :

- docs/whatsapp-limova/catalogue-limova.json  -> liste compacte structurée
- docs/whatsapp-limova/catalogue-limova.txt   -> même contenu en texte brut,
                                                  prêt à coller dans la variable
                                                  {{catalogue}} de Limova

Usage:
    cd backend
    python -m scripts.export_catalog_limova
"""
import asyncio
import json
import os
from pathlib import Path

import httpx
from dotenv import load_dotenv

ROOT = Path(__file__).resolve().parent.parent
load_dotenv(ROOT / ".env")

WOO_KEY = os.environ["WOOCOMMERCE_KEY_K"]
WOO_SECRET = os.environ["WOOCOMMERCE_SECRET_K"]
WP_SITE = os.environ["WORDPRESS_SITE_K"].rstrip("/")
if not WP_SITE.startswith("http"):
    WP_SITE = f"https://{WP_SITE}"

OUT_DIR = ROOT.parent / "docs" / "whatsapp-limova"
OUT_DIR.mkdir(parents=True, exist_ok=True)


async def woo_get(client: httpx.AsyncClient, path: str, params: dict = None):
    url = f"{WP_SITE}/wp-json/wc/v3/{path}"
    r = await client.get(url, params=params or {})
    r.raise_for_status()
    return r.json()


def truncate(text: str, n: int = 220) -> str:
    text = (text or "").strip()
    if len(text) <= n:
        return text
    return text[:n].rsplit(" ", 1)[0] + "…"


async def main():
    catalog = []

    async with httpx.AsyncClient(timeout=60, auth=(WOO_KEY, WOO_SECRET), follow_redirects=True) as client:
        page = 1
        while True:
            items = await woo_get(client, "products", {"per_page": 100, "page": page, "status": "publish"})
            if not items:
                break
            for p in items:
                price = float(p.get("price") or p.get("regular_price") or 0)
                sale_price = float(p.get("sale_price")) if p.get("sale_price") else None
                regular_price = float(p.get("regular_price")) if p.get("regular_price") else None
                stock_status = p.get("stock_status")
                stock_label = {
                    "instock": "en stock",
                    "outofstock": "en rupture de stock",
                    "onbackorder": "sur commande",
                }.get(stock_status, stock_status or "inconnu")

                catalog.append({
                    "slug": p.get("slug"),
                    "nom": p.get("name"),
                    "prix": sale_price or price,
                    "prix_normal": regular_price if sale_price else None,
                    "stock": stock_label,
                    "stock_quantite": p.get("stock_quantity"),
                    "categories": [c["name"] for c in p.get("categories", [])],
                    "description_courte": truncate(
                        __import__("re").sub(r"<[^>]+>", " ", p.get("short_description") or p.get("description") or "")
                    ),
                })

            if len(items) < 100:
                break
            page += 1

    (OUT_DIR / "catalogue-limova.json").write_text(
        json.dumps(catalog, ensure_ascii=False, indent=2), encoding="utf-8"
    )

    lines = []
    for p in catalog:
        price_txt = f"{p['prix']:.2f} €"
        if p.get("prix_normal"):
            price_txt += f" (prix normal {p['prix_normal']:.2f} €)"
        cats = ", ".join(p["categories"]) or "non catégorisé"
        lines.append(
            f"- {p['nom']} | {price_txt} | {p['stock']} | catégories: {cats} | {p['description_courte']}"
        )
    (OUT_DIR / "catalogue-limova.txt").write_text("\n".join(lines), encoding="utf-8")

    print(f"OK: {len(catalog)} produits publiés exportés vers {OUT_DIR}")


if __name__ == "__main__":
    asyncio.run(main())
