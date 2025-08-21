from datetime import datetime
from decimal import Decimal
from app.models.models import Role, BillStatus, User, Company, Bill, ExecAssignment
from app.services.auth import hash_password


def seed(db):
    admin = User(username="admin", password_hash=hash_password("admin"), role=Role.admin, is_active=True)
    execu = User(username="exec", password_hash=hash_password("pass"), role=Role.executive, is_active=True)
    db.add_all([admin, execu])
    db.add(Company(code="C001", name="C001"))
    db.commit()
    db.add(ExecAssignment(executive_id=execu.id, company_code="C001"))
    db.commit()
    from datetime import date, timedelta
    b = Bill(bill_number="B1", company_code="C001", bill_date=date.today(), due_date=date.today()+timedelta(days=10), amount=Decimal("50.00"), amount_paid=Decimal("0"), status=BillStatus.pending, is_archived=False)
    db.add(b)
    db.commit()
    db.refresh(b)
    return execu, b


def login(client):
    r = client.post("/auth/login", json={"username": "exec", "password": "pass"})
    assert r.status_code == 200
    return {"Authorization": f"Bearer {r.json()['access_token']}"}


def test_idempotent_same_request(client, db_session):
    execu, bill = seed(db_session)
    hdr = login(client)
    body = {
        "company_code": "C001",
        "collected_at": datetime.utcnow().isoformat(),
        "amount_collected": "50.00",
        "method": "cash",
        "bill_allocations": [ {"bill_id": bill.id, "amount": "50.00"} ]
    }
    r1 = client.post("/payments", json=body, headers={**hdr, "Idempotency-Key": "k1"})
    assert r1.status_code == 200
    r2 = client.post("/payments", json=body, headers={**hdr, "Idempotency-Key": "k1"})
    assert r2.status_code == 200
    assert r1.json()["id"] == r2.json()["id"]


def test_idempotent_conflict(client, db_session):
    execu, bill = seed(db_session)
    hdr = login(client)
    body1 = {
        "company_code": "C001",
        "collected_at": datetime.utcnow().isoformat(),
        "amount_collected": "50.00",
        "method": "cash",
        "bill_allocations": [ {"bill_id": bill.id, "amount": "50.00"} ]
    }
    body2 = {
        **body1,
        "amount_collected": "49.00"
    }
    r1 = client.post("/payments", json=body1, headers={**hdr, "Idempotency-Key": "k2"})
    assert r1.status_code == 200
    r2 = client.post("/payments", json=body2, headers={**hdr, "Idempotency-Key": "k2"})
    assert r2.status_code == 409
