from datetime import date, timedelta
from decimal import Decimal
from sqlalchemy.orm import Session
from sqlalchemy import select, func, case
from app.models.models import Company, Bill, Setting, BillStatus
from app.core.config import settings as cfg


def ensure_settings_row(db: Session) -> Setting:
    s = db.query(Setting).get(1)
    if not s:
        s = Setting(
            id=1,
            credit_extension_days=cfg.CREDIT_EXTENSION_DAYS,
            notif_every_hours=cfg.NOTIF_EVERY_HOURS,
            payment_notif_daily_hour=cfg.PAYMENT_NOTIF_DAILY_HOUR,
        )
        db.add(s)
        db.commit()
        db.refresh(s)
    return s


def recalc_company_totals(db: Session, code: str) -> None:
    today = date.today()
    amounts = (
        db.query(
            func.coalesce(func.sum(Bill.amount - Bill.amount_paid), 0),
            func.coalesce(
                func.sum(
                    case(
                        (Bill.due_date < today, Bill.amount - Bill.amount_paid), else_=0
                    )
                ),
                0,
            ),
        )
        .filter(
            Bill.company_code == code,
            Bill.status == BillStatus.pending,
            Bill.is_archived == False,
        )
        .one()
    )
    total_due = Decimal(amounts[0])
    outbal = Decimal(amounts[1])
    comp = db.get(Company, code)
    comp.amount = total_due
    comp.outbal = outbal

    # credit_date = oldest pending due_date + extension days
    oldest_due = (
        db.query(func.min(Bill.due_date))
        .filter(
            Bill.company_code == code,
            Bill.status == BillStatus.pending,
            Bill.is_archived == False,
        )
        .scalar()
    )
    s = ensure_settings_row(db)
    if oldest_due is not None:
        comp.credit_date = oldest_due + timedelta(days=s.credit_extension_days)
    db.commit()
