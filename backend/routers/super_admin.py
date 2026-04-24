import json
import logging
from datetime import datetime, timedelta
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import func
from sqlalchemy.orm import Session

from backend.auth.super_admin import require_super_admin
from backend.database.database import get_db
from backend.models.models import BillingPayment, IST, RoleEnum, SuperAdminAuditLog, Tenant, User

router = APIRouter(dependencies=[Depends(require_super_admin)], tags=["Super Admin"])

logger = logging.getLogger(__name__)

SUCCESSFUL_PAYMENT_STATUSES = {"PAID", "CAPTURED", "SUCCESS"}
FAILED_PAYMENT_STATUSES = {"FAILED", "PAYMENT.FAILED", "INVOICE.PAYMENT_FAILED"}


class SubscriptionUpdateRequest(BaseModel):
    subscription_status: Optional[str] = None
    subscription_amount_paise: Optional[int] = None
    current_period_end: Optional[datetime] = None
    grace_period_end: Optional[datetime] = None
    notes: Optional[str] = None


class SuspendTenantRequest(BaseModel):
    reason: Optional[str] = None


def _normalize_datetime(value: Optional[datetime]) -> Optional[datetime]:
    if value is None:
        return None
    return value.replace(tzinfo=None) if value.tzinfo else value


def _owner_for_tenant(db: Session, tenant_id: int) -> User | None:
    return (
        db.query(User)
        .filter(User.tenant_id == tenant_id, User.role == RoleEnum.ADMIN)
        .order_by(User.created_at.asc(), User.id.asc())
        .first()
    )


def _last_successful_payment(db: Session, tenant_id: int) -> BillingPayment | None:
    return (
        db.query(BillingPayment)
        .filter(
            BillingPayment.tenant_id == tenant_id,
            BillingPayment.status.in_(SUCCESSFUL_PAYMENT_STATUSES),
        )
        .order_by(BillingPayment.paid_at.desc(), BillingPayment.created_at.desc(), BillingPayment.id.desc())
        .first()
    )


def _tenant_summary(db: Session, tenant: Tenant) -> dict:
    owner = _owner_for_tenant(db, tenant.id)
    total_payments_count = db.query(func.count(BillingPayment.id)).filter(BillingPayment.tenant_id == tenant.id).scalar() or 0
    last_payment = _last_successful_payment(db, tenant.id)
    return {
        "id": tenant.id,
        "name": tenant.name,
        "slug": tenant.slug,
        "owner_name": owner.name if owner else None,
        "email": owner.email if owner else None,
        "phone": owner.phone if owner else None,
        "subscription_status": tenant.subscription_status,
        "subscription_amount_paise": tenant.subscription_amount_paise,
        "current_period_end": tenant.subscription_current_end,
        "grace_period_end": tenant.grace_period_end,
        "created_at": tenant.created_at,
        "total_payments_count": int(total_payments_count),
        "last_payment_date": last_payment.paid_at if last_payment else None,
    }


def _tenant_or_404(db: Session, tenant_id: int) -> Tenant:
    tenant = db.query(Tenant).filter(Tenant.id == tenant_id).first()
    if not tenant:
        raise HTTPException(status_code=404, detail="Tenant not found")
    return tenant


def _write_audit_log(
    db: Session,
    *,
    action: str,
    tenant: Tenant | None,
    changed_fields: list[str],
    previous_values: dict,
    new_values: dict,
    notes: str | None = None,
) -> None:
    db.add(
        SuperAdminAuditLog(
            action=action,
            tenant_id=tenant.id if tenant else None,
            tenant_name=tenant.name if tenant else None,
            changed_fields=json.dumps(changed_fields),
            previous_values=json.dumps(previous_values, default=str),
            new_values=json.dumps(new_values, default=str),
            notes=notes,
            performed_at=datetime.now(IST).replace(tzinfo=None),
        )
    )


@router.get("/tenants")
def list_tenants(db: Session = Depends(get_db)):
    tenants = db.query(Tenant).order_by(Tenant.created_at.desc(), Tenant.id.desc()).all()
    return [_tenant_summary(db, tenant) for tenant in tenants]


@router.get("/tenants/{tenant_id}")
def get_tenant_detail(tenant_id: int, db: Session = Depends(get_db)):
    tenant = _tenant_or_404(db, tenant_id)
    owner = _owner_for_tenant(db, tenant.id)
    payments = (
        db.query(BillingPayment)
        .filter(BillingPayment.tenant_id == tenant.id)
        .order_by(BillingPayment.created_at.desc(), BillingPayment.id.desc())
        .all()
    )
    return {
        **_tenant_summary(db, tenant),
        "role": tenant.role,
        "status": tenant.status,
        "subscription_plan_name": tenant.subscription_plan_name,
        "subscription_currency": tenant.subscription_currency,
        "subscription_current_start": tenant.subscription_current_start,
        "razorpay_customer_id": tenant.razorpay_customer_id,
        "razorpay_subscription_id": tenant.razorpay_subscription_id,
        "billing_last_event_at": tenant.billing_last_event_at,
        "subscription_notes": tenant.subscription_notes,
        "suspension_reason": tenant.suspension_reason,
        "owner": {
            "name": owner.name if owner else None,
            "email": owner.email if owner else None,
            "phone": owner.phone if owner else None,
            "employee_id": owner.employee_id if owner else None,
        },
        "payments": [
            {
                "id": payment.id,
                "amount_paise": payment.amount_paise,
                "currency": payment.currency,
                "status": payment.status,
                "payment_method": payment.payment_method,
                "paid_at": payment.paid_at,
                "failure_reason": payment.failure_reason,
                "notes": payment.notes,
                "razorpay_payment_id": payment.razorpay_payment_id,
                "razorpay_invoice_id": payment.razorpay_invoice_id,
                "razorpay_subscription_id": payment.razorpay_subscription_id,
                "created_at": payment.created_at,
            }
            for payment in payments
        ],
    }


@router.patch("/tenants/{tenant_id}/subscription")
def update_tenant_subscription(tenant_id: int, payload: SubscriptionUpdateRequest, db: Session = Depends(get_db)):
    tenant = _tenant_or_404(db, tenant_id)
    changed_fields: list[str] = []
    previous_values: dict = {}
    new_values: dict = {}

    if payload.subscription_status is not None:
        allowed_statuses = {"active", "pending", "suspended", "cancelled"}
        normalized_status = payload.subscription_status.strip().lower()
        if normalized_status not in allowed_statuses:
            raise HTTPException(status_code=400, detail="Invalid subscription_status")
        changed_fields.append("subscription_status")
        previous_values["subscription_status"] = tenant.subscription_status
        tenant.subscription_status = normalized_status.upper()
        new_values["subscription_status"] = tenant.subscription_status

    if payload.subscription_amount_paise is not None:
        if payload.subscription_amount_paise < 0:
            raise HTTPException(status_code=400, detail="subscription_amount_paise must be non-negative")
        changed_fields.append("subscription_amount_paise")
        previous_values["subscription_amount_paise"] = tenant.subscription_amount_paise
        tenant.subscription_amount_paise = payload.subscription_amount_paise
        new_values["subscription_amount_paise"] = tenant.subscription_amount_paise

    if payload.current_period_end is not None:
        changed_fields.append("current_period_end")
        previous_values["current_period_end"] = tenant.subscription_current_end
        tenant.subscription_current_end = _normalize_datetime(payload.current_period_end)
        new_values["current_period_end"] = tenant.subscription_current_end

    if payload.grace_period_end is not None:
        changed_fields.append("grace_period_end")
        previous_values["grace_period_end"] = tenant.grace_period_end
        tenant.grace_period_end = _normalize_datetime(payload.grace_period_end)
        new_values["grace_period_end"] = tenant.grace_period_end

    if payload.notes is not None:
        changed_fields.append("notes")
        previous_values["notes"] = tenant.subscription_notes
        tenant.subscription_notes = payload.notes.strip() or None
        new_values["notes"] = tenant.subscription_notes

    _write_audit_log(
        db,
        action="update_subscription",
        tenant=tenant,
        changed_fields=changed_fields,
        previous_values=previous_values,
        new_values=new_values,
        notes=payload.notes,
    )

    db.commit()
    db.refresh(tenant)
    return get_tenant_detail(tenant_id, db)


@router.post("/tenants/{tenant_id}/mark-paid")
def mark_tenant_paid(tenant_id: int, db: Session = Depends(get_db)):
    tenant = _tenant_or_404(db, tenant_id)
    now = datetime.now(IST).replace(tzinfo=None)
    current_end = now + timedelta(days=30)
    previous_values = {
        "subscription_status": tenant.subscription_status,
        "current_period_end": tenant.subscription_current_end,
        "grace_period_end": tenant.grace_period_end,
    }

    payment = BillingPayment(
        tenant_id=tenant.id,
        amount_paise=tenant.subscription_amount_paise or 30000,
        currency=tenant.subscription_currency or "INR",
        status="SUCCESS",
        payment_method="manual",
        paid_at=now,
        notes="Marked paid manually by super admin",
    )
    db.add(payment)

    tenant.subscription_status = "ACTIVE"
    tenant.subscription_current_start = now
    tenant.subscription_current_end = current_end
    tenant.grace_period_end = None
    tenant.suspension_reason = None
    tenant.billing_last_event_at = now

    _write_audit_log(
        db,
        action="mark_paid",
        tenant=tenant,
        changed_fields=["subscription_status", "current_period_end", "grace_period_end", "payment_method"],
        previous_values=previous_values,
        new_values={
            "subscription_status": tenant.subscription_status,
            "current_period_end": tenant.subscription_current_end,
            "grace_period_end": tenant.grace_period_end,
            "payment_method": "manual",
            "amount_paise": payment.amount_paise,
        },
        notes="Marked paid manually by super admin",
    )

    db.commit()
    db.refresh(tenant)
    return {
        "message": "Tenant marked as paid successfully",
        "tenant_id": tenant.id,
        "current_period_end": tenant.subscription_current_end,
    }


@router.post("/tenants/{tenant_id}/suspend")
def suspend_tenant(tenant_id: int, payload: SuspendTenantRequest, db: Session = Depends(get_db)):
    tenant = _tenant_or_404(db, tenant_id)
    previous_values = {
        "subscription_status": tenant.subscription_status,
        "suspension_reason": tenant.suspension_reason,
    }
    tenant.subscription_status = "SUSPENDED"
    tenant.suspension_reason = payload.reason.strip() if payload.reason else None
    _write_audit_log(
        db,
        action="suspend_tenant",
        tenant=tenant,
        changed_fields=["subscription_status", "suspension_reason"],
        previous_values=previous_values,
        new_values={
            "subscription_status": tenant.subscription_status,
            "suspension_reason": tenant.suspension_reason,
        },
        notes=tenant.suspension_reason,
    )
    db.commit()
    db.refresh(tenant)
    return {
        "message": "Tenant suspended successfully",
        "tenant_id": tenant.id,
        "subscription_status": tenant.subscription_status,
        "reason": tenant.suspension_reason,
    }


@router.post("/tenants/{tenant_id}/send-payment-reminder")
def send_payment_reminder(tenant_id: int, db: Session = Depends(get_db)):
    tenant = _tenant_or_404(db, tenant_id)
    owner = _owner_for_tenant(db, tenant.id)
    logger.info(
        "Payment reminder stub: tenant_id=%s tenant_name=%s email=%s phone=%s status=%s",
        tenant.id,
        tenant.name,
        owner.email if owner else None,
        owner.phone if owner else None,
        tenant.subscription_status,
    )
    _write_audit_log(
        db,
        action="send_payment_reminder",
        tenant=tenant,
        changed_fields=[],
        previous_values={},
        new_values={},
        notes="Payment reminder queued (stub)",
    )
    db.commit()
    return {
        "message": "Payment reminder queued (stub)",
        "tenant_id": tenant.id,
    }


@router.get("/audit-logs")
def get_audit_logs(tenant_id: int | None = None, db: Session = Depends(get_db)):
    query = db.query(SuperAdminAuditLog)
    if tenant_id is not None:
        query = query.filter(SuperAdminAuditLog.tenant_id == tenant_id)
    logs = query.order_by(SuperAdminAuditLog.performed_at.desc(), SuperAdminAuditLog.id.desc()).all()
    return [
        {
            "id": log.id,
            "action": log.action,
            "tenant_id": log.tenant_id,
            "tenant_name": log.tenant_name,
            "changed_fields": json.loads(log.changed_fields) if log.changed_fields else [],
            "previous_values": json.loads(log.previous_values) if log.previous_values else {},
            "new_values": json.loads(log.new_values) if log.new_values else {},
            "notes": log.notes,
            "performed_at": log.performed_at,
        }
        for log in logs
    ]


@router.get("/analytics")
def get_super_admin_analytics(db: Session = Depends(get_db)):
    tenants = db.query(Tenant).all()
    now = datetime.now(IST).replace(tzinfo=None)
    month_start = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
    seven_days_from_now = now + timedelta(days=7)

    successful_payments = (
        db.query(BillingPayment)
        .filter(BillingPayment.status.in_(SUCCESSFUL_PAYMENT_STATUSES))
        .all()
    )
    month_successful_payments = [
        payment
        for payment in successful_payments
        if (payment.paid_at or payment.created_at) and (payment.paid_at or payment.created_at) >= month_start
    ]
    failed_payments_this_month = (
        db.query(func.count(BillingPayment.id))
        .filter(
            BillingPayment.created_at >= month_start,
            (BillingPayment.status.in_(FAILED_PAYMENT_STATUSES) | BillingPayment.failure_reason.is_not(None)),
        )
        .scalar()
        or 0
    )

    upcoming_renewals = [
        {
            "tenant_name": tenant.name,
            "period_end": tenant.subscription_current_end,
        }
        for tenant in tenants
        if tenant.subscription_current_end and now <= tenant.subscription_current_end <= seven_days_from_now
    ]

    return {
        "total_tenants": len(tenants),
        "active_count": sum(1 for tenant in tenants if str(tenant.subscription_status or "").upper() == "ACTIVE"),
        "pending_count": sum(1 for tenant in tenants if str(tenant.subscription_status or "").upper() == "PENDING"),
        "suspended_count": sum(1 for tenant in tenants if str(tenant.subscription_status or "").upper() == "SUSPENDED"),
        "cancelled_count": sum(1 for tenant in tenants if str(tenant.subscription_status or "").upper() == "CANCELLED"),
        "total_revenue": sum(payment.amount_paise for payment in successful_payments),
        "revenue_this_month": sum(payment.amount_paise for payment in month_successful_payments),
        "upcoming_renewals_in_next_7_days": upcoming_renewals,
        "failed_payments_this_month": int(failed_payments_this_month),
    }
