"""
Option 2: Dual-Platform Push Notification Service (pywebpush VAPID + Firebase Admin SDK FCM)
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

# Initialize Firebase Admin SDK if service account JSON is provided in env
FIREBASE_SERVICE_ACCOUNT_JSON = os.getenv("FIREBASE_SERVICE_ACCOUNT_JSON", "")
firebase_app_initialized = False

if FIREBASE_SERVICE_ACCOUNT_JSON:
    try:
        import firebase_admin
        from firebase_admin import credentials, messaging
        if not firebase_admin._apps:
            service_account_info = json.loads(FIREBASE_SERVICE_ACCOUNT_JSON)
            cred = credentials.Certificate(service_account_info)
            firebase_admin.initialize_app(cred)
        firebase_app_initialized = True
        logger.info("✅ Firebase Admin SDK initialized successfully.")
    except Exception as init_err:
        logger.warning(f"⚠️ Failed to initialize Firebase Admin SDK: {init_err}")


def get_vapid_public_key() -> str:
    """Return the VAPID Public Key for frontend client subscriptions."""
    return DEFAULT_VAPID_PUBLIC_KEY


def send_native_fcm_push(subscription: PushSubscription, title: str, body: str, url: Optional[str] = None, db: Optional[Session] = None) -> bool:
    """Send High-Priority Native Push notification directly to Android APK via Google FCM Admin SDK."""
    raw_token = subscription.endpoint.replace("fcm_", "").strip()

    if firebase_app_initialized:
        try:
            from firebase_admin import messaging
            message = messaging.Message(
                notification=messaging.Notification(title=title, body=body),
                data={"title": str(title), "body": str(body), "url": str(url or "/staff/dashboard")},
                token=raw_token,
                android=messaging.AndroidConfig(priority="high"),
            )
            msg_id = messaging.send(message)
            logger.info(f"✅ Native FCM push sent via Firebase Admin SDK ({msg_id}) to user ID {subscription.user_id} ({raw_token[:15]}...)")
            return True
        except Exception as e:
            err_str = str(e)
            logger.error(f"❌ Native FCM Push failed for user ID {subscription.user_id}: {err_str}")
            if "Requested entity was not found" in err_str or "unregistered" in err_str.lower() or "404" in err_str:
                if db is not None:
                    try:
                        logger.info(f"🗑️ Auto-pruning unregistered FCM token for user ID {subscription.user_id}")
                        db.delete(subscription)
                        db.commit()
                    except Exception:
                        pass
            return False
    else:
        logger.warning(f"⚠️ FIREBASE_SERVICE_ACCOUNT_JSON env var not set on Render. Native FCM push skipped for user ID {subscription.user_id}.")
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
