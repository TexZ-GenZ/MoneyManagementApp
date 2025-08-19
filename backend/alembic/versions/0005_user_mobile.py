from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = "0005_user_mobile"
down_revision = "0004_indexes"
branch_labels = None
depends_on = None


def upgrade():
    op.add_column("users", sa.Column("mobile", sa.String(length=20), nullable=True))
    op.create_unique_constraint("uq_users_mobile", "users", ["mobile"])


def downgrade():
    op.drop_constraint("uq_users_mobile", "users", type_="unique")
    op.drop_column("users", "mobile")
