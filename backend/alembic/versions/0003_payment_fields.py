from alembic import op
import sqlalchemy as sa

revision = "0003"
down_revision = "0002"
branch_labels = None
depends_on = None


def upgrade():
    op.add_column(
        "payments",
        sa.Column(
            "exec_location_verified", sa.Boolean, server_default=sa.text("false")
        ),
    )
    op.add_column("payments", sa.Column("accountant_comment", sa.Text))
    op.add_column("payments", sa.Column("admin_comment", sa.Text))


def downgrade():
    op.drop_column("payments", "admin_comment")
    op.drop_column("payments", "accountant_comment")
    op.drop_column("payments", "exec_location_verified")
