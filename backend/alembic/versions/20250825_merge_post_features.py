"""merge heads: bill promise date + oldest due date

Revision ID: 20250825_merge_post_features
Revises: 20250825_bill_promise_date, 20250825_add_oldest_due
Create Date: 2025-08-25
"""

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = "20250825_merge_post_features"
down_revision = ("20250825_bill_promise_date", "20250825_add_oldest_due")
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Merge only, no schema changes
    pass


def downgrade() -> None:
    # Merge only, no schema changes
    pass
