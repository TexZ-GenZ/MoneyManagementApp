from pathlib import Path
from decimal import Decimal
import time
from sqlalchemy.orm import Session
from dbfread import DBF
from app.models.models import Company, Bill, BillStatus
from app.services.company import recalc_company_totals

DATA_DIR = Path(__file__).resolve().parents[2] / "data"

# Simple chunk size for periodic flush to reduce memory peak when large imports.
CHUNK_SIZE = 500


def import_master(db: Session, filename: str = "master.dbf") -> dict:
    """Import the master DBF file.

    Returns a metrics dictionary: inserted, updated, skipped, archived, seconds.
    Skipped rows are those where no field actually changed and the record was already active.
    """
    path = DATA_DIR / filename
    started = time.time()
    inserted = updated = skipped = 0
    seen_codes: set[str] = set()
    # Preload existing to allow change detection without hitting ORM attribute history per row.
    existing = {c.code: (c.name, c.area, c.is_archived) for c in db.query(Company).all()}
    for idx, row in enumerate(DBF(str(path), load=True, char_decode_errors="ignore")):
        r = {str(k).lower(): v for k, v in row.items()}
        code = str(r.get("code") or "").strip()
        if not code:
            continue
        seen_codes.add(code)
        name = str(r.get("account_n") or r.get("name") or code).strip()
        area = str(r.get("area") or "").strip()
        comp = db.get(Company, code)
        if not comp:
            comp = Company(code=code, name=name, area=area)
            db.add(comp)
            inserted += 1
        else:
            prev = existing.get(code)
            if prev and prev[0] == name and prev[1] == area and prev[2] is False:
                skipped += 1
            else:
                comp.name = name
                comp.area = area
                updated += 1
        # Always un-archive if present in file.
        if comp.is_archived:
            comp.is_archived = False
        if (inserted + updated) % CHUNK_SIZE == 0:
            db.flush()
    # Archive (soft) companies missing in snapshot.
    if seen_codes:
        db.query(Company).filter(~Company.code.in_(seen_codes)).update(
            {Company.is_archived: True}, synchronize_session=False
        )
    db.commit()
    duration = time.time() - started
    archived = max(0, len(existing) - len(seen_codes))
    return {
        "inserted": inserted,
        "updated": updated,
        "skipped": skipped,
        "archived": archived,
        "seconds": round(duration, 3),
    }


def import_transactions(db: Session, filename: str = "transactions.dbf") -> dict:
    """Import transactions DBF file (bills).

    Returns metrics dict similar to import_master.
    """
    path = DATA_DIR / filename
    started = time.time()
    inserted = updated = skipped = 0
    seen_numbers: set[str] = set()
    touched_codes: set[str] = set()
    # Preload existing bills for quick change detection (avoid per-row attribute comparisons).
    existing = {
        b.bill_number: (
            b.company_code,
            str(b.amount),
            str(b.due_date),
            b.is_archived,
        )
        for b in db.query(Bill).all()
    }
    for idx, row in enumerate(DBF(str(path), load=True, char_decode_errors="ignore")):
        r = {str(k).lower(): v for k, v in row.items()}
        bill_no = str(r.get("bill") or r.get("bill_number") or "").strip()
        code = str(r.get("code") or "").strip()
        if not bill_no or not code:
            continue
        seen_numbers.add(bill_no)
        touched_codes.add(code)
        bill_date = r.get("date")
        due_date = r.get("due_date") or r.get("duedate")
        debit = r.get("debit") or r.get("amount")
        new_amount = Decimal(debit or 0)
        if not db.get(Company, code):
            db.add(Company(code=code, name=code, area=None))
        bill = db.query(Bill).filter(Bill.bill_number == bill_no).one_or_none()
        if not bill:
            bill = Bill(
                bill_number=bill_no,
                company_code=code,
                bill_date=bill_date,
                due_date=due_date,
                amount=new_amount,
                amount_paid=Decimal(0),
                status=BillStatus.pending,
                is_archived=False,
            )
            db.add(bill)
            inserted += 1
        else:
            prev = existing.get(bill_no)
            snapshot = (code, str(new_amount), str(due_date), False)
            if prev and prev == snapshot:
                skipped += 1
            else:
                bill.company_code = code
                bill.bill_date = bill_date
                bill.due_date = due_date
                bill.amount = new_amount
                bill.is_archived = False
                updated += 1
        if (inserted + updated) % CHUNK_SIZE == 0:
            db.flush()
    # Archive bills missing in snapshot.
    if seen_numbers:
        db.query(Bill).filter(~Bill.bill_number.in_(seen_numbers)).update(
            {Bill.is_archived: True}, synchronize_session=False
        )
    db.commit()
    for code in touched_codes:
        recalc_company_totals(db, code)
    duration = time.time() - started
    archived = max(0, len(existing) - len(seen_numbers))
    return {
        "inserted": inserted,
        "updated": updated,
        "skipped": skipped,
        "archived": archived,
        "seconds": round(duration, 3),
    }
