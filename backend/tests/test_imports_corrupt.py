import pytest
from app.services.imports import import_master, import_transactions
from app.models.models import Company, Bill, User, Role
from app.services.auth import hash_password
from dbfread import DBF


def seed_admin(db_session):
    admin = User(
        username="admin_corrupt",
        password_hash=hash_password("admin"),
        role=Role.admin,
        is_active=True,
    )
    db_session.add(admin)
    db_session.commit()
    return admin


class ExplodingDBF(DBF):
    def __iter__(self):
        raise ValueError("Corrupt DBF stream")


def test_master_import_corrupt_rolls_back(db_session, monkeypatch):
    seed_admin(db_session)
    # Pre-insert a company to detect unintended changes
    db_session.add(Company(code="SAFE1", name="Safe"))
    db_session.commit()
    import app.services.imports as imports_mod

    monkeypatch.setattr(imports_mod, "DBF", ExplodingDBF)
    # Expect exception to propagate (current service does not swallow); ensure no archive side-effects applied
    with pytest.raises(ValueError):
        import_master(db_session, filename="master.dbf")
    # Company still un-archived
    c = db_session.get(Company, "SAFE1")
    assert c.is_archived is False


def test_transactions_import_corrupt_rolls_back(db_session, monkeypatch):
    seed_admin(db_session)
    # Minimal prerequisite master import with real DBF so transactions import has baseline
    import_master(db_session, filename="master.dbf")
    # Add sentinel bill
    from decimal import Decimal
    from datetime import date, timedelta

    db_session.add(Company(code="SENT", name="SENT"))
    db_session.commit()
    bill = Bill(
        bill_number="SNT1",
        company_code="SENT",
        bill_date=date.today(),
        due_date=date.today(),
        amount=Decimal("10.00"),
        amount_paid=Decimal("0"),
        status="pending",
        is_archived=False,
    )
    db_session.add(bill)
    db_session.commit()
    import app.services.imports as imports_mod

    monkeypatch.setattr(imports_mod, "DBF", ExplodingDBF)
    with pytest.raises(ValueError):
        import_transactions(db_session, filename="transactions.dbf")
    # Bill not archived or modified
    b = db_session.query(Bill).filter(Bill.bill_number == "SNT1").one()
    assert b.is_archived is False
