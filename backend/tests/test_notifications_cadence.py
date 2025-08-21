from datetime import date, timedelta
from decimal import Decimal
from app.models.models import (
    User,
    Role,
    Company,
    Bill,
    BillStatus,
    Notification,
    NotificationType,
    NotificationStatus,
    Payment,
    ExecAssignment,
)
from app.services.auth import hash_password
from app.services.notifications import run_notification_scan


def seed_company_overdue(db, code="C100", credit_offset=-2, promise_offset=-1):
    admin = User(
        username=f"admin_{code}",
        password_hash=hash_password("admin"),
        role=Role.admin,
        is_active=True,
    )
    db.add(admin)
    db.add(
        Company(
            code=code,
            name=code,
            credit_date=date.today() + timedelta(days=credit_offset),
            promise_date=date.today() + timedelta(days=promise_offset),
        )
    )
    db.commit()


def test_promise_crossed_created_once(db_session, freeze_time):
    seed_company_overdue(db_session, code="C101")
    # First scan creates notification
    run_notification_scan(db_session)
    n1 = (
        db_session.query(Notification)
        .filter(
            Notification.company_code == "C101",
            Notification.type == NotificationType.promise_crossed,
        )
        .one()
    )
    assert n1.status == NotificationStatus.pending
    # Second scan without advancing time should not duplicate or resend
    run_notification_scan(db_session)
    n_list = (
        db_session.query(Notification)
        .filter(
            Notification.company_code == "C101",
            Notification.type == NotificationType.promise_crossed,
        )
        .all()
    )
    assert len(n_list) == 1
    n_after = n_list[0]
    assert n_after.id == n1.id


def test_promise_crossed_resend_after_cadence(db_session, freeze_time):
    seed_company_overdue(db_session, code="C102")
    # Initial scan creates notification with next_send_at = now, last_sent_at = None
    run_notification_scan(db_session)
    n = (
        db_session.query(Notification)
        .filter(
            Notification.company_code == "C102",
            Notification.type == NotificationType.promise_crossed,
        )
        .one()
    )
    assert n.last_sent_at is None
    # Immediate second scan triggers first send (since next_send_at == now)
    run_notification_scan(db_session)
    first_send = db_session.get(Notification, n.id)
    assert first_send.last_sent_at is not None
    first_sent_time = first_send.last_sent_at
    # Advance less than interval -> no resend (last_sent_at unchanged)
    freeze_time(hours=1)
    run_notification_scan(db_session)
    mid = db_session.get(Notification, n.id)
    assert mid.last_sent_at == first_sent_time
    # Advance beyond interval (default 6h) -> resend updates last_sent_at
    freeze_time(hours=6)
    run_notification_scan(db_session)
    after = db_session.get(Notification, n.id)
    assert after.last_sent_at > first_sent_time
    assert after.next_send_at > after.last_sent_at


def test_promise_crossed_stops_when_resolved(db_session, freeze_time):
    seed_company_overdue(db_session, code="C103")
    run_notification_scan(db_session)
    n = (
        db_session.query(Notification)
        .filter(
            Notification.company_code == "C103",
            Notification.type == NotificationType.promise_crossed,
        )
        .one()
    )
    # Move company dates forward resolving
    c = db_session.query(Company).get("C103")
    c.credit_date = date.today() + timedelta(days=5)
    c.promise_date = date.today() + timedelta(days=5)
    db_session.add(c)
    db_session.commit()
    run_notification_scan(db_session)
    n2 = db_session.get(Notification, n.id)
    assert n2.status == NotificationStatus.stopped


def _create_payment(db_session, client, company_code: str, amount: str = "50.00"):
    """Helper: create exec user, bill, submit payment returning payment id and headers."""
    from decimal import Decimal
    from datetime import datetime, timedelta, date

    execu = User(
        username=f"exec_{company_code}",
        password_hash=hash_password("pass"),
        role=Role.executive,
        is_active=True,
    )
    admin = User(
        username=f"admin_{company_code}",
        password_hash=hash_password("admin"),
        role=Role.admin,
        is_active=True,
    )
    db_session.add_all([execu, admin])
    db_session.add(
        Company(
            code=company_code,
            name=company_code,
            credit_date=date.today() + timedelta(days=5),
            promise_date=date.today() + timedelta(days=5),
        )
    )
    db_session.commit()
    bill = Bill(
        bill_number="B1",
        company_code=company_code,
        bill_date=date.today(),
        due_date=date.today() + timedelta(days=10),
        amount=Decimal(amount),
        amount_paid=Decimal("0"),
        status=BillStatus.pending,
        is_archived=False,
    )
    db_session.add(bill)
    db_session.commit()
    db_session.refresh(bill)
    # Assign executive to company to satisfy business rule for submission
    db_session.add(ExecAssignment(executive_id=execu.id, company_code=company_code))
    db_session.commit()
    exec_headers = {
        "Authorization": f"Bearer {client.post('/auth/login', json={'username': execu.username, 'password': 'pass'}).json()['access_token']}"
    }
    body = {
        "company_code": company_code,
        "collected_at": datetime.utcnow().isoformat(),
        "amount_collected": amount,
        "method": "cash",
        "bill_allocations": [{"bill_id": bill.id, "amount": amount}],
    }
    r = client.post("/payments", json=body, headers=exec_headers)
    assert r.status_code == 200
    return r.json()["id"], exec_headers, admin.username


def test_payment_review_cadence_resend(db_session, client, freeze_time):
    """Ensure payment_review notification resends after cadence interval and not before."""
    pid, _, admin_user = _create_payment(db_session, client, "C200")
    # First scan creates notification
    run_notification_scan(db_session)
    n = (
        db_session.query(Notification)
        .filter(
            Notification.payment_id == pid,
            Notification.type == NotificationType.payment_review,
        )
        .one()
    )
    assert n.last_sent_at is None
    # Immediate second scan triggers first send
    run_notification_scan(db_session)
    first = db_session.get(Notification, n.id)
    assert first.last_sent_at is not None
    first_sent_time = first.last_sent_at
    # Advance 2h (<6 default) -> no resend
    freeze_time(hours=2)
    run_notification_scan(db_session)
    mid = db_session.get(Notification, n.id)
    assert mid.last_sent_at == first_sent_time
    # Advance beyond 6h total -> resend
    freeze_time(hours=5)  # cumulative 7h
    run_notification_scan(db_session)
    after = db_session.get(Notification, n.id)
    assert after.last_sent_at > first_sent_time
    assert after.next_send_at > after.last_sent_at


def test_payment_review_stops_after_admin_approval(db_session, client, freeze_time):
    pid, _, admin_user = _create_payment(db_session, client, "C201")
    # Create accountant to approve first
    from app.services.auth import hash_password as hp
    from app.models.models import User as U, Role as R

    acct = U(
        username="acct_C201",
        password_hash=hp("acct"),
        role=R.accountant,
        is_active=True,
    )
    db_session.add(acct)
    db_session.commit()
    acct_headers = {
        "Authorization": f"Bearer {client.post('/auth/login', json={'username': acct.username, 'password': 'acct'}).json()['access_token']}"
    }
    admin_headers = {
        "Authorization": f"Bearer {client.post('/auth/login', json={'username': admin_user, 'password': 'admin'}).json()['access_token']}"
    }
    # Initial scan create notification
    run_notification_scan(db_session)
    n = (
        db_session.query(Notification)
        .filter(
            Notification.payment_id == pid,
            Notification.type == NotificationType.payment_review,
        )
        .one()
    )
    assert n.status == NotificationStatus.pending
    # Accountant approve keeps it in review set
    r_acct = client.post(f"/accountant/payments/{pid}/approve", headers=acct_headers)
    assert r_acct.status_code == 200
    run_notification_scan(db_session)
    n2 = db_session.get(Notification, n.id)
    assert n2.status == NotificationStatus.pending
    # Admin approve -> payment leaves review set, scan should stop notification
    r_admin = client.post(f"/admin/payments/{pid}/approve", headers=admin_headers)
    assert r_admin.status_code == 200
    run_notification_scan(db_session)
    n3 = db_session.get(Notification, n.id)
    assert n3.status == NotificationStatus.stopped
