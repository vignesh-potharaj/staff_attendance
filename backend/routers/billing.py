import json
from datetime import datetime
from typing import Any

from fastapi import APIRouter, Depends, Header, HTTPException, Request
from sqlalchemy.orm import Session

from backend.auth.dependencies import get_current_admin
from backend.database.database import get_db
from backend.models.models import BillingPayment, IST, Tenant, User
from backend.services.razorpay_billing import (
    create_subscription,
    get_public_config,
    unix_to_naive_ist,
    verify_webhook_signature,
)

router = APIRouter(prefix="/billing", tags=["Billing"])


SUBSCRIPTION_STATUS_MAP = {
    "created": "PENDING",
    "authenticated": "PENDING",
    "active": "ACTIVE",
    "pending": "PENDING",
    "halted": "PAST_DUE",
    "paused": "PAUSED",
    "cancelled": "CANCELLED",
    "completed": "COMPLETED",
    "expired": "EXPIRED",
}


def _latest_payment_status(db: Session, tenant_id: int) -> str | None:
    latest = (
        db.query(BillingPayment)
        .filter(BillingPayment.tenant_id == tenant_id)
        .order_by(BillingPayment.created_at.desc(), BillingPayment.id.desc())
        .first()
    )
    return latest.status if latest else None


def _billing_status_payload(db: Session, tenant: Tenant, message: str | None = None, short_url: str | None = None) -> dict[str, Any]:
    public_config = get_public_config()
    current_end = tenant.subscription_current_end
    payment_required = str(tenant.subscription_status or "PENDING").upper() not in {"ACTIVE", "TRIALING"}
    if current_end and current_end < datetime.now(IST).replace(tzinfo=None):
        payment_required = True

    payload: dict[str, Any] = {
        "subscription_status": str(tenant.subscription_status or "PENDING").upper(),
        "plan_name": tenant.subscription_plan_name or "Smart Attend Monthly",
        "amount_paise": tenant.subscription_amount_paise or 30000,
        "amount_rupees": round((tenant.subscription_amount_paise or 30000) / 100, 2),
        "currency": tenant.subscription_currency or "INR",
        "current_period_start": tenant.subscription_current_start.isoformat() if tenant.subscription_current_start else None,
        "current_period_end": current_end.isoformat() if current_end else None,
        "razorpay_key_id": public_config["key_id"],
        "razorpay_plan_id": public_config["plan_id"],
        "razorpay_subscription_id": tenant.razorpay_subscription_id,
        "payment_required": payment_required,
        "latest_payment_status": _latest_payment_status(db, tenant.id),
    }
    if message is not None:
        payload["message"] = message
    if short_url is not None:
        payload["subscription_short_url"] = short_url
    return payload


def _subscription_entity(payload: dict[str, Any]) -> dict[str, Any] | None:
    entity = payload.get("payload", {}).get("subscription", {}).get("entity")
    return entity if isinstance(entity, dict) else None


def _payment_entity(payload: dict[str, Any]) -> dict[str, Any] | None:
    entity = payload.get("payload", {}).get("payment", {}).get("entity")
    return entity if isinstance(entity, dict) else None


def _invoice_entity(payload: dict[str, Any]) -> dict[str, Any] | None:
    entity = payload.get("payload", {}).get("invoice", {}).get("entity")
    return entity if isinstance(entity, dict) else None


def _find_tenant_for_event(db: Session, payload: dict[str, Any]) -> Tenant | None:
    subscription = _subscription_entity(payload) or {}
    notes = subscription.get("notes") if isinstance(subscription.get("notes"), dict) else {}
    tenant_id = notes.get("tenant_id")
    if tenant_id:
        try:
            tenant = db.query(Tenant).filter(Tenant.id == int(tenant_id)).first()
            if tenant:
                return tenant
        except (TypeError, ValueError):
            pass

    subscription_id = subscription.get("id")
    if not subscription_id:
        payment = _payment_entity(payload) or {}
        invoice = _invoice_entity(payload) or {}
        subscription_id = payment.get("subscription_id") or invoice.get("subscription_id")
    if subscription_id:
        return db.query(Tenant).filter(Tenant.razorpay_subscription_id == subscription_id).first()
    return None


def _apply_subscription_state(tenant: Tenant, subscription: dict[str, Any]) -> None:
    remote_status = str(subscription.get("status") or "").lower()
    tenant.subscription_status = SUBSCRIPTION_STATUS_MAP.get(remote_status, remote_status.upper() or "PENDING")
    tenant.razorpay_subscription_id = subscription.get("id") or tenant.razorpay_subscription_id
    tenant.razorpay_customer_id = subscription.get("customer_id") or tenant.razorpay_customer_id
    tenant.subscription_current_start = unix_to_naive_ist(subscription.get("current_start")) or tenant.subscription_current_start
    tenant.subscription_current_end = unix_to_naive_ist(subscription.get("current_end")) or tenant.subscription_current_end
    tenant.billing_last_event_at = datetime.now(IST).replace(tzinfo=None)


def _upsert_payment_record(db: Session, tenant: Tenant, payload: dict[str, Any]) -> None:
    payment = _payment_entity(payload) or {}
    invoice = _invoice_entity(payload) or {}
    subscription = _subscription_entity(payload) or {}
    event_id = payload.get("id")
    payment_id = payment.get("id")

    query = db.query(BillingPayment).filter(BillingPayment.tenant_id == tenant.id)
    existing = None
    if payment_id:
        existing = query.filter(BillingPayment.razorpay_payment_id == payment_id).first()
    if not existing and event_id:
        existing = query.filter(BillingPayment.razorpay_event_id == event_id).first()

    record = existing or BillingPayment(tenant_id=tenant.id, status="RECEIVED")
    record.razorpay_event_id = event_id or record.razorpay_event_id
    record.razorpay_payment_id = payment_id or record.razorpay_payment_id
    record.razorpay_invoice_id = invoice.get("id") or record.razorpay_invoice_id
    record.razorpay_subscription_id = (
        subscription.get("id")
        or payment.get("subscription_id")
        or invoice.get("subscription_id")
        or record.razorpay_subscription_id
    )
    record.amount_paise = int(payment.get("amount") or invoice.get("amount_paid") or invoice.get("amount_due") or 0)
    record.currency = payment.get("currency") or invoice.get("currency") or tenant.subscription_currency or "INR"
    record.status = str(payment.get("status") or invoice.get("status") or payload.get("event") or "RECEIVED").upper()
    record.paid_at = unix_to_naive_ist(payment.get("created_at") or invoice.get("paid_at")) or record.paid_at
    record.failure_reason = payment.get("error_description") or payment.get("error_reason") or record.failure_reason
    record.raw_event = json.dumps(payload)
    if not existing:
        db.add(record)


@router.get("/status")
def get_billing_status(
    current_admin: User = Depends(get_current_admin),
    db: Session = Depends(get_db),
):
    tenant = current_admin.tenant
    if not tenant:
        raise HTTPException(status_code=404, detail="Workspace not found")
    return _billing_status_payload(db, tenant)


@router.post("/create-subscription")
def create_workspace_subscription(
    current_admin: User = Depends(get_current_admin),
    db: Session = Depends(get_db),
):
    tenant = current_admin.tenant
    if not tenant:
        raise HTTPException(status_code=404, detail="Workspace not found")

    if str(tenant.subscription_status or "").upper() == "ACTIVE":
        return _billing_status_payload(db, tenant, message="Your subscription is already active.")

    subscription = create_subscription(
        tenant_id=tenant.id,
        business_name=tenant.name,
        admin_name=current_admin.name or "",
        admin_email=current_admin.email,
        admin_phone=current_admin.phone,
    )
    _apply_subscription_state(tenant, subscription)
    db.commit()
    db.refresh(tenant)

    return _billing_status_payload(
        db,
        tenant,
        message="Subscription created. Complete the Razorpay authorisation to activate billing.",
        short_url=subscription.get("short_url"),
    )


@router.post("/webhook")
async def razorpay_webhook(
    request: Request,
    db: Session = Depends(get_db),
    x_razorpay_signature: str | None = Header(default=None),
):
    raw_body = await request.body()
    if not verify_webhook_signature(raw_body, x_razorpay_signature):
        raise HTTPException(status_code=400, detail="Invalid Razorpay webhook signature")

    try:
        payload = json.loads(raw_body.decode("utf-8"))
    except json.JSONDecodeError:
        raise HTTPException(status_code=400, detail="Invalid webhook JSON")

    tenant = _find_tenant_for_event(db, payload)
    if not tenant:
        return {"status": "ignored"}

    subscription = _subscription_entity(payload)
    if subscription:
        _apply_subscription_state(tenant, subscription)

    if _payment_entity(payload) or _invoice_entity(payload):
        _upsert_payment_record(db, tenant, payload)
        event_name = str(payload.get("event") or "")
        if event_name in {"payment.captured", "invoice.paid", "subscription.charged"}:
            tenant.subscription_status = "ACTIVE"
        elif event_name in {"payment.failed", "invoice.payment_failed"} and str(tenant.subscription_status or "").upper() != "ACTIVE":
            tenant.subscription_status = "PAST_DUE"
        tenant.billing_last_event_at = datetime.now(IST).replace(tzinfo=None)

    db.commit()
    return {"status": "ok"}

