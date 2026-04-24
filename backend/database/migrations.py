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
            "INSERT INTO tenants ("
            "name, slug, role, status, subscription_status, subscription_plan_name, "
            "subscription_amount_paise, subscription_currency, geofence_radius_meters, created_at"
            ") "
            "SELECT 'Default Workspace', 'default', 'tenant', 'ACTIVE', 'ACTIVE', "
            "'Smart Attend Monthly', 30000, 'INR', 100, CURRENT_TIMESTAMP "
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
        if "role" not in columns:
            _execute_migration(
                "ALTER TABLE tenants ADD COLUMN role VARCHAR DEFAULT 'tenant'",
                "role column ensured on tenants",
            )
        if "subscription_status" not in columns:
            _execute_migration(
                "ALTER TABLE tenants ADD COLUMN subscription_status VARCHAR DEFAULT 'PENDING'",
                "subscription_status column ensured on tenants",
            )
        if "subscription_plan_name" not in columns:
            _execute_migration(
                "ALTER TABLE tenants ADD COLUMN subscription_plan_name VARCHAR NULL",
                "subscription_plan_name column ensured on tenants",
            )
        if "subscription_amount_paise" not in columns:
            _execute_migration(
                "ALTER TABLE tenants ADD COLUMN subscription_amount_paise INTEGER NULL",
                "subscription_amount_paise column ensured on tenants",
            )
        if "subscription_currency" not in columns:
            _execute_migration(
                "ALTER TABLE tenants ADD COLUMN subscription_currency VARCHAR NULL",
                "subscription_currency column ensured on tenants",
            )
        subscription_datetime_type = "TIMESTAMP" if engine.dialect.name == "postgresql" else "DATETIME"
        if "subscription_current_start" not in columns:
            _execute_migration(
                f"ALTER TABLE tenants ADD COLUMN subscription_current_start {subscription_datetime_type} NULL",
                "subscription_current_start column ensured on tenants",
            )
        if "subscription_current_end" not in columns:
            _execute_migration(
                f"ALTER TABLE tenants ADD COLUMN subscription_current_end {subscription_datetime_type} NULL",
                "subscription_current_end column ensured on tenants",
            )
        if "grace_period_end" not in columns:
            _execute_migration(
                f"ALTER TABLE tenants ADD COLUMN grace_period_end {subscription_datetime_type} NULL",
                "grace_period_end column ensured on tenants",
            )
        if "subscription_notes" not in columns:
            _execute_migration(
                "ALTER TABLE tenants ADD COLUMN subscription_notes TEXT NULL",
                "subscription_notes column ensured on tenants",
            )
        if "suspension_reason" not in columns:
            _execute_migration(
                "ALTER TABLE tenants ADD COLUMN suspension_reason TEXT NULL",
                "suspension_reason column ensured on tenants",
            )
        if "razorpay_customer_id" not in columns:
            _execute_migration(
                "ALTER TABLE tenants ADD COLUMN razorpay_customer_id VARCHAR NULL",
                "razorpay_customer_id column ensured on tenants",
            )
        if "razorpay_subscription_id" not in columns:
            _execute_migration(
                "ALTER TABLE tenants ADD COLUMN razorpay_subscription_id VARCHAR NULL",
                "razorpay_subscription_id column ensured on tenants",
            )
        if "billing_last_event_at" not in columns:
            _execute_migration(
                f"ALTER TABLE tenants ADD COLUMN billing_last_event_at {subscription_datetime_type} NULL",
                "billing_last_event_at column ensured on tenants",
            )
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

    if "billing_payments" not in tables:
        billing_datetime_type = "TIMESTAMP" if engine.dialect.name == "postgresql" else "DATETIME"
        id_definition = "id SERIAL PRIMARY KEY" if engine.dialect.name == "postgresql" else "id INTEGER PRIMARY KEY"
        _execute_migration(
            "CREATE TABLE billing_payments ("
            f"{id_definition}, "
            "tenant_id INTEGER NOT NULL, "
            "razorpay_event_id VARCHAR NULL, "
            "razorpay_payment_id VARCHAR NULL, "
            "razorpay_invoice_id VARCHAR NULL, "
            "razorpay_subscription_id VARCHAR NULL, "
            "amount_paise INTEGER DEFAULT 0 NOT NULL, "
            "currency VARCHAR DEFAULT 'INR' NOT NULL, "
            "status VARCHAR NOT NULL, "
            "payment_method VARCHAR NULL, "
            f"paid_at {billing_datetime_type} NULL, "
            "failure_reason VARCHAR NULL, "
            "notes TEXT NULL, "
            "raw_event TEXT NULL, "
            f"created_at {billing_datetime_type} NULL, "
            "FOREIGN KEY(tenant_id) REFERENCES tenants (id)"
            ")",
            "billing_payments table ensured",
        )
    else:
        columns = {col["name"] for col in inspector.get_columns("billing_payments")}
        if "payment_method" not in columns:
            _execute_migration(
                "ALTER TABLE billing_payments ADD COLUMN payment_method VARCHAR NULL",
                "payment_method column ensured on billing_payments",
            )
        if "notes" not in columns:
            _execute_migration(
                "ALTER TABLE billing_payments ADD COLUMN notes TEXT NULL",
                "notes column ensured on billing_payments",
            )

    inspector = inspect(engine)
    tables = inspector.get_table_names()

    if "super_admin_audit_logs" not in tables:
        audit_datetime_type = "TIMESTAMP" if engine.dialect.name == "postgresql" else "DATETIME"
        id_definition = "id SERIAL PRIMARY KEY" if engine.dialect.name == "postgresql" else "id INTEGER PRIMARY KEY"
        _execute_migration(
            "CREATE TABLE super_admin_audit_logs ("
            f"{id_definition}, "
            "action VARCHAR NOT NULL, "
            "tenant_id INTEGER NULL, "
            "tenant_name VARCHAR NULL, "
            "changed_fields TEXT NULL, "
            "previous_values TEXT NULL, "
            "new_values TEXT NULL, "
            "notes TEXT NULL, "
            f"performed_at {audit_datetime_type} NOT NULL"
            ")",
            "super_admin_audit_logs table ensured",
        )

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
                    conn.execute(text("UPDATE tenants SET role = 'tenant' WHERE role IS NULL"))
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
