from datetime import datetime, timedelta, date
from decimal import Decimal
from app.models.models import (
    User,
    Role,
    Company,
    Bill,
    BillStatus,
    ExecAssignment,
    Payment,
    PaymentAllocation,
    PaymentStatus,
)
from app.services.auth import hash_password


def seed(db):
    admin = User(
        username="admin_dates",
        password_hash=hash_password("admin"),
        role=Role.admin,
        is_active=True,
    )
    execu = User(
        username="exec_dates",
        password_hash=hash_password("pass"),
        role=Role.executive,
        is_active=True,
    )
    db.add_all([admin, execu])
    db.add(Company(code="DT01", name="DT01"))
    db.commit()
    db.add(ExecAssignment(executive_id=execu.id, company_code="DT01"))
    db.commit()
    b = Bill(
        bill_number="B1",
        company_code="DT01",
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


def create_payment(db, company_code, exec_id, collected_at, amount, bill_id):
    p = Payment(
        company_code=company_code,
        executive_id=exec_id,
        collected_at=collected_at,
        amount_collected=amount,
        method="cash",
        status=PaymentStatus.submitted,
    )
    db.add(p)
    db.commit()
    db.refresh(p)
    db.add(PaymentAllocation(payment_id=p.id, bill_id=bill_id, amount=amount))
    db.commit()
    return p


def auth_header(client, username, password):
    tok = client.post(
        "/auth/login", json={"username": username, "password": password}
    ).json()["access_token"]
    return {"Authorization": f"Bearer {tok}"}


def test_payments_date_range_filters(db_session, client):
    execu, bill = seed(db_session)
    # Create payments across 3 days
    base = datetime.utcnow().replace(hour=10, minute=0, second=0, microsecond=0)
    create_payment(
        db_session,
        "DT01",
        execu.id,
        base - timedelta(days=1),
        Decimal("10.00"),
        bill.id,
    )
    mid = create_payment(db_session, "DT01", execu.id, base, Decimal("20.00"), bill.id)
    create_payment(
        db_session,
        "DT01",
        execu.id,
        base + timedelta(days=1),
        Decimal("30.00"),
        bill.id,
    )
    hdr = auth_header(client, "exec_dates", "pass")
    # date_from only (should exclude earlier day)
    r_from = client.get(
        "/companies/DT01/payments",
        headers=hdr,
        params={"date_from": base.date().isoformat()},
    )
    assert r_from.status_code == 200
    assert all(
        p["collected_at"] >= base.date().isoformat() for p in r_from.json()["items"]
    )
    # date_to only (should exclude later day)
    r_to = client.get(
        "/companies/DT01/payments",
        headers=hdr,
        params={"date_to": base.date().isoformat()},
    )
    assert r_to.status_code == 200
    assert all(
        p["collected_at"][:10] <= base.date().isoformat() for p in r_to.json()["items"]
    )
    # Both range selects only mid payment
    r_range = client.get(
        "/companies/DT01/payments",
        headers=hdr,
        params={
            "date_from": base.date().isoformat(),
            "date_to": base.date().isoformat(),
        },
    )
    assert r_range.status_code == 200
    items = r_range.json()["items"]
    assert len(items) == 1
    assert items[0]["id"] == mid.id
