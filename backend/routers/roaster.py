from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List, Optional
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
    Returns empty list if no records found for that date.
    """
    try:
        records = db.query(DailyRoaster).filter(DailyRoaster.date == date).all()
        
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
        existing_records = db.query(DailyRoaster).filter(DailyRoaster.date == date).all()
        existing_map = {r.user_id: r for r in existing_records}

        for schedule in schedules:
            if schedule.user_id in existing_map:
                # Update existing
                record = existing_map[schedule.user_id]
                # Parse string times to time objects if needed
                if isinstance(schedule.start_time, str):
                    from datetime import time as time_obj
                    parts = schedule.start_time.split(':')
                    record.start_time = time_obj(int(parts[0]), int(parts[1]), int(parts[2]) if len(parts) > 2 else 0) if schedule.start_time else None
                else:
                    record.start_time = schedule.start_time
                    
                if isinstance(schedule.end_time, str):
                    from datetime import time as time_obj
                    parts = schedule.end_time.split(':')
                    record.end_time = time_obj(int(parts[0]), int(parts[1]), int(parts[2]) if len(parts) > 2 else 0) if schedule.end_time else None
                else:
                    record.end_time = schedule.end_time
                    
                record.is_leave = 1 if schedule.is_leave else 0
                record.is_week_off = 1 if schedule.is_week_off else 0
            else:
                # Create new
                start_time = None
                end_time = None
                
                if schedule.start_time:
                    if isinstance(schedule.start_time, str):
                        from datetime import time as time_obj
                        parts = schedule.start_time.split(':')
                        start_time = time_obj(int(parts[0]), int(parts[1]), int(parts[2]) if len(parts) > 2 else 0)
                    else:
                        start_time = schedule.start_time
                        
                if schedule.end_time:
                    if isinstance(schedule.end_time, str):
                        from datetime import time as time_obj
                        parts = schedule.end_time.split(':')
                        end_time = time_obj(int(parts[0]), int(parts[1]), int(parts[2]) if len(parts) > 2 else 0)
                    else:
                        end_time = schedule.end_time
                
                new_record = DailyRoaster(
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
