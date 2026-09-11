import os
import shutil
import io
import csv
import logging
import math
from datetime import datetime, timedelta, timezone
from typing import List, Optional, Set
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
from sqlalchemy import func

from backend.database.database import get_db
from backend.models.models import Attendance, User, AttendanceStatus, DailyRoaster, AttendanceSession, SavedLocation, IST, RoleEnum
from backend.schemas.schemas import AttendanceResponse
from backend.auth.dependencies import get_current_user, get_current_admin
from backend.services.cloudinary_storage import get_cloudinary_manager, compress_image_bytes

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
    earth_radius_meters = 6371000.0
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


def enforce_geofence(
    latitude: float,
    longitude: float,
    current_user: User,
    db: Session,
    active_session: Optional[AttendanceSession] = None,
    today_str: Optional[str] = None
):
    tenant = current_user.tenant
    target_lat = None
    target_lng = None
    target_radius = 100
    location_name = "Session Ground"

    if today_str is None:
        today_str = datetime.now(IST).strftime("%Y-%m-%d")

    # 1. Check if cadet has a specific DailyRoaster location assigned for today
    cadet_roaster = db.query(DailyRoaster).filter(
        DailyRoaster.user_id == current_user.id,
        DailyRoaster.date == today_str
    ).first()

    if cadet_roaster and cadet_roaster.location_id:
        loc = db.query(SavedLocation).filter(SavedLocation.id == cadet_roaster.location_id).first()
        if loc:
            target_lat = loc.latitude
            target_lng = loc.longitude
            target_radius = loc.radius_meters or 100
            location_name = loc.name

    # 2. Check if active session has a location assigned
    if target_lat is None and active_session and active_session.location_id:
        loc = db.query(SavedLocation).filter(SavedLocation.id == active_session.location_id).first()
        if loc:
            target_lat = loc.latitude
            target_lng = loc.longitude
            target_radius = loc.radius_meters or 100
            location_name = loc.name

    # 3. Check if tenant has a default SavedLocation
    if target_lat is None and tenant:
        default_loc = db.query(SavedLocation).filter(
            SavedLocation.tenant_id == tenant.id,
            SavedLocation.is_default == 1
        ).first()
        if default_loc:
            target_lat = default_loc.latitude
            target_lng = default_loc.longitude
            target_radius = default_loc.radius_meters or 100
            location_name = default_loc.name

    # 4. Fallback to tenant geofence coordinates
    if target_lat is None and tenant and tenant.geofence_latitude is not None and tenant.geofence_longitude is not None:
        target_lat = tenant.geofence_latitude
        target_lng = tenant.geofence_longitude
        target_radius = tenant.geofence_radius_meters or 100
        location_name = "Unit Parade Ground"

    # If no coordinates defined at all, skip check
    if target_lat is None or target_lng is None:
        return

    distance = distance_in_meters(
        latitude,
        longitude,
        target_lat,
        target_lng,
    )

    if distance > target_radius:
        raise HTTPException(
            status_code=403,
            detail=f"You are {round(distance)} meters away from '{location_name}'. Please mark attendance within {target_radius} meters.",
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
    latitude: Optional[float] = Form(None),
    longitude: Optional[float] = Form(None),
    device_info: str = Form(...),
    photo: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    today_str = datetime.now(IST).strftime("%Y-%m-%d")

    # Verify there is an active parade/drill session for today
    active_session = db.query(AttendanceSession).filter(
        AttendanceSession.tenant_id == current_user.tenant_id,
        AttendanceSession.date == today_str,
        AttendanceSession.is_active == 1
    ).first()

    if not active_session:
        raise HTTPException(
            status_code=400,
            detail="No active parade/drill session for today. Fall-in is closed until an instructor activates a session in the Roaster."
        )
    
    # Check if already marked
    existing = db.query(Attendance).filter(
        Attendance.user_id == current_user.id,
        Attendance.date == today_str
    ).first()
    
    if existing:
        raise HTTPException(status_code=400, detail="Attendance already recorded")

    # Check cadet daily roaster if assigned
    roaster = db.query(DailyRoaster).filter(
        DailyRoaster.tenant_id == current_user.tenant_id,
        DailyRoaster.user_id == current_user.id,
        DailyRoaster.date == today_str
    ).first()

    if roaster:
        is_leave_val = getattr(roaster, 'is_leave', 0)
        if isinstance(is_leave_val, int) and is_leave_val == 1:
            raise HTTPException(status_code=400, detail="You are marked as ON LEAVE for today.")

    # Visarjan Cut-Off: Cadets can mark attendance before fall-in and up until visarjan time, but NOT after visarjan time.
    visarjan_time = None
    if roaster and getattr(roaster, 'end_time', None) is not None:
        visarjan_time = getattr(roaster, 'end_time')
    elif active_session and active_session.end_time is not None:
        visarjan_time = active_session.end_time

    if visarjan_time is not None:
        now_time = datetime.now(IST).time()
        if now_time > visarjan_time:
            visarjan_str = visarjan_time.strftime("%I:%M %p")
            raise HTTPException(
                status_code=400,
                detail=f"Parade / drill session has concluded. Visarjan time was {visarjan_str}. Fall-in attendance can no longer be marked."
            )

    require_loc = bool(getattr(active_session, "require_location", 1))
    if require_loc:
        if latitude is None or longitude is None or (latitude == 0.0 and longitude == 0.0):
            raise HTTPException(
                status_code=400,
                detail="Location verification is required for this session. Please allow GPS location permissions."
            )
        enforce_geofence(latitude, longitude, current_user, db, active_session, today_str)

    # Save photo
    timestamp_str = datetime.now(IST).strftime("%Y%m%d%H%M%S")
    filename = f"{current_user.employee_id}_{timestamp_str}_{photo.filename}"
    
    # Read file content
    file_content = photo.file.read()
    
    # Try to upload to Cloudinary first
    photo_url = upload_photo_to_cloudinary(file_content, filename)
    
    # If Cloudinary fails, fall back to local storage
    if not photo_url:
        compressed_content = compress_image_bytes(file_content, max_dim=800, quality=60)
        file_path = os.path.join(UPLOAD_DIR, filename)
        with open(file_path, "wb") as buffer:
            buffer.write(compressed_content)
        # Use absolute URL for database (so photos work on deployed Render)
        photo_url = f"{BACKEND_URL}/static/images/{filename}"
        logger.info(f"Photo saved to local storage (compressed): {photo_url}")

    # Determine LATE or PRESENT based on DailyRoaster or active session
    status = AttendanceStatus.PRESENT
    if roaster and getattr(roaster, 'start_time', None) is not None:
        now_time = datetime.now(IST).time()
        current_date = datetime.now(IST).date()
        shift_start_dt = datetime.combine(current_date, roaster.start_time)
        if now_time > shift_start_dt.time():
            status = AttendanceStatus.LATE
    elif active_session and active_session.start_time is not None:
        now_time = datetime.now(IST).time()
        current_date = datetime.now(IST).date()
        shift_start_dt = datetime.combine(current_date, active_session.start_time)
        allowed_time = shift_start_dt.time()
        if now_time > allowed_time:
            status = AttendanceStatus.LATE
    else:
        # Default NCC morning parade fallback: 07:00 AM start
        now_time = datetime.now(IST).time()
        current_date = datetime.now(IST).date()
        default_start = datetime.combine(current_date, datetime.strptime("07:00", "%H:%M").time())
        allowed_time = default_start.time()
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

    # Trigger admin alert push notification if LATE
    if status == AttendanceStatus.LATE:
        try:
            from backend.services.push_service import send_push_to_tenant_admins
            send_push_to_tenant_admins(
                db=db,
                tenant_id=current_user.tenant_id,
                title="Late Check-in Alert ⚠️",
                body=f"Staff member {current_user.name} ({current_user.employee_id}) checked in LATE for today.",
                url="/admin/attendance"
            )
        except Exception as push_err:
            logger.warning(f"Failed to send admin push alert for late check-in: {push_err}")

    populate_expected_fall_in_time([new_attendance], db)
    return new_attendance

@router.post("/check-out", response_model=AttendanceResponse)
def check_out_attendance(
    latitude: Optional[float] = Form(None),
    longitude: Optional[float] = Form(None),
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

    active_session = db.query(AttendanceSession).filter(
        AttendanceSession.tenant_id == current_user.tenant_id,
        AttendanceSession.date == today_str,
        AttendanceSession.is_active == 1
    ).first()
    require_loc = bool(getattr(active_session, "require_location", 1)) if active_session else True
    if require_loc:
        if latitude is None or longitude is None or (latitude == 0.0 and longitude == 0.0):
            raise HTTPException(
                status_code=400,
                detail="Location verification is required for this session. Please allow GPS location permissions."
            )
        enforce_geofence(latitude, longitude, current_user, db, active_session, today_str)

    # Save check-out photo
    timestamp_str = datetime.now(IST).strftime("%Y%m%d%H%M%S")
    filename = f"{current_user.employee_id}_{timestamp_str}_checkout_{photo.filename}"
    
    # Read file content
    file_content = photo.file.read()
    
    # Try to upload to Cloudinary first
    check_out_photo_url = upload_photo_to_cloudinary(file_content, filename)
    
    # If Cloudinary fails, fall back to local storage
    if not check_out_photo_url:
        compressed_content = compress_image_bytes(file_content, max_dim=800, quality=60)
        file_path = os.path.join(UPLOAD_DIR, filename)
        with open(file_path, "wb") as buffer:
            buffer.write(compressed_content)
        # Use absolute URL for database (so photos work on deployed Render)
        check_out_photo_url = f"{BACKEND_URL}/static/images/{filename}"
        logger.info(f"Check-out photo saved to local storage (compressed): {check_out_photo_url}")

    # Assign to instance attributes, not class attributes
    setattr(existing, 'check_out_time', datetime.now(IST).replace(tzinfo=None))
    setattr(existing, 'check_out_photo_url', check_out_photo_url)
    db.commit()
    db.refresh(existing)

    # Trigger admin alert push notification on check-out
    try:
        from backend.services.push_service import send_push_to_tenant_admins
        send_push_to_tenant_admins(
            db=db,
            tenant_id=current_user.tenant_id,
            title="Check-Out Alert 🏁",
            body=f"{current_user.name} ({current_user.employee_id}) completed check-out for today.",
            url="/admin/attendance"
        )
    except Exception as push_err:
        logger.warning(f"Failed to send admin push alert for check-out: {push_err}")

    populate_expected_fall_in_time([existing], db)
    return existing

def populate_expected_fall_in_time(records: List[Attendance], db: Session):
    if not records:
        return
    user_ids = {r.user_id for r in records if getattr(r, 'user_id', None)}
    dates = {r.date for r in records if getattr(r, 'date', None)}
    if not user_ids or not dates:
        return
    
    roasters = db.query(DailyRoaster).filter(
        DailyRoaster.user_id.in_(user_ids),
        DailyRoaster.date.in_(dates)
    ).all()

    sessions = db.query(AttendanceSession).filter(
        AttendanceSession.date.in_(dates)
    ).all()
    
    roaster_map = {(r.user_id, r.date): r for r in roasters}
    session_map = {s.date: s for s in sessions}
    
    for r in records:
        user_id = getattr(r, 'user_id', None)
        date_str = getattr(r, 'date', None)
        roaster = roaster_map.get((user_id, date_str)) if user_id and date_str else None
        session = session_map.get(date_str) if date_str else None
        
        st = None
        if roaster and getattr(roaster, 'start_time', None) is not None:
            st = getattr(roaster, 'start_time')
        elif session and getattr(session, 'start_time', None) is not None:
            st = getattr(session, 'start_time')

        if st is not None:
            if isinstance(st, str):
                try:
                    parts = st.split(":")
                    h, m = int(parts[0]), int(parts[1])
                    ampm = "AM" if h < 12 else "PM"
                    h12 = h % 12 or 12
                    st_str = f"{h12:02d}:{m:02d} {ampm}"
                except Exception:
                    st_str = st
            else:
                try:
                    st_str = st.strftime("%I:%M %p")
                except Exception:
                    st_str = str(st)
        else:
            st_str = "07:00 AM"
            
        setattr(r, 'expected_fall_in_time', st_str)

@router.get("/history", response_model=List[AttendanceResponse])
def get_attendance_history(skip: int = 0, limit: int = 100, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    records = db.query(Attendance).filter(Attendance.user_id == current_user.id).order_by(Attendance.created_at.desc()).offset(skip).limit(limit).all()
    populate_expected_fall_in_time(records, db)
    return records

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
        
    records = query.order_by(Attendance.created_at.desc()).offset(skip).limit(limit).all()
    populate_expected_fall_in_time(records, db)
    return records

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
    populate_expected_fall_in_time(records, db)

    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow(["Cadet Name", "Cadet Regt ID", "Date", "Expected Fall-In", "Fall-In Time", "Visarjan Time", "Status", "Latitude", "Longitude", "Device"])

    for r in records:
        check_out_str = r.check_out_time.strftime("%H:%M:%S") if getattr(r, 'check_out_time', None) else "N/A"
        status_str = r.status.value if hasattr(r.status, 'value') else str(r.status)
        writer.writerow([
            r.user.name,
            r.user.employee_id,
            r.date,
            getattr(r, 'expected_fall_in_time', '07:00 AM'),
            r.check_in_time.strftime("%H:%M:%S"),
            check_out_str,
            status_str,
            r.latitude,
            r.longitude,
            r.device_info
        ])

    output.seek(0)
    filename_part = f"{employee_id}_{date}" if (employee_id and date) else (employee_id or date or "all")
    return StreamingResponse(
        iter([output.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": f"attachment; filename=attendance_{filename_part}.csv"}
    )

def get_tenant_session_dates(db: Session, tenant_id: int, month_prefix: Optional[str] = None) -> Set[str]:
    """
    Returns the set of unique session dates conducted or currently active for a tenant.
    Includes:
    1. Past dates (< today) where an AttendanceSession was scheduled.
    2. Past dates (< today) where attendance was recorded (covers legacy/ad-hoc sessions).
    3. Today (= today) if a session is currently active OR if attendance has been marked today.
    """
    now = datetime.now(IST)
    today_str = now.strftime("%Y-%m-%d")

    # 1. Past session dates from AttendanceSession (date < today_str)
    session_query = db.query(AttendanceSession.date).filter(
        AttendanceSession.tenant_id == tenant_id,
        AttendanceSession.date < today_str
    )
    if month_prefix:
        session_query = session_query.filter(AttendanceSession.date.startswith(month_prefix))
    past_session_dates = {s.date for s in session_query.all() if s.date}

    # 2. Past attendance dates from Attendance table (date < today_str)
    attendance_query = db.query(Attendance.date).filter(
        Attendance.tenant_id == tenant_id,
        Attendance.date < today_str
    )
    if month_prefix:
        attendance_query = attendance_query.filter(Attendance.date.startswith(month_prefix))
    past_attendance_dates = {a.date for a in attendance_query.all() if a.date}

    valid_dates = past_session_dates | past_attendance_dates

    # 3. Check today: Count today if session is active OR if attendance was marked today
    if not month_prefix or today_str.startswith(month_prefix):
        today_active_session = db.query(AttendanceSession).filter(
            AttendanceSession.tenant_id == tenant_id,
            AttendanceSession.date == today_str,
            AttendanceSession.is_active == 1
        ).first()

        has_attendance_today = db.query(Attendance.id).filter(
            Attendance.tenant_id == tenant_id,
            Attendance.date == today_str
        ).first() is not None

        if today_active_session or has_attendance_today:
            valid_dates.add(today_str)

    return valid_dates


@router.get("/export/monthly", dependencies=[Depends(get_current_admin)])
def export_monthly_summary_csv(
    month: Optional[str] = None,  # YYYY-MM
    employee_id: Optional[str] = None,
    db: Session = Depends(get_db),
    current_admin: User = Depends(get_current_admin)
):
    if not month:
        month = datetime.now(IST).strftime("%Y-%m")
        
    user_query = db.query(User).filter(
        User.tenant_id == current_admin.tenant_id,
        User.role == RoleEnum.STAFF
    )
    if employee_id:
        user_query = user_query.filter(User.employee_id == employee_id)
        
    cadets = user_query.order_by(User.name.asc()).all()

    # Unique session dates in this month for the tenant (including today if active)
    month_session_dates = get_tenant_session_dates(db, current_admin.tenant_id, month)
    tenant_session_dates_count = len(month_session_dates)

    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow([
        "Cadet Name",
        "Cadet Regt ID",
        "Month",
        "Total Days",
        "Present",
        "Absent",
        "Late Arrivals",
        "Attendance Percentage"
    ])

    for cadet in cadets:
        cadet_records = db.query(Attendance).filter(
            Attendance.tenant_id == current_admin.tenant_id,
            Attendance.user_id == cadet.id,
            Attendance.date.like(f"{month}%")
        ).all()
        
        cadet_dates = {r.date for r in cadet_records}
        total_days = max(tenant_session_dates_count, len(cadet_dates))
        
        present_count = sum(1 for r in cadet_records if r.status in [AttendanceStatus.PRESENT, AttendanceStatus.LATE])
        late_count = sum(1 for r in cadet_records if r.status == AttendanceStatus.LATE)
        absent_count = max(0, total_days - present_count)
        
        pct = (present_count / total_days * 100.0) if total_days > 0 else 0.0
        pct_str = f"{pct:.2f}%"

        writer.writerow([
            cadet.name,
            cadet.employee_id,
            month,
            total_days,
            present_count,
            absent_count,
            late_count,
            pct_str
        ])

    output.seek(0)
    return StreamingResponse(
        iter([output.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": f"attachment; filename=attendance_monthly_{month}.csv"}
    )

@router.get("/export/total", dependencies=[Depends(get_current_admin)])
def export_total_summary_csv(
    employee_id: Optional[str] = None,
    db: Session = Depends(get_db),
    current_admin: User = Depends(get_current_admin)
):
    user_query = db.query(User).filter(
        User.tenant_id == current_admin.tenant_id,
        User.role == RoleEnum.STAFF
    )
    if employee_id:
        user_query = user_query.filter(User.employee_id == employee_id)
        
    cadets = user_query.order_by(User.name.asc()).all()

    # Unique session dates across all time for tenant (including today if active)
    overall_session_dates = get_tenant_session_dates(db, current_admin.tenant_id)
    tenant_session_dates_count = len(overall_session_dates)

    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow([
        "Cadet Name",
        "Cadet Regt ID",
        "Total Days",
        "Present",
        "Absent",
        "Late Arrivals",
        "Attendance Percentage"
    ])

    for cadet in cadets:
        cadet_records = db.query(Attendance).filter(
            Attendance.tenant_id == current_admin.tenant_id,
            Attendance.user_id == cadet.id
        ).all()
        
        cadet_dates = {r.date for r in cadet_records}
        total_days = max(tenant_session_dates_count, len(cadet_dates))
        
        present_count = sum(1 for r in cadet_records if r.status in [AttendanceStatus.PRESENT, AttendanceStatus.LATE])
        late_count = sum(1 for r in cadet_records if r.status == AttendanceStatus.LATE)
        absent_count = max(0, total_days - present_count)
        
        pct = (present_count / total_days * 100.0) if total_days > 0 else 0.0
        pct_str = f"{pct:.2f}%"

        writer.writerow([
            cadet.name,
            cadet.employee_id,
            total_days,
            present_count,
            absent_count,
            late_count,
            pct_str
        ])

    output.seek(0)
    return StreamingResponse(
        iter([output.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": f"attachment; filename=attendance_total_summary.csv"}
    )


@router.get("/staff/{staff_id}/summary")
def get_staff_attendance_summary(
    staff_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Returns cadet session drill attendance analytics:
    - month_present_days, overall_present_days
    - month_total_sessions, overall_total_sessions
    - month_attendance_pct, overall_attendance_pct
    - month_late_count, overall_late_count
    - month_absent_count, overall_absent_count
    - today: today's fall-in/visarjan status
    """
    if current_user.role != RoleEnum.ADMIN and current_user.id != staff_id:
        raise HTTPException(status_code=403, detail="Not authorized to view this staff member's attendance.")

    target_user = db.query(User).filter(
        User.id == staff_id,
        User.tenant_id == current_user.tenant_id
    ).first()
    if not target_user:
        raise HTTPException(status_code=404, detail="Cadet not found in this unit.")

    now = datetime.now(IST)
    today_str = now.strftime("%Y-%m-%d")
    month_prefix = now.strftime("%Y-%m")

    valid_statuses = [AttendanceStatus.PRESENT, AttendanceStatus.LATE]

    cadet_records = db.query(Attendance).filter(
        Attendance.user_id == staff_id,
        Attendance.tenant_id == current_user.tenant_id,
        Attendance.status.in_(valid_statuses)
    ).all()

    cadet_overall_present_dates = {r.date for r in cadet_records if r.date}
    cadet_month_present_dates = {r.date for r in cadet_records if r.date and r.date.startswith(month_prefix)}

    overall_present_days = len(cadet_overall_present_dates)
    month_present_days = len(cadet_month_present_dates)

    # Unique session dates for the tenant (including past sessions + today if active/marked)
    month_session_dates = get_tenant_session_dates(db, current_user.tenant_id, month_prefix)
    overall_session_dates = get_tenant_session_dates(db, current_user.tenant_id)

    month_total_sessions = max(len(month_session_dates), month_present_days)
    overall_total_sessions = max(len(overall_session_dates), overall_present_days)

    month_attendance_pct = round((month_present_days / month_total_sessions * 100.0), 1) if month_total_sessions > 0 else 0.0
    overall_attendance_pct = round((overall_present_days / overall_total_sessions * 100.0), 1) if overall_total_sessions > 0 else 0.0

    month_late_count = sum(1 for r in cadet_records if r.status == AttendanceStatus.LATE and r.date and r.date.startswith(month_prefix))
    overall_late_count = sum(1 for r in cadet_records if r.status == AttendanceStatus.LATE)

    month_absent_count = max(0, month_total_sessions - month_present_days)
    overall_absent_count = max(0, overall_total_sessions - overall_present_days)

    today_record = db.query(Attendance).filter(
        Attendance.user_id == staff_id,
        Attendance.tenant_id == current_user.tenant_id,
        Attendance.date == today_str
    ).first()

    today_data = None
    if today_record:
        populate_expected_fall_in_time([today_record], db)
        today_data = {
            "marked": True,
            "status": today_record.status.value if hasattr(today_record.status, "value") else str(today_record.status),
            "check_in_time": today_record.check_in_time.isoformat() if today_record.check_in_time else None,
            "check_out_time": today_record.check_out_time.isoformat() if today_record.check_out_time else None,
            "expected_fall_in_time": getattr(today_record, "expected_fall_in_time", None)
        }
    else:
        today_data = {
            "marked": False,
            "status": "NOT_MARKED",
            "check_in_time": None,
            "check_out_time": None,
            "expected_fall_in_time": None
        }

    today_session = db.query(AttendanceSession).filter(
        AttendanceSession.tenant_id == current_user.tenant_id,
        AttendanceSession.date == today_str
    ).first()

    cadet_roaster = db.query(DailyRoaster).filter(
        DailyRoaster.tenant_id == current_user.tenant_id,
        DailyRoaster.user_id == staff_id,
        DailyRoaster.date == today_str
    ).first()

    duty_location = None
    if cadet_roaster and getattr(cadet_roaster, "location", None):
        duty_location = {
            "id": cadet_roaster.location.id,
            "name": cadet_roaster.location.name,
            "radius_meters": cadet_roaster.location.radius_meters,
            "maps_link": cadet_roaster.location.maps_link,
            "is_custom_post": True,
        }
    elif today_session and getattr(today_session, "location", None):
        duty_location = {
            "id": today_session.location.id,
            "name": today_session.location.name,
            "radius_meters": today_session.location.radius_meters,
            "maps_link": today_session.location.maps_link,
            "is_custom_post": False,
        }

    is_visarjan_passed = False
    if today_session and today_session.end_time:
        now_time = datetime.now(IST).time()
        if now_time > today_session.end_time:
            is_visarjan_passed = True

    session_info = {
        "has_session": bool(today_session),
        "is_active": bool(today_session.is_active) if today_session else False,
        "is_visarjan_passed": is_visarjan_passed,
        "title": today_session.title if today_session else None,
        "start_time": today_session.start_time.strftime("%H:%M") if today_session and today_session.start_time else None,
        "end_time": today_session.end_time.strftime("%H:%M") if today_session and today_session.end_time else None,
        "require_location": bool(today_session.require_location) if today_session else True,
        "location": {
            "id": today_session.location.id,
            "name": today_session.location.name,
            "radius_meters": today_session.location.radius_meters,
            "maps_link": today_session.location.maps_link,
        } if today_session and getattr(today_session, "location", None) else None,
    }

    return {
        "month_present_days": month_present_days,
        "overall_present_days": overall_present_days,
        "month_total_sessions": month_total_sessions,
        "overall_total_sessions": overall_total_sessions,
        "month_attendance_pct": month_attendance_pct,
        "overall_attendance_pct": overall_attendance_pct,
        "month_late_count": month_late_count,
        "overall_late_count": overall_late_count,
        "month_absent_count": month_absent_count,
        "overall_absent_count": overall_absent_count,
        "today": today_data,
        "session": session_info,
        "duty_location": duty_location,
    }


@router.get("/staff/{staff_id}")
def get_staff_attendance_history(
    staff_id: int,
    month: Optional[str] = None,
    date: Optional[str] = None,
    skip: int = 0,
    limit: int = 200,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    if current_user.role != RoleEnum.ADMIN and current_user.id != staff_id:
        raise HTTPException(status_code=403, detail="Not authorized to view this staff member's attendance.")

    target_user = db.query(User).filter(
        User.id == staff_id,
        User.tenant_id == current_user.tenant_id
    ).first()
    if not target_user:
        raise HTTPException(status_code=404, detail="Cadet not found in this unit.")

    query = db.query(Attendance).filter(
        Attendance.user_id == staff_id,
        Attendance.tenant_id == current_user.tenant_id
    )

    if month:
        query = query.filter(Attendance.date.like(f"{month}%"))
    if date:
        query = query.filter(Attendance.date == date)

    records = query.order_by(Attendance.date.desc(), Attendance.created_at.desc()).offset(skip).limit(limit).all()

    populate_expected_fall_in_time(records, db)

    result = []
    for r in records:
        duration_hours = 0.0
        if r.check_in_time and r.check_out_time:
            duration_hours = round(max((r.check_out_time - r.check_in_time).total_seconds(), 0) / 3600, 2)
        elif r.check_in_time and not r.check_out_time and r.date == datetime.now(IST).strftime("%Y-%m-%d"):
            duration_hours = round(max((datetime.now(IST).replace(tzinfo=None) - r.check_in_time).total_seconds(), 0) / 3600, 2)

        result.append({
            "id": r.id,
            "user_id": r.user_id,
            "user": {
                "id": target_user.id,
                "name": target_user.name,
                "employee_id": target_user.employee_id,
            },
            "date": r.date,
            "check_in_time": r.check_in_time.isoformat() if r.check_in_time else None,
            "check_out_time": r.check_out_time.isoformat() if r.check_out_time else None,
            "expected_fall_in_time": getattr(r, "expected_fall_in_time", None),
            "status": r.status.value if hasattr(r.status, "value") else str(r.status),
            "duration_hours": duration_hours,
            "latitude": r.latitude,
            "longitude": r.longitude,
            "photo_url": r.photo_url,
            "check_out_photo_url": r.check_out_photo_url,
            "device_info": r.device_info,
        })
    return result


@router.get("/staff/{staff_id}/export")
def export_staff_attendance_csv(
    staff_id: int,
    month: Optional[str] = None,
    date: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Exports a dedicated CSV log of all drill records for an individual cadet.
    """
    if current_user.role != RoleEnum.ADMIN and current_user.id != staff_id:
        raise HTTPException(status_code=403, detail="Not authorized to export this staff member's attendance.")

    target_user = db.query(User).filter(
        User.id == staff_id,
        User.tenant_id == current_user.tenant_id
    ).first()
    if not target_user:
        raise HTTPException(status_code=404, detail="Cadet not found in this unit.")

    query = db.query(Attendance).filter(
        Attendance.user_id == staff_id,
        Attendance.tenant_id == current_user.tenant_id
    )
    if month:
        query = query.filter(Attendance.date.like(f"{month}%"))
    if date:
        query = query.filter(Attendance.date == date)

    records = query.order_by(Attendance.date.desc(), Attendance.created_at.desc()).all()
    populate_expected_fall_in_time(records, db)

    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow([
        "Cadet Name",
        "Cadet Regt ID",
        "Date",
        "Expected Fall-In",
        "Fall-In Time",
        "Visarjan Time",
        "Status",
        "Latitude",
        "Longitude",
        "Device Info"
    ])

    for r in records:
        fall_in_str = r.check_in_time.strftime("%H:%M:%S") if getattr(r, 'check_in_time', None) else "N/A"
        visarjan_str = r.check_out_time.strftime("%H:%M:%S") if getattr(r, 'check_out_time', None) else "N/A"
        status_str = r.status.value if hasattr(r.status, 'value') else str(r.status)
        writer.writerow([
            target_user.name,
            target_user.employee_id,
            r.date,
            getattr(r, 'expected_fall_in_time', '07:00 AM'),
            fall_in_str,
            visarjan_str,
            status_str,
            r.latitude,
            r.longitude,
            r.device_info or ""
        ])

    output.seek(0)
    filename_suffix = month or date or "all"
    filename = f"attendance_{target_user.employee_id}_{filename_suffix}.csv"
    return StreamingResponse(
        iter([output.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": f"attachment; filename={filename}"}
    )


@router.get("/staff/{staff_id}/today")
def get_staff_today_attendance(
    staff_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    summary = get_staff_attendance_summary(staff_id, db, current_user)
    today = summary.get("today")
    if not today or not today.get("marked"):
        return {"status": "NOT_CHECKED_IN", "hours": 0.0, "duration_hours": 0.0}
    return {
        "status": today.get("status"),
        "check_in_time": today.get("check_in_time"),
        "check_out_time": today.get("check_out_time"),
        "hours": 0.0,
        "duration_hours": 0.0,
    }


@router.get("/staff/{staff_id}/monthly")
def get_staff_monthly_attendance(
    staff_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    summary = get_staff_attendance_summary(staff_id, db, current_user)
    return {
        "total_working_hours": 0.0,
        "total_hours": 0.0,
        "month_present_days": summary.get("month_present_days", 0),
        "overall_present_days": summary.get("overall_present_days", 0),
    }


