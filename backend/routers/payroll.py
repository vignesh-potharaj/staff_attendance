from datetime import datetime
from typing import Iterable

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from backend.auth.dependencies import get_current_admin, get_current_user
from backend.database.database import get_db
from backend.models.models import Attendance, AttendanceStatus, IST, RoleEnum, User
from backend.schemas.schemas import HourlyPayUpdate

router = APIRouter(prefix="/api", tags=["Payroll"])

PAYROLL_STATUSES = {AttendanceStatus.PRESENT, AttendanceStatus.LATE}


def _duration_hours(record: Attendance, use_now_when_open: bool = False) -> float:
    check_in = getattr(record, "check_in_time", None)
    check_out = getattr(record, "check_out_time", None)
    if use_now_when_open and check_in and not check_out:
        check_out = datetime.now(IST).replace(tzinfo=None)
    if not check_in or not check_out:
        return 0.0
    seconds = max((check_out - check_in).total_seconds(), 0)
    return round(seconds / 3600, 2)


def _total_hours(records: Iterable[Attendance]) -> float:
    return round(sum(_duration_hours(record) for record in records), 2)


def _staff_for_admin(db: Session, staff_id: int, current_admin: User) -> User:
    staff = db.query(User).filter(
        User.id == staff_id,
        User.tenant_id == current_admin.tenant_id,
    ).first()
    if not staff:
        raise HTTPException(status_code=404, detail="Staff member not found")
    return staff


def _staff_for_current_user(db: Session, staff_id: int, current_user: User) -> User:
    if current_user.role == RoleEnum.ADMIN:
        staff = db.query(User).filter(
            User.id == staff_id,
            User.tenant_id == current_user.tenant_id,
        ).first()
    else:
        staff = db.query(User).filter(
            User.id == staff_id,
            User.tenant_id == current_user.tenant_id,
        ).first() if current_user.id == staff_id else None
    if not staff:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not allowed to access this staff member",
        )
    return staff


def _attendance_query(db: Session, staff: User):
    return db.query(Attendance).filter(
        Attendance.user_id == staff.id,
        Attendance.tenant_id == staff.tenant_id,
        Attendance.status.in_(list(PAYROLL_STATUSES)),
    )


def _record_payload(record: Attendance, use_now_when_open: bool = False) -> dict:
    return {
        "id": record.id,
        "user_id": record.user_id,
        "date": record.date,
        "check_in_time": record.check_in_time,
        "check_out_time": record.check_out_time,
        "duration_hours": _duration_hours(record, use_now_when_open),
        "status": record.status.value if hasattr(record.status, "value") else str(record.status),
        "latitude": record.latitude,
        "longitude": record.longitude,
        "photo_url": record.photo_url,
        "check_out_photo_url": record.check_out_photo_url,
        "device_info": record.device_info,
    }


def _payroll_payload(staff: User, records: list[Attendance]) -> dict:
    total_working_hours = _total_hours(records)
    hourly_pay = float(staff.hourly_pay or 0)
    return {
        "staff_id": staff.id,
        "staff_name": staff.name,
        "employee_id": staff.employee_id,
        "hourly_pay": hourly_pay,
        "total_working_hours": total_working_hours,
        "total_payroll": round(total_working_hours * hourly_pay, 2),
    }


@router.patch("/staff/{staff_id}/hourly_pay")
def update_hourly_pay(
    staff_id: int,
    payload: HourlyPayUpdate,
    month: int = None,
    year: int = None,
    db: Session = Depends(get_db),
    current_admin: User = Depends(get_current_admin),
):
    if payload.hourly_pay < 0:
        raise HTTPException(status_code=400, detail="Hourly pay cannot be negative")

    staff = _staff_for_admin(db, staff_id, current_admin)
    staff.hourly_pay = payload.hourly_pay
    db.commit()
    db.refresh(staff)

    query = _attendance_query(db, staff)
    if month is not None and year is not None:
        month_prefix = f"{year:04d}-{month:02d}"
        query = query.filter(Attendance.date.like(f"{month_prefix}%"))
    records = query.all()
    return _payroll_payload(staff, records)


@router.get("/staff/{staff_id}/payroll")
def get_staff_payroll(
    staff_id: int,
    month: int = None,
    year: int = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if month is None or year is None:
        raise HTTPException(
            status_code=400,
            detail="Both 'month' and 'year' query parameters are required"
        )
    try:
        month = int(month)
        year = int(year)
    except ValueError:
        raise HTTPException(
            status_code=400,
            detail="'month' and 'year' must be valid integers"
        )

    if not (1 <= month <= 12):
        raise HTTPException(
            status_code=400,
            detail="'month' must be between 1 and 12"
        )

    staff = _staff_for_current_user(db, staff_id, current_user)
    month_prefix = f"{year:04d}-{month:02d}"
    records = _attendance_query(db, staff).filter(
        Attendance.date.like(f"{month_prefix}%")
    ).all()
    return _payroll_payload(staff, records)


@router.get("/payroll/all")
def get_all_payroll(
    month: int = None,
    year: int = None,
    db: Session = Depends(get_db),
    current_admin: User = Depends(get_current_admin),
):
    if month is None or year is None:
        raise HTTPException(
            status_code=400,
            detail="Both 'month' and 'year' query parameters are required"
        )
    try:
        month = int(month)
        year = int(year)
    except ValueError:
        raise HTTPException(
            status_code=400,
            detail="'month' and 'year' must be valid integers"
        )

    if not (1 <= month <= 12):
        raise HTTPException(
            status_code=400,
            detail="'month' must be between 1 and 12"
        )

    staff_members = db.query(User).filter(
        User.tenant_id == current_admin.tenant_id,
        User.role == RoleEnum.STAFF,
    ).order_by(User.name.asc()).all()

    month_prefix = f"{year:04d}-{month:02d}"

    summaries = []
    for staff in staff_members:
        records = _attendance_query(db, staff).filter(
            Attendance.date.like(f"{month_prefix}%")
        ).all()
        summaries.append(_payroll_payload(staff, records))
    return summaries


@router.get("/attendance/staff/{staff_id}")
def get_staff_attendance_records(
    staff_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    staff = _staff_for_current_user(db, staff_id, current_user)
    records = db.query(Attendance).filter(
        Attendance.user_id == staff.id,
        Attendance.tenant_id == staff.tenant_id,
    ).order_by(Attendance.date.desc(), Attendance.created_at.desc()).all()
    return [_record_payload(record) for record in records]


@router.get("/attendance/staff/{staff_id}/today")
def get_staff_today_attendance(
    staff_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    staff = _staff_for_current_user(db, staff_id, current_user)
    today = datetime.now(IST).strftime("%Y-%m-%d")
    record = db.query(Attendance).filter(
        Attendance.user_id == staff.id,
        Attendance.tenant_id == staff.tenant_id,
        Attendance.date == today,
    ).first()
    return _record_payload(record, use_now_when_open=True) if record else None


@router.get("/attendance/staff/{staff_id}/monthly")
def get_staff_monthly_attendance(
    staff_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    staff = _staff_for_current_user(db, staff_id, current_user)
    month_prefix = datetime.now(IST).strftime("%Y-%m")
    records = _attendance_query(db, staff).filter(
        Attendance.date.like(f"{month_prefix}%"),
    ).all()
    total_hours = _total_hours(records)
    hourly_pay = float(staff.hourly_pay or 0)
    return {
        "staff_id": staff.id,
        "month": month_prefix,
        "hourly_pay": hourly_pay,
        "total_working_hours": total_hours,
        "total_payroll": round(total_hours * hourly_pay, 2),
    }
