from typing import List
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from backend.database.database import get_db
from backend.models.models import Shift
from backend.schemas.schemas import ShiftCreate, ShiftResponse
from backend.auth.dependencies import get_current_admin, get_current_user

router = APIRouter(
    prefix="/shifts",
    tags=["Shifts"]
)

@router.get("/", response_model=List[ShiftResponse], dependencies=[Depends(get_current_user)])
def get_shifts(skip: int = 0, limit: int = 100, db: Session = Depends(get_db)):
    # Both Admin and Staff can view shifts, but staff doesn't need pagination generally.
    shifts = db.query(Shift).offset(skip).limit(limit).all()
    return shifts

@router.post("/", response_model=ShiftResponse, dependencies=[Depends(get_current_admin)])
def create_shift(shift: ShiftCreate, db: Session = Depends(get_db)):
    db_shift = db.query(Shift).filter(Shift.shift_name == shift.shift_name).first()
    if db_shift:
        raise HTTPException(status_code=400, detail="Shift name already registered")
    
    new_shift = Shift(**shift.model_dump())
    db.add(new_shift)
    db.commit()
    db.refresh(new_shift)
    return new_shift

@router.delete("/{shift_id}", dependencies=[Depends(get_current_admin)])
def delete_shift(shift_id: int, db: Session = Depends(get_db)):
    db_shift = db.query(Shift).filter(Shift.id == shift_id).first()
    if not db_shift:
        raise HTTPException(status_code=404, detail="Shift not found")
    
    db.delete(db_shift)
    db.commit()
    return {"message": "Shift deleted successfully"}
