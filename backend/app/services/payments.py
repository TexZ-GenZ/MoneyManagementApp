from datetime import datetime
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
        if company.credit_date and next_promise_date < company.credit_date:
            raise ValueError("next_promise_date cannot be earlier than credit_date")
        if company.promise_date and next_promise_date < company.promise_date:
            raise ValueError("next_promise_date cannot move backward")
    # Validate allocations before creating the payment
    if amount_collected is None or amount_collected <= 0:
        raise ValueError("amount_collected must be > 0")
    # Fetch all referenced bills
    bill_ids = [a["bill_id"] for a in allocations]
    # No duplicate bill allocations per payment
    if len(bill_ids) != len(set(bill_ids)):
        raise ValueError("Duplicate bill allocations are not allowed")
    if not bill_ids:
        raise ValueError("At least one bill allocation is required")
    bills = {b.id: b for b in db.query(Bill).filter(Bill.id.in_(bill_ids)).all()}
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
    reserved_by_bill = {bid: Decimal(str(total)) for bid, total in reserved_rows}
    total_alloc = Decimal(0)
    for a in allocations:
        bid = a["bill_id"]
        amt = Decimal(str(a["amount"]))
        if amt <= 0:
            raise ValueError("Allocation amount must be > 0")
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
        if amt > effective_remaining:
            raise ValueError("Allocation exceeds bill remaining amount")
        total_alloc += amt
    amount_collected_dec = Decimal(str(amount_collected))
    if total_alloc > amount_collected_dec:
        raise ValueError("Total allocations exceed amount_collected")
    if total_alloc != amount_collected_dec:
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
        db.add(
            PaymentAllocation(payment_id=p.id, bill_id=a["bill_id"], amount=a["amount"])
        )
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
        accountant_users = (
            db.query(User)
            .filter(User.role == Role.accountant, User.is_active == True)
            .all()
        )
        if accountant_users:
            tokens = (
                db.query(PushToken)
                .filter(PushToken.user_id.in_([u.id for u in accountant_users]))
                .all()
            )
            for t in tokens:
                if not t.token.startswith("ExponentPushToken"):
                    continue
                try:
                    httpx.post(
                        "https://exp.host/--/api/v2/push/send",
                        json={
                            "to": t.token,
                            "title": "Payment Submitted",
                            "body": f"Payment {p.id} awaiting accountant approval",
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
    # update company promise date if provided
    if p.next_promise_date:
        comp = db.get(Company, p.company_code)
        # Enforce DB check constraint promise_date >= credit_date when both present
        if comp.credit_date and p.next_promise_date < comp.credit_date:
            # Clamp to credit_date to avoid IntegrityError while preserving intent
            comp.promise_date = comp.credit_date
        else:
            comp.promise_date = p.next_promise_date
        db.add(comp)
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
