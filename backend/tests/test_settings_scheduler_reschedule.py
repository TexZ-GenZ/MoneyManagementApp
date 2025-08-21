def test_settings_patch_triggers_reschedule(monkeypatch, db_session, client):
    from app.models.models import User, Role
    from app.services.auth import hash_password

    admin = User(
        username="admin_sched",
        password_hash=hash_password("admin"),
        role=Role.admin,
        is_active=True,
    )
    db_session.add(admin)
    db_session.commit()
    tok = client.post(
        "/auth/login", json={"username": "admin_sched", "password": "admin"}
    ).json()["access_token"]
    headers = {"Authorization": f"Bearer {tok}"}
    called = {"count": 0}

    def fake_reschedule():
        called["count"] += 1

    # Patch the symbol actually used by the route (imported into routes module)
    import app.api.routes as routes_mod

    monkeypatch.setattr(routes_mod, "reschedule_jobs", fake_reschedule)
    r = client.patch(
        "/settings",
        json={"notif_every_hours": 3},
        headers=headers,
    )
    assert r.status_code == 200
    assert called["count"] == 1
