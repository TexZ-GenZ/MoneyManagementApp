import pytest
from datetime import date, timedelta, datetime
from decimal import Decimal
from sqlalchemy.orm import Session
from app.models.models import (
    Company,
    Bill,
    BillStatus,
    Notification,
    NotificationType,
    NotificationStatus,
)
from app.services.company import (
    recalc_company_totals,
    resolve_promise_crossed_notifications,
)
from app.services.notifications import scan_promise_credit_overdue


@pytest.fixture
def dummy_company(db_session):
    comp = Company(
        code="TST01",
        name="TestCo",
        credit_date=date.today() - timedelta(days=2),
        promise_date=date.today() - timedelta(days=1),
        amount=Decimal("0"),
        outbal=Decimal("0"),
    )
    db_session.add(comp)
    db_session.commit()
    return comp


@pytest.fixture
def dummy_bill(db_session, dummy_company):
    bill = Bill(
        bill_number="B1",
        company_code=dummy_company.code,
        bill_date=date.today(),
        due_date=date.today() - timedelta(days=2),
        amount=Decimal("100.00"),
        amount_paid=Decimal("0"),
        status=BillStatus.pending,
        is_archived=False,
    )
    db_session.add(bill)
    db_session.commit()
    return bill


def test_recalc_company_totals_updates_amounts(db_session, dummy_company, dummy_bill):
    recalc_company_totals(db_session, dummy_company.code)
    db_session.refresh(dummy_company)
    assert dummy_company.amount == Decimal("100.00")
    assert dummy_company.outbal == Decimal("100.00")


def test_resolve_promise_crossed_notifications_stops_notification(
    db_session, dummy_company
):
    # Create pending notification
    notif = Notification(
        company_code=dummy_company.code,
        type=NotificationType.promise_crossed,
        status=NotificationStatus.pending,
        message="Test overdue",
    )
    db_session.add(notif)
    db_session.commit()
    # Move dates forward
    dummy_company.credit_date = date.today() + timedelta(days=5)
    dummy_company.promise_date = date.today() + timedelta(days=5)
    db_session.add(dummy_company)
    db_session.commit()
    resolve_promise_crossed_notifications(db_session, dummy_company)
    db_session.refresh(notif)
    assert notif.status == NotificationStatus.stopped


def test_scan_promise_credit_overdue_creates_notification(db_session, dummy_company):
    scan_promise_credit_overdue(db_session)
    notif = (
        db_session.query(Notification)
        .filter(
            Notification.company_code == dummy_company.code,
            Notification.type == NotificationType.promise_crossed,
        )
        .first()
    )
    assert notif is not None
    assert notif.status == NotificationStatus.pending
