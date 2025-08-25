from datetime import date, timedelta
from decimal import Decimal
from sqlalchemy.orm import Session
from sqlalchemy import select, func, case, and_
from app.models.models import (
    Company,
    Bill,
    Setting,
    BillStatus,
    Notification,
    NotificationType,
    NotificationStatus,
)
from app.core.config import settings as cfg


def ensure_settings_row(db: Session) -> Setting:
    """
    Ensure a settings row exists in the DB, creating with defaults if missing.
    """
    s = db.get(Setting, 1)
    if not s:
        s = Setting(
            id=1,
            credit_extension_days=cfg.CREDIT_EXTENSION_DAYS,
            notif_every_hours=cfg.NOTIF_EVERY_HOURS,
            exec_window_start_hour=6,
            exec_window_end_hour=22,
        )
        db.add(s)
        db.commit()
        db.refresh(s)
    return s


def recalc_company_totals(db: Session, code: str) -> None:
    """Recalculate company amount, outbal, credit_date.

    Semantics:
    - amount: total positive outstanding residual across all pending, active bills (residual = max(amount-amount_paid, 0)).
    - outbal: subset of that outstanding which is overdue (due_date <= today; same-day counts as overdue).
    - credit_date: oldest due_date among positive-residual bills + extension days; cleared if none.
    - Negative residuals (credit notes / overpayments) excluded from sums.
    """
    today = date.today()
    residual = Bill.amount - Bill.amount_paid
    positive_residual = case((residual > 0, residual), else_=0)
    total_due = Decimal(
        db.query(func.coalesce(func.sum(positive_residual), 0))
        .filter(
            Bill.company_code == code,
            Bill.status == BillStatus.pending,
            Bill.is_archived == False,
        )
        .scalar()
    )
    overdue_sum = Decimal(
        db.query(func.coalesce(func.sum(positive_residual), 0))
        .filter(
            Bill.company_code == code,
            Bill.status == BillStatus.pending,
            Bill.is_archived == False,
            Bill.due_date <= today,
            (Bill.amount - Bill.amount_paid) > 0,
        )
        .scalar()
    )
    comp = db.get(Company, code)
    comp.amount = total_due
    comp.outbal = overdue_sum
    # credit_date = oldest due among positive-residual pending bills + extension days
    oldest_due = (
        db.query(func.min(Bill.due_date))
        .filter(
            Bill.company_code == code,
            Bill.status == BillStatus.pending,
            Bill.is_archived == False,
            (Bill.amount - Bill.amount_paid) > 0,
        )
        .scalar()
    )
    s = ensure_settings_row(db)
    if oldest_due is not None:
        # Persist the oldest due date for quick filtering in list APIs/UI
        comp.oldest_due_date = oldest_due
        new_credit = oldest_due + timedelta(days=s.credit_extension_days)
        comp.credit_date = new_credit
        # Keep invariant: promise_date >= credit_date (DB check enforces this)
        # Rules:
        # - If no promise_date, set to auto=new_credit.
        # - If promise is auto and behind new credit, move it up to credit.
        # - If promise is manual (exec/admin) and behind, still clamp up to credit to satisfy invariant.
        try:
            from app.models.models import Company as CompanyModel

            if comp.promise_date is None:
                comp.promise_date = new_credit
                comp.promise_date_source = CompanyModel.PromiseSource.auto
            elif comp.promise_date < new_credit:
                comp.promise_date = new_credit
                # Preserve source flag; do not downgrade manual -> auto
                if getattr(comp, "promise_date_source", None) is None:
                    comp.promise_date_source = CompanyModel.PromiseSource.auto
        except Exception:
            if comp.promise_date is None or comp.promise_date < new_credit:
                comp.promise_date = new_credit
    else:
        # No positive outstanding bills -> reset credit/outbal baseline
        comp.credit_date = None
        comp.oldest_due_date = None
        # promise_date left untouched (business rule: manual promise stays even if cleared) – adjust if needed
    db.commit()


def recompute_company_amounts(db: Session, code: str) -> None:
    """Recompute amount & outbal (overdue-only) without touching credit/promise dates."""
    today = date.today()
    residual = Bill.amount - Bill.amount_paid
    positive_residual = case((residual > 0, residual), else_=0)
    amount_sum = Decimal(
        db.query(func.coalesce(func.sum(positive_residual), 0))
        .filter(
            Bill.company_code == code,
            Bill.status == BillStatus.pending,
            Bill.is_archived == False,
        )
        .scalar()
    )
    overdue_sum = Decimal(
        db.query(func.coalesce(func.sum(positive_residual), 0))
        .filter(
            Bill.company_code == code,
            Bill.status == BillStatus.pending,
            Bill.is_archived == False,
            Bill.due_date <= today,
            (Bill.amount - Bill.amount_paid) > 0,
        )
        .scalar()
    )
    comp = db.get(Company, code)
    comp.amount = amount_sum
    comp.outbal = overdue_sum
    # Also refresh oldest_due_date to keep it in sync
    oldest_due = (
        db.query(func.min(Bill.due_date))
        .filter(
            Bill.company_code == code,
            Bill.status == BillStatus.pending,
            Bill.is_archived == False,
            (Bill.amount - Bill.amount_paid) > 0,
        )
        .scalar()
    )
    comp.oldest_due_date = oldest_due
    db.commit()


def resolve_promise_crossed_notifications(db: Session, company: Company) -> None:
    """
    Ensure promise_crossed notification state reflects current company dates.
    Mark notification as stopped if dates are resolved.
    """
    today = date.today()
    overdue = False
    if company.credit_date and company.credit_date <= today:
        overdue = True
    if company.promise_date and company.promise_date <= today:
        overdue = True
    existing = (
        db.query(Notification)
        .filter(
            Notification.company_code == company.code,
            Notification.type == NotificationType.promise_crossed,
            Notification.status == NotificationStatus.pending,
        )
        .first()
    )
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
