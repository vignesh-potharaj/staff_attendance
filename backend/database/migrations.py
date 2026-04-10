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
        if "tenants" in tables:
            default_tenant = conn.execute(text("SELECT id FROM tenants WHERE slug = 'default' LIMIT 1")).fetchone()
            if not default_tenant:
                conn.execute(
                    text(
                        "INSERT INTO tenants (name, slug, status, created_at) VALUES "
                        "('Default Workspace', 'default', 'ACTIVE', CURRENT_TIMESTAMP)"
                    )
                )
        tables = inspect(engine).get_table_names()

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

            if 'tenant_id' not in columns:
                logger.info("Adding tenant_id column to daily_roasters...")
                try:
                    conn.execute(text("ALTER TABLE daily_roasters ADD COLUMN tenant_id INTEGER NULL;"))
                    logger.info("✓ tenant_id column added to daily_roasters")
                except Exception as e:
                    logger.error(f"Failed to add tenant_id to daily_roasters: {e}")
            
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
            
            if 'check_out_photo_url' not in columns:
                logger.info("Adding check_out_photo_url column to attendance...")
                try:
                    if engine.dialect.name == "postgresql":
                        conn.execute(text("ALTER TABLE attendance ADD COLUMN check_out_photo_url VARCHAR NULL;"))
                    else:
                        conn.execute(text("ALTER TABLE attendance ADD COLUMN check_out_photo_url TEXT NULL;"))
                    logger.info("✓ check_out_photo_url column added successfully")
                except Exception as e:
                    logger.error(f"Failed to add check_out_photo_url column: {e}")

            if 'tenant_id' not in columns:
                logger.info("Adding tenant_id column to attendance...")
                try:
                    conn.execute(text("ALTER TABLE attendance ADD COLUMN tenant_id INTEGER NULL;"))
                    logger.info("✓ tenant_id column added to attendance")
                except Exception as e:
                    logger.error(f"Failed to add tenant_id to attendance: {e}")

        if 'users' in tables:
            columns = {col['name'] for col in inspector.get_columns('users')}

            if 'email' not in columns:
                logger.info("Adding email column to users...")
                try:
                    conn.execute(text("ALTER TABLE users ADD COLUMN email VARCHAR NULL;"))
                except Exception as e:
                    logger.error(f"Failed to add email to users: {e}")

            if 'tenant_id' not in columns:
                logger.info("Adding tenant_id column to users...")
                try:
                    conn.execute(text("ALTER TABLE users ADD COLUMN tenant_id INTEGER NULL;"))
                except Exception as e:
                    logger.error(f"Failed to add tenant_id to users: {e}")

            if 'status' not in columns:
                logger.info("Adding status column to users...")
                try:
                    conn.execute(text("ALTER TABLE users ADD COLUMN status VARCHAR DEFAULT 'ACTIVE';"))
                except Exception as e:
                    logger.error(f"Failed to add status to users: {e}")

            if 'is_email_verified' not in columns:
                logger.info("Adding is_email_verified column to users...")
                try:
                    conn.execute(text("ALTER TABLE users ADD COLUMN is_email_verified INTEGER DEFAULT 0;"))
                except Exception as e:
                    logger.error(f"Failed to add is_email_verified to users: {e}")

            if 'failed_login_attempts' not in columns:
                logger.info("Adding failed_login_attempts column to users...")
                try:
                    conn.execute(text("ALTER TABLE users ADD COLUMN failed_login_attempts INTEGER DEFAULT 0;"))
                except Exception as e:
                    logger.error(f"Failed to add failed_login_attempts to users: {e}")

            if 'locked_until' not in columns:
                logger.info("Adding locked_until column to users...")
                try:
                    conn.execute(text("ALTER TABLE users ADD COLUMN locked_until DATETIME NULL;"))
                except Exception as e:
                    logger.error(f"Failed to add locked_until to users: {e}")

        if 'tenants' in tables and 'users' in tables:
            default_tenant_id = conn.execute(text("SELECT id FROM tenants WHERE slug = 'default' LIMIT 1")).scalar()
            if default_tenant_id:
                conn.execute(
                    text(
                        "UPDATE users SET tenant_id = :tenant_id WHERE tenant_id IS NULL"
                    ),
                    {"tenant_id": default_tenant_id},
                )
                conn.execute(
                    text(
                        "UPDATE users SET status = 'ACTIVE' WHERE status IS NULL"
                    )
                )
                conn.execute(
                    text(
                        "UPDATE users SET is_email_verified = 1 WHERE employee_id = 'admin' AND (is_email_verified IS NULL OR is_email_verified = 0)"
                    )
                )
                conn.execute(
                    text(
                        "UPDATE attendance SET tenant_id = :tenant_id WHERE tenant_id IS NULL"
                    ),
                    {"tenant_id": default_tenant_id},
                )
                conn.execute(
                    text(
                        "UPDATE daily_roasters SET tenant_id = :tenant_id WHERE tenant_id IS NULL"
                    ),
                    {"tenant_id": default_tenant_id},
                )
    
    logger.info("Database migrations completed successfully")
