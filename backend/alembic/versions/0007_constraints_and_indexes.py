from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = "0007_constraints_indexes"
down_revision = "0006_idem"
branch_labels = None
depends_on = None


def upgrade():
    # Check constraint: promise_date >= credit_date (allow nulls)
    op.create_check_constraint(
        "ck_companies_promise_ge_credit",
        "companies",
        "(promise_date IS NULL OR credit_date IS NULL OR promise_date >= credit_date)",
    )
    # Ensure 'created_at' column exists in notifications
    op.add_column(
        "notifications",
        sa.Column("created_at", sa.DateTime(), nullable=True)
    )
    # Notification indexes
    op.create_index(
        "ix_notifications_status_type_company_created",
        "notifications",
        ["status", "type", "company_code", "created_at"],
        unique=False,
    )
    # Bills index (company_code, status, due_date) if not already present
    op.create_index(
        "ix_bills_company_status_due",
        "bills",
        ["company_code", "status", "due_date"],
        unique=False,
    )
    # Payments index (status, company_code) if needed for dashboard counts
    op.create_index(
        "ix_payments_status_company",
        "payments",
        ["status", "company_code"],
        unique=False,
    )


def downgrade():
    op.drop_index("ix_payments_status_company", table_name="payments")
    op.drop_index("ix_bills_company_status_due", table_name="bills")
    op.drop_index(
        "ix_notifications_status_type_company_created", table_name="notifications"
    )
    op.drop_constraint("ck_companies_promise_ge_credit", "companies", type_="check")
