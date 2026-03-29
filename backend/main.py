import os
import uvicorn
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from backend.database.database import engine, Base, SessionLocal
from backend.models import models
from backend.routers import auth, users, attendance, analytics, roaster
from backend.auth.security import get_password_hash

# Create tables if not existed
Base.metadata.create_all(bind=engine)

# Ensure one default admin
db = SessionLocal()
admin_exists = db.query(models.User).filter(models.User.employee_id == "admin").first()
if not admin_exists:
    admin_user = models.User(
        name="System Admin",
        employee_id="admin",
        password_hash=get_password_hash("admin123"), # Default password, to be changed in production
        role=models.RoleEnum.ADMIN,
        phone="0000000000"
    )
    db.add(admin_user)
    db.commit()
db.close()

app = FastAPI(title="Smart Staff Attendance API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], # For production, restrict this.
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
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
