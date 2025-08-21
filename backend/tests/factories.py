from datetime import date, datetime, timedelta
from decimal import Decimal
from app.models.models import (
    User,
    Role,
    Company,
    Bill,
    ExecAssignment,
    BillStatus,
    Setting,
)
from app.services.auth import hash_password

# Lightweight factory helpers for tests


def create_user(
    db, username: str, role: Role, password: str = "pass", is_active: bool = True
):
    u = User(
        username=username,
        password_hash=hash_password(password),
        role=role,
        is_active=is_active,
    )
    db.add(u)
    db.commit()
    db.refresh(u)
    return u


def create_company(
    db,
    code: str,
    name: str | None = None,
    amount=0,
    outbal=0,
    credit_date=None,
    promise_date=None,
):
    c = Company(
        code=code,
        name=name or code,
        amount=Decimal(str(amount)),
        outbal=Decimal(str(outbal)),
        credit_date=credit_date,
        promise_date=promise_date,
    )
    db.add(c)
    db.commit()
    db.refresh(c)
    return c


def assign_exec(db, exec_user: User, company_code: str):
    db.add(ExecAssignment(executive_id=exec_user.id, company_code=company_code))
    db.commit()


def create_bill(
    db, company_code: str, bill_number: str, amount: str = "100.00", days_due: int = 5
):
    from datetime import date

    b = Bill(
        bill_number=bill_number,
        company_code=company_code,
        bill_date=date.today(),
        due_date=date.today() + timedelta(days=days_due),
        amount=Decimal(amount),
        amount_paid=Decimal("0"),
        status=BillStatus.pending,
        is_archived=False,
    )
    db.add(b)
    db.commit()
    db.refresh(b)
    return b


def submit_payment(
    client,
    token: str,
    company_code: str,
    amount: str,
    allocations: list[tuple[int, str]],
    collected_at: datetime | None = None,
    idempotency_key: str | None = None,
):
    headers = {"Authorization": f"Bearer {token}"}
    if idempotency_key:
        headers["Idempotency-Key"] = idempotency_key
    body = {
        "company_code": company_code,
        "collected_at": (collected_at or datetime.utcnow()).isoformat(),
        "amount_collected": amount,
        "method": "cash",
        "bill_allocations": [
            {"bill_id": bid, "amount": amt} for bid, amt in allocations
        ],
    }
    return client.post("/payments", json=body, headers=headers)


def submit_payment_autosplit(
    client, token: str, company_code: str, total: str, bills: list[Bill]
):
    # Evenly (or near evenly) splits total across provided bills preserving 2-decimal amounts.
    from decimal import Decimal, ROUND_DOWN

    total_dec = Decimal(total)
    base = (total_dec / len(bills)).quantize(Decimal("0.01"), rounding=ROUND_DOWN)
    allocations = []
    running = Decimal("0.00")
    for i, b in enumerate(bills):
        if i == len(bills) - 1:
            amt = (total_dec - running).quantize(Decimal("0.01"))
        else:
            amt = base
        running += amt
        allocations.append((b.id, f"{amt:.2f}"))
    return submit_payment(client, token, company_code, f"{total_dec:.2f}", allocations)


def settings_factory(db, notif_every_hours=2, payment_notif_daily_hour=9):
    s = db.get(Setting, 1)
    if not s:
        s = Setting(
            id=1,
            notif_every_hours=notif_every_hours,
            payment_notif_daily_hour=payment_notif_daily_hour,
        )
        db.add(s)
    else:
        s.notif_every_hours = notif_every_hours
        s.payment_notif_daily_hour = payment_notif_daily_hour
        db.add(s)
    db.commit()
    db.refresh(s)
    return s


def run_imports(db, master_file="master.dbf", tx_file="transactions.dbf"):
    from app.services.imports import import_master, import_transactions

    m = import_master(db, master_file)
    t = import_transactions(db, tx_file)
    return m, t
