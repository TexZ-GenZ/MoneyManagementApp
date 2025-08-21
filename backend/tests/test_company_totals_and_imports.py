from decimal import Decimal
from datetime import datetime, date, timedelta
from tests.factories import (
    create_user,
    create_company,
    assign_exec,
    create_bill,
    submit_payment,
)
from app.models.models import Role, Company, Bill, BillStatus
from app.services.company import recalc_company_totals


def _login(client, username, password):
    r = client.post("/auth/login", json={"username": username, "password": password})
    assert r.status_code == 200
    return r.json()["access_token"]


def test_company_totals_multistep_recompute(client, db_session):
    create_user(db_session, "admin_ct", Role.admin, "admin")
    create_user(db_session, "acct_ct", Role.accountant, "acct")
    execu = create_user(db_session, "exec_ct", Role.executive, "pass")
    create_company(db_session, "CTOT")
    assign_exec(db_session, execu, "CTOT")
    b1 = create_bill(db_session, "CTOT", "C1", amount="120.00")
    b2 = create_bill(db_session, "CTOT", "C2", amount="80.00")
    b3 = create_bill(db_session, "CTOT", "C3", amount="50.00")
    t_exec = _login(client, "exec_ct", "pass")
    t_acct = _login(client, "acct_ct", "acct")
    t_admin = _login(client, "admin_ct", "admin")
    # Partial pay b1 (60 of 120)
    pid1 = submit_payment(client, t_exec, "CTOT", "60.00", [(b1.id, "60.00")]).json()[
        "id"
    ]
    client.post(
        f"/accountant/payments/{pid1}/approve",
        headers={"Authorization": f"Bearer {t_acct}"},
    )
    client.post(
        f"/admin/payments/{pid1}/approve",
        headers={"Authorization": f"Bearer {t_admin}"},
    )
    # Decline attempted second payment on b1 (simulate accountant decline path)
    pid2 = submit_payment(client, t_exec, "CTOT", "30.00", [(b1.id, "30.00")]).json()[
        "id"
    ]
    client.post(
        f"/accountant/payments/{pid2}/decline",
        headers={"Authorization": f"Bearer {t_acct}"},
    )
    # Full settlement remaining b1 + full b2 (60 + 80 = 140)
    pid3 = submit_payment(
        client, t_exec, "CTOT", "140.00", [(b1.id, "60.00"), (b2.id, "80.00")]
    ).json()["id"]
    client.post(
        f"/accountant/payments/{pid3}/approve",
        headers={"Authorization": f"Bearer {t_acct}"},
    )
    client.post(
        f"/admin/payments/{pid3}/approve",
        headers={"Authorization": f"Bearer {t_admin}"},
    )
    # Final payment covering b3
    pid4 = submit_payment(client, t_exec, "CTOT", "50.00", [(b3.id, "50.00")]).json()[
        "id"
    ]
    client.post(
        f"/accountant/payments/{pid4}/approve",
        headers={"Authorization": f"Bearer {t_acct}"},
    )
    client.post(
        f"/admin/payments/{pid4}/approve",
        headers={"Authorization": f"Bearer {t_admin}"},
    )
    recalc_company_totals(db_session, "CTOT")
    comp = db_session.get(Company, "CTOT")
    # All bills settled; amount/outbal should be zero
    assert comp.amount == Decimal("0.00") and comp.outbal == Decimal("0.00")
    # Every bill status either paid or pending if untouched
    statuses = {
        db_session.get(Bill, b1.id).status,
        db_session.get(Bill, b2.id).status,
        db_session.get(Bill, b3.id).status,
    }
    assert BillStatus.paid in statuses and BillStatus.pending not in statuses


class _PartialFailingDBF:
    def __init__(self):
        self._rows = [
            {"CODE": "PFAIL1", "ACCOUNT_N": "PFAIL1", "AREA": "A"},
            {"CODE": "PFAIL2", "ACCOUNT_N": "PFAIL2", "AREA": "B"},
        ]
        self._idx = 0

    def __iter__(self):
        return self

    def __next__(self):
        if self._idx < len(self._rows):
            r = self._rows[self._idx]
            self._idx += 1
            if self._idx == 2:
                raise RuntimeError("Simulated mid-iteration failure")
            return r
        raise StopIteration


def test_master_import_partial_iteration_rollback(monkeypatch, db_session):
    from app.services import imports as imports_mod

    calls = {}

    def fake_dbf(path, load=True, char_decode_errors="ignore"):
        calls["hit"] = True
        return _PartialFailingDBF()

    monkeypatch.setattr(imports_mod, "DBF", fake_dbf)
    from sqlalchemy import select
    import pytest

    with pytest.raises(RuntimeError):
        imports_mod.import_master(db_session, filename="does_not_matter.dbf")
    # Rows should not persist due to exception before commit
    assert (
        db_session.query(Company).filter(Company.code.in_(["PFAIL1", "PFAIL2"])).count()
        == 0
    )
