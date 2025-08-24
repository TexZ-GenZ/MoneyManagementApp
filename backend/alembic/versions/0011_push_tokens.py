from alembic import op
import sqlalchemy as sa

revision = "0011_push_tokens"
down_revision = "0010_notif_cols"
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        "push_tokens",
        sa.Column("id", sa.Integer, primary_key=True),
        sa.Column("user_id", sa.Integer, sa.ForeignKey("users.id"), index=True),
        sa.Column("token", sa.String(500), nullable=False),
        sa.Column("platform", sa.String(50)),
        sa.Column("updated_at", sa.DateTime, server_default=sa.text("NOW()")),
    )
    op.create_index("ix_push_tokens_user", "push_tokens", ["user_id"], unique=False)


def downgrade():
    op.drop_index("ix_push_tokens_user", table_name="push_tokens")
    op.drop_table("push_tokens")
