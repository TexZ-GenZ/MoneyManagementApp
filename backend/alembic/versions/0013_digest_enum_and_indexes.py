from alembic import op
import sqlalchemy as sa

revision = "0013_digest_enum"
down_revision = "0012_exec_digest"
branch_labels = None
depends_on = None


def upgrade():
    # Add new enum value for notificationtype
    op.execute("ALTER TYPE notificationtype ADD VALUE IF NOT EXISTS 'promise_digest'")
    # Helpful index for sending prepared digests quickly
    op.create_index(
        "ix_notifications_digest_due",
        "notifications",
        ["type", "status", "next_send_at"],
        postgresql_where=sa.text("type = 'promise_digest'"),
    )


def downgrade():
    # Cannot easily remove enum value; leave as-is. Drop index only.
    op.drop_index("ix_notifications_digest_due", table_name="notifications")
