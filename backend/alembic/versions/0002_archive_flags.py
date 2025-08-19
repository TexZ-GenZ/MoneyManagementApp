from alembic import op
import sqlalchemy as sa

revision = "0002"
down_revision = "0001"
branch_labels = None
depends_on = None


def upgrade():
    op.add_column(
        "companies",
        sa.Column("is_archived", sa.Boolean, server_default=sa.text("false")),
    )
    op.add_column(
        "bills", sa.Column("is_archived", sa.Boolean, server_default=sa.text("false"))
    )


def downgrade():
    op.drop_column("bills", "is_archived")
    op.drop_column("companies", "is_archived")
