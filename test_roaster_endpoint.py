#!/usr/bin/env python3
"""
Comprehensive test script for roaster endpoint and database
Run this to diagnose any issues before deploying to Render
"""

import os
import sys
import asyncio
from datetime import datetime, time
import json

# Add parent directory to path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from backend.database.database import engine, SessionLocal, Base
from backend.models.models import DailyRoaster, User
from backend.database.migrations import run_migrations
from sqlalchemy import text, inspect
from sqlalchemy.orm import Session

def print_header(text):
    print(f"\n{'='*60}")
    print(f"  {text}")
    print(f"{'='*60}\n")

def test_database_connection():
    """Test basic database connection"""
    print_header("TEST 1: Database Connection")
    try:
        with engine.begin() as conn:
            result = conn.execute(text("SELECT 1")).scalar()
        print("✅ Database connection: SUCCESS")
        print(f"   Database type: {engine.dialect.name}")
        return True
    except Exception as e:
        print(f"❌ Database connection: FAILED")
        print(f"   Error: {e}")
        return False

def test_tables_exist():
    """Check if all required tables exist"""
    print_header("TEST 2: Table Verification")
    try:
        inspector = inspect(engine)
        tables = inspector.get_table_names()
        
        required_tables = ['users', 'attendance', 'daily_roasters']
        print(f"Available tables: {tables}\n")
        
        for table in required_tables:
            if table in tables:
                cols = [c['name'] for c in inspector.get_columns(table)]
                print(f"✅ {table}: EXISTS")
                print(f"   Columns: {', '.join(cols)}")
            else:
                print(f"❌ {table}: MISSING")
        
        # Specific check for is_week_off column
        if 'daily_roasters' in tables:
            cols = [c['name'] for c in inspector.get_columns('daily_roasters')]
            if 'is_week_off' in cols:
                print(f"\n✅ is_week_off column: EXISTS")
            else:
                print(f"\n❌ is_week_off column: MISSING - This will cause 500 errors!")
                return False
        
        return all(t in tables for t in required_tables)
    except Exception as e:
        print(f"❌ Table verification: FAILED")
        print(f"   Error: {e}")
        return False

def test_tables_createable():
    """Test if tables can be created via SQLAlchemy"""
    print_header("TEST 3: Table Creation (SQLAlchemy)")
    try:
        Base.metadata.create_all(bind=engine)
        print("✅ Table creation: SUCCESS")
        print("   All tables created or verified")
        return True
    except Exception as e:
        print(f"❌ Table creation: FAILED")
        print(f"   Error: {e}")
        return False

def test_migrations():
    """Run migration script"""
    print_header("TEST 4: Database Migrations")
    try:
        run_migrations()
        print("✅ Migrations: SUCCESS")
        return True
    except Exception as e:
        print(f"⚠️  Migrations: WARNING")
        print(f"   Error: {e}")
        return False

def test_sample_data():
    """Create sample test data"""
    print_header("TEST 5: Sample Data Creation")
    try:
        db = SessionLocal()
        today = datetime.now().strftime("%Y-%m-%d")
        
        # Check if admin user exists
        admin = db.query(User).filter(User.employee_id == "admin").first()
        if not admin:
            print("❌ Admin user not found - creating one...")
            try:
                from backend.auth.security import get_password_hash
                admin = User(
                    name="System Admin",
                    employee_id="admin",
                    password_hash=get_password_hash("admin123"),
                    role="ADMIN",
                    phone="0000000000"
                )
            except ImportError:
                # Fallback if imports fail
                admin = User(
                    name="System Admin",
                    employee_id="admin",
                    password_hash="hashed_password",
                    role="ADMIN",
                    phone="0000000000"
                )
            db.add(admin)
            db.commit()
            print("✅ Admin user created")
        else:
            print(f"✅ Admin user exists: {admin.name}")
        
        # Check for test staff users
        staff_users = db.query(User).filter(User.role == "STAFF").limit(3).all()
        if not staff_users:
            print("⚠️  No staff users found - creating test staff...")
            try:
                from backend.auth.security import get_password_hash
                pwd_hash = get_password_hash("password")
            except ImportError:
                pwd_hash = "hashed_password"
            
            for i in range(1, 4):
                staff = User(
                    name=f"Test Staff {i}",
                    employee_id=f"EMP-{i:03d}",
                    password_hash=pwd_hash,
                    role="STAFF",
                    phone=f"900000000{i}"
                )
                db.add(staff)
            db.commit()
            print("✅ Test staff users created")
            staff_users = db.query(User).filter(User.role == "STAFF").limit(3).all()
        else:
            print(f"✅ Found {len(staff_users)} staff users")
        
        # Create sample roaster records for today
        existing_roasters = db.query(DailyRoaster).filter(DailyRoaster.date == today).count()
        if existing_roasters == 0:
            print(f"\nCreating sample roaster records for {today}...")
            test_records = [
                DailyRoaster(
                    user_id=staff_users[0].id,
                    date=today,
                    start_time=time(10, 0),
                    end_time=time(18, 30),
                    is_leave=0,
                    is_week_off=0
                ),
                DailyRoaster(
                    user_id=staff_users[1].id if len(staff_users) > 1 else staff_users[0].id + 1,
                    date=today,
                    start_time=None,
                    end_time=None,
                    is_leave=1,
                    is_week_off=0
                ),
                DailyRoaster(
                    user_id=staff_users[2].id if len(staff_users) > 2 else staff_users[0].id + 2,
                    date=today,
                    start_time=None,
                    end_time=None,
                    is_leave=0,
                    is_week_off=1
                ),
            ]
            for record in test_records:
                db.add(record)
            db.commit()
            print(f"✅ Created {len(test_records)} sample roaster records")
        else:
            print(f"✅ Roaster records already exist for {today}: {existing_roasters} records")
        
        db.close()
        return True
    except Exception as e:
        print(f"❌ Sample data creation: FAILED")
        print(f"   Error: {e}")
        import traceback
        traceback.print_exc()
        return False

def test_roaster_query():
    """Test querying roaster data"""
    print_header("TEST 6: Roaster Query Test")
    try:
        db = SessionLocal()
        today = datetime.now().strftime("%Y-%m-%d")
        
        records = db.query(DailyRoaster).filter(DailyRoaster.date == today).all()
        print(f"✅ Query executed successfully")
        print(f"   Found {len(records)} records for {today}\n")
        
        if records:
            print("Sample record details:")
            for i, record in enumerate(records[:2], 1):
                print(f"\n   Record {i}:")
                print(f"      ID: {record.id}")
                print(f"      User ID: {record.user_id}")
                print(f"      Date: {record.date}")
                print(f"      Start Time: {record.start_time} (type: {type(record.start_time).__name__})")
                print(f"      End Time: {record.end_time} (type: {type(record.end_time).__name__})")
                print(f"      Is Leave: {record.is_leave}")
                print(f"      Is Week Off: {record.is_week_off}")
        
        db.close()
        return True
    except Exception as e:
        print(f"❌ Roaster query: FAILED")
        print(f"   Error: {e}")
        import traceback
        traceback.print_exc()
        return False

def test_time_serialization():
    """Test time field serialization to JSON"""
    print_header("TEST 7: Time Serialization Test")
    try:
        db = SessionLocal()
        today = datetime.now().strftime("%Y-%m-%d")
        
        records = db.query(DailyRoaster).filter(DailyRoaster.date == today).all()
        print("Testing time field serialization:\n")
        
        for i, record in enumerate(records[:2], 1):
            print(f"   Record {i}:")
            
            # Test start_time serialization
            if record.start_time is not None:
                try:
                    iso_str = record.start_time.isoformat()
                    print(f"      Start Time: {record.start_time} → '{iso_str}' ✅")
                except Exception as e:
                    print(f"      Start Time: ERROR - {e} ❌")
            else:
                print(f"      Start Time: None ✅")
            
            # Test end_time serialization
            if record.end_time is not None:
                try:
                    iso_str = record.end_time.isoformat()
                    print(f"      End Time: {record.end_time} → '{iso_str}' ✅")
                except Exception as e:
                    print(f"      End Time: ERROR - {e} ❌")
            else:
                print(f"      End Time: None ✅")
        
        db.close()
        return True
    except Exception as e:
        print(f"❌ Time serialization: FAILED")
        print(f"   Error: {e}")
        return False

def generate_report():
    """Run all tests and generate report"""
    print_header("ROASTER ENDPOINT DIAGNOSTIC TEST SUITE")
    
    results = {
        "Database Connection": test_database_connection(),
        "Tables Exist": test_tables_exist(),
        "Tables Creatable": test_tables_createable(),
        "Migrations": test_migrations(),
        "Sample Data": test_sample_data(),
        "Roaster Query": test_roaster_query(),
        "Time Serialization": test_time_serialization(),
    }
    
    print_header("FINAL REPORT")
    
    passed = sum(1 for v in results.values() if v)
    total = len(results)
    
    for test, result in results.items():
        status = "✅ PASS" if result else "❌ FAIL"
        print(f"{status} - {test}")
    
    print(f"\nTotal: {passed}/{total} tests passed")
    
    if passed == total:
        print("\n🎉 ALL TESTS PASSED - Ready for deployment!")
    else:
        print(f"\n⚠️  {total - passed} test(s) failed - Fix issues before deploying")
    
    print_header("END OF REPORT")
    
    return passed == total

if __name__ == "__main__":
    success = generate_report()
    sys.exit(0 if success else 1)
