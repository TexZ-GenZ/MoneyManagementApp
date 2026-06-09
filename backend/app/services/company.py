from datetime import date, timedelta
from decimal import Decimal
from sqlalchemy.orm import Session
from sqlalchemy import select, func, case, and_, literal
from app.models.models import (
    Company,
    Bill,
    Payment,
    PaymentStatus,
    Setting,
    BillStatus,
    Notification,
    NotificationType,
    NotificationStatus,
)
from app.core.config import settings as cfg


def effective_due_date_expr(credit_days: int):
    return func.coalesce(
        Bill.promise_date, Bill.bill_date + literal(credit_days), Bill.due_date
    )


def _get_company_amounts(db: Session, codes: list[str]) -> dict[str, Decimal]:
    if not codes:
        return {}
    opening_rows = (
        db.query(Company.code, Company.opening_balance)
        .filter(Company.code.in_(codes))
        .all()
    )
    opening_map = {code: Decimal(str(opening or 0)) for code, opening in opening_rows}
    bill_rows = (
        db.query(Bill.company_code, func.coalesce(func.sum(Bill.amount), 0))
        .filter(Bill.company_code.in_(codes), Bill.is_archived == False)
        .group_by(Bill.company_code)
        .all()
    )
    bill_sum = {code: Decimal(str(total)) for code, total in bill_rows}
    payment_rows = (
        db.query(
            Payment.company_code, func.coalesce(func.sum(Payment.amount_collected), 0)
        )
        .filter(
            Payment.company_code.in_(codes),
            Payment.status == PaymentStatus.admin_approved,
        )
        .group_by(Payment.company_code)
        .all()
    )
    payment_sum = {code: Decimal(str(total)) for code, total in payment_rows}
    amounts: dict[str, Decimal] = {}
    for code in codes:
        opening = opening_map.get(code, Decimal("0"))
        bills = bill_sum.get(code, Decimal("0"))
        paid = payment_sum.get(code, Decimal("0"))
        amounts[code] = opening + bills - paid
    return amounts


def get_company_rollups(
    db: Session, codes: list[str], credit_days: int
) -> dict[str, dict]:
    if not codes:
        return {}
    residual = Bill.amount - Bill.amount_paid
    overdue_positive = case(
        (
            and_(
                residual > 0,
                effective_due_date_expr(credit_days) <= func.current_date(),
            ),
            residual,
        ),
        else_=0,
    )
    eff_due = effective_due_date_expr(credit_days)

    amount_map = _get_company_amounts(db, codes)
    rows = (
        db.query(
            Bill.company_code.label("code"),
            func.coalesce(func.sum(overdue_positive), 0).label("outbal"),
            func.count()
            .filter((residual > 0) & (eff_due > func.current_date()))
            .label("pending_count"),
            func.count()
            .filter((residual > 0) & (eff_due <= func.current_date()))
            .label("overdue_count"),
        )
        .filter(
            Bill.company_code.in_(codes),
            Bill.status == BillStatus.pending,
            Bill.is_archived == False,
        )
        .group_by(Bill.company_code)
        .all()
    )
    rollups = {
        code: {
            "amount": amount_map.get(code, Decimal("0")),
            "outbal": Decimal("0"),
            "pending_count": 0,
            "overdue_count": 0,
            "next_due_date": None,
        }
        for code in codes
    }
    for r in rows:
        roll = rollups.get(r.code)
        if roll is None:
            roll = {
                "amount": amount_map.get(r.code, Decimal("0")),
                "outbal": Decimal("0"),
                "pending_count": 0,
                "overdue_count": 0,
                "next_due_date": None,
            }
            rollups[r.code] = roll
        roll["outbal"] = Decimal(str(r.outbal or 0))
        roll["pending_count"] = int(r.pending_count or 0)
        roll["overdue_count"] = int(r.overdue_count or 0)

    due_rows = (
        db.query(Bill.company_code, Bill.promise_date, Bill.bill_date, Bill.due_date)
        .filter(
            Bill.company_code.in_(codes),
            Bill.status == BillStatus.pending,
            Bill.is_archived == False,
            (Bill.amount - Bill.amount_paid) > 0,
        )
        .all()
    )
    for company_code, promise_date, bill_date, due_date in due_rows:
        eff = None
        if promise_date is not None:
            eff = promise_date
        elif bill_date is not None:
            try:
                eff = bill_date + timedelta(days=credit_days)
            except Exception:
                eff = bill_date
        else:
            eff = due_date
        if eff is None:
            continue
        curr = rollups.get(company_code)
        if curr is None:
            curr = {
                "amount": Decimal("0"),
                "outbal": Decimal("0"),
                "pending_count": 0,
                "overdue_count": 0,
                "next_due_date": eff,
            }
            rollups[company_code] = curr
        prev = curr.get("next_due_date")
        if prev is None or eff < prev:
            curr["next_due_date"] = eff
    return rollups


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
    settings_row = ensure_settings_row(db)
    credit_days = settings_row.credit_extension_days or 0
    residual = Bill.amount - Bill.amount_paid
    positive_residual = case((residual > 0, residual), else_=0)
    total_due = _get_company_amounts(db, [code]).get(code, Decimal("0"))
    overdue_sum = Decimal(
        db.query(
            func.coalesce(
                func.sum(
                    case(
                        (
                            and_(
                                (Bill.amount - Bill.amount_paid) > 0,
                                effective_due_date_expr(credit_days)
                                <= func.current_date(),
                            ),
                            Bill.amount - Bill.amount_paid,
                        ),
                        else_=0,
                    )
                ),
                0,
            )
        )
        .filter(
            Bill.company_code == code,
            Bill.status == BillStatus.pending,
            Bill.is_archived == False,
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
    s = settings_row
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
    settings_row = ensure_settings_row(db)
    credit_days = settings_row.credit_extension_days or 0
    amount_sum = _get_company_amounts(db, [code]).get(code, Decimal("0"))
    overdue_sum = Decimal(
        db.query(
            func.coalesce(
                func.sum(
                    case(
                        (
                            and_(
                                (Bill.amount - Bill.amount_paid) > 0,
                                effective_due_date_expr(credit_days)
                                <= func.current_date(),
                            ),
                            Bill.amount - Bill.amount_paid,
                        ),
                        else_=0,
                    )
                ),
                0,
            )
        )
        .filter(
            Bill.company_code == code,
            Bill.status == BillStatus.pending,
            Bill.is_archived == False,
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
