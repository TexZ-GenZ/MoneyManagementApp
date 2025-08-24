import logging
import os
from app.core.logging_config import get_logger
from apscheduler.schedulers.background import BackgroundScheduler
from apscheduler.triggers.interval import IntervalTrigger
from apscheduler.triggers.cron import CronTrigger
from app.db.session import SessionLocal
from app.services.notifications import run_notification_scan
from app.models.models import Setting

scheduler: BackgroundScheduler | None = None


log = get_logger(__name__)


def _scan_job():
    db = SessionLocal()
    try:
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
        daily_hour = (
            s.payment_notif_daily_hour if s and s.payment_notif_daily_hour else 9
        )
    finally:
        db.close()
    scheduler.add_job(
        _scan_job,
        IntervalTrigger(hours=interval_hours),
        id="notif_interval",
        max_instances=1,
        coalesce=True,
        replace_existing=True,
        misfire_grace_time=300,
    )
    log.info("Notification scheduler using hours interval=%s", interval_hours)
    scheduler.add_job(
        _scan_job,
        CronTrigger(hour=daily_hour, minute=0),
        id="notif_daily",
        max_instances=1,
        replace_existing=True,
        misfire_grace_time=600,
    )


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
