from decimal import Decimal
from datetime import date, timedelta, datetime
from app.models.models import Role
from tests.factories import (
    create_user,
    create_company,
    assign_exec,
    create_bill,
    submit_payment,
)

SNAPSHOT_FIELDS_PAYMENT = {
    "id",
    "company_code",
    "collected_at",
    "amount_collected",
    "method",
    "status",
    "allocations",
}


def _login(client, username, password):
    r = client.post("/auth/login", json={"username": username, "password": password})
    assert r.status_code == 200
    return r.json()["access_token"]


def normalize_dynamic(payment_detail: dict):
    # Remove timestamps / ids in nested allocations for stable shape comparison
    pd = dict(payment_detail)
    pd["collected_at"] = "<<dt>>"
    allocs = []
    for a in pd.get("allocations", []):
        allocs.append(
            {
                "bill_id": a["bill_id"],
                "bill_number": a["bill_number"],
                "amount_allocated": float(a["amount_allocated"]),
                "bill_status": a["bill_status"],
            }
        )
    pd["allocations"] = allocs
    return pd


def test_payment_detail_snapshot(client, db_session):
    create_user(db_session, "admin_snap", Role.admin, "admin")
    execu = create_user(db_session, "exec_snap", Role.executive, "pass")
    create_company(db_session, "SNAP1")
    assign_exec(db_session, execu, "SNAP1")
    b = create_bill(db_session, "SNAP1", "B1", amount="25.00")
    tok = _login(client, "exec_snap", "pass")
    pid = submit_payment(client, tok, "SNAP1", "25.00", [(b.id, "25.00")]).json()["id"]
    detail = client.get(f"/payments/{pid}").json()
    snap = normalize_dynamic(detail)
    # Expected stable subset
    assert set(snap.keys()) >= SNAPSHOT_FIELDS_PAYMENT
    assert snap["company_code"] == "SNAP1"
    from decimal import Decimal as _D

    assert _D(str(snap["amount_collected"])) == _D("25.00")
    assert (
        len(snap["allocations"]) == 1 and snap["allocations"][0]["bill_number"] == "B1"
    )


def test_company_dashboard_snapshot(client, db_session):
    create_user(db_session, "admin_dash", Role.admin, "admin")
    execu = create_user(db_session, "exec_dash", Role.executive, "pass")
    create_company(db_session, "DASH1")
    assign_exec(db_session, execu, "DASH1")
    # create pending + paid bill scenario
    b1 = create_bill(db_session, "DASH1", "B1", amount="40.00")
    b2 = create_bill(db_session, "DASH1", "B2", amount="10.00")
    tok = _login(client, "exec_dash", "pass")
    pid = submit_payment(client, tok, "DASH1", "10.00", [(b2.id, "10.00")]).json()["id"]
    # approve to mark bill2 paid
    acct = create_user(db_session, "acct_dash", Role.accountant, "acct")
    t_acct = _login(client, "acct_dash", "acct")
    t_admin = _login(client, "admin_dash", "admin")
    client.post(
        f"/accountant/payments/{pid}/approve",
        headers={"Authorization": f"Bearer {t_acct}"},
    )
    client.post(
        f"/admin/payments/{pid}/approve", headers={"Authorization": f"Bearer {t_admin}"}
    )
    dash = client.get("/companies/DASH1/dashboard").json()
    assert dash["code"] == "DASH1"
    assert isinstance(dash["pending_bills"], list)
    assert any(pb["bill_number"] == "B1" for pb in dash["pending_bills"])
    assert any(pb["bill_number"] == "B2" for pb in dash["paid_bills"])


def test_notifications_counts_snapshot(client, db_session):
    create_user(db_session, "admin_notif", Role.admin, "admin")
    execu = create_user(db_session, "exec_notif", Role.executive, "pass")
    create_company(db_session, "N1")
    assign_exec(db_session, execu, "N1")
    b = create_bill(db_session, "N1", "B1", amount="15.00")
    tok = _login(client, "exec_notif", "pass")
    # Submit to generate payment_review notification
    submit_payment(client, tok, "N1", "15.00", [(b.id, "15.00")])
    counts = client.get("/notifications/counts").json()
    # Accept presence of payment_review:pending >=1
    key_candidates = [k for k in counts.keys() if k.startswith("payment_review:")]
    assert key_candidates, f"Expected payment_review:* in counts {counts}"
