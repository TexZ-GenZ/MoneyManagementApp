import datetime
from decimal import Decimal
import pytest

from app.models.models import (
    Role,
    Company,
    Bill,
    Payment,
    PaymentStatus,
    Notification,
    NotificationType,
    NotificationStatus,
)
from app.services.auth import hash_password


def login_token(client, username, password):
    r = client.post("/auth/login", json={"username": username, "password": password})
    assert r.status_code == 200, r.text
    return r.json()["access_token"]


def auth_headers(token):
    return {"Authorization": f"Bearer {token}"}


def create_user(db, username, role: Role, password="pass", mobile=None):
    from app.models.models import User

    u = User(
        username=username,
        password_hash=hash_password(password),
        role=role,
        area="A",
        is_active=True,
        mobile=mobile,
    )
    db.add(u)
    db.commit()
    db.refresh(u)
    return u


def create_company_with_bill(db, code="C900", bill_amount=100, bill_number="B900"):
    c = Company(code=code, name=code, area="A", amount=0, outbal=0)
    db.add(c)
    db.commit()
    b = Bill(
        bill_number=bill_number,
        company_code=code,
        bill_date=datetime.date.today(),
        due_date=datetime.date.today() + datetime.timedelta(days=10),
        amount=Decimal(str(bill_amount)),
        amount_paid=Decimal("0"),
        status="pending",
        is_archived=False,
    )
    db.add(b)
    db.commit()
    db.refresh(b)
    return c, b


@pytest.mark.parametrize(
    "variant,modify",
    [
        ("same_request", lambda body: body),
        (
            "different_amount",
            lambda body: {**body, "amount_collected": body["amount_collected"] + 1},
        ),
    ],
)
def test_payments_idempotency_variants(client, db_session, variant, modify):
    # Prepare users & assignment
    exec_user = create_user(db_session, "exec_ip", Role.executive)
    comp, bill = create_company_with_bill(db_session, code="CIDEMP", bill_amount=100)
    # assign company to exec
    from app.models.models import ExecAssignment

    db_session.add(ExecAssignment(executive_id=exec_user.id, company_code=comp.code))
    db_session.commit()
    token = login_token(client, "exec_ip", "pass")
    body = {
        "company_code": comp.code,
        "collected_at": datetime.datetime.utcnow().isoformat(),
        "amount_collected": 100.00,
        "method": "cash",
        "bill_allocations": [{"bill_id": bill.id, "amount": 100.00}],
    }
    idem = "key-1"
    r1 = client.post(
        "/payments", json=body, headers={**auth_headers(token), "Idempotency-Key": idem}
    )
    assert r1.status_code == 200, r1.text
    first_id = r1.json()["id"]
    r2 = client.post(
        "/payments",
        json=modify(body),
        headers={**auth_headers(token), "Idempotency-Key": idem},
    )
    if variant == "same_request":
        assert r2.status_code == 200
        assert r2.json()["id"] == first_id
    else:  # conflict
        assert r2.status_code == 409
        assert "Idempotency-Key" in r2.text


def test_payments_exec_unassigned_forbidden(client, db_session):
    exec_user = create_user(db_session, "exec_unassigned", Role.executive)
    comp, bill = create_company_with_bill(db_session, code="CUNASS")
    token = login_token(client, "exec_unassigned", "pass")
    body = {
        "company_code": comp.code,
        "collected_at": datetime.datetime.utcnow().isoformat(),
        "amount_collected": 100.0,
        "method": "cash",
        "bill_allocations": [{"bill_id": bill.id, "amount": 100.0}],
    }
    r = client.post("/payments", json=body, headers=auth_headers(token))
    assert r.status_code == 403
    assert "Not assigned" in r.text


@pytest.mark.parametrize(
    "field,value,msg",
    [
        ("exec_lat", 200, "exec_lat out of range"),
        ("exec_lat", -200, "exec_lat out of range"),
        ("exec_lng", 300, "exec_lng out of range"),
        ("exec_lng", -300, "exec_lng out of range"),
    ],
)
def test_payments_geo_validation_errors(client, db_session, field, value, msg):
    exec_user = create_user(db_session, "exec_geo", Role.executive)
    comp, bill = create_company_with_bill(db_session, code="CGEO")
    from app.models.models import ExecAssignment

    db_session.add(ExecAssignment(executive_id=exec_user.id, company_code=comp.code))
    db_session.commit()
    token = login_token(client, "exec_geo", "pass")
    body = {
        "company_code": comp.code,
        "collected_at": datetime.datetime.utcnow().isoformat(),
        "amount_collected": 100.0,
        "method": "cash",
        "bill_allocations": [{"bill_id": bill.id, "amount": 100.0}],
        field: value,
    }
    r = client.post("/payments", json=body, headers=auth_headers(token))
    assert r.status_code == 400
    assert msg in r.text


@pytest.mark.parametrize(
    "alloc_patch,amount,msg",
    [
        (
            lambda b: b["bill_allocations"].append(
                {"bill_id": b["bill_allocations"][0]["bill_id"], "amount": 100.0}
            )
            or None,
            100.0,
            "Duplicate bill",
        ),  # duplicate bill
        (
            lambda b: b.update(
                {
                    "bill_allocations": [
                        {"bill_id": b["bill_allocations"][0]["bill_id"], "amount": 0}
                    ]
                }
            )
            or None,
            100.0,
            "Allocation amount must be > 0",
        ),  # zero amount
        (
            lambda b: b.update(
                {
                    "bill_allocations": [
                        {
                            "bill_id": b["bill_allocations"][0]["bill_id"],
                            "amount": 120.0,
                        }
                    ]
                }
            )
            or None,
            120.0,
            "Allocation exceeds bill remaining",
        ),  # exceed remaining
        (
            lambda b: b.update(
                {
                    "bill_allocations": [
                        {"bill_id": b["bill_allocations"][0]["bill_id"], "amount": 90.0}
                    ]
                }
            )
            or None,
            100.0,
            "Allocation total must equal",
        ),  # sum < amount
        # (sum > amount variant covered in existing test suite; omitted here to avoid overlapping earlier exceed-remaining error)
    ],
)
def test_payments_allocation_edge_errors(client, db_session, alloc_patch, amount, msg):
    exec_user = create_user(db_session, "exec_alloc", Role.executive)
    comp, bill = create_company_with_bill(db_session, code="CALLOC", bill_amount=100)
    from app.models.models import ExecAssignment

    db_session.add(ExecAssignment(executive_id=exec_user.id, company_code=comp.code))
    db_session.commit()
    token = login_token(client, "exec_alloc", "pass")
    body = {
        "company_code": comp.code,
        "collected_at": datetime.datetime.utcnow().isoformat(),
        "amount_collected": amount,
        "method": "cash",
        "bill_allocations": [{"bill_id": bill.id, "amount": amount}],
    }
    alloc_patch(body)
    r = client.post("/payments", json=body, headers=auth_headers(token))
    assert r.status_code == 400
    assert msg in r.text


def test_companies_promise_date_backward_400(client, db_session):
    # Ensure admin exists
    from app.models.models import User, Role
    from app.services.auth import hash_password

    if not db_session.query(User).filter_by(username="admin").first():
        db_session.add(
            User(
                username="admin",
                password_hash=hash_password("admin"),
                role=Role.admin,
                is_active=True,
            )
        )
        db_session.commit()
    admin_token = login_token(client, "admin", "admin")
    c = Company(
        code="CPROM1", name="CPROM1", area="A", promise_date=datetime.date.today()
    )
    db_session.add(c)
    db_session.commit()
    new_date = (datetime.date.today() - datetime.timedelta(days=1)).isoformat()
    r = client.patch(
        f"/companies/{c.code}/promise-date",
        json={"promise_date": new_date},
        headers=auth_headers(admin_token),
    )
    assert r.status_code == 400
    assert "Cannot move promise_date backward" in r.text


def test_companies_promise_date_before_credit_400(client, db_session):
    from app.models.models import User, Role
    from app.services.auth import hash_password

    if not db_session.query(User).filter_by(username="admin").first():
        db_session.add(
            User(
                username="admin",
                password_hash=hash_password("admin"),
                role=Role.admin,
                is_active=True,
            )
        )
        db_session.commit()
    admin_token = login_token(client, "admin", "admin")
    c = Company(
        code="CPROM2",
        name="CPROM2",
        area="A",
        credit_date=datetime.date.today(),
    )
    db_session.add(c)
    db_session.commit()
    earlier = (datetime.date.today() - datetime.timedelta(days=1)).isoformat()
    r = client.patch(
        f"/companies/{c.code}/promise-date",
        json={"promise_date": earlier},
        headers=auth_headers(admin_token),
    )
    assert r.status_code == 400
    assert "promise_date cannot be earlier than credit_date" in r.text


def test_companies_credit_date_conflict_400(client, db_session):
    from app.models.models import User, Role
    from app.services.auth import hash_password

    if not db_session.query(User).filter_by(username="admin").first():
        db_session.add(
            User(
                username="admin",
                password_hash=hash_password("admin"),
                role=Role.admin,
                is_active=True,
            )
        )
        db_session.commit()
    admin_token = login_token(client, "admin", "admin")
    c = Company(
        code="CREDIT1",
        name="CREDIT1",
        area="A",
        promise_date=datetime.date.today(),
    )
    db_session.add(c)
    db_session.commit()
    later_credit = (datetime.date.today() + datetime.timedelta(days=1)).isoformat()
    r = client.patch(
        f"/companies/{c.code}/credit-date",
        json={"credit_date": later_credit},
        headers=auth_headers(admin_token),
    )
    assert r.status_code == 400
    assert "Existing promise_date earlier than new credit_date" in r.text


def test_notifications_filters_combined_for_admin_and_executive(client, db_session):
    # Create company, exec & assignment, notifications
    exec_user = create_user(db_session, "exec_notif", Role.executive)
    comp = Company(code="NTF1", name="NTF1", area="A")
    db_session.add(comp)
    db_session.commit()
    from app.models.models import ExecAssignment

    db_session.add(ExecAssignment(executive_id=exec_user.id, company_code=comp.code))
    db_session.add(
        Notification(
            company_code=comp.code,
            type=NotificationType.promise_crossed,
            status=NotificationStatus.pending,
            message="m1",
        )
    )
    db_session.add(
        Notification(
            company_code=comp.code,
            type=NotificationType.payment_review,
            status=NotificationStatus.sent,
            message="m2",
        )
    )
    db_session.commit()
    # Admin filter
    from app.models.models import User
    from app.services.auth import hash_password

    if not db_session.query(User).filter_by(username="admin").first():
        db_session.add(
            User(
                username="admin",
                password_hash=hash_password("admin"),
                role=Role.admin,
                is_active=True,
            )
        )
        db_session.commit()
    admin_token = login_token(client, "admin", "admin")
    r_admin = client.get(
        f"/notifications?status=pending&type=promise_crossed&company_code={comp.code}",
        headers=auth_headers(admin_token),
    )
    assert r_admin.status_code == 200
    assert r_admin.json()["total"] == 1
    # Exec sees only assigned company's pending promise_crossed
    exec_token = login_token(client, "exec_notif", "pass")
    r_exec = client.get(
        f"/notifications?status=pending&type=promise_crossed&company_code={comp.code}",
        headers=auth_headers(exec_token),
    )
    assert r_exec.status_code == 200
    assert r_exec.json()["total"] == 1


def test_notifications_ack_not_pending_400(client, db_session):
    n = Notification(
        company_code="ACK1",
        type=NotificationType.promise_crossed,
        status=NotificationStatus.sent,
        message="sent already",
    )
    db_session.add(n)
    db_session.commit()
    from app.models.models import User
    from app.services.auth import hash_password

    if not db_session.query(User).filter_by(username="admin").first():
        db_session.add(
            User(
                username="admin",
                password_hash=hash_password("admin"),
                role=Role.admin,
                is_active=True,
            )
        )
        db_session.commit()
    admin_token = login_token(client, "admin", "admin")
    r = client.post(f"/notifications/{n.id}/ack", headers=auth_headers(admin_token))
    assert r.status_code == 400
    assert "Notification not pending" in r.text


def test_accountant_approve_wrong_state_400(client, db_session):
    # Create accountant and payment already approved
    acct = create_user(db_session, "acct1", Role.accountant)
    comp, bill = create_company_with_bill(db_session, code="PAPP1")
    exec_user = create_user(db_session, "exec_papp", Role.executive)
    from app.models.models import ExecAssignment

    db_session.add(ExecAssignment(executive_id=exec_user.id, company_code=comp.code))
    db_session.commit()
    token_exec = login_token(client, "exec_papp", "pass")
    body = {
        "company_code": comp.code,
        "collected_at": datetime.datetime.utcnow().isoformat(),
        "amount_collected": 100.0,
        "method": "cash",
        "bill_allocations": [{"bill_id": bill.id, "amount": 100.0}],
    }
    p = client.post("/payments", json=body, headers=auth_headers(token_exec)).json()
    # Manually set status to accountant_approved, then attempt accountant approve again
    pay_row = db_session.get(Payment, p["id"])
    pay_row.status = PaymentStatus.accountant_approved
    db_session.commit()
    acct_token = login_token(client, "acct1", "pass")
    r = client.post(
        f"/accountant/payments/{p['id']}/approve", headers=auth_headers(acct_token)
    )
    assert r.status_code == 400
    assert "Only submitted payments" in r.text


def test_admin_can_bypass_accountant_stage(client, db_session):
    # Payment still submitted, admin can approve directly (bypass accountant)
    exec_user = create_user(db_session, "exec_admin_wrong", Role.executive)
    comp, bill = create_company_with_bill(db_session, code="PADM1")
    from app.models.models import ExecAssignment

    db_session.add(ExecAssignment(executive_id=exec_user.id, company_code=comp.code))
    db_session.commit()
    exec_token = login_token(client, "exec_admin_wrong", "pass")
    body = {
        "company_code": comp.code,
        "collected_at": datetime.datetime.utcnow().isoformat(),
        "amount_collected": 100.0,
        "method": "cash",
        "bill_allocations": [{"bill_id": bill.id, "amount": 100.0}],
    }
    p = client.post("/payments", json=body, headers=auth_headers(exec_token)).json()
    from app.models.models import User
    from app.services.auth import hash_password

    if not db_session.query(User).filter_by(username="admin").first():
        db_session.add(
            User(
                username="admin",
                password_hash=hash_password("admin"),
                role=Role.admin,
                is_active=True,
            )
        )
        db_session.commit()
    admin_token = login_token(client, "admin", "admin")
    r = client.post(
        f"/admin/payments/{p['id']}/approve", headers=auth_headers(admin_token)
    )
    assert r.status_code == 200
    data = r.json()
    assert data["status"] == PaymentStatus.admin_approved.value


def test_admin_user_duplicate_username_400(client, db_session):
    from app.models.models import User
    from app.services.auth import hash_password

    if not db_session.query(User).filter_by(username="admin").first():
        db_session.add(
            User(
                username="admin",
                password_hash=hash_password("admin"),
                role=Role.admin,
                is_active=True,
            )
        )
        db_session.commit()
    admin_token = login_token(client, "admin", "admin")
    r1 = client.post(
        "/admin/users",
        json={"username": "dupuser", "password": "p", "role": "executive"},
        headers=auth_headers(admin_token),
    )
    assert r1.status_code == 200
    r2 = client.post(
        "/admin/users",
        json={"username": "dupuser", "password": "p", "role": "executive"},
        headers=auth_headers(admin_token),
    )
    assert r2.status_code == 400
    assert "Username already exists" in r2.text


def test_admin_user_duplicate_mobile_400(client, db_session):
    from app.models.models import User
    from app.services.auth import hash_password

    if not db_session.query(User).filter_by(username="admin").first():
        db_session.add(
            User(
                username="admin",
                password_hash=hash_password("admin"),
                role=Role.admin,
                is_active=True,
            )
        )
        db_session.commit()
    admin_token = login_token(client, "admin", "admin")
    r1 = client.post(
        "/admin/users",
        json={
            "username": "mob1",
            "password": "p",
            "role": "executive",
            "mobile": "+91 99999 11111",
        },
        headers=auth_headers(admin_token),
    )
    assert r1.status_code == 200
    r2 = client.post(
        "/admin/users",
        json={
            "username": "mob2",
            "password": "p",
            "role": "executive",
            "mobile": "+91 99999 11111",
        },
        headers=auth_headers(admin_token),
    )
    assert r2.status_code == 400
    assert "Mobile already exists" in r2.text


def test_admin_user_hard_delete_with_payments_forbidden(client, db_session):
    from app.models.models import User
    from app.services.auth import hash_password

    if not db_session.query(User).filter_by(username="admin").first():
        db_session.add(
            User(
                username="admin",
                password_hash=hash_password("admin"),
                role=Role.admin,
                is_active=True,
            )
        )
        db_session.commit()
    admin_token = login_token(client, "admin", "admin")
    # Create executive + assignment + payment (submitted)
    exec_user = create_user(db_session, "exec_del", Role.executive)
    comp, bill = create_company_with_bill(db_session, code="DEL1")
    from app.models.models import ExecAssignment

    db_session.add(ExecAssignment(executive_id=exec_user.id, company_code=comp.code))
    db_session.commit()
    token_exec = login_token(client, "exec_del", "pass")
    body = {
        "company_code": comp.code,
        "collected_at": datetime.datetime.utcnow().isoformat(),
        "amount_collected": 100.0,
        "method": "cash",
        "bill_allocations": [{"bill_id": bill.id, "amount": 100.0}],
    }
    client.post("/payments", json=body, headers=auth_headers(token_exec))
    r = client.delete(
        f"/admin/users/{exec_user.id}/hard-delete", headers=auth_headers(admin_token)
    )
    assert r.status_code == 400
    assert "Cannot delete user" in r.text


def test_admin_user_hard_delete_accountant_forbidden(client, db_session):
    from app.models.models import User
    from app.services.auth import hash_password

    if not db_session.query(User).filter_by(username="admin").first():
        db_session.add(
            User(
                username="admin",
                password_hash=hash_password("admin"),
                role=Role.admin,
                is_active=True,
            )
        )
        db_session.commit()
    admin_token = login_token(client, "admin", "admin")
    acct = create_user(db_session, "acct_hd", Role.accountant)
    r = client.delete(
        f"/admin/users/{acct.id}/hard-delete", headers=auth_headers(admin_token)
    )
    assert r.status_code == 400
    assert "Cannot delete admin or accountant users" in r.text


def test_auth_role_forbidden_cases(client, db_session):
    # Accountant trying admin-only endpoint (user creation is admin-only) second user
    create_user(db_session, "acct_role", Role.accountant)
    acct_token = login_token(client, "acct_role", "pass")
    r = client.post(
        "/admin/users",
        json={"username": "x", "password": "p", "role": "executive"},
        headers=auth_headers(acct_token),
    )
    assert r.status_code in (401, 403)
    # Executive trying accountant-only list pending payments
    exec_user = create_user(db_session, "exec_role", Role.executive)
    exec_token = login_token(client, "exec_role", "pass")
    r2 = client.get("/accountant/payments/pending", headers=auth_headers(exec_token))
    assert r2.status_code in (401, 403)
