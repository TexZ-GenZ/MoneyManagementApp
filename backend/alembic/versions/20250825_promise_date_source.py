"""add promise_date_source to companies

Revision ID: 20250825_promise_date_source
Revises: 20250825_pay_reviewer_ids
Create Date: 2025-08-25
"""

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = "20250825_promise_date_source"
down_revision = "20250825_pay_reviewer_ids"
branch_labels = None
depends_on = None


def upgrade() -> None:
    promisesource = sa.Enum("auto", "exec", "admin", name="promisesource")
    promisesource.create(op.get_bind(), checkfirst=True)
    op.add_column(
        "companies", sa.Column("promise_date_source", promisesource, nullable=True)
    )


def downgrade() -> None:
    op.drop_column("companies", "promise_date_source")
    promisesource = sa.Enum("auto", "exec", "admin", name="promisesource")
    promisesource.drop(op.get_bind(), checkfirst=True)
