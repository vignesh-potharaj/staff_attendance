from datetime import datetime

from fastapi import Depends, HTTPException, Request, status
from jose import JWTError, jwt
from sqlalchemy.orm import Session
from backend.database.database import get_db
from backend.models.models import IST, Tenant, User, RoleEnum, UserStatus
from backend.auth.security import SECRET_KEY, ALGORITHM, oauth2_scheme
from backend.schemas.schemas import TokenData
from backend.services.razorpay_billing import create_subscription, get_public_config, unix_to_naive_ist


SUBSCRIPTION_BYPASS_PREFIXES = ("/auth/", "/billing/", "/docs")
SUBSCRIPTION_BYPASS_EXACT = {"/docs", "/openapi.json", "/redoc"}


def _is_subscription_bypassed(path: str) -> bool:
    return path in SUBSCRIPTION_BYPASS_EXACT or any(path.startswith(prefix) for prefix in SUBSCRIPTION_BYPASS_PREFIXES)


def _subscription_is_active(tenant: Tenant | None) -> bool:
    if not tenant:
        return True
    status_value = str(getattr(tenant, "subscription_status", "PENDING") or "PENDING").upper()
    if status_value not in {"ACTIVE", "TRIALING"}:
        return False
    current_end = getattr(tenant, "subscription_current_end", None)
    if not current_end:
        return True
    end_naive = current_end.replace(tzinfo=None) if current_end.tzinfo else current_end
    return end_naive >= datetime.now(IST).replace(tzinfo=None)


def _ensure_checkout_url(db: Session, user: User) -> str | None:
    tenant = user.tenant
    if not tenant:
        return None

    subscription = create_subscription(
        tenant_id=tenant.id,
        business_name=tenant.name,
        admin_name=user.name or "",
        admin_email=user.email,
        admin_phone=user.phone,
    )
    tenant.subscription_status = str(subscription.get("status") or "created").upper()
    tenant.razorpay_subscription_id = subscription.get("id") or tenant.razorpay_subscription_id
    tenant.razorpay_customer_id = subscription.get("customer_id") or tenant.razorpay_customer_id
    tenant.subscription_current_start = unix_to_naive_ist(subscription.get("current_start")) or tenant.subscription_current_start
    tenant.subscription_current_end = unix_to_naive_ist(subscription.get("current_end")) or tenant.subscription_current_end
    tenant.billing_last_event_at = datetime.now(IST).replace(tzinfo=None)
    db.commit()
    db.refresh(user)
    return subscription.get("short_url")


def get_current_user(request: Request, token: str = Depends(oauth2_scheme), db: Session = Depends(get_db)):
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        user_id_raw = payload.get("sub")
        tenant_id = payload.get("tenant_id")
        role: str = payload.get("role")
        if user_id_raw is None:
            raise credentials_exception
        token_data = TokenData(user_id=int(user_id_raw), tenant_id=tenant_id, role=role)
    except JWTError:
        raise credentials_exception
    except (TypeError, ValueError):
        raise credentials_exception
    
    user = db.query(User).filter(User.id == token_data.user_id).first()
    if user is None:
        raise credentials_exception
    if token_data.tenant_id is not None and user.tenant_id != token_data.tenant_id:
        raise credentials_exception
    if user.status == UserStatus.SUSPENDED:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Account suspended")
    if not _is_subscription_bypassed(request.url.path) and not _subscription_is_active(user.tenant):
        checkout_url = _ensure_checkout_url(db, user)
        public_config = get_public_config()
        raise HTTPException(
            status_code=status.HTTP_402_PAYMENT_REQUIRED,
            detail={
                "message": "Your workspace subscription is not active. Complete payment to continue.",
                "subscription_status": str(user.tenant.subscription_status or "PENDING").upper() if user.tenant else "PENDING",
                "checkout_url": checkout_url,
                "razorpay_subscription_id": user.tenant.razorpay_subscription_id if user.tenant else None,
                "razorpay_key_id": public_config["key_id"],
            },
        )
    return user

def get_current_admin(current_user: User = Depends(get_current_user)):
    if current_user.role != RoleEnum.ADMIN:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not enough privileges"
        )
    return current_user
