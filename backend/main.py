import os
import uvicorn
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from backend.database.database import engine, Base, SessionLocal
from backend.models import models
from backend.routers import auth, users, attendance, analytics, roaster
from backend.auth.security import get_password_hash

from sqlalchemy import text
from contextlib import asynccontextmanager

# Indian Standard Time (IST)
from backend.models.models import IST

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Create tables if not existed
    Base.metadata.create_all(bind=engine)

    # Auto-migrate: Add columns if they are missing
    try:
        with engine.begin() as conn:
            # 1. check_out_time in attendance
            try:
                if engine.dialect.name == "sqlite":
                    conn.execute(text("ALTER TABLE attendance ADD COLUMN check_out_time DATETIME NULL;"))
                else:
                    conn.execute(text("ALTER TABLE attendance ADD COLUMN check_out_time TIMESTAMP NULL;"))
            except Exception:
                pass # Already exists or table missing
            
            # 2. is_week_off in daily_roasters
            try:
                conn.execute(text("ALTER TABLE daily_roasters ADD COLUMN is_week_off INTEGER DEFAULT 0;"))
            except Exception:
                pass # Already exists or table missing
    except Exception as e:
        print(f"Migration warning: {e}")

    # Ensure one default admin
    db = SessionLocal()
    try:
        admin_exists = db.query(models.User).filter(models.User.employee_id == "admin").first()
        if not admin_exists:
            admin_user = models.User(
                name="System Admin",
                employee_id="admin",
                password_hash=get_password_hash("admin123"),
                role=models.RoleEnum.ADMIN,
                phone="0000000000"
            )
            db.add(admin_user)
            db.commit()
    except Exception as e:
        print(f"Admin creation error: {e}")
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

@app.get("/")
def read_root():
    return {"message": "Welcome to Smart Staff Attendance System API. View docs at /docs"}

if __name__ == "__main__":
    uvicorn.run("backend.main:app", host="0.0.0.0", port=8000, reload=True)
