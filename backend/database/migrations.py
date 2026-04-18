"""
Database migration utilities
"""

import logging

from sqlalchemy import inspect, text

from backend.database.database import engine

logger = logging.getLogger(__name__)


def _execute_migration(statement: str, success_message: str) -> None:
    try:
        with engine.begin() as conn:
            conn.execute(text(statement))
        logger.info(success_message)
    except Exception as exc:
        logger.error("%s: %s", success_message, exc)


def run_migrations():
    """Run all pending database migrations."""
    inspector = inspect(engine)
    tables = inspector.get_table_names()

    if "tenants" in tables:
        _execute_migration(
            "INSERT INTO tenants (name, slug, status, created_at) "
            "SELECT 'Default Workspace', 'default', 'ACTIVE', CURRENT_TIMESTAMP "
            "WHERE NOT EXISTS (SELECT 1 FROM tenants WHERE slug = 'default')",
            "Default tenant ensured successfully",
        )

    inspector = inspect(engine)
    tables = inspector.get_table_names()

    if "daily_roasters" in tables:
        columns = {col["name"] for col in inspector.get_columns("daily_roasters")}
        if "is_week_off" not in columns:
            _execute_migration(
                "ALTER TABLE daily_roasters ADD COLUMN is_week_off INTEGER DEFAULT 0",
                "is_week_off column ensured on daily_roasters",
            )
        if "tenant_id" not in columns:
            _execute_migration(
                "ALTER TABLE daily_roasters ADD COLUMN tenant_id INTEGER NULL",
                "tenant_id column ensured on daily_roasters",
            )

    if "attendance" in tables:
        columns = {col["name"] for col in inspector.get_columns("attendance")}
        if "check_out_time" not in columns:
            checkout_type = "TIMESTAMP" if engine.dialect.name == "postgresql" else "DATETIME"
            _execute_migration(
                f"ALTER TABLE attendance ADD COLUMN check_out_time {checkout_type} NULL",
                "check_out_time column ensured on attendance",
            )
        if "check_out_photo_url" not in columns:
            photo_url_type = "VARCHAR" if engine.dialect.name == "postgresql" else "TEXT"
            _execute_migration(
                f"ALTER TABLE attendance ADD COLUMN check_out_photo_url {photo_url_type} NULL",
                "check_out_photo_url column ensured on attendance",
            )
        if "tenant_id" not in columns:
            _execute_migration(
                "ALTER TABLE attendance ADD COLUMN tenant_id INTEGER NULL",
                "tenant_id column ensured on attendance",
            )

    if "users" in tables:
        columns = {col["name"] for col in inspector.get_columns("users")}
        if "email" not in columns:
            _execute_migration(
                "ALTER TABLE users ADD COLUMN email VARCHAR NULL",
                "email column ensured on users",
            )
        if "tenant_id" not in columns:
            _execute_migration(
                "ALTER TABLE users ADD COLUMN tenant_id INTEGER NULL",
                "tenant_id column ensured on users",
            )
        if "status" not in columns:
            _execute_migration(
                "ALTER TABLE users ADD COLUMN status VARCHAR DEFAULT 'ACTIVE'",
                "status column ensured on users",
            )
        if "is_email_verified" not in columns:
            _execute_migration(
                "ALTER TABLE users ADD COLUMN is_email_verified INTEGER DEFAULT 0",
                "is_email_verified column ensured on users",
            )
        if "failed_login_attempts" not in columns:
            _execute_migration(
                "ALTER TABLE users ADD COLUMN failed_login_attempts INTEGER DEFAULT 0",
                "failed_login_attempts column ensured on users",
            )
        if "locked_until" not in columns:
            locked_until_type = "TIMESTAMP" if engine.dialect.name == "postgresql" else "DATETIME"
            _execute_migration(
                f"ALTER TABLE users ADD COLUMN locked_until {locked_until_type} NULL",
                "locked_until column ensured on users",
            )

    if "tenants" in tables:
        columns = {col["name"] for col in inspector.get_columns("tenants")}
        if "geofence_maps_link" not in columns:
            _execute_migration(
                "ALTER TABLE tenants ADD COLUMN geofence_maps_link VARCHAR NULL",
                "geofence_maps_link column ensured on tenants",
            )
        if "geofence_latitude" not in columns:
            _execute_migration(
                "ALTER TABLE tenants ADD COLUMN geofence_latitude FLOAT NULL",
                "geofence_latitude column ensured on tenants",
            )
        if "geofence_longitude" not in columns:
            _execute_migration(
                "ALTER TABLE tenants ADD COLUMN geofence_longitude FLOAT NULL",
                "geofence_longitude column ensured on tenants",
            )
        if "geofence_radius_meters" not in columns:
            _execute_migration(
                "ALTER TABLE tenants ADD COLUMN geofence_radius_meters INTEGER DEFAULT 100",
                "geofence_radius_meters column ensured on tenants",
            )

    inspector = inspect(engine)
    tables = inspector.get_table_names()

    if "tenants" in tables and "users" in tables:
        try:
            with engine.begin() as conn:
                default_tenant_id = conn.execute(
                    text("SELECT id FROM tenants WHERE slug = 'default' LIMIT 1")
                ).scalar()
                if default_tenant_id:
                    conn.execute(
                        text("UPDATE users SET tenant_id = :tenant_id WHERE tenant_id IS NULL"),
                        {"tenant_id": default_tenant_id},
                    )
                    conn.execute(text("UPDATE users SET status = 'ACTIVE' WHERE status IS NULL"))
                    conn.execute(
                        text(
                            "UPDATE users SET is_email_verified = 1 "
                            "WHERE employee_id = 'admin' "
                            "AND (is_email_verified IS NULL OR is_email_verified = 0)"
                        )
                    )
                    if "attendance" in tables:
                        conn.execute(
                            text("UPDATE attendance SET tenant_id = :tenant_id WHERE tenant_id IS NULL"),
                            {"tenant_id": default_tenant_id},
                        )
                    if "daily_roasters" in tables:
                        conn.execute(
                            text("UPDATE daily_roasters SET tenant_id = :tenant_id WHERE tenant_id IS NULL"),
                            {"tenant_id": default_tenant_id},
                        )
            logger.info("Default tenant backfill completed successfully")
        except Exception as exc:
            logger.error("Default tenant backfill failed: %s", exc)

    logger.info("Database migrations completed successfully")
