from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List, Optional, Dict
from datetime import datetime
import logging

from backend.database.database import get_db
from backend.models.models import DailyRoaster, User
from backend.schemas.schemas import DailyRoasterCreate, DailyRoasterResponse
from backend.auth.dependencies import get_current_admin

logger = logging.getLogger(__name__)

router = APIRouter(
    prefix="/roaster",
    tags=["Roaster"]
)

@router.get("/")
def get_daily_roaster(date: str, db: Session = Depends(get_db), current_user: User = Depends(get_current_admin)):
    """
    Get the roaster schedules for a specific date (YYYY-MM-DD).
    If a specific date override exists in DailyRoaster, returns the override.
    Otherwise, automatically falls back to the staff member's Default Working Shift.
    """
    try:
        records = db.query(DailyRoaster).filter(
            DailyRoaster.date == date,
            DailyRoaster.tenant_id == current_user.tenant_id,
        ).all()
        existing_map = {r.user_id: r for r in records}

        from backend.models.models import RoleEnum
        staff_members = db.query(User).filter(
            User.tenant_id == current_user.tenant_id,
            User.role == RoleEnum.STAFF,
        ).order_by(User.name.asc()).all()

        result = []
        for staff in staff_members:
            if staff.id in existing_map:
                record = existing_map[staff.id]
                start_str = record.start_time.isoformat() if hasattr(record.start_time, 'isoformat') and record.start_time else (str(record.start_time) if record.start_time is not None else None)
                end_str = record.end_time.isoformat() if hasattr(record.end_time, 'isoformat') and record.end_time else (str(record.end_time) if record.end_time is not None else None)
                is_leave = bool(record.is_leave) if record.is_leave is not None else False
                is_week_off = bool(record.is_week_off) if record.is_week_off is not None else False
                record_id = record.id
                is_default_shift = False
            else:
                start_str = getattr(staff, 'default_shift_start', '09:00:00') or '09:00:00'
                end_str = getattr(staff, 'default_shift_end', '18:00:00') or '18:00:00'
                is_leave = False
                is_week_off = False
                record_id = None
                is_default_shift = True

            result.append({
                "id": record_id,
                "user_id": staff.id,
                "staff_name": staff.name,
                "employee_id": staff.employee_id,
                "date": date,
                "start_time": start_str,
                "end_time": end_str,
                "is_leave": is_leave,
                "is_week_off": is_week_off,
                "is_default_shift": is_default_shift,
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
                    is_week_off=1 if schedule.is_week_off else 0
                )
                db.add(new_record)
        
        db.commit()
        return {"message": "Roaster updated successfully"}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error updating roaster for date {date}: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Error updating roaster: {str(e)}")
