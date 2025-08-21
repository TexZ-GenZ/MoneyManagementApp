from app.models.models import User, Role, Company, Bill
from app.services.auth import hash_password
from app.services.imports import import_master, import_transactions
from pathlib import Path
import shutil

DATA_DIR = Path(__file__).resolve().parents[1] / "data"


def write_dummy_master(tmp_name: str, rows: list[dict]):
    # We rely on existing sample DBF files; to avoid DBF creation complexity in tests (dbf structure),
    # we instead copy the provided master.dbf and treat import metrics behavior via existing file content.
    # For focused metrics tests, we'll run import twice and assert second run yields only skips (no inserts/updates).
    src = DATA_DIR / "master.dbf"
    dest = DATA_DIR / tmp_name
    shutil.copyfile(src, dest)
    return dest


def write_dummy_transactions(tmp_name: str):
    src = DATA_DIR / "transactions.dbf"
    dest = DATA_DIR / tmp_name
    shutil.copyfile(src, dest)
    return dest


def seed_admin(db_session):
    admin = User(
        username="admin_import",
        password_hash=hash_password("admin"),
        role=Role.admin,
        is_active=True,
    )
    db_session.add(admin)
    db_session.commit()
    return admin


def test_master_import_idempotent(db_session):
    seed_admin(db_session)
    # First run
    metrics1 = import_master(db_session, filename="master.dbf")
    # Ensure file produced some activity (insert/update/skip) without assuming ordering vs other tests
    assert (metrics1["inserted"] + metrics1["updated"] + metrics1["skipped"]) > 0
    total1 = (
        metrics1["inserted"]
        + metrics1["updated"]
        + metrics1["skipped"]
        + metrics1["archived"]
    )
    assert total1 >= 0
    assert metrics1["seconds"] >= 0
    # Second run should have zero inserts/updates and only skips (or zeros) depending on unchanged file
    metrics2 = import_master(db_session, filename="master.dbf")
    assert metrics2["inserted"] == 0
    assert metrics2["updated"] == 0
    # archived can be 0; skipped >= 0 (can't assert exact without parsing DBF content)
    assert "skipped" in metrics2
    total2 = (
        metrics2["inserted"]
        + metrics2["updated"]
        + metrics2["skipped"]
        + metrics2["archived"]
    )
    assert total2 >= 0
    assert metrics2["seconds"] >= 0


def test_transactions_import_idempotent(db_session):
    seed_admin(db_session)
    # Pre-import master to ensure companies exist for any bills
    import_master(db_session, filename="master.dbf")
    metrics1 = import_transactions(db_session, filename="transactions.dbf")
    assert (metrics1["inserted"] + metrics1["updated"] + metrics1["skipped"]) > 0
    total1 = (
        metrics1["inserted"]
        + metrics1["updated"]
        + metrics1["skipped"]
        + metrics1["archived"]
    )
    assert total1 >= 0
    assert metrics1["seconds"] >= 0
    metrics2 = import_transactions(db_session, filename="transactions.dbf")
    assert metrics2["inserted"] == 0
    assert metrics2["updated"] == 0
    assert "skipped" in metrics2
    total2 = (
        metrics2["inserted"]
        + metrics2["updated"]
        + metrics2["skipped"]
        + metrics2["archived"]
    )
    assert total2 >= 0
    assert metrics2["seconds"] >= 0


def test_master_import_detects_updates(db_session):
    seed_admin(db_session)
    m1 = import_master(db_session, filename="master.dbf")
    # Pick an existing company and mutate its name so import should treat it as an update
    comp = db_session.query(Company).first()
    assert comp is not None
    original_name = comp.name
    comp.name = (original_name or comp.code) + "_MUT"  # diverge from file snapshot
    db_session.add(comp)
    db_session.commit()
    m2 = import_master(db_session, filename="master.dbf")
    # Should register at least one update (restoring name back to snapshot)
    assert m2["updated"] >= 1


def test_transactions_import_detects_updates(db_session):
    seed_admin(db_session)
    import_master(db_session, filename="master.dbf")
    t1 = import_transactions(db_session, filename="transactions.dbf")
    bill = db_session.query(Bill).first()
    assert bill is not None
    # Change amount to something different so import should update it back
    bill.amount = bill.amount + 1
    db_session.add(bill)
    db_session.commit()
    t2 = import_transactions(db_session, filename="transactions.dbf")
    assert t2["updated"] >= 1
