"""merge heads: review timestamps + promise source

Revision ID: 20250825_merge_heads
Revises: 20250825_add_review_timestamps, 20250825_promise_date_source
Create Date: 2025-08-25
"""

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = "20250825_merge_heads"
down_revision = ("20250825_add_review_timestamps", "20250825_promise_date_source")
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Merge only, no schema changes
    pass


def downgrade() -> None:
    # Merge only, no schema changes
    pass
