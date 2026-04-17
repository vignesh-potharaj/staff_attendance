import re
from datetime import datetime, timedelta
from typing import Any, cast

from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy.orm import Session

from backend.auth.security import (
    ACCESS_TOKEN_EXPIRE_MINUTES,
    IST,
    create_access_token,
    generate_random_token,
    get_password_hash,
    hash_token,
    verify_password,
)
from backend.database.database import get_db
from backend.models.models import (
    EmailVerificationToken,
    PasswordResetToken,
    RoleEnum,
    Tenant,
    User,
    UserStatus,
)
from backend.schemas.schemas import (
    ActionMessage,
    ForgotPasswordRequest,
    ForgotPasswordResponse,
    LoginRequest,
    ResendVerificationRequest,
    ResetPasswordRequest,
    TenantRegistrationRequest,
    TenantRegistrationResponse,
    Token,
)
from backend.services.email_service import build_preview_url, send_email

router = APIRouter(
    prefix="/auth",
    tags=["Authentication"]
)


def orm_value(value: object) -> Any:
    """Tell static type checkers this is a loaded SQLAlchemy ORM value."""
    return cast(Any, value)

def slugify_company_name(company_name: str) -> str:
    slug = re.sub(r"[^a-z0-9]+", "-", company_name.strip().lower()).strip("-")
    return slug or "workspace"


def generate_unique_slug(db: Session, company_name: str) -> str:
    base_slug = slugify_company_name(company_name)
    slug = base_slug
    suffix = 2
    while db.query(Tenant).filter(Tenant.slug == slug).first():
        slug = f"{base_slug}-{suffix}"
        suffix += 1
    return slug


def issue_verification_token(db: Session, user: User) -> tuple[bool, str]:
    user_record = orm_value(user)
    token = generate_random_token()
    verification = EmailVerificationToken(
        user_id=user_record.id,
        token_hash=hash_token(token),
        expires_at=datetime.now(IST) + timedelta(hours=24),
    )
    db.add(verification)
    db.commit()

    preview_url = build_preview_url("/verify-email", token)
    sent = send_email(
        subject="Verify your Smart Attend account",
        recipient=user_record.email or "",
        plain_text=(
            f"Hello {user_record.name},\n\n"
            "Welcome to Smart Attend.\n"
            f"Verify your email by opening this link:\n{preview_url}\n\n"
            "This link expires in 24 hours."
        ),
    )
    return sent, preview_url


def issue_password_reset_token(db: Session, user: User) -> tuple[bool, str]:
    user_record = orm_value(user)
    token = generate_random_token()
    reset_token = PasswordResetToken(
        user_id=user_record.id,
        token_hash=hash_token(token),
        expires_at=datetime.now(IST) + timedelta(minutes=30),
    )
    db.add(reset_token)
    db.commit()

    preview_url = build_preview_url("/reset-password", token)
    sent = send_email(
        subject="Reset your Smart Attend password",
        recipient=user_record.email or "",
        plain_text=(
            f"Hello {user_record.name},\n\n"
            "Use the link below to reset your password:\n"
            f"{preview_url}\n\n"
            "This link expires in 30 minutes."
        ),
    )
    return sent, preview_url


def build_login_response(user: User) -> dict:
    user_record = orm_value(user)
    access_token_expires = timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = create_access_token(
        data={
            "sub": str(user_record.id),
            "tenant_id": user_record.tenant_id,
            "role": user_record.role.value if hasattr(user_record.role, "value") else user_record.role,
        },
        expires_delta=access_token_expires,
    )
    return {
        "access_token": access_token,
        "token_type": "bearer",
        "user": {
            "id": user_record.id,
            "name": user_record.name,
            "employee_id": user_record.employee_id,
            "email": user_record.email,
            "role": user_record.role,
            "tenant_id": user_record.tenant_id,
            "tenant_slug": user_record.tenant.slug if user_record.tenant else None,
            "is_email_verified": bool(user_record.is_email_verified),
        }
    }


def parse_login_payload(data: dict) -> LoginRequest:
    tenant_slug = data.get("tenant_slug")
    user_id = data.get("user_id") or data.get("username")
    password = data.get("password")
    if not user_id or not password:
        raise HTTPException(status_code=400, detail="tenant_slug, user_id and password are required")
    return LoginRequest(tenant_slug=tenant_slug, user_id=user_id, password=password)


@router.post("/register-tenant", response_model=TenantRegistrationResponse)
def register_tenant(payload: TenantRegistrationRequest, db: Session = Depends(get_db)):
    if payload.password != payload.confirm_password:
        raise HTTPException(status_code=400, detail="Passwords do not match")

    email = payload.email.strip().lower()
    user_id = payload.user_id.strip()

    if db.query(User).filter(User.email == email).first():
        raise HTTPException(status_code=400, detail="Email is already registered")
    if db.query(User).filter(User.employee_id == user_id).first():
        raise HTTPException(status_code=400, detail="User ID is already registered")

    tenant = Tenant(
        name=payload.company_name.strip(),
        slug=generate_unique_slug(db, payload.company_name),
        status="ACTIVE",
    )
    db.add(tenant)
    db.flush()
    tenant_record = orm_value(tenant)

    admin_user = User(
        name=payload.admin_name.strip(),
        employee_id=user_id,
        email=email,
        password_hash=get_password_hash(payload.password),
        role=RoleEnum.ADMIN,
        phone=payload.mobile_number.strip(),
        tenant_id=tenant_record.id,
        status=UserStatus.PENDING_VERIFICATION,
        is_email_verified=0,
    )
    db.add(admin_user)
    db.commit()
    db.refresh(admin_user)

    verification_sent, preview_url = issue_verification_token(db, admin_user)
    return TenantRegistrationResponse(
        message="Company account created. Verify your email to activate login.",
        tenant_slug=tenant_record.slug,
        verification_sent=verification_sent,
        verification_preview_url=None if verification_sent else preview_url,
    )


@router.post("/verify-email", response_model=ActionMessage)
def verify_email(token: str, db: Session = Depends(get_db)):
    token_hash = hash_token(token)
    record = db.query(EmailVerificationToken).filter(EmailVerificationToken.token_hash == token_hash).first()

    if not record:
        raise HTTPException(status_code=400, detail="Invalid verification token")
    record_data = orm_value(record)
    if record_data.used_at is not None:
        raise HTTPException(status_code=400, detail="Verification token has already been used")
    if record_data.expires_at < datetime.now(IST).replace(tzinfo=None):
        raise HTTPException(status_code=400, detail="Verification token has expired")

    user = db.query(User).filter(User.id == record_data.user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    user_data = orm_value(user)

    user_data.is_email_verified = 1
    user_data.status = UserStatus.ACTIVE
    record_data.used_at = datetime.now(IST)
    db.commit()

    return ActionMessage(message="Email verified successfully. You can now sign in.")


@router.post("/resend-verification", response_model=ActionMessage)
def resend_verification(payload: ResendVerificationRequest, db: Session = Depends(get_db)):
    email = payload.email.strip().lower()
    query = db.query(User).filter(User.email == email)

    if payload.tenant_slug:
        tenant = db.query(Tenant).filter(Tenant.slug == payload.tenant_slug.strip().lower()).first()
        if not tenant:
            raise HTTPException(status_code=404, detail="Workspace not found")
        tenant_data = orm_value(tenant)
        query = query.filter(User.tenant_id == tenant_data.id)

    user = query.first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    user_data = orm_value(user)
    if user_data.is_email_verified:
        return ActionMessage(message="Email is already verified.")

    sent, preview_url = issue_verification_token(db, user)
    return ActionMessage(
        message="Verification email sent.",
        preview_url=None if sent else preview_url,
    )


@router.post("/login", response_model=Token)
async def login(request: Request, db: Session = Depends(get_db)):
    content_type = request.headers.get("content-type", "")
    if "application/json" in content_type:
        payload = parse_login_payload(await request.json())
    else:
        form = await request.form()
        payload = parse_login_payload(dict(form))

    tenant = None
    if payload.tenant_slug:
        tenant = db.query(Tenant).filter(Tenant.slug == payload.tenant_slug.strip().lower()).first()
        if not tenant:
            raise HTTPException(status_code=401, detail="Invalid workspace or credentials")
    tenant_data = orm_value(tenant) if tenant else None

    query = db.query(User).filter(User.employee_id == payload.user_id.strip())
    if tenant_data:
        query = query.filter(User.tenant_id == tenant_data.id)

    user = query.first()
    user_data = orm_value(user) if user else None
    if not user_data or not verify_password(payload.password, user_data.password_hash):
        if user:
            user_data = orm_value(user)
            user_data.failed_login_attempts = (user_data.failed_login_attempts or 0) + 1
            if user_data.failed_login_attempts >= 5:
                user_data.locked_until = datetime.now(IST) + timedelta(minutes=15)
            db.commit()
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid workspace or credentials",
            headers={"WWW-Authenticate": "Bearer"},
        )

    if user_data.locked_until and user_data.locked_until > datetime.now(IST).replace(tzinfo=None):
        raise HTTPException(status_code=423, detail="Account is temporarily locked. Try again later.")
    if user_data.email and not user_data.is_email_verified:
        raise HTTPException(status_code=403, detail="Verify your email before signing in.")
    if user_data.status != UserStatus.ACTIVE:
        raise HTTPException(status_code=403, detail="Account is not active.")

    user_data.failed_login_attempts = 0
    user_data.locked_until = None
    db.commit()

    return build_login_response(user)


@router.post("/forgot-password", response_model=ForgotPasswordResponse)
def forgot_password(payload: ForgotPasswordRequest, db: Session = Depends(get_db)):
    email = payload.email.strip().lower()
    user = db.query(User).filter(User.email == email).first()

    if not user:
        return ForgotPasswordResponse(message="If the account exists, a password reset email has been prepared.")

    sent, preview_url = issue_password_reset_token(db, user)
    return ForgotPasswordResponse(
        message="If the account exists, a password reset email has been prepared.",
        reset_preview_url=None if sent else preview_url,
    )


@router.post("/reset-password", response_model=ActionMessage)
def reset_password(payload: ResetPasswordRequest, db: Session = Depends(get_db)):
    if payload.new_password != payload.confirm_password:
        raise HTTPException(status_code=400, detail="Passwords do not match")

    record = db.query(PasswordResetToken).filter(
        PasswordResetToken.token_hash == hash_token(payload.token)
    ).first()
    if not record:
        raise HTTPException(status_code=400, detail="Invalid reset token")
    record_data = orm_value(record)
    if record_data.used_at is not None:
        raise HTTPException(status_code=400, detail="Reset token has already been used")
    if record_data.expires_at < datetime.now(IST).replace(tzinfo=None):
        raise HTTPException(status_code=400, detail="Reset token has expired")

    user = db.query(User).filter(User.id == record_data.user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    user_data = orm_value(user)

    user_data.password_hash = get_password_hash(payload.new_password)
    user_data.failed_login_attempts = 0
    user_data.locked_until = None
    record_data.used_at = datetime.now(IST)
    db.commit()

    return ActionMessage(message="Password reset successfully. You can now sign in.")
