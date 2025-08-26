"""add user_notifications table

Revision ID: 20250826_user_notifications
Revises: 20250825_merge_post_features
Create Date: 2025-08-26
"""

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = "20250826_user_notifications"
down_revision = "20250825_merge_post_features"
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        "user_notifications",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column("title", sa.String(length=200), nullable=False),
        sa.Column("body", sa.String(length=500), nullable=False),
        sa.Column("data_json", sa.String(length=2000), nullable=True),
        sa.Column(
            "created_at", sa.DateTime(), nullable=False, server_default=sa.func.now()
        ),
        sa.Column(
            "acknowledged",
            sa.Boolean(),
            nullable=False,
            server_default=sa.text("false"),
        ),
        sa.ForeignKeyConstraint(
            ["user_id"],
            ["users.id"],
        ),
    )
    try:
        op.create_index(
            "ix_user_notifications_user_id", "user_notifications", ["user_id"]
        )
    except Exception:
        # index may already exist if table was partially created; ignore
        pass


def downgrade():
    op.drop_index("ix_user_notifications_user_id", table_name="user_notifications")
    op.drop_table("user_notifications")
