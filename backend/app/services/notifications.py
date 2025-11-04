from datetime import date, datetime, timedelta
from sqlalchemy.orm import Session
from app.models.models import (
    Company,
    Bill,
    ExecAssignment,
    Notification,
    NotificationType,
    NotificationStatus,
    Payment,
    PaymentStatus,
    Setting,
    User,
    Role,
    PushToken,
    UserNotification,
)
import httpx
import os
import json


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


def compute_unread_badge(db: Session, user_id: int, since_hours: int = 24) -> int:
    """Return count of unacknowledged delivered notifications for user within since_hours window."""
    try:
        since = datetime.utcnow() - timedelta(hours=since_hours)
        return (
            db.query(UserNotification)
            .filter(
                UserNotification.user_id == user_id,
                UserNotification.acknowledged == False,
                UserNotification.created_at >= since,
            )
            .count()
        )
    except Exception:
        return 0


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
        if c.credit_date and c.credit_date <= today:
            overdue = True
        if c.promise_date and c.promise_date <= today:
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
                log.info(
                    "Created promise_crossed notification company=%s message=%s",
                    c.code,
                    msg,
                )
            else:
                # schedule resend if due
                if _should_resend(existing, now, interval_hours):
                    existing.last_sent_at = now
                    existing.next_send_at = now + timedelta(hours=interval_hours)
                    log.info(
                        "Resent promise_crossed notification company=%s message=%s",
                        c.code,
                        existing.message,
                    )
        else:
            if existing:
                existing.status = NotificationStatus.stopped
                existing.message = "Resolved: dates moved forward"
                log.info(
                    "Stopped promise_crossed notification company=%s message=%s",
                    c.code,
                    existing.message,
                )
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
            # Stage-specific messaging with richer details
            msg = build_payment_review_message(db, p)
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
            log.info(
                "Created payment_review notification payment=%s message=%s",
                p.id,
                msg,
            )
        else:
            # Update message as payment advances, keep details consistent
            existing.message = build_payment_review_message(db, p)
            log.info(
                "Updated payment_review notification payment=%s message=%s",
                p.id,
                existing.message,
            )
            if _should_resend(existing, now, interval_hours):
                existing.last_sent_at = now
                existing.next_send_at = now + timedelta(hours=interval_hours)
                log.info(
                    "Resent payment_review notification payment=%s message=%s",
                    p.id,
                    existing.message,
                )
    if payments.count() == 0:
        db.query(Notification).filter(
            Notification.type == NotificationType.payment_review,
            Notification.status == NotificationStatus.pending,
        ).update(
            {Notification.status: NotificationStatus.stopped}, synchronize_session=False
        )
    db.commit()


def build_payment_review_message(db: Session, p: Payment) -> str:
    """Compose a concise, detailed message for a payment awaiting review/approval.
    Example: "#123 • CTOT (Acme Co) • INR 12,345.67 via UPI • Collected 2025-08-25 • Awaiting admin approval"
    """
    comp: Company | None = db.get(Company, p.company_code)
    company_part = f"{p.company_code}"
    if comp and getattr(comp, "name", None):
        company_part += f" ({comp.name})"
    is_promise_change = (
        getattr(p, "amount_collected", None) is not None
        and float(getattr(p, "amount_collected", 0)) == 0.0
        and getattr(p, "next_promise_date", None) is not None
    )
    if is_promise_change:
        amt_part = "Promise date change"
        method_part = f"to {p.next_promise_date.isoformat()}"
        date_part = ""
    else:
        try:
            amt = f"{float(p.amount_collected):,.2f}"
        except Exception:
            amt = str(p.amount_collected)
        amt_part = f"INR {amt}"
        method_part = f"via {p.method}" if p.method else ""
        date_part = (
            p.collected_at.date().isoformat()
            if getattr(p, "collected_at", None)
            else ""
        )
    stage = (
        "accountant"
        if p.status == PaymentStatus.submitted
        else ("admin" if p.status == PaymentStatus.accountant_approved else "review")
    )
    parts = [
        f"#{p.id}",
        company_part,
        f"{amt_part} {method_part}".strip(),
        (f"Collected {date_part}" if date_part else None),
        (
            f"Awaiting {stage} approval"
            if stage in ("accountant", "admin")
            else "Pending review"
        ),
    ]
    return " • ".join([x for x in parts if x])


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


def _record_user_notification(
    db: Session, user_id: int, title: str, body: str, data: dict | None = None
):
    """Persist a delivered push payload for a specific user (verbatim for in-app history)."""
    try:
        rec = UserNotification(
            user_id=user_id,
            title=title,
            body=body,
            data_json=(json.dumps(data) if data else None),
        )
        db.add(rec)
        db.commit()
    except Exception as e:
        try:
            db.rollback()
        except Exception:
            pass
        log.warning("Failed to record user notification user_id=%s err=%s", user_id, e)


def _send_role_pending_pushes(db: Session):
    """Send a single aggregated push to accountant(s) and admin(s) if they have pending approvals.
    Cadence piggybacks on run_notification_scan invocation (interval+daily). We avoid spamming by
    checking last_sent_at logic via synthetic notification keys (reuse notifications table by type payment_review).
    Accountant: payments with status submitted.
    Admin: payments with status accountant_approved.
    """
    now = datetime.utcnow()
    s = db.get(Setting, 1)
    interval_hours = (
        s.notif_every_hours
        if s and s.notif_every_hours
        else DEFAULT_RESEND_INTERVAL_HOURS
    )

    # Gather counts
    accountant_cnt = (
        db.query(Payment).filter(Payment.status == PaymentStatus.submitted).count()
    )
    admin_cnt = (
        db.query(Payment)
        .filter(
            Payment.status.in_(
                [PaymentStatus.accountant_approved, PaymentStatus.submitted]
            )
        )
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

        title = (
            "Needs Accountant Approval"
            if stage == "accountant"
            else "Needs Admin Approval"
        )
        noun = "payment" if count == 1 else "payments"
        body = f"{count} {noun} awaiting {stage} approval\nTap to review."

        # Per-user dedupe based on delivered history within interval window
        cutoff = now - timedelta(hours=interval_hours)
        user_ids = [u.id for u in users]
        recent = (
            db.query(UserNotification.user_id)
            .filter(
                UserNotification.user_id.in_(user_ids),
                UserNotification.created_at >= cutoff,
                UserNotification.title == title,
            )
            .all()
        )
        recently_sent = {uid for (uid,) in recent}

        # Record and push only to users not recently notified
        for u in users:
            if u.id in recently_sent:
                continue
            _record_user_notification(
                db,
                u.id,
                title,
                body,
                {"pending_count": count, "stage": stage, "screen": "Approvals"},
            )
        for t in tokens:
            if t.user_id in recently_sent:
                continue
            if not isinstance(t.token, str) or not t.token.startswith(
                "ExponentPushToken"
            ):
                continue
            try:
                resp = httpx.post(
                    "https://exp.host/--/api/v2/push/send",
                    json={
                        "to": t.token,
                        "title": title,
                        "body": body,
                        "data": {
                            "pending_count": count,
                            "stage": stage,
                            "screen": "Approvals",
                        },
                        "priority": "high",
                        "sound": "default",
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
    interval_hours = (
        s.notif_every_hours if s.notif_every_hours else DEFAULT_RESEND_INTERVAL_HOURS
    )

    def ist_to_utc(h: int) -> int:
        return int((h - 5.5) % 24)

    utc_start = ist_to_utc(start_h)
    utc_end = ist_to_utc(end_h)
    if utc_start < utc_end:
        in_window = utc_start <= now.hour <= utc_end
    else:
        in_window = now.hour >= utc_start or now.hour <= utc_end
    if not in_window:
        return
    # Pending bills per executive based on assignments (bills.status = pending)
    from sqlalchemy import text as _text

    rows = db.execute(
        _text(
            """
            SELECT ea.executive_id, COUNT(b.id) AS bills, COUNT(DISTINCT b.company_code) AS companies
            FROM bills b
            JOIN exec_assignments ea ON ea.company_code = b.company_code
            JOIN users u ON u.id = ea.executive_id AND u.is_active = TRUE
            WHERE b.status = 'pending'
            GROUP BY ea.executive_id
            """
        )
    ).fetchall()
    if not rows:
        return
    exec_ids = [r.executive_id for r in rows]
    tokens = db.query(PushToken).filter(PushToken.user_id.in_(exec_ids)).all()
    tok_map = {}
    for t in tokens:
        if t.token.startswith("ExponentPushToken"):
            tok_map.setdefault(t.user_id, []).append(t.token)
    # Build per-user recent map to avoid duplicates within interval
    cutoff = now - timedelta(hours=interval_hours)
    exec_ids = [r.executive_id for r in rows]
    recent_rows = (
        db.query(UserNotification.user_id)
        .filter(
            UserNotification.user_id.in_(exec_ids),
            UserNotification.created_at >= cutoff,
            UserNotification.title == "Pending Bills",
        )
        .all()
    )
    recently_sent = {uid for (uid,) in recent_rows}

    for r in rows:
        bills = r.bills
        if bills <= 0:
            continue
        companies = r.companies
        bill_noun = "bill" if bills == 1 else "bills"
        comp_noun = "company" if companies == 1 else "companies"
        msg = (
            f"{bills} pending {bill_noun} across {companies} {comp_noun}\nTap to view."
        )

        # Skip if we've sent recently to this exec
        if r.executive_id in recently_sent:
            continue

        # Record once per exec user
        _record_user_notification(
            db,
            r.executive_id,
            "Pending Bills",
            msg,
            {"stage": "exec_pending_bills", "screen": "BillsList"},
        )
        for tk in tok_map.get(r.executive_id, []):
            try:
                httpx.post(
                    "https://exp.host/--/api/v2/push/send",
                    json={
                        "to": tk,
                        "title": "Pending Bills",
                        "body": msg,
                        "data": {"stage": "exec_pending_bills", "screen": "BillsList"},
                        "priority": "high",
                        "sound": "default",
                    },
                    timeout=8,
                )
            except Exception as e:
                log.warning("Exec pending push err=%s", e)


def _send_executive_overdue_push(db: Session):
    """Send an aggregated push to each executive summarizing overdue companies (based on pending bills with effective due <= today).
    Respects exec window hours (IST), same as other exec pushes. Runs at notification frequency.
    """
    s = db.get(Setting, 1)
    if not s:
        return
    # Window check (IST -> UTC)
    start_h = s.exec_window_start_hour or 6
    end_h = s.exec_window_end_hour or 22
    interval_hours = (
        s.notif_every_hours if s.notif_every_hours else DEFAULT_RESEND_INTERVAL_HOURS
    )

    def ist_to_utc(h: int) -> int:
        return int((h - 5.5) % 24)

    now = datetime.utcnow()
    utc_start = ist_to_utc(start_h)
    utc_end = ist_to_utc(end_h)
    if utc_start < utc_end:
        in_window = utc_start <= now.hour <= utc_end
    else:
        in_window = now.hour >= utc_start or now.hour <= utc_end
    if not in_window:
        return

    credit_days = s.credit_extension_days or 0
    today = date.today()

    # Fetch pending bills joined to exec assignments and active users
    rows = (
        db.query(
            ExecAssignment.executive_id,
            Bill.company_code,
            Bill.promise_date,
            Bill.bill_date,
            Bill.due_date,
        )
        .join(Bill, Bill.company_code == ExecAssignment.company_code)
        .join(User, User.id == ExecAssignment.executive_id)
        .filter(
            User.is_active == True,
            Bill.status == "pending",
            getattr(Bill, "is_archived", False) == False,
        )
        .all()
    )
    if not rows:
        return

    # Compute overdue companies per executive (distinct by company)
    exec_overdue_companies: dict[int, set[str]] = {}
    for exec_id, company_code, promise_date, bill_date, due_date in rows:
        eff_due = None
        if promise_date is not None:
            eff_due = promise_date
        elif bill_date is not None:
            try:
                eff_due = bill_date + timedelta(days=credit_days)
            except Exception:
                eff_due = bill_date
        else:
            eff_due = due_date
        if eff_due is None:
            continue
        if eff_due <= today:
            sset = exec_overdue_companies.setdefault(exec_id, set())
            sset.add(company_code)

    if not exec_overdue_companies:
        return

    # Tokens per executive
    exec_ids = list(exec_overdue_companies.keys())
    tokens = db.query(PushToken).filter(PushToken.user_id.in_(exec_ids)).all()
    tok_map: dict[int, list[str]] = {}
    for t in tokens:
        if t.token.startswith("ExponentPushToken"):
            tok_map.setdefault(t.user_id, []).append(t.token)

    # Build recent map to avoid duplicates within interval
    cutoff = now - timedelta(hours=interval_hours)
    recent_rows = (
        db.query(UserNotification.user_id)
        .filter(
            UserNotification.user_id.in_(exec_ids),
            UserNotification.created_at >= cutoff,
            UserNotification.title == "Overdue Companies",
        )
        .all()
    )
    recently_sent = {uid for (uid,) in recent_rows}

    # Send pushes
    for exec_id, companies in exec_overdue_companies.items():
        count = len(companies)
        if count <= 0:
            continue
        title = "Overdue Companies"
        comp_noun2 = "company" if count == 1 else "companies"
        body = f"{count} {comp_noun2} overdue. Collect soon."

        # Skip if recently sent to this user
        if exec_id in recently_sent:
            continue

        # Record once per exec user
        _record_user_notification(
            db, exec_id, title, body, {"stage": "exec_overdue", "screen": "Overdue"}
        )
        for tk in tok_map.get(exec_id, []):
            try:
                httpx.post(
                    "https://exp.host/--/api/v2/push/send",
                    json={
                        "to": tk,
                        "title": title,
                        "body": body,
                        "data": {"stage": "exec_overdue", "screen": "Overdue"},
                        "priority": "high",
                        "sound": "default",
                    },
                    timeout=8,
                )
            except Exception as e:
                log.warning("Exec overdue push err=%s", e)


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
