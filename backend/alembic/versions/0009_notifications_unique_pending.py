from alembic import op

# Shortened revision ID to fit alembic_version.version_num (VARCHAR(32))
revision = "0009_notif_pending"
down_revision = "0008_notif_cadence"
branch_labels = None
depends_on = None


def upgrade():
    op.execute(
        """
        CREATE UNIQUE INDEX IF NOT EXISTS uq_notifications_pending
        ON notifications (
            COALESCE(company_code,'~'),
            COALESCE(payment_id,-1),
            type
        )
        WHERE status='pending'
        """
    )


def downgrade():
    op.execute("DROP INDEX IF EXISTS uq_notifications_pending")
