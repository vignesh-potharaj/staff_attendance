"""add composite unique constraint on users(tenant_id, employee_id)

Revision ID: 20260419_add_uq_tenant_employee
Revises: 
Create Date: 2026-04-19 00:00:00.000000
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy import text

# revision identifiers, used by Alembic.
revision = '20260419_add_uq_tenant_employee'
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    bind = op.get_bind()
    dialect = bind.dialect.name

    # 1) Safety check: ensure no duplicate (tenant_id, employee_id) pairs exist
    dup_sql = text("""
        SELECT tenant_id, employee_id, COUNT(*) as cnt
        FROM users
        GROUP BY tenant_id, employee_id
        HAVING COUNT(*) > 1
    """)
    dup_rows = bind.execute(dup_sql).fetchall()
    if dup_rows:
        # Do not proceed; list offending rows for manual resolution
        raise RuntimeError(
            "Found duplicate (tenant_id, employee_id) pairs. Resolve these before running this migration: %s" % (
                str([dict(r) if hasattr(r, '_asdict') else tuple(r) for r in dup_rows])
            )
        )

    # 2) Remove any legacy unique constraint/index that enforces global uniqueness on employee_id
    if dialect == 'postgresql':
        # Drop UNIQUE constraints that only contain employee_id
        constraint_query = text("""
            SELECT tc.constraint_name
            FROM information_schema.table_constraints tc
            JOIN information_schema.key_column_usage kcu ON tc.constraint_name = kcu.constraint_name AND tc.table_name = kcu.table_name
            WHERE tc.table_name = 'users' AND tc.constraint_type = 'UNIQUE'
            GROUP BY tc.constraint_name
            HAVING COUNT(*) = SUM(CASE WHEN kcu.column_name = 'employee_id' THEN 1 ELSE 0 END)
        """)
        constraints = [r[0] for r in bind.execute(constraint_query).fetchall()]
        for cname in constraints:
            # Avoid dropping our intended composite constraint if somehow present
            if cname == 'uq_tenant_employee':
                continue
            op.execute(sa.text(f'ALTER TABLE users DROP CONSTRAINT IF EXISTS "{cname}"'))

        # Drop unique indexes that reference only employee_id
        index_query = text("SELECT indexname FROM pg_indexes WHERE tablename='users' AND indexdef LIKE '%UNIQUE%' AND indexdef LIKE '%(employee_id)%';")
        idxs = [r[0] for r in bind.execute(index_query).fetchall()]
        for idx in idxs:
            op.execute(sa.text(f'DROP INDEX IF EXISTS "{idx}"'))

        # 3) Create composite unique constraint
        op.create_unique_constraint('uq_tenant_employee', 'users', ['tenant_id', 'employee_id'])

    else:
        # For SQLite and other engines, use batch_alter_table which will rebuild table for SQLite
        with op.batch_alter_table('users') as batch_op:
            batch_op.create_unique_constraint('uq_tenant_employee', ['tenant_id', 'employee_id'])


def downgrade() -> None:
    bind = op.get_bind()
    dialect = bind.dialect.name

    # 1) Drop the composite constraint
    if dialect == 'postgresql':
        op.drop_constraint('uq_tenant_employee', 'users', type_='unique')
    else:
        with op.batch_alter_table('users') as batch_op:
            batch_op.drop_constraint('uq_tenant_employee', type_='unique')

    # 2) Attempt to restore previous global unique on employee_id ONLY if no duplicates by employee_id exist
    dup_emp_sql = text("""
        SELECT employee_id, COUNT(*) as cnt
        FROM users
        GROUP BY employee_id
        HAVING COUNT(*) > 1
    """)
    dup_emp_rows = bind.execute(dup_emp_sql).fetchall()
    if dup_emp_rows:
        # Do not recreate global unique constraint; user must clean duplicates first
        op.get_context().log.info(
            "Not recreating global unique on employee_id because duplicates exist: %s" % (str(dup_emp_rows))
        )
        return

    # safe to recreate global unique
    if dialect == 'postgresql':
        op.create_unique_constraint('uq_users_employee_id', 'users', ['employee_id'])
    else:
        with op.batch_alter_table('users') as batch_op:
            batch_op.create_unique_constraint('uq_users_employee_id', ['employee_id'])
