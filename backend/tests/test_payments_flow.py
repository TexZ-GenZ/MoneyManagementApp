from datetime import datetime
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

# Seed scenario: two bills to test partial vs full payment


def seed_flow(db):
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
    from datetime import date, timedelta

    b1 = Bill(
        bill_number="B1",
        company_code="C001",
        bill_date=date.today(),
        due_date=date.today() + timedelta(days=5),
        amount=Decimal("120.00"),
        amount_paid=Decimal("0"),
        status=BillStatus.pending,
        is_archived=False,
    )
    b2 = Bill(
        bill_number="B2",
        company_code="C001",
        bill_date=date.today(),
        due_date=date.today() + timedelta(days=6),
        amount=Decimal("80.00"),
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


# ----- Tests -----


def test_full_approval_flow_partial_then_paid(client, db_session):
    admin, acct, execu, b1, b2 = seed_flow(db_session)
    h_exec = login(client, "exec", "pass")
    # Submit payment covering only b1 partially
    body = {
        "company_code": "C001",
        "collected_at": datetime.utcnow().isoformat(),
        "amount_collected": "120.00",
        "method": "cash",
        "bill_allocations": [{"bill_id": b1.id, "amount": "120.00"}],
    }
    r_submit = client.post("/payments", json=body, headers=h_exec)
    assert r_submit.status_code == 200
    pid = r_submit.json()["id"]
    # Accountant approve
    h_acct = login(client, "acct", "acct")
    r_acct = client.post(f"/accountant/payments/{pid}/approve", headers=h_acct)
    assert r_acct.status_code == 200
    assert r_acct.json()["status"] == PaymentStatus.accountant_approved.value
    # Admin approve -> should mark bill1 paid
    h_admin = login(client, "admin", "admin")
    r_admin = client.post(f"/admin/payments/{pid}/approve", headers=h_admin)
    assert r_admin.status_code == 200
    assert r_admin.json()["status"] == PaymentStatus.admin_approved.value
    # Reload bill
    b1_db = db_session.get(Bill, b1.id)
    assert b1_db.amount_paid == Decimal("120.00")
    assert b1_db.status == BillStatus.paid
    # Company totals adjusted (b2 still pending 80)
    comp = db_session.get(Company, "C001")
    assert comp.amount == Decimal("80.00")


def test_accountant_decline_stops_notification(client, db_session):
    admin, acct, execu, b1, b2 = seed_flow(db_session)
    h_exec = login(client, "exec", "pass")
    body = {
        "company_code": "C001",
        "collected_at": datetime.utcnow().isoformat(),
        "amount_collected": "100.00",
        "method": "cash",
        "bill_allocations": [{"bill_id": b1.id, "amount": "100.00"}],
    }
    r_submit = client.post("/payments", json=body, headers=h_exec)
    assert r_submit.status_code == 200
    pid = r_submit.json()["id"]
    # One pending review notification
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
    r_decl = client.post(f"/accountant/payments/{pid}/decline", headers=h_acct)
    assert r_decl.status_code == 200
    assert r_decl.json()["status"] == PaymentStatus.declined_by_accountant.value
    # Notification should be stopped now
    stopped = db_session.get(Notification, review.id)
    assert stopped.status == NotificationStatus.stopped


def test_admin_decline_after_accountant_approve(client, db_session):
    admin, acct, execu, b1, b2 = seed_flow(db_session)
    h_exec = login(client, "exec", "pass")
    body = {
        "company_code": "C001",
        "collected_at": datetime.utcnow().isoformat(),
        "amount_collected": "80.00",
        "method": "cash",
        "bill_allocations": [{"bill_id": b2.id, "amount": "80.00"}],
    }
    r_submit = client.post("/payments", json=body, headers=h_exec)
    assert r_submit.status_code == 200
    pid = r_submit.json()["id"]
    h_acct = login(client, "acct", "acct")
    r_acct = client.post(f"/accountant/payments/{pid}/approve", headers=h_acct)
    assert r_acct.status_code == 200
    h_admin = login(client, "admin", "admin")
    r_decl = client.post(f"/admin/payments/{pid}/decline", headers=h_admin)
    assert r_decl.status_code == 200
    assert r_decl.json()["status"] == PaymentStatus.declined_by_admin.value
    # Payment cannot be approved after decline
    r_approve_again = client.post(f"/admin/payments/{pid}/approve", headers=h_admin)
    assert r_approve_again.status_code == 400


def test_admin_cannot_decline_unapproved_payment(client, db_session):
    admin, acct, execu, b1, b2 = seed_flow(db_session)
    h_exec = login(client, "exec", "pass")
    body = {
        "company_code": "C001",
        "collected_at": datetime.utcnow().isoformat(),
        "amount_collected": "60.00",
        "method": "cash",
        "bill_allocations": [{"bill_id": b1.id, "amount": "60.00"}],
    }
    r_submit = client.post("/payments", json=body, headers=h_exec)
    assert r_submit.status_code == 200
    pid = r_submit.json()["id"]
    h_admin = login(client, "admin", "admin")
    r_decl = client.post(f"/admin/payments/{pid}/decline", headers=h_admin)
    assert r_decl.status_code == 400


def test_accountant_cannot_decline_non_submitted(client, db_session):
    admin, acct, execu, b1, b2 = seed_flow(db_session)
    h_exec = login(client, "exec", "pass")
    body = {
        "company_code": "C001",
        "collected_at": datetime.utcnow().isoformat(),
        "amount_collected": "40.00",
        "method": "cash",
        "bill_allocations": [{"bill_id": b1.id, "amount": "40.00"}],
    }
    r_submit = client.post("/payments", json=body, headers=h_exec)
    assert r_submit.status_code == 200
    pid = r_submit.json()["id"]
    h_acct = login(client, "acct", "acct")
    # approve first
    r_acct = client.post(f"/accountant/payments/{pid}/approve", headers=h_acct)
    assert r_acct.status_code == 200
    # now decline should fail
    r_decl = client.post(f"/accountant/payments/{pid}/decline", headers=h_acct)
    assert r_decl.status_code == 400
