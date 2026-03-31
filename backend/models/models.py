from sqlalchemy import Column, Integer, String, Float, ForeignKey, DateTime, Enum as SQLEnum, Time
from sqlalchemy.orm import relationship
from datetime import datetime, timezone, timedelta
import enum
from backend.database.database import Base

# Indian Standard Time (IST)
IST = timezone(timedelta(hours=5, minutes=30))

class RoleEnum(str, enum.Enum):
    ADMIN = "ADMIN"
    STAFF = "STAFF"

class AttendanceStatus(str, enum.Enum):
    PRESENT = "PRESENT"
    LATE = "LATE"

# Shift model is removed as per requirements. Shifts are solely managed via DailyRoaster.

class DailyRoaster(Base):
    __tablename__ = "daily_roasters"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"))
    date = Column(String, index=True) # YYYY-MM-DD
    start_time = Column(Time, nullable=True)
    end_time = Column(Time, nullable=True)
    is_leave = Column(Integer, default=0) # SQLite doesn't have strict boolean, but Integer 0/1 works
    created_at = Column(DateTime, default=lambda: datetime.now(IST))

    user = relationship("User")

class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String)
    employee_id = Column(String, unique=True, index=True)
    password_hash = Column(String)
    role = Column(SQLEnum(RoleEnum), default=RoleEnum.STAFF)
    phone = Column(String)
    created_at = Column(DateTime, default=lambda: datetime.now(IST))

    attendance_records = relationship("Attendance", back_populates="user")

class Attendance(Base):
    __tablename__ = "attendance"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"))
    date = Column(String) # Storing YYYY-MM-DD for easy querying
    check_in_time = Column(DateTime, default=lambda: datetime.now(IST))
    photo_url = Column(String)
    latitude = Column(Float)
    longitude = Column(Float)
    status = Column(SQLEnum(AttendanceStatus))
    device_info = Column(String)
    check_out_time = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=lambda: datetime.now(IST))

    user = relationship("User", back_populates="attendance_records")
