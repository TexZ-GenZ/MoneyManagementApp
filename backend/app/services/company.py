from datetime import date, timedelta
from decimal import Decimal
from sqlalchemy.orm import Session
from sqlalchemy import select, func, case
from app.models.models import Company, Bill, Setting, BillStatus, Notification, NotificationType, NotificationStatus
from app.core.config import settings as cfg


def ensure_settings_row(db: Session) -> Setting:
    s = db.get(Setting, 1)
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
        prev_credit = comp.credit_date
        new_credit = oldest_due + timedelta(days=s.credit_extension_days)
        comp.credit_date = new_credit
        # Initialize promise_date if never set
        if comp.promise_date is None:
            comp.promise_date = new_credit
    db.commit()


def recompute_company_amounts(db: Session, code: str) -> None:
    """Recompute amount & outbal only (no credit/promise recalculation)."""
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
    comp = db.get(Company, code)
    comp.amount = Decimal(amounts[0])
    comp.outbal = Decimal(amounts[1])
    db.commit()


def resolve_promise_crossed_notifications(db: Session, company: Company) -> None:
    """Ensure promise_crossed notification state reflects current company dates."""
    today = date.today()
    overdue = False
    if company.credit_date and company.credit_date < today:
        overdue = True
    if company.promise_date and company.promise_date < today:
        overdue = True
    existing = db.query(Notification).filter(
        Notification.company_code == company.code,
        Notification.type == NotificationType.promise_crossed,
        Notification.status == NotificationStatus.pending,
    ).first()
    if overdue:
        if not existing:
            db.add(
                Notification(
                    company_code=company.code,
                    type=NotificationType.promise_crossed,
                    status=NotificationStatus.pending,
                    message=f"Promise/Credit date crossed for company {company.code}",
                )
            )
            db.commit()
    else:
        if existing:
            existing.status = NotificationStatus.stopped
            existing.message = "Resolved by manual date update"
            db.commit()
