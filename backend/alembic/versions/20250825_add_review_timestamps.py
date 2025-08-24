"""Add review timestamps to payments

Revision ID: 20250825_add_review_timestamps
Revises: 20250825_pay_reviewer_ids
Create Date: 2025-08-25 12:00:00.000000

"""

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = "20250825_add_review_timestamps"
down_revision = "20250825_pay_reviewer_ids"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Check if columns already exist before adding them
    conn = op.get_bind()
    inspector = sa.inspect(conn)
    columns = [col["name"] for col in inspector.get_columns("payments")]

    if "accountant_review_at" not in columns:
        op.add_column(
            "payments", sa.Column("accountant_review_at", sa.DateTime(), nullable=True)
        )

    if "admin_review_at" not in columns:
        op.add_column(
            "payments", sa.Column("admin_review_at", sa.DateTime(), nullable=True)
        )


def downgrade() -> None:
    # Check if columns exist before dropping them
    conn = op.get_bind()
    inspector = sa.inspect(conn)
    columns = [col["name"] for col in inspector.get_columns("payments")]

    if "admin_review_at" in columns:
        op.drop_column("payments", "admin_review_at")

    if "accountant_review_at" in columns:
        op.drop_column("payments", "accountant_review_at")
