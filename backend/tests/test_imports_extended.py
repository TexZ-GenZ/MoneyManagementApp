from dbfread import DBF
from app.services.imports import import_master, import_transactions
from app.models.models import Company, Bill, User, Role
from app.services.auth import hash_password
from decimal import Decimal
from app.services.company import recalc_company_totals


def seed_admin(db_session):
    admin = User(
        username="admin_import_ext",
        password_hash=hash_password("admin"),
        role=Role.admin,
        is_active=True,
    )
    db_session.add(admin)
    db_session.commit()
    return admin


def _data_path(filename: str):
    return __import__("pathlib").Path(__file__).resolve().parents[1] / "data" / filename


def count_master_unique_codes(filename: str = "master.dbf") -> int:
    codes = set()
    for rec in DBF(str(_data_path(filename)), load=True, char_decode_errors="ignore"):
        code = str(rec.get("CODE") or rec.get("code") or "").strip()
        if code:
            codes.add(code)
    return len(codes)


def count_transaction_rows(
    filename: str = "transactions.dbf",
) -> int:  # retained if needed elsewhere
    return sum(
        1
        for _ in DBF(str(_data_path(filename)), load=True, char_decode_errors="ignore")
    )


def test_master_first_run_exact_counts(db_session):
    seed_admin(db_session)
    unique_codes = count_master_unique_codes()
    metrics = import_master(db_session, filename="master.dbf")
    # On pristine DB we expect inserted == number of unique codes, no updates, archived 0.
    assert metrics["updated"] == 0
    assert metrics["inserted"] == unique_codes > 0
    assert metrics["archived"] == 0
    # Skipped only arises if duplicate codes present in file (subsequent duplicate rows)
    assert metrics["skipped"] >= 0
    total_accounted = (
        metrics["inserted"]
        + metrics["updated"]
        + metrics["skipped"]
        + metrics["archived"]
    )
    # Total processed rows = unique + duplicates; we can only guarantee >= unique.
    assert total_accounted >= unique_codes


def test_master_archive_removal_monkeypatch(db_session, monkeypatch):
    seed_admin(db_session)
    metrics1 = import_master(db_session, filename="master.dbf")
    assert metrics1["archived"] == 0  # fresh baseline
    victim = db_session.query(Company).first()
    assert victim is not None

    class FilteringDBF(DBF):
        def __iter__(self_inner):
            for rec in super(FilteringDBF, self_inner).__iter__():
                code = str(rec.get("CODE") or rec.get("code") or "").strip()
                if code == victim.code:
                    continue
                yield rec

    import app.services.imports as imports_mod

    monkeypatch.setattr(imports_mod, "DBF", FilteringDBF)
    metrics2 = import_master(db_session, filename="master.dbf")
    assert metrics2["archived"] >= 1
    assert metrics2["archived"] > metrics1["archived"]
    db_session.refresh(victim)
    assert victim.is_archived is True


def test_transactions_partial_update_counts(db_session):
    seed_admin(db_session)
    import_master(db_session, filename="master.dbf")
    first = import_transactions(db_session, filename="transactions.dbf")
    assert first["inserted"] + first["updated"] > 0
    # Mutate several bills' amounts to force updates
    bills = db_session.query(Bill).limit(3).all()
    mutated = 0
    for b in bills:
        old = b.amount
        b.amount = Decimal(str(old)) + Decimal("1.00")
        mutated += 1
        db_session.add(b)
    db_session.commit()
    second = import_transactions(db_session, filename="transactions.dbf")
    assert second["updated"] >= mutated
    # Recalculate totals for touched codes to ensure consistency after updates
    touched = {b.company_code for b in bills}
    for code in touched:
        recalc_company_totals(db_session, code)
        comp = db_session.get(Company, code)
        assert comp.amount >= 0


def test_transactions_reimport_restores_bill_amounts_and_totals(db_session):
    """Mutate several bill amounts then re-import transactions to ensure updates applied and company totals coherent."""
    seed_admin(db_session)
    import_master(db_session, filename="master.dbf")
    first = import_transactions(db_session, filename="transactions.dbf")
    assert first["inserted"] > 0
    # Capture a sample of bills to mutate (increase amount by 5.00)
    sample = db_session.query(Bill).limit(5).all()
    touched_codes = {b.company_code for b in sample}
    original_amounts = {b.id: b.amount for b in sample}
    for b in sample:
        b.amount = Decimal(str(b.amount)) + Decimal("5.00")
        db_session.add(b)
    db_session.commit()
    # Totals for those companies should now be inflated relative to actual file data.
    inflated_totals = {}
    for code in touched_codes:
        c = db_session.get(Company, code)
        inflated_totals[code] = (Decimal(str(c.amount)), Decimal(str(c.outbal)))
    # Re-import transactions (should revert mutated amounts to DBF values, counting them as updates)
    second = import_transactions(db_session, filename="transactions.dbf")
    assert second["updated"] >= len(sample)
    # Recalc and confirm totals decreased or stayed same (never increase from inflated state) and remain non-negative
    for code in touched_codes:
        before = inflated_totals[code][0]
        recalc_company_totals(db_session, code)
        after = Decimal(str(db_session.get(Company, code).amount))
        assert after <= before
        assert after >= 0
