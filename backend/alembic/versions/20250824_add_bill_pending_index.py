"""Add composite index for pending bill lookups

Revision ID: 20250824_add_bill_pending_index
Revises: 0013_digest_enum
Create Date: 2025-08-24

"""

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = "20250824_add_bill_pending_index"
down_revision = "0013_digest_enum"
branch_labels = None
depends_on = None


def upgrade():
    # Frequently we filter bills by (status, company_code) and sometimes by status alone.
    # Existing single indexes only cover company_code via FK; add composite for better selectivity.
    op.create_index(
        "ix_bills_status_company_code",
        "bills",
        ["status", "company_code"],
        unique=False,
    )
    # Optional: index on due_date for promise date derived logic could be added later if needed.


def downgrade():
    op.drop_index("ix_bills_status_company_code", table_name="bills")
