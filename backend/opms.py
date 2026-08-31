"""ONCOST Partner Management System (OPMS) — MVP module.
Adds:
- Partner registration (public)
- Partner document uploads (photo, resume, PAN, Aadhaar)
- Admin list / detail / approve / reject / suspend
- Auto-generated Employee ID, Partner Code, Referral Code, joining date
- Login by email OR Employee ID (see login patch in server.py)
- Partner-only endpoints: /me, /dashboard
- Digital ID card PDF download
Intentionally does NOT wire email/SMS yet — approve endpoint returns the temp
password once so the admin can share manually until Resend/SendGrid is added.
"""
from __future__ import annotations
import io
import re
import secrets as _sec
from datetime import date, datetime, timedelta, timezone
from typing import List, Optional

from bson import ObjectId
from fastapi import APIRouter, Depends, File, HTTPException, Request, UploadFile
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, ConfigDict, EmailStr

from emailer import (
    is_enabled as email_enabled,
    render_lead_assigned_email,
    render_referral_lead_admin_email,
    render_referral_lead_email,
    render_welcome_email,
    send_email,
)


# ------------------------------------------------------------------ ROLES
ROLES = [
    "super_admin",
    "admin",
    "sales_manager",
    "sales_executive",
    "sales_partner",
    "procurement_partner",
    "franchise_partner",
    "viewer",
]
ROLE_LABEL = {
    "super_admin": "Super Admin",
    "admin": "Admin",
    "sales_manager": "Sales Manager",
    "sales_executive": "Sales Executive",
    "sales_partner": "Sales Partner",
    "procurement_partner": "Procurement Partner",
    "franchise_partner": "Franchise Partner",
    "viewer": "Viewer",
}
ROLE_PREFIX = {
    "super_admin": "SA",
    "admin": "AD",
    "sales_manager": "SM",
    "sales_executive": "SE",
    "sales_partner": "SP",
    "procurement_partner": "PP",
    "franchise_partner": "FP",
    "viewer": "VR",
}
ADMIN_ROLES = {"super_admin", "admin"}


# ------------------------------------------------------------------ MODELS
class PartnerRegisterIn(BaseModel):
    model_config = ConfigDict(extra="ignore")
    # Personal
    full_name: str
    gender: str = ""
    dob: str = ""           # ISO YYYY-MM-DD
    aadhaar: str = ""
    pan: str = ""
    photo: Optional[str] = None
    # Contact
    mobile: str
    alt_mobile: str = ""
    email: EmailStr
    address: str = ""
    city: str = ""
    state: str = ""
    pincode: str = ""
    # Professional
    role: str                 # requested role
    department: str = ""
    territory: str = ""
    working_area: str = ""
    languages: List[str] = []
    previous_experience: str = ""
    linkedin: str = ""
    resume: Optional[str] = None
    pan_doc: Optional[str] = None
    aadhaar_doc: Optional[str] = None
    # Bank
    account_holder: str = ""
    account_number: str = ""
    ifsc: str = ""
    bank_name: str = ""
    upi_id: str = ""
    # Emergency
    emergency_name: str = ""
    emergency_phone: str = ""
    emergency_relation: str = ""


class PartnerDecisionIn(BaseModel):
    reason: str = ""


# ------------------------------------------------------------------ LEAD MODELS
LEAD_STATUSES = ["new", "contacted", "quotation_sent", "negotiation", "won", "lost"]
LEAD_SOURCES = ["LinkedIn", "Apollo", "Referral", "Website", "Walk-in", "Cold Call", "Event", "Other"]


class LeadIn(BaseModel):
    model_config = ConfigDict(extra="ignore")
    name: str
    company: str = ""
    industry: str = ""
    contact_person: str = ""
    designation: str = ""
    phone: str = ""
    email: str = ""
    source: str = "Other"
    status: str = "new"
    notes: str = ""
    estimated_value: float = 0
    assigned_to: Optional[str] = None   # user_id (of the partner login user), NOT partner_id


class LeadPatch(BaseModel):
    model_config = ConfigDict(extra="ignore")
    name: Optional[str] = None
    company: Optional[str] = None
    industry: Optional[str] = None
    contact_person: Optional[str] = None
    designation: Optional[str] = None
    phone: Optional[str] = None
    email: Optional[str] = None
    source: Optional[str] = None
    status: Optional[str] = None
    notes: Optional[str] = None
    estimated_value: Optional[float] = None
    assigned_to: Optional[str] = None
    lost_reason: Optional[str] = None


class ReferralLeadIn(BaseModel):
    model_config = ConfigDict(extra="ignore")
    name: str
    company: str = ""
    email: str = ""
    phone: str = ""
    requirement: str = ""


# ------------------------------------------------------------------ HELPERS
def _now():
    return datetime.now(timezone.utc)


def _iso(dt: datetime) -> str:
    return dt.isoformat()


async def _next_seq(db, key: str, start: int = 1) -> int:
    doc = await db.opms_counters.find_one_and_update(
        {"_id": key},
        {"$inc": {"seq": 1}},
        upsert=True,
        return_document=True,
    )
    if not doc:
        doc = {"_id": key, "seq": start}
        await db.opms_counters.insert_one(doc)
    return int(doc.get("seq", start))


def _mask(val: str, keep: int = 4) -> str:
    if not val:
        return ""
    v = str(val)
    if len(v) <= keep:
        return "*" * len(v)
    return "*" * (len(v) - keep) + v[-keep:]


def _serialize_partner(p: dict, redact_sensitive: bool = False) -> dict:
    if not p:
        return p
    out = dict(p)
    out["id"] = str(out.pop("_id"))
    if redact_sensitive:
        # Never send full Aadhaar/PAN/account numbers to non-admin viewers.
        if out.get("aadhaar"):
            out["aadhaar"] = _mask(out["aadhaar"])
        if out.get("pan"):
            out["pan"] = _mask(out["pan"])
        if out.get("account_number"):
            out["account_number"] = _mask(out["account_number"], 4)
    return out


async def _current_admin(request: Request):
    """Wrapped in a lambda inside the router — see build_opms_router."""
    raise NotImplementedError


async def _upload_partner_file(storage_put, storage_path_builder, images_dir,
                               partner_id: str, kind: str, upload: UploadFile) -> str:
    """Persist an uploaded partner document. Returns the filename."""
    if kind not in {"photo", "resume", "pan_doc", "aadhaar_doc"}:
        raise HTTPException(400, "Invalid document kind")
    raw = await upload.read()
    if not raw:
        raise HTTPException(400, "Empty file")
    if len(raw) > 8 * 1024 * 1024:
        raise HTTPException(400, "File too large (max 8MB)")
    ct = (upload.content_type or "").lower()
    if kind == "resume":
        allowed = {"application/pdf", "application/msword",
                   "application/vnd.openxmlformats-officedocument.wordprocessingml.document"}
        ext = "pdf" if ct == "application/pdf" else ("docx" if "wordprocessingml" in ct else "doc")
    else:
        allowed = {"image/jpeg", "image/jpg", "image/png", "image/webp"}
        ext = "jpg"
    if ct not in allowed:
        raise HTTPException(400, f"Unsupported file type for {kind}")
    fname = f"partner_{partner_id}_{kind}_{_sec.token_hex(4)}.{ext}"
    # Try object storage first; also drop a local disk copy for dev fallback.
    try:
        storage_put(storage_path_builder(fname), raw, ct)
    except Exception:
        pass
    try:
        (images_dir / fname).write_bytes(raw)
    except Exception:
        pass
    return fname


# ------------------------------------------------------------------ ID CARD PDF
def _build_id_card_pdf(partner: dict, image_bytes: Optional[bytes]) -> bytes:
    """Business-card sized (85.6 × 54 mm) PDF ID card."""
    import qrcode
    from reportlab.lib import colors
    from reportlab.lib.pagesizes import landscape
    from reportlab.lib.units import mm
    from reportlab.pdfgen import canvas as rl_canvas
    from reportlab.lib.utils import ImageReader

    W, H = 85.6 * mm, 54 * mm
    buf = io.BytesIO()
    c = rl_canvas.Canvas(buf, pagesize=landscape((W, H)))
    # Landscape swap: reportlab treats first tuple element as width
    c.setPageSize((W, H))

    NAVY = colors.HexColor("#0F172A")
    GOLD = colors.HexColor("#B8860B")
    INK = colors.HexColor("#111827")
    MUTED = colors.HexColor("#6B7280")

    # Border + header band
    c.setFillColor(NAVY)
    c.rect(0, H - 12 * mm, W, 12 * mm, fill=1, stroke=0)
    c.setFillColor(GOLD)
    c.rect(0, H - 13 * mm, W, 1 * mm, fill=1, stroke=0)

    # Wordmark
    c.setFillColor(colors.white)
    try:
        c.setFont("Helvetica-Bold", 16)
    except Exception:
        c.setFont("Helvetica-Bold", 16)
    c.drawString(6 * mm, H - 8.5 * mm, "ONCOST")
    c.setFont("Helvetica", 6)
    c.drawString(6 * mm, H - 11 * mm, "Corporate Gifting  ·  Brassware")

    # Photo box (left)
    photo_x, photo_y, photo_w, photo_h = 6 * mm, 8 * mm, 20 * mm, 24 * mm
    c.setStrokeColor(GOLD)
    c.setLineWidth(0.6)
    c.rect(photo_x, photo_y, photo_w, photo_h, fill=0, stroke=1)
    if image_bytes:
        try:
            c.drawImage(ImageReader(io.BytesIO(image_bytes)),
                        photo_x + 0.4 * mm, photo_y + 0.4 * mm,
                        width=photo_w - 0.8 * mm, height=photo_h - 0.8 * mm,
                        preserveAspectRatio=True, anchor="c", mask="auto")
        except Exception:
            pass
    else:
        c.setFillColor(MUTED)
        c.setFont("Helvetica", 6)
        c.drawCentredString(photo_x + photo_w / 2, photo_y + photo_h / 2, "PHOTO")

    # Text block (middle)
    tx = photo_x + photo_w + 4 * mm
    c.setFillColor(INK)
    c.setFont("Helvetica-Bold", 10)
    c.drawString(tx, H - 18 * mm, (partner.get("full_name") or "")[:30].upper())
    c.setFont("Helvetica", 6.5)
    c.setFillColor(MUTED)
    c.drawString(tx, H - 21 * mm, ROLE_LABEL.get(partner.get("role"), partner.get("role", "")))

    c.setFillColor(INK)
    c.setFont("Helvetica-Bold", 6.5)
    c.drawString(tx, H - 25.5 * mm, "EMP ID")
    c.drawString(tx, H - 30 * mm, "CODE")
    c.drawString(tx, H - 34.5 * mm, "JOINED")

    c.setFont("Helvetica", 7.5)
    c.drawString(tx + 12 * mm, H - 25.5 * mm, partner.get("employee_id", "-"))
    c.drawString(tx + 12 * mm, H - 30 * mm, partner.get("partner_code", "-"))
    joined = partner.get("joining_date", "")
    if joined:
        try:
            joined = joined.split("T")[0]
        except Exception:
            pass
    c.drawString(tx + 12 * mm, H - 34.5 * mm, joined or "-")

    # Emergency contact (compact)
    c.setFillColor(MUTED)
    c.setFont("Helvetica", 5.5)
    ec = partner.get("emergency_name") or ""
    ep = partner.get("emergency_phone") or ""
    if ec or ep:
        c.drawString(tx, H - 39.5 * mm, f"Emergency: {ec} · {ep}"[:60])

    # Validity
    validity = partner.get("card_valid_until") or ""
    if validity:
        try:
            validity = validity.split("T")[0]
        except Exception:
            pass
    c.setFillColor(GOLD)
    c.setFont("Helvetica-Bold", 5.5)
    c.drawString(tx, H - 43 * mm, f"VALID UNTIL  {validity or '—'}")

    # QR (right)
    qr_size = 20 * mm
    qr_x = W - qr_size - 5 * mm
    qr_y = 8 * mm
    qr_payload = "|".join([
        "ONCOST-EMP",
        partner.get("employee_id", ""),
        partner.get("partner_code", ""),
        (partner.get("mobile") or ""),
    ])
    qr_img = qrcode.make(qr_payload)
    qbuf = io.BytesIO()
    qr_img.save(qbuf, format="PNG")
    c.drawImage(ImageReader(io.BytesIO(qbuf.getvalue())), qr_x, qr_y, qr_size, qr_size)

    # Footer band
    c.setFillColor(NAVY)
    c.rect(0, 0, W, 4 * mm, fill=1, stroke=0)
    c.setFillColor(colors.white)
    c.setFont("Helvetica", 5)
    c.drawString(3 * mm, 1.5 * mm, "www.oncostcatalog.in  ·  If found, please return to PRAGNA ENTERPRISES")

    c.showPage()
    c.save()
    return buf.getvalue()


# ------------------------------------------------------------------ ROUTER
def build_opms_router(
    db,
    get_current_user,          # server.py's admin auth dependency
    hash_password,
    create_access_token,
    put_object,                # storage.py
    build_storage_path,
    get_object,
    images_dir,
) -> APIRouter:
    r = APIRouter()

    # ---------- helpers scoped to db ----------
    async def _admin_only(user=Depends(get_current_user)):
        if user.get("role") not in ADMIN_ROLES:
            raise HTTPException(403, "Admin access required")
        return user

    async def _partner_from_request(request: Request) -> dict:
        """Auth dep that allows ANY approved user (partner or admin). Reuses JWT
        set in the `access_token` cookie / Bearer header."""
        # Delegate to server's get_current_user; then load partner if applicable.
        user = await get_current_user(request)
        return user

    def _gen_ids(seq: int, role: str) -> dict:
        emp_id = f"ONCOST-EMP-{seq:04d}"
        partner_code = f"OC{ROLE_PREFIX.get(role, 'PT')}{seq:04d}"
        ref_code = f"ONCOST{seq % 100:02d}"
        return {"employee_id": emp_id, "partner_code": partner_code, "referral_code": ref_code}

    # ================== PUBLIC REGISTRATION ==================
    @r.post("/partners/register")
    async def register(payload: PartnerRegisterIn):
        if payload.role not in ROLES:
            raise HTTPException(400, "Invalid role")
        if payload.role in ADMIN_ROLES:
            raise HTTPException(400, "Admin roles cannot self-register")
        email = payload.email.lower().strip()
        if await db.partners.find_one({"email": email, "status": {"$in": ["pending", "approved"]}}):
            raise HTTPException(400, "A partner with this email is already registered")
        if await db.users.find_one({"email": email}):
            raise HTTPException(400, "This email is already in use")
        if not re.fullmatch(r"[0-9+\-\s()]{7,20}", payload.mobile):
            raise HTTPException(400, "Invalid mobile number")
        doc = payload.model_dump()
        doc.update({
            "email": email,
            "status": "pending",
            "employee_id": None,
            "partner_code": None,
            "referral_code": None,
            "joining_date": None,
            "created_at": _iso(_now()),
        })
        res = await db.partners.insert_one(doc)
        return {"id": str(res.inserted_id), "status": "pending"}

    # ================== PARTNER DOC UPLOAD (public, before or during registration) ==================
    @r.post("/partners/upload")
    async def upload_partner_doc(kind: str, file: UploadFile = File(...)):
        # A temp "unassigned" partner id — used only to name the file until registration ties it.
        if kind not in {"photo", "resume", "pan_doc", "aadhaar_doc"}:
            raise HTTPException(400, "Invalid document kind")
        tmp_id = _sec.token_hex(4)
        fname = await _upload_partner_file(put_object, build_storage_path, images_dir,
                                            tmp_id, kind, file)
        return {"filename": fname}

    # ================== ADMIN LIST / DETAIL ==================
    @r.get("/partners/lookup")
    async def lookup_partner(code: str = "", _user=Depends(_admin_only)):
        """Look up a partner by employee_id, partner_code or referral_code."""
        code = (code or "").strip()
        if not code:
            raise HTTPException(400, "code required")
        p = await db.partners.find_one({"$or": [
            {"employee_id": code}, {"partner_code": code}, {"referral_code": code},
        ]})
        if not p:
            raise HTTPException(404, "No partner found for that code")
        u = await db.users.find_one({"email": p.get("email")})
        return {
            "partner_id": str(p["_id"]),
            "user_id": str(u["_id"]) if u else None,
            "full_name": p.get("full_name"),
            "employee_id": p.get("employee_id"),
            "partner_code": p.get("partner_code"),
            "referral_code": p.get("referral_code"),
            "role": p.get("role"),
            "email": p.get("email"),
            "status": p.get("status"),
        }

    @r.get("/partners")
    async def list_partners(status: Optional[str] = None, role: Optional[str] = None,
                            _user=Depends(_admin_only)):
        q: dict = {}
        if status:
            q["status"] = status
        if role:
            q["role"] = role
        cur = db.partners.find(q).sort("created_at", -1)
        out = []
        for p in await cur.to_list(length=1000):
            out.append(_serialize_partner(p))
        return out

    @r.get("/partners/{pid}")
    async def get_partner(pid: str, _user=Depends(_admin_only)):
        p = await db.partners.find_one({"_id": ObjectId(pid)})
        if not p:
            raise HTTPException(404, "Not found")
        return _serialize_partner(p)

    # ================== APPROVE / REJECT / SUSPEND ==================
    @r.post("/partners/{pid}/approve")
    async def approve(pid: str, _user=Depends(_admin_only)):
        p = await db.partners.find_one({"_id": ObjectId(pid)})
        if not p:
            raise HTTPException(404, "Not found")
        if p.get("status") == "approved":
            raise HTTPException(400, "Already approved")
        # Assign IDs
        seq = await _next_seq(db, "employee")
        role = p.get("role", "sales_partner")
        gen = _gen_ids(seq, role)
        # Guarantee ref-code uniqueness by extending with a hex suffix if collision.
        if await db.partners.find_one({"referral_code": gen["referral_code"]}):
            gen["referral_code"] = f"{gen['referral_code']}{_sec.token_hex(1).upper()}"
        joined = _now()
        valid_until = joined + timedelta(days=365)
        # Create login user
        temp_pw = _sec.token_urlsafe(9)
        user_doc = {
            "email": p["email"],
            "employee_id": gen["employee_id"],
            "password_hash": hash_password(temp_pw),
            "role": role,
            "partner_id": str(p["_id"]),
            "name": p.get("full_name", ""),
            "must_change_password": True,
            "created_at": _iso(joined),
        }
        await db.users.insert_one(user_doc)
        # Update partner
        update = {
            "status": "approved",
            **gen,
            "joining_date": _iso(joined),
            "card_valid_until": _iso(valid_until),
            "approved_at": _iso(joined),
            "approved_by": _user.get("email"),
        }
        await db.partners.update_one({"_id": ObjectId(pid)}, {"$set": update})
        # Fire welcome email (best-effort; will silently no-op if Resend not configured)
        try:
            html = render_welcome_email(
                name=p.get("full_name", ""),
                employee_id=gen["employee_id"],
                partner_code=gen["partner_code"],
                referral_code=gen["referral_code"],
                login_email=p["email"],
                temp_password=temp_pw,
                role_label=ROLE_LABEL.get(role, role),
            )
            email_res = await send_email(p["email"], "Welcome to ONCOST — Your Partner ID is ready", html)
        except Exception as e:
            email_res = {"ok": False, "reason": str(e)}
        return {**gen, "temp_password": temp_pw, "email": p["email"], "role": role,
                "joining_date": update["joining_date"], "email_status": email_res}

    @r.post("/partners/{pid}/reject")
    async def reject(pid: str, payload: PartnerDecisionIn, _user=Depends(_admin_only)):
        res = await db.partners.update_one(
            {"_id": ObjectId(pid)},
            {"$set": {"status": "rejected", "status_reason": payload.reason,
                      "rejected_at": _iso(_now())}},
        )
        if res.matched_count == 0:
            raise HTTPException(404, "Not found")
        return {"ok": True}

    @r.post("/partners/{pid}/suspend")
    async def suspend(pid: str, payload: PartnerDecisionIn, _user=Depends(_admin_only)):
        p = await db.partners.find_one({"_id": ObjectId(pid)})
        if not p:
            raise HTTPException(404, "Not found")
        new_status = "approved" if p.get("status") == "suspended" else "suspended"
        await db.partners.update_one(
            {"_id": ObjectId(pid)},
            {"$set": {"status": new_status, "status_reason": payload.reason,
                      "suspended_at": _iso(_now()) if new_status == "suspended" else None}},
        )
        return {"status": new_status}

    # ================== ID CARD PDF ==================
    @r.get("/partners/{pid}/id-card.pdf")
    async def id_card(pid: str, _user=Depends(_admin_only)):
        p = await db.partners.find_one({"_id": ObjectId(pid)})
        if not p:
            raise HTTPException(404, "Not found")
        if p.get("status") != "approved":
            raise HTTPException(400, "ID card is only available for approved partners")
        image_bytes = None
        photo = p.get("photo")
        if photo:
            try:
                image_bytes = get_object(build_storage_path(photo))
            except Exception:
                try:
                    image_bytes = (images_dir / photo).read_bytes()
                except Exception:
                    image_bytes = None
        pdf = _build_id_card_pdf(_serialize_partner(p), image_bytes)
        return StreamingResponse(
            io.BytesIO(pdf),
            media_type="application/pdf",
            headers={"Content-Disposition": f'attachment; filename="ONCOST-IDCARD-{p.get("employee_id", "PARTNER")}.pdf"'},
        )

    # ================== PARTNER: /me + /dashboard ==================
    @r.get("/partner/me")
    async def partner_me(request: Request):
        user = await get_current_user(request)
        role = user.get("role", "")
        pid = user.get("partner_id")
        out = {"user": user, "partner": None}
        if pid:
            p = await db.partners.find_one({"_id": ObjectId(pid)})
            if p:
                out["partner"] = _serialize_partner(p, redact_sensitive=False)
        out["role_label"] = ROLE_LABEL.get(role, role)
        return out

    @r.patch("/partner/me")
    async def update_partner_me(payload: dict, request: Request):
        """Partner self-updates their own KYC + bank fields. Cannot change role/status/IDs."""
        user = await get_current_user(request)
        pid = user.get("partner_id")
        if not pid:
            raise HTTPException(403, "Only partner accounts can use this endpoint")
        allowed = {
            "full_name", "gender", "dob", "aadhaar", "pan", "photo",
            "mobile", "alt_mobile", "address", "city", "state", "pincode",
            "linkedin", "languages", "previous_experience",
            "account_holder", "account_number", "ifsc", "bank_name", "upi_id",
            "emergency_name", "emergency_phone", "emergency_relation",
        }
        upd = {k: v for k, v in (payload or {}).items() if k in allowed and v is not None}
        # If bank details are being updated, mark bank_verified = False again until re-approved.
        if any(k in upd for k in ("account_holder", "account_number", "ifsc", "bank_name", "upi_id")):
            upd["bank_verified"] = False
            upd["bank_verified_at"] = None
            upd["bank_verified_by"] = None
        if not upd:
            raise HTTPException(400, "No editable fields provided")
        upd["updated_at"] = _iso(_now())
        await db.partners.update_one({"_id": ObjectId(pid)}, {"$set": upd})
        p = await db.partners.find_one({"_id": ObjectId(pid)})
        return _serialize_partner(p, redact_sensitive=False)

    @r.post("/partners/{pid}/verify-bank")
    async def verify_bank(pid: str, _user=Depends(_admin_only)):
        """Admin marks a partner's bank details as verified. Required before payouts."""
        res = await db.partners.update_one(
            {"_id": ObjectId(pid)},
            {"$set": {"bank_verified": True, "bank_verified_at": _iso(_now()),
                      "bank_verified_by": _user.get("email")}},
        )
        if res.matched_count == 0:
            raise HTTPException(404, "Not found")
        return {"ok": True}

    @r.post("/partners/{pid}/reset-link")
    async def admin_generate_reset_link(pid: str, _user=Depends(_admin_only)):
        """Admin action: generate a password reset link for the partner without
        relying on outbound email. Returns the full URL for the admin to share
        manually (WhatsApp / SMS / Signal etc)."""
        import os as _os, secrets as _s
        from emailer import portal_url

        p = await db.partners.find_one({"_id": ObjectId(pid)})
        if not p:
            raise HTTPException(404, "Partner not found")
        email = p.get("email")
        if not email:
            raise HTTPException(400, "Partner has no login email on file")
        user = await db.users.find_one({"email": email})
        if not user:
            raise HTTPException(400, "Partner has not been approved yet — no login account exists")

        # Invalidate any existing unused tokens for this user
        await db.password_resets.update_many(
            {"user_id": user["_id"], "used_at": None},
            {"$set": {"used_at": _now(), "invalidated": True}},
        )
        # Match the TTL used by the public forgot-password flow: 24 hours.
        token = _s.token_urlsafe(32)
        expires = _now() + timedelta(hours=24)
        await db.password_resets.insert_one({
            "user_id": user["_id"],
            "email": email,
            "token": token,
            "created_at": _now(),
            "expires_at": expires,
            "used_at": None,
            "issued_by_admin": _user.get("email"),
        })
        return {
            "ok": True,
            "email": email,
            "reset_link": portal_url(f"/reset-password?token={token}"),
            "expires_at": _iso(expires),
        }

    @r.post("/admin/reset-link-lookup")
    async def admin_reset_link_lookup(payload: dict, _user=Depends(_admin_only)):
        """Admin utility: generate a reset link by pasting the partner's email
        OR Employee ID. Optionally also emails the link if `send_email=true`."""
        import os as _os, secrets as _s
        from emailer import portal_url, is_enabled as email_enabled, send_email as _send, render_password_reset_email

        ident = (payload.get("identifier") or "").strip()
        also_email = bool(payload.get("send_email"))
        if not ident:
            raise HTTPException(400, "identifier is required")

        if ident.upper().startswith("ONCOST-EMP-"):
            user = await db.users.find_one({"employee_id": ident.upper()})
        elif "@" in ident:
            user = await db.users.find_one({"email": ident.lower()})
        else:
            # try both partner_code and referral_code lookup
            p = await db.partners.find_one({
                "$or": [
                    {"partner_code": ident.upper()},
                    {"referral_code": ident.upper()},
                    {"employee_id": ident.upper()},
                ],
            })
            user = None
            if p and p.get("email"):
                user = await db.users.find_one({"email": p["email"]})

        if not user:
            raise HTTPException(404, "No account found for that email / Employee ID")

        # Invalidate prior unused tokens
        await db.password_resets.update_many(
            {"user_id": user["_id"], "used_at": None},
            {"$set": {"used_at": _now(), "invalidated": True}},
        )
        token = _s.token_urlsafe(32)
        expires = _now() + timedelta(hours=24)
        await db.password_resets.insert_one({
            "user_id": user["_id"],
            "email": user.get("email"),
            "token": token,
            "created_at": _now(),
            "expires_at": expires,
            "used_at": None,
            "issued_by_admin": _user.get("email"),
        })
        link = portal_url(f"/reset-password?token={token}")

        emailed = False
        email_error = None
        if also_email and email_enabled() and user.get("email"):
            try:
                name = user.get("name") or user.get("email")
                result = await _send(
                    user["email"],
                    "Reset your ONCOST password",
                    render_password_reset_email(name=name, reset_link=link, expires_hours=24),
                )
                if result and result.get("ok"):
                    emailed = True
                else:
                    email_error = (result or {}).get("reason") or "Unknown Resend error"
            except Exception as e:
                email_error = str(e)

        return {
            "ok": True,
            "email": user.get("email"),
            "employee_id": user.get("employee_id"),
            "reset_link": link,
            "expires_at": _iso(expires),
            "emailed": emailed,
            "email_error": email_error,
        }

    @r.get("/partner/dashboard")
    async def partner_dashboard(request: Request):
        user = await get_current_user(request)
        pid = user.get("partner_id")
        # Real lead counts (Sales/commission still stubbed until those modules exist)
        my_id = user.get("id")
        total_leads = await db.leads.count_documents({"assigned_to": my_id})
        closed_leads = await db.leads.count_documents({"assigned_to": my_id, "status": "won"})
        active_leads = await db.leads.count_documents({"assigned_to": my_id, "status": {"$nin": ["won", "lost"]}})
        # Real commission numbers
        pending_cur = db.commissions.find({"partner_user_id": my_id, "status": "pending"})
        paid_cur = db.commissions.find({"partner_user_id": my_id, "status": "paid"})
        pending = await pending_cur.to_list(length=5000)
        paid = await paid_cur.to_list(length=5000)
        commission_pending = round(sum(float(c.get("commission_amount") or 0) for c in pending), 2)
        commission_earned = round(sum(float(c.get("commission_amount") or 0) for c in paid), 2)
        # This-month / this-year sales attributed to me
        from datetime import datetime as _dt
        now = _dt.utcnow()
        month_start = _dt(now.year, now.month, 1).isoformat()
        year_start = _dt(now.year, 1, 1).isoformat()
        sales_cur = db.sales.find({"partner_user_id": my_id})
        sales_all = await sales_cur.to_list(length=5000)
        sales_month = round(sum(float(s.get("total") or 0) for s in sales_all if (s.get("accepted_at") or "") >= month_start), 2)
        sales_year = round(sum(float(s.get("total") or 0) for s in sales_all if (s.get("accepted_at") or "") >= year_start), 2)
        return {
            "totals": {
                "total_leads": total_leads,
                "assigned_leads": active_leads,
                "closed_leads": closed_leads,
                "sales_month": sales_month,
                "sales_year": sales_year,
                "commission_earned": commission_earned,
                "commission_pending": commission_pending,
                "monthly_target": 0,
            },
            "leaderboard_rank": None,
            "upcoming_followups": [],
            "notifications": [
                {"kind": "welcome", "title": "Welcome to ONCOST", "body": "Your partner portal is ready."}
            ],
            "partner_id": pid,
        }

    # ============================ LEADS ============================
    def _serialize_lead(l: dict) -> dict:
        out = dict(l)
        out["id"] = str(out.pop("_id"))
        return out

    async def _lead_or_404(lid: str) -> dict:
        l = await db.leads.find_one({"_id": ObjectId(lid)})
        if not l:
            raise HTTPException(404, "Lead not found")
        return l

    def _validate_lead_fields(payload: dict):
        st = payload.get("status")
        if st and st not in LEAD_STATUSES:
            raise HTTPException(400, f"Invalid status. One of: {LEAD_STATUSES}")
        src = payload.get("source")
        if src and src not in LEAD_SOURCES:
            # Accept custom sources as free text but nudge convention
            pass

    async def _fetch_assignee(user_id: Optional[str]) -> Optional[dict]:
        if not user_id:
            return None
        try:
            return await db.users.find_one({"_id": ObjectId(user_id)})
        except Exception:
            return None

    async def _hydrate_lead(l: dict) -> dict:
        out = _serialize_lead(l)
        assignee = await _fetch_assignee(out.get("assigned_to"))
        if assignee:
            out["assigned_to_name"] = assignee.get("name") or assignee.get("email")
            out["assigned_to_employee_id"] = assignee.get("employee_id")
        return out

    @r.post("/leads")
    async def create_lead(payload: LeadIn, _user=Depends(_admin_only)):
        body = payload.model_dump()
        _validate_lead_fields(body)
        body["created_at"] = _iso(_now())
        body["created_by"] = _user.get("email")
        body["assigned_at"] = _iso(_now()) if body.get("assigned_to") else None
        res = await db.leads.insert_one(body)
        lid = str(res.inserted_id)
        # Fire assignment email if creating with an assignee.
        if body.get("assigned_to"):
            assignee = await _fetch_assignee(body["assigned_to"])
            if assignee and assignee.get("email"):
                html = render_lead_assigned_email(name=assignee.get("name", ""), lead={**body, "id": lid})
                await send_email(assignee["email"], f"New lead assigned: {body.get('name', '')}", html)
        return await _hydrate_lead(await db.leads.find_one({"_id": ObjectId(lid)}))

    @r.get("/leads")
    async def list_leads(status: Optional[str] = None,
                         source: Optional[str] = None,
                         mine: bool = False,
                         request: Request = None):
        user = await get_current_user(request)
        role = user.get("role", "")
        q: dict = {}
        if status:
            q["status"] = status
        if source:
            q["source"] = source
        # Partner: only their own leads. Admin: all leads.
        if role not in ADMIN_ROLES:
            q["assigned_to"] = user["id"]
        elif mine:
            q["assigned_to"] = user["id"]
        cur = db.leads.find(q).sort("created_at", -1)
        out = []
        for l in await cur.to_list(length=2000):
            out.append(await _hydrate_lead(l))
        return out

    @r.get("/leads/{lid}")
    async def get_lead(lid: str, request: Request):
        user = await get_current_user(request)
        l = await _lead_or_404(lid)
        role = user.get("role", "")
        if role not in ADMIN_ROLES and l.get("assigned_to") != user["id"]:
            raise HTTPException(403, "You don't have access to this lead")
        return await _hydrate_lead(l)

    @r.patch("/leads/{lid}")
    async def patch_lead(lid: str, payload: LeadPatch, request: Request):
        user = await get_current_user(request)
        l = await _lead_or_404(lid)
        role = user.get("role", "")
        is_admin = role in ADMIN_ROLES
        update = {k: v for k, v in payload.model_dump(exclude_unset=True).items() if v is not None or k == "assigned_to"}
        _validate_lead_fields(update)
        # Non-admin partners: can only update status / notes / lost_reason / contact edits on THEIR lead.
        if not is_admin:
            if l.get("assigned_to") != user["id"]:
                raise HTTPException(403, "You don't have access to this lead")
            allowed = {"status", "notes", "phone", "email", "contact_person", "designation", "lost_reason", "estimated_value"}
            update = {k: v for k, v in update.items() if k in allowed}
        # Track close time
        prev_status = l.get("status")
        new_status = update.get("status", prev_status)
        if new_status in ("won", "lost") and prev_status not in ("won", "lost"):
            update["closed_at"] = _iso(_now())
        # If admin re-assigns, notify the new assignee
        notify_new_assignee = False
        if is_admin and "assigned_to" in update and update["assigned_to"] != l.get("assigned_to"):
            update["assigned_at"] = _iso(_now()) if update["assigned_to"] else None
            notify_new_assignee = bool(update.get("assigned_to"))
        update["updated_at"] = _iso(_now())
        await db.leads.update_one({"_id": ObjectId(lid)}, {"$set": update})
        doc = await db.leads.find_one({"_id": ObjectId(lid)})
        if notify_new_assignee:
            assignee = await _fetch_assignee(update["assigned_to"])
            if assignee and assignee.get("email"):
                html = render_lead_assigned_email(name=assignee.get("name", ""), lead=_serialize_lead(doc))
                await send_email(assignee["email"], f"New lead assigned: {doc.get('name', '')}", html)
        return await _hydrate_lead(doc)

    @r.post("/leads/{lid}/assign")
    async def assign_lead(lid: str, payload: dict, _user=Depends(_admin_only)):
        assignee_id = (payload or {}).get("user_id")
        if not assignee_id:
            raise HTTPException(400, "user_id required")
        assignee = await _fetch_assignee(assignee_id)
        if not assignee:
            raise HTTPException(404, "Assignee (partner user) not found")
        await db.leads.update_one(
            {"_id": ObjectId(lid)},
            {"$set": {"assigned_to": assignee_id, "assigned_at": _iso(_now()), "updated_at": _iso(_now())}},
        )
        doc = await db.leads.find_one({"_id": ObjectId(lid)})
        html = render_lead_assigned_email(name=assignee.get("name", ""), lead=_serialize_lead(doc))
        email_res = await send_email(assignee["email"], f"New lead assigned: {doc.get('name', '')}", html)
        return {"ok": True, "email": email_res}

    @r.delete("/leads/{lid}")
    async def delete_lead(lid: str, _user=Depends(_admin_only)):
        res = await db.leads.delete_one({"_id": ObjectId(lid)})
        if res.deleted_count == 0:
            raise HTTPException(404, "Lead not found")
        return {"ok": True}

    @r.get("/leads-assignees")
    async def list_assignees(_user=Depends(_admin_only)):
        """List approved partner users who can be assigned leads."""
        cur = db.users.find(
            {"role": {"$in": ["sales_partner", "sales_executive", "sales_manager",
                              "franchise_partner", "procurement_partner"]}}
        )
        out = []
        for u in await cur.to_list(length=1000):
            out.append({
                "id": str(u["_id"]),
                "name": u.get("name") or u.get("email"),
                "email": u.get("email"),
                "employee_id": u.get("employee_id"),
                "role": u.get("role"),
            })
        return out

    # ================== PUBLIC REFERRAL LINKS ==================
    async def _partner_by_ref(code: str) -> Optional[dict]:
        code = (code or "").strip().upper()
        if not code:
            return None
        return await db.partners.find_one({"referral_code": code, "status": "approved"})

    @r.get("/refer/{code}")
    async def public_referral_info(code: str):
        """Lightweight metadata for the /refer/<code> landing page.
        Reveals only the partner's first name + role — never full contact info."""
        p = await _partner_by_ref(code)
        if not p:
            raise HTTPException(404, "This referral link is not active")
        full_name = p.get("full_name", "") or ""
        first = (full_name.split(" ")[0] or "Partner")
        return {
            "valid": True,
            "referral_code": p.get("referral_code"),
            "partner_first_name": first,
            "role_label": ROLE_LABEL.get(p.get("role") or "", "Partner"),
        }

    @r.post("/refer/{code}/lead")
    async def public_referral_lead(code: str, payload: ReferralLeadIn):
        p = await _partner_by_ref(code)
        if not p:
            raise HTTPException(404, "This referral link is not active")
        # Locate the partner's login user so the lead is auto-assigned to them.
        u = await db.users.find_one({"email": p.get("email")}) if p.get("email") else None
        assigned_to = str(u["_id"]) if u else None

        name = (payload.name or "").strip()
        if not name:
            raise HTTPException(400, "Name is required")

        lead_doc = {
            "name": name,
            "company": (payload.company or "").strip(),
            "industry": "",
            "contact_person": name,
            "designation": "",
            "phone": (payload.phone or "").strip(),
            "email": (payload.email or "").strip().lower(),
            "source": "Referral",
            "status": "new",
            "notes": (payload.requirement or "").strip(),
            "estimated_value": 0,
            "assigned_to": assigned_to,
            "referral_code": p.get("referral_code"),
            "referred_by_partner_id": str(p["_id"]),
            "created_at": _iso(_now()),
            "created_by": f"referral:{p.get('referral_code')}",
            "assigned_at": _iso(_now()) if assigned_to else None,
        }
        res = await db.leads.insert_one(lead_doc)
        lid = str(res.inserted_id)

        # Notify partner (if they have a login) and admin
        partner_name = p.get("full_name") or ""
        partner_email = p.get("email")
        if partner_email and email_enabled():
            try:
                await send_email(
                    partner_email,
                    f"New referral lead: {name}",
                    render_referral_lead_email(
                        partner_name=partner_name,
                        lead={**lead_doc, "id": lid},
                        referral_code=p.get("referral_code") or "",
                    ),
                )
            except Exception:
                pass

        # Admin notify — use ADMIN_EMAIL env
        import os
        admin_to = os.environ.get("ADMIN_EMAIL") or os.environ.get("COMPANY_EMAIL")
        if admin_to and email_enabled():
            try:
                await send_email(
                    admin_to,
                    f"[Referral] New lead from {partner_name or p.get('referral_code')}",
                    render_referral_lead_admin_email(
                        partner_name=partner_name or "—",
                        partner_employee_id=p.get("employee_id") or "—",
                        referral_code=p.get("referral_code") or "",
                        lead={**lead_doc, "id": lid},
                    ),
                )
            except Exception:
                pass

        return {"ok": True, "lead_id": lid, "assigned": bool(assigned_to)}

    return r


# ------------------------------------------------------------------ STARTUP HOOK
async def ensure_indexes(db):
    """Called from server.py startup. Idempotent."""
    await db.partners.create_index("email")
    await db.partners.create_index("employee_id")
    await db.partners.create_index("partner_code")
    await db.partners.create_index("referral_code", unique=True, sparse=True)
    await db.users.create_index("employee_id", sparse=True)
    await db.leads.create_index("assigned_to")
    await db.leads.create_index("status")
    await db.leads.create_index([("created_at", -1)])
