import os
import shutil
import io
import csv
from datetime import datetime, timedelta, timezone
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
from sqlalchemy import func

from backend.database.database import get_db
from backend.models.models import Attendance, User, AttendanceStatus, Shift, DailyRoaster
from backend.schemas.schemas import AttendanceResponse
from backend.auth.dependencies import get_current_user, get_current_admin

router = APIRouter(
    prefix="/attendance",
    tags=["Attendance"]
)

UPLOAD_DIR = "static/images"
os.makedirs(UPLOAD_DIR, exist_ok=True)

@router.post("/mark", response_model=AttendanceResponse)
def mark_attendance(
    latitude: float = Form(...),
    longitude: float = Form(...),
    device_info: str = Form(...),
    photo: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    today_str = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    
    # Check if already marked
    existing = db.query(Attendance).filter(
        Attendance.user_id == current_user.id,
        Attendance.date == today_str
    ).first()
    
    if existing:
        raise HTTPException(status_code=400, detail="Attendance already recorded")

    # Save photo
    timestamp_str = datetime.now(timezone.utc).strftime("%Y%m%d%H%M%S")
    filename = f"{current_user.employee_id}_{timestamp_str}_{photo.filename}"
    file_path = os.path.join(UPLOAD_DIR, filename)

    with open(file_path, "wb") as buffer:
        shutil.copyfileobj(photo.file, buffer)
        
    photo_url = f"/static/images/{filename}"

    # Determine LATE or PRESENT based on DailyRoaster
    status = AttendanceStatus.PRESENT
    roaster = db.query(DailyRoaster).filter(
        DailyRoaster.user_id == current_user.id,
        DailyRoaster.date == today_str
    ).first()

    if roaster:
        if roaster.is_leave:
            raise HTTPException(status_code=400, detail="You are marked as ON LEAVE for today.")
        
        if roaster.start_time:
            now_time = datetime.now(timezone.utc).time()
            # Calculate shift start + grace period (default 15 mins since Shift model is deprecated)
            shift_start_dt = datetime.combine(datetime.today(), roaster.start_time)
            grace_td = timedelta(minutes=15)
            allowed_time = (shift_start_dt + grace_td).time()
            
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

@router.get("/history", response_model=List[AttendanceResponse])
def get_attendance_history(skip: int = 0, limit: int = 100, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    return db.query(Attendance).filter(Attendance.user_id == current_user.id).order_by(Attendance.created_at.desc()).offset(skip).limit(limit).all()

@router.get("/records", response_model=List[AttendanceResponse], dependencies=[Depends(get_current_admin)])
def get_attendance_records(
    date: Optional[str] = None,
    employee_id: Optional[str] = None,
    shift_id: Optional[int] = None,
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db)
):
    query = db.query(Attendance).join(User)
    
    if date:
        query = query.filter(Attendance.date == date)
    if employee_id:
        query = query.filter(User.employee_id == employee_id)
    if shift_id:
        query = query.filter(User.shift_id == shift_id)
        
    return query.order_by(Attendance.created_at.desc()).offset(skip).limit(limit).all()

@router.get("/export", dependencies=[Depends(get_current_admin)])
def export_attendance_csv(
    date: Optional[str] = None,
    employee_id: Optional[str] = None,
    shift_id: Optional[int] = None,
    db: Session = Depends(get_db)
):
    query = db.query(Attendance).join(User)
    
    if date:
        query = query.filter(Attendance.date == date)
    if employee_id:
        query = query.filter(User.employee_id == employee_id)
    if shift_id:
        query = query.filter(User.shift_id == shift_id)
        
    records = query.order_by(Attendance.created_at.desc()).all()

    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow(["Employee Name", "Employee ID", "Date", "Time", "Status", "Latitude", "Longitude", "Device"])

    for r in records:
        writer.writerow([
            r.user.name,
            r.user.employee_id,
            r.date,
            r.check_in_time.strftime("%H:%M:%S"),
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
