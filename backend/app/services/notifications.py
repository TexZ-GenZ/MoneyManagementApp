from datetime import date, datetime, timedelta
from sqlalchemy.orm import Session
from app.models.models import (
    Company,
    Notification,
    NotificationType,
    NotificationStatus,
    Payment,
    PaymentStatus,
    Setting,
)


def ensure_setting(db: Session) -> Setting:
    """
    Ensure a settings row exists in the DB, creating with defaults if missing.
    """
    s = db.get(Setting, 1)
    if not s:
        s = Setting(id=1)
        db.add(s)
        db.commit()
        db.refresh(s)
    return s


from app.core.logging_config import get_logger

DEFAULT_RESEND_INTERVAL_HOURS = 6  # fallback only if settings missing
log = get_logger(__name__)


def _should_resend(n: Notification, now: datetime, interval_hours: int) -> bool:
    """
    Determine if a notification should be resent based on status and cadence.
    """
    if n.status != NotificationStatus.pending:
        return False
    if n.next_send_at and now >= n.next_send_at:
        return True
    if not n.next_send_at and (
        not n.last_sent_at or (now - n.last_sent_at) >= timedelta(hours=interval_hours)
    ):
        return True
    return False


def scan_promise_credit_overdue(db: Session, interval_hours: int | None = None):
    # Backward compatibility: allow legacy direct test calls without interval
    if interval_hours is None:
        s = db.get(Setting, 1)
        interval_hours = (
            s.notif_every_hours
            if s and s.notif_every_hours
            else DEFAULT_RESEND_INTERVAL_HOURS
        )
    """
    Scan all companies for overdue promise/credit dates and create/suppress notifications.
    """
    today = date.today()
    now = datetime.utcnow()
    companies = db.query(Company).filter(Company.is_archived == False).all()
    for c in companies:
        overdue = False
        if c.credit_date and c.credit_date < today:
            overdue = True
        if c.promise_date and c.promise_date < today:
            overdue = True
        existing = (
            db.query(Notification)
            .filter(
                Notification.company_code == c.code,
                Notification.type == NotificationType.promise_crossed,
                Notification.status == NotificationStatus.pending,
            )
            .first()
        )
        if overdue:
            if not existing:
                msg = f"Promise/Credit date crossed for company {c.code}"
                db.add(
                    Notification(
                        company_code=c.code,
                        type=NotificationType.promise_crossed,
                        status=NotificationStatus.pending,
                        message=msg,
                        last_sent_at=None,
                        next_send_at=now,
                    )
                )
                log.info("Created promise_crossed notification company=%s", c.code)
            else:
                # schedule resend if due
                if _should_resend(existing, now, interval_hours):
                    existing.last_sent_at = now
                    existing.next_send_at = now + timedelta(hours=interval_hours)
                    log.info("Resent promise_crossed notification company=%s", c.code)
        else:
            if existing:
                existing.status = NotificationStatus.stopped
                existing.message = "Resolved: dates moved forward"
    db.commit()


def scan_payment_review(db: Session, interval_hours: int | None = None):
    if interval_hours is None:
        s = db.get(Setting, 1)
        interval_hours = (
            s.notif_every_hours
            if s and s.notif_every_hours
            else DEFAULT_RESEND_INTERVAL_HOURS
        )
    """
    Scan all payments for pending review and create/suppress notifications.
    """
    now = datetime.utcnow()
    payments = db.query(Payment).filter(
        Payment.status.in_([PaymentStatus.submitted, PaymentStatus.accountant_approved])
    )
    for p in payments:
        existing = (
            db.query(Notification)
            .filter(
                Notification.payment_id == p.id,
                Notification.type == NotificationType.payment_review,
                Notification.status == NotificationStatus.pending,
            )
            .first()
        )
        if not existing:
            # Stage-specific messaging to clarify workflow step
            if p.status == PaymentStatus.submitted:
                msg = f"Payment {p.id} pending accountant approval"
            elif p.status == PaymentStatus.accountant_approved:
                msg = f"Payment {p.id} pending admin approval"
            else:
                msg = f"Payment {p.id} pending review"
            db.add(
                Notification(
                    company_code=p.company_code,
                    payment_id=p.id,
                    type=NotificationType.payment_review,
                    status=NotificationStatus.pending,
                    message=msg,
                    last_sent_at=None,
                    next_send_at=now,
                )
            )
            log.info("Created payment_review notification payment=%s", p.id)
        else:
            # If payment advanced from accountant to admin stage, update message
            if (
                p.status == PaymentStatus.accountant_approved
                and "admin approval" not in existing.message
            ):
                existing.message = f"Payment {p.id} pending admin approval"
            if _should_resend(existing, now, interval_hours):
                existing.last_sent_at = now
                existing.next_send_at = now + timedelta(hours=interval_hours)
                log.info("Resent payment_review notification payment=%s", p.id)
    if payments.count() == 0:
        db.query(Notification).filter(
            Notification.type == NotificationType.payment_review,
            Notification.status == NotificationStatus.pending,
        ).update(
            {Notification.status: NotificationStatus.stopped}, synchronize_session=False
        )
    db.commit()


def run_notification_scan(db: Session):
    """
    Run all notification scans (promise/credit overdue, payment review).
    """
    # Determine interval from settings (notif_every_hours) with fallback
    s = db.get(Setting, 1)
    interval_hours = (
        s.notif_every_hours
        if s and s.notif_every_hours
        else DEFAULT_RESEND_INTERVAL_HOURS
    )
    scan_promise_credit_overdue(db, interval_hours)
    scan_payment_review(db, interval_hours)
