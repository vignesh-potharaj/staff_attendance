from sqlalchemy import Column, Integer, String, Float, ForeignKey, DateTime, Enum as SQLEnum, Time, Text
from sqlalchemy.orm import relationship
from datetime import datetime, timezone, timedelta
import enum
from backend.database.database import Base

# Indian Standard Time (IST)
IST = timezone(timedelta(hours=5, minutes=30))

class RoleEnum(str, enum.Enum):
    ADMIN = "ADMIN"
    STAFF = "STAFF"

class UserStatus(str, enum.Enum):
    PENDING_VERIFICATION = "PENDING_VERIFICATION"
    ACTIVE = "ACTIVE"
    SUSPENDED = "SUSPENDED"

class AttendanceStatus(str, enum.Enum):
    PRESENT = "PRESENT"
    LATE = "LATE"

# Shift model is removed as per requirements. Shifts are solely managed via DailyRoaster.

class Tenant(Base):
    __tablename__ = "tenants"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False)
    slug = Column(String, unique=True, index=True, nullable=False)
    status = Column(String, default="ACTIVE", nullable=False)
    subscription_status = Column(String, default="PENDING", nullable=False)
    subscription_plan_name = Column(String, default="Smart Attend Monthly", nullable=True)
    subscription_amount_paise = Column(Integer, default=30000, nullable=True)
    subscription_currency = Column(String, default="INR", nullable=True)
    subscription_current_start = Column(DateTime, nullable=True)
    subscription_current_end = Column(DateTime, nullable=True)
    razorpay_customer_id = Column(String, nullable=True, index=True)
    razorpay_subscription_id = Column(String, nullable=True, index=True)
    billing_last_event_at = Column(DateTime, nullable=True)
    geofence_maps_link = Column(String, nullable=True)
    geofence_latitude = Column(Float, nullable=True)
    geofence_longitude = Column(Float, nullable=True)
    geofence_radius_meters = Column(Integer, default=100, nullable=False)
    created_at = Column(DateTime, default=lambda: datetime.now(IST).replace(tzinfo=None))

    users = relationship("User", back_populates="tenant")
    billing_payments = relationship("BillingPayment", back_populates="tenant")

class BillingPayment(Base):
    __tablename__ = "billing_payments"

    id = Column(Integer, primary_key=True, index=True)
    tenant_id = Column(Integer, ForeignKey("tenants.id"), nullable=False, index=True)
    razorpay_event_id = Column(String, nullable=True, index=True)
    razorpay_payment_id = Column(String, nullable=True, index=True)
    razorpay_invoice_id = Column(String, nullable=True, index=True)
    razorpay_subscription_id = Column(String, nullable=True, index=True)
    amount_paise = Column(Integer, default=0, nullable=False)
    currency = Column(String, default="INR", nullable=False)
    status = Column(String, nullable=False)
    paid_at = Column(DateTime, nullable=True)
    failure_reason = Column(String, nullable=True)
    raw_event = Column(Text, nullable=True)
    created_at = Column(DateTime, default=lambda: datetime.now(IST).replace(tzinfo=None))

    tenant = relationship("Tenant", back_populates="billing_payments")

class DailyRoaster(Base):
    __tablename__ = "daily_roasters"

    id = Column(Integer, primary_key=True, index=True)
    tenant_id = Column(Integer, ForeignKey("tenants.id"), nullable=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"))
    date = Column(String, index=True) # YYYY-MM-DD
    start_time = Column(Time, nullable=True)
    end_time = Column(Time, nullable=True)
    is_leave = Column(Integer, default=0) # SQLite doesn't have strict boolean, but Integer 0/1 works
    is_week_off = Column(Integer, default=0)
    created_at = Column(DateTime, default=lambda: datetime.now(IST).replace(tzinfo=None))

    user = relationship("User")

class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String)
    employee_id = Column(String, unique=True, index=True)
    email = Column(String, index=True, nullable=True)
    tenant_id = Column(Integer, ForeignKey("tenants.id"), nullable=True, index=True)
    password_hash = Column(String)
    role = Column(SQLEnum(RoleEnum), default=RoleEnum.STAFF)
    phone = Column(String)
    status = Column(SQLEnum(UserStatus), default=UserStatus.PENDING_VERIFICATION)
    is_email_verified = Column(Integer, default=0)
    failed_login_attempts = Column(Integer, default=0)
    locked_until = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=lambda: datetime.now(IST).replace(tzinfo=None))

    tenant = relationship("Tenant", back_populates="users")
    attendance_records = relationship("Attendance", back_populates="user")

class Attendance(Base):
    __tablename__ = "attendance"

    id = Column(Integer, primary_key=True, index=True)
    tenant_id = Column(Integer, ForeignKey("tenants.id"), nullable=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"))
    date = Column(String) # Storing YYYY-MM-DD for easy querying
    check_in_time = Column(DateTime, default=lambda: datetime.now(IST).replace(tzinfo=None))
    photo_url = Column(String)
    latitude = Column(Float)
    longitude = Column(Float)
    status = Column(SQLEnum(AttendanceStatus))
    device_info = Column(String)
    check_out_time = Column(DateTime, nullable=True)
    check_out_photo_url = Column(String, nullable=True)
    created_at = Column(DateTime, default=lambda: datetime.now(IST).replace(tzinfo=None))

    user = relationship("User", back_populates="attendance_records")

class EmailVerificationToken(Base):
    __tablename__ = "email_verification_tokens"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    token_hash = Column(String, nullable=False, index=True)
    expires_at = Column(DateTime, nullable=False)
    used_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=lambda: datetime.now(IST).replace(tzinfo=None))

class PasswordResetToken(Base):
    __tablename__ = "password_reset_tokens"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    token_hash = Column(String, nullable=False, index=True)
    expires_at = Column(DateTime, nullable=False)
    used_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=lambda: datetime.now(IST).replace(tzinfo=None))
