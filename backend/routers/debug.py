from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import text, inspect
import os
import logging

from backend.database.database import get_db, engine
from backend.models.models import DailyRoaster, User, Attendance, Tenant

logger = logging.getLogger(__name__)

router = APIRouter(
    prefix="/debug",
    tags=["Debug"]
)

@router.delete("/purge-unverified-user/{employee_id}")
async def purge_unverified_user(employee_id: str, db: Session = Depends(get_db)):
    """
    TEMPORARY UTILITY: Delete an unverified user (and their tenant) entirely from the database 
    so you can register again from scratch.
    """
    user = db.query(User).filter(User.employee_id == employee_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    if user.is_email_verified:
        raise HTTPException(status_code=400, detail="Cannot delete a verified user from this endpoint.")
    
    tenant_id = user.tenant_id
    
    # Delete the user 
    db.delete(user)
    db.commit()
    
    # Check if tenant has any other users; if not, delete the tenant
    remaining_users = db.query(User).filter(User.tenant_id == tenant_id).count()
    if remaining_users == 0 and tenant_id:
        tenant = db.query(Tenant).filter(Tenant.id == tenant_id).first()
        if tenant and tenant.slug != "default":
            db.delete(tenant)
            db.commit()
            
    return {"status": "success", "message": f"Successfully purged unverified user {employee_id} and their workspace."}

@router.get("/db-status")
async def db_status(db: Session = Depends(get_db)):
    """Check database connection and tables"""
    try:
        # Test connection
        result = db.execute(text("SELECT 1")).scalar()
        
        # Get database type
        db_type = engine.dialect.name
        
        # Get tables
        inspector = inspect(engine)
        tables = inspector.get_table_names()
        
        # Check daily_roasters table columns
        daily_roasters_cols = []
        if 'daily_roasters' in tables:
            daily_roasters_cols = [c['name'] for c in inspector.get_columns('daily_roasters')]
        
        return {
            "status": "OK",
            "database_type": db_type,
            "connection": "working",
            "tables": tables,
            "daily_roasters_columns": daily_roasters_cols,
            "DATABASE_URL_set": bool(os.getenv("DATABASE_URL")),
        }
    except Exception as e:
        logger.error(f"DB Status error: {str(e)}", exc_info=True)
        return {
            "status": "ERROR",
            "error": str(e),
            "error_type": type(e).__name__,
            "DATABASE_URL_set": bool(os.getenv("DATABASE_URL")),
        }

@router.get("/test-query")
async def test_query(db: Session = Depends(get_db)):
    """Test actual query to daily_roasters"""
    try:
        date = "2026-04-01"
        
        # Test raw SQL
        raw_result = db.execute(
            text(f"SELECT * FROM daily_roasters WHERE date = :date LIMIT 1"),
            {"date": date}
        ).fetchall()
        
        # Test ORM query
        orm_result = db.query(DailyRoaster).filter(DailyRoaster.date == date).all()
        
        return {
            "status": "OK",
            "date": date,
            "raw_sql_count": len(raw_result) if raw_result else 0,
            "orm_count": len(orm_result),
            "sample_raw": str(raw_result[0]) if raw_result else None,
            "sample_orm": {
                "id": orm_result[0].id,
                "user_id": orm_result[0].user_id,
                "start_time": str(orm_result[0].start_time),
                "start_time_type": str(type(orm_result[0].start_time)),
            } if orm_result else None,
        }
    except Exception as e:
        logger.error(f"Query test error: {str(e)}", exc_info=True)
        return {
            "status": "ERROR",
            "error": str(e),
            "error_type": type(e).__name__,
            "traceback": str(e.__traceback__),
        }

@router.get("/test-time-conversion")
async def test_time_conversion():
    """Test time object conversion to ISO format"""
    try:
        from datetime import time
        
        # Create test time objects
        test_time = time(10, 30, 45)
        test_time_none = None
        
        # Try conversion
        iso_result = test_time.isoformat()
        iso_result_none = test_time_none.isoformat() if test_time_none else None
        
        return {
            "status": "OK",
            "test_time": str(test_time),
            "iso_result": iso_result,
            "iso_result_none": iso_result_none,
        }
    except Exception as e:
        logger.error(f"Time conversion error: {str(e)}", exc_info=True)
        return {
            "status": "ERROR",
            "error": str(e),
            "error_type": type(e).__name__,
        }

@router.get("/test-roaster-endpoint")
async def test_roaster_endpoint(db: Session = Depends(get_db)):
    """Simulate the roaster endpoint logic"""
    try:
        date = "2026-04-01"
        records = db.query(DailyRoaster).filter(DailyRoaster.date == date).all()
        
        logger.info(f"Found {len(records)} records for date {date}")
        
        result = []
        for i, record in enumerate(records):
            try:
                # Handle time serialization
                if record.start_time is not None:
                    start_str = record.start_time.isoformat() if hasattr(record.start_time, 'isoformat') else str(record.start_time)
                else:
                    start_str = None
                    
                if record.end_time is not None:
                    end_str = record.end_time.isoformat() if hasattr(record.end_time, 'isoformat') else str(record.end_time)
                else:
                    end_str = None
                
                item = {
                    "id": record.id,
                    "user_id": record.user_id,
                    "date": record.date,
                    "start_time": start_str,
                    "end_time": end_str,
                    "is_leave": bool(record.is_leave) if record.is_leave is not None else False,
                    "is_week_off": bool(record.is_week_off) if record.is_week_off is not None else False,
                }
                result.append(item)
                logger.info(f"Record {i}: {item}")
            except Exception as e:
                logger.error(f"Error processing record {i}: {str(e)}", exc_info=True)
                return {
                    "status": "ERROR",
                    "error": f"Error processing record {i}: {str(e)}",
                    "record_index": i,
                    "record_raw": {
                        "id": record.id,
                        "user_id": record.user_id,
                        "start_time_type": str(type(record.start_time)),
                        "end_time_type": str(type(record.end_time)),
                    }
                }
        
        return {
            "status": "OK",
            "records_count": len(result),
            "records": result,
        }
    except Exception as e:
        logger.error(f"Roaster test error: {str(e)}", exc_info=True)
        return {
            "status": "ERROR",
            "error": str(e),
            "error_type": type(e).__name__,
        }
