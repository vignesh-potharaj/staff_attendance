from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List, Optional
from datetime import datetime

from backend.database.database import get_db
from backend.models.models import DailyRoaster, User
from backend.schemas.schemas import DailyRoasterCreate, DailyRoasterResponse
from backend.auth.dependencies import get_current_admin

router = APIRouter(
    prefix="/roaster",
    tags=["Roaster"]
)

@router.get("/", response_model=List[DailyRoasterResponse], dependencies=[Depends(get_current_admin)])
def get_daily_roaster(date: str, db: Session = Depends(get_db)):
    """
    Get the roaster schedules for a specific date (YYYY-MM-DD).
    """
    return db.query(DailyRoaster).filter(DailyRoaster.date == date).all()

@router.post("/bulk", response_model=dict, dependencies=[Depends(get_current_admin)])
def update_daily_roaster(date: str, schedules: List[DailyRoasterCreate], db: Session = Depends(get_db)):
    """
    Update or create roaster schedules for a specific date (bulk operation).
    """
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
            record.start_time = schedule.start_time
            record.end_time = schedule.end_time
            record.is_leave = 1 if schedule.is_leave else 0
        else:
            # Create new
            new_record = DailyRoaster(
                user_id=schedule.user_id,
                date=schedule.date,
                start_time=schedule.start_time,
                end_time=schedule.end_time,
                is_leave=1 if schedule.is_leave else 0
            )
            db.add(new_record)
    
    db.commit()
    return {"message": "Roaster updated successfully"}
