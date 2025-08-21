from datetime import datetime
from decimal import Decimal
import pytest
from app.models.models import Role, PaymentStatus, ExecAssignment
from app.services.auth import hash_password
from app.models.models import User, Company, Bill, BillStatus


def seed_user_company_bill(db):
    admin = User(username="admin", password_hash=hash_password("admin"), role=Role.admin, is_active=True)
    execu = User(username="exec", password_hash=hash_password("pass"), role=Role.executive, is_active=True)
    db.add_all([admin, execu])
    db.add(Company(code="C001", name="C001"))
    db.commit()
    # assignment so executive can submit payments
    db.add(ExecAssignment(executive_id=execu.id, company_code="C001"))
    db.commit()
    # Bill
    from datetime import date, timedelta
    b = Bill(bill_number="B1", company_code="C001", bill_date=date.today(), due_date=date.today()+timedelta(days=10), amount=Decimal("100.00"), amount_paid=Decimal("0"), status=BillStatus.pending, is_archived=False)
    db.add(b)
    db.commit()
    db.refresh(b)
    return admin, execu, b


def login(client, username, password):
    resp = client.post("/auth/login", json={"username": username, "password": password})
    assert resp.status_code == 200
    return {"Authorization": f"Bearer {resp.json()['access_token']}"}


def test_payment_allocation_exact(client, db_session):
    admin, execu, bill = seed_user_company_bill(db_session)
    headers = login(client, "exec", "pass")
    body = {
        "company_code": "C001",
        "collected_at": datetime.utcnow().isoformat(),
        "amount_collected": "100.00",
        "method": "cash",
        "bill_allocations": [ {"bill_id": bill.id, "amount": "100.00"} ]
    }
    r = client.post("/payments", json=body, headers=headers)
    assert r.status_code == 200, r.text
    data = r.json()
    assert data["status"] == PaymentStatus.submitted.value


def test_payment_allocation_sum_mismatch(client, db_session):
    admin, execu, bill = seed_user_company_bill(db_session)
    headers = login(client, "exec", "pass")
    body = {
        "company_code": "C001",
        "collected_at": datetime.utcnow().isoformat(),
        "amount_collected": "100.00",
        "method": "cash",
        "bill_allocations": [ {"bill_id": bill.id, "amount": "90.00"} ]
    }
    r = client.post("/payments", json=body, headers=headers)
    assert r.status_code == 400
    assert "Allocation total" in r.text or "must equal" in r.text
