"""
Export tous les produits WooCommerce (toutes fiches produit complètes) vers un
dataset exploitable par un chatbot (Gemma3 27b / 12b etc.) :

- data/products_dataset.json   -> liste structurée complète (1 objet par produit)
- data/products_dataset.jsonl  -> 1 ligne JSON par produit avec un champ "document"
                                   (texte narratif prêt pour l'embedding / RAG)

Usage:
    cd backend
    python -m scripts.export_products_dataset
"""
import asyncio
import json
import os
import re
import html
from pathlib import Path

import httpx
from dotenv import load_dotenv

ROOT = Path(__file__).resolve().parent.parent
load_dotenv(ROOT / ".env")

WOO_KEY = os.environ["WOOCOMMERCE_KEY_K"]
WOO_SECRET = os.environ["WOOCOMMERCE_SECRET_K"]
WP_SITE = os.environ["WORDPRESS_SITE_K"]

OUT_DIR = ROOT / "data"
OUT_DIR.mkdir(exist_ok=True)


def strip_html(text: str) -> str:
    text = html.unescape(re.sub(r"<[^>]+>", " ", text or ""))
    return re.sub(r"\s+", " ", text).strip()


async def woo_get(client: httpx.AsyncClient, path: str, params: dict = None):
    url = f"https://{WP_SITE}/wp-json/wc/v3/{path}"
    r = await client.get(url, params=params or {})
    r.raise_for_status()
    return r.json()


STATUS_LABELS = {
    "publish": "publié",
    "private": "privé",
    "draft": "brouillon",
    "pending": "en attente",
}


def build_document(p: dict, variations: list) -> str:
    """Texte narratif dense, en français, pour un moteur RAG / prompt LLM."""
    name = p["name"]
    cats = ", ".join(c["name"] for c in p.get("categories", []))
    tags = ", ".join(t["name"] for t in p.get("tags", []))
    desc = strip_html(p.get("description", ""))
    short = strip_html(p.get("short_description", ""))
    price = p.get("price") or p.get("regular_price") or "0"
    sale = p.get("sale_price")
    stock_status = p.get("stock_status")
    stock_qty = p.get("stock_quantity")
    attrs = p.get("attributes", [])
    attr_lines = []
    for a in attrs:
        opts = ", ".join(a.get("options", []))
        if opts:
            attr_lines.append(f"{a.get('name')}: {opts}")

    lines = [f"Produit : {name}"]
    if cats:
        lines.append(f"Catégories : {cats}")
    if tags:
        lines.append(f"Tags : {tags}")
    lines.append(f"Prix : {price} €" + (f" (promo : {sale} €)" if sale else ""))
    lines.append(f"Stock : {stock_status}" + (f" ({stock_qty} unités)" if stock_qty is not None else ""))
    if attr_lines:
        lines.append("Attributs : " + " | ".join(attr_lines))
    if variations:
        var_txt = "; ".join(
            f"{v['name']} à {v['price']} €" for v in variations if v.get("name")
        )
        if var_txt:
            lines.append(f"Variantes disponibles : {var_txt}")
    if short:
        lines.append(f"Résumé : {short}")
    if desc:
        lines.append(f"Description détaillée : {desc}")
    lines.append(f"Statut WordPress : {STATUS_LABELS.get(p.get('status'), p.get('status'))}")
    lines.append(f"Lien : {p.get('permalink', '')}")
    return "\n".join(lines)


async def fetch_variations(client: httpx.AsyncClient, product_id: int):
    try:
        vlist = await woo_get(client, f"products/{product_id}/variations", {"per_page": 100})
    except Exception:
        return []
    out = []
    for v in vlist:
        out.append({
            "id": v["id"],
            "name": " / ".join(a.get("option", "") for a in v.get("attributes", [])) or v.get("sku", ""),
            "price": float(v.get("price") or 0),
            "regular_price": float(v.get("regular_price") or 0) if v.get("regular_price") else None,
            "sale_price": float(v.get("sale_price") or 0) if v.get("sale_price") else None,
            "stock_status": v.get("stock_status"),
            "stock_quantity": v.get("stock_quantity"),
            "sku": v.get("sku"),
            "attributes": {a.get("name", ""): a.get("option", "") for a in v.get("attributes", [])},
            "image": (v.get("image") or {}).get("src"),
        })
    return out


async def main():
    structured = []
    jsonl_rows = []

    async with httpx.AsyncClient(timeout=60, auth=(WOO_KEY, WOO_SECRET), follow_redirects=True) as client:
        page = 1
        total = 0
        while True:
            items = await woo_get(client, "products", {"per_page": 100, "page": page, "status": "any"})
            if not items:
                break
            for p in items:
                variations = []
                if p.get("type") == "variable" and p.get("variations"):
                    variations = await fetch_variations(client, p["id"])

                record = {
                    "id": p["id"],
                    "slug": p.get("slug"),
                    "name": p.get("name"),
                    "sku": p.get("sku"),
                    "type": p.get("type"),
                    "status": p.get("status"),
                    "permalink": p.get("permalink"),
                    "price": float(p.get("price") or 0),
                    "regular_price": float(p.get("regular_price") or 0) if p.get("regular_price") else None,
                    "sale_price": float(p.get("sale_price") or 0) if p.get("sale_price") else None,
                    "stock_status": p.get("stock_status"),
                    "stock_quantity": p.get("stock_quantity"),
                    "categories": [{"id": c["id"], "name": c["name"], "slug": c["slug"]} for c in p.get("categories", [])],
                    "tags": [{"id": t["id"], "name": t["name"], "slug": t["slug"]} for t in p.get("tags", [])],
                    "attributes": [
                        {"name": a.get("name"), "options": a.get("options", [])}
                        for a in p.get("attributes", [])
                    ],
                    "variations": variations,
                    "images": [img["src"] for img in p.get("images", []) if img.get("src")],
                    "short_description": strip_html(p.get("short_description", "")),
                    "description": strip_html(p.get("description", "")),
                    "featured": p.get("featured", False),
                    "average_rating": p.get("average_rating"),
                    "rating_count": p.get("rating_count"),
                }
                record["document"] = build_document(p, variations)
                structured.append(record)
                jsonl_rows.append(record)
                total += 1

            if len(items) < 100:
                break
            page += 1

    (OUT_DIR / "products_dataset.json").write_text(
        json.dumps(structured, ensure_ascii=False, indent=2), encoding="utf-8"
    )
    with (OUT_DIR / "products_dataset.jsonl").open("w", encoding="utf-8") as f:
        for row in jsonl_rows:
            f.write(json.dumps(row, ensure_ascii=False) + "\n")

    print(f"OK: {total} produits exportés vers {OUT_DIR}")


if __name__ == "__main__":
    asyncio.run(main())
