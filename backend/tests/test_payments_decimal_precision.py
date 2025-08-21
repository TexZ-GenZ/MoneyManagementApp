from datetime import datetime
from decimal import Decimal
from app.models.models import Role, BillStatus, User, Company, Bill, ExecAssignment
from app.services.auth import hash_password


def seed(db):
    admin = User(
        username="admin_dp",
        password_hash=hash_password("admin"),
        role=Role.admin,
        is_active=True,
    )
    execu = User(
        username="exec_dp",
        password_hash=hash_password("pass"),
        role=Role.executive,
        is_active=True,
    )
    db.add_all([admin, execu])
    db.add(Company(code="DP01", name="DP01"))
    db.commit()
    db.add(ExecAssignment(executive_id=execu.id, company_code="DP01"))
    db.commit()
    from datetime import date, timedelta

    b = Bill(
        bill_number="B1",
        company_code="DP01",
        bill_date=date.today(),
        due_date=date.today() + timedelta(days=5),
        amount=Decimal("10.50"),
        amount_paid=Decimal("0"),
        status=BillStatus.pending,
        is_archived=False,
    )
    db.add(b)
    db.commit()
    db.refresh(b)
    return execu, b


def login(client):
    r = client.post("/auth/login", json={"username": "exec_dp", "password": "pass"})
    assert r.status_code == 200
    return {"Authorization": f"Bearer {r.json()['access_token']}"}


def test_idempotent_trailing_zero_equivalence(db_session, client):
    execu, bill = seed(db_session)
    hdr = login(client)
    # Same numeric value expressed with different textual forms
    body_a = {
        "company_code": "DP01",
        "collected_at": datetime.utcnow().isoformat(),
        "amount_collected": "10.5",  # fewer decimals
        "method": "cash",
        "bill_allocations": [{"bill_id": bill.id, "amount": "10.50"}],
    }
    body_b = {**body_a, "amount_collected": "10.500"}
    r1 = client.post(
        "/payments", json=body_a, headers={**hdr, "Idempotency-Key": "prec1"}
    )
    assert r1.status_code == 200, r1.text
    r2 = client.post(
        "/payments", json=body_b, headers={**hdr, "Idempotency-Key": "prec1"}
    )
    # Should still treat as same request (Decimal equality) and return same record
    assert r2.status_code == 200, r2.text
    assert r1.json()["id"] == r2.json()["id"]
