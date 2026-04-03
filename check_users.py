from backend.database.database import SessionLocal
from backend.models.models import User

db = SessionLocal()
users = db.query(User).all()
print(f"Total users in database: {len(users)}")
for user in users:
    print(f"  - ID: {user.id}, Employee ID: {user.employee_id}, Name: {user.name}, Role: {user.role}")
    print(f"    Password hash exists: {bool(user.password_hash)}")
db.close()
