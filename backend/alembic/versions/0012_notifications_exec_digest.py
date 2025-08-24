from alembic import op
import sqlalchemy as sa

revision = "0012_exec_digest"
down_revision = "0011_push_tokens"
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        "notifications_log",
        sa.Column("id", sa.Integer, primary_key=True),
        sa.Column("executive_id", sa.Integer, sa.ForeignKey("users.id"), index=True),
        sa.Column("kind", sa.String(50), nullable=False),  # e.g. promise_digest
        sa.Column("period_date", sa.Date, nullable=False),
        sa.Column("created_at", sa.DateTime, server_default=sa.text("NOW()")),
        sa.UniqueConstraint(
            "executive_id",
            "kind",
            "period_date",
            name="uq_notifications_log_once_per_day",
        ),
    )
    op.create_index(
        "ix_notifications_log_exec_kind_date",
        "notifications_log",
        ["executive_id", "kind", "period_date"],
        unique=False,
    )


def downgrade():
    op.drop_index("ix_notifications_log_exec_kind_date", table_name="notifications_log")
    op.drop_table("notifications_log")
