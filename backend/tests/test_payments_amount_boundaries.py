from decimal import Decimal
from datetime import date, timedelta


def _seed(db_session):
    from app.models.models import User, Role, Company, Bill, BillStatus
    from app.services.auth import hash_password

    admin = User(
        username="admin_amt",
        password_hash=hash_password("admin"),
        role=Role.admin,
        is_active=True,
    )
    execu = User(
        username="exec_amt",
        password_hash=hash_password("pass"),
        role=Role.executive,
        is_active=True,
    )
    db_session.add_all([admin, execu])
    db_session.commit()  # ensure users exist before FK usage
    company = Company(
        code="BMAX", name="BMAX", credit_date=date.today(), promise_date=date.today()
    )
    db_session.add(company)
    db_session.commit()  # commit company so FK exists
    # create assignment so executive can submit payment
    from app.models.models import ExecAssignment

    db_session.add(ExecAssignment(executive_id=execu.id, company_code="BMAX"))
    db_session.commit()
    b = Bill(
        bill_number="BIG1",
        company_code="BMAX",
        bill_date=date.today(),
        due_date=date.today() + timedelta(days=10),
        amount=Decimal("999999999999.99"),
        amount_paid=Decimal(0),
        status=BillStatus.pending,
        is_archived=False,
    )
    db_session.add(b)
    db_session.commit()
    return admin, execu, b


def test_payment_large_amount_boundary_accept(db_session, client):
    admin, execu, bill = _seed(db_session)
    tok = client.post(
        "/auth/login", json={"username": "exec_amt", "password": "pass"}
    ).json()["access_token"]
    headers = {"Authorization": f"Bearer {tok}"}
    body = {
        "company_code": "BMAX",
        "collected_at": date.today().isoformat(),
        "amount_collected": "999999999999.99",
        "method": "cash",
        "bill_allocations": [{"bill_id": bill.id, "amount": "999999999999.99"}],
    }
    r = client.post("/payments", json=body, headers=headers)
    assert r.status_code == 200, r.text


def test_payment_amount_overflow_rejected(db_session, client):
    admin, execu, bill = _seed(db_session)
    tok = client.post(
        "/auth/login", json={"username": "exec_amt", "password": "pass"}
    ).json()["access_token"]
    headers = {"Authorization": f"Bearer {tok}"}
    body = {
        "company_code": "BMAX",
        "collected_at": date.today().isoformat(),
        "amount_collected": "1000000000000.00",
        "method": "cash",
        "bill_allocations": [{"bill_id": bill.id, "amount": "1000000000000.00"}],
    }
    r = client.post("/payments", json=body, headers=headers)
    assert r.status_code in (400, 422)
