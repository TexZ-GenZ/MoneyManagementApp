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
    # Create a general composite index used by digest queries.
    # We avoid a partial index on the new enum value to prevent immutability/commit issues
    # during transactional migrations on PostgreSQL.
    op.create_index(
        "ix_notifications_digest_due",
        "notifications",
        ["type", "status", "next_send_at"],
        unique=False,
    )


def downgrade():
    # Cannot easily remove enum value; leave as-is. Drop index only.
    op.drop_index("ix_notifications_digest_due", table_name="notifications")
