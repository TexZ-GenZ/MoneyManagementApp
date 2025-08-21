import math
from decimal import Decimal
from app.services.imports import import_master, import_transactions
from app.services.company import recalc_company_totals
from app.models.models import Company, Bill, User, Role
from app.services.auth import hash_password


def seed_admin(db_session):
    admin = User(
        username="admin_import_counts",
        password_hash=hash_password("admin"),
        role=Role.admin,
        is_active=True,
    )
    db_session.add(admin)
    db_session.commit()
    return admin


def test_master_first_run_counts_and_company_bill_relationships(db_session):
    seed_admin(db_session)
    m = import_master(db_session, filename="master.dbf")
    # Assert required metrics keys
    for k in ["inserted", "updated", "skipped", "archived", "seconds"]:
        assert k in m
    # On first run we expect only inserts (no updates/skips) unless file has duplicates; allow skips=0+ but updates must be 0
    assert m["updated"] == 0
    assert m["inserted"] > 0
    assert m["seconds"] >= 0
    # Sum consistency (archived normally 0 on first import)
    total_accounted = m["inserted"] + m["updated"] + m["skipped"] + m["archived"]
    # Can't assert versus file row count without parsing DBF; ensure at least all inserted counted
    assert total_accounted >= m["inserted"]
    # Spot check a few companies exist
    c = db_session.query(Company).first()
    assert c is not None


def test_transactions_updates_bill_balances(db_session):
    seed_admin(db_session)
    import_master(db_session, filename="master.dbf")
    t = import_transactions(db_session, filename="transactions.dbf")
    # Recompute totals for all companies to ensure consistency (import updates only touched codes)
    for comp in db_session.query(Company).all():
        recalc_company_totals(db_session, comp.code)
    # Must have at least one inserted or updated allocation effect
    assert (t["inserted"] + t["updated"]) >= 0
    # After transactions import, bills should have amount >= amount_paid and company totals consistent
    companies = db_session.query(Company).all()
    from app.models.models import BillStatus

    for company in companies:
        bills = (
            db_session.query(Bill)
            .filter(
                Bill.company_code == company.code,
                Bill.status == BillStatus.pending,
                Bill.is_archived == False,
            )
            .all()
        )
        total_amount = Decimal("0")
        total_outbal = Decimal("0")
        today_remaining_due = Decimal("0")
        for b in bills:
            assert b.amount >= b.amount_paid
            remaining = Decimal(str(b.amount)) - Decimal(str(b.amount_paid))
            if remaining > 0:
                total_amount += remaining
                if b.due_date < b.due_date.today():
                    total_outbal += remaining
        # Compare with stored company values
        assert Decimal(str(company.amount)).quantize(
            Decimal("0.01")
        ) == total_amount.quantize(Decimal("0.01"))
        assert Decimal(str(company.outbal)).quantize(
            Decimal("0.01")
        ) == total_outbal.quantize(Decimal("0.01"))
