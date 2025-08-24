"""drop payment_notif_daily_hour column

Revision ID: drop_payment_daily_hour_20250824
Revises: add_exec_window_hours_20250824
Create Date: 2025-08-24
"""

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = "drop_payment_daily_hour_20250824"
down_revision = "add_exec_window_hours_20250824"
branch_labels = None
depends_on = None


def upgrade():
    with op.batch_alter_table("settings") as batch:
        batch.drop_column("payment_notif_daily_hour")


def downgrade():
    with op.batch_alter_table("settings") as batch:
        batch.add_column(
            sa.Column(
                "payment_notif_daily_hour",
                sa.Integer(),
                nullable=True,
                server_default="9",
            )
        )
        batch.alter_column("payment_notif_daily_hour", server_default=None)
