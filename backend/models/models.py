from sqlalchemy import Column, Integer, String, Float, ForeignKey, DateTime, Enum as SQLEnum, Time
from sqlalchemy.orm import relationship
from datetime import datetime, timezone
import enum
from backend.database.database import Base

class RoleEnum(str, enum.Enum):
    ADMIN = "ADMIN"
    STAFF = "STAFF"

class AttendanceStatus(str, enum.Enum):
    PRESENT = "PRESENT"
    LATE = "LATE"

class Shift(Base):
    __tablename__ = "shifts"

    id = Column(Integer, primary_key=True, index=True)
    shift_name = Column(String, unique=True, index=True)
    start_time = Column(Time)
    end_time = Column(Time)
    grace_period_minutes = Column(Integer, default=15)

    users = relationship("User", back_populates="shift")

class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String)
    employee_id = Column(String, unique=True, index=True)
    password_hash = Column(String)
    role = Column(SQLEnum(RoleEnum), default=RoleEnum.STAFF)
    phone = Column(String)
    shift_id = Column(Integer, ForeignKey("shifts.id"), nullable=True)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))

    shift = relationship("Shift", back_populates="users")
    attendance_records = relationship("Attendance", back_populates="user")

class Attendance(Base):
    __tablename__ = "attendance"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"))
    date = Column(String) # Storing YYYY-MM-DD for easy querying
    check_in_time = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    photo_url = Column(String)
    latitude = Column(Float)
    longitude = Column(Float)
    status = Column(SQLEnum(AttendanceStatus))
    device_info = Column(String)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))

    user = relationship("User", back_populates="attendance_records")
