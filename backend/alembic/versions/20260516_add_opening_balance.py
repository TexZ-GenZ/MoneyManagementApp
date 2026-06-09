"""add opening_balance to companies

Revision ID: 20260516_add_opening_balance
Revises: 20250826_user_notifications
Create Date: 2026-05-16
"""

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = "20260516_add_opening_balance"
down_revision = "20250826_user_notifications"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "companies",
        sa.Column(
            "opening_balance",
            sa.Numeric(14, 2),
            nullable=False,
            server_default=sa.text("0"),
        ),
    )


def downgrade() -> None:
    op.drop_column("companies", "opening_balance")
