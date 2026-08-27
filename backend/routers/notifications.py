"""
Notification & Web Push Router
"""

import logging
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy.orm import Session

from backend.database.database import get_db
from backend.models.models import PushSubscription, User
from backend.auth.dependencies import get_current_user, get_current_admin
from backend.services.push_service import (
    get_vapid_public_key,
    broadcast_push_to_tenant
)

logger = logging.getLogger(__name__)

router = APIRouter(
    prefix="/notifications",
    tags=["Notifications"]
)


class PushKeysSchema(BaseModel):
    p256dh: str
    auth: str


class PushSubscribeRequest(BaseModel):
    endpoint: str
    keys: PushKeysSchema


class PushUnsubscribeRequest(BaseModel):
    endpoint: str


class AnnouncementRequest(BaseModel):
    title: str
    message: str
    url: Optional[str] = "/staff/dashboard"


@router.get("/vapid-public-key")
def get_vapid_key():
    """Return public VAPID key required for Web Push client subscriptions."""
    return {"publicKey": get_vapid_public_key()}


@router.post("/subscribe")
def subscribe_web_push(
    payload: PushSubscribeRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Register or update a user's browser Web Push subscription."""
    user_record = current_user
    endpoint = payload.endpoint.strip()

    existing = db.query(PushSubscription).filter(PushSubscription.endpoint == endpoint).first()
    if existing:
        existing.user_id = user_record.id
        existing.tenant_id = user_record.tenant_id
        existing.p256dh = payload.keys.p256dh
        existing.auth = payload.keys.auth
    else:
        new_sub = PushSubscription(
            user_id=user_record.id,
            tenant_id=user_record.tenant_id,
            endpoint=endpoint,
            p256dh=payload.keys.p256dh,
            auth=payload.keys.auth
        )
        db.add(new_sub)

    db.commit()
    logger.info(f"✅ Web Push subscription saved for user ID {user_record.id}")
    return {"status": "success", "message": "Subscribed to push notifications successfully."}


@router.post("/unsubscribe")
def unsubscribe_web_push(
    payload: PushUnsubscribeRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Remove a browser Web Push subscription."""
    endpoint = payload.endpoint.strip()
    db.query(PushSubscription).filter(
        PushSubscription.endpoint == endpoint,
        PushSubscription.user_id == current_user.id
    ).delete()
    db.commit()
    return {"status": "success", "message": "Unsubscribed successfully."}


@router.post("/announce")
def broadcast_announcement(
    payload: AnnouncementRequest,
    db: Session = Depends(get_db),
    current_admin: User = Depends(get_current_admin)
):
    """Admin endpoint to broadcast announcement to all staff members in tenant."""
    if not payload.title.strip() or not payload.message.strip():
        raise HTTPException(status_code=400, detail="Title and message are required.")

    count = broadcast_push_to_tenant(
        db=db,
        tenant_id=current_admin.tenant_id,
        title=f"📢 {payload.title.strip()}",
        body=payload.message.strip(),
        url=payload.url
    )

    return {
        "status": "success",
        "message": f"Announcement broadcasted to {count} device(s).",
        "delivered_count": count
    }
