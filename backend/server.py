"""ONCOST Catalog & Quotation backend."""
from dotenv import load_dotenv
from pathlib import Path

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / ".env")

import os
import sys
import io
import json
import logging
import re
import secrets
from datetime import datetime, timezone, timedelta
from typing import List, Optional

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

import bcrypt
import jwt
from bson import ObjectId
from fastapi import FastAPI, APIRouter, HTTPException, Depends, Request, Response, status
from fastapi.responses import StreamingResponse, FileResponse
from motor.motor_asyncio import AsyncIOMotorClient
from pydantic import BaseModel, EmailStr, Field, ConfigDict
from starlette.middleware.cors import CORSMiddleware

# PDF/HTML
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import mm
from reportlab.lib import colors
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, Image as RLImage, Table, TableStyle, PageBreak,
)
from reportlab.lib.enums import TA_LEFT, TA_RIGHT, TA_CENTER
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont

from storage import init_storage, put_object, get_object, build_storage_path

# Register Unicode fonts (DejaVu supports ₹). Fallback to Helvetica if missing.
_FONT_REG = "Helvetica"
_FONT_BOLD = "Helvetica-Bold"
try:
    pdfmetrics.registerFont(TTFont("DejaVuSans", "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf"))
    pdfmetrics.registerFont(TTFont("DejaVuSans-Bold", "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf"))
    pdfmetrics.registerFontFamily("DejaVuSans", normal="DejaVuSans", bold="DejaVuSans-Bold", italic="DejaVuSans", boldItalic="DejaVuSans-Bold")
    _FONT_REG = "DejaVuSans"
    _FONT_BOLD = "DejaVuSans-Bold"
except Exception:
    pass

# ---------- Config ----------
MONGO_URL = os.environ["MONGO_URL"].strip('"\'')
DB_NAME = os.environ["DB_NAME"]
JWT_SECRET = os.environ["JWT_SECRET"]
JWT_ALGO = "HS256"
ADMIN_EMAIL = os.environ["ADMIN_EMAIL"].lower()
ADMIN_PASSWORD = os.environ["ADMIN_PASSWORD"]

# Company letterhead (configurable via env, with sensible defaults for ONCOST)
COMPANY_LEGAL_NAME = os.environ.get("COMPANY_LEGAL_NAME", "PRAGNA ENTERPRISES")
COMPANY_TRADE_NAME = os.environ.get("COMPANY_TRADE_NAME", "ONCOST")
COMPANY_TAGLINE = os.environ.get("COMPANY_TAGLINE", "Premium Corporate & Customized Gifting Solutions")
COMPANY_ADDRESS = os.environ.get("COMPANY_ADDRESS", "Bengaluru, Karnataka, India")
COMPANY_PHONE = os.environ.get("COMPANY_PHONE", "+91 - - -")
COMPANY_EMAIL = os.environ.get("COMPANY_EMAIL", "hello@oncostcatalog.in")
COMPANY_WEBSITE = os.environ.get("COMPANY_WEBSITE", "www.oncostcatalog.in")
COMPANY_GSTIN = os.environ.get("COMPANY_GSTIN", "")
COMPANY_BANK_DETAILS = os.environ.get("COMPANY_BANK_DETAILS", "Available on order confirmation")
DEFAULT_DELIVERY = os.environ.get(
    "DEFAULT_DELIVERY",
    "Order dispatch within 10-15 business days from confirmed PO + advance payment realization + final artwork approval.",
)
DEFAULT_PAYMENT_TERMS = os.environ.get(
    "DEFAULT_PAYMENT_TERMS",
    "50% advance on order confirmation, 50% balance before dispatch. "
    "Accepted modes: Bank Transfer (NEFT / RTGS / IMPS) or Account Payee Cheque only. "
    "CASH and UPI are NOT accepted.",
)
DEFAULT_INCLUSIONS = os.environ.get(
    "DEFAULT_INCLUSIONS",
    "Premium product packaging; Logo branding / customization (where applicable); "
    "Quality assurance on every unit; Inner protective + master carton packing; "
    "GST tax invoice with HSN breakup; Dedicated point-of-contact till delivery",
)
DEFAULT_TERMS = os.environ.get(
    "DEFAULT_TERMS",
    "1. Quotation valid for 15 days from the date of issue.; "
    "2. Prices are in INR and exclusive of GST unless stated otherwise.; "
    "3. Order confirmation requires a signed PO / email approval and 50% advance.; "
    "4. Production starts only after final artwork approval (vector AI / PDF / SVG).; "
    "5. Payment accepted via Bank Transfer (NEFT / RTGS / IMPS) or Account Payee Cheque ONLY. CASH and UPI are NOT accepted.; "
    "6. Cheque payments are subject to 3 working-day clearance before dispatch.; "
    "7. ±2% tolerance on colour, dimension and weight is industry-standard and not grounds for rejection.; "
    "8. Transit damage / loss to be reported within 48 hours of delivery with photographic proof.; "
    "9. Cancellation after production start: advance is non-refundable.; "
    "10. All disputes subject to Hyderabad, Telangana jurisdiction only.",
)
COMPANY_AUTHORIZED_SIGNATORY = os.environ.get("COMPANY_AUTHORIZED_SIGNATORY", "Corporate Gifting Division")

DATA_DIR = ROOT_DIR / "data"
IMAGES_DIR = DATA_DIR / "product_images"
PRODUCTS_JSON = DATA_DIR / "products.json"

import certifi
import asyncio

_clients = {}

class DBProxy:
    def __getattr__(self, name):
        loop = asyncio.get_running_loop()
        if loop not in _clients:
            _clients[loop] = AsyncIOMotorClient(MONGO_URL, tlsCAFile=certifi.where())
        return _clients[loop][DB_NAME][name]

db = DBProxy()

logger = logging.getLogger("oncost")
logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")

# ---------- Helpers ----------

def now_utc():
    return datetime.now(timezone.utc)


def iso(dt: datetime) -> str:
    return dt.isoformat()


def hash_password(pw: str) -> str:
    return bcrypt.hashpw(pw.encode(), bcrypt.gensalt()).decode()


def verify_password(pw: str, hashed: str) -> bool:
    try:
        return bcrypt.checkpw(pw.encode(), hashed.encode())
    except Exception:
        return False


def create_access_token(user_id: str, email: str) -> str:
    payload = {
        "sub": user_id,
        "email": email,
        "exp": now_utc() + timedelta(days=7),
        "type": "access",
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGO)


def serialize_doc(d: dict) -> dict:
    """Convert ObjectId to str, drop password_hash, keep id as string."""
    if not d:
        return d
    out = dict(d)
    if "_id" in out:
        out["id"] = str(out.pop("_id"))
    out.pop("password_hash", None)
    return out


def compute_oncost_price(sg_price: int, rule: dict) -> int:
    """rule: {threshold, below_increment, at_or_above_increment, rounding, active}
    If rule.active is explicitly False, markup is skipped and sg_price is used directly."""
    if rule.get("active", True) is False:
        return int(sg_price)
    threshold = rule.get("threshold", 1000)
    below = rule.get("below_increment", 50)
    above = rule.get("at_or_above_increment", 100)
    if sg_price < threshold:
        return int(sg_price + below)
    return int(sg_price + above)


# ---------- Auth dependency ----------
async def get_current_user(request: Request) -> dict:
    token = request.cookies.get("access_token")
    if not token:
        auth = request.headers.get("Authorization", "")
        if auth.startswith("Bearer "):
            token = auth[7:]
    if not token:
        raise HTTPException(status_code=401, detail="Not authenticated")
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGO])
        if payload.get("type") != "access":
            raise HTTPException(status_code=401, detail="Invalid token")
        user = await db.users.find_one({"_id": ObjectId(payload["sub"])})
        if not user:
            raise HTTPException(status_code=401, detail="User not found")
        return serialize_doc(user)
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid token")


# ---------- App ----------
app = FastAPI(title="ONCOST Catalog API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=os.environ.get("CORS_ORIGINS", "*").split(","),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

api = APIRouter(prefix="/api")

# ---------- Models ----------
class LoginIn(BaseModel):
    # `email` remains for backwards compatibility; also accepts an `identifier`
    # which may be an email or an Employee ID (e.g. ONCOST-EMP-0001).
    model_config = ConfigDict(extra="ignore")
    email: Optional[str] = None
    identifier: Optional[str] = None
    password: str


class PricingRule(BaseModel):
    model_config = ConfigDict(extra="ignore")
    threshold: int = 1000
    below_increment: int = 50
    at_or_above_increment: int = 100
    rounding: int = 1  # round to nearest n rupees (1 = exact)
    active: bool = True  # when False, markup is skipped and sg_price is used directly


class ProductIn(BaseModel):
    code: str
    set_type: str = ""
    items: str = ""
    sg_price: int
    moq: int = 50
    image: Optional[str] = None
    override_price: Optional[int] = None
    visible: bool = True
    vendor_id: Optional[str] = None
    vendor_code: Optional[str] = None
    category_id: Optional[str] = None


class ProductPatch(BaseModel):
    code: Optional[str] = None
    set_type: Optional[str] = None
    items: Optional[str] = None
    sg_price: Optional[int] = None
    moq: Optional[int] = None
    image: Optional[str] = None
    override_price: Optional[int] = None
    visible: Optional[bool] = None
    vendor_id: Optional[str] = None
    vendor_code: Optional[str] = None
    category_id: Optional[str] = None


class CategoryIn(BaseModel):
    name: str
    description: str = ""
    image: Optional[str] = None
    visible: bool = True


class CategoryPatch(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    image: Optional[str] = None
    visible: Optional[bool] = None


class VendorIn(BaseModel):
    name: str
    code_prefix: str = ""


class QuotationItemIn(BaseModel):
    product_id: str
    quantity: int


class QuotationIn(BaseModel):
    customer_name: str
    customer_email: str = ""
    customer_phone: str = ""
    customer_company: str = ""
    place: str = ""
    notes: str = ""
    items: List[QuotationItemIn]
    valid_until: Optional[str] = None
    shipping_charges: float = 0
    packaging_charges: float = 0
    branding_charges: float = 0
    gst_percent: float = 0
    # Per-quote discount override. If discount_type is None the global DiscountConfig is used.
    discount_type: Optional[str] = None   # "flat" | "percent" | None
    discount_value: Optional[float] = None
    discount_label: Optional[str] = None
    subject: str = ""
    delivery_timeline: str = ""
    payment_terms: str = ""
    inclusions: str = ""
    terms_and_conditions: str = ""
    partner_user_id: Optional[str] = None  # Attribute this quote to a partner for commission


class QuotationEditIn(BaseModel):
    """Editable fields on an existing quotation (no line-item changes)."""
    model_config = ConfigDict(extra="ignore")
    shipping_charges: Optional[float] = None
    packaging_charges: Optional[float] = None
    branding_charges: Optional[float] = None
    gst_percent: Optional[float] = None
    discount_type: Optional[str] = None
    discount_value: Optional[float] = None
    discount_label: Optional[str] = None
    subject: Optional[str] = None
    delivery_timeline: Optional[str] = None
    payment_terms: Optional[str] = None
    inclusions: Optional[str] = None
    terms_and_conditions: Optional[str] = None
    notes: Optional[str] = None
    valid_until: Optional[str] = None


class DiscountConfig(BaseModel):
    model_config = ConfigDict(extra="ignore")
    active: bool = False
    type: str = "flat"   # "flat" | "percent"
    value: float = 0
    label: str = "Discount"


# ---------- Auth endpoints ----------
@api.post("/auth/login")
async def login(payload: LoginIn, response: Response):
    ident = (payload.identifier or payload.email or "").strip()
    if not ident:
        raise HTTPException(status_code=400, detail="Email or Employee ID required")
    # Employee ID starts with ONCOST-EMP-, otherwise treat as email.
    if ident.upper().startswith("ONCOST-EMP-"):
        user = await db.users.find_one({"employee_id": ident.upper()})
    else:
        user = await db.users.find_one({"email": ident.lower()})
    if not user or not verify_password(payload.password, user["password_hash"]):
        raise HTTPException(status_code=401, detail="Invalid credentials")
    token = create_access_token(str(user["_id"]), user["email"])
    response.set_cookie(
        key="access_token", value=token,
        httponly=True, secure=True, samesite="none",
        max_age=7 * 24 * 3600, path="/",
    )
    out = serialize_doc(user)
    out["role"] = user.get("role", "admin")
    return {"user": out, "access_token": token}


@api.post("/auth/logout")
async def logout(response: Response, _user=Depends(get_current_user)):
    response.delete_cookie("access_token", path="/")
    return {"ok": True}


@api.get("/auth/me")
async def me(user=Depends(get_current_user)):
    if "role" not in user:
        user["role"] = "admin"
    return user


class ChangePasswordIn(BaseModel):
    current_password: str
    new_password: str


class ForgotPasswordIn(BaseModel):
    model_config = ConfigDict(extra="ignore")
    identifier: str  # email or Employee ID


class ResetPasswordIn(BaseModel):
    model_config = ConfigDict(extra="ignore")
    token: str
    new_password: str


@api.post("/auth/change-password")
async def change_password(payload: ChangePasswordIn, user=Depends(get_current_user)):
    if len(payload.new_password) < 8:
        raise HTTPException(400, "New password must be at least 8 characters")
    db_user = await db.users.find_one({"_id": ObjectId(user["id"])})
    if not db_user or not verify_password(payload.current_password, db_user["password_hash"]):
        raise HTTPException(401, "Current password is incorrect")
    await db.users.update_one(
        {"_id": ObjectId(user["id"])},
        {"$set": {"password_hash": hash_password(payload.new_password),
                  "must_change_password": False}},
    )
    return {"ok": True}


# ---------- Forgot / Reset password ----------
PASSWORD_RESET_TTL_HOURS = 24


@api.post("/auth/forgot-password")
async def forgot_password(payload: ForgotPasswordIn):
    """Generate a reset token for the account (admin or partner) and email a
    reset link. Response is intentionally identical whether or not an account
    exists — this prevents account enumeration."""
    ident = (payload.identifier or "").strip()
    generic_ok = {"ok": True, "message": "If an account exists for that identifier, a reset link has been sent."}
    if not ident:
        return generic_ok

    if ident.upper().startswith("ONCOST-EMP-"):
        user = await db.users.find_one({"employee_id": ident.upper()})
    else:
        user = await db.users.find_one({"email": ident.lower()})
    if not user:
        return generic_ok

    email = user.get("email")
    if not email:
        return generic_ok

    # Invalidate any prior unused tokens for this user so only the newest works.
    await db.password_resets.update_many(
        {"user_id": user["_id"], "used_at": None},
        {"$set": {"used_at": now_utc(), "invalidated": True}},
    )

    token = secrets.token_urlsafe(32)
    expires = now_utc() + timedelta(hours=PASSWORD_RESET_TTL_HOURS)
    await db.password_resets.insert_one({
        "user_id": user["_id"],
        "email": email,
        "token": token,
        "created_at": now_utc(),
        "expires_at": expires,
        "used_at": None,
    })

    from emailer import portal_url, render_password_reset_email, send_email, is_enabled
    reset_link = portal_url(f"/reset-password?token={token}")
    name = (user.get("name") or user.get("full_name")
            or (user.get("personal") or {}).get("full_name") or email)

    if is_enabled():
        try:
            await send_email(
                to=email,
                subject="Reset your ONCOST password",
                html=render_password_reset_email(
                    name=name, reset_link=reset_link,
                    expires_hours=PASSWORD_RESET_TTL_HOURS,
                ),
            )
        except Exception as e:
            logger.error("password reset email failed for %s: %s", email, e)
    else:
        logger.warning("Resend not configured — reset link for %s: %s", email, reset_link)

    return generic_ok


@api.post("/auth/reset-password")
async def reset_password(payload: ResetPasswordIn):
    token = (payload.token or "").strip()
    new_pw = payload.new_password or ""
    if len(new_pw) < 8:
        raise HTTPException(400, "New password must be at least 8 characters")

    rec = await db.password_resets.find_one({"token": token})
    if not rec or rec.get("used_at") is not None:
        raise HTTPException(400, "This reset link is invalid or has already been used")

    exp = rec.get("expires_at")
    if isinstance(exp, datetime):
        exp_aware = exp if exp.tzinfo else exp.replace(tzinfo=timezone.utc)
        if exp_aware < now_utc():
            raise HTTPException(400, "This reset link has expired. Please request a new one.")

    user = await db.users.find_one({"_id": rec["user_id"]})
    if not user:
        raise HTTPException(400, "Account no longer exists")

    await db.users.update_one(
        {"_id": user["_id"]},
        {"$set": {"password_hash": hash_password(new_pw),
                  "must_change_password": False}},
    )
    await db.password_resets.update_one(
        {"_id": rec["_id"]},
        {"$set": {"used_at": now_utc()}},
    )
    return {"ok": True, "email": user.get("email")}


@api.get("/auth/reset-password/verify")
async def verify_reset_token(token: str):
    """Lightweight endpoint the reset page hits to check whether the token is
    still valid before showing the form."""
    rec = await db.password_resets.find_one({"token": (token or "").strip()})
    if not rec or rec.get("used_at") is not None:
        return {"valid": False, "reason": "invalid_or_used"}
    exp = rec.get("expires_at")
    if isinstance(exp, datetime):
        exp_aware = exp if exp.tzinfo else exp.replace(tzinfo=timezone.utc)
        if exp_aware < now_utc():
            return {"valid": False, "reason": "expired"}
    return {"valid": True, "email": rec.get("email")}


# ---------- Pricing rule ----------
@api.get("/pricing-rule")
async def get_rule(_user=Depends(get_current_user)):
    rule = await db.pricing_rule.find_one({"_id": "default"})
    if not rule:
        rule = {"_id": "default", "threshold": 1000, "below_increment": 50, "at_or_above_increment": 100, "rounding": 1, "active": True}
        await db.pricing_rule.insert_one(rule)
    rule.pop("_id", None)
    rule.setdefault("active", True)
    return rule


@api.put("/pricing-rule")
async def put_rule(rule: PricingRule, _user=Depends(get_current_user)):
    doc = rule.model_dump()
    await db.pricing_rule.update_one({"_id": "default"}, {"$set": doc}, upsert=True)
    return doc


@api.get("/public/pricing-rule")
async def public_rule():
    rule = await db.pricing_rule.find_one({"_id": "default"})
    if not rule:
        return {"threshold": 1000, "below_increment": 50, "at_or_above_increment": 100, "active": True}
    rule.pop("_id", None)
    rule.setdefault("active", True)
    return rule


# ---------- Discount config (persistent, global) ----------
@api.get("/discount-config")
async def get_discount(_user=Depends(get_current_user)):
    doc = await db.discount_config.find_one({"_id": "default"})
    if not doc:
        doc = {"_id": "default", "active": False, "type": "flat", "value": 0, "label": "Discount"}
        await db.discount_config.insert_one(doc)
    doc.pop("_id", None)
    return doc


@api.put("/discount-config")
async def put_discount(payload: DiscountConfig, _user=Depends(get_current_user)):
    doc = payload.model_dump()
    if doc["type"] not in ("flat", "percent"):
        raise HTTPException(400, "type must be 'flat' or 'percent'")
    if doc["value"] < 0:
        raise HTTPException(400, "value must be >= 0")
    await db.discount_config.update_one({"_id": "default"}, {"$set": doc}, upsert=True)
    return doc


async def _resolve_discount(q_type: Optional[str], q_value: Optional[float], q_label: Optional[str]) -> dict:
    """Return {type, value, label, source} — either from per-quote override or global config."""
    if q_type in ("flat", "percent"):
        return {"type": q_type, "value": float(q_value or 0), "label": (q_label or "Discount"), "source": "quote"}
    cfg = await db.discount_config.find_one({"_id": "default"})
    if cfg and cfg.get("active") and float(cfg.get("value", 0)) > 0:
        return {"type": cfg.get("type", "flat"), "value": float(cfg["value"]), "label": cfg.get("label", "Discount"), "source": "global"}
    return {"type": None, "value": 0.0, "label": "", "source": "none"}


# ---------- Products ----------
async def _list_products(visible_only: bool = False) -> list:
    q = {"visible": True} if visible_only else {}
    cur = db.products.find(q).sort("code", 1)
    items = await cur.to_list(length=1000)
    rule = await db.pricing_rule.find_one({"_id": "default"}) or {
        "threshold": 1000, "below_increment": 50, "at_or_above_increment": 100,
    }
    for it in items:
        it["id"] = str(it.pop("_id"))
        sg = it.get("sg_price", 0)
        ov = it.get("override_price")
        oncost = int(ov) if ov is not None else compute_oncost_price(sg, rule)
        it["oncost_price"] = oncost
    return items


@api.get("/products")
async def get_products(_user=Depends(get_current_user)):
    return await _list_products()


@api.get("/public/products")
async def public_products():
    items = await _list_products(visible_only=True)
    # Strip sg_price from public view
    for it in items:
        it.pop("sg_price", None)
        it.pop("override_price", None)
    return items


@api.post("/products")
async def create_product(p: ProductIn, _user=Depends(get_current_user)):
    doc = p.model_dump()
    doc["created_at"] = iso(now_utc())
    res = await db.products.insert_one(doc)
    doc["id"] = str(res.inserted_id)
    doc.pop("_id", None)
    return doc


@api.put("/products/{pid}")
async def update_product(pid: str, p: ProductPatch, _user=Depends(get_current_user)):
    # Allow override_price=None explicitly (to clear override). For other fields, skip None.
    raw = p.model_dump(exclude_unset=True)
    update = {}
    for k, v in raw.items():
        if k in ("override_price", "category_id"):
            update[k] = v  # may be None to clear
        elif v is not None:
            update[k] = v
    if not update:
        raise HTTPException(400, "No fields to update")
    res = await db.products.update_one({"_id": ObjectId(pid)}, {"$set": update})
    if res.matched_count == 0:
        raise HTTPException(404, "Product not found")
    doc = await db.products.find_one({"_id": ObjectId(pid)})
    doc["id"] = str(doc.pop("_id"))
    return doc


@api.delete("/products/{pid}")
async def delete_product(pid: str, _user=Depends(get_current_user)):
    res = await db.products.delete_one({"_id": ObjectId(pid)})
    if res.deleted_count == 0:
        raise HTTPException(404, "Product not found")
    return {"ok": True}


# ---------- Product image upload ----------
from fastapi import UploadFile, File
import secrets as _sec

ALLOWED_IMG = {"image/jpeg", "image/jpg", "image/png", "image/webp"}

@api.post("/products/{pid}/image")
async def upload_product_image(pid: str, file: UploadFile = File(...), _user=Depends(get_current_user)):
    if file.content_type not in ALLOWED_IMG:
        raise HTTPException(400, "Only JPG, PNG, WEBP images allowed")
    prod = await db.products.find_one({"_id": ObjectId(pid)})
    if not prod:
        raise HTTPException(404, "Product not found")
    # Read & process via Pillow (auto-orient, normalize, resize, save as JPG)
    from PIL import Image, ImageOps
    import io as _io
    raw = await file.read()
    if len(raw) > 8 * 1024 * 1024:
        raise HTTPException(400, "Image too large (max 8MB)")
    try:
        img = Image.open(_io.BytesIO(raw))
        img = ImageOps.exif_transpose(img).convert("RGB")
    except Exception:
        raise HTTPException(400, "Invalid image")
    # Fit into 800x800 max preserving aspect
    img.thumbnail((800, 800))
    # Pad to square on white for consistency
    side = max(img.size)
    canvas = Image.new("RGB", (side, side), (255, 255, 255))
    canvas.paste(img, ((side - img.size[0]) // 2, (side - img.size[1]) // 2))
    canvas.thumbnail((720, 720))
    fname = f"{prod['code'].replace(' ', '_')}_{_sec.token_hex(4)}.jpg"
    # Save bytes to a buffer for upload (and to disk as fallback)
    jpeg_buf = _io.BytesIO()
    canvas.save(jpeg_buf, "JPEG", quality=88)
    jpeg_bytes = jpeg_buf.getvalue()
    # Try persistent object storage first
    try:
        put_object(build_storage_path(fname), jpeg_bytes, "image/jpeg")
    except Exception:
        pass
    # Always also write a local copy (used as fallback if storage call fails)
    try:
        (IMAGES_DIR / fname).write_bytes(jpeg_bytes)
    except Exception:
        pass
    await db.products.update_one({"_id": ObjectId(pid)}, {"$set": {"image": fname}})
    return {"image": fname}


# ---------- Quotations ----------
async def _build_quotation_doc(q: QuotationIn) -> dict:
    rule = await db.pricing_rule.find_one({"_id": "default"}) or {}
    items_out = []
    total = 0
    for qi in q.items:
        prod = await db.products.find_one({"_id": ObjectId(qi.product_id)})
        if not prod:
            raise HTTPException(400, f"Product {qi.product_id} not found")
        sg = prod.get("sg_price", 0)
        ov = prod.get("override_price")
        oncost = int(ov) if ov is not None else compute_oncost_price(sg, rule)
        line_total = oncost * qi.quantity
        total += line_total
        items_out.append({
            "product_id": str(prod["_id"]),
            "code": prod["code"],
            "set_type": prod.get("set_type", ""),
            "items": prod.get("items", ""),
            "image": prod.get("image"),
            "moq": prod.get("moq", 50),
            "unit_price": oncost,
            "quantity": qi.quantity,
            "line_total": line_total,
        })
    # Quotation ID like ONC-202602-0001
    seq_doc = await db.counters.find_one_and_update(
        {"_id": "quotation"},
        {"$inc": {"seq": 1}},
        upsert=True, return_document=True,
    )
    seq = seq_doc["seq"] if seq_doc else 1
    qid = f"ONC-{datetime.now().strftime('%Y%m')}-{seq:04d}"
    token = secrets.token_urlsafe(10)
    subtotal = total
    shipping = max(0, float(q.shipping_charges or 0))
    packaging = max(0, float(q.packaging_charges or 0))
    branding = max(0, float(q.branding_charges or 0))
    gst_percent = max(0, float(q.gst_percent or 0))
    pre_tax = subtotal + shipping + packaging + branding
    disc = await _resolve_discount(q.discount_type, q.discount_value, q.discount_label)
    if disc["type"] == "percent":
        discount_amount = round(pre_tax * disc["value"] / 100.0, 2)
    elif disc["type"] == "flat":
        discount_amount = round(min(disc["value"], pre_tax), 2)
    else:
        discount_amount = 0.0
    taxable = max(0.0, pre_tax - discount_amount)
    gst_amount = round(taxable * gst_percent / 100, 2)
    grand_total = round(taxable + gst_amount, 2)
    doc = {
        "quotation_id": qid,
        "customer_name": q.customer_name,
        "customer_email": (q.customer_email or "").strip(),
        "customer_phone": (q.customer_phone or "").strip(),
        "customer_company": (q.customer_company or "").strip(),
        "place": q.place,
        "notes": q.notes,
        "subject": (q.subject or "").strip() or "Quotation for Corporate Gifting Requirements",
        "delivery_timeline": (q.delivery_timeline or "").strip() or DEFAULT_DELIVERY,
        "payment_terms": (q.payment_terms or "").strip() or DEFAULT_PAYMENT_TERMS,
        "inclusions": (q.inclusions or "").strip() or DEFAULT_INCLUSIONS,
        "terms_and_conditions": (q.terms_and_conditions or "").strip() or DEFAULT_TERMS,
        "partner_user_id": (q.partner_user_id or None),
        "items": items_out,
        "subtotal": subtotal,
        "shipping_charges": shipping,
        "packaging_charges": packaging,
        "branding_charges": branding,
        "gst_percent": gst_percent,
        "gst_amount": gst_amount,
        "discount_type": disc["type"],
        "discount_value": disc["value"],
        "discount_label": disc["label"],
        "discount_amount": discount_amount,
        "taxable_amount": taxable,
        "total": grand_total,
        "valid_until": q.valid_until,
        "share_token": token,
        "active": True,
        "created_at": iso(now_utc()),
    }
    return doc


@api.post("/quotations")
async def create_quotation(q: QuotationIn, _user=Depends(get_current_user)):
    doc = await _build_quotation_doc(q)
    res = await db.quotations.insert_one(doc)
    doc["id"] = str(res.inserted_id)
    doc.pop("_id", None)
    return doc


@api.get("/quotations")
async def list_quotations(_user=Depends(get_current_user)):
    cur = db.quotations.find({}).sort("created_at", -1)
    out = []
    for d in await cur.to_list(length=500):
        d["id"] = str(d.pop("_id"))
        out.append(d)
    return out


@api.get("/quotations/{qid}")
async def get_quotation(qid: str, _user=Depends(get_current_user)):
    d = await db.quotations.find_one({"_id": ObjectId(qid)})
    if not d:
        raise HTTPException(404, "Not found")
    d["id"] = str(d.pop("_id"))
    return d


@api.patch("/quotations/{qid}/toggle")
async def toggle_quotation(qid: str, _user=Depends(get_current_user)):
    d = await db.quotations.find_one({"_id": ObjectId(qid)})
    if not d:
        raise HTTPException(404, "Not found")
    new_active = not d.get("active", True)
    await db.quotations.update_one({"_id": ObjectId(qid)}, {"$set": {"active": new_active}})
    return {"active": new_active}


@api.patch("/quotations/{qid}/edit")
async def edit_quotation(qid: str, payload: QuotationEditIn, _user=Depends(get_current_user)):
    d = await db.quotations.find_one({"_id": ObjectId(qid)})
    if not d:
        raise HTTPException(404, "Not found")
    # Merge inbound patch onto the current doc for the recomputable charge / text fields.
    up = payload.model_dump(exclude_unset=True)
    for k, v in up.items():
        if v is not None:
            d[k] = v
    # Recompute totals with the new charges/discount.
    subtotal = float(d.get("subtotal", 0))
    shipping = max(0, float(d.get("shipping_charges", 0) or 0))
    packaging = max(0, float(d.get("packaging_charges", 0) or 0))
    branding = max(0, float(d.get("branding_charges", 0) or 0))
    gst_percent = max(0, float(d.get("gst_percent", 0) or 0))
    pre_tax = subtotal + shipping + packaging + branding
    q_type = d.get("discount_type")
    disc = await _resolve_discount(q_type, d.get("discount_value"), d.get("discount_label"))
    if disc["type"] == "percent":
        discount_amount = round(pre_tax * disc["value"] / 100.0, 2)
    elif disc["type"] == "flat":
        discount_amount = round(min(disc["value"], pre_tax), 2)
    else:
        discount_amount = 0.0
    taxable = max(0.0, pre_tax - discount_amount)
    gst_amount = round(taxable * gst_percent / 100, 2)
    grand_total = round(taxable + gst_amount, 2)
    update = {
        "shipping_charges": shipping,
        "packaging_charges": packaging,
        "branding_charges": branding,
        "gst_percent": gst_percent,
        "discount_type": disc["type"],
        "discount_value": disc["value"],
        "discount_label": disc["label"],
        "discount_amount": discount_amount,
        "taxable_amount": taxable,
        "gst_amount": gst_amount,
        "total": grand_total,
    }
    for k in ("subject", "delivery_timeline", "payment_terms", "inclusions", "terms_and_conditions", "notes", "valid_until"):
        if k in up and up[k] is not None:
            update[k] = up[k]
    await db.quotations.update_one({"_id": ObjectId(qid)}, {"$set": update})
    doc = await db.quotations.find_one({"_id": ObjectId(qid)})
    doc["id"] = str(doc.pop("_id"))
    return doc


@api.delete("/quotations/{qid}")
async def delete_quotation(qid: str, _user=Depends(get_current_user)):
    res = await db.quotations.delete_one({"_id": ObjectId(qid)})
    if res.deleted_count == 0:
        raise HTTPException(404, "Not found")
    return {"ok": True}


# ---------- Public share ----------
@api.get("/share/{token}")
async def public_quotation(token: str):
    d = await db.quotations.find_one({"share_token": token})
    if not d or not d.get("active", True):
        raise HTTPException(404, "Quotation not available")
    d["id"] = str(d.pop("_id"))
    # Strip any internal-only fields (no SG cost stored on quotation snapshots already)
    return d


# ---------- PDF generation ----------
NAVY = colors.HexColor("#0F172A")
GOLD = colors.HexColor("#B8860B")
INK = colors.HexColor("#09090B")
MUTED = colors.HexColor("#52525B")
LINE = colors.HexColor("#D4D4D8")


def format_inr(n) -> str:
    try:
        return f"₹ {float(n):,.2f}"
    except Exception:
        return f"₹ {n}"


def _build_pdf(q: dict) -> bytes:
    buf = io.BytesIO()
    doc = SimpleDocTemplate(
        buf, pagesize=A4,
        leftMargin=14 * mm, rightMargin=14 * mm,
        topMargin=12 * mm, bottomMargin=12 * mm,
        title=f"ONCOST Quotation {q['quotation_id']}",
        author=COMPANY_LEGAL_NAME,
        subject=q.get("subject") or "Corporate Gifting Quotation",
    )
    styles = getSampleStyleSheet()
    h_corp_line = ParagraphStyle("h_corp_line", parent=styles["Normal"], fontName=_FONT_REG, fontSize=8, textColor=MUTED, alignment=TA_LEFT, leading=11)
    h_corp_right = ParagraphStyle("h_corp_right", parent=h_corp_line, alignment=TA_RIGHT)
    h_title_big = ParagraphStyle("h_title_big", parent=styles["Normal"], fontName=_FONT_BOLD, fontSize=14, textColor=NAVY, alignment=TA_CENTER, leading=18, spaceAfter=2)
    h_meta_label = ParagraphStyle("h_meta_label", parent=styles["Normal"], fontName=_FONT_BOLD, fontSize=7, textColor=MUTED, leading=9, alignment=TA_LEFT)
    h_meta_val = ParagraphStyle("h_meta_val", parent=styles["Normal"], fontName=_FONT_BOLD, fontSize=9.5, textColor=INK, leading=12, alignment=TA_LEFT)
    h_section = ParagraphStyle("h_section", parent=styles["Normal"], fontName=_FONT_BOLD, fontSize=9.5, textColor=NAVY, leading=12, spaceBefore=2, spaceAfter=4)
    h_body = ParagraphStyle("h_body", parent=styles["Normal"], fontName=_FONT_REG, fontSize=9, textColor=INK, leading=12)
    h_footer = ParagraphStyle("h_footer", parent=styles["Normal"], fontName=_FONT_REG, fontSize=7.5, textColor=MUTED, alignment=TA_CENTER, leading=10)

    story = []

    # ===== LETTERHEAD =====
    left_block = (
        f"<para>"
        f"<b><font size=22 color='{NAVY.hexval()}'>ONCOST</font></b><br/>"
        f"<font size=8 color='{GOLD.hexval()}'><b>{COMPANY_TAGLINE}</b></font>"
        f"</para>"
    )
    right_lines = []
    right_lines.append(f"<b>{COMPANY_LEGAL_NAME}</b>")
    if COMPANY_ADDRESS:
        right_lines.append(COMPANY_ADDRESS)
    contact_line_bits = []
    if COMPANY_PHONE:
        contact_line_bits.append(f"M {COMPANY_PHONE}")
    if COMPANY_EMAIL:
        contact_line_bits.append(COMPANY_EMAIL)
    if contact_line_bits:
        right_lines.append(" &nbsp;·&nbsp; ".join(contact_line_bits))
    web_bits = []
    if COMPANY_WEBSITE:
        web_bits.append(COMPANY_WEBSITE)
    if COMPANY_GSTIN:
        web_bits.append(f"GSTIN {COMPANY_GSTIN}")
    if web_bits:
        right_lines.append(" &nbsp;·&nbsp; ".join(web_bits))
    right_block = "<br/>".join(right_lines)

    head = Table(
        [[Paragraph(left_block, h_corp_line), Paragraph(right_block, h_corp_right)]],
        colWidths=[80 * mm, 98 * mm],
    )
    head.setStyle(TableStyle([("VALIGN", (0, 0), (-1, -1), "TOP")]))
    story.append(head)
    story.append(Spacer(1, 2 * mm))
    # Gold accent line
    sep = Table([[""]], colWidths=[182 * mm], rowHeights=[2])
    sep.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, -1), GOLD),
    ]))
    story.append(sep)
    story.append(Spacer(1, 3 * mm))

    # ===== DOCUMENT TITLE =====
    story.append(Paragraph("CORPORATE GIFTING QUOTATION", h_title_big))
    story.append(Spacer(1, 2 * mm))

    # Quotation meta strip
    created = q.get("created_at", "")
    try:
        created_dt = datetime.fromisoformat(created)
        created_str = created_dt.strftime("%d %b %Y")
    except Exception:
        created_str = created[:10]

    meta_strip = Table(
        [
            [
                Paragraph("QUOTATION NO.", h_meta_label),
                Paragraph("DATE", h_meta_label),
                Paragraph("VALID UNTIL", h_meta_label),
                Paragraph("PLACE", h_meta_label),
            ],
            [
                Paragraph(q.get("quotation_id", "—"), h_meta_val),
                Paragraph(created_str, h_meta_val),
                Paragraph(q.get("valid_until") or "—", h_meta_val),
                Paragraph(q.get("place") or "—", h_meta_val),
            ],
        ],
        colWidths=[44 * mm, 44 * mm, 44 * mm, 46 * mm],
    )
    meta_strip.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#F4F4F5")),
        ("BOTTOMPADDING", (0, 0), (-1, 0), 4),
        ("TOPPADDING", (0, 0), (-1, 0), 4),
        ("BOTTOMPADDING", (0, 1), (-1, 1), 6),
        ("TOPPADDING", (0, 1), (-1, 1), 4),
        ("LEFTPADDING", (0, 0), (-1, -1), 6),
        ("RIGHTPADDING", (0, 0), (-1, -1), 6),
        ("LINEBELOW", (0, 1), (-1, 1), 0.5, LINE),
    ]))
    story.append(meta_strip)
    story.append(Spacer(1, 3 * mm))

    # ===== TO / Recipient =====
    to_lines = ["<b>To,</b>"]
    if q.get("customer_name"):
        to_lines.append(q["customer_name"])
    if q.get("customer_company"):
        to_lines.append(q["customer_company"])
    contact_bits = []
    if q.get("customer_phone"):
        contact_bits.append(q["customer_phone"])
    if q.get("customer_email"):
        contact_bits.append(q["customer_email"])
    if contact_bits:
        to_lines.append(" &nbsp;·&nbsp; ".join(contact_bits))
    if q.get("place"):
        to_lines.append(q["place"])
    story.append(Paragraph("<br/>".join(to_lines), h_body))
    story.append(Spacer(1, 3 * mm))

    # Subject line
    subject = q.get("subject") or "Quotation for Corporate Gifting Requirements"
    story.append(Paragraph(f"<b>Subject:</b> {subject}", h_body))
    story.append(Spacer(1, 2 * mm))
    story.append(Paragraph(
        "Dear Sir / Madam, &nbsp; Thank you for considering us for your corporate gifting requirements. "
        "We are pleased to share our proposal as detailed below.",
        h_body,
    ))
    story.append(Spacer(1, 3 * mm))

    # ===== LINE ITEMS =====
    story.append(Paragraph("PRODUCT DETAILS", h_section))

    rows = [[
        Paragraph("<b>S.NO</b>", h_meta_label),
        Paragraph("<b>IMAGE</b>", h_meta_label),
        Paragraph("<b>CODE</b>", h_meta_label),
        Paragraph("<b>DESCRIPTION</b>", h_meta_label),
        Paragraph("<b>MOQ</b>", h_meta_label),
        Paragraph("<b>QTY</b>", h_meta_label),
        Paragraph("<b>UNIT (₹)</b>", h_meta_label),
        Paragraph("<b>AMOUNT (₹)</b>", h_meta_label),
    ]]
    item_value = ParagraphStyle("iv", parent=styles["Normal"], fontName=_FONT_REG, fontSize=8.5, leading=11, textColor=INK)
    item_value_b = ParagraphStyle("ivb", parent=item_value, fontName=_FONT_BOLD)
    for idx, it in enumerate(q["items"], start=1):
        desc = f"<b>{it.get('set_type','')}</b><br/><font color='#52525B'>{it.get('items','')}</font>"
        img_cell = ""
        img_name = it.get("image")
        if img_name:
            img_path = IMAGES_DIR / img_name
            if img_path.exists():
                try:
                    img_cell = RLImage(str(img_path), width=13 * mm, height=13 * mm, kind="proportional")
                except Exception:
                    img_cell = ""
        rows.append([
            Paragraph(str(idx), item_value),
            img_cell,
            Paragraph(it["code"], item_value_b),
            Paragraph(desc, item_value),
            Paragraph(str(it.get("moq", "")), item_value),
            Paragraph(str(it.get("quantity", "")), item_value),
            Paragraph(f"{it['unit_price']:,}", item_value),
            Paragraph(f"{it['line_total']:,}", item_value_b),
        ])
    itbl = Table(
        rows,
        colWidths=[10 * mm, 16 * mm, 18 * mm, 60 * mm, 12 * mm, 12 * mm, 22 * mm, 28 * mm],
        repeatRows=1,
    )
    itbl.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), NAVY),
        ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
        ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
        ("LINEBELOW", (0, 0), (-1, 0), 0.6, NAVY),
        ("LINEBELOW", (0, 1), (-1, -1), 0.4, LINE),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
        ("TOPPADDING", (0, 0), (-1, -1), 5),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
    ]))
    story.append(itbl)
    story.append(Spacer(1, 3 * mm))

    # ===== TOTALS =====
    subtotal = q.get("subtotal", q.get("total", 0))
    shipping = q.get("shipping_charges", 0)
    packaging = q.get("packaging_charges", 0) or 0
    branding = q.get("branding_charges", 0) or 0
    discount_amount = q.get("discount_amount", 0) or 0
    discount_type = q.get("discount_type")
    discount_value = q.get("discount_value", 0)
    discount_label = q.get("discount_label") or "Discount"
    gst_percent = q.get("gst_percent", 0)
    gst_amount = q.get("gst_amount", 0)
    grand = q.get("total", subtotal + shipping + gst_amount)

    brk_lbl = ParagraphStyle("brk_lbl", parent=styles["Normal"], fontName=_FONT_REG, fontSize=9, textColor=MUTED, alignment=TA_RIGHT)
    brk_val = ParagraphStyle("brk_val", parent=styles["Normal"], fontName=_FONT_REG, fontSize=10, textColor=INK, alignment=TA_RIGHT)
    disc_lbl = ParagraphStyle("disc_lbl", parent=styles["Normal"], fontName=_FONT_REG, fontSize=9, textColor=colors.HexColor("#065F46"), alignment=TA_RIGHT)
    disc_val = ParagraphStyle("disc_val", parent=styles["Normal"], fontName=_FONT_REG, fontSize=10, textColor=colors.HexColor("#065F46"), alignment=TA_RIGHT)

    rows = [[Paragraph("Subtotal (Products)", brk_lbl), Paragraph(format_inr(subtotal), brk_val)]]
    if packaging > 0:
        rows.append([Paragraph("Packaging Charges", brk_lbl), Paragraph(format_inr(packaging), brk_val)])
    if branding > 0:
        rows.append([Paragraph("Branding / Printing Charges", brk_lbl), Paragraph(format_inr(branding), brk_val)])
    if shipping > 0:
        rows.append([Paragraph("Shipping Charges", brk_lbl), Paragraph(format_inr(shipping), brk_val)])
    if discount_amount > 0:
        d_label = discount_label
        if discount_type == "percent":
            d_label = f"{discount_label} ({discount_value:g}%)"
        rows.append([Paragraph(f"Less: {d_label}", disc_lbl), Paragraph(f"- {format_inr(discount_amount)}", disc_val)])
    rows.append([Paragraph(f"GST ({gst_percent:g}%)", brk_lbl), Paragraph(format_inr(gst_amount), brk_val)])

    totals = Table(rows, colWidths=[140 * mm, 42 * mm])
    totals.setStyle(TableStyle([
        ("BOTTOMPADDING", (0, 0), (-1, -1), 3),
        ("TOPPADDING", (0, 0), (-1, -1), 2),
    ]))
    story.append(totals)
    grand_tbl = Table(
        [[Paragraph("<b>GRAND TOTAL</b>", ParagraphStyle("gt_l", parent=styles["Normal"], fontName=_FONT_BOLD, fontSize=10, textColor=colors.white, alignment=TA_RIGHT)),
          Paragraph(f"<b>{format_inr(grand)}</b>", ParagraphStyle("gt_v", parent=styles["Normal"], fontName=_FONT_BOLD, fontSize=12, textColor=colors.white, alignment=TA_RIGHT))]],
        colWidths=[140 * mm, 42 * mm],
    )
    grand_tbl.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, -1), NAVY),
        ("TOPPADDING", (0, 0), (-1, -1), 6),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
        ("LEFTPADDING", (0, 0), (-1, -1), 8),
        ("RIGHTPADDING", (0, 0), (-1, -1), 8),
    ]))
    story.append(grand_tbl)
    story.append(Spacer(1, 3 * mm))

    # ===== INCLUSIONS / DELIVERY / PAYMENT =====
    inclusions_raw = q.get("inclusions") or DEFAULT_INCLUSIONS
    incl_items = [s.strip() for s in inclusions_raw.replace("\n", ";").split(";") if s.strip()]
    incl_html = "<br/>".join([f"✓ {x}" for x in incl_items])

    info_tbl = Table(
        [[
            Paragraph("<b>INCLUSIONS</b><br/>" + incl_html, h_body),
            Paragraph("<b>DELIVERY TIMELINE</b><br/>" + (q.get("delivery_timeline") or DEFAULT_DELIVERY), h_body),
            Paragraph("<b>PAYMENT TERMS</b><br/>" + (q.get("payment_terms") or DEFAULT_PAYMENT_TERMS), h_body),
        ]],
        colWidths=[60 * mm, 58 * mm, 60 * mm],
    )
    info_tbl.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, -1), colors.HexColor("#F8FAFC")),
        ("BOX", (0, 0), (-1, -1), 0.4, LINE),
        ("INNERGRID", (0, 0), (-1, -1), 0.4, LINE),
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("LEFTPADDING", (0, 0), (-1, -1), 8),
        ("RIGHTPADDING", (0, 0), (-1, -1), 8),
        ("TOPPADDING", (0, 0), (-1, -1), 8),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 8),
    ]))
    story.append(info_tbl)

    # Payment policy callout — emphasizes accepted modes
    story.append(Spacer(1, 3 * mm))
    pay_callout = Table(
        [[Paragraph(
            "<b>PAYMENT POLICY:</b> 50% advance on confirmation, 50% balance before dispatch. "
            "Accepted modes: <b>Bank Transfer (NEFT / RTGS / IMPS)</b> or <b>Account Payee Cheque</b> only. "
            "<font color='#B91C1C'><b>CASH and UPI are NOT accepted.</b></font>",
            ParagraphStyle("pay_call", parent=h_body, fontSize=8.5, leading=11),
        )]],
        colWidths=[178 * mm],
    )
    pay_callout.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, -1), colors.HexColor("#FFF7ED")),
        ("BOX", (0, 0), (-1, -1), 0.6, colors.HexColor("#F59E0B")),
        ("LEFTPADDING", (0, 0), (-1, -1), 10),
        ("RIGHTPADDING", (0, 0), (-1, -1), 10),
        ("TOPPADDING", (0, 0), (-1, -1), 6),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
    ]))
    story.append(pay_callout)

    # ===== TERMS & CONDITIONS =====
    terms_raw = q.get("terms_and_conditions") or DEFAULT_TERMS
    terms_items = [s.strip() for s in terms_raw.replace("\n", ";").split(";") if s.strip()]
    story.append(Spacer(1, 4 * mm))
    story.append(Paragraph("TERMS &amp; CONDITIONS", h_section))
    terms_style = ParagraphStyle("terms", parent=h_body, fontSize=8.5, leading=11, leftIndent=8)
    for t in terms_items:
        story.append(Paragraph(f"• {t}", terms_style))

    if q.get("notes"):
        story.append(Spacer(1, 3 * mm))
        story.append(Paragraph("ADDITIONAL NOTES", h_section))
        story.append(Paragraph(q["notes"].replace("\n", "<br/>"), h_body))

    story.append(Spacer(1, 4 * mm))

    # ===== CLOSING + SIGNATURE =====
    closing_tbl = Table(
        [[
            Paragraph(
                "Thank you for the opportunity. We look forward to your confirmation and a long-standing business relationship.<br/><br/>"
                "<b>Warm Regards,</b><br/>"
                f"<b>{COMPANY_LEGAL_NAME}</b><br/>"
                f"{COMPANY_AUTHORIZED_SIGNATORY}<br/><br/>"
                "<i>Authorized Signatory</i>",
                h_body,
            ),
            Paragraph(
                f"<b>Bank / Payment</b><br/>{COMPANY_BANK_DETAILS}",
                h_body,
            ),
        ]],
        colWidths=[110 * mm, 68 * mm],
    )
    closing_tbl.setStyle(TableStyle([("VALIGN", (0, 0), (-1, -1), "TOP")]))
    story.append(closing_tbl)
    story.append(Spacer(1, 6 * mm))

    # Gold accent footer line
    sep2 = Table([[""]], colWidths=[178 * mm], rowHeights=[1.4])
    sep2.setStyle(TableStyle([("BACKGROUND", (0, 0), (-1, -1), GOLD)]))
    story.append(sep2)
    story.append(Spacer(1, 2 * mm))
    footer_bits = []
    if COMPANY_WEBSITE:
        footer_bits.append(COMPANY_WEBSITE)
    if COMPANY_PHONE:
        footer_bits.append(f"WhatsApp {COMPANY_PHONE}")
    if COMPANY_GSTIN:
        footer_bits.append(f"GSTIN {COMPANY_GSTIN}")
    footer_bits.append(f"Quotation {q.get('quotation_id','')}")
    story.append(Paragraph("&nbsp;&nbsp;·&nbsp;&nbsp;".join(footer_bits), h_footer))

    doc.build(story)
    return buf.getvalue()


@api.get("/share/{token}/pdf")
async def share_pdf(token: str):
    d = await db.quotations.find_one({"share_token": token})
    if not d or not d.get("active", True):
        raise HTTPException(404, "Quotation not available")
    d["id"] = str(d.pop("_id"))
    pdf_bytes = _build_pdf(d)
    return StreamingResponse(
        io.BytesIO(pdf_bytes),
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="ONCOST-{d["quotation_id"]}.pdf"'},
    )


@api.get("/quotations/{qid}/pdf")
async def admin_quotation_pdf(qid: str, _user=Depends(get_current_user)):
    d = await db.quotations.find_one({"_id": ObjectId(qid)})
    if not d:
        raise HTTPException(404, "Not found")
    d["id"] = str(d.pop("_id"))
    pdf_bytes = _build_pdf(d)
    return StreamingResponse(
        io.BytesIO(pdf_bytes),
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="ONCOST-{d["quotation_id"]}.pdf"'},
    )


# ---------- Categories ----------
@api.get("/categories")
async def list_categories(_user=Depends(get_current_user)):
    cur = db.categories.find({}).sort("name", 1)
    out = []
    for c in await cur.to_list(length=500):
        c["id"] = str(c.pop("_id"))
        out.append(c)
    return out


@api.get("/public/categories")
async def public_categories():
    cur = db.categories.find({"visible": {"$ne": False}}).sort("name", 1)
    out = []
    for c in await cur.to_list(length=500):
        c["id"] = str(c.pop("_id"))
        out.append(c)
    return out


@api.post("/categories")
async def create_category(payload: CategoryIn, _user=Depends(get_current_user)):
    name = (payload.name or "").strip()
    if not name:
        raise HTTPException(400, "Name required")
    existing = await db.categories.find_one({"name": name})
    if existing:
        raise HTTPException(400, f"Category '{name}' already exists")
    doc = {
        "name": name,
        "description": (payload.description or "").strip(),
        "image": payload.image,
        "visible": bool(payload.visible),
        "created_at": iso(now_utc()),
    }
    res = await db.categories.insert_one(doc)
    doc["id"] = str(res.inserted_id)
    doc.pop("_id", None)
    return doc


@api.put("/categories/{cid}")
async def update_category(cid: str, payload: CategoryPatch, _user=Depends(get_current_user)):
    update = {k: v for k, v in payload.model_dump(exclude_unset=True).items() if v is not None or k == "image"}
    if not update:
        raise HTTPException(400, "No fields to update")
    if "name" in update:
        update["name"] = update["name"].strip()
        if not update["name"]:
            raise HTTPException(400, "Name required")
    res = await db.categories.update_one({"_id": ObjectId(cid)}, {"$set": update})
    if res.matched_count == 0:
        raise HTTPException(404, "Category not found")
    doc = await db.categories.find_one({"_id": ObjectId(cid)})
    doc["id"] = str(doc.pop("_id"))
    return doc


@api.delete("/categories/{cid}")
async def delete_category(cid: str, _user=Depends(get_current_user)):
    res = await db.categories.delete_one({"_id": ObjectId(cid)})
    if res.deleted_count == 0:
        raise HTTPException(404, "Category not found")
    # Unset category_id on its products (do not delete products)
    await db.products.update_many({"category_id": cid}, {"$set": {"category_id": None}})
    return {"ok": True}


@api.post("/categories/{cid}/image")
async def upload_category_image(cid: str, file: UploadFile = File(...), _user=Depends(get_current_user)):
    if file.content_type not in ALLOWED_IMG:
        raise HTTPException(400, "Only JPG, PNG, WEBP images allowed")
    cat = await db.categories.find_one({"_id": ObjectId(cid)})
    if not cat:
        raise HTTPException(404, "Category not found")
    from PIL import Image, ImageOps
    import io as _io
    raw = await file.read()
    if len(raw) > 8 * 1024 * 1024:
        raise HTTPException(400, "Image too large (max 8MB)")
    try:
        img = Image.open(_io.BytesIO(raw))
        img = ImageOps.exif_transpose(img).convert("RGB")
    except Exception:
        raise HTTPException(400, "Invalid image")
    img.thumbnail((800, 800))
    side = max(img.size)
    canvas = Image.new("RGB", (side, side), (255, 255, 255))
    canvas.paste(img, ((side - img.size[0]) // 2, (side - img.size[1]) // 2))
    canvas.thumbnail((720, 720))
    safe = re.sub(r"[^A-Za-z0-9_-]+", "_", cat.get("name", "cat")).strip("_") or "cat"
    fname = f"cat_{safe}_{_sec.token_hex(4)}.jpg"
    jbuf = _io.BytesIO()
    canvas.save(jbuf, "JPEG", quality=88)
    jbytes = jbuf.getvalue()
    try:
        put_object(build_storage_path(fname), jbytes, "image/jpeg")
    except Exception:
        pass
    try:
        (IMAGES_DIR / fname).write_bytes(jbytes)
    except Exception:
        pass
    await db.categories.update_one({"_id": ObjectId(cid)}, {"$set": {"image": fname}})
    return {"image": fname}


# ---------- Vendors ----------
@api.get("/vendors")
async def list_vendors(_user=Depends(get_current_user)):
    cur = db.vendors.find({}).sort("name", 1)
    out = []
    for v in await cur.to_list(length=200):
        v["id"] = str(v.pop("_id"))
        out.append(v)
    return out


@api.post("/vendors")
async def create_vendor(payload: VendorIn, _user=Depends(get_current_user)):
    doc = {"name": payload.name.strip(), "code_prefix": (payload.code_prefix or "").strip(), "created_at": iso(now_utc())}
    if not doc["name"]:
        raise HTTPException(400, "Name required")
    existing = await db.vendors.find_one({"name": doc["name"]})
    if existing:
        return {
            "id": str(existing["_id"]),
            "name": existing.get("name", ""),
            "code_prefix": existing.get("code_prefix", ""),
            "created_at": existing.get("created_at", ""),
        }
    res = await db.vendors.insert_one(doc)
    doc["id"] = str(res.inserted_id)
    return doc


@api.delete("/vendors/{vid}")
async def delete_vendor(vid: str, _user=Depends(get_current_user)):
    await db.vendors.delete_one({"_id": ObjectId(vid)})
    # Unset vendor_id on its products (do not delete the products)
    await db.products.update_many({"vendor_id": vid}, {"$set": {"vendor_id": None}})
    return {"ok": True}


# ---------- PDF Import ----------
class PDFImportCommit(BaseModel):
    vendor_id: str
    code_prefix: str = ""
    use_custom_rule: bool = False
    threshold: int = 1000
    below_increment: int = 50
    at_or_above_increment: int = 100
    products: List[dict]  # each: {code, set_type, items, sg_price, moq, image (optional filename)}


@api.post("/import/pdf/extract")
async def import_pdf_extract(file: UploadFile = File(...), _user=Depends(get_current_user)):
    """Parse uploaded PDF and return extracted products + extracted images (saved to disk)."""
    if file.content_type not in ("application/pdf", "application/octet-stream"):
        # be lenient
        if not (file.filename or "").lower().endswith(".pdf"):
            raise HTTPException(400, "Please upload a PDF file")
    raw = await file.read()
    if not raw:
        raise HTTPException(400, "Empty file")
    if len(raw) > 80 * 1024 * 1024:
        raise HTTPException(400, "PDF too large (max 80MB)")

    # Save and parse
    import tempfile
    tmp = tempfile.NamedTemporaryFile(suffix=".pdf", delete=False)
    tmp.write(raw)
    tmp.close()

    import fitz  # PyMuPDF
    try:
        pdoc = fitz.open(tmp.name)
    except Exception:
        os.unlink(tmp.name)
        raise HTTPException(400, "Could not read PDF")

    # Generic parser: find product code patterns (e.g. SG 123, OC-123, V1-456 etc.)
    code_re = re.compile(r"\b([A-Z]{1,4}[ \-]?\d{2,5})\b")
    price_re = re.compile(r"(?:Rs[.,]?|₹)\s*([0-9]{2,6})", re.I)
    moq_re = re.compile(r"MOQ[, :]*([0-9]+)", re.I)
    setn_re = re.compile(r"(\d+\s*in\s*1)", re.I)

    extracted: list = []
    image_counter = 0

    for pno in range(pdoc.page_count):
        page = pdoc.load_page(pno)
        text = page.get_text("text")
        # Split by code occurrences in reading order
        parts = re.split(r"(?=\b[A-Z]{1,4}[ \-]?\d{2,5}\b)", text)
        # Get embedded image bboxes for this page
        info = page.get_image_info(xrefs=True)
        page_rect = page.rect
        pix = page.get_pixmap(dpi=200)
        from PIL import Image as PIm
        page_img = PIm.frombytes("RGB", (pix.width, pix.height), pix.samples)
        sx = pix.width / page_rect.width
        sy = pix.height / page_rect.height
        # filter sizable images, sort top-down left-right
        boxes = []
        for im in info:
            bb = im.get("bbox")
            if not bb:
                continue
            w = bb[2] - bb[0]
            h = bb[3] - bb[1]
            if w < 100 or h < 100:
                continue
            boxes.append(bb)
        boxes.sort(key=lambda b: (round(b[1] / 30), b[0]))

        page_products = []
        for part in parts:
            m = code_re.match(part)
            if not m:
                continue
            code = m.group(1).strip()
            # Normalize spacing — e.g., "SG 547" stays, "SG547" becomes "SG 547"
            ncode = re.sub(r"^([A-Z]+)\s*", r"\1 ", code).strip()
            pm = price_re.search(part)
            price = int(pm.group(1)) if pm else 0
            mm_ = moq_re.search(part)
            moq = int(mm_.group(1)) if mm_ else 50
            sn = setn_re.search(part)
            set_type = sn.group(1).replace(" ", "") if sn else ""
            # items: take lines until we hit MOQ/price line
            items_lines = []
            for ln in [x.strip(" ,") for x in part.splitlines() if x.strip()][1:]:
                if "Rs" in ln or "₹" in ln or "Price" in ln or "MOQ" in ln:
                    break
                if re.match(r"^\d+\s*in\s*1", ln, re.I):
                    continue
                items_lines.append(ln.strip(" ,&"))
            items_txt = re.sub(r"\s+", " ", ", ".join(items_lines)).strip(" ,")
            page_products.append({
                "code": ncode, "set_type": set_type, "items": items_txt,
                "sg_price": price, "moq": moq, "page": pno + 1,
            })

        # Match images to products in reading order
        for prod, bbox in zip(page_products, boxes):
            try:
                x0 = int(bbox[0] * sx)
                y0 = int(bbox[1] * sy)
                x1 = int(bbox[2] * sx)
                y1 = int(bbox[3] * sy)
                w = x1 - x0
                h = y1 - y0
                # Inset
                crop = page_img.crop((x0 + int(w*0.03), y0 + int(h*0.02), x1 - int(w*0.03), y1 - int(h*0.14)))
                cw, ch = crop.size
                side = max(cw, ch)
                canvas = PIm.new("RGB", (side, side), (255, 255, 255))
                canvas.paste(crop, ((side - cw) // 2, (side - ch) // 2))
                canvas.thumbnail((720, 720))
                image_counter += 1
                fname = f"import_{secrets.token_hex(4)}_{image_counter:03d}.jpg"
                jbuf = io.BytesIO()
                canvas.save(jbuf, "JPEG", quality=85)
                jbytes = jbuf.getvalue()
                # Persist to object storage (with local fallback)
                try:
                    put_object(build_storage_path(fname), jbytes, "image/jpeg")
                except Exception:
                    pass
                (IMAGES_DIR / fname).write_bytes(jbytes)
                prod["image"] = fname
            except Exception:
                prod["image"] = None
            extracted.append(prod)

    pdoc.close()
    try:
        os.unlink(tmp.name)
    except Exception:
        pass

    return {"count": len(extracted), "products": extracted}


@api.post("/import/pdf/commit")
async def import_pdf_commit(payload: PDFImportCommit, _user=Depends(get_current_user)):
    """Persist reviewed/edited products to the catalog under the given vendor."""
    vendor = await db.vendors.find_one({"_id": ObjectId(payload.vendor_id)})
    if not vendor:
        raise HTTPException(400, "Invalid vendor")
    vendor_id = str(vendor["_id"])
    prefix = (payload.code_prefix or vendor.get("code_prefix") or "").strip()
    custom_rule = None
    if payload.use_custom_rule:
        custom_rule = {
            "threshold": payload.threshold,
            "below_increment": payload.below_increment,
            "at_or_above_increment": payload.at_or_above_increment,
        }

    inserted = 0
    skipped = 0
    docs = []
    for p in payload.products:
        code = (p.get("code") or "").strip()
        if not code:
            continue
        # Apply prefix if vendor demands replacement (e.g., "OC " replaces leading letters)
        if prefix:
            # Replace any leading letters with the new prefix
            new_code = re.sub(r"^[A-Z]{1,4}\s*", prefix + " ", code).strip()
        else:
            new_code = code
        # Skip duplicates
        existing = await db.products.find_one({"code": new_code})
        if existing:
            skipped += 1
            continue
        sg_price = int(p.get("sg_price") or 0)
        # Apply custom rule if requested
        override_price = None
        if custom_rule and sg_price > 0:
            override_price = compute_oncost_price(sg_price, custom_rule)
        docs.append({
            "code": new_code,
            "set_type": p.get("set_type", ""),
            "items": p.get("items", ""),
            "sg_price": sg_price,
            "moq": int(p.get("moq") or 50),
            "image": p.get("image"),
            "override_price": override_price,
            "visible": True,
            "vendor_id": vendor_id,
            "vendor_code": code,
            "created_at": iso(now_utc()),
        })
    if docs:
        try:
            await db.products.insert_many(docs)
            inserted = len(docs)
        except Exception as e:
            raise HTTPException(400, f"Insert failed: {e}")
    return {"inserted": inserted, "skipped": skipped, "vendor": {"id": vendor_id, "name": vendor["name"]}}


class AcceptQuotationIn(BaseModel):
    note: str = ""
    approved_budget: Optional[float] = None


# ---------- Quotation Acceptance → Sales ----------
@api.post("/quotations/{qid}/accept")
async def admin_accept_quotation(qid: str, payload: AcceptQuotationIn, _user=Depends(get_current_user)):
    q = await db.quotations.find_one({"_id": ObjectId(qid)})
    if not q:
        raise HTTPException(404, "Not found")
    if q.get("status") == "accepted":
        raise HTTPException(400, "Already accepted")
    if not (payload.note or "").strip():
        raise HTTPException(400, "Acceptance note is required")
    sale_doc = {
        "quotation_id": q.get("quotation_id"),
        "quotation_ref": str(q["_id"]),
        "customer_name": q.get("customer_name"),
        "customer_email": q.get("customer_email"),
        "customer_company": q.get("customer_company"),
        "place": q.get("place"),
        "items": q.get("items", []),
        "subtotal": q.get("subtotal", 0),
        "shipping_charges": q.get("shipping_charges", 0),
        "gst_amount": q.get("gst_amount", 0),
        "gst_percent": q.get("gst_percent", 0),
        "total": q.get("total", 0),
        "partner_user_id": q.get("partner_user_id"),
        "accepted_at": iso(now_utc()),
        "accepted_by": "admin",
        "note": payload.note.strip(),
        "approved_budget": payload.approved_budget,
    }
    sres = await db.sales.insert_one(sale_doc)
    sale_id = str(sres.inserted_id)
    # Fire commission calc (best-effort). Returns None if no rule matches.
    commission = None
    try:
        commission = await commissions_create_for_sale(db, sale_id=sale_id, sale_doc=sale_doc)
    except Exception as _e:
        logger.exception("Commission calc failed for sale %s", sale_id)
    await db.quotations.update_one(
        {"_id": ObjectId(qid)},
        {"$set": {
            "status": "accepted",
            "active": False,
            "accepted_at": iso(now_utc()),
            "acceptance_note": payload.note.strip(),
            "approved_budget": payload.approved_budget,
        }},
    )
    sale_doc["id"] = str(sres.inserted_id)
    sale_doc.pop("_id", None)
    sale_doc["commission"] = commission
    return sale_doc


@api.get("/sales")
async def list_sales(_user=Depends(get_current_user)):
    cur = db.sales.find({}).sort("accepted_at", -1)
    out = []
    for s in await cur.to_list(length=500):
        s["id"] = str(s.pop("_id"))
        out.append(s)
    return out


@api.get("/sales/{sid}")
async def get_sale(sid: str, _user=Depends(get_current_user)):
    s = await db.sales.find_one({"_id": ObjectId(sid)})
    if not s:
        raise HTTPException(404, "Not found")
    s["id"] = str(s.pop("_id"))
    return s


# ---------- Images (public) — object storage first, local fallback ----------
@api.get("/images/{filename}")
async def get_image(filename: str):
    # basic safety
    if "/" in filename or ".." in filename:
        raise HTTPException(400, "bad name")
    # 1) Try persistent object storage
    data, ctype = get_object(build_storage_path(filename))
    if data:
        return Response(content=data, media_type=ctype or "image/jpeg",
                        headers={"Cache-Control": "public, max-age=86400"})
    # 2) Fallback to local disk (bundled supplier images)
    fp = IMAGES_DIR / filename
    if not fp.exists():
        raise HTTPException(404, "not found")
    return FileResponse(str(fp), media_type="image/jpeg",
                        headers={"Cache-Control": "public, max-age=86400"})


# ---------- Startup: seed admin + products + indexes ----------
@app.on_event("startup")
async def startup():
    # Initialize persistent object storage (Emergent)
    init_storage()

    # Indexes
    await db.users.create_index("email", unique=True)
    await db.quotations.create_index("share_token", unique=True)
    await db.products.create_index("code", unique=True)
    await db.categories.create_index("name", unique=True)
    await db.password_resets.create_index("token", unique=True)
    # TTL index: Mongo deletes the doc automatically once expires_at passes.
    await db.password_resets.create_index("expires_at", expireAfterSeconds=0)

    # Seed admin
    existing = await db.users.find_one({"email": ADMIN_EMAIL})
    if not existing:
        await db.users.insert_one({
            "email": ADMIN_EMAIL,
            "password_hash": hash_password(ADMIN_PASSWORD),
            "name": "ONCOST Admin",
            "role": "admin",
            "created_at": iso(now_utc()),
        })
        logger.info(f"Admin user seeded: {ADMIN_EMAIL}")
    elif not verify_password(ADMIN_PASSWORD, existing["password_hash"]):
        await db.users.update_one(
            {"email": ADMIN_EMAIL},
            {"$set": {"password_hash": hash_password(ADMIN_PASSWORD)}},
        )
        logger.info("Admin password updated from env")
    # Backfill role for any legacy admin user missing it
    await db.users.update_many({"role": {"$exists": False}}, {"$set": {"role": "admin"}})

    # OPMS indexes
    await opms_ensure_indexes(db)
    await commissions_ensure_indexes(db)

    # Seed pricing rule
    if not await db.pricing_rule.find_one({"_id": "default"}):
        await db.pricing_rule.insert_one({
            "_id": "default",
            "threshold": 1000,
            "below_increment": 50,
            "at_or_above_increment": 100,
            "rounding": 1,
        })

    # Seed / upsert products from products.json — add new codes without disturbing existing ones
    if PRODUCTS_JSON.exists():
        items = json.loads(PRODUCTS_JSON.read_text())
        
        # Fetch existing codes in one query
        existing_docs = await db.products.find({}, {"code": 1}).to_list(length=None)
        existing_codes = {doc["code"] for doc in existing_docs}
        
        docs_to_insert = []
        for it in items:
            if it["code"] not in existing_codes:
                docs_to_insert.append({
                    "code": it["code"],
                    "set_type": it.get("set_type", ""),
                    "items": it.get("items", ""),
                    "sg_price": int(it.get("sg_price", 0)),
                    "moq": int(it.get("moq", 50)),
                    "image": it.get("image"),
                    "override_price": None,
                    "visible": True,
                    "created_at": iso(now_utc()),
                })
        
        if docs_to_insert:
            await db.products.insert_many(docs_to_insert)
            logger.info(f"Seeded {len(docs_to_insert)} new products from products.json")


@app.on_event("shutdown")
async def shutdown():
    client.close()


app.include_router(api)

# ---------- OPMS module ----------
from opms import build_opms_router, ensure_indexes as opms_ensure_indexes  # noqa: E402
_opms_router = build_opms_router(
    db=db,
    get_current_user=get_current_user,
    hash_password=hash_password,
    create_access_token=create_access_token,
    put_object=put_object,
    build_storage_path=build_storage_path,
    get_object=get_object,
    images_dir=IMAGES_DIR,
)
app.include_router(_opms_router, prefix="/api")

# ---------- Resend webhook receiver ----------
from resend_webhook import build_webhook_router  # noqa: E402
app.include_router(build_webhook_router(db), prefix="/api")

# ---------- Commission engine ----------
from commissions import (  # noqa: E402
    build_commissions_router,
    create_commission_for_sale as commissions_create_for_sale,
    ensure_indexes as commissions_ensure_indexes,
)
app.include_router(
    build_commissions_router(db=db, get_current_user=get_current_user),
    prefix="/api",
)


@app.get("/")
async def root():
    return {"app": "ONCOST Catalog API", "ok": True}
