"""No-op migration to satisfy existing DB revision 20250825_pay_reviewer_ids

Revision ID: 20250825_pay_reviewer_ids
Revises: drop_payment_daily_hour_20250824
Create Date: 2025-08-25
"""

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = "20250825_pay_reviewer_ids"
down_revision = "drop_payment_daily_hour_20250824"
branch_labels = None
depends_on = None


def upgrade():
    # No changes; this exists to bridge a previously applied DB revision.
    pass


def downgrade():
    # No-op
    pass
