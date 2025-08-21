from datetime import date, timedelta, datetime
from app.models.models import Role, User, Company, Bill, BillStatus, ExecAssignment
from app.services.auth import hash_password
from decimal import Decimal


def seed(db):
    admin = User(
        username="admin",
        password_hash=hash_password("admin"),
        role=Role.admin,
        is_active=True,
    )
    db.add(admin)
    db.add(
        Company(
            code="C001",
            name="C001",
            credit_date=date.today() + timedelta(days=5),
            promise_date=date.today() + timedelta(days=5),
        )
    )
    db.commit()


def login_admin(client):
    r = client.post("/auth/login", json={"username": "admin", "password": "admin"})
    assert r.status_code == 200
    return {"Authorization": f"Bearer {r.json()['access_token']}"}


def test_promise_backward_forbidden(client, db_session):
    seed(db_session)
    headers = login_admin(client)
    # first move forward
    r1 = client.patch(
        "/companies/C001/promise-date",
        json={"promise_date": str(date.today() + timedelta(days=6))},
        headers=headers,
    )
    assert r1.status_code == 200
    # then attempt backward
    r2 = client.patch(
        "/companies/C001/promise-date",
        json={"promise_date": str(date.today() + timedelta(days=4))},
        headers=headers,
    )
    assert r2.status_code == 400


def test_promise_before_credit_forbidden(client, db_session):
    seed(db_session)
    headers = login_admin(client)
    # attempt promise earlier than credit
    r = client.patch(
        "/companies/C001/promise-date",
        json={"promise_date": str(date.today() + timedelta(days=1))},
        headers=headers,
    )
    assert r.status_code == 400


def test_credit_forward_allowed_if_promise_still_ahead(client, db_session):
    # credit=+5 promise=+5 -> move promise to +10 then credit to +7 (allowed)
    admin = User(
        username="admin2",
        password_hash=hash_password("admin"),
        role=Role.admin,
        is_active=True,
    )
    db_session.add(admin)
    db_session.add(
        Company(
            code="C010",
            name="C010",
            credit_date=date.today() + timedelta(days=5),
            promise_date=date.today() + timedelta(days=5),
        )
    )
    db_session.commit()
    hdr = client.post("/auth/login", json={"username": "admin2", "password": "admin"})
    assert hdr.status_code == 200
    headers = {"Authorization": f"Bearer {hdr.json()['access_token']}"}
    # Move promise forward to +10
    r1 = client.patch(
        "/companies/C010/promise-date",
        json={"promise_date": str(date.today() + timedelta(days=10))},
        headers=headers,
    )
    assert r1.status_code == 200
    # Move credit forward to +7 (promise still ahead)
    r2 = client.patch(
        "/companies/C010/credit-date",
        json={"credit_date": str(date.today() + timedelta(days=7))},
        headers=headers,
    )
    assert r2.status_code == 200


def test_promise_equal_to_credit_allowed(client, db_session):
    admin = User(
        username="admin3",
        password_hash=hash_password("admin"),
        role=Role.admin,
        is_active=True,
    )
    db_session.add(admin)
    db_session.add(
        Company(
            code="C011",
            name="C011",
            credit_date=date.today() + timedelta(days=6),
            promise_date=date.today() + timedelta(days=6),
        )
    )
    db_session.commit()
    hdr = client.post("/auth/login", json={"username": "admin3", "password": "admin"})
    headers = {"Authorization": f"Bearer {hdr.json()['access_token']}"}
    # Re-setting to same value
    r = client.patch(
        "/companies/C011/promise-date",
        json={"promise_date": str(date.today() + timedelta(days=6))},
        headers=headers,
    )
    assert r.status_code == 200


def test_promise_forward_updates(client, db_session):
    admin = User(
        username="admin4",
        password_hash=hash_password("admin"),
        role=Role.admin,
        is_active=True,
    )
    db_session.add(admin)
    # Commit company first so FK constraint (bill.company_code -> companies.code) is satisfied even if SQLAlchemy
    # chooses to insert in a different order (no declared relationship to influence dependency graph).
    db_session.add(
        Company(
            code="C012",
            name="C012",
            credit_date=date.today() + timedelta(days=4),
            promise_date=date.today() + timedelta(days=4),
        )
    )
    db_session.commit()
    # add bill to force recompute path (separate commit ensures parent row exists before FK insert)
    db_session.add(
        Bill(
            bill_number="B1",
            company_code="C012",
            bill_date=date.today(),
            due_date=date.today() + timedelta(days=10),
            amount=Decimal("100.00"),
            amount_paid=Decimal("0"),
            status=BillStatus.pending,
            is_archived=False,
        )
    )
    db_session.commit()
    hdr = client.post("/auth/login", json={"username": "admin4", "password": "admin"})
    headers = {"Authorization": f"Bearer {hdr.json()['access_token']}"}
    new_promise = date.today() + timedelta(days=9)
    r = client.patch(
        "/companies/C012/promise-date",
        json={"promise_date": str(new_promise)},
        headers=headers,
    )
    assert r.status_code == 200
    assert r.json()["promise_date"] == str(new_promise)


def test_next_promise_date_earlier_than_current_forbidden_in_payment(
    client, db_session
):
    # Setup company with promise_date +12
    admin = User(
        username="admin5",
        password_hash=hash_password("admin"),
        role=Role.admin,
        is_active=True,
    )
    execu = User(
        username="exec5",
        password_hash=hash_password("pass"),
        role=Role.executive,
        is_active=True,
    )
    db_session.add_all([admin, execu])
    db_session.add(
        Company(
            code="C013",
            name="C013",
            credit_date=date.today() + timedelta(days=5),
            promise_date=date.today() + timedelta(days=12),
        )
    )
    db_session.commit()
    # assignment so exec can submit
    db_session.add(ExecAssignment(executive_id=execu.id, company_code="C013"))
    db_session.commit()
    # Add bill
    db_session.add(
        Bill(
            bill_number="B1",
            company_code="C013",
            bill_date=date.today(),
            due_date=date.today() + timedelta(days=15),
            amount=Decimal("50.00"),
            amount_paid=Decimal("0"),
            status=BillStatus.pending,
            is_archived=False,
        )
    )
    db_session.commit()
    # login exec
    lr_exec = client.post("/auth/login", json={"username": "exec5", "password": "pass"})
    exec_headers = {"Authorization": f"Bearer {lr_exec.json()['access_token']}"}
    # attempt payment with next_promise earlier (+10)
    bill_id = db_session.query(Bill).filter(Bill.company_code == "C013").first().id
    body = {
        "company_code": "C013",
        "collected_at": datetime.utcnow().isoformat(),
        "amount_collected": "50.00",
        "method": "cash",
        "next_promise_date": str(date.today() + timedelta(days=10)),
        "bill_allocations": [{"bill_id": bill_id, "amount": "50.00"}],
    }
    r = client.post("/payments", json=body, headers=exec_headers)
    assert r.status_code == 400
    assert "move backward" in r.text.lower() or "earlier" in r.text.lower()


def test_credit_update_invalidates_existing_promise_error(client, db_session):
    admin = User(
        username="admin6",
        password_hash=hash_password("admin"),
        role=Role.admin,
        is_active=True,
    )
    db_session.add(admin)
    db_session.add(
        Company(
            code="C014",
            name="C014",
            credit_date=date.today() + timedelta(days=5),
            promise_date=date.today() + timedelta(days=10),
        )
    )
    db_session.commit()
    lr = client.post("/auth/login", json={"username": "admin6", "password": "admin"})
    headers = {"Authorization": f"Bearer {lr.json()['access_token']}"}
    # Attempt to set credit to +11 (promise 10 < 11) -> 400
    r = client.patch(
        "/companies/C014/credit-date",
        json={"credit_date": str(date.today() + timedelta(days=11))},
        headers=headers,
    )
    assert r.status_code == 400
    assert "existing promise" in r.text.lower() or "earlier" in r.text.lower()


def test_accountant_cannot_approve_after_admin_approval(client, db_session):
    # Create users & company & bill
    admin = User(
        username="admin7",
        password_hash=hash_password("admin"),
        role=Role.admin,
        is_active=True,
    )
    acct = User(
        username="acct7",
        password_hash=hash_password("acct"),
        role=Role.accountant,
        is_active=True,
    )
    execu = User(
        username="exec7",
        password_hash=hash_password("pass"),
        role=Role.executive,
        is_active=True,
    )
    db_session.add_all([admin, acct, execu])
    db_session.add(
        Company(
            code="C015",
            name="C015",
            credit_date=date.today() + timedelta(days=5),
            promise_date=date.today() + timedelta(days=5),
        )
    )
    db_session.commit()
    db_session.add(ExecAssignment(executive_id=execu.id, company_code="C015"))
    db_session.commit()
    # Bill
    db_session.add(
        Bill(
            bill_number="B1",
            company_code="C015",
            bill_date=date.today(),
            due_date=date.today() + timedelta(days=7),
            amount=Decimal("20.00"),
            amount_paid=Decimal("0"),
            status=BillStatus.pending,
            is_archived=False,
        )
    )
    db_session.commit()
    # logins
    h_admin = {
        "Authorization": f"Bearer {client.post('/auth/login', json={'username':'admin7','password':'admin'}).json()['access_token']}"
    }
    h_acct = {
        "Authorization": f"Bearer {client.post('/auth/login', json={'username':'acct7','password':'acct'}).json()['access_token']}"
    }
    h_exec = {
        "Authorization": f"Bearer {client.post('/auth/login', json={'username':'exec7','password':'pass'}).json()['access_token']}"
    }
    # Submit payment
    bill_id = db_session.query(Bill).filter(Bill.company_code == "C015").first().id
    body = {
        "company_code": "C015",
        "collected_at": datetime.utcnow().isoformat(),
        "amount_collected": "20.00",
        "method": "cash",
        "bill_allocations": [{"bill_id": bill_id, "amount": "20.00"}],
    }
    r_submit = client.post("/payments", json=body, headers=h_exec)
    assert r_submit.status_code == 200
    pid = r_submit.json()["id"]
    # Accountant approve
    r_acct = client.post(f"/accountant/payments/{pid}/approve", headers=h_acct)
    assert r_acct.status_code == 200
    # Admin approve
    r_admin = client.post(f"/admin/payments/{pid}/approve", headers=h_admin)
    assert r_admin.status_code == 200
    # Accountant tries again after admin approval -> 400
    r_acct_again = client.post(f"/accountant/payments/{pid}/approve", headers=h_acct)
    assert r_acct_again.status_code == 400
