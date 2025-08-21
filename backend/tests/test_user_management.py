from app.models.models import (
    User,
    Role,
    ExecAssignment,
    Company,
    Payment,
    PaymentStatus,
)
from app.services.auth import hash_password, verify_password
from datetime import datetime

# Helper to get auth header quickly


def _auth(client, username, password):
    return {
        "Authorization": f"Bearer {client.post('/auth/login', json={'username': username, 'password': password}).json()['access_token']}"
    }


def test_user_create_and_login(db_session, client):
    # seed admin
    admin = User(
        username="admin_user_mgmt",
        password_hash=hash_password("admin"),
        role=Role.admin,
        is_active=True,
    )
    db_session.add(admin)
    db_session.commit()
    hdr = _auth(client, "admin_user_mgmt", "admin")
    # create exec with mobile variant
    body = {
        "username": "exec_new",
        "password": "pass123",
        "role": "executive",
        "mobile": "+91 98765 43210",
    }
    r = client.post("/admin/users", json=body, headers=hdr)
    assert r.status_code == 200, r.text
    created = r.json()
    assert created["username"] == "exec_new"
    # login using normalized mobile variant input (leading zero form) should also work
    # First attempt with username
    lr = client.post(
        "/auth/login", json={"username": "exec_new", "password": "pass123"}
    )
    assert lr.status_code == 200


def test_duplicate_username_rejected(db_session, client):
    admin = User(
        username="admin_dupuser",
        password_hash=hash_password("admin"),
        role=Role.admin,
        is_active=True,
    )
    db_session.add(admin)
    db_session.commit()
    hdr = _auth(client, "admin_dupuser", "admin")
    r1 = client.post(
        "/admin/users",
        json={"username": "dup1", "password": "p", "role": "executive"},
        headers=hdr,
    )
    assert r1.status_code == 200
    r2 = client.post(
        "/admin/users",
        json={"username": "dup1", "password": "p2", "role": "executive"},
        headers=hdr,
    )
    assert r2.status_code == 400
    assert "exists" in r2.json()["detail"]


def test_mobile_normalization_uniqueness(db_session, client):
    admin = User(
        username="admin_mobile",
        password_hash=hash_password("admin"),
        role=Role.admin,
        is_active=True,
    )
    db_session.add(admin)
    db_session.commit()
    hdr = _auth(client, "admin_mobile", "admin")
    variants = ["+91 98765 00001", "09876500001", "9876500001"]
    r = client.post(
        "/admin/users",
        json={
            "username": "mobile_u1",
            "password": "p",
            "role": "executive",
            "mobile": variants[0],
        },
        headers=hdr,
    )
    assert r.status_code == 200
    # Second variant should hit uniqueness error
    r_conflict = client.post(
        "/admin/users",
        json={
            "username": "mobile_u2",
            "password": "p",
            "role": "executive",
            "mobile": variants[1],
        },
        headers=hdr,
    )
    assert r_conflict.status_code == 400
    assert "Mobile already exists" in r_conflict.json()["detail"]


def test_update_mobile_conflict(db_session, client):
    admin = User(
        username="admin_updmob",
        password_hash=hash_password("admin"),
        role=Role.admin,
        is_active=True,
    )
    db_session.add(admin)
    db_session.commit()
    hdr = _auth(client, "admin_updmob", "admin")
    # Create two users: first with a mobile, second without
    r1 = client.post(
        "/admin/users",
        json={
            "username": "mob_user1",
            "password": "p",
            "role": "executive",
            "mobile": "+91 91234 50000",
        },
        headers=hdr,
    )
    assert r1.status_code == 200
    user1_id = r1.json()["id"]
    r2 = client.post(
        "/admin/users",
        json={"username": "mob_user2", "password": "p", "role": "executive"},
        headers=hdr,
    )
    assert r2.status_code == 200
    user2_id = r2.json()["id"]
    # Attempt to set user2 mobile to variant of user1's
    r = client.patch(
        f"/admin/users/{user2_id}/mobile", headers=hdr, params={"mobile": "09123450000"}
    )
    assert r.status_code == 400
    assert "in use" in r.json()["detail"]


def test_password_change_and_login(db_session, client):
    admin = User(
        username="admin_pw",
        password_hash=hash_password("admin"),
        role=Role.admin,
        is_active=True,
    )
    execu = User(
        username="exec_pw",
        password_hash=hash_password("oldpw"),
        role=Role.executive,
        is_active=True,
    )
    db_session.add_all([admin, execu])
    db_session.commit()
    hdr = _auth(client, "admin_pw", "admin")
    # change password
    r = client.patch(
        f"/admin/users/{execu.id}/password",
        headers=hdr,
        params={"new_password": "newpw"},
    )
    assert r.status_code == 200
    # old should fail
    r_old = client.post(
        "/auth/login", json={"username": "exec_pw", "password": "oldpw"}
    )
    assert r_old.status_code == 400 or r_old.status_code == 401
    # new works
    r_new = client.post(
        "/auth/login", json={"username": "exec_pw", "password": "newpw"}
    )
    assert r_new.status_code == 200


def test_deactivate_user_prevents_login(db_session, client):
    admin = User(
        username="admin_deact",
        password_hash=hash_password("admin"),
        role=Role.admin,
        is_active=True,
    )
    execu = User(
        username="exec_deact",
        password_hash=hash_password("pw"),
        role=Role.executive,
        is_active=True,
    )
    db_session.add_all([admin, execu])
    db_session.commit()
    hdr = _auth(client, "admin_deact", "admin")
    # deactivate
    r = client.delete(f"/admin/users/{execu.id}", headers=hdr)
    assert r.status_code == 200
    # login fails
    lr = client.post("/auth/login", json={"username": "exec_deact", "password": "pw"})
    assert lr.status_code == 400 or lr.status_code == 401


def test_hard_delete_constraints(db_session, client):
    admin = User(
        username="admin_hd",
        password_hash=hash_password("admin"),
        role=Role.admin,
        is_active=True,
    )
    acct = User(
        username="acct_hd",
        password_hash=hash_password("acct"),
        role=Role.accountant,
        is_active=True,
    )
    execu = User(
        username="exec_hd",
        password_hash=hash_password("pw"),
        role=Role.executive,
        is_active=True,
    )
    db_session.add_all([admin, acct, execu, Company(code="HD01", name="HD01")])
    db_session.commit()
    hdr = _auth(client, "admin_hd", "admin")
    # cannot hard delete accountant
    r_acct = client.delete(f"/admin/users/{acct.id}/hard-delete", headers=hdr)
    assert r_acct.status_code == 400
    # add assignment prevents hard delete
    db_session.add(ExecAssignment(executive_id=execu.id, company_code="HD01"))
    db_session.commit()
    r_exec_block = client.delete(f"/admin/users/{execu.id}/hard-delete", headers=hdr)
    assert r_exec_block.status_code == 400
    # remove assignment and add a payment to block again
    db_session.query(ExecAssignment).delete()
    db_session.commit()
    # add payment reference
    p = Payment(
        company_code="HD01",
        executive_id=execu.id,
        collected_at=datetime.utcnow(),
        amount_collected=1,
        method="cash",
        status=PaymentStatus.submitted,
    )
    db_session.add(p)
    db_session.commit()
    r_exec_block2 = client.delete(f"/admin/users/{execu.id}/hard-delete", headers=hdr)
    assert r_exec_block2.status_code == 400
    # Remove payment then delete should succeed
    db_session.delete(p)
    db_session.commit()
    r_exec_del = client.delete(f"/admin/users/{execu.id}/hard-delete", headers=hdr)
    assert r_exec_del.status_code == 200
