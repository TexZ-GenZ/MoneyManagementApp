from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = "0008_notif_cadence"
down_revision = "0007_constraints_indexes"
branch_labels = None
depends_on = None


def upgrade():
    # 'last_sent_at' column already exists, skip adding
    # 'next_send_at' column already exists, skip adding
    # Ensure payment_id column exists BEFORE creating index that references it
    # (fresh database builds reached this migration before 0010 which also adds it)
    op.execute("ALTER TABLE notifications ADD COLUMN IF NOT EXISTS payment_id INTEGER")
    # Prevent duplicate active notifications of same type for same company/payment
    op.create_index(
        "ix_notifications_unique_active",
        "notifications",
        ["company_code", "payment_id", "type", "status"],
        unique=False,
    )


def downgrade():
    op.drop_index("ix_notifications_unique_active", table_name="notifications")
    op.drop_column("notifications", "next_send_at")
    op.drop_column("notifications", "last_sent_at")
