from datetime import datetime
from decimal import Decimal
import pytest
from app.services.auth import hash_password
from app.models.models import (
    User,
    Role,
    Company,
    Bill,
    BillStatus,
    ExecAssignment,
    PaymentStatus,
    Notification,
    NotificationStatus,
)

# Helper seed for payment submission tests


def seed_base(db):
    admin = User(
        username="admin",
        password_hash=hash_password("admin"),
        role=Role.admin,
        is_active=True,
    )
    acct = User(
        username="acct",
        password_hash=hash_password("acct"),
        role=Role.accountant,
        is_active=True,
    )
    execu = User(
        username="exec",
        password_hash=hash_password("pass"),
        role=Role.executive,
        is_active=True,
    )
    db.add_all([admin, acct, execu])
    db.add(Company(code="C001", name="C001"))
    db.add(Company(code="C002", name="C002"))
    db.commit()
    db.add(ExecAssignment(executive_id=execu.id, company_code="C001"))
    db.commit()
    from datetime import date, timedelta

    b1 = Bill(
        bill_number="B1",
        company_code="C001",
        bill_date=date.today(),
        due_date=date.today() + timedelta(days=10),
        amount=Decimal("100.00"),
        amount_paid=Decimal("0"),
        status=BillStatus.pending,
        is_archived=False,
    )
    b2 = Bill(
        bill_number="B2",
        company_code="C001",
        bill_date=date.today(),
        due_date=date.today() + timedelta(days=11),
        amount=Decimal("50.00"),
        amount_paid=Decimal("0"),
        status=BillStatus.pending,
        is_archived=False,
    )
    b_other = Bill(
        bill_number="X1",
        company_code="C002",
        bill_date=date.today(),
        due_date=date.today() + timedelta(days=12),
        amount=Decimal("30.00"),
        amount_paid=Decimal("0"),
        status=BillStatus.pending,
        is_archived=False,
    )
    db.add_all([b1, b2, b_other])
    db.commit()
    db.refresh(b1)
    db.refresh(b2)
    db.refresh(b_other)
    return admin, acct, execu, b1, b2, b_other


def login(client, username, password):
    r = client.post("/auth/login", json={"username": username, "password": password})
    assert r.status_code == 200
    return {"Authorization": f"Bearer {r.json()['access_token']}"}


# ---- Validation Cases ----


def submit(client, headers, body):
    return client.post("/payments", json=body, headers=headers)


def base_body(company_code, amount="100.00"):
    return {
        "company_code": company_code,
        "collected_at": datetime.utcnow().isoformat(),
        "amount_collected": amount,
        "method": "cash",
        "bill_allocations": [],
    }


def test_allocation_total_greater_than_amount(client, db_session):
    _, _, execu, b1, b2, _ = seed_base(db_session)
    h = login(client, "exec", "pass")
    body = base_body("C001", amount="100.00")
    body["bill_allocations"] = [
        {"bill_id": b1.id, "amount": "60.00"},
        {"bill_id": b2.id, "amount": "60.00"},
    ]  # 120 > 100
    r = submit(client, h, body)
    assert r.status_code == 400
    assert "exceed" in r.text.lower()


def test_duplicate_bill_allocation_rejected(client, db_session):
    _, _, execu, b1, _, _ = seed_base(db_session)
    h = login(client, "exec", "pass")
    body = base_body("C001", amount="100.00")
    body["bill_allocations"] = [
        {"bill_id": b1.id, "amount": "50.00"},
        {"bill_id": b1.id, "amount": "50.00"},
    ]
    r = submit(client, h, body)
    assert r.status_code == 400
    assert "duplicate" in r.text.lower()


def test_no_allocations_rejected(client, db_session):
    _, _, execu, _, _, _ = seed_base(db_session)
    h = login(client, "exec", "pass")
    body = base_body("C001", amount="50.00")
    r = submit(client, h, body)
    assert r.status_code == 400
    assert "at least" in r.text.lower()


def test_allocation_other_company_rejected(client, db_session):
    _, _, execu, b1, _, b_other = seed_base(db_session)
    h = login(client, "exec", "pass")
    body = base_body("C001", amount="80.00")
    body["bill_allocations"] = [
        {"bill_id": b1.id, "amount": "50.00"},
        {"bill_id": b_other.id, "amount": "30.00"},
    ]
    r = submit(client, h, body)
    assert r.status_code == 400
    assert "does not belong" in r.text.lower()


def test_negative_allocation_amount_rejected(client, db_session):
    _, _, execu, b1, _, _ = seed_base(db_session)
    h = login(client, "exec", "pass")
    body = base_body("C001", amount="100.00")
    body["bill_allocations"] = [
        {"bill_id": b1.id, "amount": "-100.00"},
    ]
    r = submit(client, h, body)
    assert r.status_code == 400
    assert "must be > 0" in r.text


def test_idempotency_same_key_different_allocations_conflict(client, db_session):
    _, _, execu, b1, b2, _ = seed_base(db_session)
    h = login(client, "exec", "pass")
    base = base_body("C001", amount="100.00")
    body1 = dict(base)
    body1["bill_allocations"] = [{"bill_id": b1.id, "amount": "100.00"}]
    body2 = dict(base)
    body2["bill_allocations"] = [
        {"bill_id": b1.id, "amount": "50.00"},
        {"bill_id": b2.id, "amount": "50.00"},
    ]
    r1 = submit(client, {**h, "Idempotency-Key": "K-ALLOC"}, body1)
    assert r1.status_code == 200
    r2 = submit(client, {**h, "Idempotency-Key": "K-ALLOC"}, body2)
    assert r2.status_code == 409


def test_missing_idempotency_key_creates_distinct_payments(client, db_session):
    _, _, execu, b1, b2, _ = seed_base(db_session)
    h = login(client, "exec", "pass")
    body1 = base_body("C001", amount="50.00")
    body1["bill_allocations"] = [{"bill_id": b1.id, "amount": "50.00"}]
    r1 = submit(client, h, body1)
    assert r1.status_code == 200
    body2 = base_body("C001", amount="50.00")
    body2["bill_allocations"] = [{"bill_id": b2.id, "amount": "50.00"}]
    r2 = submit(client, h, body2)
    assert r2.status_code == 200
    assert r1.json()["id"] != r2.json()["id"]


def test_boundary_geo_coordinates_accept(client, db_session):
    _, _, execu, b1, _, _ = seed_base(db_session)
    h = login(client, "exec", "pass")
    body = base_body("C001", amount="100.00")
    body.update({"exec_lat": 90.0, "exec_lng": 180.0})
    body["bill_allocations"] = [{"bill_id": b1.id, "amount": "100.00"}]
    r = submit(client, h, body)
    assert r.status_code == 200
    # exec_lat / exec_lng are not in PaymentOut schema (only in detail endpoint); just ensure success
    data = r.json()
    assert data["status"] == PaymentStatus.submitted.value


def test_notification_created_once_for_first_pending_payment(client, db_session):
    _, _, execu, b1, b2, _ = seed_base(db_session)
    h = login(client, "exec", "pass")
    body1 = base_body("C001", amount="100.00")
    body1["bill_allocations"] = [{"bill_id": b1.id, "amount": "100.00"}]
    r1 = submit(client, h, body1)
    assert r1.status_code == 200
    body2 = base_body("C001", amount="50.00")
    body2["bill_allocations"] = [{"bill_id": b2.id, "amount": "50.00"}]
    r2 = submit(client, h, body2)
    assert r2.status_code == 200
    # Only one pending payment_review notification should exist
    from app.models.models import NotificationType

    rows = (
        db_session.query(Notification)
        .filter(Notification.type == NotificationType.payment_review)
        .all()
    )
    assert len(rows) == 1
    assert rows[0].status == NotificationStatus.pending


def test_allocation_nonexistent_bill_rejected(client, db_session):
    # seed base and use a bill id that doesn't exist
    _, _, execu, b1, b2, _ = seed_base(db_session)
    h = login(client, "exec", "pass")
    body = base_body("C001", amount="100.00")
    body["bill_allocations"] = [{"bill_id": 999999, "amount": "100.00"}]
    r = submit(client, h, body)
    assert r.status_code == 400
    assert "not found" in r.text.lower()


def test_allocation_archived_bill_rejected(client, db_session):
    _, _, execu, b1, b2, _ = seed_base(db_session)
    # mark b2 archived
    b2.is_archived = True
    db_session.add(b2)
    db_session.commit()
    h = login(client, "exec", "pass")
    body = base_body("C001", amount="50.00")
    body["bill_allocations"] = [{"bill_id": b2.id, "amount": "50.00"}]
    r = submit(client, h, body)
    assert r.status_code == 400
    assert "archived" in r.text.lower()


def test_allocation_non_pending_bill_rejected(client, db_session):
    _, _, execu, b1, b2, _ = seed_base(db_session)
    # make b2 status paid
    b2.status = BillStatus.paid
    db_session.add(b2)
    db_session.commit()
    h = login(client, "exec", "pass")
    body = base_body("C001", amount="50.00")
    body["bill_allocations"] = [{"bill_id": b2.id, "amount": "50.00"}]
    r = submit(client, h, body)
    assert r.status_code == 400
    assert "pending" in r.text.lower()


def test_amount_collected_must_be_positive(client, db_session):
    _, _, execu, b1, b2, _ = seed_base(db_session)
    h = login(client, "exec", "pass")
    body = base_body("C001", amount="0.00")
    body["bill_allocations"] = [{"bill_id": b1.id, "amount": "0.00"}]
    r = submit(client, h, body)
    assert r.status_code == 400
    assert "must be > 0" in r.text


def test_out_of_range_geo_rejected(client, db_session):
    _, _, execu, b1, b2, _ = seed_base(db_session)
    h = login(client, "exec", "pass")
    body = base_body("C001", amount="100.00")
    body.update({"exec_lat": 95.0, "exec_lng": 10.0})
    body["bill_allocations"] = [{"bill_id": b1.id, "amount": "100.00"}]
    r = submit(client, h, body)
    assert r.status_code == 400
    assert "lat" in r.text.lower()
