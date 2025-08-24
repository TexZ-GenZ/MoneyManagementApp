"""add exec window hours

Revision ID: add_exec_window_hours_20250824
Revises: 20250824_add_bill_pending_index
Create Date: 2025-08-24 20:30:00.000000
"""

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = "add_exec_window_hours_20250824"
down_revision = "20250824_add_bill_pending_index"
branch_labels = None
depends_on = None


def upgrade():
    op.add_column(
        "settings",
        sa.Column(
            "exec_window_start_hour", sa.Integer(), nullable=False, server_default="6"
        ),
    )
    op.add_column(
        "settings",
        sa.Column(
            "exec_window_end_hour", sa.Integer(), nullable=False, server_default="22"
        ),
    )
    op.execute(
        "UPDATE settings SET exec_window_start_hour=6, exec_window_end_hour=22 WHERE id=1"
    )
    op.alter_column("settings", "exec_window_start_hour", server_default=None)
    op.alter_column("settings", "exec_window_end_hour", server_default=None)


def downgrade():
    op.drop_column("settings", "exec_window_start_hour")
    op.drop_column("settings", "exec_window_end_hour")
