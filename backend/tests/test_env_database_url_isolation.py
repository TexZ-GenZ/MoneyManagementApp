import os
from app.models.models import User, Role
from app.services.auth import hash_password


def test_database_url_override_isolation(monkeypatch, client, db_session):
    # Simulate setting DATABASE_URL mid-test (should not break existing session overrides)
    orig = os.getenv("DATABASE_URL")
    monkeypatch.setenv("DATABASE_URL", "sqlite+pysqlite:///:memory:")
    # Create a user via current session to ensure still functional
    u = User(
        username="env_check",
        password_hash=hash_password("x"),
        role=Role.admin,
        is_active=True,
    )
    db_session.add(u)
    db_session.commit()
    db_session.refresh(u)
    r = client.post("/auth/login", json={"username": "env_check", "password": "x"})
    assert r.status_code == 200
    # Restore environment automatically after test by pytest monkeypatch fixture
    if orig:
        monkeypatch.setenv("DATABASE_URL", orig)
