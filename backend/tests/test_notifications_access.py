from datetime import date, timedelta, datetime
from decimal import Decimal
from app.models.models import (
    User,
    Role,
    Company,
    ExecAssignment,
    Bill,
    BillStatus,
    Notification,
    NotificationType,
    NotificationStatus,
)
from app.services.auth import hash_password
from app.services.notifications import run_notification_scan


def _login(client, username, password):
    r = client.post("/auth/login", json={"username": username, "password": password})
    assert r.status_code == 200
    return {"Authorization": f"Bearer {r.json()['access_token']}"}


def test_notifications_executive_scope_filters(db_session, client):
    admin = User(
        username="admin_scope",
        password_hash=hash_password("admin"),
        role=Role.admin,
        is_active=True,
    )
    exec1 = User(
        username="exec_scope1",
        password_hash=hash_password("pass"),
        role=Role.executive,
        is_active=True,
    )
    exec2 = User(
        username="exec_scope2",
        password_hash=hash_password("pass"),
        role=Role.executive,
        is_active=True,
    )
    db_session.add_all([admin, exec1, exec2])
    db_session.add(
        Company(
            code="C401",
            name="C401",
            credit_date=date.today() + timedelta(days=5),
            promise_date=date.today() + timedelta(days=5),
        )
    )
    db_session.add(
        Company(
            code="C402",
            name="C402",
            credit_date=date.today() + timedelta(days=5),
            promise_date=date.today() + timedelta(days=5),
        )
    )
    db_session.commit()
    b1 = Bill(
        bill_number="B1",
        company_code="C401",
        bill_date=date.today(),
        due_date=date.today() + timedelta(days=10),
        amount=Decimal("10.00"),
        amount_paid=Decimal("0"),
        status=BillStatus.pending,
        is_archived=False,
    )
    b2 = Bill(
        bill_number="B1",
        company_code="C402",
        bill_date=date.today(),
        due_date=date.today() + timedelta(days=10),
        amount=Decimal("10.00"),
        amount_paid=Decimal("0"),
        status=BillStatus.pending,
        is_archived=False,
    )
    db_session.add_all([b1, b2])
    db_session.commit()
    db_session.refresh(b1)
    db_session.refresh(b2)
    db_session.add_all(
        [
            ExecAssignment(executive_id=exec1.id, company_code="C401"),
            ExecAssignment(executive_id=exec2.id, company_code="C402"),
        ]
    )
    db_session.commit()
    h1 = _login(client, exec1.username, "pass")
    h2 = _login(client, exec2.username, "pass")
    body1 = {
        "company_code": "C401",
        "collected_at": datetime.utcnow().isoformat(),
        "amount_collected": "10.00",
        "method": "cash",
        "bill_allocations": [{"bill_id": b1.id, "amount": "10.00"}],
    }
    body2 = {
        "company_code": "C402",
        "collected_at": datetime.utcnow().isoformat(),
        "amount_collected": "10.00",
        "method": "cash",
        "bill_allocations": [{"bill_id": b2.id, "amount": "10.00"}],
    }
    assert client.post("/payments", json=body1, headers=h1).status_code == 200
    assert client.post("/payments", json=body2, headers=h2).status_code == 200
    r1 = client.get("/notifications", headers=h1)
    assert r1.status_code == 200
    assert (
        all(item.get("company_code") == "C401" for item in r1.json()["items"])
        or r1.json()["total"] == 0
    )
    r2 = client.get("/notifications", headers=h2)
    assert r2.status_code == 200
    assert (
        all(item.get("company_code") == "C402" for item in r2.json()["items"])
        or r2.json()["total"] == 0
    )


def test_notification_counts_endpoint(db_session, client):
    admin = User(
        username="admin_counts",
        password_hash=hash_password("admin"),
        role=Role.admin,
        is_active=True,
    )
    execu = User(
        username="exec_counts",
        password_hash=hash_password("pass"),
        role=Role.executive,
        is_active=True,
    )
    db_session.add_all([admin, execu])
    db_session.add(
        Company(
            code="C410",
            name="C410",
            credit_date=date.today() - timedelta(days=1),
            promise_date=date.today() - timedelta(days=1),
        )
    )
    db_session.add(
        Company(
            code="C411",
            name="C411",
            credit_date=date.today() + timedelta(days=5),
            promise_date=date.today() + timedelta(days=5),
        )
    )
    db_session.commit()
    bill = Bill(
        bill_number="B1",
        company_code="C411",
        bill_date=date.today(),
        due_date=date.today() + timedelta(days=10),
        amount=Decimal("5.00"),
        amount_paid=Decimal("0"),
        status=BillStatus.pending,
        is_archived=False,
    )
    db_session.add(bill)
    db_session.commit()
    db_session.refresh(bill)
    db_session.add(ExecAssignment(executive_id=execu.id, company_code="C411"))
    db_session.commit()
    exec_headers = _login(client, execu.username, "pass")
    body = {
        "company_code": "C411",
        "collected_at": datetime.utcnow().isoformat(),
        "amount_collected": "5.00",
        "method": "cash",
        "bill_allocations": [{"bill_id": bill.id, "amount": "5.00"}],
    }
    client.post("/payments", json=body, headers=exec_headers)
    run_notification_scan(db_session)
    admin_headers = _login(client, admin.username, "admin")
    counts = client.get("/notifications/counts", headers=admin_headers)
    assert counts.status_code == 200
    data = counts.json()
    assert any(k.startswith("payment_review:") for k in data.keys())
    assert any(k.startswith("promise_crossed:") for k in data.keys())


def test_promise_crossed_recreated_after_resolution(db_session, client):
    admin = User(
        username="admin_recur",
        password_hash=hash_password("admin"),
        role=Role.admin,
        is_active=True,
    )
    db_session.add(admin)
    db_session.add(
        Company(
            code="C420",
            name="C420",
            credit_date=date.today() - timedelta(days=1),
            promise_date=date.today() - timedelta(days=1),
        )
    )
    db_session.commit()
    run_notification_scan(db_session)
    first = (
        db_session.query(Notification)
        .filter(
            Notification.company_code == "C420",
            Notification.type == NotificationType.promise_crossed,
        )
        .one()
    )
    assert first.status == NotificationStatus.pending
    c = db_session.query(Company).filter(Company.code == "C420").one()
    c.credit_date = date.today() + timedelta(days=3)
    c.promise_date = date.today() + timedelta(days=3)
    db_session.commit()
    run_notification_scan(db_session)
    stopped = db_session.get(Notification, first.id)
    assert stopped.status == NotificationStatus.stopped
    c.credit_date = date.today() - timedelta(days=1)
    c.promise_date = date.today() - timedelta(days=1)
    db_session.commit()
    run_notification_scan(db_session)
    pending_list = (
        db_session.query(Notification)
        .filter(
            Notification.company_code == "C420",
            Notification.type == NotificationType.promise_crossed,
            Notification.status == NotificationStatus.pending,
        )
        .all()
    )
    assert any(n.id != first.id for n in pending_list)
