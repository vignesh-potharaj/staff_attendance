import re
from urllib.parse import unquote, urlparse, parse_qs
from urllib.request import Request, urlopen
from typing import Optional, cast

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


COORDINATE_RE = re.compile(r"(-?\d{1,3}(?:\.\d+)?)[,\s+]+(-?\d{1,3}(?:\.\d+)?)")


def _extract_coordinates_from_text(text: str) -> tuple[float, float] | None:
    if not text:
        return None
    decoded = unquote(text).replace("+", " ")
    
    # 1. Check query parameters
    try:
        parsed = urlparse(decoded)
        query = parse_qs(parsed.query)
        for key in ("q", "query", "ll", "center"):
            val = query.get(key, [None])[0]
            if val:
                m = COORDINATE_RE.search(val)
                if m:
                    lat, lng = float(m.group(1)), float(m.group(2))
                    if -90 <= lat <= 90 and -180 <= lng <= 180:
                        return lat, lng
    except Exception:
        pass

    # 2. Check path / specific Google Maps URL patterns
    patterns = [
        r"@(-?\d{1,3}\.\d+)[,\s]+(-?\d{1,3}\.\d+)",
        r"/search/(-?\d{1,3}\.\d+)[,\s]+(-?\d{1,3}\.\d+)",
        r"!3d(-?\d{1,3}\.\d+)!4d(-?\d{1,3}\.\d+)",
        r"!2d(-?\d{1,3}\.\d+)!3d(-?\d{1,3}\.\d+)",
        r"(-?\d{1,3}\.\d{4,})[,\s]+(-?\d{1,3}\.\d{4,})",
    ]
    for pattern in patterns:
        match = re.search(pattern, decoded)
        if match:
            first = float(match.group(1))
            second = float(match.group(2))
            if pattern.startswith("!2d"):
                lat, lng = second, first
            else:
                lat, lng = first, second
            if -90 <= lat <= 90 and -180 <= lng <= 180:
                return lat, lng

    return None


def _extract_coordinates_from_maps_link(maps_link: str) -> tuple[float, float] | None:
    if not maps_link:
        return None

    # Direct match on the input text/URL
    coordinates = _extract_coordinates_from_text(maps_link)
    if coordinates:
        return coordinates

    # Follow redirects for short links (e.g. maps.app.goo.gl, goo.gl/maps)
    try:
        request = Request(
            maps_link,
            headers={"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"}
        )
        with urlopen(request, timeout=8) as response:
            final_url = response.geturl()
            coords = _extract_coordinates_from_text(final_url)
            if coords:
                return coords
            
            body = response.read().decode("utf-8", errors="ignore")
            return _extract_coordinates_from_text(body)
    except Exception as e:
        return None


def _settings_response(current_admin: User) -> SettingsResponse:
    tenant = current_admin.tenant
    return SettingsResponse(
        business_name=tenant.name if tenant else "Smart Attend Workspace",
        tenant_slug=tenant.slug if tenant else None,
        admin_name=cast(str, current_admin.name or ""),
        phone=cast(Optional[str], current_admin.phone),
        employee_id=cast(str, current_admin.employee_id or ""),
        role=current_admin.role.value if hasattr(current_admin.role, "value") else str(current_admin.role),
        geofence_maps_link=tenant.geofence_maps_link if tenant else None,
        geofence_latitude=tenant.geofence_latitude if tenant else None,
        geofence_longitude=tenant.geofence_longitude if tenant else None,
        geofence_radius_meters=tenant.geofence_radius_meters if tenant and tenant.geofence_radius_meters else 100,
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
        # Use setattr to avoid static typing issues with SQLAlchemy Column descriptors
        setattr(current_admin, "name", admin_name)

    if payload.phone is not None:
        phone = payload.phone.strip()
        if len(phone) < 6:
            raise HTTPException(status_code=400, detail="Phone number must be at least 6 characters")
        # Use setattr to avoid static typing issues with SQLAlchemy Column descriptors
        setattr(current_admin, "phone", phone)

    if payload.geofence_maps_link is not None:
        tenant = current_admin.tenant
        if not tenant:
            raise HTTPException(status_code=404, detail="Workspace not found")

        maps_link = payload.geofence_maps_link.strip()
        if not maps_link:
            tenant.geofence_maps_link = None
            tenant.geofence_latitude = None
            tenant.geofence_longitude = None
        else:
            coordinates = _extract_coordinates_from_maps_link(maps_link)
            if not coordinates:
                raise HTTPException(
                    status_code=400,
                    detail="Could not find coordinates in this Maps link. Open Google Maps, copy the full address-bar URL, and paste it here.",
                )
            latitude, longitude = coordinates
            if not -90 <= latitude <= 90 or not -180 <= longitude <= 180:
                raise HTTPException(status_code=400, detail="Maps link contains invalid coordinates")
            tenant.geofence_maps_link = maps_link
            tenant.geofence_latitude = latitude
            tenant.geofence_longitude = longitude

    if payload.geofence_radius_meters is not None:
        tenant = current_admin.tenant
        if not tenant:
            raise HTTPException(status_code=404, detail="Workspace not found")
        radius = int(payload.geofence_radius_meters)
        if radius < 10 or radius > 5000:
            raise HTTPException(status_code=400, detail="Geofence radius must be between 10 and 5000 meters")
        tenant.geofence_radius_meters = radius

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
