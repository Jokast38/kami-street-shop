import os
import asyncio
import logging
import re
import html
from io import BytesIO
from pathlib import Path
from datetime import datetime, timezone, timedelta
from typing import List, Optional, Any, Dict

from fastapi import FastAPI, APIRouter, HTTPException, Depends, Request, Query, status, UploadFile, File
from fastapi.responses import RedirectResponse, StreamingResponse
from fastapi.security import OAuth2PasswordBearer
from urllib.parse import urlencode
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
from pymongo import ReturnDocument
from pymongo.errors import PyMongoError
from invoicing import generate_invoice_pdf

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

WC_SYNC_INTERVAL_MINUTES = int(os.environ.get("WC_SYNC_INTERVAL_MINUTES", "30"))

OLLAMA_API_KEY = os.environ.get("OLLAMA_API_KEY", "")
OLLAMA_MODEL = os.environ.get("OLLAMA_MODEL", "gemma3:27b")
OLLAMA_BASE_URL = os.environ.get("OLLAMA_BASE_URL", "https://ollama.com")

QONTO_CLIENT_ID = os.environ.get("QONTO_CLIENT_ID", "")
QONTO_CLIENT_SECRET = os.environ.get("QONTO_CLIENT_SECRET", "")
QONTO_ENV = os.environ.get("QONTO_ENV", "production")  # "production" | "sandbox"
QONTO_STAGING_TOKEN = os.environ.get("QONTO_STAGING_TOKEN", "")
QONTO_REDIRECT_URI = os.environ.get("QONTO_REDIRECT_URI") or f"{FRONTEND_URL}/api/qonto/oauth/callback"
QONTO_OAUTH_BASE = "https://oauth-sandbox.staging.qonto.co" if QONTO_ENV == "sandbox" else "https://oauth.qonto.com"
QONTO_API_BASE = "https://thirdparty.qonto.com"

MOLLIE_API_KEY = os.environ.get("MOLLIE_API_KEY", "")
MOLLIE_MODE = os.environ.get("MOLLIE_MODE", "test")  # "test" | "live"
MOLLIE_API_BASE = "https://api.mollie.com/v2"

ALMA_API_KEY = os.environ.get("ALMA_API_KEY", "").strip()
ALMA_MERCHANT_ID = os.environ.get("ID_ALMA_MERCHANT", "").strip()
ALMA_API_MODE = os.environ.get("ALMA_API_MODE", os.environ.get("ALMA_MODE", "test")).strip().lower()

# Public backend base URL (used to build webhook URLs). Falls back to the Qonto redirect's
# host if not set explicitly, since that one is already known to be publicly reachable.
BACKEND_URL = os.environ.get("BACKEND_URL") or QONTO_REDIRECT_URI.split("/api/")[0]

# MongoDB
client = AsyncIOMotorClient(
    MONGO_URL,
    serverSelectionTimeoutMS=int(os.environ.get("MONGO_SERVER_SELECTION_TIMEOUT_MS", "5000")),
    connectTimeoutMS=int(os.environ.get("MONGO_CONNECT_TIMEOUT_MS", "5000")),
    socketTimeoutMS=int(os.environ.get("MONGO_SOCKET_TIMEOUT_MS", "10000")),
)
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


def normalize_alma_api_base_url(base_url: Optional[str], mode: str) -> str:
    normalized_mode = (mode or "").strip().lower()
    default_base_url = "https://api.getalma.eu" if normalized_mode == "live" else "https://api.sandbox.getalma.eu"
    if not base_url:
        return default_base_url

    cleaned = base_url.strip().rstrip("/")
    if cleaned.endswith("/v1"):
        cleaned = cleaned[:-3]

    if cleaned in {"https://api.getalma.com", "https://api.getalma.com/"}:
        return "https://api.getalma.eu"
    if cleaned in {"https://api.sandbox.getalma.com", "https://api.sandbox.getalma.com/"}:
        return "https://api.sandbox.getalma.eu"
    if cleaned in {"https://api.getalma.eu", "https://api.sandbox.getalma.eu"}:
        return cleaned
    return cleaned


ALMA_API_BASE_URL = normalize_alma_api_base_url(os.environ.get("ALMA_API_BASE_URL"), ALMA_API_MODE)


def alma_auth_headers() -> Dict[str, str]:
    scheme = "Alma-Live-Key" if ALMA_API_MODE == "live" else "Alma-Sandbox-Key"
    return {"Authorization": f"{scheme} {ALMA_API_KEY}", "Accept": "application/json", "Content-Type": "application/json"}


def build_alma_redirect_urls(origin_url: str, order_no: str) -> Dict[str, str]:
    base_origin = (origin_url or FRONTEND_URL).rstrip("/")
    return {
        "success_url": f"{base_origin}/checkout/success?session_id={order_no}",
        "cancel_url": f"{base_origin}/checkout/cancel",
    }


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
    sale_price: Optional[float] = None
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
    brands: List[str] = []
    images: List[str] = []
    variations: List[ProductVariation] = []
    featured: bool = False
    active: bool = True
    bundle_enabled: bool = False
    bundle_quantity: int = 2
    bundle_price: Optional[float] = None


class PromoCodeIn(BaseModel):
    code: str
    discount_type: str = "percent"
    value: float
    min_order: float = 0.0
    expires_at: Optional[str] = None
    max_uses: Optional[int] = None
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
    promo_code: Optional[str] = None
    payment_provider: Optional[str] = None
    payment_option: Optional[str] = None


class PaymentSettingsIn(BaseModel):
    stripe_enabled: bool = True
    qonto_enabled: bool = False
    qonto_business_description: str = ""
    qonto_phone_number: str = ""
    qonto_website_url: str = ""
    qonto_bank_account_id: str = ""
    qonto_vat_rate: str = "20.0"
    mollie_enabled: bool = False
    klarna_enabled: bool = False
    alma_enabled: bool = False


class InvoiceItemIn(BaseModel):
    name: str
    quantity: int = 1
    unit_price: float = 0.0


class InvoiceIn(BaseModel):
    order_id: Optional[str] = None
    order_no: Optional[str] = None
    customer_name: str
    customer_email: EmailStr
    billing_address: Dict[str, str] = Field(default_factory=dict)
    items: List[InvoiceItemIn] = Field(default_factory=list)
    tax_rate: float = 20.0
    notes: str = ""


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


async def _auto_sync_loop():
    """Periodically re-syncs WooCommerce products/categories and WordPress posts,
    so admins don't need to click "Synchroniser" manually for routine updates."""
    while True:
        await asyncio.sleep(WC_SYNC_INTERVAL_MINUTES * 60)
        try:
            woo = await sync_woo(None)
            orders = await sync_woo_orders(None)
            wp = await sync_wp(None)
            await db.settings.update_one(
                {"id": "sync_status"},
                {"$set": {
                    "id": "sync_status",
                    "last_sync_at": now_iso(),
                    "last_sync_ok": True,
                    "woocommerce_imported": woo.get("imported", 0),
                    "orders_imported": orders.get("imported", 0),
                    "wordpress_imported": wp.get("imported", 0),
                }},
                upsert=True,
            )
        except Exception as e:
            logging.error(f"Auto-sync failed: {e}")
            await db.settings.update_one(
                {"id": "sync_status"},
                {"$set": {"id": "sync_status", "last_sync_at": now_iso(), "last_sync_ok": False, "last_sync_error": str(e)}},
                upsert=True,
            )


# ----------------------------- Startup: seed admin -----------------------------
async def _initialize_database():
    while True:
        try:
            await db.command("ping")
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
            await db.products.create_index("slug", unique=True, sparse=True)
            await db.blog.create_index("slug", unique=True, sparse=True)
            await db.orders.create_index("order_no", unique=True, sparse=True)
            logging.info("MongoDB ready")
            app.state.mongo_ready = True
            app.state.sync_task = asyncio.create_task(_auto_sync_loop())
            return
        except PyMongoError as exc:
            app.state.mongo_ready = False
            logging.error("MongoDB unavailable during startup; retrying in 15s: %s", exc)
            await asyncio.sleep(15)


@app.on_event("startup")
async def startup():
    app.state.mongo_ready = False
    app.state.mongo_task = asyncio.create_task(_initialize_database())


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
    brand: Optional[str] = None,
    min_price: Optional[float] = None,
    max_price: Optional[float] = None,
    featured: Optional[bool] = None,
    search: Optional[str] = None,
    limit: int = 100,
):
    q: Dict[str, Any] = {"active": True}
    if category:
        q["categories"] = category
    if brand:
        q["brands"] = brand
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


@api.get("/categories/{slug}")
async def get_category(slug: str):
    doc = await db.categories.find_one({"slug": slug}, {"_id": 0})
    if not doc:
        raise HTTPException(404, "Catégorie introuvable")
    return doc


@api.get("/brands")
async def list_brands():
    docs = await db.brands.find({}, {"_id": 0}).sort("name", 1).to_list(500)
    return docs


@api.get("/brands/{slug}")
async def get_brand(slug: str):
    doc = await db.brands.find_one({"slug": slug}, {"_id": 0})
    if not doc:
        raise HTTPException(404, "Marque introuvable")
    return doc


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


# ----------------------------- Payment settings & Qonto OAuth -----------------------------
DEFAULT_PAYMENT_SETTINGS = {
    "id": "payment_settings",
    "stripe_enabled": True,
    "qonto_enabled": False,
    "qonto_business_description": "",
    "qonto_phone_number": "",
    "qonto_website_url": "",
    "qonto_bank_account_id": "",
    "qonto_vat_rate": "20.0",
    "mollie_enabled": False,
    "klarna_enabled": False,
    "alma_enabled": False,
}


async def get_payment_settings() -> dict:
    doc = await db.settings.find_one({"id": "payment_settings"}, {"_id": 0})
    if not doc:
        doc = dict(DEFAULT_PAYMENT_SETTINGS)
        await db.settings.insert_one(dict(doc))
    return doc


def qonto_authorize_url(state: str) -> str:
    params = {
        "client_id": QONTO_CLIENT_ID,
        "redirect_uri": QONTO_REDIRECT_URI,
        "response_type": "code",
        "scope": "payment_link.write organization.read",
        "state": state,
    }
    return f"{QONTO_OAUTH_BASE}/oauth2/auth?{urlencode(params)}"


async def qonto_token_request(data: dict) -> dict:
    async with httpx.AsyncClient(timeout=30) as c:
        r = await c.post(
            f"{QONTO_OAUTH_BASE}/oauth2/token",
            data=data,
            headers={"Content-Type": "application/x-www-form-urlencoded"},
        )
        r.raise_for_status()
        return r.json()


async def qonto_save_tokens(token_data: dict):
    expires_at = (
        datetime.now(timezone.utc) + timedelta(seconds=token_data.get("expires_in", 3600) - 60)
    ).isoformat()
    await db.qonto_tokens.update_one(
        {"id": "qonto_tokens"},
        {
            "$set": {
                "id": "qonto_tokens",
                "access_token": token_data["access_token"],
                "refresh_token": token_data.get("refresh_token"),
                "expires_at": expires_at,
            }
        },
        upsert=True,
    )


async def get_qonto_access_token() -> str:
    doc = await db.qonto_tokens.find_one({"id": "qonto_tokens"}, {"_id": 0})
    if not doc or not doc.get("access_token"):
        raise HTTPException(400, "Qonto non connecté. Connectez-le depuis le dashboard admin.")
    if datetime.now(timezone.utc) >= datetime.fromisoformat(doc["expires_at"]):
        if not doc.get("refresh_token"):
            raise HTTPException(400, "Session Qonto expirée. Reconnectez-la depuis le dashboard admin.")
        token_data = await qonto_token_request(
            {
                "grant_type": "refresh_token",
                "refresh_token": doc["refresh_token"],
                "client_id": QONTO_CLIENT_ID,
                "client_secret": QONTO_CLIENT_SECRET,
            }
        )
        await qonto_save_tokens(token_data)
        return token_data["access_token"]
    return doc["access_token"]


def qonto_headers(access_token: str) -> dict:
    headers = {"Authorization": f"Bearer {access_token}", "Content-Type": "application/json"}
    if QONTO_ENV == "sandbox" and QONTO_STAGING_TOKEN:
        headers["X-Qonto-Staging-Token"] = QONTO_STAGING_TOKEN
    return headers


@api.get("/admin/settings/payments")
async def admin_get_payment_settings(user=Depends(current_admin)):
    settings = await get_payment_settings()
    tokens = await db.qonto_tokens.find_one({"id": "qonto_tokens"}, {"_id": 0})
    settings["qonto_connected"] = bool(tokens and tokens.get("access_token"))
    return settings


@api.put("/admin/settings/payments")
async def admin_update_payment_settings(body: PaymentSettingsIn, user=Depends(current_admin)):
    await db.settings.update_one({"id": "payment_settings"}, {"$set": body.model_dump()}, upsert=True)
    return {"ok": True}


@api.get("/payment-methods")
async def public_payment_methods():
    settings = await get_payment_settings()
    tokens = await db.qonto_tokens.find_one({"id": "qonto_tokens"}, {"_id": 0})
    qonto_ready = bool(settings.get("qonto_enabled") and tokens and tokens.get("access_token"))
    mollie_ready = bool(settings.get("mollie_enabled") and MOLLIE_API_KEY)
    klarna_ready = bool(mollie_ready and settings.get("klarna_enabled"))
    alma_ready = bool(mollie_ready and settings.get("alma_enabled"))
    return {
        "stripe": bool(settings.get("stripe_enabled", True)),
        "qonto": qonto_ready,
        "mollie": mollie_ready,
        "klarna": klarna_ready,
        "alma": alma_ready,
    }


@api.get("/admin/qonto/authorize-url")
async def admin_qonto_authorize_url(user=Depends(current_admin)):
    if not QONTO_CLIENT_ID or not QONTO_CLIENT_SECRET:
        raise HTTPException(500, "QONTO_CLIENT_ID / QONTO_CLIENT_SECRET manquants dans la configuration")
    state = str(uuid.uuid4())
    await db.qonto_oauth_state.update_one({"id": "state"}, {"$set": {"id": "state", "value": state}}, upsert=True)
    return {"url": qonto_authorize_url(state)}


@api.get("/qonto/oauth/callback")
async def qonto_oauth_callback(code: Optional[str] = None, state: Optional[str] = None, error: Optional[str] = None):
    if error or not code:
        return RedirectResponse(f"{FRONTEND_URL}/admin?qonto_error={error or 'missing_code'}")

    try:
        token_data = await qonto_token_request(
            {
                "grant_type": "authorization_code",
                "code": code,
                "client_id": QONTO_CLIENT_ID,
                "client_secret": QONTO_CLIENT_SECRET,
                "redirect_uri": QONTO_REDIRECT_URI,
            }
        )
        await qonto_save_tokens(token_data)
    except Exception as e:
        logging.error(f"Qonto OAuth exchange error: {e}")
        return RedirectResponse(f"{FRONTEND_URL}/admin?qonto_error=oauth_failed")

    settings = await get_payment_settings()
    access_token = await get_qonto_access_token()

    # Auto-fill the bank account id (an internal Qonto UUID, not the IBAN) if not already set
    if not settings.get("qonto_bank_account_id"):
        try:
            async with httpx.AsyncClient(timeout=30) as c:
                r = await c.get(f"{QONTO_API_BASE}/v2/organization", headers=qonto_headers(access_token))
                r.raise_for_status()
                accounts = r.json().get("organization", {}).get("bank_accounts", [])
            main_account = next((a for a in accounts if a.get("main")), accounts[0] if accounts else None)
            if main_account:
                settings["qonto_bank_account_id"] = main_account["id"]
                await db.settings.update_one(
                    {"id": "payment_settings"},
                    {"$set": {"qonto_bank_account_id": main_account["id"]}},
                )
        except Exception as e:
            logging.error(f"Qonto bank account lookup error: {e}")

    # Kick off the payment-links provider connection (redirects the admin to Mollie to finish setup)
    try:
        async with httpx.AsyncClient(timeout=30) as c:
            r = await c.post(
                f"{QONTO_API_BASE}/v2/payment_links/connections",
                headers=qonto_headers(access_token),
                json={
                    "partner_callback_url": QONTO_REDIRECT_URI,
                    "user_bank_account_id": settings.get("qonto_bank_account_id", ""),
                    "user_phone_number": settings.get("qonto_phone_number", ""),
                    "user_website_url": settings.get("qonto_website_url", ""),
                    "business_description": settings.get("qonto_business_description", ""),
                },
            )
            r.raise_for_status()
            data = r.json()
        connection_location = data.get("connection_location")
        if connection_location:
            return RedirectResponse(connection_location)
    except Exception as e:
        logging.error(f"Qonto connection init error: {e}")
        return RedirectResponse(f"{FRONTEND_URL}/admin?qonto_error=connection_failed")

    return RedirectResponse(f"{FRONTEND_URL}/admin?qonto_connected=1")


@api.get("/admin/qonto/status")
async def admin_qonto_status(user=Depends(current_admin)):
    doc = await db.qonto_tokens.find_one({"id": "qonto_tokens"}, {"_id": 0})
    if not doc:
        return {"connected": False, "provider_status": "not_connected"}
    try:
        access_token = await get_qonto_access_token()
        async with httpx.AsyncClient(timeout=30) as c:
            r = await c.get(f"{QONTO_API_BASE}/v2/payment_links/connections", headers=qonto_headers(access_token))
            r.raise_for_status()
            data = r.json()
        return {"connected": True, "provider_status": data.get("status", "unknown")}
    except Exception as e:
        return {"connected": True, "provider_status": "error", "detail": str(e)}


# ----------------------------- Chatbot (Ollama Cloud) -----------------------------
async def build_catalog_context(limit: int = 200) -> str:
    """Catalogue live depuis Mongo : reflète toujours l'état courant de la boutique
    (ajout/modif/suppression produit, sync WooCommerce) sans étape de resynchro manuelle."""
    docs = await db.products.find({"active": True}, {"_id": 0}).limit(limit).to_list(limit)
    if not docs:
        return "Le catalogue est actuellement vide."

    lines = []
    for p in docs:
        price = p.get("sale_price") or p.get("price") or 0
        price_txt = f"{price:.2f} €"
        if p.get("sale_price"):
            price_txt += f" (prix normal {p.get('price', 0):.2f} €)"
        stock = "en stock" if (p.get("stock") or 0) > 0 else "en rupture de stock"
        cats = ", ".join(p.get("categories") or []) or "non catégorisé"
        short = (p.get("short_description") or p.get("description") or "").strip()
        if len(short) > 220:
            short = short[:220].rsplit(" ", 1)[0] + "…"
        lines.append(
            f"- slug: {p.get('slug')} | nom: {p.get('name')} | {price_txt} | {stock} | catégories: {cats} | {short}"
        )
    return "\n".join(lines)


CHAT_SYSTEM_PROMPT = """Tu es l'assistant virtuel de la boutique en ligne Kami Street.
Tu aides les visiteurs à trouver des produits, tu réponds à leurs questions sur le catalogue,
les prix, le stock et les catégories.

Règles strictes :
- Ne recommande QUE des produits présents dans le catalogue fourni ci-dessous. N'invente jamais de produit, de prix ou de caractéristique.
- Si aucun produit du catalogue ne correspond à la demande, dis-le clairement et propose l'alternative la plus proche du catalogue.
- Sois concis et sympathique. Ne donne PAS de lien ni d'URL dans le texte : les fiches produits s'affichent automatiquement sous forme de cartes visuelles.
- Réponds dans la langue du client (français par défaut).
- Quand tu recommandes un ou plusieurs produits précis du catalogue, termine IMPÉRATIVEMENT ta réponse par une ligne unique au format exact :
  [[PRODUCTS: slug1, slug2]]
  en utilisant les "slug" exacts du catalogue (1 à 3 produits max, les plus pertinents). N'ajoute cette ligne que si tu recommandes des produits précis, jamais sinon.

Catalogue actuel de la boutique :
{catalog}
"""

PRODUCTS_TAG_RE = re.compile(r"\[\[PRODUCTS:\s*([^\]]+)\]\]", re.IGNORECASE)


class ChatMessage(BaseModel):
    role: str
    content: str


class ChatIn(BaseModel):
    message: str
    history: List[ChatMessage] = Field(default_factory=list)


@api.post("/chat")
async def chat(body: ChatIn):
    if not OLLAMA_API_KEY:
        raise HTTPException(500, "Chatbot non configuré (OLLAMA_API_KEY manquant)")

    catalog = await build_catalog_context()
    messages = [{"role": "system", "content": CHAT_SYSTEM_PROMPT.format(catalog=catalog)}]
    for m in body.history[-10:]:
        if m.role in ("user", "assistant"):
            messages.append({"role": m.role, "content": m.content})
    messages.append({"role": "user", "content": body.message})

    try:
        async with httpx.AsyncClient(timeout=60) as c:
            r = await c.post(
                f"{OLLAMA_BASE_URL}/v1/chat/completions",
                headers={"Authorization": f"Bearer {OLLAMA_API_KEY}"},
                json={"model": OLLAMA_MODEL, "messages": messages, "stream": False},
            )
            r.raise_for_status()
            data = r.json()
    except httpx.HTTPStatusError as e:
        raise HTTPException(502, f"Erreur Ollama: {e.response.status_code} {e.response.text[:200]}")
    except httpx.RequestError as e:
        raise HTTPException(502, f"Erreur de connexion Ollama: {e}")

    reply = data["choices"][0]["message"]["content"]

    products = []
    match = PRODUCTS_TAG_RE.search(reply)
    if match:
        reply = PRODUCTS_TAG_RE.sub("", reply).strip()
        slugs = [s.strip() for s in match.group(1).split(",") if s.strip()][:3]
        if slugs:
            docs = await db.products.find(
                {"slug": {"$in": slugs}, "active": True},
                {"_id": 0, "name": 1, "slug": 1, "price": 1, "sale_price": 1, "images": 1, "categories": 1},
            ).to_list(len(slugs))
            by_slug = {d["slug"]: d for d in docs}
            products = [by_slug[s] for s in slugs if s in by_slug]

    return {"reply": reply, "products": products}


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
    if new_status == "paid":
        order = await db.orders.find_one({"id": oid}, {"_id": 0})
        if order:
            await ensure_invoice_for_order(order)
    return {"ok": True}


# ----------------------------- Admin: Invoices -----------------------------
async def next_invoice_number() -> str:
    year = datetime.now(timezone.utc).year
    doc = await db.settings.find_one_and_update(
        {"id": f"invoice_counter_{year}"},
        {"$inc": {"value": 1}},
        upsert=True,
        return_document=ReturnDocument.AFTER,
    )
    return f"FAC-{year}-{doc['value']:04d}"


async def ensure_invoice_for_order(order: dict) -> Optional[dict]:
    """Auto-creates an invoice the first time an order becomes paid. No-op if one already exists."""
    existing = await db.invoices.find_one({"order_id": order["id"]}, {"_id": 0})
    if existing:
        return existing
    invoice = {
        "id": str(uuid.uuid4()),
        "invoice_no": await next_invoice_number(),
        "order_id": order["id"],
        "order_no": order.get("order_no"),
        "customer_name": order.get("customer_name", ""),
        "customer_email": order.get("customer_email", ""),
        "billing_address": order.get("shipping_address", {}),
        "items": [
            {"name": i.get("name", ""), "quantity": i.get("quantity", 1), "unit_price": i.get("price", 0)}
            for i in order.get("items", [])
        ],
        "tax_rate": 20.0,
        "notes": "",
        "status": "issued",
        "created_at": now_iso(),
        "updated_at": now_iso(),
    }
    await db.invoices.insert_one(dict(invoice))
    return invoice


@api.get("/admin/invoices")
async def list_invoices(user=Depends(current_admin)):
    return await db.invoices.find({}, {"_id": 0}).sort("created_at", -1).to_list(1000)


@api.get("/admin/invoices/{iid}")
async def get_invoice(iid: str, user=Depends(current_admin)):
    doc = await db.invoices.find_one({"id": iid}, {"_id": 0})
    if not doc:
        raise HTTPException(404, "Facture introuvable")
    return doc


@api.post("/admin/invoices")
async def create_invoice(body: InvoiceIn, user=Depends(current_admin)):
    invoice = body.model_dump()
    invoice["id"] = str(uuid.uuid4())
    invoice["invoice_no"] = await next_invoice_number()
    invoice["status"] = "issued"
    invoice["created_at"] = now_iso()
    invoice["updated_at"] = now_iso()
    await db.invoices.insert_one(dict(invoice))
    return clean(invoice)


@api.post("/admin/invoices/from-order/{order_id}")
async def create_invoice_from_order(order_id: str, user=Depends(current_admin)):
    order = await db.orders.find_one({"id": order_id}, {"_id": 0})
    if not order:
        raise HTTPException(404, "Commande introuvable")
    existing = await db.invoices.find_one({"order_id": order_id}, {"_id": 0})
    if existing:
        raise HTTPException(400, "Une facture existe déjà pour cette commande")
    invoice = await ensure_invoice_for_order(order)
    return invoice


@api.put("/admin/invoices/{iid}")
async def update_invoice(iid: str, body: InvoiceIn, user=Depends(current_admin)):
    upd = body.model_dump()
    upd["updated_at"] = now_iso()
    r = await db.invoices.update_one({"id": iid}, {"$set": upd})
    if r.matched_count == 0:
        raise HTTPException(404, "Facture introuvable")
    return {"ok": True}


@api.delete("/admin/invoices/{iid}")
async def delete_invoice(iid: str, user=Depends(current_admin)):
    await db.invoices.delete_one({"id": iid})
    return {"ok": True}


@api.get("/admin/promos")
async def admin_promos(user=Depends(current_admin)):
    return await db.promos.find({}, {"_id": 0}).sort("created_at", -1).to_list(500)


@api.post("/admin/promos")
async def create_promo(body: PromoCodeIn, user=Depends(current_admin)):
    code = body.code.strip().upper()
    if not code or body.value <= 0 or body.discount_type not in ("percent", "fixed"):
        raise HTTPException(400, "Code promo invalide")
    if body.discount_type == "percent" and body.value > 100:
        raise HTTPException(400, "La remise en pourcentage doit être comprise entre 0 et 100")
    if body.max_uses is not None and body.max_uses < 1:
        raise HTTPException(400, "Le nombre maximal d'utilisations doit être positif")
    if await db.promos.find_one({"code": code}):
        raise HTTPException(409, "Ce code promo existe déjà")
    promo = body.model_dump()
    promo.update({"code": code, "id": str(uuid.uuid4()), "uses": 0, "created_at": now_iso()})
    await db.promos.insert_one(promo)
    return clean(promo)


@api.put("/admin/promos/{promo_id}")
async def update_promo(promo_id: str, body: PromoCodeIn, user=Depends(current_admin)):
    code = body.code.strip().upper()
    if not code or body.value <= 0 or body.discount_type not in ("percent", "fixed"):
        raise HTTPException(400, "Code promo invalide")
    if body.discount_type == "percent" and body.value > 100:
        raise HTTPException(400, "La remise en pourcentage doit être comprise entre 0 et 100")
    duplicate = await db.promos.find_one({"code": code, "id": {"$ne": promo_id}})
    if duplicate:
        raise HTTPException(409, "Ce code promo existe déjà")
    result = await db.promos.update_one({"id": promo_id}, {"$set": {**body.model_dump(), "code": code}})
    if result.matched_count == 0:
        raise HTTPException(404, "Code promo introuvable")
    return {"ok": True}


@api.delete("/admin/promos/{promo_id}")
async def delete_promo(promo_id: str, user=Depends(current_admin)):
    await db.promos.delete_one({"id": promo_id})
    return {"ok": True}


@api.get("/admin/invoices/{iid}/pdf")
async def invoice_pdf(iid: str, user=Depends(current_admin)):
    invoice = await db.invoices.find_one({"id": iid}, {"_id": 0})
    if not invoice:
        raise HTTPException(404, "Facture introuvable")
    pdf_bytes = generate_invoice_pdf(invoice)
    return StreamingResponse(
        BytesIO(pdf_bytes),
        media_type="application/pdf",
        headers={"Content-Disposition": f"inline; filename={invoice['invoice_no']}.pdf"},
    )


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


async def calculate_checkout(body: CheckoutIn):
    if not body.items:
        raise HTTPException(400, "Panier vide")
    total = 0.0
    priced_items = []
    line_items = []
    for it in body.items:
        if it.quantity < 1 or it.quantity > 99:
            raise HTTPException(400, "Quantité invalide")
        prod = await db.products.find_one({"id": it.product_id, "active": True}, {"_id": 0})
        if not prod:
            raise HTTPException(400, f"Produit introuvable: {it.product_id}")
        unit_price = prod.get("sale_price") or prod["price"]
        if it.variation_id:
            variation = next((v for v in prod.get("variations", []) if v["id"] == it.variation_id), None)
            if not variation:
                raise HTTPException(400, "Variante introuvable")
            unit_price = variation.get("sale_price") or variation["price"]
        quantity = it.quantity
        bundle_quantity = int(prod.get("bundle_quantity") or 2)
        bundle_price = prod.get("bundle_price")
        use_bundle = bool(prod.get("bundle_enabled") and bundle_price is not None and bundle_price > 0)
        bundles = quantity // bundle_quantity if use_bundle else 0
        remainder = quantity - (bundles * bundle_quantity)
        if use_bundle and bundles:
            charged = (bundles * bundle_price) + (remainder * unit_price)
        else:
            charged = quantity * unit_price
        total += charged
        priced_items.append({**it.model_dump(), "price": round(charged / quantity, 2), "regular_price": unit_price})
        if bundles:
            line_items.append({"name": f"{prod['name']} (lot de {bundle_quantity})", "price": bundle_price, "quantity": bundles})
        if remainder:
            line_items.append({"name": prod["name"], "price": unit_price, "quantity": remainder})
        if not bundles and not remainder:
            line_items.append({"name": prod["name"], "price": unit_price, "quantity": quantity})

    subtotal = round(total, 2)
    discount = 0.0
    promo = None
    if body.promo_code:
        promo = await db.promos.find_one({"code": body.promo_code.strip().upper(), "active": True}, {"_id": 0})
        if not promo:
            raise HTTPException(400, "Code promo invalide ou inactif")
        if promo.get("expires_at"):
            try:
                if datetime.fromisoformat(promo["expires_at"].replace("Z", "+00:00")) <= datetime.now(timezone.utc):
                    raise HTTPException(400, "Code promo expiré")
            except ValueError:
                raise HTTPException(400, "Code promo mal configuré")
        if promo.get("max_uses") is not None and promo.get("uses", 0) >= promo["max_uses"]:
            raise HTTPException(400, "Code promo épuisé")
        if subtotal < promo.get("min_order", 0):
            raise HTTPException(400, f"Minimum de commande : {promo['min_order']:.2f} €")
        discount = subtotal * promo["value"] / 100 if promo["discount_type"] == "percent" else promo["value"]
        discount = min(round(discount, 2), subtotal)
        if promo.get("max_uses") is not None:
            await db.promos.update_one({"id": promo["id"], "uses": {"$lt": promo["max_uses"]}}, {"$inc": {"uses": 1}})

    return {"subtotal": subtotal, "discount": discount, "total": round(subtotal - discount, 2), "promo": promo, "items": priced_items, "line_items": line_items}


# ----------------------------- Checkout (Stripe) -----------------------------
@api.post("/checkout/session")
async def create_checkout_session(body: CheckoutIn):
    settings = await get_payment_settings()
    if not settings.get("stripe_enabled", True):
        raise HTTPException(400, "Le paiement par carte (Stripe) n'est pas activé")
    pricing = await calculate_checkout(body)
    line_items = [{
        "price_data": {
            "currency": "eur",
            "product_data": {"name": item["name"]},
            "unit_amount": int(round(item["price"] * 100)),
        },
        "quantity": item["quantity"],
    } for item in pricing["line_items"]]

    order_no = f"KS-{datetime.now(timezone.utc).strftime('%Y%m%d')}-{uuid.uuid4().hex[:6].upper()}"
    order_id = str(uuid.uuid4())
    order = {
        "id": order_id,
        "order_no": order_no,
        "items": pricing["items"],
        "customer_email": body.customer_email,
        "customer_name": body.customer_name,
        "shipping_address": body.shipping_address,
        "subtotal": pricing["subtotal"],
        "discount": pricing["discount"],
        "promo_code": body.promo_code,
        "total": pricing["total"],
        "status": "pending",
        "payment_status": "pending",
        "payment_provider": body.payment_provider or "stripe",
        "payment_option": body.payment_option or "standard",
        "created_at": now_iso(),
        "updated_at": now_iso(),
    }
    session_args = {
        "mode": "payment",
        "line_items": line_items,
        "customer_email": body.customer_email,
        "success_url": f"{body.origin_url}/checkout/success?session_id={{CHECKOUT_SESSION_ID}}",
        "cancel_url": f"{body.origin_url}/checkout/cancel",
        "metadata": {"order_id": order_id, "order_no": order_no},
    }
    if pricing["discount"]:
        coupon = stripe.Coupon.create(amount_off=int(round(pricing["discount"] * 100)), currency="eur", duration="once")
        session_args["discounts"] = [{"coupon": coupon.id}]
    session = stripe.checkout.Session.create(**session_args)
    order["session_id"] = session.id
    await db.orders.insert_one(order)
    return {"checkout_url": session.url, "session_id": session.id, "order_no": order_no}


async def _mark_order_paid(session_id_field: str, session_id_value: str):
    await db.orders.update_one(
        {session_id_field: session_id_value, "payment_status": {"$ne": "paid"}},
        {"$set": {"payment_status": "paid", "status": "paid", "updated_at": now_iso()}},
    )
    order = await db.orders.find_one({session_id_field: session_id_value}, {"_id": 0})
    await send_email(order["customer_email"], order["customer_name"], f"Confirmation commande #{order['order_no']}", order_email_html(order))
    await send_email(ADMIN_EMAIL, "Admin Kami Street", f"Nouvelle commande #{order['order_no']}", order_email_html(order, admin=True))
    await ensure_invoice_for_order(order)
    return order


@api.get("/checkout/status/{session_id}")
async def checkout_status(session_id: str):
    order = await db.orders.find_one({"session_id": session_id}, {"_id": 0})
    if not order:
        raise HTTPException(404, "Order not found")
    if order.get("payment_status") != "paid":
        provider = order.get("provider", "stripe")
        try:
            if provider == "qonto":
                access_token = await get_qonto_access_token()
                async with httpx.AsyncClient(timeout=30) as c:
                    r = await c.get(
                        f"{QONTO_API_BASE}/v2/payment_links/{session_id}/payments",
                        headers=qonto_headers(access_token),
                    )
                    r.raise_for_status()
                    payments = r.json().get("payments", [])
                if any(p.get("status") == "paid" for p in payments):
                    order = await _mark_order_paid("session_id", session_id)
            elif provider == "mollie":
                async with httpx.AsyncClient(timeout=30) as c:
                    r = await c.get(
                        f"{MOLLIE_API_BASE}/payments/{order['mollie_payment_id']}",
                        headers={"Authorization": f"Bearer {MOLLIE_API_KEY}"},
                    )
                    r.raise_for_status()
                    payment = r.json()
                if payment.get("status") == "paid":
                    order = await _mark_order_paid("session_id", session_id)
            elif provider == "alma" and order.get("alma_payment_id"):
                async with httpx.AsyncClient(timeout=30) as c:
                    r = await c.get(
                        f"{ALMA_API_BASE_URL}/v1/payments/{order['alma_payment_id']}",
                        headers=alma_auth_headers(),
                    )
                    r.raise_for_status()
                    payment = r.json()
                # Alma considers the order fulfillable once installments are confirmed ("in_progress" or "paid").
                if payment.get("state") in {"in_progress", "paid"}:
                    order = await _mark_order_paid("session_id", session_id)
            else:
                s = stripe.checkout.Session.retrieve(session_id)
                if s.payment_status == "paid" or s.status == "complete":
                    order = await _mark_order_paid("session_id", session_id)
        except Exception as e:
            logging.error(f"Payment status sync err ({order.get('provider', 'stripe')}): {e}")
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
            await _mark_order_paid("session_id", obj["id"])
    return {"ok": True}


@api.post("/alma/webhook")
async def alma_webhook(request: Request):
    try:
        body = await request.json()
    except Exception:
        body = {}
    payment_id = body.get("id") or body.get("payment_id")
    if not payment_id:
        return {"ok": True}

    order = await db.orders.find_one({"alma_payment_id": payment_id}, {"_id": 0})
    if not order or order.get("payment_status") == "paid":
        return {"ok": True}

    try:
        async with httpx.AsyncClient(timeout=30) as c:
            r = await c.get(f"{ALMA_API_BASE_URL}/v1/payments/{payment_id}", headers=alma_auth_headers())
            r.raise_for_status()
            payment = r.json()
    except Exception as e:
        logging.error(f"Alma webhook sync err: {e}")
        return {"ok": True}

    if payment.get("state") in {"in_progress", "paid"}:
        await _mark_order_paid("session_id", order["session_id"])
    return {"ok": True}


# ----------------------------- Checkout (Alma) -----------------------------
async def _create_alma_payment(body: CheckoutIn, order_no: str, total_cents: int, installments: int):
    if not ALMA_API_KEY or not ALMA_MERCHANT_ID:
        raise HTTPException(400, "Les identifiants Alma ne sont pas configurés")

    redirect_urls = build_alma_redirect_urls(body.origin_url, order_no)
    success_url = redirect_urls["success_url"]
    cancel_url = redirect_urls["cancel_url"]

    payload_candidates = [
        {
            "merchant_id": ALMA_MERCHANT_ID,
            "amount": total_cents,
            "currency": "EUR",
            "installments_count": installments,
            "order_id": order_no,
            "return_url": success_url,
            "cancel_url": cancel_url,
            "customer_email": body.customer_email,
        },
        {
            "purchase_amount": total_cents,
            "currency": "EUR",
            "installments_count": installments,
            "merchant_order_id": order_no,
            "return_url": success_url,
            "cancel_url": cancel_url,
            "customer_email": body.customer_email,
        },
        {
            "amount": total_cents,
            "currency": "EUR",
            "merchant_id": ALMA_MERCHANT_ID,
            "transaction_id": order_no,
            "installments_count": installments,
            "return_url": success_url,
            "cancel_url": cancel_url,
        },
    ]
    alma_key_scheme = "Alma-Live-Key" if ALMA_API_MODE == "live" else "Alma-Sandbox-Key"
    header_candidates = [
        {"Authorization": f"{alma_key_scheme} {ALMA_API_KEY}", "Accept": "application/json", "Content-Type": "application/json"},
        {"Authorization": f"Bearer {ALMA_API_KEY}", "Accept": "application/json", "Content-Type": "application/json"},
        {"X-Api-Key": ALMA_API_KEY, "Accept": "application/json", "Content-Type": "application/json"},
        {"Authorization": f"AlmaApiKey {ALMA_API_KEY}", "Accept": "application/json", "Content-Type": "application/json"},
    ]
    endpoints = [
        f"{ALMA_API_BASE_URL}/v1/payments",
    ]

    last_error = None
    for endpoint in endpoints:
        for headers in header_candidates:
            for payload in payload_candidates:
                try:
                    async with httpx.AsyncClient(timeout=30) as c:
                        r = await c.post(endpoint, headers=headers, json=payload)
                        if r.status_code < 400:
                            try:
                                data = r.json()
                            except Exception:
                                data = {}
                            checkout_url = None
                            if isinstance(data, dict):
                                for key in ("checkout_url", "checkoutUrl", "url", "payment_url", "redirect_url", "href"):
                                    value = data.get(key)
                                    if isinstance(value, str) and value:
                                        checkout_url = value
                                        break
                                if not checkout_url:
                                    for nested_key in ("data", "payment", "checkout", "response", "transaction"):
                                        nested = data.get(nested_key)
                                        if isinstance(nested, dict):
                                            for key in ("checkout_url", "checkoutUrl", "url", "payment_url", "redirect_url", "href"):
                                                value = nested.get(key)
                                                if isinstance(value, str) and value:
                                                    checkout_url = value
                                                    break
                                        if checkout_url:
                                            break
                            if checkout_url:
                                payment_id = data.get("id") if isinstance(data, dict) else None
                                return checkout_url, payment_id
                        last_error = f"{endpoint} -> {r.status_code}: {r.text[:400]}"
                except Exception as exc:
                    last_error = f"{endpoint} -> {exc}"

    detail = last_error or "aucune URL de checkout retournée"
    logging.error("Alma checkout failed: %s", detail)
    raise HTTPException(
        502,
        f"Échec de création du paiement Alma. Vérifiez la clé API Alma, l’ID marchand et l’activation du compte dans le dashboard Alma. Détail: {detail}",
    )


@api.get("/admin/alma/diagnostic")
async def alma_diagnostic(user=Depends(current_admin)):
    def describe(value: str) -> Dict[str, Any]:
        return {
            "length": len(value),
            "prefix": value[:8] if value else "",
            "suffix": value[-4:] if value else "",
            "has_leading_or_trailing_whitespace": value != value.strip(),
        }
    return {
        "mode": ALMA_API_MODE,
        "base_url": ALMA_API_BASE_URL,
        "api_key": describe(os.environ.get("ALMA_API_KEY", "")),
        "merchant_id": describe(os.environ.get("ID_ALMA_MERCHANT", "")),
    }


@api.post("/checkout/alma-session")
async def create_alma_checkout(body: CheckoutIn):
    settings = await get_payment_settings()
    if not settings.get("alma_enabled"):
        raise HTTPException(400, "Le paiement en plusieurs fois Alma n'est pas activé")
    pricing = await calculate_checkout(body)
    if pricing["total"] < 300:
        raise HTTPException(400, "Le paiement en plusieurs fois Alma est disponible à partir de 300 €")

    payment_option = body.payment_option or "standard"
    installments = 3
    if payment_option != "standard":
        if not payment_option.startswith("alma-"):
            raise HTTPException(400, "Option de paiement Alma invalide")
        installments = int(payment_option.replace("alma-", "").replace("x", ""))
        if installments not in {3, 4, 6, 10, 12}:
            raise HTTPException(400, "Le nombre de mensualités Alma doit être compris entre 3 et 12")

    order_no = f"KS-{datetime.now(timezone.utc).strftime('%Y%m%d')}-{uuid.uuid4().hex[:6].upper()}"
    order_id = str(uuid.uuid4())
    order = {
        "id": order_id,
        "order_no": order_no,
        "items": pricing["items"],
        "customer_email": body.customer_email,
        "customer_name": body.customer_name,
        "shipping_address": body.shipping_address,
        "subtotal": pricing["subtotal"],
        "discount": pricing["discount"],
        "promo_code": body.promo_code,
        "total": pricing["total"],
        "status": "pending",
        "payment_status": "pending",
        "provider": "alma",
        "payment_provider": "alma",
        "payment_option": payment_option,
        "installments": installments,
        "created_at": now_iso(),
        "updated_at": now_iso(),
    }
    total_cents = int(round(pricing["total"] * 100))
    checkout_url, alma_payment_id = await _create_alma_payment(body, order_no, total_cents, installments)
    order["session_id"] = order_no
    order["alma_payment_id"] = alma_payment_id
    await db.orders.insert_one(order)
    return {"checkout_url": checkout_url, "session_id": order_no, "order_no": order_no}


@api.post("/checkout/qonto-session")
async def create_qonto_checkout(body: CheckoutIn):
    settings = await get_payment_settings()
    if not settings.get("qonto_enabled"):
        raise HTTPException(400, "Le paiement par carte (Qonto) n'est pas activé")
    pricing = await calculate_checkout(body)
    items = []
    for item in pricing["line_items"]:
        items.append(
            {
                "title": item["name"][:255],
                "type": "good",
                "quantity": item["quantity"],
                "unit_price": {"value": f"{item['price']:.2f}", "currency": "EUR"},
                "vat_rate": settings.get("qonto_vat_rate", "20.0"),
            }
        )
    if pricing["discount"]:
        items.append({"title": "Remise code promo", "type": "discount", "quantity": 1, "unit_price": {"value": f"{-pricing['discount']:.2f}", "currency": "EUR"}, "vat_rate": settings.get("qonto_vat_rate", "20.0")})

    order_no = f"KS-{datetime.now(timezone.utc).strftime('%Y%m%d')}-{uuid.uuid4().hex[:6].upper()}"
    order_id = str(uuid.uuid4())

    access_token = await get_qonto_access_token()
    async with httpx.AsyncClient(timeout=30) as c:
        r = await c.post(
            f"{QONTO_API_BASE}/v2/payment_links",
            headers=qonto_headers(access_token),
            json={"payment_link": {"items": items, "reusable": False, "potential_payment_methods": ["credit_card"]}},
        )
        if r.status_code >= 400:
            raise HTTPException(502, f"Erreur Qonto: {r.status_code} {r.text[:200]}")
        link = r.json()["payment_link"]

    order = {
        "id": order_id,
        "order_no": order_no,
        "items": pricing["items"],
        "customer_email": body.customer_email,
        "customer_name": body.customer_name,
        "shipping_address": body.shipping_address,
        "subtotal": pricing["subtotal"],
        "discount": pricing["discount"],
        "promo_code": body.promo_code,
        "total": pricing["total"],
        "status": "pending",
        "payment_status": "pending",
        "provider": "qonto",
        "session_id": link["id"],
        "created_at": now_iso(),
        "updated_at": now_iso(),
    }
    await db.orders.insert_one(order)
    return {"checkout_url": link["url"], "session_id": link["id"], "order_no": order_no}


@api.post("/qonto/webhook")
async def qonto_webhook(request: Request):
    try:
        payload = await request.json()
    except Exception:
        raise HTTPException(400, "Invalid payload")
    payment_link_id = (payload.get("data") or {}).get("payment_link_id")
    if not payment_link_id:
        return {"ok": True}
    order = await db.orders.find_one({"session_id": payment_link_id}, {"_id": 0})
    if not order or order.get("payment_status") == "paid":
        return {"ok": True}
    # Re-verify server-side against Qonto's API rather than trusting the webhook payload directly
    try:
        access_token = await get_qonto_access_token()
        async with httpx.AsyncClient(timeout=30) as c:
            r = await c.get(
                f"{QONTO_API_BASE}/v2/payment_links/{payment_link_id}/payments",
                headers=qonto_headers(access_token),
            )
            r.raise_for_status()
            payments = r.json().get("payments", [])
        if any(p.get("status") == "paid" for p in payments):
            await _mark_order_paid("session_id", payment_link_id)
    except Exception as e:
        logging.error(f"Qonto webhook sync err: {e}")
    return {"ok": True}


# ----------------------------- Checkout (Mollie, direct API key) -----------------------------
@api.post("/checkout/mollie-session")
async def create_mollie_checkout(body: CheckoutIn):
    settings = await get_payment_settings()
    if not settings.get("mollie_enabled") or not MOLLIE_API_KEY:
        raise HTTPException(400, "Le paiement par carte (Mollie) n'est pas activé")
    pricing = await calculate_checkout(body)

    order_no = f"KS-{datetime.now(timezone.utc).strftime('%Y%m%d')}-{uuid.uuid4().hex[:6].upper()}"
    order_id = str(uuid.uuid4())

    payment_payload = {
        "amount": {"currency": "EUR", "value": f"{pricing['total']:.2f}"},
        "description": f"Commande {order_no} — Kami Street",
        "redirectUrl": f"{body.origin_url}/checkout/success?session_id={order_id}",
        "metadata": {"order_id": order_id, "order_no": order_no},
    }
    if body.payment_option == "klarna":
        payment_payload["method"] = "klarna"
        payment_payload["billingAddress"] = {
            "streetAndNumber": body.shipping_address.get("line1", ""),
            "city": body.shipping_address.get("city", ""),
            "postalCode": body.shipping_address.get("postal_code", ""),
            "country": "FR",
            "email": body.customer_email,
            "givenName": (body.customer_name or "").split(" ")[0] or body.customer_name,
            "familyName": " ".join((body.customer_name or "").split(" ")[1:]) or body.customer_name,
        }
        vat_rate = 20.0
        discount_ratio = (pricing["discount"] / pricing["subtotal"]) if pricing["subtotal"] else 0.0
        lines = []
        lines_total = 0.0
        for item in pricing["line_items"]:
            gross = round(item["price"] * item["quantity"], 2)
            total_amount = round(gross * (1 - discount_ratio), 2)
            vat_amount = round(total_amount - (total_amount / (1 + vat_rate / 100)), 2)
            lines_total += total_amount
            lines.append({
                "description": item["name"],
                "quantity": item["quantity"],
                "unitPrice": {"currency": "EUR", "value": f"{item['price']:.2f}"},
                "totalAmount": {"currency": "EUR", "value": f"{total_amount:.2f}"},
                "vatRate": f"{vat_rate:.2f}",
                "vatAmount": {"currency": "EUR", "value": f"{vat_amount:.2f}"},
            })
        # Mollie requires the sum of line totals to exactly match the payment amount; push any rounding remainder onto the last line.
        rounding_remainder = round(pricing["total"] - lines_total, 2)
        if lines and rounding_remainder:
            last = lines[-1]
            adjusted = round(float(last["totalAmount"]["value"]) + rounding_remainder, 2)
            last["totalAmount"]["value"] = f"{adjusted:.2f}"
            last["vatAmount"]["value"] = f"{round(adjusted - (adjusted / (1 + vat_rate / 100)), 2):.2f}"
        payment_payload["lines"] = lines
    # Mollie rejects webhookUrl values it can't reach from the internet (e.g. localhost in dev).
    # /checkout/status already re-verifies against Mollie's API as a fallback, so this is safe to omit locally.
    if not re.search(r"localhost|127\.0\.0\.1", BACKEND_URL):
        payment_payload["webhookUrl"] = f"{BACKEND_URL}/api/mollie/webhook"

    async with httpx.AsyncClient(timeout=30) as c:
        r = await c.post(
            f"{MOLLIE_API_BASE}/payments",
            headers={"Authorization": f"Bearer {MOLLIE_API_KEY}", "Content-Type": "application/json"},
            json=payment_payload,
        )
        if r.status_code >= 400:
            raise HTTPException(502, f"Erreur Mollie: {r.status_code} {r.text[:200]}")
        payment = r.json()

    order = {
        "id": order_id,
        "order_no": order_no,
        "items": pricing["items"],
        "customer_email": body.customer_email,
        "customer_name": body.customer_name,
        "shipping_address": body.shipping_address,
        "subtotal": pricing["subtotal"],
        "discount": pricing["discount"],
        "promo_code": body.promo_code,
        "total": pricing["total"],
        "status": "pending",
        "payment_status": "pending",
        "provider": "mollie",
        "payment_option": body.payment_option or "standard",
        "session_id": order_id,
        "mollie_payment_id": payment["id"],
        "created_at": now_iso(),
        "updated_at": now_iso(),
    }
    await db.orders.insert_one(order)
    return {"checkout_url": payment["_links"]["checkout"]["href"], "session_id": order_id, "order_no": order_no}


@api.post("/mollie/webhook")
async def mollie_webhook(request: Request):
    form = await request.form()
    payment_id = form.get("id")
    if not payment_id:
        return {"ok": True}
    order = await db.orders.find_one({"mollie_payment_id": payment_id}, {"_id": 0})
    if not order or order.get("payment_status") == "paid":
        return {"ok": True}
    # Re-verify server-side against Mollie's API rather than trusting the webhook call alone
    try:
        async with httpx.AsyncClient(timeout=30) as c:
            r = await c.get(
                f"{MOLLIE_API_BASE}/payments/{payment_id}",
                headers={"Authorization": f"Bearer {MOLLIE_API_KEY}"},
            )
            r.raise_for_status()
            payment = r.json()
        if payment.get("status") == "paid":
            await _mark_order_paid("session_id", order["session_id"])
    except Exception as e:
        logging.error(f"Mollie webhook sync err: {e}")
    return {"ok": True}


# ----------------------------- Migration (WooCommerce + WP) -----------------------------
async def _woo_get(path: str, params: dict = None):
    url = f"https://{WP_SITE}/wp-json/wc/v3/{path}"
    async with httpx.AsyncClient(timeout=60, auth=(WOO_KEY, WOO_SECRET), follow_redirects=True) as c:
        r = await c.get(url, params=params or {})
        r.raise_for_status()
        return r.json()


def _woo_money(value) -> Optional[float]:
    if value is None or value == "":
        return None
    try:
        return float(value)
    except (TypeError, ValueError):
        return None


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


@api.post("/admin/uploads/image")
async def upload_product_image(file: UploadFile = File(...), user=Depends(current_admin)):
    """Uploads an image to the WordPress media library (same host as existing product
    images) and returns its public URL, so it can be added to a product's images list."""
    if not (file.content_type or "").startswith("image/"):
        raise HTTPException(400, "Le fichier doit être une image")
    contents = await file.read()
    if len(contents) > 8 * 1024 * 1024:
        raise HTTPException(400, "Image trop volumineuse (max 8 Mo)")

    url = f"{WP_BASE}/wp-json/wp/v2/media"
    headers = {
        "Content-Disposition": f'attachment; filename="{file.filename}"',
        "Content-Type": file.content_type,
        "User-Agent": "KamiStreet-Admin/1.0 (+https://kamistreet.fr)",
    }
    async with httpx.AsyncClient(timeout=60, auth=(WP_USER, WP_APP_PWD.replace(" ", ""))) as c:
        r = await c.post(url, content=contents, headers=headers)
        if r.status_code >= 400:
            raise HTTPException(502, f"Erreur upload WordPress: {r.status_code} {r.text[:200]}")
        media = r.json()
    return {"url": media.get("source_url"), "id": media.get("id")}


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
                    "description": c.get("description", ""),
                }},
                upsert=True,
            )

        # Brands
        try:
            brands = await _woo_get("products/brands", {"per_page": 100})
            for b in brands:
                await db.brands.update_one(
                    {"woo_id": b["id"]},
                    {"$set": {
                        "id": str(b["id"]),
                        "woo_id": b["id"],
                        "name": b["name"],
                        "slug": b["slug"],
                        "count": b.get("count", 0),
                        "image": (b.get("image") or {}).get("src"),
                        "description": b.get("description", ""),
                    }},
                    upsert=True,
                )
        except httpx.HTTPStatusError:
            pass  # brands taxonomy not available on this store

        # Products (paginated)
        while True:
            items = await _woo_get("products", {"per_page": 100, "page": page, "status": "any"})
            if not items:
                break
            for p in items:
                existing_product = await db.products.find_one({"woo_id": p["id"]}, {"_id": 0, "price": 1})
                regular_price = _woo_money(p.get("regular_price"))
                current_price = _woo_money(p.get("price"))
                if regular_price is None:
                    regular_price = _woo_money((existing_product or {}).get("price")) or current_price or 0.0
                sale_price = _woo_money(p.get("sale_price"))
                variations = []
                if p.get("type") == "variable" and p.get("variations"):
                    try:
                        vlist = await _woo_get(f"products/{p['id']}/variations", {"per_page": 100})
                        for v in vlist:
                            variation_regular_price = _woo_money(v.get("regular_price")) or _woo_money(v.get("price")) or 0.0
                            variations.append({
                                "id": str(v["id"]),
                                "name": " / ".join(a.get("option", "") for a in v.get("attributes", [])) or v.get("sku", ""),
                                "price": variation_regular_price,
                                "regular_price": variation_regular_price,
                                "sale_price": _woo_money(v.get("sale_price")),
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
                    "price": regular_price,
                    "regular_price": regular_price,
                    "sale_price": sale_price,
                    "stock": p.get("stock_quantity") or 0,
                    "categories": [c["slug"] for c in p.get("categories", [])],
                    "brands": [b["slug"] for b in p.get("brands", [])],
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


WC_ORDER_STATUS_MAP = {
    "pending": "pending",
    "on-hold": "pending",
    "processing": "paid",
    "completed": "shipped",
    "cancelled": "cancelled",
    "refunded": "cancelled",
    "failed": "cancelled",
    "trash": "cancelled",
}


@api.post("/admin/sync/woocommerce-orders")
async def sync_woo_orders(user=Depends(current_admin)):
    """Imports existing WooCommerce orders (placed on the old site) so they show up
    alongside orders placed through this storefront. Idempotent: keyed by woo_order_id."""
    imported = 0
    page = 1
    try:
        while True:
            items = await _woo_get("orders", {"per_page": 100, "page": page, "orderby": "date", "order": "desc"})
            if not items:
                break
            for o in items:
                billing = o.get("billing") or {}
                shipping = o.get("shipping") or billing
                customer_name = " ".join(filter(None, [billing.get("first_name"), billing.get("last_name")])).strip() or "Client WooCommerce"
                doc = {
                    "id": f"wc-{o['id']}",
                    "woo_order_id": o["id"],
                    "order_no": o.get("number") and f"WC-{o['number']}" or f"WC-{o['id']}",
                    "items": [
                        {
                            "product_id": str(li.get("product_id", "")),
                            "variation_id": str(li["variation_id"]) if li.get("variation_id") else None,
                            "name": li.get("name", ""),
                            "price": float(li.get("price") or 0),
                            "quantity": li.get("quantity", 1),
                            "image": (li.get("image") or {}).get("src"),
                        }
                        for li in o.get("line_items", [])
                    ],
                    "customer_email": billing.get("email") or "",
                    "customer_name": customer_name,
                    "shipping_address": {
                        "line1": shipping.get("address_1", ""),
                        "city": shipping.get("city", ""),
                        "postal_code": shipping.get("postcode", ""),
                        "country": shipping.get("country", ""),
                    },
                    "total": float(o.get("total") or 0),
                    "status": WC_ORDER_STATUS_MAP.get(o.get("status"), "pending"),
                    "payment_status": "paid" if o.get("status") in ("processing", "completed") else "pending",
                    "provider": "woocommerce",
                    "created_at": o.get("date_created") or now_iso(),
                    "updated_at": now_iso(),
                }
                await db.orders.update_one({"woo_order_id": o["id"]}, {"$set": doc}, upsert=True)
                imported += 1
                if doc["payment_status"] == "paid":
                    await ensure_invoice_for_order(doc)
            if len(items) < 100:
                break
            page += 1
        return {"imported": imported, "status": "ok"}
    except httpx.HTTPStatusError as e:
        raise HTTPException(500, f"Woo orders API error: {e.response.status_code} {e.response.text[:200]}")


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
    orders = await sync_woo_orders(user)
    wp = await sync_wp(user)
    media = await sync_media(user)
    await db.settings.update_one(
        {"id": "sync_status"},
        {"$set": {
            "id": "sync_status",
            "last_sync_at": now_iso(),
            "last_sync_ok": True,
            "woocommerce_imported": woo.get("imported", 0),
            "orders_imported": orders.get("imported", 0),
            "wordpress_imported": wp.get("imported", 0),
        }},
        upsert=True,
    )
    return {"woocommerce": woo, "orders": orders, "wordpress": wp, "media": media}


@api.get("/admin/sync/status")
async def sync_status(user=Depends(current_admin)):
    doc = await db.settings.find_one({"id": "sync_status"}, {"_id": 0})
    return doc or {"last_sync_at": None, "last_sync_ok": None}


# ----------------------------- Health -----------------------------
@api.get("/")
async def root():
    return {"message": "Kami Street API", "status": "ok"}


# ----------------------------- Sitemap (dynamic) -----------------------------
@app.get("/sitemap.xml")
async def sitemap():
    from fastapi.responses import Response

    urls = [f"{FRONTEND_URL}/", f"{FRONTEND_URL}/shop", f"{FRONTEND_URL}/blog"]
    products = await db.products.find({"active": True}, {"slug": 1, "updated_at": 1, "_id": 0}).to_list(5000)
    for p in products:
        urls.append((f"{FRONTEND_URL}/product/{p['slug']}", p.get("updated_at")))
    posts = await db.blog.find({"published": True}, {"slug": 1, "published_at": 1, "_id": 0}).to_list(5000)
    for b in posts:
        urls.append((f"{FRONTEND_URL}/blog/{b['slug']}", b.get("published_at")))

    entries = []
    for item in urls:
        if isinstance(item, tuple):
            loc, lastmod = item
        else:
            loc, lastmod = item, None
        entry = f"  <url>\n    <loc>{loc}</loc>\n"
        if lastmod:
            entry += f"    <lastmod>{lastmod[:10]}</lastmod>\n"
        entry += "  </url>"
        entries.append(entry)

    xml = (
        '<?xml version="1.0" encoding="UTF-8"?>\n'
        '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n'
        + "\n".join(entries)
        + "\n</urlset>"
    )
    return Response(content=xml, media_type="application/xml")


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
    task = getattr(app.state, "sync_task", None)
    if task:
        task.cancel()
    client.close()
