from fastapi.testclient import TestClient
from app.main import app
from app.services.auth import hash_password
from app.models.models import User, Role


def test_missing_token_unauthorized(db_session):
    r = TestClient(app).get("/settings")
    assert r.status_code == 401


def test_inactive_user_cannot_login(db_session, client):
    u = User(
        username="inactive1",
        password_hash=hash_password("pass"),
        role=Role.admin,
        is_active=False,
    )
    db_session.add(u)
    db_session.commit()
    r = client.post("/auth/login", json={"username": "inactive1", "password": "pass"})
    assert r.status_code == 401
