from pydantic import BaseModel, ConfigDict
from typing import Optional, List
from datetime import datetime, time
from backend.models.models import RoleEnum, AttendanceStatus

class Token(BaseModel):
    access_token: str
    token_type: str
    user: dict

class TokenData(BaseModel):
    employee_id: str | None = None
    role: str | None = None

class ShiftBase(BaseModel):
    shift_name: str
    start_time: time
    end_time: time
    grace_period_minutes: int

class ShiftCreate(ShiftBase):
    pass

class ShiftResponse(ShiftBase):
    id: int
    model_config = ConfigDict(from_attributes=True)

class UserBase(BaseModel):
    name: str
    employee_id: str
    phone: str
    role: RoleEnum
    shift_id: Optional[int] = None

class UserCreate(UserBase):
    password: str

class UserUpdate(BaseModel):
    name: Optional[str] = None
    phone: Optional[str] = None
    role: Optional[RoleEnum] = None
    shift_id: Optional[int] = None
    password: Optional[str] = None

class UserResponse(UserBase):
    id: int
    created_at: datetime
    shift: Optional[ShiftResponse] = None
    model_config = ConfigDict(from_attributes=True)

class AttendanceBase(BaseModel):
    date: str
    check_in_time: datetime
    photo_url: str
    latitude: float
    longitude: float
    status: AttendanceStatus
    device_info: str

class AttendanceCreate(BaseModel):
    latitude: float
    longitude: float
    device_info: str
    # photo will be handled as UploadFile in FastAPI, so not all fields go here.

class AttendanceResponse(AttendanceBase):
    id: int
    user_id: int
    user: Optional[UserBase] = None
    model_config = ConfigDict(from_attributes=True)

class AnalyticsSummary(BaseModel):
    total_staff: int
    present_today: int
    absent_today: int
    late_today: int
