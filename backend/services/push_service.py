"""
Option 2: Dual-Platform Push Notification Service (pywebpush VAPID + Native Google FCM)
"""

import os
import json
import logging
import requests
from typing import Optional, List
from sqlalchemy.orm import Session

from backend.models.models import PushSubscription, User, RoleEnum

logger = logging.getLogger(__name__)

# Default persistent VAPID keys for development/production fallback if env vars not set
DEFAULT_VAPID_PUBLIC_KEY = os.getenv(
    "VAPID_PUBLIC_KEY",
    "BC2cwmWaCscRctR2z-RIUJTO-I8dHomSJkmapegSkIvFUjmWvPDQSC5btCIbdqaoEZeX-dHIaNj8kpKo4oP-nRI"
)
DEFAULT_VAPID_PRIVATE_KEY = os.getenv(
    "VAPID_PRIVATE_KEY",
    "Iyzy8YIjmnsjk3i7WtyRODauDzWyueLOz1VYaRtkJpA"
)
VAPID_CLAIMS_EMAIL = os.getenv("VAPID_CLAIMS_EMAIL", "mailto:support@smartattend.com")
FCM_SERVER_KEY = os.getenv("FCM_SERVER_KEY", "")


def get_vapid_public_key() -> str:
    """Return the VAPID Public Key for frontend client subscriptions."""
    return DEFAULT_VAPID_PUBLIC_KEY


def send_native_fcm_push(subscription: PushSubscription, title: str, body: str, url: Optional[str] = None, db: Optional[Session] = None) -> bool:
    """Send High-Priority Native Push notification directly to Android APK via Google FCM API."""
    raw_token = subscription.endpoint.replace("fcm_", "").strip()
    
    if not FCM_SERVER_KEY:
        logger.warning(f"⚠️ FCM_SERVER_KEY not set on backend (Render). Native FCM push skipped for token: {raw_token[:15]}...")
        return False

    headers = {
        "Authorization": f"key={FCM_SERVER_KEY}",
        "Content-Type": "application/json",
        "TTL": "86400",
        "Urgency": "high"
    }

    # Attempt 1: Direct Token WebPush Endpoint (Supported on all Firebase projects)
    fcm_direct_url = f"https://fcm.googleapis.com/fcm/send/{raw_token}"
    direct_payload = {
        "title": title,
        "body": body,
        "notification": {
            "title": title,
            "body": body,
            "sound": "default"
        },
        "data": {
            "title": title,
            "body": body,
            "url": url or "/staff/dashboard"
        }
    }

    try:
        res = requests.post(fcm_direct_url, json=direct_payload, headers=headers, timeout=10)
        if res.status_code in (200, 201):
            logger.info(f"✅ Native FCM Push delivered via Direct Endpoint to user ID {subscription.user_id} (Token: {raw_token[:15]}...): '{title}'")
            return True
        else:
            logger.warning(f"⚠️ Direct FCM API returned HTTP {res.status_code}: {res.text[:200]}")
    except Exception as err:
        logger.warning(f"⚠️ Direct FCM Push exception: {err}")

    # Attempt 2: Standard FCM Push API
    legacy_url = "https://fcm.googleapis.com/fcm/send"
    legacy_payload = {
        "to": raw_token,
        "priority": "high",
        "notification": {
            "title": title,
            "body": body,
            "sound": "default",
            "badge": "1"
        },
        "data": {
            "title": title,
            "body": body,
            "url": url or "/staff/dashboard"
        }
    }

    try:
        res_legacy = requests.post(legacy_url, json=legacy_payload, headers=headers, timeout=10)
        if res_legacy.status_code in (200, 201):
            res_json = res_legacy.json() if res_legacy.headers.get("content-type", "").startswith("application/json") else {}
            if res_json.get("success") == 1 or "multicast_id" in res_json:
                logger.info(f"✅ Native FCM Push delivered via FCM API to user ID {subscription.user_id}")
                return True
            else:
                logger.warning(f"⚠️ FCM delivery rejection response: {res_legacy.text[:200]}")
                if "NotRegistered" in res_legacy.text and db is not None:
                    db.delete(subscription)
                    db.commit()
                return False
        else:
            logger.warning(f"⚠️ Legacy FCM API returned HTTP {res_legacy.status_code}: {res_legacy.text[:200]}")
            return False
    except Exception as err:
        logger.error(f"❌ Failed to dispatch Native FCM push: {err}")
        return False


def send_web_push(subscription: PushSubscription, title: str, body: str, url: Optional[str] = None, db: Optional[Session] = None) -> bool:
    """Send Push notification to a single PushSubscription endpoint (Routes to FCM for Native APK or pywebpush for PWA)."""
    
    # Pathway 1: Native FCM Token (Android APK)
    if subscription.p256dh == "native_fcm" or subscription.endpoint.startswith("fcm_"):
        return send_native_fcm_push(subscription, title, body, url, db=db)

    # Pathway 2: WebPush VAPID (PWA Browser)
    try:
        from pywebpush import webpush, WebPushException

        import time
        payload = json.dumps({
            "title": title,
            "body": body,
            "icon": "/icons/icon-192.png",
            "badge": "/favicon.svg",
            "tag": f"smart-attend-{int(time.time() * 1000)}",
            "data": {"url": url or "/"}
        })

        subscription_info = {
            "endpoint": subscription.endpoint,
            "keys": {
                "p256dh": subscription.p256dh,
                "auth": subscription.auth
            }
        }

        response = webpush(
            subscription_info=subscription_info,
            data=payload,
            vapid_private_key=DEFAULT_VAPID_PRIVATE_KEY,
            vapid_claims={"sub": VAPID_CLAIMS_EMAIL},
            headers={
                "Urgency": "high",
                "TTL": "86400"
            }
        )
        status_code = getattr(response, "status_code", 201)
        logger.info(f"✅ Web Push sent to user ID {subscription.user_id} (Endpoint ID {subscription.id}, Status: {status_code}): '{title}'")
        return True
    except Exception as exc:
        status_code = None
        response_text = str(exc)
        if hasattr(exc, "response") and getattr(exc, "response") is not None:
            status_code = getattr(exc.response, "status_code", None)
            response_text = getattr(exc.response, "text", str(exc))

        logger.warning(f"⚠️ Web Push delivery failed for subscription ID {subscription.id} (HTTP {status_code}): {response_text}")

        # Prune expired or invalid subscriptions (404 Not Found / 410 Gone)
        if status_code in (404, 410) and db is not None:
            try:
                logger.info(f"🗑️ Auto-pruning expired push subscription ID {subscription.id} (Endpoint: {subscription.endpoint[:30]}...)")
                db.delete(subscription)
                db.commit()
            except Exception as prune_err:
                logger.warning(f"Failed to prune expired subscription {subscription.id}: {prune_err}")

        return False


def send_push_to_user(db: Session, user_id: int, title: str, body: str, url: Optional[str] = None) -> int:
    """Send push notification to all active subscriptions of a specific user."""
    subs = db.query(PushSubscription).filter(PushSubscription.user_id == user_id).all()
    count = 0
    for sub in subs:
        if send_web_push(sub, title, body, url, db=db):
            count += 1
    return count


def send_push_to_tenant_admins(db: Session, tenant_id: Optional[int], title: str, body: str, url: Optional[str] = None) -> int:
    """Send push notification to all Admin users belonging to a tenant."""
    if not tenant_id:
        return 0

    admin_ids = [
        u.id for u in db.query(User).filter(
            User.tenant_id == tenant_id,
            User.role == RoleEnum.ADMIN
        ).all()
    ]

    if not admin_ids:
        return 0

    subs = db.query(PushSubscription).filter(PushSubscription.user_id.in_(admin_ids)).all()
    count = 0
    for sub in subs:
        if send_web_push(sub, title, body, url, db=db):
            count += 1
    return count


def broadcast_push_to_tenant(db: Session, tenant_id: Optional[int], title: str, body: str, url: Optional[str] = None) -> int:
    """Broadcast push notification to all staff & admins in a tenant."""
    if not tenant_id:
        return 0

    subs = db.query(PushSubscription).filter(PushSubscription.tenant_id == tenant_id).all()
    count = 0
    for sub in subs:
        if send_web_push(sub, title, body, url, db=db):
            count += 1
    return count
