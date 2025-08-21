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
    s = db.get(Setting, 1)
    if not s:
        s = Setting(id=1)
        db.add(s)
        db.commit()
        db.refresh(s)
    return s


from app.core.logging_config import get_logger

RESEND_INTERVAL_HOURS = 6  # default cadence if next_send_at not set
log = get_logger(__name__)


def _should_resend(n: Notification, now: datetime) -> bool:
    if n.status != NotificationStatus.pending:
        return False
    if n.next_send_at and now >= n.next_send_at:
        return True
    if not n.next_send_at and (not n.last_sent_at or (now - n.last_sent_at) >= timedelta(hours=RESEND_INTERVAL_HOURS)):
        return True
    return False


def scan_promise_credit_overdue(db: Session):
    today = date.today()
    now = datetime.utcnow()
    companies = db.query(Company).filter(Company.is_archived == False).all()
    for c in companies:
        overdue = False
        if c.credit_date and c.credit_date < today:
            overdue = True
        if c.promise_date and c.promise_date < today:
            overdue = True
        existing = db.query(Notification).filter(
            Notification.company_code == c.code,
            Notification.type == NotificationType.promise_crossed,
            Notification.status == NotificationStatus.pending,
        ).first()
        if overdue:
            if not existing:
                msg = f"Promise/Credit date crossed for company {c.code}"
                db.add(Notification(
                    company_code=c.code,
                    type=NotificationType.promise_crossed,
                    status=NotificationStatus.pending,
                    message=msg,
                    last_sent_at=None,
                    next_send_at=now,
                ))
                log.info("Created promise_crossed notification company=%s", c.code)
            else:
                # schedule resend if due
                if _should_resend(existing, now):
                    existing.last_sent_at = now
                    existing.next_send_at = now + timedelta(hours=RESEND_INTERVAL_HOURS)
                    log.info("Resent promise_crossed notification company=%s", c.code)
        else:
            if existing:
                existing.status = NotificationStatus.stopped
                existing.message = "Resolved: dates moved forward"
    db.commit()


def scan_payment_review(db: Session):
    now = datetime.utcnow()
    payments = db.query(Payment).filter(
        Payment.status.in_([PaymentStatus.submitted, PaymentStatus.accountant_approved])
    )
    for p in payments:
        existing = db.query(Notification).filter(
            Notification.payment_id == p.id,
            Notification.type == NotificationType.payment_review,
            Notification.status == NotificationStatus.pending,
        ).first()
        if not existing:
            msg = f"Payment {p.id} pending review ({p.status})"
            db.add(Notification(
                company_code=p.company_code,
                payment_id=p.id,
                type=NotificationType.payment_review,
                status=NotificationStatus.pending,
                message=msg,
                last_sent_at=None,
                next_send_at=now,
            ))
            log.info("Created payment_review notification payment=%s", p.id)
        else:
            if _should_resend(existing, now):
                existing.last_sent_at = now
                existing.next_send_at = now + timedelta(hours=RESEND_INTERVAL_HOURS)
                log.info("Resent payment_review notification payment=%s", p.id)
    if payments.count() == 0:
        db.query(Notification).filter(
            Notification.type == NotificationType.payment_review,
            Notification.status == NotificationStatus.pending,
        ).update({Notification.status: NotificationStatus.stopped}, synchronize_session=False)
    db.commit()


def run_notification_scan(db: Session):
    scan_promise_credit_overdue(db)
    scan_payment_review(db)
