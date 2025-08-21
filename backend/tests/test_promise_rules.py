from datetime import date, timedelta
from app.models.models import Role, User, Company
from app.services.auth import hash_password


def seed(db):
    admin = User(username="admin", password_hash=hash_password("admin"), role=Role.admin, is_active=True)
    db.add(admin)
    db.add(Company(code="C001", name="C001", credit_date=date.today()+timedelta(days=5), promise_date=date.today()+timedelta(days=5)))
    db.commit()


def login_admin(client):
    r = client.post("/auth/login", json={"username": "admin", "password": "admin"})
    assert r.status_code == 200
    return {"Authorization": f"Bearer {r.json()['access_token']}"}


def test_promise_backward_forbidden(client, db_session):
    seed(db_session)
    headers = login_admin(client)
    # first move forward
    r1 = client.patch("/companies/C001/promise-date", json={"promise_date": str(date.today()+timedelta(days=6))}, headers=headers)
    assert r1.status_code == 200
    # then attempt backward
    r2 = client.patch("/companies/C001/promise-date", json={"promise_date": str(date.today()+timedelta(days=4))}, headers=headers)
    assert r2.status_code == 400


def test_promise_before_credit_forbidden(client, db_session):
    seed(db_session)
    headers = login_admin(client)
    # attempt promise earlier than credit
    r = client.patch("/companies/C001/promise-date", json={"promise_date": str(date.today()+timedelta(days=1))}, headers=headers)
    assert r.status_code == 400
