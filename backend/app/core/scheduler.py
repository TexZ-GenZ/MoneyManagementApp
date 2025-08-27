import logging
import os
from app.core.logging_config import get_logger
from apscheduler.schedulers.background import BackgroundScheduler
from apscheduler.triggers.interval import IntervalTrigger
from apscheduler.triggers.cron import CronTrigger
from app.db.session import SessionLocal
from app.services.notifications import run_notification_scan
from datetime import datetime
from app.models.models import Setting
from zoneinfo import ZoneInfo

scheduler: BackgroundScheduler | None = None


log = get_logger(__name__)


def _scan_job():
    db = SessionLocal()
    try:
        # Check exec window using IST time (no UTC conversion needed since CronTrigger uses IST)
        from zoneinfo import ZoneInfo
        s = db.get(Setting, 1)
        if s:
            start_h = s.exec_window_start_hour or 6
            end_h = s.exec_window_end_hour or 22
            
            # Get current IST hour directly (no conversion needed)
            ist_now = datetime.now(ZoneInfo("Asia/Kolkata")).hour
            
            if start_h <= end_h:
                in_window = start_h <= ist_now <= end_h
            else:
                # Handle overnight window (e.g., 22-6)
                in_window = ist_now >= start_h or ist_now <= end_h
                
            if not in_window:
                log.debug(
                    "Scan skipped (outside exec window) ist_hour=%s window=%s-%s",
                    ist_now,
                    start_h,
                    end_h,
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
        if not s:
            interval_hours = 2
            start_h = 6
            end_h = 22
        else:
            interval_hours = s.notif_every_hours if s.notif_every_hours else 2
            start_h = s.exec_window_start_hour or 6
            end_h = s.exec_window_end_hour or 22
    finally:
        db.close()

    # Compute discrete run hours aligned to [start, end] inclusive, every X hours (IST -> UTC)
    def ist_to_utc(h: int) -> int:
        # Keep existing integer-hour mapping used elsewhere to avoid half-hour complications
        return int((h - 5.5) % 24)

    def compute_utc_hours(start_h: int, end_h: int, step: int) -> list[int]:
        if step <= 0:
            step = 1
        ist_hours: list[int] = []
        if start_h <= end_h:
            ist_hours = list(range(start_h, end_h + 1, step))
        else:
            # wrap across midnight; build on extended range and wrap
            ist_hours = [h % 24 for h in range(start_h, end_h + 24 + 1, step)]
        # Map to UTC hours, unique and sorted
        utc_hours = sorted({ist_to_utc(h) for h in ist_hours})
        return utc_hours

    utc_hours = compute_utc_hours(start_h, end_h, interval_hours)

    # Build discrete IST hours list: start, start+X, ..., up to end inclusive
    def compute_ist_hours(start_h: int, end_h: int, step: int) -> list[int]:
        if step <= 0:
            step = 1
        if start_h <= end_h:
            return list(range(start_h, end_h + 1, step))
        # wrap across midnight
        return [h % 24 for h in range(start_h, end_h + 24 + 1, step)]

    ist_hours = compute_ist_hours(start_h, end_h, interval_hours)
    hour_expr = ",".join(str(h) for h in ist_hours)
    trigger = CronTrigger(hour=hour_expr, minute=0, timezone=ZoneInfo("Asia/Kolkata"))
    scheduler.add_job(
        _scan_job,
        trigger,
        id="notif_interval",
        max_instances=1,
        coalesce=True,
        replace_existing=True,
        misfire_grace_time=300,
    )
    log.info(
        "Notification scheduler configured: IST every hour at :00 within window=%s-%s",
        start_h,
        end_h,
    )
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
