import os
from datetime import datetime
from typing import Any

from fastapi import HTTPException
import razorpay
from razorpay.errors import BadRequestError, GatewayError, ServerError, SignatureVerificationError

from backend.models.models import IST


def _env(name: str) -> str:
    value = os.getenv(name)
    if not value:
        raise HTTPException(status_code=503, detail=f"Missing required environment variable: {name}")
    return value


def get_public_config() -> dict[str, str | None]:
    return {
        "key_id": os.getenv("RAZORPAY_KEY_ID"),
        "plan_id": os.getenv("RAZORPAY_PLAN_ID"),
    }


def get_client() -> razorpay.Client:
    key_id = _env("RAZORPAY_KEY_ID")
    key_secret = _env("RAZORPAY_KEY_SECRET")
    client = razorpay.Client(auth=(key_id, key_secret))
    client.set_app_details({"title": "Smart Attend", "version": "1.0.0"})
    return client


def verify_webhook_signature(raw_body: bytes, signature: str | None) -> bool:
    webhook_secret = os.getenv("RAZORPAY_WEBHOOK_SECRET")
    if not webhook_secret or not signature:
        return False
    client = get_client()
    try:
        client.utility.verify_webhook_signature(raw_body, signature, webhook_secret)
        return True
    except SignatureVerificationError:
        return False


def unix_to_naive_ist(value: Any) -> datetime | None:
    if value in (None, ""):
        return None
    try:
        return datetime.fromtimestamp(int(value), IST).replace(tzinfo=None)
    except (TypeError, ValueError, OSError):
        return None


def create_subscription(*, tenant_id: int, business_name: str, admin_name: str, admin_email: str | None, admin_phone: str | None) -> dict[str, Any]:
    plan_id = _env("RAZORPAY_PLAN_ID")
    total_count = int(os.getenv("RAZORPAY_TOTAL_COUNT", "120"))
    client = get_client()

    payload: dict[str, Any] = {
        "plan_id": plan_id,
        "total_count": total_count,
        "quantity": 1,
        "customer_notify": 1,
        "notes": {
            "tenant_id": str(tenant_id),
            "business_name": business_name,
            "admin_name": admin_name,
            "admin_email": admin_email or "",
            "admin_phone": admin_phone or "",
        },
    }

    try:
        return client.subscription.create(data=payload)
    except BadRequestError as exc:
        detail = getattr(exc, "reason", None) or getattr(exc, "description", None) or "Razorpay rejected the subscription request"
        raise HTTPException(status_code=502, detail=detail)
    except (GatewayError, ServerError):
        raise HTTPException(status_code=502, detail="Could not reach Razorpay")
