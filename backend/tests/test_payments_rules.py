from datetime import datetime, date, timedelta
from decimal import Decimal
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
    NotificationType,
    NotificationStatus,
)

# Shared helpers


def seed_company_with_bills(db):
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
    db.commit()
    db.add(ExecAssignment(executive_id=execu.id, company_code="C001"))
    db.commit()
    b1 = Bill(
        bill_number="B1",
        company_code="C001",
        bill_date=date.today(),
        due_date=date.today() + timedelta(days=5),
        amount=Decimal("100.00"),
        amount_paid=Decimal("0"),
        status=BillStatus.pending,
        is_archived=False,
    )
    b2 = Bill(
        bill_number="B2",
        company_code="C001",
        bill_date=date.today(),
        due_date=date.today() + timedelta(days=6),
        amount=Decimal("50.00"),
        amount_paid=Decimal("0"),
        status=BillStatus.pending,
        is_archived=False,
    )
    db.add_all([b1, b2])
    db.commit()
    db.refresh(b1)
    db.refresh(b2)
    return admin, acct, execu, b1, b2


def login(client, username, password):
    r = client.post("/auth/login", json={"username": username, "password": password})
    assert r.status_code == 200
    return {"Authorization": f"Bearer {r.json()['access_token']}"}


# Tests


def test_reserved_allocation_conflict(client, db_session):
    admin, acct, execu, b1, b2 = seed_company_with_bills(db_session)
    h_exec = login(client, "exec", "pass")
    # First payment reserves 60 on bill b1 (pending status retained)
    body1 = {
        "company_code": "C001",
        "collected_at": datetime.utcnow().isoformat(),
        "amount_collected": "60.00",
        "method": "cash",
        "bill_allocations": [{"bill_id": b1.id, "amount": "60.00"}],
    }
    r1 = client.post("/payments", json=body1, headers=h_exec)
    assert r1.status_code == 200
    # Second tries to allocate 50; remaining after reservation = 40 so should fail
    body2 = {
        "company_code": "C001",
        "collected_at": datetime.utcnow().isoformat(),
        "amount_collected": "50.00",
        "method": "cash",
        "bill_allocations": [{"bill_id": b1.id, "amount": "50.00"}],
    }
    r2 = client.post("/payments", json=body2, headers=h_exec)
    assert r2.status_code == 400
    assert "exceeds" in r2.text.lower()


def test_admin_approval_stops_notification(client, db_session):
    admin, acct, execu, b1, b2 = seed_company_with_bills(db_session)
    h_exec = login(client, "exec", "pass")
    collected_at = datetime.utcnow().isoformat()
    body = {
        "company_code": "C001",
        "collected_at": collected_at,
        "amount_collected": "40.00",
        "method": "cash",
        "bill_allocations": [{"bill_id": b1.id, "amount": "40.00"}],
    }
    r = client.post("/payments", json=body, headers=h_exec)
    assert r.status_code == 200
    pid = r.json()["id"]
    # One pending notification
    review = (
        db_session.query(Notification)
        .filter(
            Notification.company_code == "C001",
            Notification.type == NotificationType.payment_review,
            Notification.status == NotificationStatus.pending,
        )
        .one()
    )
    h_acct = login(client, "acct", "acct")
    r_acct = client.post(f"/accountant/payments/{pid}/approve", headers=h_acct)
    assert r_acct.status_code == 200
    h_admin = login(client, "admin", "admin")
    r_admin = client.post(f"/admin/payments/{pid}/approve", headers=h_admin)
    assert r_admin.status_code == 200
    stopped = db_session.get(Notification, review.id)
    assert stopped.status == NotificationStatus.stopped


def test_next_promise_date_propagates_on_admin_approval(client, db_session):
    admin, acct, execu, b1, b2 = seed_company_with_bills(db_session)
    h_exec = login(client, "exec", "pass")
    next_promise = date.today() + timedelta(days=15)
    collected_at = datetime.utcnow().isoformat()
    body = {
        "company_code": "C001",
        "collected_at": collected_at,
        "amount_collected": "30.00",
        "method": "cash",
        "next_promise_date": str(next_promise),
        "bill_allocations": [{"bill_id": b1.id, "amount": "30.00"}],
    }
    r = client.post("/payments", json=body, headers=h_exec)
    assert r.status_code == 200
    pid = r.json()["id"]
    h_acct = login(client, "acct", "acct")
    client.post(f"/accountant/payments/{pid}/approve", headers=h_acct)
    h_admin = login(client, "admin", "admin")
    client.post(f"/admin/payments/{pid}/approve", headers=h_admin)
    comp = db_session.get(Company, "C001")
    assert comp.promise_date == next_promise


def test_admin_cannot_approve_without_accountant_approval(client, db_session):
    admin, acct, execu, b1, b2 = seed_company_with_bills(db_session)
    h_exec = login(client, "exec", "pass")
    body = {
        "company_code": "C001",
        "collected_at": datetime.utcnow().isoformat(),
        "amount_collected": "20.00",
        "method": "cash",
        "bill_allocations": [{"bill_id": b1.id, "amount": "20.00"}],
    }
    r = client.post("/payments", json=body, headers=h_exec)
    assert r.status_code == 200
    pid = r.json()["id"]
    h_admin = login(client, "admin", "admin")
    r_admin = client.post(f"/admin/payments/{pid}/approve", headers=h_admin)
    assert r_admin.status_code == 400


def test_double_accountant_approve_blocked(client, db_session):
    admin, acct, execu, b1, b2 = seed_company_with_bills(db_session)
    h_exec = login(client, "exec", "pass")
    body = {
        "company_code": "C001",
        "collected_at": datetime.utcnow().isoformat(),
        "amount_collected": "25.00",
        "method": "cash",
        "bill_allocations": [{"bill_id": b1.id, "amount": "25.00"}],
    }
    r = client.post("/payments", json=body, headers=h_exec)
    pid = r.json()["id"]
    h_acct = login(client, "acct", "acct")
    r1 = client.post(f"/accountant/payments/{pid}/approve", headers=h_acct)
    assert r1.status_code == 200
    r2 = client.post(f"/accountant/payments/{pid}/approve", headers=h_acct)
    assert r2.status_code == 400


def test_double_admin_approve_blocked(client, db_session):
    admin, acct, execu, b1, b2 = seed_company_with_bills(db_session)
    h_exec = login(client, "exec", "pass")
    body = {
        "company_code": "C001",
        "collected_at": datetime.utcnow().isoformat(),
        "amount_collected": "35.00",
        "method": "cash",
        "bill_allocations": [{"bill_id": b1.id, "amount": "35.00"}],
    }
    r = client.post("/payments", json=body, headers=h_exec)
    pid = r.json()["id"]
    h_acct = login(client, "acct", "acct")
    client.post(f"/accountant/payments/{pid}/approve", headers=h_acct)
    h_admin = login(client, "admin", "admin")
    r1 = client.post(f"/admin/payments/{pid}/approve", headers=h_admin)
    assert r1.status_code == 200
    r2 = client.post(f"/admin/payments/{pid}/approve", headers=h_admin)
    assert r2.status_code == 400


def test_reuse_idempotency_key_after_admin_approval_returns_same(client, db_session):
    admin, acct, execu, b1, b2 = seed_company_with_bills(db_session)
    h_exec = login(client, "exec", "pass")
    collected_at = datetime.utcnow().isoformat()
    body = {
        "company_code": "C001",
        "collected_at": collected_at,
        "amount_collected": "45.00",
        "method": "cash",
        "bill_allocations": [{"bill_id": b1.id, "amount": "45.00"}],
    }
    r1 = client.post(
        "/payments", json=body, headers={**h_exec, "Idempotency-Key": "K-REUSE"}
    )
    pid = r1.json()["id"]
    # approve fully
    h_acct = login(client, "acct", "acct")
    client.post(f"/accountant/payments/{pid}/approve", headers=h_acct)
    h_admin = login(client, "admin", "admin")
    client.post(f"/admin/payments/{pid}/approve", headers=h_admin)
    # resend identical request with same collected_at
    r2 = client.post(
        "/payments", json=body, headers={**h_exec, "Idempotency-Key": "K-REUSE"}
    )
    assert r2.status_code == 200
    assert r2.json()["id"] == pid
    assert r2.json()["status"] == PaymentStatus.admin_approved.value
