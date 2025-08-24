import logging
from app.core.logging_config import get_logger
from apscheduler.schedulers.background import BackgroundScheduler
from apscheduler.triggers.interval import IntervalTrigger
from apscheduler.triggers.cron import CronTrigger
from app.db.session import SessionLocal
from app.services.notifications import run_notification_scan
from datetime import datetime
from app.models.models import Setting

scheduler: BackgroundScheduler | None = None


log = get_logger(__name__)


def _scan_job():
    db = SessionLocal()
    try:
        # Gate entire scan by exec window (IST) to avoid unnecessary DB work
        s = db.get(Setting, 1)
        if s:
            start_h = s.exec_window_start_hour or 6
            end_h = s.exec_window_end_hour or 22

            # Convert IST start/end to UTC hour as in notifications service
            def ist_to_utc(h: int) -> int:
                return int((h - 5.5) % 24)

            utc_start = ist_to_utc(start_h)
            utc_end = ist_to_utc(end_h)
            nowh = datetime.utcnow().hour
            if utc_start < utc_end:
                in_window = utc_start <= nowh < utc_end
            else:
                in_window = nowh >= utc_start or nowh < utc_end
            if not in_window:
                log.debug(
                    "Scan skipped (outside exec window) utc_hour=%s window=%s-%s",
                    nowh,
                    utc_start,
                    utc_end,
                )
                return
        run_notification_scan(db)
        db.commit()
    except Exception as e:
        db.rollback()
        log.exception("Notification scan failed: %s", e)
    finally:
        db.close()


def _configure_jobs():
    global scheduler
    if not scheduler:
        return
    # Remove existing jobs if present
    for job_id in ("notif_interval", "notif_daily"):
        job = scheduler.get_job(job_id)
        if job:
            scheduler.remove_job(job_id)
    # Read current settings
    db = SessionLocal()
    try:
        s = db.get(Setting, 1)
        interval_hours = s.notif_every_hours if s and s.notif_every_hours else 2
    # daily digest removed
    finally:
        db.close()
    trigger = IntervalTrigger(hours=interval_hours)
    scheduler.add_job(
        _scan_job,
        trigger,
        id="notif_interval",
        max_instances=1,
        coalesce=True,
        replace_existing=True,
        misfire_grace_time=300,
    )
    log.info("Notification scheduler interval configured hours=%s", interval_hours)
    # daily cron removed


def start_scheduler():
    global scheduler
    if scheduler:
        return
    scheduler = BackgroundScheduler()
    _configure_jobs()
    scheduler.start()


def reschedule_jobs():
    _configure_jobs()


def shutdown_scheduler():
    global scheduler
    if scheduler:
        scheduler.shutdown(wait=False)
        scheduler = None
