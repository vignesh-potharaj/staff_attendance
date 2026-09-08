from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List, Optional, Dict
from datetime import datetime, time as time_obj
import logging

from backend.database.database import get_db
from backend.models.models import DailyRoaster, User, AttendanceSession, RoleEnum, IST, Attendance
from backend.schemas.schemas import (
    DailyRoasterCreate,
    DailyRoasterResponse,
    AttendanceSessionCreate,
    AttendanceSessionResponse,
    AttendanceSessionStatus
)
from backend.auth.dependencies import get_current_admin, get_current_user

logger = logging.getLogger(__name__)

router = APIRouter(
    prefix="/roaster",
    tags=["Roaster"]
)

@router.get("/")
def get_daily_roaster(date: str, db: Session = Depends(get_db), current_user: User = Depends(get_current_admin)):
    """
    Get the roaster schedules for a specific date (YYYY-MM-DD).
    Returns empty list if no records found for that date.
    """
    try:
        records = db.query(DailyRoaster).filter(
            DailyRoaster.date == date,
            DailyRoaster.tenant_id == current_user.tenant_id,
        ).all()
        
        # Convert records to dict for clean JSON serialization
        result = []
        for record in records:
            try:
                # Handle time serialization
                if record.start_time is not None:
                    start_str = record.start_time.isoformat() if hasattr(record.start_time, 'isoformat') else str(record.start_time)
                else:
                    start_str = None
                    
                if record.end_time is not None:
                    end_str = record.end_time.isoformat() if hasattr(record.end_time, 'isoformat') else str(record.end_time)
                else:
                    end_str = None
            except Exception as e:
                logger.warning(f"Error converting time fields: {e}, using string representation")
                start_str = str(record.start_time) if record.start_time is not None else None
                end_str = str(record.end_time) if record.end_time is not None else None
            
            result.append({
                "id": record.id,
                "user_id": record.user_id,
                "date": record.date,
                "start_time": start_str,
                "end_time": end_str,
                "is_leave": bool(record.is_leave) if record.is_leave is not None else False,
                "is_week_off": bool(record.is_week_off) if record.is_week_off is not None else False,
                "location_id": record.location_id,
                "location": {
                    "id": record.location.id,
                    "name": record.location.name,
                    "radius_meters": record.location.radius_meters
                } if getattr(record, "location", None) else None,
            })
        
        logger.info(f"Returned {len(result)} roaster records for date {date}")
        return result
    except Exception as e:
        logger.error(f"Error fetching roaster for date {date}: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Error fetching roaster: {str(e)}")

@router.post("/bulk")
def update_daily_roaster(date: str, schedules: List[DailyRoasterCreate], db: Session = Depends(get_db), current_user: User = Depends(get_current_admin)):
    """
    Update or create roaster schedules for a specific date (bulk operation).
    """
    try:
        # Verify date format
        try:
            datetime.strptime(date, "%Y-%m-%d")
        except ValueError:
            raise HTTPException(status_code=400, detail="Invalid date format. Use YYYY-MM-DD")

        # For safety, make sure all schedules match the date parameter
        for schedule in schedules:
            if schedule.date != date:
                raise HTTPException(status_code=400, detail="Schedule date does not match the URL date")

        # Find existing records for this date
        existing_records = db.query(DailyRoaster).filter(
            DailyRoaster.date == date,
            DailyRoaster.tenant_id == current_user.tenant_id,
        ).all()
        existing_map: Dict[int, DailyRoaster] = {r.user_id: r for r in existing_records}  # type: ignore

        for schedule in schedules:
            if schedule.user_id in existing_map:
                # Update existing record
                record = existing_map[schedule.user_id]
                
                # Parse string times to time objects if needed
                if isinstance(schedule.start_time, str) and schedule.start_time:
                    from datetime import time as time_obj
                    parts = schedule.start_time.split(':')
                    start_time_val = time_obj(int(parts[0]), int(parts[1]), int(parts[2]) if len(parts) > 2 else 0)
                    setattr(record, 'start_time', start_time_val)
                elif schedule.start_time is not None:
                    setattr(record, 'start_time', schedule.start_time)
                else:
                    setattr(record, 'start_time', None)
                    
                if isinstance(schedule.end_time, str) and schedule.end_time:
                    from datetime import time as time_obj
                    parts = schedule.end_time.split(':')
                    end_time_val = time_obj(int(parts[0]), int(parts[1]), int(parts[2]) if len(parts) > 2 else 0)
                    setattr(record, 'end_time', end_time_val)
                elif schedule.end_time is not None:
                    setattr(record, 'end_time', schedule.end_time)
                else:
                    setattr(record, 'end_time', None)
                    
                setattr(record, 'is_leave', 1 if schedule.is_leave else 0)
                setattr(record, 'is_week_off', 1 if schedule.is_week_off else 0)
                setattr(record, 'location_id', schedule.location_id)
            else:
                # Create new record
                start_time = None
                end_time = None
                
                if isinstance(schedule.start_time, str) and schedule.start_time:
                    from datetime import time as time_obj
                    parts = schedule.start_time.split(':')
                    start_time = time_obj(int(parts[0]), int(parts[1]), int(parts[2]) if len(parts) > 2 else 0)
                elif schedule.start_time is not None:
                    start_time = schedule.start_time
                    
                if isinstance(schedule.end_time, str) and schedule.end_time:
                    from datetime import time as time_obj
                    parts = schedule.end_time.split(':')
                    end_time = time_obj(int(parts[0]), int(parts[1]), int(parts[2]) if len(parts) > 2 else 0)
                elif schedule.end_time is not None:
                    end_time = schedule.end_time
                
                new_record = DailyRoaster(
                    tenant_id=current_user.tenant_id,
                    user_id=schedule.user_id,
                    date=schedule.date,
                    start_time=start_time,
                    end_time=end_time,
                    is_leave=1 if schedule.is_leave else 0,
                    is_week_off=1 if schedule.is_week_off else 0,
                    location_id=schedule.location_id
                )
                db.add(new_record)
        db.commit()

        # Trigger Web Push notification to affected staff users
        from backend.services.push_service import send_push_to_user
        for schedule in schedules:
            try:
                shift_desc = "On Leave" if schedule.is_leave else ("Week Off" if schedule.is_week_off else f"{schedule.start_time or ''} - {schedule.end_time or ''}")
                send_push_to_user(
                    db=db,
                    user_id=schedule.user_id,
                    title="Shift Schedule Update 📅",
                    body=f"Your shift schedule for {date} is: {shift_desc}",
                    url="/staff/dashboard"
                )
            except Exception as push_err:
                logger.warning(f"Failed to send roaster push notification to user {schedule.user_id}: {push_err}")

        return {"message": "Roaster updated successfully"}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error updating roaster for date {date}: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Error updating roaster: {str(e)}")


@router.get("/staff/my-roaster")
def get_my_roaster(
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Get current logged-in staff member's roaster schedules for optional date range (YYYY-MM-DD).
    """
    try:
        query = db.query(DailyRoaster).filter(
            DailyRoaster.user_id == current_user.id,
            DailyRoaster.tenant_id == current_user.tenant_id,
        )
        if start_date:
            query = query.filter(DailyRoaster.date >= start_date)
        if end_date:
            query = query.filter(DailyRoaster.date <= end_date)

        records = query.all()

        result = []
        for record in records:
            try:
                if record.start_time is not None:
                    start_str = record.start_time.isoformat() if hasattr(record.start_time, 'isoformat') else str(record.start_time)
                else:
                    start_str = None

                if record.end_time is not None:
                    end_str = record.end_time.isoformat() if hasattr(record.end_time, 'isoformat') else str(record.end_time)
                else:
                    end_str = None
            except Exception as e:
                logger.warning(f"Error converting time fields: {e}")
                start_str = str(record.start_time) if record.start_time is not None else None
                end_str = str(record.end_time) if record.end_time is not None else None

            result.append({
                "id": record.id,
                "user_id": record.user_id,
                "date": record.date,
                "start_time": start_str,
                "end_time": end_str,
                "is_leave": bool(record.is_leave) if record.is_leave is not None else False,
                "is_week_off": bool(record.is_week_off) if record.is_week_off is not None else False,
                "location_id": record.location_id,
                "location": {
                    "id": record.location.id,
                    "name": record.location.name,
                    "radius_meters": record.location.radius_meters,
                    "maps_link": record.location.maps_link,
                } if getattr(record, "location", None) else None,
            })

        return result
    except Exception as e:
        logger.error(f"Error fetching staff my-roaster: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Error fetching staff roaster: {str(e)}")


def _parse_time_str(time_val: Optional[str]) -> Optional[time_obj]:
    if not time_val:
        return None
    try:
        parts = time_val.split(":")
        h = int(parts[0])
        m = int(parts[1])
        s = int(parts[2]) if len(parts) > 2 else 0
        return time_obj(h, m, s)
    except Exception:
        return None


def _format_time_obj(t_val) -> Optional[str]:
    if t_val is None:
        return None
    if hasattr(t_val, "strftime"):
        return t_val.strftime("%H:%M")
    return str(t_val)[:5]


@router.get("/session/status", response_model=AttendanceSessionStatus)
def get_session_status(
    date: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Check if a parade/drill session is configured and active for a given date.
    Accessible by both admins and cadets.
    """
    if not date:
        date = datetime.now(IST).strftime("%Y-%m-%d")

    session = db.query(AttendanceSession).filter(
        AttendanceSession.tenant_id == current_user.tenant_id,
        AttendanceSession.date == date
    ).order_by(AttendanceSession.id.desc()).first()

    if not session:
        return {
            "has_session": False,
            "is_active": False,
            "today_date": date,
            "session": None
        }

    return {
        "has_session": True,
        "is_active": bool(session.is_active),
        "today_date": date,
        "session": {
            "id": session.id,
            "date": session.date,
            "title": session.title,
            "start_time": _format_time_obj(session.start_time),
            "end_time": _format_time_obj(session.end_time),
            "is_active": bool(session.is_active),
            "require_location": bool(getattr(session, "require_location", 1)),
            "location_id": session.location_id,
            "location": {
                "id": session.location.id,
                "name": session.location.name,
                "radius_meters": session.location.radius_meters
            } if getattr(session, "location", None) else None,
            "notes": session.notes
        }
    }


@router.post("/session/activate")
def activate_session(
    payload: AttendanceSessionCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_admin)
):
    """
    Activate or create an on-demand parade/drill session for a date.
    Sets default roaster for all cadets if not set, and optionally notifies them.
    """
    try:
        try:
            datetime.strptime(payload.date, "%Y-%m-%d")
        except ValueError:
            raise HTTPException(status_code=400, detail="Invalid date format. Use YYYY-MM-DD")

        # Parse timings (default 07:00 to 09:30 for NCC parades if omitted)
        start_time_parsed = _parse_time_str(payload.start_time) or time_obj(7, 0, 0)
        end_time_parsed = _parse_time_str(payload.end_time) or time_obj(9, 30, 0)
        require_location_val = 1 if payload.require_location else 0

        # Check existing session
        session = db.query(AttendanceSession).filter(
            AttendanceSession.tenant_id == current_user.tenant_id,
            AttendanceSession.date == payload.date
        ).first()

        session_title = payload.title.strip() if payload.title and payload.title.strip() else "Parade / Drill Session"

        if session:
            old_start = session.start_time
            old_end = session.end_time
            session.title = session_title
            session.start_time = start_time_parsed
            session.end_time = end_time_parsed
            session.is_active = 1
            session.require_location = require_location_val
            session.location_id = payload.location_id
            session.notes = payload.notes
        else:
            old_start = None
            old_end = None
            session = AttendanceSession(
                tenant_id=current_user.tenant_id,
                date=payload.date,
                title=session_title,
                start_time=start_time_parsed,
                end_time=end_time_parsed,
                is_active=1,
                require_location=require_location_val,
                location_id=payload.location_id,
                notes=payload.notes,
                created_by=current_user.id
            )
            db.add(session)

        # Also populate or update default roaster entries for active cadets for this date
        cadets = db.query(User).filter(
            User.tenant_id == current_user.tenant_id,
            User.role == RoleEnum.STAFF
        ).all()

        existing_roasters = {
            r.user_id: r for r in db.query(DailyRoaster).filter(
                DailyRoaster.tenant_id == current_user.tenant_id,
                DailyRoaster.date == payload.date
            ).all()
        }

        for cadet in cadets:
            if cadet.id not in existing_roasters:
                new_roaster = DailyRoaster(
                    tenant_id=current_user.tenant_id,
                    user_id=cadet.id,
                    date=payload.date,
                    start_time=start_time_parsed,
                    end_time=end_time_parsed,
                    is_leave=0,
                    is_week_off=0
                )
                db.add(new_roaster)
            else:
                r = existing_roasters[cadet.id]
                # If cadet timing was empty or matched old session timing, update to new session timing
                if not r.start_time or (old_start and r.start_time == old_start):
                    r.start_time = start_time_parsed
                if not r.end_time or (old_end and r.end_time == old_end):
                    r.end_time = end_time_parsed

        db.commit()
        db.refresh(session)

        # Send push notification if requested
        if payload.send_notification:
            try:
                from backend.services.push_service import broadcast_push_to_tenant
                time_display = f"{start_time_parsed.strftime('%I:%M %p')} - {end_time_parsed.strftime('%I:%M %p')}"
                broadcast_push_to_tenant(
                    db=db,
                    tenant_id=current_user.tenant_id,
                    title="Parade Session Activated! 🎖️",
                    body=f"{session.title} is now ACTIVE ({time_display}). Fall-In attendance is open.",
                    url="/staff/dashboard"
                )
            except Exception as push_err:
                logger.warning(f"Failed to send session activation push: {push_err}")

        return {
            "message": "Session activated successfully",
            "session": {
                "id": session.id,
                "date": session.date,
                "title": session.title,
                "start_time": _format_time_obj(session.start_time),
                "end_time": _format_time_obj(session.end_time),
                "is_active": True,
                "require_location": bool(getattr(session, "require_location", 1)),
                "location_id": session.location_id,
                "location": {
                    "id": session.location.id,
                    "name": session.location.name,
                    "radius_meters": session.location.radius_meters
                } if getattr(session, "location", None) else None
            }
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error activating session: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Error activating session: {str(e)}")


@router.post("/session/deactivate")
def deactivate_session(
    date: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_admin)
):
    """
    Deactivate/conclude an active parade session for a given date.
    """
    try:
        session = db.query(AttendanceSession).filter(
            AttendanceSession.tenant_id == current_user.tenant_id,
            AttendanceSession.date == date
        ).first()

        if not session:
            raise HTTPException(status_code=404, detail="No session found for this date")

        session.is_active = 0
        db.commit()
        db.refresh(session)

        return {
            "message": "Session concluded successfully",
            "date": date,
            "is_active": False
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error deactivating session: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Error deactivating session: {str(e)}")


@router.get("/sessions")
def list_sessions(
    limit: int = 30,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_admin)
):
    """
    List all created sessions with attendance counts.
    """
    try:
        sessions = db.query(AttendanceSession).filter(
            AttendanceSession.tenant_id == current_user.tenant_id
        ).order_by(AttendanceSession.date.desc()).limit(limit).all()

        result = []
        for s in sessions:
            att_count = db.query(Attendance).filter(
                Attendance.tenant_id == current_user.tenant_id,
                Attendance.date == s.date
            ).count()

            result.append({
                "id": s.id,
                "date": s.date,
                "title": s.title,
                "start_time": _format_time_obj(s.start_time),
                "end_time": _format_time_obj(s.end_time),
                "is_active": bool(s.is_active),
                "attendee_count": att_count,
                "created_at": s.created_at.isoformat() if s.created_at else None
            })

        return result
    except Exception as e:
        logger.error(f"Error listing sessions: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Error listing sessions: {str(e)}")

