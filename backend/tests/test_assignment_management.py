from app.models.models import User, Role, Company, ExecAssignment
from app.services.auth import hash_password


def test_duplicate_assignment_idempotent(db_session, client):
    # Seed admin, executive, company
    admin = User(
        username="admin_assign",
        password_hash=hash_password("admin"),
        role=Role.admin,
        is_active=True,
    )
    execu = User(
        username="exec_assign",
        password_hash=hash_password("pass"),
        role=Role.executive,
        is_active=True,
    )
    comp = Company(code="AC01", name="AC01")
    db_session.add_all([admin, execu, comp])
    db_session.commit()

    # Login admin
    tok = client.post(
        "/auth/login", json={"username": "admin_assign", "password": "admin"}
    ).json()["access_token"]
    hdr = {"Authorization": f"Bearer {tok}"}

    # First assign
    r1 = client.post(f"/admin/executives/{execu.id}/assign/{comp.code}", headers=hdr)
    assert r1.status_code == 200, r1.text
    # Second assign (duplicate) should still be 200 and not create extra row
    r2 = client.post(f"/admin/executives/{execu.id}/assign/{comp.code}", headers=hdr)
    assert r2.status_code == 200, r2.text

    # Verify only one assignment row exists
    rows = (
        db_session.query(ExecAssignment)
        .filter(
            ExecAssignment.executive_id == execu.id,
            ExecAssignment.company_code == comp.code,
        )
        .all()
    )
    assert len(rows) == 1


def test_unassign_missing_returns_404(db_session, client):
    # Seed admin and unrelated resources
    admin = User(
        username="admin_unassign",
        password_hash=hash_password("admin"),
        role=Role.admin,
        is_active=True,
    )
    other_exec = User(
        username="exec_other",
        password_hash=hash_password("pass"),
        role=Role.executive,
        is_active=True,
    )
    comp = Company(code="AC02", name="AC02")
    db_session.add_all([admin, other_exec, comp])
    db_session.commit()

    tok = client.post(
        "/auth/login", json={"username": "admin_unassign", "password": "admin"}
    ).json()["access_token"]
    hdr = {"Authorization": f"Bearer {tok}"}

    # Ensure there is no assignment row
    assert (
        db_session.query(ExecAssignment)
        .filter(
            ExecAssignment.executive_id == other_exec.id,
            ExecAssignment.company_code == comp.code,
        )
        .first()
        is None
    )

    r = client.delete(
        f"/admin/executives/{other_exec.id}/assign/{comp.code}", headers=hdr
    )
    assert r.status_code == 404
    assert r.json()["detail"].lower().startswith("assignment not found")
