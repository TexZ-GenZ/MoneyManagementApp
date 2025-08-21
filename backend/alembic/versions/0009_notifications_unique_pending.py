from alembic import op

# revision identifiers, used by Alembic.
revision = '0009_notifications_unique_pending'
down_revision = '0008_notif_cadence'
branch_labels = None
depends_on = None

def upgrade():
    # Unique pending notification per (company_code/payment_id,type)
    op.execute(
        "CREATE UNIQUE INDEX IF NOT EXISTS uq_notifications_pending ON notifications (COALESCE(company_code,'~'), COALESCE(payment_id,-1), type) WHERE status='pending'"
    )


def downgrade():
    op.execute("DROP INDEX IF EXISTS uq_notifications_pending")
