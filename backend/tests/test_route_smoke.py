import io
import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session
from app.models.models import Role
from tests.conftest import create_user
import app.api.routes as routes_mod


@pytest.mark.integration
def test_route_smoke_imports_and_recalc(
    client: TestClient, db_session: Session, monkeypatch
):
    # Seed users
    admin = create_user(
        db_session, username="adminu", role=Role.admin, password="adminpass"
    )
    accountant = create_user(
        db_session, username="acctu", role=Role.accountant, password="acctpass"
    )

    # Login admin
    r = client.post("/auth/login", json={"username": "adminu", "password": "adminpass"})
    assert r.status_code == 200
    admin_token = r.json()["access_token"]
    # Login accountant
    r = client.post("/auth/login", json={"username": "acctu", "password": "acctpass"})
    assert r.status_code == 200
    acct_token = r.json()["access_token"]

    # /auth/me with admin
    r = client.get("/auth/me", headers={"Authorization": f"Bearer {admin_token}"})
    assert r.status_code == 200 and r.json()["username"] == "adminu"

    # Monkeypatch import wrappers to avoid real DBF parsing during upload
    def fake_do_import_master(db):
        return {"inserted": 1, "updated": 0, "skipped": 0, "archived": 0}

    def fake_do_import_transactions(db):
        return {
            "inserted": 2,
            "updated": 0,
            "skipped": 0,
            "archived": 0,
            "zero_debit_skipped": 0,
            "negative_debit": 0,
            "fallback_due_assigned": 2,
        }

    monkeypatch.setattr(
        routes_mod, "do_import_master", fake_do_import_master, raising=True
    )
    monkeypatch.setattr(
        routes_mod, "do_import_transactions", fake_do_import_transactions, raising=True
    )

    dummy_content = io.BytesIO(b"FAKEDBF")
    files = {"file": ("master.dbf", dummy_content, "application/octet-stream")}
    r = client.post(
        "/uploads/master",
        headers={"Authorization": f"Bearer {acct_token}"},
        files=files,
    )
    assert r.status_code == 200 and r.json()["inserted"] == 1

    dummy_content2 = io.BytesIO(b"FAKE2")
    files2 = {"file": ("transactions.dbf", dummy_content2, "application/octet-stream")}
    r = client.post(
        "/uploads/transactions",
        headers={"Authorization": f"Bearer {acct_token}"},
        files=files2,
    )
    assert r.status_code == 200 and r.json()["inserted"] == 2

    # Accountant should be forbidden from recalc-all
    r_forbidden = client.post(
        "/admin/recalc-all", headers={"Authorization": f"Bearer {acct_token}"}
    )
    assert r_forbidden.status_code == 403

    # Admin recalc-all
    r_admin = client.post(
        "/admin/recalc-all", headers={"Authorization": f"Bearer {admin_token}"}
    )
    assert r_admin.status_code == 200 and "recalculated" in r_admin.json()
