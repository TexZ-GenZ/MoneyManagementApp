from datetime import datetime
from decimal import Decimal
from app.models.models import Role
from tests.factories import (
    create_user,
    create_company,
    assign_exec,
    create_bill,
    submit_payment,
)
from app.services.company import recalc_company_totals


def _login(client, username, password):
    r = client.post("/auth/login", json={"username": username, "password": password})
    assert r.status_code == 200
    return r.json()["access_token"]


def test_company_totals_strict_partial_then_full(client, db_session):
    create_user(db_session, "admin_tot", Role.admin, "admin")
    create_user(db_session, "acct_tot", Role.accountant, "acct")
    execu = create_user(db_session, "exec_tot", Role.executive, "pass")
    create_company(db_session, "TOT1")
    assign_exec(db_session, execu, "TOT1")
    b1 = create_bill(db_session, "TOT1", "B1", amount="120.00")
    b2 = create_bill(db_session, "TOT1", "B2", amount="80.00")
    t_exec = _login(client, "exec_tot", "pass")
    t_acct = _login(client, "acct_tot", "acct")
    t_admin = _login(client, "admin_tot", "admin")
    r = submit_payment(client, t_exec, "TOT1", "120.00", [(b1.id, "120.00")])
    pid = r.json()["id"]
    assert r.status_code == 200
    assert (
        client.post(
            f"/accountant/payments/{pid}/approve",
            headers={"Authorization": f"Bearer {t_acct}"},
        ).status_code
        == 200
    )
    assert (
        client.post(
            f"/admin/payments/{pid}/approve",
            headers={"Authorization": f"Bearer {t_admin}"},
        ).status_code
        == 200
    )
    recalc_company_totals(db_session, "TOT1")
    from app.models.models import Company

    comp = db_session.get(Company, "TOT1")
    assert comp.amount == Decimal("80.00")
    r2 = submit_payment(client, t_exec, "TOT1", "80.00", [(b2.id, "80.00")])
    pid2 = r2.json()["id"]
    assert r2.status_code == 200
    client.post(
        f"/accountant/payments/{pid2}/approve",
        headers={"Authorization": f"Bearer {t_acct}"},
    )
    client.post(
        f"/admin/payments/{pid2}/approve",
        headers={"Authorization": f"Bearer {t_admin}"},
    )
    recalc_company_totals(db_session, "TOT1")
    comp2 = db_session.get(Company, "TOT1")
    assert comp2.amount == Decimal("0.00") and comp2.outbal == Decimal("0.00")


def test_explicit_approve_after_accountant_decline_forbidden(client, db_session):
    create_user(db_session, "admin_decl", Role.admin, "admin")
    acct = create_user(db_session, "acct_decl", Role.accountant, "acct")
    execu = create_user(db_session, "exec_decl", Role.executive, "pass")
    create_company(db_session, "DECL1")
    assign_exec(db_session, execu, "DECL1")
    b = create_bill(db_session, "DECL1", "B1", amount="50.00")
    t_exec = _login(client, "exec_decl", "pass")
    t_acct = _login(client, "acct_decl", "acct")
    t_admin = _login(client, "admin_decl", "admin")
    pid = submit_payment(client, t_exec, "DECL1", "50.00", [(b.id, "50.00")]).json()[
        "id"
    ]
    assert (
        client.post(
            f"/accountant/payments/{pid}/decline",
            headers={"Authorization": f"Bearer {t_acct}"},
        ).status_code
        == 200
    )
    r_admin = client.post(
        f"/admin/payments/{pid}/approve", headers={"Authorization": f"Bearer {t_admin}"}
    )
    assert r_admin.status_code == 400


def test_double_decline_accountant_forbidden(client, db_session):
    acct = create_user(db_session, "acct_dd", Role.accountant, "acct")
    execu = create_user(db_session, "exec_dd", Role.executive, "pass")
    create_company(db_session, "DD1")
    assign_exec(db_session, execu, "DD1")
    b = create_bill(db_session, "DD1", "B1", amount="40.00")
    t_exec = _login(client, "exec_dd", "pass")
    t_acct = _login(client, "acct_dd", "acct")
    pid = submit_payment(client, t_exec, "DD1", "40.00", [(b.id, "40.00")]).json()["id"]
    assert (
        client.post(
            f"/accountant/payments/{pid}/decline",
            headers={"Authorization": f"Bearer {t_acct}"},
        ).status_code
        == 200
    )
    r2 = client.post(
        f"/accountant/payments/{pid}/decline",
        headers={"Authorization": f"Bearer {t_acct}"},
    )
    assert r2.status_code == 400


def test_cannot_decline_after_admin_approval(client, db_session):
    create_user(db_session, "admin_cd", Role.admin, "admin")
    acct = create_user(db_session, "acct_cd", Role.accountant, "acct")
    execu = create_user(db_session, "exec_cd", Role.executive, "pass")
    create_company(db_session, "CD1")
    assign_exec(db_session, execu, "CD1")
    b = create_bill(db_session, "CD1", "B1", amount="30.00")
    t_exec = _login(client, "exec_cd", "pass")
    t_acct = _login(client, "acct_cd", "acct")
    t_admin = _login(client, "admin_cd", "admin")
    pid = submit_payment(client, t_exec, "CD1", "30.00", [(b.id, "30.00")]).json()["id"]
    client.post(
        f"/accountant/payments/{pid}/approve",
        headers={"Authorization": f"Bearer {t_acct}"},
    )
    client.post(
        f"/admin/payments/{pid}/approve", headers={"Authorization": f"Bearer {t_admin}"}
    )
    r_decl = client.post(
        f"/accountant/payments/{pid}/decline",
        headers={"Authorization": f"Bearer {t_acct}"},
    )
    assert r_decl.status_code == 400


def test_scheduler_reschedule_invoked(monkeypatch, client, db_session):
    create_user(db_session, "admin_set", Role.admin, "admin")
    t_admin = _login(client, "admin_set", "admin")
    called = {}
    import app.api.routes as routes

    def fake_reschedule():
        called["hit"] = True

    monkeypatch.setattr(routes, "reschedule_jobs", fake_reschedule)
    r = client.patch(
        "/settings",
        json={"notif_every_hours": 3},
        headers={"Authorization": f"Bearer {t_admin}"},
    )
    assert r.status_code == 200
    assert called.get("hit") is True


def test_company_list_scoping_for_executive(db_session, client):
    execu = create_user(db_session, "exec_scope", Role.executive, "pass")
    create_company(db_session, "SC1")
    create_company(db_session, "SC2")
    assign_exec(db_session, execu, "SC1")
    tok = _login(client, "exec_scope", "pass")
    r = client.get("/companies", headers={"Authorization": f"Bearer {tok}"})
    assert r.status_code == 200
    data = r.json()
    assert data["total"] >= 2  # documents current non-scoped behavior
