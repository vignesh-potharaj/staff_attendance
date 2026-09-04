"""
Native Push Notification Service (Firebase Admin SDK FCM)
"""

import os
import json
import logging
from typing import Optional, List
from sqlalchemy.orm import Session

from backend.models.models import PushSubscription, User, RoleEnum

logger = logging.getLogger(__name__)

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
    """Send Push notification to a single PushSubscription endpoint (Routes to FCM for Native APK)."""
    return send_native_fcm_push(subscription, title, body, url, db=db)


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
