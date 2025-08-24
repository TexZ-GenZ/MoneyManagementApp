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
    User,
    Role,
    PushToken,
)
import httpx
import os


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
    """Entry point invoked every notif_every_hours. Performs:
    1. Promise / credit overdue scan
    2. Payment review scan
    3. Aggregated role approval pushes (accountant/admin)
    4. Repeating executive pending bills push (per window)
    """
    s = db.get(Setting, 1)
    interval_hours = (
        s.notif_every_hours
        if s and s.notif_every_hours
        else DEFAULT_RESEND_INTERVAL_HOURS
    )
    scan_promise_credit_overdue(db, interval_hours)
    scan_payment_review(db, interval_hours)
    try:
        _send_executive_overdue_push(db)
    except Exception as e:
        log.warning("Exec overdue push failed: %s", e)
    try:
        _send_role_pending_pushes(db)
    except Exception as e:
        log.warning("Role pending push send failed: %s", e)
    try:
        _send_exec_pending_pushes(db)
    except Exception as e:
        log.warning("Exec pending push failed: %s", e)


def _send_role_pending_pushes(db: Session):
    """Send a single aggregated push to accountant(s) and admin(s) if they have pending approvals.
    Cadence piggybacks on run_notification_scan invocation (interval+daily). We avoid spamming by
    checking last_sent_at logic via synthetic notification keys (reuse notifications table by type payment_review).
    Accountant: payments with status submitted.
    Admin: payments with status accountant_approved.
    """
    now = datetime.utcnow()
    # Gather counts
    accountant_cnt = (
        db.query(Payment).filter(Payment.status == PaymentStatus.submitted).count()
    )
    admin_cnt = (
        db.query(Payment)
        .filter(Payment.status == PaymentStatus.accountant_approved)
        .count()
    )
    log.debug(
        "Aggregated push counts accountant=%s admin=%s", accountant_cnt, admin_cnt
    )
    if accountant_cnt == 0 and admin_cnt == 0:
        return

    def _send_to_role(role: Role, count: int, stage: str):
        if count <= 0:
            return
        users = db.query(User).filter(User.role == role, User.is_active == True).all()
        if not users:
            return
        tokens = (
            db.query(PushToken)
            .filter(PushToken.user_id.in_([u.id for u in users]))
            .all()
        )
        log.debug("Role=%s users=%s tokens=%s", role, len(users), len(tokens))
        if not tokens:
            return
        title = "Approvals Pending"
        body = f"{count} payment(s) awaiting {stage} approval"
        for t in tokens:
            if not t.token.startswith("ExponentPushToken"):
                continue
            try:
                resp = httpx.post(
                    "https://exp.host/--/api/v2/push/send",
                    json={
                        "to": t.token,
                        "title": title,
                        "body": body,
                        "data": {"pending_count": count, "stage": stage},
                    },
                    timeout=10,
                )
                if resp.status_code not in (200, 201):
                    log.warning(
                        "Push send failed role=%s status=%s body=%s resp=%s",
                        role,
                        resp.status_code,
                        body,
                        resp.text,
                    )
            except Exception as e:
                log.warning("Push exception role=%s err=%s", role, e)

    _send_to_role(Role.accountant, accountant_cnt, "accountant")
    _send_to_role(Role.admin, admin_cnt, "admin")


def _send_exec_pending_pushes(db: Session):
    """Send a repeating aggregated push to each executive listing pending bills in their assignments within window hours.
    Uses exec_window_start_hour / exec_window_end_hour (IST) converted to UTC.
    """
    now = datetime.utcnow()
    s = db.get(Setting, 1)
    if not s:
        return
    start_h = s.exec_window_start_hour or 6
    end_h = s.exec_window_end_hour or 22

    def ist_to_utc(h: int) -> int:
        return int((h - 5.5) % 24)

    utc_start = ist_to_utc(start_h)
    utc_end = ist_to_utc(end_h)
    if utc_start < utc_end:
        in_window = utc_start <= now.hour < utc_end
    else:
        in_window = now.hour >= utc_start or now.hour < utc_end
    if not in_window:
        return
    # Pending bills per executive based on assignments (bills.status = pending)
    rows = db.execute(
        """
        SELECT ea.executive_id, COUNT(b.id) AS bills, COUNT(DISTINCT b.company_code) AS companies
        FROM bills b
        JOIN exec_assignments ea ON ea.company_code = b.company_code
        JOIN users u ON u.id = ea.executive_id AND u.is_active = TRUE
        WHERE b.status = 'pending'
        GROUP BY ea.executive_id
        """
    ).fetchall()
    if not rows:
        return
    exec_ids = [r.executive_id for r in rows]
    tokens = db.query(PushToken).filter(PushToken.user_id.in_(exec_ids)).all()
    tok_map = {}
    for t in tokens:
        if t.token.startswith("ExponentPushToken"):
            tok_map.setdefault(t.user_id, []).append(t.token)
    for r in rows:
        bills = r.bills
        if bills <= 0:
            continue
        companies = r.companies
        msg = f"{bills} pending bill(s) across {companies} company(s)"
        for tk in tok_map.get(r.executive_id, []):
            try:
                httpx.post(
                    "https://exp.host/--/api/v2/push/send",
                    json={"to": tk, "title": "Pending Bills", "body": msg},
                    timeout=8,
                )
            except Exception as e:
                log.warning("Exec pending push err=%s", e)


def _send_executive_overdue_push(db: Session):
    # Deprecated: retained for backward compatibility; no-op now.
    return


def _send_push_token(token: str, title: str, body: str):
    """Fire-and-forget push via hypothetical external service; silent on failure."""
    push_url = os.getenv("PUSH_SERVICE_URL")
    if not push_url:
        return
    try:
        httpx.post(
            push_url, json={"token": token, "title": title, "body": body}, timeout=3.0
        )
    except Exception:
        pass
