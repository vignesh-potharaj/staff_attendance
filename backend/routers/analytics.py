from datetime import datetime, timezone
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from sqlalchemy import func

from backend.database.database import get_db
from backend.models.models import Attendance, User, AttendanceStatus, RoleEnum, IST
from backend.auth.dependencies import get_current_admin
from backend.schemas.schemas import AnalyticsSummary

router = APIRouter(
    prefix="/analytics",
    tags=["Analytics"],
    dependencies=[Depends(get_current_admin)]
)

@router.get("/", response_model=AnalyticsSummary)
def get_analytics(db: Session = Depends(get_db)):
    today_str = datetime.now(IST).strftime("%Y-%m-%d")
    
    # 1. Total staff
    total_staff = db.query(User).filter(User.role == RoleEnum.STAFF).count()
    
    # 2. Present today (including late)
    present_today = db.query(Attendance).filter(
        Attendance.date == today_str
    ).count()
    
    # 3. Late today
    late_today = db.query(Attendance).filter(
        Attendance.date == today_str,
        Attendance.status == AttendanceStatus.LATE
    ).count()
    
    # 4. Absent today (total staff - present today)
    absent_today = total_staff - present_today if total_staff > present_today else 0
    
    return {
        "total_staff": total_staff,
        "present_today": present_today,
        "absent_today": absent_today,
        "late_today": late_today
    }
    
@router.get("/trends")
def get_attendance_trends(db: Session = Depends(get_db)):
    # Simple line chart data representation (Counts grouped by date)
    trends = db.query(Attendance.date, func.count(Attendance.id).label("count")).group_by(Attendance.date).order_by(Attendance.date.desc()).limit(30).all()
    # Reverse to be chronological
    trends = trends[::-1]
    
    dates = [t.date for t in trends]
    counts = [t.count for t in trends]
    
    return {
        "dates": dates,
        "counts": counts
    }
