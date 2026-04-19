import os
import shutil
import io
import csv
import logging
import math
from datetime import datetime, timedelta, timezone
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
from sqlalchemy import func

from backend.database.database import get_db
from backend.models.models import Attendance, User, AttendanceStatus, DailyRoaster, IST
from backend.schemas.schemas import AttendanceResponse
from backend.auth.dependencies import get_current_user, get_current_admin
from backend.services.cloudinary_storage import get_cloudinary_manager

logger = logging.getLogger(__name__)

router = APIRouter(
    prefix="/attendance",
    tags=["Attendance"]
)

# Local fallback directory (in case Cloudinary is not available)
UPLOAD_DIR = "static/images"
os.makedirs(UPLOAD_DIR, exist_ok=True)

# Get backend URL from environment variable (for absolute URLs in database)
# Format: https://my-app.onrender.com or http://localhost:8000
BACKEND_URL = os.getenv("BACKEND_URL", "http://localhost:8000").rstrip("/")


def distance_in_meters(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    earth_radius_meters = 6371000
    lat1_rad = math.radians(lat1)
    lat2_rad = math.radians(lat2)
    delta_lat = math.radians(lat2 - lat1)
    delta_lon = math.radians(lon2 - lon1)

    a = (
        math.sin(delta_lat / 2) ** 2
        + math.cos(lat1_rad) * math.cos(lat2_rad) * math.sin(delta_lon / 2) ** 2
    )
    c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))
    return earth_radius_meters * c


def enforce_geofence(latitude: float, longitude: float, current_user: User):
    tenant = current_user.tenant
    if not tenant or tenant.geofence_latitude is None or tenant.geofence_longitude is None:
        return

    radius = tenant.geofence_radius_meters or 100
    distance = distance_in_meters(
        latitude,
        longitude,
        tenant.geofence_latitude,
        tenant.geofence_longitude,
    )
    if distance > radius:
        raise HTTPException(
            status_code=403,
            detail=f"You are {round(distance)} meters away from the allowed attendance location. Please mark attendance within {radius} meters.",
        )

def upload_photo_to_cloudinary(
    file_content: bytes,
    filename: str
) -> Optional[str]:
    """
    Upload photo to Cloudinary and return secure URL.
    Falls back to local storage if Cloudinary is unavailable.
    """
    try:
        logger.info(f"🔄 Attempting to upload '{filename}' to Cloudinary...")
        cloudinary_manager = get_cloudinary_manager()
        logger.info(f"✅ Cloudinary manager initialized")
        photo_url = cloudinary_manager.upload_file(file_content, filename)
        if photo_url:
            logger.info(f"✅ Photo uploaded to Cloudinary: {filename}")
            return photo_url
        else:
            logger.warning(f"⚠️  Google Drive returned no URL for {filename}, falling back to local storage")
    except Exception as e:
        logger.error(f"❌ Google Drive upload failed for '{filename}': {type(e).__name__}: {str(e)}", exc_info=True)
        logger.warning(f"⚠️  Falling back to local storage for {filename}")
    
    # Fallback to local storage
    return None

@router.post("/mark", response_model=AttendanceResponse)
def mark_attendance(
    latitude: float = Form(...),
    longitude: float = Form(...),
    device_info: str = Form(...),
    photo: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    today_str = datetime.now(IST).strftime("%Y-%m-%d")
    
    # Check if already marked
    existing = db.query(Attendance).filter(
        Attendance.user_id == current_user.id,
        Attendance.date == today_str
    ).first()
    
    if existing:
        raise HTTPException(status_code=400, detail="Attendance already recorded")

    enforce_geofence(latitude, longitude, current_user)

    # Save photo
    timestamp_str = datetime.now(IST).strftime("%Y%m%d%H%M%S")
    filename = f"{current_user.employee_id}_{timestamp_str}_{photo.filename}"
    
    # Read file content
    file_content = photo.file.read()
    
    # Try to upload to Cloudinary first
    photo_url = upload_photo_to_cloudinary(file_content, filename)
    
    # If Cloudinary fails, fall back to local storage
    if not photo_url:
        file_path = os.path.join(UPLOAD_DIR, filename)
        with open(file_path, "wb") as buffer:
            buffer.write(file_content)
        # Use absolute URL for database (so photos work on deployed Render)
        photo_url = f"{BACKEND_URL}/static/images/{filename}"
        logger.info(f"Photo saved to local storage: {photo_url}")

    # Determine LATE or PRESENT based on DailyRoaster
    status = AttendanceStatus.PRESENT
    roaster = db.query(DailyRoaster).filter(
        DailyRoaster.tenant_id == current_user.tenant_id,
        DailyRoaster.user_id == current_user.id,
        DailyRoaster.date == today_str
    ).first()

    if roaster:
        # Use instance values, not Column objects or ColumnElement
        is_leave_val = getattr(roaster, 'is_leave', 0)
        if isinstance(is_leave_val, int) and is_leave_val == 1:
            raise HTTPException(status_code=400, detail="You are marked as ON LEAVE for today.")
        start_time_val = getattr(roaster, 'start_time', None)
        if start_time_val is not None:
            now_time = datetime.now(IST).time()
            current_date = datetime.now(IST).date()
            shift_start_dt = datetime.combine(current_date, start_time_val)
            grace_td = timedelta(minutes=15)
            allowed_time = (shift_start_dt + grace_td).time()
            if now_time > allowed_time:
                status = AttendanceStatus.LATE
    else:
        # Default behavior if no roaster entry exists: assume 10:00 AM start
        now_time = datetime.now(IST).time()
        current_date = datetime.now(IST).date()
        default_start = datetime.combine(current_date, datetime.strptime("10:00", "%H:%M").time())
        allowed_time = (default_start + timedelta(minutes=15)).time()
        if now_time > allowed_time:
            status = AttendanceStatus.LATE
                
    new_attendance = Attendance(
        tenant_id=current_user.tenant_id,
        user_id=current_user.id,
        date=today_str,
        photo_url=photo_url,
        latitude=latitude,
        longitude=longitude,
        status=status,
        device_info=device_info
    )
    
    db.add(new_attendance)
    db.commit()
    db.refresh(new_attendance)
    
    return new_attendance

@router.post("/check-out", response_model=AttendanceResponse)
def check_out_attendance(
    latitude: float = Form(...),
    longitude: float = Form(...),
    device_info: str = Form(...),
    photo: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    today_str = datetime.now(IST).strftime("%Y-%m-%d")
    
    # Check if already marked for today
    existing = db.query(Attendance).filter(
        Attendance.user_id == current_user.id,
        Attendance.date == today_str
    ).first()
    
    if not existing:
        raise HTTPException(status_code=400, detail="You must check in first before checking out.")

    if getattr(existing, 'check_out_time', None) is not None:
        raise HTTPException(status_code=400, detail="You have already checked out for today.")

    enforce_geofence(latitude, longitude, current_user)

    # Save check-out photo
    timestamp_str = datetime.now(IST).strftime("%Y%m%d%H%M%S")
    filename = f"{current_user.employee_id}_{timestamp_str}_checkout_{photo.filename}"
    
    # Read file content
    file_content = photo.file.read()
    
    # Try to upload to Cloudinary first
    check_out_photo_url = upload_photo_to_cloudinary(file_content, filename)
    
    # If Cloudinary fails, fall back to local storage
    if not check_out_photo_url:
        file_path = os.path.join(UPLOAD_DIR, filename)
        with open(file_path, "wb") as buffer:
            buffer.write(file_content)
        # Use absolute URL for database (so photos work on deployed Render)
        check_out_photo_url = f"{BACKEND_URL}/static/images/{filename}"
        logger.info(f"Check-out photo saved to local storage: {check_out_photo_url}")

    # Assign to instance attributes, not class attributes
    setattr(existing, 'check_out_time', datetime.now(IST).replace(tzinfo=None))
    setattr(existing, 'check_out_photo_url', check_out_photo_url)
    db.commit()
    db.refresh(existing)
    
    return existing

@router.get("/history", response_model=List[AttendanceResponse])
def get_attendance_history(skip: int = 0, limit: int = 100, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    return db.query(Attendance).filter(Attendance.user_id == current_user.id).order_by(Attendance.created_at.desc()).offset(skip).limit(limit).all()

@router.get("/records", response_model=List[AttendanceResponse], dependencies=[Depends(get_current_admin)])
def get_attendance_records(
    date: Optional[str] = None,
    employee_id: Optional[str] = None,
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db),
    current_admin: User = Depends(get_current_admin)
):
    query = db.query(Attendance).join(User).filter(Attendance.tenant_id == current_admin.tenant_id)
    
    if date:
        query = query.filter(Attendance.date == date)
    if employee_id:
        query = query.filter(User.employee_id == employee_id)
        
    return query.order_by(Attendance.created_at.desc()).offset(skip).limit(limit).all()

@router.get("/export", dependencies=[Depends(get_current_admin)])
def export_attendance_csv(
    date: Optional[str] = None,
    employee_id: Optional[str] = None,
    db: Session = Depends(get_db),
    current_admin: User = Depends(get_current_admin)
):
    query = db.query(Attendance).join(User).filter(Attendance.tenant_id == current_admin.tenant_id)
    
    if date:
        query = query.filter(Attendance.date == date)
    if employee_id:
        query = query.filter(User.employee_id == employee_id)
        
    records = query.order_by(Attendance.created_at.desc()).all()

    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow(["Employee Name", "Employee ID", "Date", "Check In Time", "Check Out Time", "Status", "Latitude", "Longitude", "Device"])

    for r in records:
        check_out_str = r.check_out_time.strftime("%H:%M:%S") if getattr(r, 'check_out_time', None) else "N/A"
        writer.writerow([
            r.user.name,
            r.user.employee_id,
            r.date,
            r.check_in_time.strftime("%H:%M:%S"),
            check_out_str,
            r.status,
            r.latitude,
            r.longitude,
            r.device_info
        ])

    output.seek(0)
    return StreamingResponse(
        iter([output.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": f"attachment; filename=attendance_{date or 'all'}.csv"}
    )
