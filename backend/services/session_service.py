import logging
from datetime import datetime, time as time_obj
from typing import Optional

from sqlalchemy.orm import Session

from backend.models.models import (
    AttendanceSession,
    DailyRoaster,
    IST,
    RoleEnum,
    SavedLocation,
    User,
)

logger = logging.getLogger(__name__)

# Days where sessions automatically activate: Wednesday (2) and Saturday (5)
AUTO_SESSION_WEEKDAYS = {2, 5}

# Default NCC parade drill timings (09:30 AM to 12:30 PM)
DEFAULT_START_TIME = time_obj(9, 30, 0)
DEFAULT_END_TIME = time_obj(12, 30, 0)
DEFAULT_SESSION_TITLE = "Parade / Drill Session"


def is_auto_session_day(date_obj: datetime) -> bool:
    """Returns True if the given date is Wednesday (2) or Saturday (5)."""
    return date_obj.weekday() in AUTO_SESSION_WEEKDAYS


def get_or_create_auto_session(
    db: Session,
    tenant_id: int,
    target_date: Optional[str] = None
) -> Optional[AttendanceSession]:
    """
    Retrieves the existing session for the tenant and date, or automatically
    creates and activates one if today is Wednesday or Saturday.

    Designed for Render free tier:
    No external cron or background worker required. Session activates lazily
    on first user request of the day.
    If an admin has explicitly deactivated the session (is_active == 0),
    it respects that decision and does NOT re-activate it.
    """
    now_ist = datetime.now(IST)
    today_str = now_ist.strftime("%Y-%m-%d")
    date_str = target_date or today_str

    # 1. Query for an existing session on this date
    session = (
        db.query(AttendanceSession)
        .filter(
            AttendanceSession.tenant_id == tenant_id,
            AttendanceSession.date == date_str,
        )
        .order_by(AttendanceSession.id.desc())
        .first()
    )

    if session:
        return session

    # 2. If no session exists, check if date qualifies for automatic activation
    # Only auto-activate for the current date (today in IST) if it's Wed or Sat
    try:
        parsed_target = datetime.strptime(date_str, "%Y-%m-%d")
    except ValueError:
        return None

    if date_str == today_str and is_auto_session_day(parsed_target):
        try:
            # Find default location for tenant
            def_loc = (
                db.query(SavedLocation)
                .filter(
                    SavedLocation.tenant_id == tenant_id,
                    SavedLocation.is_default == 1,
                )
                .first()
            )
            if not def_loc:
                def_loc = (
                    db.query(SavedLocation)
                    .filter(SavedLocation.tenant_id == tenant_id)
                    .first()
                )

            loc_id = def_loc.id if def_loc else None

            new_session = AttendanceSession(
                tenant_id=tenant_id,
                date=date_str,
                title=DEFAULT_SESSION_TITLE,
                start_time=DEFAULT_START_TIME,
                end_time=DEFAULT_END_TIME,
                is_active=1,
                require_location=1,
                location_id=loc_id,
                notes="Automated Wednesday/Saturday parade drill session",
                created_by=None,
            )
            db.add(new_session)
            db.flush()

            # Populate DailyRoaster for active cadets so duty roster is in sync
            cadets = (
                db.query(User)
                .filter(
                    User.tenant_id == tenant_id,
                    User.role == RoleEnum.STAFF,
                )
                .all()
            )

            existing_user_ids = {
                r.user_id
                for r in db.query(DailyRoaster.user_id)
                .filter(
                    DailyRoaster.tenant_id == tenant_id,
                    DailyRoaster.date == date_str,
                )
                .all()
            }

            for cadet in cadets:
                if cadet.id not in existing_user_ids:
                    new_roaster = DailyRoaster(
                        tenant_id=tenant_id,
                        user_id=cadet.id,
                        date=date_str,
                        start_time=DEFAULT_START_TIME,
                        end_time=DEFAULT_END_TIME,
                        location_id=loc_id,
                        is_leave=0,
                        is_week_off=0,
                    )
                    db.add(new_roaster)

            db.commit()
            db.refresh(new_session)
            logger.info(
                f"[AutoSession] Successfully auto-activated Wednesday/Saturday session {new_session.id} for tenant {tenant_id} on {date_str}"
            )
            return new_session
        except Exception as exc:
            db.rollback()
            logger.warning(
                f"[AutoSession] Conflict or error during auto-session creation (possibly concurrent request): {exc}"
            )
            # Re-query in case another concurrent request created it
            return (
                db.query(AttendanceSession)
                .filter(
                    AttendanceSession.tenant_id == tenant_id,
                    AttendanceSession.date == date_str,
                )
                .order_by(AttendanceSession.id.desc())
                .first()
            )

    return None
