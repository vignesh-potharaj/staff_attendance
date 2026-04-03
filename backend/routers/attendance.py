import os
import shutil
import io
import csv
import logging
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
from backend.services.google_drive import get_google_drive_manager

logger = logging.getLogger(__name__)

router = APIRouter(
    prefix="/attendance",
    tags=["Attendance"]
)

# Local fallback directory (in case Google Drive is not available)
UPLOAD_DIR = "static/images"
os.makedirs(UPLOAD_DIR, exist_ok=True)

def upload_photo_to_drive(
    file_content: bytes,
    filename: str
) -> Optional[str]:
    """
    Upload photo to Google Drive and return shareable link.
    Falls back to local storage if Google Drive is unavailable.
    """
    try:
        logger.info(f"🔄 Attempting to upload '{filename}' to Google Drive...")
        drive_manager = get_google_drive_manager()
        logger.info(f"✅ Google Drive manager initialized")
        photo_url = drive_manager.upload_file(file_content, filename)
        if photo_url:
            logger.info(f"✅ Photo uploaded to Google Drive: {filename}")
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

    # Save photo
    timestamp_str = datetime.now(IST).strftime("%Y%m%d%H%M%S")
    filename = f"{current_user.employee_id}_{timestamp_str}_{photo.filename}"
    
    # Read file content
    file_content = photo.file.read()
    
    # Try to upload to Google Drive first
    photo_url = upload_photo_to_drive(file_content, filename)
    
    # If Google Drive fails, fall back to local storage
    if not photo_url:
        file_path = os.path.join(UPLOAD_DIR, filename)
        with open(file_path, "wb") as buffer:
            buffer.write(file_content)
        photo_url = f"/static/images/{filename}"
        logger.info(f"Photo saved to local storage: {photo_url}")

    # Determine LATE or PRESENT based on DailyRoaster
    status = AttendanceStatus.PRESENT
    roaster = db.query(DailyRoaster).filter(
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

    # Save check-out photo
    timestamp_str = datetime.now(IST).strftime("%Y%m%d%H%M%S")
    filename = f"{current_user.employee_id}_{timestamp_str}_checkout_{photo.filename}"
    
    # Read file content
    file_content = photo.file.read()
    
    # Try to upload to Google Drive first
    check_out_photo_url = upload_photo_to_drive(file_content, filename)
    
    # If Google Drive fails, fall back to local storage
    if not check_out_photo_url:
        file_path = os.path.join(UPLOAD_DIR, filename)
        with open(file_path, "wb") as buffer:
            buffer.write(file_content)
        check_out_photo_url = f"/static/images/{filename}"
        logger.info(f"Check-out photo saved to local storage: {check_out_photo_url}")

    # Assign to instance attributes, not class attributes
    setattr(existing, 'check_out_time', datetime.now(IST))
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
    db: Session = Depends(get_db)
):
    query = db.query(Attendance).join(User)
    
    if date:
        query = query.filter(Attendance.date == date)
    if employee_id:
        query = query.filter(User.employee_id == employee_id)
        
    return query.order_by(Attendance.created_at.desc()).offset(skip).limit(limit).all()

@router.get("/export", dependencies=[Depends(get_current_admin)])
def export_attendance_csv(
    date: Optional[str] = None,
    employee_id: Optional[str] = None,
    db: Session = Depends(get_db)
):
    query = db.query(Attendance).join(User)
    
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
