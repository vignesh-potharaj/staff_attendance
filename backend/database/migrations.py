"""
Database migration utilities
"""
import logging
from sqlalchemy import text, inspect
from backend.database.database import engine

logger = logging.getLogger(__name__)

def run_migrations():
    """Run all pending database migrations"""
    inspector = inspect(engine)
    tables = inspector.get_table_names()
    
    with engine.begin() as conn:
        # Ensure daily_roasters has all required columns
        if 'daily_roasters' in tables:
            columns = {col['name'] for col in inspector.get_columns('daily_roasters')}
            
            # Check and add is_week_off column
            if 'is_week_off' not in columns:
                logger.info("Adding is_week_off column to daily_roasters...")
                try:
                    if engine.dialect.name == "postgresql":
                        conn.execute(text("ALTER TABLE daily_roasters ADD COLUMN is_week_off INTEGER DEFAULT 0;"))
                    else:
                        conn.execute(text("ALTER TABLE daily_roasters ADD COLUMN is_week_off INTEGER DEFAULT 0;"))
                    logger.info("✓ is_week_off column added successfully")
                except Exception as e:
                    logger.error(f"Failed to add is_week_off column: {e}")
            
            # Check and add check_out_time to attendance
        if 'attendance' in tables:
            columns = {col['name'] for col in inspector.get_columns('attendance')}
            
            if 'check_out_time' not in columns:
                logger.info("Adding check_out_time column to attendance...")
                try:
                    if engine.dialect.name == "postgresql":
                        conn.execute(text("ALTER TABLE attendance ADD COLUMN check_out_time TIMESTAMP NULL;"))
                    else:
                        conn.execute(text("ALTER TABLE attendance ADD COLUMN check_out_time DATETIME NULL;"))
                    logger.info("✓ check_out_time column added successfully")
                except Exception as e:
                    logger.error(f"Failed to add check_out_time column: {e}")
    
    logger.info("Database migrations completed successfully")
