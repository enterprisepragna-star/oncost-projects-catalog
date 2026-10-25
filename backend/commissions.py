"""OPMS Commission Engine.
- Admin-editable Commission Rules (no code changes needed to modify percentages).
- Auto-calculates a commission record on Quotation → Sale acceptance if a partner
  is attributed to the quote.
- Payment tracker: mark commission as paid with UTR / reference / remarks.
- Partner view: read-only ledger of their own commissions.
- Payout gate: per-sale >= threshold (default 1 lakh), cumulative pending must
  also cross threshold before payout is eligible.
- Discretionary Incentives (no threshold gate, admin-decided).
"""
from __future__ import annotations
import os
from datetime import datetime, timezone
from typing import List, Optional

from bson import ObjectId
from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel, ConfigDict


ADMIN_ROLES = {"super_admin", "admin"}
PAYOUT_THRESHOLD = float(os.environ.get("PAYOUT_THRESHOLD", "100000") or 100000)


def _now() -> datetime:
    return datetime.now(timezone.utc)


def _iso(dt: datetime) -> str:
    return dt.isoformat()


DEFAULT_RULES = [
    {"name": "Corporate Gifts",   "commission_percent": 5, "priority": 10, "min_order_value": PAYOUT_THRESHOLD, "active": True},
    {"name": "Brass Products",    "commission_percent": 8, "priority": 10, "min_order_value": PAYOUT_THRESHOLD, "active": True},
    {"name": "Customized Products","commission_percent": 6, "priority": 10, "min_order_value": PAYOUT_THRESHOLD, "active": True},
    {"name": "Institution Orders","commission_percent": 4, "priority": 10, "min_order_value": PAYOUT_THRESHOLD, "active": True},
    {"name": "Referral Orders",   "commission_percent": 3, "priority": 5,  "min_order_value": PAYOUT_THRESHOLD, "active": True},
]


# ------------------------------------------------------------------ MODELS
class CommissionRuleIn(BaseModel):
    model_config = ConfigDict(extra="ignore")
    name: str
    applies_to_role: Optional[str] = None           # None = any role
    applies_to_category_id: Optional[str] = None    # None = any category
    partner_user_id: Optional[str] = None           # None = any partner (or a specific one)
    min_order_value: float = 0
    max_order_value: Optional[float] = None
    commission_percent: float                        # 0-100
    priority: int = 0                                # higher wins on tie
    active: bool = True


class CommissionRulePatch(BaseModel):
    model_config = ConfigDict(extra="ignore")
    name: Optional[str] = None
    applies_to_role: Optional[str] = None
    applies_to_category_id: Optional[str] = None
    partner_user_id: Optional[str] = None
    min_order_value: Optional[float] = None
    max_order_value: Optional[float] = None
    commission_percent: Optional[float] = None
    priority: Optional[int] = None
    active: Optional[bool] = None


class CommissionPayIn(BaseModel):
    model_config = ConfigDict(extra="ignore")
    payment_reference: str = ""
    utr_number: str = ""
    remarks: str = ""


class IncentiveIn(BaseModel):
    model_config = ConfigDict(extra="ignore")
    partner_user_id: str
    amount: float
    reason: str = ""
    contract_ref: str = ""    # e.g. multi-year contract identifier


class IncentivePayIn(BaseModel):
    model_config = ConfigDict(extra="ignore")
    payment_reference: str = ""
    utr_number: str = ""
    remarks: str = ""



# ------------------------------------------------------------------ SERIALIZERS
def _serialize(doc: dict) -> dict:
    if not doc:
        return doc
    d = dict(doc)
    d["id"] = str(d.pop("_id"))
    return d


# ------------------------------------------------------------------ MATCHING
async def _partner_role(db, user_id: str) -> Optional[str]:
    if not user_id:
        return None
    try:
        u = await db.users.find_one({"_id": ObjectId(user_id)})
    except Exception:
        return None
    return u.get("role") if u else None


async def _sale_category_ids(db, sale_doc: dict) -> List[str]:
    """Return the distinct category_ids of products in this sale."""
    pids = [i.get("product_id") for i in sale_doc.get("items", []) if i.get("product_id")]
    if not pids:
        return []
    try:
        obj_ids = [ObjectId(p) for p in pids]
    except Exception:
        return []
    cur = db.products.find({"_id": {"$in": obj_ids}}, {"category_id": 1})
    return list({p.get("category_id") for p in await cur.to_list(length=1000) if p.get("category_id")})


async def find_matching_rule(db, *, order_amount: float, partner_user_id: str,
                             category_ids: List[str]) -> Optional[dict]:
    """Return the highest-priority active rule whose constraints all match; None if none match."""
    partner_role = await _partner_role(db, partner_user_id)
    cur = db.commission_rules.find({"active": True}).sort([("priority", -1)])
    for rule in await cur.to_list(length=500):
        if rule.get("applies_to_role") and rule["applies_to_role"] != partner_role:
            continue
        if rule.get("partner_user_id") and rule["partner_user_id"] != partner_user_id:
            continue
        if rule.get("applies_to_category_id"):
            if rule["applies_to_category_id"] not in (category_ids or []):
                continue
        mn = float(rule.get("min_order_value") or 0)
        mx = rule.get("max_order_value")
        if order_amount < mn:
            continue
        if mx is not None and order_amount > float(mx):
            continue
        return rule
    return None


async def create_commission_for_sale(db, *, sale_id: str, sale_doc: dict) -> Optional[dict]:
    """Called from server.py after a sale is created. Returns the commission doc or None."""
    partner_user_id = sale_doc.get("partner_user_id")
    if not partner_user_id:
        return None
    order_amount = float(sale_doc.get("total") or 0)
    # Per-sale threshold gate (Option C part 1): sale must clear the payout threshold.
    if order_amount < PAYOUT_THRESHOLD:
        return None
    category_ids = await _sale_category_ids(db, sale_doc)
    rule = await find_matching_rule(
        db,
        order_amount=order_amount,
        partner_user_id=partner_user_id,
        category_ids=category_ids,
    )
    if not rule:
        return None
    pct = float(rule.get("commission_percent") or 0)
    amount = round(order_amount * pct / 100.0, 2)
    partner = await db.users.find_one({"_id": ObjectId(partner_user_id)})
    doc = {
        "sale_id": sale_id,
        "quotation_id": sale_doc.get("quotation_id"),
        "customer_name": sale_doc.get("customer_name"),
        "customer_company": sale_doc.get("customer_company"),
        "partner_user_id": partner_user_id,
        "partner_name": (partner or {}).get("name") or (partner or {}).get("email"),
        "partner_employee_id": (partner or {}).get("employee_id"),
        "partner_role": (partner or {}).get("role"),
        "rule_id": str(rule["_id"]),
        "rule_name": rule.get("name"),
        "order_amount": order_amount,
        "commission_percent": pct,
        "commission_amount": amount,
        "status": "pending",
        "created_at": _iso(_now()),
        "paid_at": None,
        "payment_reference": None,
        "utr_number": None,
        "remarks": None,
    }
    res = await db.commissions.insert_one(doc)
    doc["id"] = str(res.inserted_id)
    doc.pop("_id", None)
    return doc


# ------------------------------------------------------------------ ROUTER
def build_commissions_router(db, get_current_user) -> APIRouter:
    r = APIRouter()

    async def _admin_only(user=Depends(get_current_user)):
        if user.get("role") not in ADMIN_ROLES:
            raise HTTPException(403, "Admin access required")
        return user

    # ============= RULES =============
    @r.post("/commission-rules")
    async def create_rule(payload: CommissionRuleIn, _user=Depends(_admin_only)):
        doc = payload.model_dump()
        doc["name"] = (doc.get("name") or "").strip() or "Untitled rule"
        if doc["commission_percent"] < 0 or doc["commission_percent"] > 100:
            raise HTTPException(400, "commission_percent must be 0-100")
        doc["created_at"] = _iso(_now())
        res = await db.commission_rules.insert_one(doc)
        doc["id"] = str(res.inserted_id)
        doc.pop("_id", None)
        return doc

    @r.get("/commission-rules")
    async def list_rules(_user=Depends(_admin_only)):
        cur = db.commission_rules.find({}).sort([("priority", -1), ("created_at", -1)])
        return [_serialize(x) for x in await cur.to_list(length=500)]

    @r.put("/commission-rules/{rid}")
    async def update_rule(rid: str, payload: CommissionRulePatch, _user=Depends(_admin_only)):
        update = payload.model_dump(exclude_unset=True)
        if not update:
            raise HTTPException(400, "No fields to update")
        if "commission_percent" in update and (update["commission_percent"] < 0 or update["commission_percent"] > 100):
            raise HTTPException(400, "commission_percent must be 0-100")
        res = await db.commission_rules.update_one({"_id": ObjectId(rid)}, {"$set": update})
        if res.matched_count == 0:
            raise HTTPException(404, "Rule not found")
        doc = await db.commission_rules.find_one({"_id": ObjectId(rid)})
        return _serialize(doc)

    @r.delete("/commission-rules/{rid}")
    async def delete_rule(rid: str, _user=Depends(_admin_only)):
        res = await db.commission_rules.delete_one({"_id": ObjectId(rid)})
        if res.deleted_count == 0:
            raise HTTPException(404, "Rule not found")
        return {"ok": True}

    # ============= COMMISSIONS =============
    @r.get("/commissions")
    async def list_commissions(status: Optional[str] = None, request: Request = None):
        user = await get_current_user(request)
        q: dict = {}
        if status:
            q["status"] = status
        if user.get("role") not in ADMIN_ROLES:
            q["partner_user_id"] = user.get("id")
        cur = db.commissions.find(q).sort([("created_at", -1)])
        items = [_serialize(x) for x in await cur.to_list(length=2000)]
        # Per-partner pending totals for eligibility flag (Option C part 2)
        pending_cur = db.commissions.find({"status": "pending"})
        pending_by_partner: dict = {}
        for c in await pending_cur.to_list(length=5000):
            pid = c.get("partner_user_id")
            pending_by_partner[pid] = pending_by_partner.get(pid, 0.0) + float(c.get("commission_amount") or 0)
        for it in items:
            total = pending_by_partner.get(it.get("partner_user_id"), 0.0)
            it["partner_pending_total"] = round(total, 2)
            it["eligible_for_payout"] = it["status"] == "paid" or total >= PAYOUT_THRESHOLD
            it["payout_threshold"] = PAYOUT_THRESHOLD
        return items

    @r.get("/commissions/summary")
    async def summary(request: Request = None):
        user = await get_current_user(request)
        base: dict = {}
        if user.get("role") not in ADMIN_ROLES:
            base["partner_user_id"] = user.get("id")
        pending_cur = db.commissions.find({**base, "status": "pending"})
        paid_cur = db.commissions.find({**base, "status": "paid"})
        pending = await pending_cur.to_list(length=5000)
        paid = await paid_cur.to_list(length=5000)
        return {
            "pending_count": len(pending),
            "pending_amount": round(sum(float(x.get("commission_amount") or 0) for x in pending), 2),
            "paid_count": len(paid),
            "paid_amount": round(sum(float(x.get("commission_amount") or 0) for x in paid), 2),
            "total_amount": round(sum(float(x.get("commission_amount") or 0) for x in pending + paid), 2),
        }

    @r.get("/commissions/{cid}")
    async def get_commission(cid: str, request: Request):
        user = await get_current_user(request)
        c = await db.commissions.find_one({"_id": ObjectId(cid)})
        if not c:
            raise HTTPException(404, "Commission not found")
        if user.get("role") not in ADMIN_ROLES and c.get("partner_user_id") != user.get("id"):
            raise HTTPException(403, "Forbidden")
        return _serialize(c)

    @r.post("/commissions/{cid}/pay")
    async def mark_paid(cid: str, payload: CommissionPayIn, _user=Depends(_admin_only)):
        c = await db.commissions.find_one({"_id": ObjectId(cid)})
        if not c:
            raise HTTPException(404, "Commission not found")
        if c.get("status") == "paid":
            raise HTTPException(400, "Already paid")
        # Cumulative gate: partner's total pending must clear threshold.
        pending_cur = db.commissions.find({"partner_user_id": c.get("partner_user_id"), "status": "pending"})
        total_pending = sum(float(x.get("commission_amount") or 0) for x in await pending_cur.to_list(length=5000))
        if total_pending < PAYOUT_THRESHOLD:
            raise HTTPException(400, f"Payout blocked: partner has ₹{total_pending:,.0f} pending, below ₹{PAYOUT_THRESHOLD:,.0f} threshold")
        upd = {
            "status": "paid",
            "paid_at": _iso(_now()),
            "payment_reference": (payload.payment_reference or "").strip(),
            "utr_number": (payload.utr_number or "").strip(),
            "remarks": (payload.remarks or "").strip(),
            "paid_by": _user.get("email"),
        }
        await db.commissions.update_one({"_id": ObjectId(cid)}, {"$set": upd})
        return _serialize(await db.commissions.find_one({"_id": ObjectId(cid)}))

    @r.post("/commissions/{cid}/revert")
    async def revert_payment(cid: str, _user=Depends(_admin_only)):
        """Undo a payment mark (in case of wrong UTR entry)."""
        res = await db.commissions.update_one(
            {"_id": ObjectId(cid), "status": "paid"},
            {"$set": {"status": "pending", "paid_at": None, "payment_reference": None,
                      "utr_number": None, "remarks": None, "paid_by": None}},
        )
        if res.matched_count == 0:
            raise HTTPException(404, "Paid commission not found")
        return {"ok": True}

    # ============= INCENTIVES (discretionary — no threshold gate) =============
    @r.post("/incentives")
    async def create_incentive(payload: IncentiveIn, _user=Depends(_admin_only)):
        if payload.amount <= 0:
            raise HTTPException(400, "Amount must be > 0")
        partner_user = await db.users.find_one({"_id": ObjectId(payload.partner_user_id)})
        if not partner_user:
            raise HTTPException(404, "Partner user not found")
        p = await db.partners.find_one({"email": partner_user.get("email")})
        doc = {
            "partner_user_id": payload.partner_user_id,
            "partner_name": partner_user.get("name") or partner_user.get("email"),
            "partner_employee_id": partner_user.get("employee_id"),
            "partner_code": (p or {}).get("partner_code"),
            "amount": float(payload.amount),
            "reason": payload.reason.strip(),
            "contract_ref": payload.contract_ref.strip(),
            "status": "pending",
            "created_at": _iso(_now()),
            "created_by": _user.get("email"),
            "paid_at": None,
            "payment_reference": None,
            "utr_number": None,
            "remarks": None,
        }
        res = await db.incentives.insert_one(doc)
        return _serialize(await db.incentives.find_one({"_id": res.inserted_id}))

    @r.get("/incentives")
    async def list_incentives(status: Optional[str] = None, request: Request = None):
        user = await get_current_user(request)
        q: dict = {}
        if status:
            q["status"] = status
        if user.get("role") not in ADMIN_ROLES:
            q["partner_user_id"] = user.get("id")
        cur = db.incentives.find(q).sort([("created_at", -1)])
        return [_serialize(x) for x in await cur.to_list(length=1000)]

    @r.post("/incentives/{iid}/pay")
    async def pay_incentive(iid: str, payload: IncentivePayIn, _user=Depends(_admin_only)):
        inc = await db.incentives.find_one({"_id": ObjectId(iid)})
        if not inc:
            raise HTTPException(404, "Not found")
        if inc.get("status") == "paid":
            raise HTTPException(400, "Already paid")
        await db.incentives.update_one({"_id": ObjectId(iid)}, {"$set": {
            "status": "paid",
            "paid_at": _iso(_now()),
            "payment_reference": (payload.payment_reference or "").strip(),
            "utr_number": (payload.utr_number or "").strip(),
            "remarks": (payload.remarks or "").strip(),
            "paid_by": _user.get("email"),
        }})
        return _serialize(await db.incentives.find_one({"_id": ObjectId(iid)}))

    @r.delete("/incentives/{iid}")
    async def delete_incentive(iid: str, _user=Depends(_admin_only)):
        res = await db.incentives.delete_one({"_id": ObjectId(iid)})
        if res.deleted_count == 0:
            raise HTTPException(404, "Not found")
        return {"ok": True}

    return r


async def ensure_indexes(db):
    await db.commission_rules.create_index([("priority", -1)])
    await db.commissions.create_index("partner_user_id")
    await db.commissions.create_index("status")
    await db.commissions.create_index([("created_at", -1)])
    await db.incentives.create_index("partner_user_id")
    # Seed default rules on empty collection.
    if await db.commission_rules.count_documents({}) == 0:
        seeds = []
        for base in DEFAULT_RULES:
            seeds.append({**base, "applies_to_role": None, "applies_to_category_id": None,
                          "partner_user_id": None, "max_order_value": None,
                          "created_at": _iso(_now())})
        if seeds:
            await db.commission_rules.insert_many(seeds)
    await db.commission_rules.create_index([("priority", -1)])
    await db.commissions.create_index("partner_user_id")
    await db.commissions.create_index("status")
    await db.commissions.create_index([("created_at", -1)])
