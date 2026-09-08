from datetime import datetime, timezone
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from sqlalchemy import func

from backend.database.database import get_db
from backend.models.models import Attendance, User, AttendanceStatus, RoleEnum, IST, AttendanceSession
from backend.auth.dependencies import get_current_admin
from backend.schemas.schemas import AnalyticsSummary

router = APIRouter(
    prefix="/analytics",
    tags=["Analytics"],
    dependencies=[Depends(get_current_admin)]
)

@router.get("/", response_model=AnalyticsSummary)
def get_analytics(db: Session = Depends(get_db), current_admin: User = Depends(get_current_admin)):
    today_str = datetime.now(IST).strftime("%Y-%m-%d")
    
    # Check if an active session is conducted today
    active_session = db.query(AttendanceSession).filter(
        AttendanceSession.tenant_id == current_admin.tenant_id,
        AttendanceSession.date == today_str,
        AttendanceSession.is_active == 1
    ).first()

    has_active_session = bool(active_session)
    session_title = active_session.title if active_session else None

    # 1. Total staff
    total_staff = db.query(User).filter(User.role == RoleEnum.STAFF, User.tenant_id == current_admin.tenant_id).count()
    
    # 2. Present today (including late)
    present_today = db.query(Attendance).filter(
        Attendance.date == today_str,
        Attendance.tenant_id == current_admin.tenant_id,
    ).count()
    
    # 3. Late today
    late_today = db.query(Attendance).filter(
        Attendance.date == today_str,
        Attendance.status == AttendanceStatus.LATE,
        Attendance.tenant_id == current_admin.tenant_id,
    ).count()
    
    # 4. Absent today:
    # If today has NO active parade/drill session (e.g. exam month, off day),
    # cadets should not be flagged as absent!
    if not has_active_session:
        absent_today = 0
    else:
        absent_today = total_staff - present_today if total_staff > present_today else 0
    
    return {
        "total_staff": total_staff,
        "present_today": present_today,
        "absent_today": absent_today,
        "late_today": late_today,
        "has_active_session": has_active_session,
        "session_title": session_title
    }
    
@router.get("/trends")
def get_attendance_trends(db: Session = Depends(get_db), current_admin: User = Depends(get_current_admin)):
    # Simple line chart data representation (Counts grouped by date)
    trends = db.query(Attendance.date, func.count(Attendance.id).label("count")).filter(
        Attendance.tenant_id == current_admin.tenant_id
    ).group_by(Attendance.date).order_by(Attendance.date.desc()).limit(30).all()
    # Reverse to be chronological
    trends = trends[::-1]
    
    dates = [t.date for t in trends]
    counts = [t.count for t in trends]
    
    return {
        "dates": dates,
        "counts": counts
    }
