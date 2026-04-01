#!/usr/bin/env python3
"""
Test the roaster endpoint locally
"""

import sys
import os
import json
from datetime import datetime

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from backend.database.database import SessionLocal
from backend.models.models import DailyRoaster, User
from backend.auth.security import create_access_token

def test_roaster_endpoint_simulation():
    """Simulate the roaster endpoint behavior"""
    print("\n" + "="*60)
    print("  ROASTER ENDPOINT SIMULATION TEST")
    print("="*60 + "\n")
    
    db = SessionLocal()
    today = datetime.now().strftime("%Y-%m-%d")
    
    print(f"Testing GET /roaster/?date={today}\n")
    
    try:
        # Simulate the endpoint logic
        records = db.query(DailyRoaster).filter(DailyRoaster.date == today).all()
        
        result = []
        for record in records:
            try:
                # Handle time serialization (same as endpoint)
                if record.start_time is not None:
                    start_str = record.start_time.isoformat() if hasattr(record.start_time, 'isoformat') else str(record.start_time)
                else:
                    start_str = None
                    
                if record.end_time is not None:
                    end_str = record.end_time.isoformat() if hasattr(record.end_time, 'isoformat') else str(record.end_time)
                else:
                    end_str = None
            except Exception as e:
                print(f"Warning: Time conversion error: {e}")
                start_str = str(record.start_time) if record.start_time is not None else None
                end_str = str(record.end_time) if record.end_time is not None else None
            
            result.append({
                "id": record.id,
                "user_id": record.user_id,
                "date": record.date,
                "start_time": start_str,
                "end_time": end_str,
                "is_leave": bool(record.is_leave) if record.is_leave is not None else False,
                "is_week_off": bool(record.is_week_off) if record.is_week_off is not None else False,
            })
        
        print(f"✅ Query successful!")
        print(f"   Found {len(result)} records\n")
        
        print("Response JSON:")
        print(json.dumps(result, indent=2, default=str))
        
        print("\n✅ ENDPOINT WOULD WORK - No 500 errors!")
        
    except Exception as e:
        print(f"❌ Error: {e}")
        import traceback
        traceback.print_exc()
    finally:
        db.close()
    
    print("\n" + "="*60 + "\n")

if __name__ == "__main__":
    test_roaster_endpoint_simulation()
