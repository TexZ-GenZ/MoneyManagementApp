import pytest
from decimal import Decimal
from datetime import datetime, date, timedelta
from app.models.models import Role, BillStatus, PaymentStatus
from tests.factories import (
    create_user,
    create_company,
    assign_exec,
    create_bill,
    submit_payment,
    submit_payment_autosplit,
)


def _login(client, username, password):
    r = client.post("/auth/login", json={"username": username, "password": password})
    assert r.status_code == 200, r.text
    return r.json()["access_token"]


def test_allocation_exceeds_remaining_with_existing_pending_reservation(
    client, db_session
):
    # Setup: existing pending payment reserves part of bill; second payment should be rejected when exceeding true remaining.
    admin = create_user(db_session, "admin_resv", Role.admin, "admin")
    acct = create_user(db_session, "acct_resv", Role.accountant, "acct")
    execu = create_user(db_session, "exec_resv", Role.executive, "pass")
    create_company(db_session, "RSV1")
    assign_exec(db_session, execu, "RSV1")
    bill = create_bill(db_session, "RSV1", "BR1", amount="100.00")
    t_exec = _login(client, "exec_resv", "pass")
    t_acct = _login(client, "acct_resv", "acct")
    # First payment reserves 60 of 100
    r1 = submit_payment(client, t_exec, "RSV1", "60.00", [(bill.id, "60.00")])
    assert r1.status_code == 200
    pid = r1.json()["id"]
    # Keep it in submitted (pending reservation) (optionally accountant approve keeps reservation too)
    # Second payment attempts 50 (> remaining 40) -> error
    r2 = submit_payment(client, t_exec, "RSV1", "50.00", [(bill.id, "50.00")])
    assert r2.status_code == 400
    # A valid one using remaining 40 succeeds
    r3 = submit_payment(client, t_exec, "RSV1", "40.00", [(bill.id, "40.00")])
    assert r3.status_code == 200


def test_admin_double_decline_forbidden(client, db_session):
    create_user(db_session, "admin_ddcl", Role.admin, "admin")
    acct = create_user(db_session, "acct_ddcl", Role.accountant, "acct")
    execu = create_user(db_session, "exec_ddcl", Role.executive, "pass")
    create_company(db_session, "ADCL1")
    assign_exec(db_session, execu, "ADCL1")
    b = create_bill(db_session, "ADCL1", "B1", amount="25.00")
    t_exec = _login(client, "exec_ddcl", "pass")
    t_acct = _login(client, "acct_ddcl", "acct")
    t_admin = _login(client, "admin_ddcl", "admin")
    pid = submit_payment(client, t_exec, "ADCL1", "25.00", [(b.id, "25.00")]).json()[
        "id"
    ]
    # Move to accountant approved so admin can act, then admin declines
    client.post(
        f"/accountant/payments/{pid}/approve",
        headers={"Authorization": f"Bearer {t_acct}"},
    )
    r1 = client.post(
        f"/admin/payments/{pid}/decline", headers={"Authorization": f"Bearer {t_admin}"}
    )
    assert r1.status_code == 200
    r2 = client.post(
        f"/admin/payments/{pid}/decline", headers={"Authorization": f"Bearer {t_admin}"}
    )
    assert r2.status_code == 400


def test_decline_after_admin_approval_explicit(client, db_session):
    create_user(db_session, "admin_daa", Role.admin, "admin")
    acct = create_user(db_session, "acct_daa", Role.accountant, "acct")
    execu = create_user(db_session, "exec_daa", Role.executive, "pass")
    create_company(db_session, "DAA1")
    assign_exec(db_session, execu, "DAA1")
    b = create_bill(db_session, "DAA1", "B1", amount="30.00")
    t_exec = _login(client, "exec_daa", "pass")
    t_acct = _login(client, "acct_daa", "acct")
    t_admin = _login(client, "admin_daa", "admin")
    pid = submit_payment(client, t_exec, "DAA1", "30.00", [(b.id, "30.00")]).json()[
        "id"
    ]
    client.post(
        f"/accountant/payments/{pid}/approve",
        headers={"Authorization": f"Bearer {t_acct}"},
    )
    client.post(
        f"/admin/payments/{pid}/approve", headers={"Authorization": f"Bearer {t_admin}"}
    )
    r_decl = client.post(
        f"/admin/payments/{pid}/decline", headers={"Authorization": f"Bearer {t_admin}"}
    )
    assert r_decl.status_code == 400


def test_admin_approve_after_accountant_decline_explicit(client, db_session):
    # Already covered but keep isolated variant confirming status untouched
    create_user(db_session, "admin_aad", Role.admin, "admin")
    acct = create_user(db_session, "acct_aad", Role.accountant, "acct")
    execu = create_user(db_session, "exec_aad", Role.executive, "pass")
    create_company(db_session, "AAD1")
    assign_exec(db_session, execu, "AAD1")
    b = create_bill(db_session, "AAD1", "B1", amount="22.00")
    t_exec = _login(client, "exec_aad", "pass")
    t_acct = _login(client, "acct_aad", "acct")
    t_admin = _login(client, "admin_aad", "admin")
    pid = submit_payment(client, t_exec, "AAD1", "22.00", [(b.id, "22.00")]).json()[
        "id"
    ]
    client.post(
        f"/accountant/payments/{pid}/decline",
        headers={"Authorization": f"Bearer {t_acct}"},
    )
    r = client.post(
        f"/admin/payments/{pid}/approve", headers={"Authorization": f"Bearer {t_admin}"}
    )
    assert r.status_code == 400


def test_duplicate_bill_allocations_rejected(client, db_session):
    execu = create_user(db_session, "exec_dupalloc", Role.executive, "pass")
    create_company(db_session, "DALC1")
    assign_exec(db_session, execu, "DALC1")
    b = create_bill(db_session, "DALC1", "B1", amount="10.00")
    tok = _login(client, "exec_dupalloc", "pass")
    body = {
        "company_code": "DALC1",
        "collected_at": datetime.utcnow().isoformat(),
        "amount_collected": "10.00",
        "method": "cash",
        "bill_allocations": [
            {"bill_id": b.id, "amount": "5.00"},
            {"bill_id": b.id, "amount": "5.00"},
        ],
    }
    r = client.post("/payments", json=body, headers={"Authorization": f"Bearer {tok}"})
    assert r.status_code == 400


def test_negative_and_zero_amounts_rejected(client, db_session):
    execu = create_user(db_session, "exec_neg", Role.executive, "pass")
    create_company(db_session, "NEG1")
    assign_exec(db_session, execu, "NEG1")
    b = create_bill(db_session, "NEG1", "B1", amount="15.00")
    tok = _login(client, "exec_neg", "pass")
    # Zero payment
    body0 = {
        "company_code": "NEG1",
        "collected_at": datetime.utcnow().isoformat(),
        "amount_collected": "0.00",
        "method": "cash",
        "bill_allocations": [{"bill_id": b.id, "amount": "0.00"}],
    }
    r0 = client.post(
        "/payments", json=body0, headers={"Authorization": f"Bearer {tok}"}
    )
    assert r0.status_code == 400
    # Negative allocation
    body1 = {
        "company_code": "NEG1",
        "collected_at": datetime.utcnow().isoformat(),
        "amount_collected": "5.00",
        "method": "cash",
        "bill_allocations": [{"bill_id": b.id, "amount": "-5.00"}],
    }
    r1 = client.post(
        "/payments", json=body1, headers={"Authorization": f"Bearer {tok}"}
    )
    assert r1.status_code == 400
