from datetime import datetime, date, timedelta
from decimal import Decimal
from app.models.models import User, Role, Company, Bill, BillStatus, ExecAssignment
from app.services.auth import hash_password


def seed(db):
    admin = User(
        username="admin_resv",
        password_hash=hash_password("admin"),
        role=Role.admin,
        is_active=True,
    )
    execu = User(
        username="exec_resv",
        password_hash=hash_password("pass"),
        role=Role.executive,
        is_active=True,
    )
    db.add_all([admin, execu])
    db.add(Company(code="RSV1", name="RSV1"))
    db.commit()
    db.add(ExecAssignment(executive_id=execu.id, company_code="RSV1"))
    db.commit()
    b = Bill(
        bill_number="B1",
        company_code="RSV1",
        bill_date=date.today(),
        due_date=date.today() + timedelta(days=5),
        amount=Decimal("100.00"),
        amount_paid=Decimal("0"),
        status=BillStatus.pending,
        is_archived=False,
    )
    db.add(b)
    db.commit()
    db.refresh(b)
    return execu, b


def auth(client, username, password):
    tok = client.post(
        "/auth/login", json={"username": username, "password": password}
    ).json()["access_token"]
    return {"Authorization": f"Bearer {tok}"}


def test_pending_reservation_conflict(db_session, client):
    execu, bill = seed(db_session)
    hdr = auth(client, "exec_resv", "pass")
    # First pending payment reserves part of bill (60)
    body1 = {
        "company_code": "RSV1",
        "collected_at": datetime.utcnow().isoformat(),
        "amount_collected": "60.00",
        "method": "cash",
        "bill_allocations": [{"bill_id": bill.id, "amount": "60.00"}],
    }
    r1 = client.post("/payments", json=body1, headers=hdr)
    assert r1.status_code == 200
    r_bills = client.get("/companies/RSV1/bills", headers=hdr, params={"status": "pending"})
    assert r_bills.status_code == 200
    items = r_bills.json().get("items", [])
    assert len(items) == 1
    assert Decimal(str(items[0].get("remaining_amount"))) == Decimal("40.00")
    # Second tries to allocate more than remaining (remaining 40, attempt 45)
    body2 = {
        "company_code": "RSV1",
        "collected_at": datetime.utcnow().isoformat(),
        "amount_collected": "45.00",
        "method": "cash",
        "bill_allocations": [{"bill_id": bill.id, "amount": "45.00"}],
    }
    r2 = client.post("/payments", json=body2, headers=hdr)
    assert r2.status_code == 400, r2.text
    detail = r2.json()["detail"]
    assert "bill=" in detail.lower()
    assert "remaining=" in detail.lower()
