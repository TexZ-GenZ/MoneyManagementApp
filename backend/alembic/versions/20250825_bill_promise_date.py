"""add per-bill promise_date and source

Revision ID: 20250825_bill_promise_date
Revises: 20250825_merge_heads
Create Date: 2025-08-25
"""

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = "20250825_bill_promise_date"
down_revision = "20250825_merge_heads"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Add columns to bills
    with op.batch_alter_table("bills") as batch_op:
        batch_op.add_column(sa.Column("promise_date", sa.Date(), nullable=True))
        # Reuse existing enum 'promisesource' created for companies
        batch_op.add_column(
            sa.Column(
                "promise_date_source",
                sa.Enum("auto", "exec", "admin", name="promisesource"),
                nullable=True,
            )
        )


def downgrade() -> None:
    with op.batch_alter_table("bills") as batch_op:
        batch_op.drop_column("promise_date_source")
        batch_op.drop_column("promise_date")
