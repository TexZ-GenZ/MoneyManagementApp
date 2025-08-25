import datetime
from decimal import Decimal
import pytest
from app.services import imports as imports_mod
from app.services.imports import import_master, import_transactions
from app.services.company import recalc_company_totals
from app.models.models import Company, Bill, User, Role
from app.services.auth import hash_password


# Helper to seed admin user
@pytest.fixture()
def admin(db_session):
    admin = User(
        username="admin_new_beh",
        password_hash=hash_password("admin"),
        role=Role.admin,
        is_active=True,
    )
    db_session.add(admin)
    db_session.commit()
    return admin


class DummyDBF(list):
    """Simple iterable to mimic DBF returned rows. Accepts list of dicts."""

    def __init__(self, rows):
        super().__init__(rows)


@pytest.fixture()
def patch_dbf(monkeypatch):
    created = {}

    def _patch(rows):
        def _dummy_dbf(*args, **kwargs):
            return DummyDBF(rows)

        monkeypatch.setattr(imports_mod, "DBF", _dummy_dbf)

    return _patch


def test_master_import_placeholder_and_exec_inactive(db_session, admin, patch_dbf):
    rows = [
        {
            "CODE": "C1",
            "MAIN_CODE": "SDR",
            "ACCOUNT_N": "Comp1",
            "AREA": "-",
        },  # placeholder area -> skipped
        {"CODE": "C2", "MAIN_CODE": "SDR", "ACCOUNT_N": "Comp2", "AREA": "A"},  # valid
        {
            "CODE": "C2",
            "MAIN_CODE": "SDR",
            "ACCOUNT_N": "DupComp",
            "AREA": "A",
        },  # duplicate code
    ]
    patch_dbf(rows)
    metrics = import_master(db_session, filename="master.dbf")
    assert metrics["inserted"] == 2  # C1 and C2
    assert metrics["duplicate_codes"] == 1
    assert metrics["placeholder_area_skipped"] == 1
    # Executive for area A should be created inactive
    exec_user = (
        db_session.query(User)
        .filter(User.role == Role.executive, User.area == "A")
        .one()
    )
    assert exec_user.is_active is False


def test_transactions_due_date_fallback_and_negative_and_archival(
    db_session, admin, patch_dbf
):
    # Seed a company via master import first (simplify by direct insert)
    db_session.add(Company(code="C1", name="C1"))
    db_session.commit()
    today = datetime.date.today()
    # First import two bills: one with missing due (fallback) and one negative debit
    rows_first = [
        {"CODE": "C1", "BILL": "B1", "DATE": today, "DEBIT": 100},  # fallback due
        {"CODE": "C1", "BILL": "B2", "DATE": today, "DEBIT": -50},  # negative
    ]
    patch_dbf(rows_first)
    t1 = import_transactions(db_session, filename="transactions.dbf")
    assert t1["inserted"] == 2
    assert t1["fallback_due_assigned"] == 1
    assert t1["negative_debit"] == 1
    # Second import only B1 -> B2 should be archived
    rows_second = [
        {"CODE": "C1", "BILL": "B1", "DATE": today, "DEBIT": 100},
    ]
    patch_dbf(rows_second)
    t2 = import_transactions(db_session, filename="transactions.dbf")
    assert t2["inserted"] == 0 and t2["updated"] == 0
    # Archived count should be 1 (B2)
    assert t2["archived"] == 1
    b2 = (
        db_session.query(Bill)
        .filter(Bill.company_code == "C1", Bill.bill_number == "B2")
        .one()
    )
    assert b2.is_archived is True


def test_recalc_ignores_negative_residual(db_session, admin):
    # Company with one positive and one negative bill
    c = Company(code="CR1", name="CR1")
    db_session.add(c)
    db_session.commit()
    today = datetime.date.today()
    db_session.add(
        Bill(
            bill_number="P1",
            company_code=c.code,
            bill_date=today,
            due_date=today,
            amount=Decimal("100.00"),
            amount_paid=Decimal("0"),
        )
    )
    db_session.add(
        Bill(
            bill_number="N1",
            company_code=c.code,
            bill_date=today,
            due_date=today,
            amount=Decimal("-20.00"),
            amount_paid=Decimal("0"),
        )
    )
    db_session.commit()
    recalc_company_totals(db_session, c.code)
    db_session.refresh(c)
    assert Decimal(str(c.amount)) == Decimal("100.00")  # negative excluded
    # outbal only counts overdue (due_date <= today). Bills due today are overdue under new rule.
    assert Decimal(str(c.outbal)) == Decimal("0.00")


## Removed: /imports/master no longer exists (ingestion via /uploads only). Filename allowlist
## validation is internal; this test is obsolete.


def test_admin_recalc_all_endpoint(client, db_session, admin, patch_dbf):
    # Seed companies via master import mock
    rows = [
        {"CODE": "RC1", "MAIN_CODE": "SDR", "ACCOUNT_N": "R1", "AREA": "AA"},
        {"CODE": "RC2", "MAIN_CODE": "SDR", "ACCOUNT_N": "R2", "AREA": "AB"},
    ]
    patch_dbf(rows)
    import_master(db_session, filename="master.dbf")
    # Auth header for admin
    from fastapi.testclient import TestClient

    token = client.post(
        "/auth/login", json={"username": "admin_new_beh", "password": "admin"}
    ).json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}
    r = client.post("/admin/recalc-all", headers=headers)
    assert r.status_code == 200
    assert r.json().get("recalculated") >= 2
