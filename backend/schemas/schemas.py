from pydantic import BaseModel, ConfigDict
from typing import Optional, List
from datetime import datetime
from backend.models.models import RoleEnum, AttendanceStatus

class Token(BaseModel):
    access_token: str
    token_type: str
    user: dict

class TokenData(BaseModel):
    employee_id: str | None = None
    role: str | None = None

# Shift schemas are removed as per requirements.

class DailyRoasterBase(BaseModel):
    user_id: int
    date: str
    start_time: Optional[str] = None  # Changed from time to str for SQLite compatibility
    end_time: Optional[str] = None    # Changed from time to str for SQLite compatibility
    is_leave: bool = False
    is_week_off: bool = False

class DailyRoasterCreate(DailyRoasterBase):
    pass

class DailyRoasterResponse(DailyRoasterBase):
    id: int
    model_config = ConfigDict(from_attributes=True)

class UserBase(BaseModel):
    name: str
    employee_id: str
    phone: str
    role: RoleEnum

class UserCreate(UserBase):
    password: str

class UserUpdate(BaseModel):
    name: Optional[str] = None
    phone: Optional[str] = None
    role: Optional[RoleEnum] = None
    password: Optional[str] = None

class UserResponse(UserBase):
    id: int
    created_at: datetime
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
    check_out_time: Optional[datetime] = None
    check_out_photo_url: Optional[str] = None  # URL to check-out photo (local or Google Drive)
    model_config = ConfigDict(from_attributes=True)

class AnalyticsSummary(BaseModel):
    total_staff: int
    present_today: int
    absent_today: int
    late_today: int
