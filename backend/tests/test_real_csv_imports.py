import csv
import datetime
from decimal import Decimal
from pathlib import Path
import pytest
from sqlalchemy import select
from app.services import imports as imports_mod
from app.services.imports import import_master, import_transactions
from app.services.company import recalc_company_totals
from app.models.models import Company, User, Role, Bill, BillStatus

DATA_DIR = Path(__file__).resolve().parents[1] / "data"
MASTER_CSV = DATA_DIR / "masrmn25.csv"


@pytest.mark.integration
def test_master_import_from_realistic_csv_monkeypatched(db_session, monkeypatch):
    # Parse a subset (first 300 lines) of the realistic CSV to simulate DBF rows
    rows = []
    with MASTER_CSV.open(newline="", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        for i, r in enumerate(reader):
            # Normalize keys to match DBF row style expected by import_master (uppercase original keys)
            rows.append({k: v for k, v in r.items()})
            if i >= 300:
                break
    assert any(r.get("MAIN_CODE") == "SDR" for r in rows)
    assert any(r.get("MAIN_CODE") != "SDR" for r in rows)

    class DummyDBF(list):
        def __init__(self, rows):
            super().__init__(rows)

    def fake_dbf(path, load=True, char_decode_errors="ignore"):
        # Path is ignored; we feed rows directly
        return DummyDBF(rows)

    # Monkeypatch DBF used inside import_master
    monkeypatch.setattr(imports_mod, "DBF", fake_dbf, raising=True)

    # Use a dummy filename to bypass allowlist resolution (file may not exist in repo)
    metrics = import_master(db_session, filename="DUMMY_MASRMN25.DBF")
    # Basic metric sanity
    assert metrics["inserted"] > 0
    # Known SDR code 1636 should exist
    comp = db_session.get(Company, "1636")
    assert comp is not None and comp.name.upper().startswith("OMESH")
    # Non-SDR code 1600 (SCR) should not be imported
    assert db_session.get(Company, "1600") is None
    # Executive auto-created for area 'VS' (present in sample rows like 1636)
    exec_vs = db_session.execute(
        select(User).where(User.role == Role.executive, User.area == "VS")
    ).scalar_one_or_none()
    assert exec_vs is not None and exec_vs.is_active is False


@pytest.mark.integration
def test_transactions_import_and_recalc_with_realistic_company(db_session, monkeypatch):
    # Seed a company similar to one in CSV import earlier
    c = Company(code="TCSV1", name="Test CSV Co")
    db_session.add(c)
    db_session.commit()

    # Monkeypatch DBF for transactions with three bills: two positive (one overdue), one negative
    today = datetime.date.today()
    past = today - datetime.timedelta(days=10)
    future = today + datetime.timedelta(days=15)
    tx_rows = [
        {
            "CODE": "TCSV1",
            "BILL": "BPOS1",
            "DATE": past,
            "DEBIT": 100,
        },  # overdue (due missing -> fallback; set earlier manually)
        {"CODE": "TCSV1", "BILL": "BPOS2", "DATE": future, "DEBIT": 200},  # future
        {"CODE": "TCSV1", "BILL": "BNEG", "DATE": today, "DEBIT": -50},  # negative
    ]

    class DummyTxDBF(list):
        def __init__(self, rows):
            super().__init__(rows)

    def fake_tx_dbf(path, load=True, char_decode_errors="ignore"):
        return DummyTxDBF(tx_rows)

    monkeypatch.setattr(imports_mod, "DBF", fake_tx_dbf, raising=True)
    # Dummy filename to bypass allowlist resolution
    tmetrics = import_transactions(db_session, filename="DUMMY_BOOKSALE.DBF")
    assert tmetrics["inserted"] == 3
    assert tmetrics["negative_debit"] == 1
    # Manually set due dates to force one overdue and one future (since fallback uses bill_date + term)
    bpos1 = (
        db_session.query(Bill)
        .filter(Bill.company_code == "TCSV1", Bill.bill_number == "BPOS1")
        .one()
    )
    bpos2 = (
        db_session.query(Bill)
        .filter(Bill.company_code == "TCSV1", Bill.bill_number == "BPOS2")
        .one()
    )
    bneg = (
        db_session.query(Bill)
        .filter(Bill.company_code == "TCSV1", Bill.bill_number == "BNEG")
        .one()
    )
    bpos1.due_date = past  # overdue
    bpos2.due_date = future
    db_session.commit()
    recalc_company_totals(db_session, "TCSV1")
    db_session.refresh(c)
    # amount = 100 + 200 (negative excluded)
    assert Decimal(str(c.amount)) == Decimal("300")
    # outbal = only overdue positive residual (100)
    assert Decimal(str(c.outbal)) == Decimal("100")
    # Bills pending status
    for b in (bpos1, bpos2, bneg):
        assert b.status == BillStatus.pending


@pytest.mark.integration
def test_full_realistic_transactions_flow_with_area_executives(db_session, monkeypatch):
    """End-to-end style realistic test:
    - Use a subset of real transactions CSV lines to synthesize a master DBF snapshot (companies + areas)
    - Import master to auto-create executives & assignments for multiple areas
    - Import transactions (same subset) with fallback due dates; add a synthetic negative bill
    - Assert metrics, executive creation, and recalculated company totals semantics (amount vs outbal)
    """
    TX_CSV = DATA_DIR / "booksale (1).csv"
    assert TX_CSV.exists(), "transactions CSV fixture missing"

    import itertools
    import datetime as _dt
    from decimal import Decimal as _D

    # Parse first N lines (limit keeps test fast & deterministic)
    subset_rows = []
    with TX_CSV.open(newline="", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        for i, r in enumerate(reader):
            subset_rows.append(r)
            if i >= 40:  # ~40 lines gives multiple areas & companies
                break
    assert subset_rows, "No rows parsed from transactions CSV"

    # Build synthetic master rows from subset (unique companies) deriving AREA
    master_rows = []
    seen_codes = set()
    for r in subset_rows:
        code = r["CODE"].strip()
        if not code or code in seen_codes:
            continue
        seen_codes.add(code)
        area = (r.get("AREA") or "").strip()
        master_rows.append(
            {
                "CODE": code,
                "ACCOUNT_N": code,
                "MAIN_CODE": "SDR",  # force inclusion
                "AREA": area,
            }
        )
    assert len(master_rows) > 5, "Expected multiple companies for breadth"

    # Monkeypatch DBF for master import
    class DummyMasterDBF(list):
        def __init__(self, rows):
            super().__init__(rows)

    def fake_master_dbf(path, load=True, char_decode_errors="ignore"):
        return DummyMasterDBF(master_rows)

    monkeypatch.setattr(imports_mod, "DBF", fake_master_dbf, raising=True)
    m_metrics = import_master(
        db_session, filename="MASRMN25.DBF"
    )  # allowed name triggers normal path branch
    assert m_metrics["inserted"] == len(master_rows)
    # Collect distinct non-empty areas present
    areas = sorted({r.get("AREA") for r in master_rows if r.get("AREA")})
    # Verify an executive per area (inactive) & assignment exists
    for area in areas:
        exec_user = db_session.execute(
            select(User).where(User.role == Role.executive, User.area == area)
        ).scalar_one_or_none()
        assert (
            exec_user is not None and exec_user.is_active is False
        ), f"Exec missing for area {area}"
        # Ensure at least one assignment for that area
        assigned = (
            db_session.execute(select(Company).where(Company.area == area))
            .scalars()
            .all()
        )
        assert assigned, f"No company assigned area {area}"

    # Prepare transactions rows from subset; convert date & debit; omit zero debit rows for expected fallback calc.
    tx_rows = []
    zero_debits = 0
    for r in subset_rows:
        code = r["CODE"].strip()
        bill = r["BILL"].strip()
        # Parse DATE (format like 3/1/2025)
        date_str = r.get("DATE")
        try:
            bill_date = _dt.datetime.strptime(date_str, "%m/%d/%Y").date()
        except Exception:
            # Fallback: try alternative day/month (unlikely here)
            bill_date = _dt.date.today()
        debit_raw = r.get("DEBIT")
        try:
            debit_val = _D(str(debit_raw)) if debit_raw is not None else _D("0")
        except Exception:
            debit_val = _D("0")
        if debit_val == 0:
            zero_debits += 1
        tx_rows.append(
            {
                "CODE": code,
                "BILL": bill,
                "DATE": bill_date,
                "DEBIT": float(debit_val),  # mimic dbfread numeric -> float behavior
            }
        )

    # Add a synthetic negative bill for first company to exercise negative_debit metric and exclusion from amount
    first_code = master_rows[0]["CODE"]
    neg_bill_number = "NEG_SYNTH"
    tx_rows.append(
        {
            "CODE": first_code,
            "BILL": neg_bill_number,
            "DATE": tx_rows[0]["DATE"],
            "DEBIT": -123.45,
        }
    )

    class DummyTxDBF(list):
        def __init__(self, rows):
            super().__init__(rows)

    def fake_tx_dbf(path, load=True, char_decode_errors="ignore"):
        return DummyTxDBF(tx_rows)

    # Patch again (overwriting previous DBF monkeypatch) for transactions import
    monkeypatch.setattr(imports_mod, "DBF", fake_tx_dbf, raising=True)
    t_metrics = import_transactions(db_session, filename="transactions.dbf")

    total_rows = len(tx_rows)
    # IMPORTANT: import_transactions skips zero debit rows; recompute expectation using implementation semantics
    expected_zero_skipped = sum(1 for r in tx_rows if r["DEBIT"] == 0)
    assert t_metrics["zero_debit_skipped"] == expected_zero_skipped
    expected_inserted = total_rows - expected_zero_skipped
    assert t_metrics["inserted"] == expected_inserted
    assert t_metrics["negative_debit"] == 1
    # Fallback due assigned should count only positive ( >0 ) bills
    expected_fallback = sum(1 for r in tx_rows if r["DEBIT"] > 0)
    assert t_metrics["fallback_due_assigned"] == expected_fallback

    # Validate recalculation for a sample company (first_code)
    comp = db_session.get(Company, first_code)
    bills = (
        db_session.query(Bill)
        .filter(Bill.company_code == first_code, Bill.is_archived == False)
        .all()
    )
    pos_sum = _D("0.00")
    for b in bills:
        if b.bill_number == neg_bill_number:
            assert b.amount < 0
        if b.amount > 0:
            pos_sum += _D(str(b.amount))
    # All positive bills' due dates are fallback (bill_date + 30) which is still in the past relative to test date
    # hence outbal == amount == pos_sum
    assert _D(str(comp.amount)) == pos_sum
    assert _D(str(comp.outbal)) == pos_sum
    # credit_date should be oldest due + extension (10 days)
    from datetime import timedelta as _td

    oldest_due = min(b.due_date for b in bills if b.amount > 0)
    expected_credit = oldest_due + _td(days=10)
    assert comp.credit_date == expected_credit

    # Sanity: executives count >= distinct areas imported
    exec_count = db_session.query(User).filter(User.role == Role.executive).count()
    assert exec_count >= len(areas)
