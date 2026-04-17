from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from backend.auth.dependencies import get_current_admin
from backend.database.database import get_db
from backend.models.models import (
    Attendance,
    DailyRoaster,
    EmailVerificationToken,
    PasswordResetToken,
    Tenant,
    User,
)
from backend.schemas.schemas import DeleteAccountRequest, SettingsResponse, SettingsUpdate

router = APIRouter(
    prefix="/settings",
    tags=["Settings"],
    dependencies=[Depends(get_current_admin)],
)


def _settings_response(current_admin: User) -> SettingsResponse:
    tenant = current_admin.tenant
    return SettingsResponse(
        business_name=tenant.name if tenant else "Smart Attend Workspace",
        tenant_slug=tenant.slug if tenant else None,
        admin_name=current_admin.name,
        email=current_admin.email,
        phone=current_admin.phone,
        employee_id=current_admin.employee_id,
        role=current_admin.role.value if hasattr(current_admin.role, "value") else str(current_admin.role),
    )


@router.get("/", response_model=SettingsResponse)
def get_settings(current_admin: User = Depends(get_current_admin)):
    return _settings_response(current_admin)


@router.put("/", response_model=SettingsResponse)
def update_settings(
    payload: SettingsUpdate,
    db: Session = Depends(get_db),
    current_admin: User = Depends(get_current_admin),
):
    if payload.business_name is not None:
        business_name = payload.business_name.strip()
        if len(business_name) < 2:
            raise HTTPException(status_code=400, detail="Business name must be at least 2 characters")
        tenant = current_admin.tenant
        if not tenant:
            raise HTTPException(status_code=404, detail="Workspace not found")
        tenant.name = business_name

    if payload.admin_name is not None:
        admin_name = payload.admin_name.strip()
        if len(admin_name) < 2:
            raise HTTPException(status_code=400, detail="Your name must be at least 2 characters")
        current_admin.name = admin_name

    if payload.phone is not None:
        phone = payload.phone.strip()
        if len(phone) < 6:
            raise HTTPException(status_code=400, detail="Phone number must be at least 6 characters")
        current_admin.phone = phone

    db.commit()
    db.refresh(current_admin)
    return _settings_response(current_admin)


@router.delete("/account")
def delete_account(
    payload: DeleteAccountRequest,
    db: Session = Depends(get_db),
    current_admin: User = Depends(get_current_admin),
):
    if payload.confirmation.strip().upper() != "DELETE":
        raise HTTPException(status_code=400, detail='Type "DELETE" to confirm account deletion')

    tenant_id = current_admin.tenant_id
    if tenant_id is None:
        raise HTTPException(status_code=400, detail="This account is not attached to a workspace")

    tenant = db.query(Tenant).filter(Tenant.id == tenant_id).first()
    if not tenant:
        raise HTTPException(status_code=404, detail="Workspace not found")

    users = db.query(User).filter(User.tenant_id == tenant_id).all()
    user_ids = [user.id for user in users]

    db.query(Attendance).filter(Attendance.tenant_id == tenant_id).delete(synchronize_session=False)
    db.query(DailyRoaster).filter(DailyRoaster.tenant_id == tenant_id).delete(synchronize_session=False)

    if user_ids:
        db.query(EmailVerificationToken).filter(
            EmailVerificationToken.user_id.in_(user_ids)
        ).delete(synchronize_session=False)
        db.query(PasswordResetToken).filter(
            PasswordResetToken.user_id.in_(user_ids)
        ).delete(synchronize_session=False)

    db.query(User).filter(User.tenant_id == tenant_id).delete(synchronize_session=False)
    db.delete(tenant)
    db.commit()

    return {"message": "Account and workspace deleted successfully"}
