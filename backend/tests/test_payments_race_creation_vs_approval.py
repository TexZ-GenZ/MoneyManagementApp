import threading
from datetime import datetime, date, timedelta
from decimal import Decimal


def seed(db_session):
    from app.models.models import User, Role, Company, Bill, BillStatus
    from app.services.auth import hash_password

    admin = User(
        username="admin_race",
        password_hash=hash_password("admin"),
        role=Role.admin,
        is_active=True,
    )
    acct = User(
        username="acct_race",
        password_hash=hash_password("acct"),
        role=Role.accountant,
        is_active=True,
    )
    execu = User(
        username="exec_race",
        password_hash=hash_password("pass"),
        role=Role.executive,
        is_active=True,
    )
    db_session.add_all([admin, acct, execu])
    db_session.commit()
    company = Company(
        code="RACE1", name="RACE1", credit_date=date.today(), promise_date=date.today()
    )
    db_session.add(company)
    db_session.commit()
    b = Bill(
        bill_number="RB1",
        company_code="RACE1",
        bill_date=date.today(),
        due_date=date.today() + timedelta(days=5),
        amount=Decimal("200.00"),
        amount_paid=Decimal(0),
        status=BillStatus.pending,
        is_archived=False,
    )
    from app.models.models import ExecAssignment

    db_session.add(b)
    db_session.commit()
    db_session.add(ExecAssignment(executive_id=execu.id, company_code="RACE1"))
    db_session.commit()
    return admin, acct, execu, b


def test_race_payment_creation_during_approval(db_session, client):
    admin, acct, execu, bill = seed(db_session)
    exec_tok = client.post(
        "/auth/login", json={"username": "exec_race", "password": "pass"}
    ).json()["access_token"]
    acct_tok = client.post(
        "/auth/login", json={"username": "acct_race", "password": "acct"}
    ).json()["access_token"]
    admin_tok = client.post(
        "/auth/login", json={"username": "admin_race", "password": "admin"}
    ).json()["access_token"]
    exec_h = {"Authorization": f"Bearer {exec_tok}"}
    acct_h = {"Authorization": f"Bearer {acct_tok}"}
    admin_h = {"Authorization": f"Bearer {admin_tok}"}
    body = {
        "company_code": "RACE1",
        "collected_at": datetime.utcnow().isoformat(),
        "amount_collected": "200.00",
        "method": "cash",
        "bill_allocations": [{"bill_id": bill.id, "amount": "200.00"}],
    }
    p = client.post("/payments", json=body, headers=exec_h).json()
    pid = p["id"]
    r_acc = client.post(f"/accountant/payments/{pid}/approve", headers=acct_h)
    assert r_acc.status_code == 200
    statuses = {}

    def admin_approve():
        statuses["admin"] = client.post(
            f"/admin/payments/{pid}/approve", headers=admin_h
        ).status_code

    def exec_new():
        statuses["new"] = client.post(
            "/payments", json=body, headers=exec_h
        ).status_code

    t1 = threading.Thread(target=admin_approve)
    t2 = threading.Thread(target=exec_new)
    t1.start()
    t2.start()
    t1.join()
    t2.join()
    assert statuses.get("admin") == 200
    assert statuses.get("new") in (400, 422)
