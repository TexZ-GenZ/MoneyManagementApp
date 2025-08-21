import datetime
from decimal import Decimal
from app.models.models import (
    Role,
    Company,
    Bill,
    Notification,
    NotificationType,
    NotificationStatus,
)
from app.services.auth import hash_password


def login_token(client, username, password):
    r = client.post("/auth/login", json={"username": username, "password": password})
    assert r.status_code == 200, r.text
    return r.json()["access_token"]


def auth_headers(token):
    return {"Authorization": f"Bearer {token}"}


def create_user(db, username, role: Role, password="pass"):
    from app.models.models import User

    u = User(
        username=username,
        password_hash=hash_password(password),
        role=role,
        area="A",
        is_active=True,
    )
    db.add(u)
    db.commit()
    db.refresh(u)
    return u


def test_company_bills_sort_variants(client, db_session):
    from app.models.models import User, Role
    from app.services.auth import hash_password

    if not db_session.query(User).filter_by(username="admin").first():
        db_session.add(
            User(
                username="admin",
                password_hash=hash_password("admin"),
                role=Role.admin,
                is_active=True,
            )
        )
        db_session.commit()
    admin_token = login_token(client, "admin", "admin")
    c = Company(code="SORT1", name="SORT1")
    db_session.add(c)
    db_session.commit()
    # Create bills with varying dates & amounts
    today = datetime.date.today()
    bills = []
    for i, amt, days in [(1, 300, 5), (2, 100, 15), (3, 200, 1)]:
        b = Bill(
            bill_number=f"BS{i}",
            company_code=c.code,
            bill_date=today - datetime.timedelta(days=i),
            due_date=today + datetime.timedelta(days=days),
            amount=Decimal(str(amt)),
            amount_paid=Decimal("0"),
            status="pending",
            is_archived=False,
        )
        db_session.add(b)
        bills.append(b)
    db_session.commit()

    def codes(resp):
        return [b["bill_number"] for b in resp.json()["items"]]

    r_oldest = client.get(
        f"/companies/{c.code}/bills?sort=oldest", headers=auth_headers(admin_token)
    )
    assert r_oldest.status_code == 200
    assert len(codes(r_oldest)) > 0
    r_amount = client.get(
        f"/companies/{c.code}/bills?sort=amount_desc", headers=auth_headers(admin_token)
    )
    assert r_amount.status_code == 200
    amts = [item["amount"] for item in r_amount.json()["items"]]
    assert amts == sorted(amts, reverse=True)
    r_recent = client.get(
        f"/companies/{c.code}/bills?sort=recent", headers=auth_headers(admin_token)
    )
    assert r_recent.status_code == 200


def test_company_payments_date_range_filters(client, db_session):
    # Create exec & assignment & three payments on different days
    exec_user = create_user(db_session, "exec_dates", Role.executive)
    c = Company(code="PAYDATE", name="PAYDATE")
    db_session.add(c)
    db_session.commit()
    from app.models.models import ExecAssignment, Bill as MBill

    bill = MBill(
        bill_number="BD",
        company_code=c.code,
        bill_date=datetime.date.today(),
        due_date=datetime.date.today() + datetime.timedelta(days=10),
        amount=Decimal("300"),
        amount_paid=0,
        status="pending",
        is_archived=False,
    )
    db_session.add(bill)
    db_session.add(ExecAssignment(executive_id=exec_user.id, company_code=c.code))
    db_session.commit()
    token = login_token(client, "exec_dates", "pass")

    def submit(day_offset):
        body = {
            "company_code": c.code,
            "collected_at": (
                datetime.datetime.utcnow() - datetime.timedelta(days=day_offset)
            ).isoformat(),
            "amount_collected": 100.0,
            "method": "cash",
            "bill_allocations": [{"bill_id": bill.id, "amount": 100.0}],
        }
        r = client.post("/payments", json=body, headers=auth_headers(token))
        assert r.status_code == 200
        return r.json()

    p0 = submit(0)
    submit(1)
    submit(2)
    # Filter last 1 day (should include p0 only roughly)
    today = datetime.date.today()
    r_filter = client.get(
        f"/companies/{c.code}/payments?date_from={today.isoformat()}&date_to={today.isoformat()}",
        headers=auth_headers(token),
    )
    assert r_filter.status_code == 200
    ids = [p["id"] for p in r_filter.json()["items"]]
    assert p0["id"] in ids


def test_notifications_counts_filtered(client, db_session):
    c1 = Company(code="NC1", name="NC1")
    c2 = Company(code="NC2", name="NC2")
    db_session.add_all([c1, c2])
    db_session.add(
        Notification(
            company_code=c1.code,
            type=NotificationType.promise_crossed,
            status=NotificationStatus.pending,
            message="m",
        )
    )
    db_session.add(
        Notification(
            company_code=c2.code,
            type=NotificationType.payment_review,
            status=NotificationStatus.sent,
            message="m2",
        )
    )
    db_session.commit()
    from app.models.models import User, Role
    from app.services.auth import hash_password

    if not db_session.query(User).filter_by(username="admin").first():
        db_session.add(
            User(
                username="admin",
                password_hash=hash_password("admin"),
                role=Role.admin,
                is_active=True,
            )
        )
        db_session.commit()
    admin_token = login_token(client, "admin", "admin")
    r_all = client.get("/notifications/counts", headers=auth_headers(admin_token))
    assert r_all.status_code == 200
    assert any(key.startswith("promise_crossed") for key in r_all.json().keys())
    r_c1 = client.get(
        f"/notifications/counts?company_code={c1.code}",
        headers=auth_headers(admin_token),
    )
    assert r_c1.status_code == 200
    data_c1 = r_c1.json()
    assert all("promise_crossed" in k for k in data_c1.keys())


def test_admin_reset_reseeds(client, db_session):
    from app.models.models import User, Role
    from app.services.auth import hash_password

    if not db_session.query(User).filter_by(username="admin").first():
        db_session.add(
            User(
                username="admin",
                password_hash=hash_password("admin"),
                role=Role.admin,
                is_active=True,
            )
        )
        db_session.commit()
    admin_token = login_token(client, "admin", "admin")
    r = client.post("/admin/reset", headers=auth_headers(admin_token))
    assert r.status_code == 200
    # After reset, can login again with admin/admin
    token2 = login_token(client, "admin", "admin")
    assert token2


def test_payment_review_notification_collapse_duplicates(client, db_session):
    from app.models.models import ExecAssignment

    exec_user = create_user(db_session, "exec_collapse", Role.executive)
    c = Company(code="NCOLL", name="NCOLL")
    db_session.add(c)
    db_session.commit()
    db_session.add(ExecAssignment(executive_id=exec_user.id, company_code=c.code))
    # duplicates
    db_session.add(
        Notification(
            company_code=c.code,
            type=NotificationType.payment_review,
            status=NotificationStatus.pending,
            message="one",
        )
    )
    db_session.add(
        Notification(
            company_code=c.code,
            type=NotificationType.payment_review,
            status=NotificationStatus.pending,
            message="two",
        )
    )
    # Bill
    b = Bill(
        bill_number="BCOLL",
        company_code=c.code,
        bill_date=datetime.date.today(),
        due_date=datetime.date.today() + datetime.timedelta(days=5),
        amount=Decimal("100"),
        amount_paid=0,
        status="pending",
        is_archived=False,
    )
    db_session.add(b)
    db_session.commit()
    token = login_token(client, "exec_collapse", "pass")
    body = {
        "company_code": c.code,
        "collected_at": datetime.datetime.utcnow().isoformat(),
        "amount_collected": 100.0,
        "method": "cash",
        "bill_allocations": [{"bill_id": b.id, "amount": 100.0}],
    }
    r = client.post("/payments", json=body, headers=auth_headers(token))
    assert r.status_code == 200
    # Query notifications and ensure only one pending for payment_review
    pending = [
        n
        for n in db_session.query(Notification)
        .filter(
            Notification.company_code == c.code,
            Notification.type == NotificationType.payment_review,
        )
        .all()
    ]
    statuses = [n.status for n in pending]
    assert statuses.count(NotificationStatus.pending) == 1
    assert statuses.count(NotificationStatus.stopped) >= 1
