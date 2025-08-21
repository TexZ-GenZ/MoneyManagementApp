import threading
from datetime import datetime, date, timedelta
from decimal import Decimal
from app.models.models import (
    User,
    Role,
    Company,
    Bill,
    BillStatus,
    ExecAssignment,
    PaymentStatus,
)
from app.services.auth import hash_password
from fastapi.testclient import TestClient
from app.main import app


def seed(db_session):
    admin = User(
        username="admin_race2",
        password_hash=hash_password("admin"),
        role=Role.admin,
        is_active=True,
    )
    acct = User(
        username="acct_race2",
        password_hash=hash_password("acct"),
        role=Role.accountant,
        is_active=True,
    )
    execu = User(
        username="exec_race2",
        password_hash=hash_password("exec"),
        role=Role.executive,
        is_active=True,
    )
    db_session.add_all([admin, acct, execu])
    db_session.commit()
    company = Company(
        code="RACE2", name="RACE2", credit_date=date.today(), promise_date=date.today()
    )
    db_session.add(company)
    db_session.commit()
    db_session.add(ExecAssignment(executive_id=execu.id, company_code="RACE2"))
    db_session.commit()
    bill = Bill(
        bill_number="RB2",
        company_code="RACE2",
        bill_date=date.today(),
        due_date=date.today() + timedelta(days=5),
        amount=Decimal("500.00"),
        amount_paid=Decimal(0),
        status=BillStatus.pending,
        is_archived=False,
    )
    db_session.add(bill)
    db_session.commit()
    return admin, acct, execu, bill


def test_race_creation_while_bill_approval(db_session):
    admin, acct, execu, bill = seed(db_session)
    client = TestClient(app)
    exec_tok = client.post(
        "/auth/login", json={"username": "exec_race2", "password": "exec"}
    ).json()["access_token"]
    acct_tok = client.post(
        "/auth/login", json={"username": "acct_race2", "password": "acct"}
    ).json()["access_token"]
    admin_tok = client.post(
        "/auth/login", json={"username": "admin_race2", "password": "admin"}
    ).json()["access_token"]
    exec_h = {"Authorization": f"Bearer {exec_tok}"}
    acct_h = {"Authorization": f"Bearer {acct_tok}"}
    admin_h = {"Authorization": f"Bearer {admin_tok}"}

    body = {
        "company_code": "RACE2",
        "collected_at": datetime.utcnow().isoformat(),
        "amount_collected": "500.00",
        "method": "cash",
        "bill_allocations": [{"bill_id": bill.id, "amount": "500.00"}],
    }

    # First payment to set up race
    p = client.post("/payments", json=body, headers=exec_h).json()
    pid = p["id"]
    # Accountant approves
    r_acc = client.post(f"/accountant/payments/{pid}/approve", headers=acct_h)
    assert r_acc.status_code == 200

    # Thread 1: Admin approval (finalizes bill to paid via allocation)
    # Thread 2: Executive tries to submit a second payment allocating same bill after approval process triggers.

    statuses = {}

    def admin_approve():
        statuses["admin"] = client.post(
            f"/admin/payments/{pid}/approve", headers=admin_h
        ).status_code

    def exec_new_payment():
        statuses["new"] = client.post(
            "/payments", json=body, headers=exec_h
        ).status_code

    t1 = threading.Thread(target=admin_approve)
    t2 = threading.Thread(target=exec_new_payment)
    t1.start()
    t2.start()
    t1.join()
    t2.join()

    assert statuses["admin"] == 200
    # New payment should fail because bill fully satisfied / no remaining amount
    assert statuses["new"] in (400, 422)
