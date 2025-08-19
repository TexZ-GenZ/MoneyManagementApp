from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = "0006_idem"
down_revision = "0005_user_mobile"
branch_labels = None
depends_on = None


def upgrade():
    # Idempotency key on payments
    op.add_column(
        "payments",
        sa.Column("idempotency_key", sa.String(length=100), nullable=True),
    )
    op.create_unique_constraint(
        "uq_payments_idempotency_key", "payments", ["idempotency_key"]
    )
    # Additional indexes for pagination-heavy endpoints
    op.create_index(
        "ix_companies_area_code", "companies", ["area", "code"], unique=False
    )
    op.create_index(
        "ix_payments_company_status_collected",
        "payments",
        ["company_code", "status", "collected_at"],
        unique=False,
    )
    # Helper index for fast checks on assignments
    op.create_index(
        "ix_exec_assignments_exec_company",
        "exec_assignments",
        ["executive_id", "company_code"],
        unique=False,
    )


def downgrade():
    op.drop_index("ix_exec_assignments_exec_company", table_name="exec_assignments")
    op.drop_index("ix_payments_company_status_collected", table_name="payments")
    op.drop_index("ix_companies_area_code", table_name="companies")
    op.drop_constraint("uq_payments_idempotency_key", "payments", type_="unique")
    op.drop_column("payments", "idempotency_key")
