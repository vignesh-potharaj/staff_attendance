import os
import uvicorn
import logging
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import JSONResponse

from backend.database.database import engine, Base, SessionLocal
from backend.models import models
from backend.routers import auth, users, attendance, analytics, roaster, debug, settings, billing, payroll, super_admin_auth, super_admin, notifications, locations
from backend.auth.security import get_password_hash
from backend.database.migrations import run_migrations

from sqlalchemy import text
from contextlib import asynccontextmanager

# Setup logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Indian Standard Time (IST)
from backend.models.models import IST

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Create tables if not existed
    Base.metadata.create_all(bind=engine)
    
    # Run database migrations
    logger.info("Running database migrations...")
    run_migrations()

    # Ensure 4 isolated tenants and their admin profiles
    db = SessionLocal()
    try:
        tenants_config = [
            {
                "name": "Admin",
                "slug": "admin",
                "admin_id": "admin",
                "admin_name": "System Admin",
                "email": "admin@local.test",
                "default_pwd": "admin123",
            },
            {
                "name": "TS2024",
                "slug": "ts2024",
                "admin_id": "TS2024",
                "admin_name": "TS2024",
                "email": "ts2024@local.test",
                "default_pwd": "mrcetncc",
            },
            {
                "name": "TS2025",
                "slug": "ts2025",
                "admin_id": "TS2025",
                "admin_name": "TS2025",
                "email": "ts2025@local.test",
                "default_pwd": "mrcetncc",
            },
            {
                "name": "TS2026",
                "slug": "ts2026",
                "admin_id": "TS2026",
                "admin_name": "TS2026",
                "email": "ts2026@local.test",
                "default_pwd": "mrcetncc",
            },
        ]

        for cfg in tenants_config:
            # Match slug ('admin' or legacy 'default' for admin tenant)
            if cfg["slug"] == "admin":
                tenant = db.query(models.Tenant).filter(models.Tenant.slug.in_(["admin", "default"])).first()
            else:
                tenant = db.query(models.Tenant).filter(models.Tenant.slug == cfg["slug"]).first()

            if not tenant:
                tenant = models.Tenant(
                    name=cfg["name"],
                    slug=cfg["slug"],
                    role="tenant",
                    status="ACTIVE",
                    subscription_status="ACTIVE",
                    subscription_plan_name="Smart Attend Monthly",
                    subscription_amount_paise=30000,
                    subscription_currency="INR",
                    geofence_maps_link="https://maps.app.goo.gl/EiVg8Ppzp2VAP33r6",
                    geofence_latitude=17.561286,
                    geofence_longitude=78.456036,
                    geofence_radius_meters=500,
                )
                db.add(tenant)
                db.commit()
                db.refresh(tenant)
            else:
                tenant.name = cfg["name"]
                tenant.slug = cfg["slug"]
                tenant.status = "ACTIVE"
                tenant.subscription_status = "ACTIVE"
                db.commit()

            # Ensure default saved location exists for tenant
            loc = db.query(models.SavedLocation).filter(models.SavedLocation.tenant_id == tenant.id).first()
            if not loc:
                loc = models.SavedLocation(
                    tenant_id=tenant.id,
                    name="College Ground",
                    maps_link=tenant.geofence_maps_link or "https://maps.app.goo.gl/EiVg8Ppzp2VAP33r6",
                    latitude=tenant.geofence_latitude or 17.561286,
                    longitude=tenant.geofence_longitude or 78.456036,
                    radius_meters=tenant.geofence_radius_meters or 500,
                    is_default=1,
                )
                db.add(loc)
                db.commit()

            # Ensure admin user for this tenant
            admin_user = db.query(models.User).filter(models.User.employee_id == cfg["admin_id"]).first()
            if not admin_user:
                admin_user = models.User(
                    name=cfg["admin_name"],
                    employee_id=cfg["admin_id"],
                    email=cfg["email"],
                    password_hash=get_password_hash(cfg["default_pwd"]),
                    role=models.RoleEnum.ADMIN,
                    phone="0000000000",
                    tenant_id=tenant.id,
                    status=models.UserStatus.ACTIVE,
                    is_email_verified=1,
                )
                db.add(admin_user)
                db.commit()
            else:
                admin_user.tenant_id = tenant.id
                admin_user.role = models.RoleEnum.ADMIN
                admin_user.status = models.UserStatus.ACTIVE
                admin_user.is_email_verified = 1
                if not admin_user.email:
                    admin_user.email = cfg["email"]
                db.commit()
    except Exception as e:
        logger.error(f"Tenant / Admin initialization error: {e}")
    finally:
        db.close()
    
    yield

app = FastAPI(title="Smart Staff Attendance API", version="1.0.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "https://staff-attendance-eight.vercel.app",
        "https://staff-attendance-admin.vercel.app",
        "http://localhost:5173",
        "http://localhost:5174",
        "http://localhost:3000"
    ],
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS", "PATCH"],
    allow_headers=["*"],
    allow_origin_regex=".*",
)

os.makedirs("static/images", exist_ok=True)
app.mount("/static", StaticFiles(directory="static"), name="static")

app.include_router(auth.router)
app.include_router(users.router)
app.include_router(attendance.router)
app.include_router(analytics.router)
app.include_router(roaster.router)
app.include_router(notifications.router)
app.include_router(locations.router)
app.include_router(debug.router)
app.include_router(settings.router)
app.include_router(billing.router)
app.include_router(payroll.router)
app.include_router(super_admin_auth.router)
app.include_router(super_admin.router, prefix="/super-admin")

@app.exception_handler(Exception)
async def general_exception_handler(request, exc):
    """Catch unexpected exceptions and log them"""
    logger.error(f"Unhandled exception: {type(exc).__name__}: {str(exc)}", exc_info=exc)
    return JSONResponse(
        status_code=500,
        content={"detail": str(exc) if str(exc) else "Internal server error"},
        headers={
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Methods": "GET,POST,PUT,DELETE,OPTIONS",
            "Access-Control-Allow-Headers": "*",
        }
    )

@app.get("/")
def read_root():
    return {"message": "Welcome to Smart Staff Attendance System API. View docs at /docs"}

if __name__ == "__main__":
    uvicorn.run("backend.main:app", host="0.0.0.0", port=8000, reload=True)
