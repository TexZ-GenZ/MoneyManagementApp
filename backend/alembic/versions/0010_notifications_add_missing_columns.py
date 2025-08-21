from alembic import op
import sqlalchemy as sa
from datetime import datetime

# revision identifiers, used by Alembic.
revision = "0010_notif_cols"
down_revision = "0009_notif_pending"
branch_labels = None
depends_on = None


def upgrade():
    # Add columns if they do not exist (Postgres specific IF NOT EXISTS for safety)
    # message column
    op.execute(
        "ALTER TABLE notifications ADD COLUMN IF NOT EXISTS message VARCHAR(300)"
    )
    # payment_id column (no FK to keep optional & avoid lock issues; model doesn't enforce FK)
    op.execute("ALTER TABLE notifications ADD COLUMN IF NOT EXISTS payment_id INTEGER")
    # acknowledged flag (default false)
    op.execute(
        "ALTER TABLE notifications ADD COLUMN IF NOT EXISTS acknowledged BOOLEAN DEFAULT FALSE"
    )
    # Backfill created_at if null (created_at column added earlier but nullable)
    op.execute("UPDATE notifications SET created_at = NOW() WHERE created_at IS NULL")
    # Ensure created_at has a default going forward (idempotent)
    op.execute("ALTER TABLE notifications ALTER COLUMN created_at SET DEFAULT NOW()")


def downgrade():
    # Safe to drop newly added columns (ignore if absent)
    op.execute("ALTER TABLE notifications DROP COLUMN IF EXISTS acknowledged")
    op.execute("ALTER TABLE notifications DROP COLUMN IF EXISTS payment_id")
    op.execute("ALTER TABLE notifications DROP COLUMN IF EXISTS message")
