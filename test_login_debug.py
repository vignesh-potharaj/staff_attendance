import requests
import json

BASE_URL = "http://localhost:8000"

# Test login
print("=== Testing Login ===")
try:
    login_data = {
        "username": "EMP-101",  # Using employee_id
        "password": "password123"
    }
    
    response = requests.post(
        f"{BASE_URL}/auth/login",
        data=login_data,  # OAuth2 requires form data, not JSON
        headers={"Content-Type": "application/x-www-form-urlencoded"}
    )
    
    print(f"Status: {response.status_code}")
    print(f"Response: {response.text}")
    
    if response.status_code == 200:
        data = response.json()
        print(f"Login successful!")
        print(f"Token: {data['access_token'][:20]}...")
        print(f"User: {data['user']}")
    else:
        print(f"Login failed with status {response.status_code}")
        
except Exception as e:
    print(f"Error: {e}")

# Check if user exists in database
print("\n=== Checking Users in Database ===")
try:
    from backend.database.database import SessionLocal
    from backend.models.models import User
    
    db = SessionLocal()
    users = db.query(User).all()
    print(f"Total users in database: {len(users)}")
    for user in users:
        print(f"  - {user.employee_id}: {user.name} (role: {user.role})")
    db.close()
except Exception as e:
    print(f"Error: {e}")
