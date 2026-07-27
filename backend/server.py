import os
import logging
import re
import html
from pathlib import Path
from datetime import datetime, timezone, timedelta
from typing import List, Optional, Any, Dict

from fastapi import FastAPI, APIRouter, HTTPException, Depends, Request, Query, status
from fastapi.security import OAuth2PasswordBearer
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
from pydantic import BaseModel, Field, EmailStr
import uuid
import bcrypt
import jwt
import httpx
import stripe
from slugify import slugify

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / ".env")

# Config
MONGO_URL = os.environ["MONGO_URL"]
DB_NAME = os.environ["DB_NAME"]
JWT_SECRET = os.environ["JWT_SECRET"]
JWT_ALG = os.environ.get("JWT_ALG", "HS256")
ADMIN_EMAIL = os.environ["ADMIN_EMAIL"]
ADMIN_INITIAL_PASSWORD = os.environ["ADMIN_INITIAL_PASSWORD"]

FRONTEND_URL = os.environ["FRONTEND_URL"]
STRIPE_SECRET_KEY = os.environ.get("STRIPE_SECRET_KEY") or "sk_test_emergent"
STRIPE_WEBHOOK_SECRET = os.environ.get("STRIPE_WEBHOOK_SECRET", "")
stripe.api_key = STRIPE_SECRET_KEY

BREVO_API_KEY = os.environ["BREVO_V3_API_KEY"]
BREVO_SENDER_EMAIL = os.environ["BREVO_SENDER_EMAIL"]
BREVO_SENDER_NAME = os.environ["BREVO_SENDER_NAME"]

WOO_KEY = os.environ["WOOCOMMERCE_KEY_K"]
WOO_SECRET = os.environ["WOOCOMMERCE_SECRET_K"]
WP_SITE = os.environ["WORDPRESS_SITE_K"]
WP_USER = os.environ["WORDPRESS_USER"]
WP_APP_PWD = os.environ["WORDPRESS_APP_PASSWORD_K"]

WP_BASE = f"https://{WP_SITE}" if not WP_SITE.startswith("http") else WP_SITE

# MongoDB
client = AsyncIOMotorClient(MONGO_URL)
db = client[DB_NAME]

# App
app = FastAPI(title="Kami Street API")
api = APIRouter(prefix="/api")
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/auth/login", auto_error=False)


# ----------------------------- Utils -----------------------------
def strip_html(text: str) -> str:
    return html.unescape(re.sub(r"<[^>]+>", "", text or "")).strip()


def decode_html(text: str) -> str:
    return html.unescape(text or "").strip()


def now_iso():
    return datetime.now(timezone.utc).isoformat()


def hash_pw(pw: str) -> str:
    return bcrypt.hashpw(pw.encode(), bcrypt.gensalt()).decode()


def verify_pw(pw: str, hashed: str) -> bool:
    return bcrypt.checkpw(pw.encode(), hashed.encode())


def make_token(email: str) -> str:
    payload = {
        "sub": email,
        "exp": datetime.now(timezone.utc) + timedelta(hours=12),
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALG)


async def current_admin(token: Optional[str] = Depends(oauth2_scheme)):
    if not token:
        raise HTTPException(401, "Missing token")
    try:
        data = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALG])
        user = await db.users.find_one({"email": data["sub"], "role": "admin"}, {"_id": 0})
    except Exception:
        raise HTTPException(401, "Invalid token")
    if not user:
        raise HTTPException(401, "Not authorized")
    return user


def clean(doc: dict) -> dict:
    if not doc:
        return doc
    doc.pop("_id", None)
    return doc


# ----------------------------- Models -----------------------------
class LoginIn(BaseModel):
    email: EmailStr
    password: str


class ProductVariation(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str = ""
    price: float
    stock: int = 0
    attributes: Dict[str, str] = {}
    image: Optional[str] = None


class ProductIn(BaseModel):
    name: str
    slug: Optional[str] = None
    description: str = ""
    short_description: str = ""
    price: float
    sale_price: Optional[float] = None
    stock: int = 0
    categories: List[str] = []
    images: List[str] = []
    variations: List[ProductVariation] = []
    featured: bool = False
    active: bool = True


class BlogIn(BaseModel):
    title: str
    slug: Optional[str] = None
    content: str
    excerpt: str = ""
    featured_image: Optional[str] = None
    categories: List[str] = []
    published: bool = True


class BannerIn(BaseModel):
    title: str
    subtitle: str = ""
    image: str
    cta_text: str = "Shop Now"
    cta_link: str = "/shop"
    active: bool = True
    order: int = 0


class CartItem(BaseModel):
    product_id: str
    variation_id: Optional[str] = None
    name: str
    price: float
    quantity: int
    image: Optional[str] = None


class CheckoutIn(BaseModel):
    items: List[CartItem]
    customer_email: EmailStr
    customer_name: str
    shipping_address: Dict[str, str]
    origin_url: str


# ----------------------------- Brevo email -----------------------------
async def send_email(to_email: str, to_name: str, subject: str, html: str):
    payload = {
        "sender": {"name": BREVO_SENDER_NAME, "email": BREVO_SENDER_EMAIL},
        "to": [{"email": to_email, "name": to_name}],
        "subject": subject,
        "htmlContent": html,
    }
    headers = {
        "api-key": BREVO_API_KEY,
        "accept": "application/json",
        "content-type": "application/json",
    }
    try:
        async with httpx.AsyncClient(timeout=15) as c:
            r = await c.post("https://api.brevo.com/v3/smtp/email", json=payload, headers=headers)
            return r.status_code, r.text
    except Exception as e:
        logging.error(f"Brevo error: {e}")
        return 500, str(e)


def order_email_html(order: dict, admin: bool = False) -> str:
    items_html = "".join(
        f"<tr><td style='padding:8px;border-bottom:1px solid #eee'>{i['name']} × {i['quantity']}</td>"
        f"<td style='padding:8px;border-bottom:1px solid #eee;text-align:right'>{i['price']*i['quantity']:.2f} €</td></tr>"
        for i in order["items"]
    )
    title = "Nouvelle commande reçue" if admin else "Confirmation de commande"
    intro = (
        f"Nouvelle commande #{order['order_no']} de {order['customer_name']} ({order['customer_email']})"
        if admin
        else f"Merci pour votre commande #{order['order_no']} chez Kami Street !"
    )
    return f"""
    <div style="font-family:Arial,sans-serif;max-width:600px;margin:auto;background:#09090B;color:#FAFAFA;padding:24px">
      <h1 style="color:#E2FF31;letter-spacing:2px">KAMI STREET</h1>
      <h2>{title}</h2>
      <p>{intro}</p>
      <table style="width:100%;border-collapse:collapse;background:#18181B;margin:16px 0">
        {items_html}
        <tr><td style="padding:8px;font-weight:bold">TOTAL</td>
        <td style="padding:8px;text-align:right;color:#E2FF31;font-weight:bold">{order['total']:.2f} €</td></tr>
      </table>
      <p><strong>Adresse de livraison :</strong><br>{order['customer_name']}<br>{order['shipping_address'].get('line1','')}<br>{order['shipping_address'].get('postal_code','')} {order['shipping_address'].get('city','')}<br>{order['shipping_address'].get('country','')}</p>
      <p style="opacity:.7;font-size:12px">Kami Street · kamistreet.fr</p>
    </div>
    """


# ----------------------------- Startup: seed admin -----------------------------
@app.on_event("startup")
async def startup():
    existing = await db.users.find_one({"email": ADMIN_EMAIL})
    if not existing:
        await db.users.insert_one(
            {
                "id": str(uuid.uuid4()),
                "email": ADMIN_EMAIL,
                "password_hash": hash_pw(ADMIN_INITIAL_PASSWORD),
                "role": "admin",
                "created_at": now_iso(),
            }
        )
        logging.info(f"Seeded admin: {ADMIN_EMAIL}")
    # indexes
    await db.products.create_index("slug", unique=True, sparse=True)
    await db.blog.create_index("slug", unique=True, sparse=True)
    await db.orders.create_index("order_no", unique=True, sparse=True)


# ----------------------------- Auth routes -----------------------------
@api.post("/auth/login")
async def login(body: LoginIn):
    user = await db.users.find_one({"email": body.email, "role": "admin"})
    if not user or not verify_pw(body.password, user["password_hash"]):
        raise HTTPException(400, "Identifiants invalides")
    return {"access_token": make_token(user["email"]), "token_type": "bearer", "email": user["email"]}


@api.get("/auth/me")
async def me(user=Depends(current_admin)):
    return {"email": user["email"], "role": user["role"]}


# ----------------------------- Public catalog -----------------------------
@api.get("/products")
async def list_products(
    category: Optional[str] = None,
    min_price: Optional[float] = None,
    max_price: Optional[float] = None,
    featured: Optional[bool] = None,
    search: Optional[str] = None,
    limit: int = 100,
):
    q: Dict[str, Any] = {"active": True}
    if category:
        q["categories"] = category
    if featured is not None:
        q["featured"] = featured
    if min_price is not None or max_price is not None:
        q["price"] = {}
        if min_price is not None:
            q["price"]["$gte"] = min_price
        if max_price is not None:
            q["price"]["$lte"] = max_price
    if search:
        q["name"] = {"$regex": re.escape(search), "$options": "i"}
    docs = await db.products.find(q, {"_id": 0}).limit(limit).to_list(limit)
    return docs


@api.get("/products/{slug}")
async def get_product(slug: str):
    p = await db.products.find_one({"slug": slug, "active": True}, {"_id": 0})
    if not p:
        raise HTTPException(404, "Produit introuvable")
    return p


@api.get("/categories")
async def list_categories():
    docs = await db.categories.find({}, {"_id": 0}).to_list(500)
    return docs


@api.get("/blog")
async def list_blog(limit: int = 50):
    docs = (
        await db.blog.find({"published": True}, {"_id": 0}).sort("published_at", -1).limit(limit).to_list(limit)
    )
    return docs


@api.get("/blog/{slug}")
async def get_blog(slug: str):
    p = await db.blog.find_one({"slug": slug, "published": True}, {"_id": 0})
    if not p:
        raise HTTPException(404, "Article introuvable")
    return p


@api.get("/banners")
async def list_banners():
    docs = await db.banners.find({"active": True}, {"_id": 0}).sort("order", 1).to_list(50)
    return docs


# ----------------------------- Admin: Products CRUD -----------------------------
@api.post("/admin/products")
async def create_product(body: ProductIn, user=Depends(current_admin)):
    p = body.model_dump()
    p["slug"] = p.get("slug") or slugify(body.name)
    p["id"] = str(uuid.uuid4())
    p["created_at"] = now_iso()
    p["updated_at"] = now_iso()
    await db.products.insert_one(p)
    return clean(p)


@api.put("/admin/products/{pid}")
async def update_product(pid: str, body: ProductIn, user=Depends(current_admin)):
    upd = body.model_dump()
    upd["slug"] = upd.get("slug") or slugify(body.name)
    upd["updated_at"] = now_iso()
    r = await db.products.update_one({"id": pid}, {"$set": upd})
    if r.matched_count == 0:
        raise HTTPException(404, "Not found")
    return {"ok": True}


@api.delete("/admin/products/{pid}")
async def delete_product(pid: str, user=Depends(current_admin)):
    await db.products.delete_one({"id": pid})
    return {"ok": True}


@api.get("/admin/products")
async def admin_products(user=Depends(current_admin)):
    return await db.products.find({}, {"_id": 0}).to_list(1000)


# ----------------------------- Admin: Blog CRUD -----------------------------
@api.post("/admin/blog")
async def create_blog(body: BlogIn, user=Depends(current_admin)):
    p = body.model_dump()
    p["slug"] = p.get("slug") or slugify(body.title)
    p["id"] = str(uuid.uuid4())
    p["published_at"] = now_iso()
    await db.blog.insert_one(p)
    return clean(p)


@api.put("/admin/blog/{bid}")
async def update_blog(bid: str, body: BlogIn, user=Depends(current_admin)):
    upd = body.model_dump()
    upd["slug"] = upd.get("slug") or slugify(body.title)
    r = await db.blog.update_one({"id": bid}, {"$set": upd})
    if r.matched_count == 0:
        raise HTTPException(404, "Not found")
    return {"ok": True}


@api.delete("/admin/blog/{bid}")
async def delete_blog(bid: str, user=Depends(current_admin)):
    await db.blog.delete_one({"id": bid})
    return {"ok": True}


@api.get("/admin/blog")
async def admin_blog(user=Depends(current_admin)):
    return await db.blog.find({}, {"_id": 0}).to_list(1000)


# ----------------------------- Admin: Banners CRUD -----------------------------
@api.post("/admin/banners")
async def create_banner(body: BannerIn, user=Depends(current_admin)):
    p = body.model_dump()
    p["id"] = str(uuid.uuid4())
    await db.banners.insert_one(p)
    return clean(p)


@api.put("/admin/banners/{bid}")
async def update_banner(bid: str, body: BannerIn, user=Depends(current_admin)):
    r = await db.banners.update_one({"id": bid}, {"$set": body.model_dump()})
    if r.matched_count == 0:
        raise HTTPException(404, "Not found")
    return {"ok": True}


@api.delete("/admin/banners/{bid}")
async def delete_banner(bid: str, user=Depends(current_admin)):
    await db.banners.delete_one({"id": bid})
    return {"ok": True}


@api.get("/admin/banners")
async def admin_banners(user=Depends(current_admin)):
    return await db.banners.find({}, {"_id": 0}).sort("order", 1).to_list(500)


# ----------------------------- Admin: Orders -----------------------------
@api.get("/admin/orders")
async def admin_orders(user=Depends(current_admin)):
    return await db.orders.find({}, {"_id": 0}).sort("created_at", -1).to_list(1000)


@api.put("/admin/orders/{oid}/status")
async def update_order_status(oid: str, body: Dict[str, str], user=Depends(current_admin)):
    new_status = body.get("status")
    if new_status not in {"pending", "paid", "shipped", "cancelled"}:
        raise HTTPException(400, "Invalid status")
    r = await db.orders.update_one({"id": oid}, {"$set": {"status": new_status, "updated_at": now_iso()}})
    if r.matched_count == 0:
        raise HTTPException(404, "Not found")
    return {"ok": True}


@api.get("/admin/stats")
async def admin_stats(user=Depends(current_admin)):
    total_products = await db.products.count_documents({})
    total_orders = await db.orders.count_documents({})
    total_paid = await db.orders.count_documents({"status": "paid"})
    total_blog = await db.blog.count_documents({})
    revenue_docs = await db.orders.find({"status": {"$in": ["paid", "shipped"]}}, {"total": 1, "_id": 0}).to_list(10000)
    revenue = sum(d.get("total", 0) for d in revenue_docs)
    return {
        "total_products": total_products,
        "total_orders": total_orders,
        "paid_orders": total_paid,
        "total_blog": total_blog,
        "revenue": round(revenue, 2),
    }


# ----------------------------- Checkout (Stripe) -----------------------------
@api.post("/checkout/session")
async def create_checkout_session(body: CheckoutIn):
    if not body.items:
        raise HTTPException(400, "Panier vide")
    # Verify prices server-side
    total = 0.0
    line_items = []
    for it in body.items:
        prod = await db.products.find_one({"id": it.product_id}, {"_id": 0})
        if not prod:
            raise HTTPException(400, f"Produit introuvable: {it.product_id}")
        unit_price = prod.get("sale_price") or prod["price"]
        if it.variation_id:
            for v in prod.get("variations", []):
                if v["id"] == it.variation_id:
                    unit_price = v["price"]
                    break
        total += unit_price * it.quantity
        line_items.append(
            {
                "price_data": {
                    "currency": "eur",
                    "product_data": {"name": prod["name"], "images": prod.get("images", [])[:1]},
                    "unit_amount": int(round(unit_price * 100)),
                },
                "quantity": it.quantity,
            }
        )

    order_no = f"KS-{datetime.now(timezone.utc).strftime('%Y%m%d')}-{uuid.uuid4().hex[:6].upper()}"
    order_id = str(uuid.uuid4())
    order = {
        "id": order_id,
        "order_no": order_no,
        "items": [i.model_dump() for i in body.items],
        "customer_email": body.customer_email,
        "customer_name": body.customer_name,
        "shipping_address": body.shipping_address,
        "total": round(total, 2),
        "status": "pending",
        "payment_status": "pending",
        "created_at": now_iso(),
        "updated_at": now_iso(),
    }
    session = stripe.checkout.Session.create(
        mode="payment",
        line_items=line_items,
        customer_email=body.customer_email,
        success_url=f"{body.origin_url}/checkout/success?session_id={{CHECKOUT_SESSION_ID}}",
        cancel_url=f"{body.origin_url}/checkout/cancel",
        metadata={"order_id": order_id, "order_no": order_no},
    )
    order["session_id"] = session.id
    await db.orders.insert_one(order)
    return {"checkout_url": session.url, "session_id": session.id, "order_no": order_no}


@api.get("/checkout/status/{session_id}")
async def checkout_status(session_id: str):
    order = await db.orders.find_one({"session_id": session_id}, {"_id": 0})
    if not order:
        raise HTTPException(404, "Order not found")
    # Fall-back sync with Stripe
    if order.get("payment_status") != "paid":
        try:
            s = stripe.checkout.Session.retrieve(session_id)
            if s.payment_status == "paid" or s.status == "complete":
                await db.orders.update_one(
                    {"session_id": session_id, "payment_status": {"$ne": "paid"}},
                    {"$set": {"payment_status": "paid", "status": "paid", "updated_at": now_iso()}},
                )
                order = await db.orders.find_one({"session_id": session_id}, {"_id": 0})
                # send emails
                await send_email(order["customer_email"], order["customer_name"], f"Confirmation commande #{order['order_no']}", order_email_html(order))
                await send_email(ADMIN_EMAIL, "Admin Kami Street", f"Nouvelle commande #{order['order_no']}", order_email_html(order, admin=True))
        except Exception as e:
            logging.error(f"Stripe status sync err: {e}")
    return {
        "order_no": order["order_no"],
        "status": order["status"],
        "payment_status": order["payment_status"],
        "total": order["total"],
    }


@api.post("/stripe/webhook")
async def stripe_webhook(request: Request):
    payload = await request.body()
    sig = request.headers.get("stripe-signature", "")
    try:
        event = stripe.Webhook.construct_event(payload, sig, STRIPE_WEBHOOK_SECRET)
    except Exception:
        raise HTTPException(400, "Invalid signature")
    obj = event["data"]["object"]
    t = event["type"]
    if t == "checkout.session.completed":
        order = await db.orders.find_one({"session_id": obj["id"]}, {"_id": 0})
        if order and order.get("payment_status") != "paid":
            await db.orders.update_one(
                {"session_id": obj["id"], "payment_status": {"$ne": "paid"}},
                {"$set": {"payment_status": "paid", "status": "paid", "updated_at": now_iso()}},
            )
            order["payment_status"] = "paid"
            order["status"] = "paid"
            await send_email(order["customer_email"], order["customer_name"], f"Confirmation commande #{order['order_no']}", order_email_html(order))
            await send_email(ADMIN_EMAIL, "Admin Kami Street", f"Nouvelle commande #{order['order_no']}", order_email_html(order, admin=True))
    return {"ok": True}


# ----------------------------- Migration (WooCommerce + WP) -----------------------------
async def _woo_get(path: str, params: dict = None):
    url = f"https://{WP_SITE}/wp-json/wc/v3/{path}"
    async with httpx.AsyncClient(timeout=60, auth=(WOO_KEY, WOO_SECRET), follow_redirects=True) as c:
        r = await c.get(url, params=params or {})
        r.raise_for_status()
        return r.json()


async def _wp_get(path: str, params: dict = None, auth: bool = True):
    url = f"{WP_BASE}/wp-json/wp/v2/{path}"
    kwargs = {"timeout": 60, "follow_redirects": True}
    if auth:
        kwargs["auth"] = (WP_USER, WP_APP_PWD.replace(" ", ""))
    headers = {"User-Agent": "KamiStreet-Migration/1.0 (+https://kamistreet.fr)"}
    async with httpx.AsyncClient(**kwargs) as c:
        r = await c.get(url, params=params or {}, headers=headers)
        r.raise_for_status()
        return r.json()


@api.post("/admin/sync/woocommerce")
async def sync_woo(user=Depends(current_admin)):
    """Idempotent: uses woo_id as unique key, upserts."""
    imported = 0
    page = 1
    try:
        # Categories first
        cats = await _woo_get("products/categories", {"per_page": 100})
        for c in cats:
            await db.categories.update_one(
                {"woo_id": c["id"]},
                {"$set": {
                    "id": str(c["id"]),
                    "woo_id": c["id"],
                    "name": c["name"],
                    "slug": c["slug"],
                    "count": c.get("count", 0),
                    "image": (c.get("image") or {}).get("src"),
                }},
                upsert=True,
            )

        # Products (paginated)
        while True:
            items = await _woo_get("products", {"per_page": 100, "page": page, "status": "any"})
            if not items:
                break
            for p in items:
                variations = []
                if p.get("type") == "variable" and p.get("variations"):
                    try:
                        vlist = await _woo_get(f"products/{p['id']}/variations", {"per_page": 100})
                        for v in vlist:
                            variations.append({
                                "id": str(v["id"]),
                                "name": " / ".join(a.get("option", "") for a in v.get("attributes", [])) or v.get("sku", ""),
                                "price": float(v.get("price") or 0),
                                "stock": v.get("stock_quantity") or 0,
                                "attributes": {a.get("name", ""): a.get("option", "") for a in v.get("attributes", [])},
                                "image": (v.get("image") or {}).get("src"),
                            })
                    except Exception as e:
                        logging.warning(f"variations err {p['id']}: {e}")

                doc = {
                    "id": str(p["id"]),
                    "woo_id": p["id"],
                    "name": p["name"],
                    "slug": p["slug"] or slugify(p["name"]),
                    "description": strip_html(p.get("description", "")),
                    "short_description": strip_html(p.get("short_description", "")),
                    "price": float(p.get("price") or 0),
                    "sale_price": float(p.get("sale_price")) if p.get("sale_price") else None,
                    "stock": p.get("stock_quantity") or 0,
                    "categories": [c["slug"] for c in p.get("categories", [])],
                    "images": [img["src"] for img in p.get("images", []) if img.get("src")],
                    "variations": variations,
                    "featured": p.get("featured", False),
                    "active": p.get("status") == "publish",
                    "wc_status": p.get("status"),
                    "updated_at": now_iso(),
                }
                await db.products.update_one({"woo_id": p["id"]}, {"$set": doc}, upsert=True)
                imported += 1
            if len(items) < 100:
                break
            page += 1
        return {"imported": imported, "status": "ok"}
    except httpx.HTTPStatusError as e:
        raise HTTPException(500, f"Woo API error: {e.response.status_code} {e.response.text[:200]}")


@api.post("/admin/sync/wordpress")
async def sync_wp(user=Depends(current_admin)):
    imported = 0
    page = 1
    try:
        while True:
            posts = await _wp_get("posts", {"per_page": 50, "page": page, "_embed": 1})
            if not posts:
                break
            for p in posts:
                featured = None
                emb = (p.get("_embedded") or {}).get("wp:featuredmedia") or []
                if emb and emb[0].get("source_url"):
                    featured = emb[0]["source_url"]
                doc = {
                    "id": str(p["id"]),
                    "wp_id": p["id"],
                    "title": decode_html((p.get("title") or {}).get("rendered", "")),
                    "slug": p.get("slug"),
                    "content": (p.get("content") or {}).get("rendered", ""),
                    "excerpt": strip_html((p.get("excerpt") or {}).get("rendered", "")),
                    "featured_image": featured,
                    "categories": [],
                    "published": p.get("status") == "publish",
                    "published_at": p.get("date"),
                }
                await db.blog.update_one({"wp_id": p["id"]}, {"$set": doc}, upsert=True)
                imported += 1
            if len(posts) < 50:
                break
            page += 1
        return {"imported": imported, "status": "ok"}
    except httpx.HTTPStatusError as e:
        raise HTTPException(500, f"WP API error: {e.response.status_code} {e.response.text[:200]}")


@api.post("/admin/sync/media")
async def sync_media(user=Depends(current_admin)):
    """Fetches media from WP and creates default banners if none exist."""
    try:
        media = await _wp_get("media", {"per_page": 20, "media_type": "image"})
        added = 0
        existing = await db.banners.count_documents({})
        if existing == 0:
            for i, m in enumerate(media[:3]):
                src = m.get("source_url")
                if not src:
                    continue
                default_titles = ["FATBIKES × ACCESSOIRES ÉLECTRIQUES", "KAMI STREET — NEW DROP", "RIDE THE CITY"]
                await db.banners.insert_one({
                    "id": str(uuid.uuid4()),
                    "wp_media_id": m["id"],
                    "title": default_titles[i % len(default_titles)],
                    "subtitle": "La collection Kami Street. Fatbikes, scooters, trottinettes & accessoires pour rouler électrique.",
                    "image": src,
                    "cta_text": "Explorer la collection",
                    "cta_link": "/shop",
                    "active": True,
                    "order": i,
                })
                added += 1
        return {"media_count": len(media), "banners_added": added}
    except httpx.HTTPStatusError as e:
        raise HTTPException(500, f"WP media err: {e.response.status_code}")


@api.post("/admin/sync/all")
async def sync_all(user=Depends(current_admin)):
    woo = await sync_woo(user)
    wp = await sync_wp(user)
    media = await sync_media(user)
    return {"woocommerce": woo, "wordpress": wp, "media": media}


# ----------------------------- Health -----------------------------
@api.get("/")
async def root():
    return {"message": "Kami Street API", "status": "ok"}


# ----------------------------- Include & CORS -----------------------------
app.include_router(api)
app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get("CORS_ORIGINS", "*").split(","),
    allow_methods=["*"],
    allow_headers=["*"],
)

logging.basicConfig(level=logging.INFO)


@app.on_event("shutdown")
async def shutdown():
    client.close()
