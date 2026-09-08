import logging
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from backend.database.database import get_db
from backend.models.models import SavedLocation, User, RoleEnum, Tenant
from backend.schemas.schemas import (
    SavedLocationCreate,
    SavedLocationUpdate,
    SavedLocationResponse,
)
from backend.auth.dependencies import get_current_user, get_current_admin
from backend.routers.settings import _extract_coordinates_from_maps_link

logger = logging.getLogger(__name__)

router = APIRouter(
    prefix="/locations",
    tags=["Locations"]
)

@router.get("/", response_model=List[SavedLocationResponse])
def get_saved_locations(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Get all saved duty and parade locations for the current tenant.
    Accessible to instructors and cadets.
    """
    tenant_id = current_user.tenant_id
    locations = db.query(SavedLocation).filter(
        SavedLocation.tenant_id == tenant_id
    ).order_by(SavedLocation.is_default.desc(), SavedLocation.id.asc()).all()

    # Convert model is_default int (0/1) to bool for response
    result = []
    for loc in locations:
        result.append(
            SavedLocationResponse(
                id=loc.id,
                tenant_id=loc.tenant_id,
                name=loc.name,
                maps_link=loc.maps_link,
                latitude=loc.latitude,
                longitude=loc.longitude,
                radius_meters=loc.radius_meters,
                is_default=bool(loc.is_default),
                created_at=loc.created_at
            )
        )
    return result


@router.post("/", response_model=SavedLocationResponse, status_code=status.HTTP_201_CREATED)
def create_saved_location(
    payload: SavedLocationCreate,
    db: Session = Depends(get_db),
    current_admin: User = Depends(get_current_admin)
):
    """
    Create a new saved duty / parade location.
    Extracts coordinates from Google Maps link if direct lat/lng are not provided.
    """
    tenant = current_admin.tenant
    if not tenant:
        raise HTTPException(status_code=404, detail="Workspace not found")

    name = payload.name.strip()
    if not name:
        raise HTTPException(status_code=400, detail="Location name is required")

    latitude = payload.latitude
    longitude = payload.longitude
    maps_link = payload.maps_link.strip() if payload.maps_link else None

    # If coordinates not directly provided, try extracting from Google Maps link
    if (latitude is None or longitude is None) and maps_link:
        extracted = _extract_coordinates_from_maps_link(maps_link)
        if extracted:
            latitude, longitude = extracted
        else:
            raise HTTPException(
                status_code=400,
                detail="Could not extract coordinates from the Google Maps link. Please enter coordinates directly or paste a full Google Maps address bar URL."
            )

    if latitude is None or longitude is None:
        raise HTTPException(
            status_code=400,
            detail="Latitude and longitude coordinates are required (or a valid Google Maps link)."
        )

    if not -90 <= latitude <= 90 or not -180 <= longitude <= 180:
        raise HTTPException(status_code=400, detail="Invalid coordinates range")

    radius = payload.radius_meters or 100
    if radius < 10 or radius > 5000:
        raise HTTPException(status_code=400, detail="Radius must be between 10 and 5000 meters")

    # If setting as default, clear previous defaults for tenant
    is_default_int = 1 if payload.is_default else 0
    if is_default_int == 1:
        db.query(SavedLocation).filter(
            SavedLocation.tenant_id == tenant.id
        ).update({"is_default": 0})
        # Sync tenant geofence coordinates
        tenant.geofence_maps_link = maps_link
        tenant.geofence_latitude = latitude
        tenant.geofence_longitude = longitude
        tenant.geofence_radius_meters = radius

    # If this is the very first location for tenant, make it default automatically
    existing_count = db.query(SavedLocation).filter(SavedLocation.tenant_id == tenant.id).count()
    if existing_count == 0:
        is_default_int = 1
        tenant.geofence_maps_link = maps_link
        tenant.geofence_latitude = latitude
        tenant.geofence_longitude = longitude
        tenant.geofence_radius_meters = radius

    location = SavedLocation(
        tenant_id=tenant.id,
        name=name,
        maps_link=maps_link,
        latitude=latitude,
        longitude=longitude,
        radius_meters=radius,
        is_default=is_default_int
    )
    db.add(location)
    db.commit()
    db.refresh(location)

    return SavedLocationResponse(
        id=location.id,
        tenant_id=location.tenant_id,
        name=location.name,
        maps_link=location.maps_link,
        latitude=location.latitude,
        longitude=location.longitude,
        radius_meters=location.radius_meters,
        is_default=bool(location.is_default),
        created_at=location.created_at
    )


@router.put("/{location_id}", response_model=SavedLocationResponse)
def update_saved_location(
    location_id: int,
    payload: SavedLocationUpdate,
    db: Session = Depends(get_db),
    current_admin: User = Depends(get_current_admin)
):
    """
    Update an existing saved location.
    """
    tenant = current_admin.tenant
    if not tenant:
        raise HTTPException(status_code=404, detail="Workspace not found")

    location = db.query(SavedLocation).filter(
        SavedLocation.id == location_id,
        SavedLocation.tenant_id == tenant.id
    ).first()

    if not location:
        raise HTTPException(status_code=404, detail="Location not found")

    if payload.name is not None:
        name = payload.name.strip()
        if not name:
            raise HTTPException(status_code=400, detail="Location name cannot be empty")
        location.name = name

    if payload.maps_link is not None:
        maps_link = payload.maps_link.strip() or None
        location.maps_link = maps_link
        # If maps_link is updated and no new coords provided, attempt re-extraction
        if maps_link and payload.latitude is None and payload.longitude is None:
            extracted = _extract_coordinates_from_maps_link(maps_link)
            if extracted:
                location.latitude, location.longitude = extracted

    if payload.latitude is not None:
        if not -90 <= payload.latitude <= 90:
            raise HTTPException(status_code=400, detail="Invalid latitude")
        location.latitude = payload.latitude

    if payload.longitude is not None:
        if not -180 <= payload.longitude <= 180:
            raise HTTPException(status_code=400, detail="Invalid longitude")
        location.longitude = payload.longitude

    if payload.radius_meters is not None:
        if payload.radius_meters < 10 or payload.radius_meters > 5000:
            raise HTTPException(status_code=400, detail="Radius must be between 10 and 5000 meters")
        location.radius_meters = payload.radius_meters

    if payload.is_default is not None:
        if payload.is_default:
            db.query(SavedLocation).filter(
                SavedLocation.tenant_id == tenant.id
            ).update({"is_default": 0})
            location.is_default = 1
            # Sync tenant default
            tenant.geofence_maps_link = location.maps_link
            tenant.geofence_latitude = location.latitude
            tenant.geofence_longitude = location.longitude
            tenant.geofence_radius_meters = location.radius_meters
        else:
            location.is_default = 0

    db.commit()
    db.refresh(location)

    return SavedLocationResponse(
        id=location.id,
        tenant_id=location.tenant_id,
        name=location.name,
        maps_link=location.maps_link,
        latitude=location.latitude,
        longitude=location.longitude,
        radius_meters=location.radius_meters,
        is_default=bool(location.is_default),
        created_at=location.created_at
    )


@router.post("/{location_id}/set-default", response_model=SavedLocationResponse)
def set_default_location(
    location_id: int,
    db: Session = Depends(get_db),
    current_admin: User = Depends(get_current_admin)
):
    """
    Set a location as the default primary ground for the tenant.
    """
    tenant = current_admin.tenant
    if not tenant:
        raise HTTPException(status_code=404, detail="Workspace not found")

    location = db.query(SavedLocation).filter(
        SavedLocation.id == location_id,
        SavedLocation.tenant_id == tenant.id
    ).first()

    if not location:
        raise HTTPException(status_code=404, detail="Location not found")

    db.query(SavedLocation).filter(
        SavedLocation.tenant_id == tenant.id
    ).update({"is_default": 0})

    location.is_default = 1
    tenant.geofence_maps_link = location.maps_link
    tenant.geofence_latitude = location.latitude
    tenant.geofence_longitude = location.longitude
    tenant.geofence_radius_meters = location.radius_meters

    db.commit()
    db.refresh(location)

    return SavedLocationResponse(
        id=location.id,
        tenant_id=location.tenant_id,
        name=location.name,
        maps_link=location.maps_link,
        latitude=location.latitude,
        longitude=location.longitude,
        radius_meters=location.radius_meters,
        is_default=True,
        created_at=location.created_at
    )


@router.delete("/{location_id}")
def delete_saved_location(
    location_id: int,
    db: Session = Depends(get_db),
    current_admin: User = Depends(get_current_admin)
):
    """
    Delete a saved location.
    """
    tenant = current_admin.tenant
    if not tenant:
        raise HTTPException(status_code=404, detail="Workspace not found")

    location = db.query(SavedLocation).filter(
        SavedLocation.id == location_id,
        SavedLocation.tenant_id == tenant.id
    ).first()

    if not location:
        raise HTTPException(status_code=404, detail="Location not found")

    was_default = bool(location.is_default)
    db.delete(location)
    db.commit()

    # If deleted location was default, pick another location to be default if available
    if was_default:
        next_loc = db.query(SavedLocation).filter(
            SavedLocation.tenant_id == tenant.id
        ).first()
        if next_loc:
            next_loc.is_default = 1
            tenant.geofence_maps_link = next_loc.maps_link
            tenant.geofence_latitude = next_loc.latitude
            tenant.geofence_longitude = next_loc.longitude
            tenant.geofence_radius_meters = next_loc.radius_meters
            db.commit()

    return {"message": "Location deleted successfully"}
