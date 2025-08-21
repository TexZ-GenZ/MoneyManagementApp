def test_mobile_login_normalization(db_session, client):
    from app.models.models import User, Role
    from app.services.auth import hash_password
    from jose import jwt
    from app.core.config import settings

    u = User(
        username="user1",
        mobile="9876543210",
        password_hash=hash_password("pw"),
        role=Role.executive,
        is_active=True,
    )
    db_session.add(u)
    db_session.commit()
    variants = [
        "9876543210",
        "+91 98765 43210",
        "(987)654-3210",
        "91-9876543210",
    ]
    subs = set()
    for v in variants:
        r = client.post("/auth/login", json={"username": v, "password": "pw"})
        assert r.status_code == 200, r.text
        token = r.json()["access_token"]
        payload = jwt.decode(
            token, settings.JWT_SECRET, algorithms=[settings.JWT_ALGORITHM]
        )
        subs.add(payload.get("sub"))
    assert subs == {str(u.id)}
