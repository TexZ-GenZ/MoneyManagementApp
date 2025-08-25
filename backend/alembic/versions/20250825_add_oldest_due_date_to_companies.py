"""add oldest_due_date to companies

Revision ID: 20250825_add_oldest_due
Revises:
Create Date: 2025-08-25

"""

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = "20250825_add_oldest_due"
down_revision = "20250825_merge_heads"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("companies", sa.Column("oldest_due_date", sa.Date(), nullable=True))


def downgrade() -> None:
    op.drop_column("companies", "oldest_due_date")
