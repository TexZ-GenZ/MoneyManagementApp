from datetime import datetime, date
from decimal import Decimal
from typing import List
from sqlalchemy.orm import Session
from sqlalchemy import select, update, func
from app.models.models import (
    Payment,
    PaymentAllocation,
    PaymentStatus,
    Bill,
    Company,
    BillStatus,
    Notification,
    NotificationType,
    NotificationStatus,
)
from app.services.company import recalc_company_totals
from sqlalchemy.exc import IntegrityError
import httpx
from app.models.models import Role, User, PushToken
from app.core.logging_config import get_logger
from app.services.notifications import _record_user_notification

log = get_logger(__name__)


def create_payment_with_allocations(
    db: Session,
    *,
    company_code: str,
    executive_id: int,
    collected_at: datetime,
    amount_collected: float,
    method: str,
    exec_lat: float | None,
    exec_lng: float | None,
    comments: str | None,
    next_promise_date,
    allocations: List[dict],
    idempotency_key: str | None = None,
) -> Payment:
    # Work in cents precision consistently
    from decimal import Decimal, ROUND_HALF_UP

    TWO_DP = Decimal("0.01")
    # If idempotency key provided, quick lookup to short-circuit
    if idempotency_key:
        existing = (
            db.query(Payment).filter(Payment.idempotency_key == idempotency_key).first()
        )
        if existing:
            return existing
    # Validate promise date rules
    company = db.get(Company, company_code)
    if not company:
        raise ValueError("Company not found")
    if next_promise_date:
        # Allow moving backward, but not into the past
        if next_promise_date < date.today():
            raise ValueError("next_promise_date cannot be in the past")
    # Validate allocations before creating the payment
    # Allow special case: zero-amount submission to request a promise-date change
    zero_amount_promise_change = (
        (amount_collected is not None)
        and Decimal(str(amount_collected)) == Decimal("0")
        and next_promise_date is not None
    )
    if amount_collected is None or (
        amount_collected <= 0 and not zero_amount_promise_change
    ):
        raise ValueError(
            "amount_collected must be > 0 (or 0 only for promise-date change)"
        )
    # Fetch all referenced bills
    bill_ids = [a["bill_id"] for a in allocations]
    # No duplicate bill allocations per payment
    if len(bill_ids) != len(set(bill_ids)):
        raise ValueError("Duplicate bill allocations are not allowed")
    if not bill_ids:
        raise ValueError("At least one bill allocation is required")
    bills = {b.id: b for b in db.query(Bill).filter(Bill.id.in_(bill_ids)).all()}
    # Prevent multiple concurrent promise-date change requests for the same bill
    if zero_amount_promise_change and bill_ids:
        existing_pd_change = (
            db.query(PaymentAllocation)
            .join(Payment, Payment.id == PaymentAllocation.payment_id)
            .filter(
                PaymentAllocation.bill_id.in_(bill_ids),
                Payment.status.in_(
                    [PaymentStatus.submitted, PaymentStatus.accountant_approved]
                ),
                Payment.amount_collected == 0,
                Payment.next_promise_date.isnot(None),
            )
            .first()
        )
        if existing_pd_change:
            raise ValueError("A promise-date change is already pending for this bill")
    # Reserved allocations from pending reviews (submitted or accountant_approved)
    reserved_rows = (
        db.query(
            PaymentAllocation.bill_id,
            func.coalesce(func.sum(PaymentAllocation.amount), 0),
        )
        .join(Payment, Payment.id == PaymentAllocation.payment_id)
        .filter(
            PaymentAllocation.bill_id.in_(bill_ids),
            Payment.status.in_(
                [PaymentStatus.submitted, PaymentStatus.accountant_approved]
            ),
        )
        .group_by(PaymentAllocation.bill_id)
        .all()
    )
    reserved_by_bill = {
        bid: Decimal(str(total)).quantize(TWO_DP, rounding=ROUND_HALF_UP)
        for bid, total in reserved_rows
    }
    total_alloc = Decimal(0)
    for a in allocations:
        bid = a["bill_id"]
        amt = Decimal(str(a["amount"]))
        # normalize to 2 decimal places
        try:
            amt = amt.quantize(TWO_DP, rounding=ROUND_HALF_UP)
        except Exception:
            pass
        if amt <= 0:
            # Permit zero allocation only in the special promise-date change flow
            if not (zero_amount_promise_change and amt == 0):
                raise ValueError(
                    "Allocation amount must be > 0 (0 only for promise-date change)"
                )
        b = bills.get(bid)
        if not b:
            raise ValueError(f"Bill {bid} not found")
        if b.company_code != company_code:
            raise ValueError("Allocation bill does not belong to company")
        if getattr(b, "is_archived", False):
            raise ValueError("Cannot allocate to archived bill")
        if b.status != BillStatus.pending:
            raise ValueError("Can only allocate to pending bills")
        already_reserved = reserved_by_bill.get(bid, Decimal(0))
        effective_remaining = (
            Decimal(b.amount) - Decimal(b.amount_paid) - already_reserved
        )
        # Compare with cents precision
        try:
            effective_remaining = effective_remaining.quantize(
                TWO_DP, rounding=ROUND_HALF_UP
            )
        except Exception:
            pass
        if amt > effective_remaining:
            raise ValueError("Allocation exceeds bill remaining amount")
        # Allow backward updates; no per-bill forward-only restriction
        total_alloc += amt
    # For promise-date change, enforce exactly one allocation with 0 matching amount_collected
    if zero_amount_promise_change:
        if len(allocations) != 1:
            raise ValueError("Promise-date change must reference exactly one bill")
    # Normalize totals to 2dp for a robust equality comparison
    try:
        total_alloc = total_alloc.quantize(TWO_DP, rounding=ROUND_HALF_UP)
    except Exception:
        pass
    amount_collected_dec = Decimal(str(amount_collected))
    try:
        amount_collected_dec = amount_collected_dec.quantize(
            TWO_DP, rounding=ROUND_HALF_UP
        )
    except Exception:
        pass
    if total_alloc > amount_collected_dec:
        raise ValueError("Total allocations exceed amount_collected")
    if total_alloc != amount_collected_dec:
        # Allow equality check to pass for zero-amount flows (already ensured above)
        raise ValueError("Allocation total must equal amount_collected")
    # Geo coordinate validation
    if exec_lat is not None:
        if exec_lat < -90 or exec_lat > 90:
            raise ValueError("exec_lat out of range (-90..90)")
    if exec_lng is not None:
        if exec_lng < -180 or exec_lng > 180:
            raise ValueError("exec_lng out of range (-180..180)")

    p = Payment(
        company_code=company_code,
        executive_id=executive_id,
        collected_at=collected_at,
        amount_collected=amount_collected,
        method=method,
        exec_lat=exec_lat,
        exec_lng=exec_lng,
        comments=comments,
        next_promise_date=next_promise_date,
        idempotency_key=idempotency_key,
    )
    try:
        db.add(p)
        db.flush()
    except IntegrityError:
        # Duplicate idempotency key detected before allocations (race).
        db.rollback()
        if idempotency_key:
            existing_after = (
                db.query(Payment)
                .filter(Payment.idempotency_key == idempotency_key)
                .first()
            )
            if existing_after:
                return existing_after
        raise
    for a in allocations:
        # persist normalized amount
        amt = Decimal(str(a["amount"]))
        try:
            amt = amt.quantize(TWO_DP, rounding=ROUND_HALF_UP)
        except Exception:
            pass
        db.add(PaymentAllocation(payment_id=p.id, bill_id=a["bill_id"], amount=amt))
    # Create a notification for accountant review
    # Guarantee at most one pending review notification: lock existing pending rows and reuse or stop extras
    pending_reviews = (
        db.query(Notification)
        .with_for_update()
        .filter(
            Notification.company_code == company_code,
            Notification.type == NotificationType.payment_review,
            Notification.status == NotificationStatus.pending,
        )
        .all()
    )
    if not pending_reviews:
        db.add(
            Notification(
                company_code=company_code,
                type=NotificationType.payment_review,
                status=NotificationStatus.pending,
                message=f"Payment pending review for company {company_code}",
                last_sent_at=None,
                next_send_at=None,
            )
        )
        try:
            log.info(
                "Created payment_review DB notification company=%s message=%s",
                company_code,
                f"Payment pending review for company {company_code}",
            )
        except Exception:
            pass
    elif len(pending_reviews) > 1:
        # Collapse duplicates deterministically: keep the earliest created, mark others stopped
        pending_reviews.sort(key=lambda n: n.created_at)
        for dup in pending_reviews[1:]:
            dup.status = NotificationStatus.stopped
            db.add(dup)
    try:
        db.commit()
    except IntegrityError as e:
        # Possible concurrent insert with same idempotency key race:
        # another transaction inserted the payment after our initial existence check.
        # Rollback and return the existing payment to honor idempotency contract.
        db.rollback()
        if idempotency_key:
            existing_after = (
                db.query(Payment)
                .filter(Payment.idempotency_key == idempotency_key)
                .first()
            )
            if existing_after:
                return existing_after
        # Re-raise if not an idempotency collision scenario
        raise
    db.refresh(p)
    # Immediate push notification to accountants for new submitted payment
    try:
        # If this is a promise-date change created by an accountant, skip accountant-stage push
        skip_push = False
        try:
            if (
                Decimal(str(p.amount_collected)) == Decimal("0")
                and getattr(p, "next_promise_date", None) is not None
            ):
                actor = db.query(User).filter(User.id == p.executive_id).one_or_none()
                if actor and actor.role == Role.accountant:
                    skip_push = True
        except Exception:
            pass
        if skip_push:
            return p
        accountant_users = (
            db.query(User)
            .filter(User.role == Role.accountant, User.is_active == True)
            .all()
        )
        if accountant_users:
            # Compose message once
            def _fmt_amount(x):
                try:
                    return f"{float(x):,.2f}"
                except Exception:
                    return str(x)

            comp = db.get(Company, p.company_code)
            comp_part = p.company_code + (
                f" ({comp.name})" if comp and getattr(comp, "name", None) else ""
            )
            if Decimal(str(p.amount_collected)) == Decimal("0") and p.next_promise_date:
                # Try to add from->to context
                from_str = None
                try:
                    alloc = (
                        db.query(PaymentAllocation)
                        .filter(PaymentAllocation.payment_id == p.id)
                        .first()
                    )
                    if alloc:
                        b = db.query(Bill).filter(Bill.id == alloc.bill_id).one_or_none()
                        if b:
                            old = getattr(b, "promise_date", None) or getattr(b, "due_date", None)
                            from_str = old.isoformat() if hasattr(old, 'isoformat') else (str(old) if old else None)
                except Exception:
                    pass
                to_str = p.next_promise_date.isoformat()
                body = (
                    f"#{p.id} • {comp_part} • Promise date change "
                    f"{('from ' + from_str + ' ' if from_str else '')}to {to_str} • Awaiting accountant approval"
                )
                title = "Promise Date Change Requested"
            else:
                body = (
                    f"#{p.id} • {comp_part} • INR {_fmt_amount(p.amount_collected)} via {p.method} • "
                    f"Collected {p.collected_at.date().isoformat()} • Awaiting accountant approval"
                )
                title = "Payment Submitted"
            tokens = (
                db.query(PushToken)
                .filter(PushToken.user_id.in_([u.id for u in accountant_users]))
                .all()
            )
            # Record delivered for each accountant user
            for u in accountant_users:
                try:
                    _record_user_notification(
                        db,
                        u.id,
                        title,
                        body,
                        {"payment_id": p.id, "stage": "accountant"},
                    )
                except Exception:
                    pass
            for t in tokens:
                if not t.token.startswith("ExponentPushToken"):
                    continue
                try:
                    try:
                        log.info(
                            "Sending accountant push payment_id=%s body=%s",
                            p.id,
                            body,
                        )
                    except Exception:
                        pass
                    httpx.post(
                        "https://exp.host/--/api/v2/push/send",
                        json={
                            "to": t.token,
                            "title": title,
                            "body": body,
                            "data": {"payment_id": p.id, "stage": "accountant"},
                        },
                        timeout=8,
                    )
                except Exception:
                    continue
    except Exception:
        pass
    return p


def admin_approve_payment(db: Session, payment_id: int) -> Payment:
    # Lock payment row and ensure status transition is valid (optimistic concurrency)
    p = (
        db.query(Payment)
        .with_for_update()
        .filter(Payment.id == payment_id)
        .one_or_none()
    )
    if not p:
        raise ValueError("Payment not found")
    if p.status != PaymentStatus.accountant_approved:
        raise ValueError("Invalid state for admin approval")
    # allocate amounts
    allocs = (
        db.query(PaymentAllocation).filter(PaymentAllocation.payment_id == p.id).all()
    )
    for a in allocs:
        b = db.query(Bill).with_for_update().filter(Bill.id == a.bill_id).one_or_none()
        if not b:
            continue
        remaining = Decimal(b.amount) - Decimal(b.amount_paid)
        pay = Decimal(a.amount)
        to_apply = min(remaining, pay)
        b.amount_paid = Decimal(b.amount_paid) + to_apply
        if b.amount_paid >= b.amount:
            b.status = BillStatus.paid
        db.add(b)
    # update per-bill promise date if provided (do not set company-wide)
    if p.next_promise_date:
        # Apply the provided next_promise_date to allocated bills (not earlier than today)
        target_date = p.next_promise_date
        if target_date < date.today():
            target_date = date.today()
        # Apply to all allocated bills in this payment
        for a in allocs:
            b = (
                db.query(Bill)
                .with_for_update()
                .filter(Bill.id == a.bill_id)
                .one_or_none()
            )
            if not b:
                continue
            b.promise_date = target_date
            try:
                from app.models.models import Company as CompanyModel  # reuse enum

                b.promise_date_source = CompanyModel.PromiseSource.exec
            except Exception:
                pass
            db.add(b)
    p.status = PaymentStatus.admin_approved
    p.admin_review_at = datetime.utcnow()
    db.add(p)
    # Mark any pending notifications for this company as stopped
    db.query(Notification).filter(
        Notification.company_code == p.company_code,
        Notification.type == NotificationType.payment_review,
        Notification.status == NotificationStatus.pending,
    ).update(
        {Notification.status: NotificationStatus.stopped}, synchronize_session=False
    )
    db.commit()
    recalc_company_totals(db, p.company_code)
    db.refresh(p)
    return p


def reconcile_bill_promises(db: Session) -> int:
    """Rebuild per-bill promise_date from admin-approved payments/allocations.
    For each bill, set promise_date to the latest applicable next_promise_date among
    admin-approved payments that allocated to it (clamped to company's credit_date when earlier).
    Returns number of bills updated.
    """
    # Fetch all bills with their company for credit_date clamp
    bills = (
        db.query(Bill, Company).join(Company, Company.code == Bill.company_code).all()
    )
    updated = 0
    for b, c in bills:
        # Get latest next_promise_date from approved payments that allocated to this bill
        latest = (
            db.query(func.max(Payment.next_promise_date))
            .join(PaymentAllocation, PaymentAllocation.payment_id == Payment.id)
            .filter(
                PaymentAllocation.bill_id == b.id,
                Payment.status == PaymentStatus.admin_approved,
                Payment.next_promise_date.isnot(None),
            )
            .scalar()
        )
        target = latest
        if target and c and c.credit_date and target < c.credit_date:
            target = c.credit_date
        # Only update if changed
        if getattr(b, "promise_date", None) != target:
            b.promise_date = target
            try:
                from app.models.models import Company as CompanyModel  # reuse enum

                b.promise_date_source = (
                    CompanyModel.PromiseSource.exec if target else None
                )
            except Exception:
                pass
            db.add(b)
            updated += 1
    db.commit()
    return updated
