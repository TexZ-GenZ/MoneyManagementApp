from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import ENUM

revision = "0001"
down_revision = None
branch_labels = None
depends_on = None


def upgrade():
    role_enum = sa.Enum("admin", "accountant", "executive", name="role")
    bill_status = sa.Enum("pending", "paid", name="billstatus")
    pay_status = sa.Enum(
        "submitted",
        "accountant_approved",
        "admin_approved",
        "declined_by_accountant",
        "declined_by_admin",
        name="paymentstatus",
    )
    notif_type = sa.Enum("promise_crossed", "payment_review", name="notificationtype")
    notif_status = sa.Enum("pending", "sent", "stopped", name="notificationstatus")
    import_type = sa.Enum("master", "transactions", name="importtype")

    op.create_table(
        "users",
        sa.Column("id", sa.Integer, primary_key=True),
        sa.Column("username", sa.String(100), unique=True, nullable=False),
        sa.Column("password_hash", sa.String(255), nullable=False),
        sa.Column("role", role_enum, nullable=False),
        sa.Column("area", sa.String(100)),
        sa.Column("is_active", sa.Boolean, server_default=sa.text("true")),
    )

    op.create_table(
        "companies",
        sa.Column("code", sa.String(50), primary_key=True),
        sa.Column("name", sa.String(200), nullable=False),
        sa.Column("area", sa.String(100)),
        sa.Column("location", sa.String(200)),
        sa.Column("credit_date", sa.Date),
        sa.Column("promise_date", sa.Date),
        sa.Column("outbal", sa.Numeric(12, 2), server_default="0"),
        sa.Column("amount", sa.Numeric(12, 2), server_default="0"),
        sa.Column("created_at", sa.DateTime),
        sa.Column("updated_at", sa.DateTime),
    )

    op.create_table(
        "bills",
        sa.Column("id", sa.Integer, primary_key=True),
        sa.Column("bill_number", sa.String(100), nullable=False, unique=True),
        sa.Column("company_code", sa.String(50), sa.ForeignKey("companies.code")),
        sa.Column("bill_date", sa.Date, nullable=False),
        sa.Column("due_date", sa.Date, nullable=False),
        sa.Column("amount", sa.Numeric(12, 2), nullable=False),
        sa.Column("amount_paid", sa.Numeric(12, 2), server_default="0"),
        sa.Column("status", bill_status, server_default="pending"),
    )
    op.create_index("ix_bills_company", "bills", ["company_code"])

    op.create_table(
        "exec_assignments",
        sa.Column("id", sa.Integer, primary_key=True),
        sa.Column("executive_id", sa.Integer, sa.ForeignKey("users.id")),
        sa.Column("company_code", sa.String(50), sa.ForeignKey("companies.code")),
    )
    op.create_unique_constraint(
        "uq_exec_company", "exec_assignments", ["executive_id", "company_code"]
    )

    op.create_table(
        "payments",
        sa.Column("id", sa.Integer, primary_key=True),
        sa.Column("company_code", sa.String(50), sa.ForeignKey("companies.code")),
        sa.Column("executive_id", sa.Integer, sa.ForeignKey("users.id")),
        sa.Column("collected_at", sa.DateTime),
        sa.Column("amount_collected", sa.Numeric(12, 2), nullable=False),
        sa.Column("method", sa.String(50)),
        sa.Column("exec_lat", sa.Float),
        sa.Column("exec_lng", sa.Float),
        sa.Column("comments", sa.Text),
        sa.Column("next_promise_date", sa.Date),
        sa.Column("status", pay_status, server_default="submitted"),
        sa.Column("accountant_review_at", sa.DateTime),
        sa.Column("admin_review_at", sa.DateTime),
    )

    op.create_table(
        "payment_allocations",
        sa.Column("id", sa.Integer, primary_key=True),
        sa.Column("payment_id", sa.Integer, sa.ForeignKey("payments.id")),
        sa.Column("bill_id", sa.Integer, sa.ForeignKey("bills.id")),
        sa.Column("amount", sa.Numeric(12, 2), nullable=False),
    )
    op.create_unique_constraint(
        "uq_payment_bill", "payment_allocations", ["payment_id", "bill_id"]
    )

    op.create_table(
        "notifications",
        sa.Column("id", sa.Integer, primary_key=True),
        sa.Column("company_code", sa.String(50), sa.ForeignKey("companies.code")),
        sa.Column("type", notif_type),
        sa.Column("status", notif_status, server_default="pending"),
        sa.Column("last_sent_at", sa.DateTime),
        sa.Column("next_send_at", sa.DateTime),
        sa.Column("stop_reason", sa.String(200)),
    )

    op.create_table(
        "settings",
        sa.Column("id", sa.Integer, primary_key=True),
        sa.Column("credit_extension_days", sa.Integer, server_default="10"),
        sa.Column("notif_every_hours", sa.Integer, server_default="2"),
        sa.Column("payment_notif_daily_hour", sa.Integer, server_default="9"),
    )

    op.create_table(
        "imports",
        sa.Column("id", sa.Integer, primary_key=True),
        sa.Column("type", import_type),
        sa.Column("source_name", sa.String(200)),
        sa.Column("started_at", sa.DateTime),
        sa.Column("finished_at", sa.DateTime),
        sa.Column("status", sa.String(50), server_default="pending"),
        sa.Column("stats", sa.Text),
    )


def downgrade():
    op.drop_table("imports")
    op.drop_table("settings")
    op.drop_table("notifications")
    op.drop_constraint("uq_payment_bill", "payment_allocations", type_="unique")
    op.drop_table("payment_allocations")
    op.drop_table("payments")
    op.drop_constraint("uq_exec_company", "exec_assignments", type_="unique")
    op.drop_table("exec_assignments")
    op.drop_index("ix_bills_company", table_name="bills")
    op.drop_table("bills")
    op.drop_table("companies")
    op.drop_table("users")
