from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = "0004_indexes"
down_revision = "0003"
branch_labels = None
depends_on = None


def upgrade():
    op.create_index(
        "ix_bills_company_status_archived_due",
        "bills",
        ["company_code", "status", "is_archived", "due_date"],
    )
    op.create_index("ix_payment_allocations_bill", "payment_allocations", ["bill_id"])
    op.create_index(
        "ix_payments_company_status", "payments", ["company_code", "status"]
    )


def downgrade():
    op.drop_index("ix_payments_company_status", table_name="payments")
    op.drop_index("ix_payment_allocations_bill", table_name="payment_allocations")
    op.drop_index("ix_bills_company_status_archived_due", table_name="bills")
