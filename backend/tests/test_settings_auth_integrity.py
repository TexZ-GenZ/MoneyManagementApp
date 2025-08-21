from datetime import date, timedelta, datetime
from decimal import Decimal
import pytest
from app.models.models import User, Role, Company, Bill, BillStatus, ExecAssignment
from app.services.auth import hash_password

# Settings tests


def seed_admin(db):
    admin = User(
        username="admin_settings",
        password_hash=hash_password("admin"),
        role=Role.admin,
        is_active=True,
    )
    db.add(admin)
    db.commit()
    return admin


def auth(client, username, password):
    r = client.post("/auth/login", json={"username": username, "password": password})
    assert r.status_code == 200
    return {"Authorization": f"Bearer {r.json()['access_token']}"}


def test_settings_get_defaults(client, db_session):
    seed_admin(db_session)
    h = auth(client, "admin_settings", "admin")
    r = client.get("/settings", headers=h)
    assert r.status_code == 200
    data = r.json()
    assert "credit_extension_days" in data


def test_settings_patch_partial_update(client, db_session):
    seed_admin(db_session)
    h = auth(client, "admin_settings", "admin")
    r1 = client.patch("/settings", json={"notif_every_hours": 3}, headers=h)
    assert r1.status_code == 200
    assert r1.json()["notif_every_hours"] == 3
    # other fields unchanged
    r2 = client.get("/settings", headers=h)
    assert r2.json()["notif_every_hours"] == 3


def test_settings_invalid_negative_hours(client, db_session):
    seed_admin(db_session)
    h = auth(client, "admin_settings", "admin")
    r = client.patch("/settings", json={"notif_every_hours": 0}, headers=h)
    assert r.status_code == 422


# Auth & role tests


def test_invalid_credentials(client):
    r = client.post("/auth/login", json={"username": "nope", "password": "bad"})
    assert r.status_code == 401


def test_missing_token_protected_endpoint(client):
    r = client.get("/settings")
    assert r.status_code in (401, 403)


def test_non_admin_access_admin_endpoint(client, db_session):
    # create executive only
    execu = User(
        username="notadmin",
        password_hash=hash_password("x"),
        role=Role.executive,
        is_active=True,
    )
    db_session.add(execu)
    db_session.commit()
    h = auth(client, "notadmin", "x")
    r = client.get("/settings", headers=h)
    assert r.status_code == 403


# Data integrity tests


def test_duplicate_bill_number_same_company_rejected(db_session):
    db_session.add(Company(code="C201", name="C201"))
    db_session.commit()  # ensure FK parent exists before inserting bills under FK enforcement
    from app.models.models import Bill
    from decimal import Decimal
    from datetime import date, timedelta

    b1 = Bill(
        bill_number="B1",
        company_code="C201",
        bill_date=date.today(),
        due_date=date.today() + timedelta(days=5),
        amount=Decimal("10.00"),
        amount_paid=Decimal("0"),
        status=BillStatus.pending,
        is_archived=False,
    )
    db_session.add(b1)
    db_session.commit()
    b2 = Bill(
        bill_number="B1",
        company_code="C201",
        bill_date=date.today(),
        due_date=date.today() + timedelta(days=6),
        amount=Decimal("20.00"),
        amount_paid=Decimal("0"),
        status=BillStatus.pending,
        is_archived=False,
    )
    db_session.add(b2)
    with pytest.raises(Exception):
        db_session.commit()
    db_session.rollback()


def test_duplicate_exec_assignment_rejected(db_session):
    execu = User(
        username="exec_dup",
        password_hash=hash_password("p"),
        role=Role.executive,
        is_active=True,
    )
    db_session.add(execu)
    db_session.add(Company(code="C202", name="C202"))
    db_session.commit()
    a1 = ExecAssignment(executive_id=execu.id, company_code="C202")
    a2 = ExecAssignment(executive_id=execu.id, company_code="C202")
    db_session.add_all([a1, a2])
    with pytest.raises(Exception):
        db_session.commit()
    db_session.rollback()


def test_idempotency_unique_key_violation_raw(db_session, client):
    # create admin/exec and company/bill
    admin = User(
        username="admin_imp",
        password_hash=hash_password("admin"),
        role=Role.admin,
        is_active=True,
    )
    execu = User(
        username="exec_imp",
        password_hash=hash_password("pass"),
        role=Role.executive,
        is_active=True,
    )
    db_session.add_all([admin, execu])
    db_session.add(Company(code="C203", name="C203"))
    db_session.commit()
    db_session.add(ExecAssignment(executive_id=execu.id, company_code="C203"))
    db_session.commit()
    from app.models.models import Bill
    from datetime import date, timedelta
    from decimal import Decimal

    b = Bill(
        bill_number="B1",
        company_code="C203",
        bill_date=date.today(),
        due_date=date.today() + timedelta(days=5),
        amount=Decimal("30.00"),
        amount_paid=Decimal("0"),
        status=BillStatus.pending,
        is_archived=False,
    )
    db_session.add(b)
    db_session.commit()
    db_session.refresh(b)
    # insert payment row directly with idempotency key
    from app.models.models import Payment

    collected_at = datetime.utcnow()
    p = Payment(
        company_code="C203",
        executive_id=execu.id,
        collected_at=collected_at,
        amount_collected=Decimal("30.00"),
        method="cash",
        idempotency_key="DUPKEY",
    )
    db_session.add(p)
    db_session.commit()
    db_session.refresh(p)
    # add matching allocation so subsequent request is identical
    from app.models.models import PaymentAllocation

    db_session.add(
        PaymentAllocation(payment_id=p.id, bill_id=b.id, amount=Decimal("30.00"))
    )
    db_session.commit()
    h = auth(client, "exec_imp", "pass")
    body = {
        "company_code": "C203",
        "collected_at": collected_at.isoformat(),
        "amount_collected": "30.00",
        "method": "cash",
        "bill_allocations": [{"bill_id": b.id, "amount": "30.00"}],
    }
    r = client.post("/payments", json=body, headers={**h, "Idempotency-Key": "DUPKEY"})
    # Should return existing payment (status 200) now that request matches exactly
    assert r.status_code == 200, r.text
    assert r.json()["id"] == p.id
